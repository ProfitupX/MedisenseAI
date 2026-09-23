/**
 * DoctorAssistant.jsx — AI Doctor Assistant Full Patient Flow
 * =============================================================
 * 5-Step Patient Journey:
 *  Step 1: Welcome Kiosk Screen
 *  Step 2: rPPG Face Scan (30s, uses existing pipeline)
 *  Step 3: Vitals Result + AI Triage Summary
 *  Step 4: Symptom Interview (4 Q&A with Tamil TTS)
 *  Step 5: Final Prescription Report + Triage Decision
 */

import React, { useState, useCallback, useEffect } from 'react';
import FaceCapture  from '../components/FaceCapture.jsx';
import VitalsPanel  from '../components/VitalsPanel.jsx';
import WaveChart    from '../components/WaveChart.jsx';
import ScanProgress from '../components/ScanProgress.jsx';
import SymptomInterview from '../components/SymptomInterview.jsx';
import PrescriptionReport from '../components/PrescriptionReport.jsx';
import { useRPPG }  from '../hooks/useRPPG.js';
import { useTamilVoice } from '../hooks/useTamilVoice.js';

const STEPS = {
  WELCOME:      1,
  SCAN:         2,
  VITALS:       3,
  INTERVIEW:    4,
  PRESCRIPTION: 5,
};

const STEP_LABELS = {
  [STEPS.WELCOME]:      'வரவேற்பு',
  [STEPS.SCAN]:         'முக ஸ்கேன்',
  [STEPS.VITALS]:       'உடல் அளவுகள்',
  [STEPS.INTERVIEW]:    'அறிகுறிகள்',
  [STEPS.PRESCRIPTION]: 'சிகிச்சை அறிக்கை',
};

const API_BASE = '/api';

export default function DoctorAssistant({ onBack }) {
  const [step, setStep] = useState(STEPS.WELCOME);

  // rPPG state
  const {
    phase, progress, timeLeft, vitals, triage, scanQuality,
    error, waveBuffer, frameCount,
    pushFrame, startScan, stopScan, reset,
  } = useRPPG();

  const [faceDetected, setFaceDetected] = useState(false);
  const [backendOk,    setBackendOk]    = useState(null);

  // Interview state
  const [primaryComplaint, setPrimaryComplaint] = useState('');
  const [currentQuestion,  setCurrentQuestion]  = useState(null);
  const [symptomAnswers,   setSymptomAnswers]    = useState([]);
  const [questionNumber,   setQuestionNumber]    = useState(1);
  const [interviewLoading, setInterviewLoading]  = useState(false);

  // Prescription state
  const [prescription, setPrescription] = useState(null);
  const [prescriptionLoading, setPrescriptionLoading] = useState(false);

  const { speak, stopSpeaking, isSpeaking, voice, setVoice } = useTamilVoice();

  // ── Backend health check ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/status`)
      .then(r => r.ok ? setBackendOk(true) : setBackendOk(false))
      .catch(() => setBackendOk(false));
  }, []);

  // ── Synchronized Voice Guidance per Step with Immediate Clean Cancellation ──
  useEffect(() => {
    let timer = null;

    if (step === STEPS.WELCOME) {
      timer = setTimeout(() => {
        speak('வணக்கம்! ஆண்டிகிராவிட்டி AI மருத்துவ உதவியாளருக்கு நல்வரவு. தொடங்குவதற்கு ஸ்டார்ட் செக்கப் பொத்தானை அழுத்தவும்.');
      }, 400);
    } else if (step === STEPS.SCAN) {
      timer = setTimeout(() => {
        speak('உங்கள் முகத்தை கேமராவின் மையத்தில் வைக்கவும். தயாரானதும் ஸ்டார்ட் ஸ்கேன் பொத்தானை அழுத்தவும்.');
      }, 400);
    } else if (step === STEPS.VITALS) {
      timer = setTimeout(() => {
        speak('அடிப்படை உடல் பரிசோதனை முடிந்தது. அடுத்து உங்கள் உடல் பிரச்சனைகள் மற்றும் அறிகுறிகளைப் பற்றி சொல்லுங்கள்.');
      }, 400);
    }

    return () => {
      if (timer) clearTimeout(timer);
      stopSpeaking();
    };
  }, [step, speak, stopSpeaking]);

  // ── Auto-advance: scan done → go to vitals ────────────────────────────────
  useEffect(() => {
    if (step === STEPS.SCAN && phase === 'results' && vitals) {
      stopSpeaking();
      setStep(STEPS.VITALS);
    }
  }, [phase, vitals, step, stopSpeaking]);

  // ── Start Interview ────────────────────────────────────────────────────────
  const startInterview = useCallback(() => {
    stopSpeaking();
    setStep(STEPS.INTERVIEW);
    setPrimaryComplaint('');
    setCurrentQuestion(null);
    setSymptomAnswers([]);
    setQuestionNumber(1);
  }, [stopSpeaking]);

  // ── Patient Selects Primary Complaint ──────────────────────────────────────
  const handleSelectComplaint = useCallback(async (complaint) => {
    if (!complaint) {
      setPrimaryComplaint('');
      setCurrentQuestion(null);
      return;
    }

    setPrimaryComplaint(complaint);
    setInterviewLoading(true);
    setSymptomAnswers([]);
    setQuestionNumber(1);

    try {
      const res = await fetch(`${API_BASE}/symptom-interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vitals: vitals,
          primary_complaint: complaint,
          previous_answers: [],
          question_number: 1,
        }),
      });
      const data = await res.json();
      setCurrentQuestion(data);
    } catch (err) {
      console.error('Interview question 1 error:', err);
    } finally {
      setInterviewLoading(false);
    }
  }, [vitals]);

  // ── Generate prescription report ───────────────────────────────────────────
  const generatePrescription = useCallback(async (answers) => {
    stopSpeaking();
    setStep(STEPS.PRESCRIPTION);
    setPrescriptionLoading(true);
    speak('உங்கள் சிகிச்சை அறிக்கை தயாராகிறது. சற்று பொறுங்கள்...');

    try {
      const res = await fetch(`${API_BASE}/prescription-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vitals: vitals,
          triage: triage,
          primary_complaint: primaryComplaint,
          symptom_answers: answers.map(a => ({
            question_number: a.question_number,
            question_english: a.question_english,
            answer: a.answer,
          })),
        }),
      });
      const data = await res.json();
      setPrescription(data);
    } catch (err) {
      console.error('Prescription error:', err);
    } finally {
      setPrescriptionLoading(false);
    }
  }, [vitals, triage, primaryComplaint, speak, stopSpeaking]);

  // ── Handle interview answer → next question ────────────────────────────────
  const handleAnswer = useCallback(async (answerObj) => {
    const newAnswers = [...symptomAnswers, answerObj];
    setSymptomAnswers(newAnswers);

    if (currentQuestion?.is_final || questionNumber >= (currentQuestion?.total_questions || 4)) {
      // All questions answered → generate prescription
      await generatePrescription(newAnswers);
      return;
    }

    const nextQNum = questionNumber + 1;
    setQuestionNumber(nextQNum);
    setInterviewLoading(true);

    try {
      const res = await fetch(`${API_BASE}/symptom-interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vitals: vitals,
          primary_complaint: primaryComplaint,
          previous_answers: newAnswers.map(a => ({
            question_number: a.question_number,
            question_english: a.question_english,
            answer: a.answer,
          })),
          question_number: nextQNum,
        }),
      });
      const data = await res.json();
      setCurrentQuestion(data);
    } catch (err) {
      console.error('Next question error:', err);
      await generatePrescription(newAnswers);
    } finally {
      setInterviewLoading(false);
    }
  }, [symptomAnswers, currentQuestion, questionNumber, vitals, primaryComplaint, generatePrescription]);

  // ── Reset everything ────────────────────────────────────────────────────────
  const handleRestart = useCallback(() => {
    stopSpeaking();
    reset();
    setStep(STEPS.WELCOME);
    setPrimaryComplaint('');
    setCurrentQuestion(null);
    setSymptomAnswers([]);
    setQuestionNumber(1);
    setPrescription(null);
    setFaceDetected(false);
  }, [reset, stopSpeaking]);

  const handleNewScan = useCallback(() => {
    stopSpeaking();
    reset();
    setStep(STEPS.SCAN);
    setPrimaryComplaint('');
    setCurrentQuestion(null);
    setSymptomAnswers([]);
    setQuestionNumber(1);
    setPrescription(null);
  }, [reset, stopSpeaking]);

  const canScan = phase === 'idle' && faceDetected && backendOk;
  const isActive = phase === 'scanning' || phase === 'analyzing';

  return (
    <div
      className="min-h-screen text-slate-100 flex flex-col"
      style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1530 50%, #0a0f1e 100%)' }}
    >
      {/* ── Top Nav ──────────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-all"
            title="Back to Dashboard"
          >
            ←
          </button>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-lg">
            🩺
          </div>
          <div>
            <h1 className="text-sm font-bold">AI Doctor Assistant</h1>
            <p className="text-xs text-slate-500">AI மருத்துவ உதவியாளர்</p>
          </div>
        </div>

        {/* ── Voice & Status Controls ── */}
        <div className="flex items-center gap-2">
          {/* Neural Voice Switcher */}
          <div className="flex items-center bg-slate-800/90 border border-slate-700/80 rounded-full p-0.5 text-xs shadow-inner">
            <button
              onClick={() => {
                setVoice('female');
                speak('வணக்கம்! நான் டாக்டர் பல்லவி, உங்கள் AI மருத்துவ உதவியாளர்.', 'female');
              }}
              className={`px-2.5 py-1 rounded-full font-medium transition-all flex items-center gap-1 ${
                voice === 'female'
                  ? 'bg-gradient-to-r from-violet-600 to-pink-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Switch to Dr. Pallavi (Female Voice)"
            >
              <span>👩‍⚕️ பல்லவி</span>
            </button>
            <button
              onClick={() => {
                setVoice('male');
                speak('வணக்கம்! நான் டாக்டர் வள்ளுவர், உங்கள் AI மருத்துவர்.', 'male');
              }}
              className={`px-2.5 py-1 rounded-full font-medium transition-all flex items-center gap-1 ${
                voice === 'male'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Switch to Dr. Valluvar (Male Voice)"
            >
              <span>👨‍⚕️ வள்ளுவர்</span>
            </button>
          </div>

          {/* Test Voice Button */}
          <button
            onClick={() => {
              const testMsg = voice === 'female'
                ? 'வணக்கம்! நான் டாக்டர் பல்லவி. உங்கள் உடல் அளவுகளை பரிசோதிக்க தயாராக உள்ளேன்.'
                : 'வணக்கம்! நான் டாக்டர் வள்ளுவர். உங்கள் உடல் அளவுகளை பரிசோதிக்க தயாராக உள்ளேன்.';
              speak(testMsg);
            }}
            disabled={isSpeaking}
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all border
              ${isSpeaking
                ? 'border-violet-500 bg-violet-600 text-white animate-pulse'
                : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            title="Test AI Voice"
          >
            {isSpeaking ? '🔊' : '🔈'}
          </button>

          {/* Backend Status */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-800 bg-slate-900/60 text-xs text-slate-400">
            <span className={`w-1.5 h-1.5 rounded-full ${backendOk ? 'bg-green-400' : 'bg-red-400'}`} />
            <span>{backendOk ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      </header>

      {/* ── Step Indicator ───────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-slate-800/50">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          {Object.entries(STEPS).map(([key, num]) => (
            <div key={num} className="flex items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                ${step === num ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-900/40'
                : step > num  ? 'bg-green-700 text-green-200'
                :               'bg-slate-800 text-slate-600'}`}
              >
                {step > num ? '✓' : num}
              </div>
              {num < 5 && <div className={`w-8 h-0.5 ${step > num ? 'bg-green-700' : 'bg-slate-800'}`} />}
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-slate-500 mt-1.5">
          {STEP_LABELS[step]}
        </p>
      </div>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-6">

          {/* ════════════════════════════════════════════════════════════════════
              STEP 1: WELCOME
          ════════════════════════════════════════════════════════════════════ */}
          {step === STEPS.WELCOME && (
            <div className="space-y-8 text-center animate-fade-in">
              {/* Hero Icon */}
              <div className="pt-6">
                <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center text-5xl shadow-2xl shadow-violet-900/50 mb-6">
                  🏥
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  AI Doctor Assistant
                </h2>
                <p className="text-base text-cyan-400 font-medium mb-1">
                  உங்கள் AI மருத்துவ உதவியாளர்
                </p>
                <p className="text-sm text-slate-400 leading-relaxed max-w-xs mx-auto">
                  Advanced rPPG scan + AI symptom interview + Tamil voice guidance
                </p>
              </div>

              {/* Feature List */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5 text-left space-y-3">
                {[
                  { icon: '📷', en: 'Face scan — 30 second rPPG', ta: 'முக ஸ்கேன் — 30 விநாடி rPPG' },
                  { icon: '💓', en: 'Heart rate, BP, SpO₂, Hemoglobin', ta: 'இதய துடிப்பு, இரத்த அழுத்தம், ஆக்சிஜன்' },
                  { icon: '🤖', en: 'AI symptom interview in Tamil', ta: 'AI அறிகுறி நேர்காணல் — தமிழில்' },
                  { icon: '💊', en: 'Personalized care plan + medicines', ta: 'தனிப்பட்ட மருத்துவ திட்டம்' },
                  { icon: '🔈', en: 'Tamil voice guidance (TTS/STT)', ta: 'தமிழ் குரல் வழிகாட்டுதல்' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <span className="text-xl">{item.icon}</span>
                    <div>
                      <p className="text-sm text-slate-200">{item.en}</p>
                      <p className="text-xs text-slate-500" style={{ fontFamily: 'Noto Sans Tamil, sans-serif' }}>
                        {item.ta}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Backend Warning */}
              {backendOk === false && (
                <div className="bg-red-900/20 border border-red-700 rounded-xl p-3 text-left">
                  <p className="text-red-400 text-xs font-mono mb-1">⚠️ Backend offline</p>
                  <pre className="text-xs text-green-400 bg-slate-900 rounded p-2 overflow-x-auto">
{`cd backend
python main.py`}
                  </pre>
                </div>
              )}

              {/* Start Button */}
              <button
                onClick={() => {
                  stopSpeaking();
                  setStep(STEPS.SCAN);
                }}
                disabled={backendOk === false}
                className={`w-full py-4 rounded-2xl font-bold text-base transition-all duration-200
                  ${backendOk !== false
                    ? 'bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white shadow-2xl shadow-violet-900/40 hover:shadow-violet-900/60 hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  }`}
              >
                🏥 Start Checkup / பரிசோதனை தொடங்கு
              </button>

              <p className="text-xs text-slate-600 pb-4">
                ⚕️ This AI system assists in preliminary screening only — not a replacement for clinical diagnosis.
              </p>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              STEP 2: SCAN
          ════════════════════════════════════════════════════════════════════ */}
          {step === STEPS.SCAN && (
            <div className="space-y-4 animate-fade-in">
              <div className="text-center mb-2">
                <h2 className="text-lg font-bold text-white">முக ஸ்கேன்</h2>
                <p className="text-sm text-slate-400">Position your face — 30 second rPPG scan</p>
              </div>

              {/* Camera */}
              <div className="medical-card p-4 glow-cyan">
                <FaceCapture
                  phase={phase}
                  onFrame={pushFrame}
                  onFaceDetected={setFaceDetected}
                />
              </div>

              {/* Live Waveform */}
              {(phase === 'scanning' || waveBuffer.length > 0) && (
                <WaveChart
                  waveBuffer={waveBuffer}
                  phase={phase}
                  title="rPPG Signal"
                />
              )}

              {/* Progress */}
              <ScanProgress
                phase={phase}
                progress={progress}
                timeLeft={timeLeft}
                frameCount={frameCount}
              />

              {/* Controls */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={startScan}
                  disabled={!canScan || isActive}
                  className={`py-3.5 rounded-xl font-semibold text-sm transition-all
                    ${canScan && !isActive
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg'
                      : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    }`}
                >
                  {isActive ? '⏳ Scanning...' : '▶ Start Scan'}
                </button>
                <button
                  onClick={phase === 'scanning' ? stopScan : handleRestart}
                  disabled={phase === 'idle' || phase === 'analyzing'}
                  className="py-3.5 rounded-xl font-semibold text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {phase === 'scanning' ? '⏹ Stop' : '↺ Reset'}
                </button>
              </div>

              {/* Guidance */}
              <div className="text-center text-xs text-slate-500">
                {!faceDetected  && 'Unga mugaththa camera-la vaikavum / Position face in camera'}
                {faceDetected   && phase === 'idle' && backendOk === false && '⚠️ Start Python backend first'}
                {faceDetected   && phase === 'idle' && backendOk === true  && '✅ Ready — Start scan-a press pannunga!'}
                {phase === 'scanning'  && `📡 rPPG data collect panrathu... still-ah iru! (${timeLeft}s)`}
                {phase === 'analyzing' && '🧠 AI analyzing vitals...'}
              </div>

              {error && (
                <div className="bg-red-900/20 border border-red-700 rounded-xl p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              STEP 3: VITALS RESULT
          ════════════════════════════════════════════════════════════════════ */}
          {step === STEPS.VITALS && vitals && (
            <div className="space-y-5 animate-fade-in">
              <div className="text-center">
                <div className="text-3xl mb-2">✅</div>
                <h2 className="text-lg font-bold text-white">Scan Complete!</h2>
                <p className="text-sm text-cyan-400">Unga vitals ready — Paakalam!</p>
              </div>

              {/* Triage Risk Banner */}
              {triage && (
                <div className={`rounded-2xl p-4 border text-center
                  ${triage.risk_color === 'green' ? 'bg-green-900/30 border-green-700'
                  : triage.risk_color === 'amber'  ? 'bg-amber-900/30 border-amber-700'
                  : 'bg-red-900/30 border-red-700'}`}
                >
                  <p className={`font-bold text-lg mb-1
                    ${triage.risk_color === 'green' ? 'text-green-400'
                    : triage.risk_color === 'amber'  ? 'text-amber-400'
                    : 'text-red-400'}`}
                  >
                    {triage.risk_level === 'Stable' ? '🟢' : triage.risk_level === 'Alert' ? '🟡' : '🔴'} {triage.risk_level}
                  </p>
                  <p className="text-sm text-slate-300">{triage.advice_tanglish}</p>
                </div>
              )}

              {/* Vitals Cards */}
              <VitalsPanel vitals={vitals} />

              {/* Continue to Interview */}
              <div className="space-y-3 pt-3">
                <p className="text-center text-xs text-slate-400 leading-relaxed">
                  அடிப்படை உடல் பரிசோதனை முடிந்தது. அடுத்து உங்கள் அறிகுறிகளைப் பதிவு செய்யுங்கள்.
                </p>
                <button
                  onClick={startInterview}
                  className="w-full py-4 rounded-2xl font-bold text-base bg-gradient-to-r from-violet-600 via-cyan-600 to-blue-600 hover:from-violet-500 hover:to-cyan-500 text-white shadow-2xl shadow-violet-900/40 transition-all hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <span>🩺</span>
                  <span>அறிகுறிகளைப் பதிவு செய்க (Start Symptom Check)</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              STEP 4: SYMPTOM INTERVIEW
          ════════════════════════════════════════════════════════════════════ */}
          {step === STEPS.INTERVIEW && (
            <div className="space-y-4 animate-fade-in">
              <SymptomInterview
                primaryComplaint={primaryComplaint}
                onSelectComplaint={handleSelectComplaint}
                question={currentQuestion}
                onAnswer={handleAnswer}
                isLoading={interviewLoading}
              />
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              STEP 5: PRESCRIPTION REPORT
          ════════════════════════════════════════════════════════════════════ */}
          {step === STEPS.PRESCRIPTION && (
            <div className="space-y-4 animate-fade-in">
              <div className="text-center">
                <h2 className="text-lg font-bold text-white">சிகிச்சை அறிக்கை</h2>
                <p className="text-sm text-slate-400">AI Health Report</p>
              </div>

              {prescriptionLoading ? (
                <div className="text-center py-16 space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-violet-900/40 border-2 border-violet-700 flex items-center justify-center text-3xl animate-pulse">
                    🤖
                  </div>
                  <p className="text-violet-400 font-medium">AI report tayar panrathu...</p>
                  <p className="text-slate-500 text-sm" style={{ fontFamily: 'Noto Sans Tamil, sans-serif' }}>
                    AI அறிக்கை தயாரிக்கிறது...
                  </p>
                  <div className="flex justify-center gap-1 mt-4">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-violet-500 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              ) : prescription ? (
                <PrescriptionReport
                  report={prescription}
                  vitals={vitals}
                  onNewScan={handleNewScan}
                  onRestart={handleRestart}
                />
              ) : null}
            </div>
          )}

        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 px-4 py-2 text-center">
        <p className="text-xs text-slate-700">
          ⚕️ AI preliminary screening only — Not a substitute for clinical diagnosis
        </p>
      </footer>
    </div>
  );
}
