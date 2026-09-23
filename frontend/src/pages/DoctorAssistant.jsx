/**
 * DoctorAssistant.jsx — MediSense AI Full Clinical Kiosk & CDSS Flow
 * ====================================================================
 * Real-Time 5-Step Patient Journey:
 *  Step 1: Kiosk Registration (Live Camera with Face ID Lock & Returning Auto-Scan)
 *  Step 2: 30s Contactless rPPG Face Scan (POS/CHROM Algorithm)
 *  Step 3: Vitals Result + Repeat Visit Longitudinal Delta Intelligence
 *  Step 4: AI Symptom Interview (Adaptive to Vitals + Past Visit History)
 *  Step 5: CDSS Clinical Report + Severity Routing (Doctor vs Nurse Tokens)
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import FaceCapture  from '../components/FaceCapture.jsx';
import VitalsPanel  from '../components/VitalsPanel.jsx';
import WaveChart    from '../components/WaveChart.jsx';
import ScanProgress from '../components/ScanProgress.jsx';
import SymptomInterview from '../components/SymptomInterview.jsx';
import PrescriptionReport from '../components/PrescriptionReport.jsx';
import KioskModeSelector from '../components/KioskModeSelector.jsx';
import LongitudinalComparison from '../components/LongitudinalComparison.jsx';
import DoctorVerificationModal from '../components/DoctorVerificationModal.jsx';
import { useRPPG }  from '../hooks/useRPPG.js';
import { useTamilVoice } from '../hooks/useTamilVoice.js';
import { patientDb } from '../services/patientDb.js';

const STEPS = {
  WELCOME:      1,
  SCAN:         2,
  VITALS:       3,
  INTERVIEW:    4,
  PRESCRIPTION: 5,
};

const STEP_LABELS = {
  [STEPS.WELCOME]:      'கியோஸ்க் பதிவு (Face ID)',
  [STEPS.SCAN]:         'முக ஸ்கேன்',
  [STEPS.VITALS]:       'உடல் அளவுகள்',
  [STEPS.INTERVIEW]:    'அறிகுறிகள்',
  [STEPS.PRESCRIPTION]: 'CDSS அறிக்கை & டோக்கன்',
};

const API_BASE = '/api';

export default function DoctorAssistant({ onBack }) {
  const [step, setStep] = useState(STEPS.WELCOME);

  // Patient & Face ID State
  const [activePatient, setActivePatient] = useState(null);
  const [liveLandmarks, setLiveLandmarks] = useState(null);
  const videoElementRef = useRef(null);

  // rPPG State
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

  // Prescription / CDSS state
  const [prescription, setPrescription] = useState(null);
  const [prescriptionLoading, setPrescriptionLoading] = useState(false);

  // Doctor/Nurse Verification Portal state
  const [doctorModalOpen, setDoctorModalOpen] = useState(false);
  const [doctorToken, setDoctorToken] = useState(null);

  const { speak, stopSpeaking, isSpeaking, voice, setVoice } = useTamilVoice();

  // ── Backend Health Check ───────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/status`)
      .then(r => r.ok ? setBackendOk(true) : setBackendOk(false))
      .catch(() => setBackendOk(false));
  }, []);

  // ── Handle Live Landmarks from Camera ──────────────────────────────────────
  const handleLandmarks = useCallback((landmarks, videoEl) => {
    setLiveLandmarks(landmarks);
    if (videoEl) {
      videoElementRef.current = videoEl;
    }
  }, []);

  // ── Synchronized Voice Guidance per Step ──────────────────────────────────
  useEffect(() => {
    let timer = null;

    if (step === STEPS.WELCOME) {
      timer = setTimeout(() => {
        speak('வணக்கம்! மெடிசென்ஸ் AI கியோஸ்கிற்கு நல்வரவு. உங்கள் முக அடையாளத்தை பதிவு செய்யவும் அல்லது ஏற்கனவே வந்தவராக இருந்தால் முகத்தை ஸ்கேன் செய்யவும்.');
      }, 400);
    } else if (step === STEPS.SCAN) {
      timer = setTimeout(() => {
        speak('உங்கள் முகத்தை கேமராவின் மையத்தில் வைக்கவும். தயாரானதும் ஸ்டார்ட் ஸ்கேன் பொத்தானை அழுத்தவும்.');
      }, 400);
    } else if (step === STEPS.VITALS) {
      timer = setTimeout(() => {
        if (activePatient?.past_visits?.length > 0) {
          speak('ஸ்கேன் முடிந்தது. முந்தைய வருகையுடனான உடல் அளவு ஒப்பீடு தயாராக உள்ளது. அடுத்து உங்கள் அறிகுறிகளை தேர்வு செய்யவும்.');
        } else {
          speak('அடிப்படை உடல் பரிசோதனை முடிந்தது. அடுத்து உங்கள் உடல் பிரச்சனைகள் மற்றும் அறிகுறிகளைப் பற்றி சொல்லுங்கள்.');
        }
      }, 400);
    }

    return () => {
      if (timer) clearTimeout(timer);
      stopSpeaking();
    };
  }, [step, speak, stopSpeaking, activePatient]);

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
          patient_info: activePatient,
          past_visits: activePatient?.past_visits || [],
        }),
      });
      const data = await res.json();
      setCurrentQuestion(data);
    } catch (err) {
      console.error('Interview question 1 error:', err);
    } finally {
      setInterviewLoading(false);
    }
  }, [vitals, activePatient]);

  // ── Generate CDSS Prescription Report & Save Visit ─────────────────────────
  const generatePrescription = useCallback(async (answers) => {
    stopSpeaking();
    setStep(STEPS.PRESCRIPTION);
    setPrescriptionLoading(true);
    speak('உங்கள் CDSS சிகிச்சை அறிக்கை தயாராகிறது. சற்று பொறுங்கள்...');

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
          patient_info: activePatient,
          past_visits: activePatient?.past_visits || [],
        }),
      });
      const data = await res.json();
      setPrescription(data);

      // Save visit record to fresh database
      if (activePatient?.uhid) {
        await patientDb.addVisit({
          uhid: activePatient.uhid,
          vitals: vitals,
          primary_complaint: primaryComplaint,
          symptom_answers: answers,
          triage: triage,
          triage_decision: data.triage_decision,
          prescription: data,
          assigned_route: data.assigned_role || 'nurse',
          doctor_notes: data.assessment_english,
        });

        // Refresh active patient's local visit list
        const updatedPat = await patientDb.getPatientByUhid(activePatient.uhid);
        if (updatedPat) setActivePatient(updatedPat);
      }
    } catch (err) {
      console.error('Prescription error:', err);
    } finally {
      setPrescriptionLoading(false);
    }
  }, [vitals, triage, primaryComplaint, activePatient, speak, stopSpeaking]);

  // ── Handle interview answer → next question ────────────────────────────────
  const handleAnswer = useCallback(async (answerObj) => {
    const newAnswers = [...symptomAnswers, answerObj];
    setSymptomAnswers(newAnswers);

    if (currentQuestion?.is_final || questionNumber >= (currentQuestion?.total_questions || 4)) {
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
          patient_info: activePatient,
          past_visits: activePatient?.past_visits || [],
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
  }, [symptomAnswers, currentQuestion, questionNumber, vitals, primaryComplaint, activePatient, generatePrescription]);

  // ── Reset everything ────────────────────────────────────────────────────────
  const handleRestart = useCallback(() => {
    stopSpeaking();
    reset();
    setStep(STEPS.WELCOME);
    setActivePatient(null);
    setPrimaryComplaint('');
    setCurrentQuestion(null);
    setSymptomAnswers([]);
    setQuestionNumber(1);
    setPrescription(null);
    setFaceDetected(false);
    setDoctorToken(null);
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
    setDoctorToken(null);
  }, [reset, stopSpeaking]);

  const canScan = phase === 'idle' && faceDetected && backendOk;
  const isActive = phase === 'scanning' || phase === 'analyzing';

  return (
    <div
      className="min-h-screen text-slate-100 flex flex-col"
      style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1530 50%, #0a0f1e 100%)' }}
    >
      {/* ── Top Header ───────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
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
            <h1 className="text-sm font-bold flex items-center gap-2">
              <span>MediSense AI</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-700 text-cyan-300 font-mono">
                Face ID & CDSS Kiosk
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              {activePatient ? `${activePatient.name} (${activePatient.uhid})` : 'Contactless rPPG Triage'}
            </p>
          </div>
        </div>

        {/* ── Voice & Status Controls ── */}
        <div className="flex items-center gap-2">
          {/* Neural Voice Switcher */}
          <div className="flex items-center bg-slate-800/90 border border-slate-700/80 rounded-full p-0.5 text-xs shadow-inner">
            <button
              type="button"
              onClick={() => {
                setVoice('female');
                speak('வணக்கம்! நான் டாக்டர் பல்லவி, உங்கள் MediSense AI மருத்துவ உதவியாளர்.', 'female');
              }}
              className={`px-2.5 py-1 rounded-full font-medium transition-all flex items-center gap-1 ${
                voice === 'female'
                  ? 'bg-gradient-to-r from-violet-600 to-pink-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Dr. Pallavi (Female Voice)"
            >
              <span>👩‍⚕️ பல்லவி</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setVoice('male');
                speak('வணக்கம்! நான் டாக்டர் வள்ளுவர், உங்கள் MediSense AI மருத்துவர்.', 'male');
              }}
              className={`px-2.5 py-1 rounded-full font-medium transition-all flex items-center gap-1 ${
                voice === 'male'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Dr. Valluvar (Male Voice)"
            >
              <span>👨‍⚕️ வள்ளுவர்</span>
            </button>
          </div>

          {/* Test Voice Button */}
          <button
            type="button"
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

      {/* ── Step Progress Indicator ──────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-slate-800/50">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          {Object.entries(STEPS).map(([key, num]) => (
            <div key={num} className="flex items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step === num
                  ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-900/40'
                  : step > num
                  ? 'bg-green-700 text-green-200'
                  : 'bg-slate-800 text-slate-600'
              }`}>
                {step > num ? '✓' : num}
              </div>
              {num < 5 && <div className={`w-8 h-0.5 ${step > num ? 'bg-green-700' : 'bg-slate-800'}`} />}
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-slate-400 mt-1.5 font-medium">
          {STEP_LABELS[step]} {activePatient ? `• ${activePatient.name}` : ''}
        </p>
      </div>

      {/* ── Main Content Area ────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6">

          {/* ════════════════════════════════════════════════════════════════════
              STEP 1: KIOSK REGISTRATION (Face ID + Camera + 2 Options)
          ════════════════════════════════════════════════════════════════════ */}
          {step === STEPS.WELCOME && (
            <div className="space-y-6 text-center animate-fade-in">
              <div className="pt-2">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center text-3xl shadow-xl shadow-violet-900/50 mb-3">
                  🏥
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">
                  MediSense AI Kiosk
                </h2>
                <p className="text-xs text-cyan-400 font-medium mb-1">
                  Contactless rPPG Triage & Clinical Decision Support System
                </p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Face ID Biometric Registration • Longitudinal Trend Tracking • Doctor/Nurse Sign-off
                </p>
              </div>

              {/* Live Face Detection Camera preview for Face ID Lock & Recognition */}
              <div className="medical-card p-3 glow-cyan max-w-md mx-auto">
                <p className="text-[11px] font-mono text-slate-400 uppercase tracking-widest mb-2 text-center">
                  📷 Live Face ID Sensor (நேரடி முக உணரி)
                </p>
                <FaceCapture
                  phase="idle"
                  onFrame={pushFrame}
                  onFaceDetected={setFaceDetected}
                  onLandmarks={handleLandmarks}
                />
              </div>

              {/* 2-Option Kiosk Mode Selector Component */}
              <KioskModeSelector
                activePatient={activePatient}
                onSelectPatient={setActivePatient}
                onProceed={() => {
                  stopSpeaking();
                  setStep(STEPS.SCAN);
                }}
                speak={speak}
                liveLandmarks={liveLandmarks}
                videoElement={videoElementRef.current}
              />
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              STEP 2: 30s rPPG SCAN
          ════════════════════════════════════════════════════════════════════ */}
          {step === STEPS.SCAN && (
            <div className="space-y-4 animate-fade-in text-left">
              <div className="text-center mb-2">
                <h2 className="text-lg font-bold text-white">
                  {activePatient?.is_nurse_assisted ? '👩‍⚕️ முக ஸ்கேன் (Nurse Assisted Scan)' : 'முக ஸ்கேன் (Contactless rPPG)'}
                </h2>
                <p className="text-xs text-slate-400">
                  {activePatient ? `Patient: ${activePatient.name} (${activePatient.uhid})` : 'Position face inside camera frame'}
                </p>
              </div>

              {/* Camera */}
              <div className="medical-card p-4 glow-cyan">
                <FaceCapture
                  phase={phase}
                  onFrame={pushFrame}
                  onFaceDetected={setFaceDetected}
                  onLandmarks={handleLandmarks}
                />
              </div>

              {/* Live Waveform */}
              {(phase === 'scanning' || waveBuffer.length > 0) && (
                <WaveChart
                  waveBuffer={waveBuffer}
                  phase={phase}
                  title="rPPG Pulse Waveform (POS/CHROM DSP Fusion)"
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
                  type="button"
                  onClick={startScan}
                  disabled={!canScan || isActive}
                  className={`py-4 rounded-xl font-bold text-sm transition-all ${
                    canScan && !isActive
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/50 scale-[1.01]'
                      : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  {isActive ? '⏳ Scanning (இயங்குகிறது)...' : '▶ Start 30s Scan (தொடங்கு)'}
                </button>
                <button
                  type="button"
                  onClick={phase === 'scanning' ? stopScan : handleRestart}
                  disabled={phase === 'idle' || phase === 'analyzing'}
                  className="py-4 rounded-xl font-bold text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {phase === 'scanning' ? '⏹ Stop Early' : '↺ Reset'}
                </button>
              </div>

              {/* Guidance */}
              <div className="text-center text-xs text-slate-400">
                {!faceDetected  && 'கேமராவின் முன் அமரவும் / Position face inside frame'}
                {faceDetected   && phase === 'idle' && backendOk === true && '✅ முகம் கண்டறியப்பட்டது — Start Scan அழுத்தவும்!'}
                {phase === 'scanning'  && `📡 rPPG அலைகள் சேகரிக்கப்படுகிறது... (${timeLeft}s)`}
                {phase === 'analyzing' && '🧠 AI analyzing vitals & running Welch PSD...'}
              </div>

              {error && (
                <div className="bg-red-900/20 border border-red-700 rounded-xl p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              STEP 3: VITALS RESULT & REPEAT VISIT LONGITUDINAL COMPARISON
          ════════════════════════════════════════════════════════════════════ */}
          {step === STEPS.VITALS && vitals && (
            <div className="space-y-5 animate-fade-in text-left">
              <div className="text-center">
                <div className="text-3xl mb-1">✅</div>
                <h2 className="text-lg font-bold text-white">Scan Complete!</h2>
                <p className="text-xs text-cyan-400">
                  {activePatient ? `Results for ${activePatient.name} (${activePatient.uhid})` : 'உடல் அளவுகள் தயார்'}
                </p>
              </div>

              {/* Repeat Visit Longitudinal Comparison (if returning patient) */}
              {activePatient?.past_visits?.length > 0 && (
                <LongitudinalComparison
                  currentVitals={vitals}
                  pastVisits={activePatient.past_visits}
                />
              )}

              {/* Triage Risk Banner */}
              {triage && (
                <div className={`rounded-2xl p-4 border text-center ${
                  triage.risk_color === 'green' ? 'bg-green-900/30 border-green-700'
                  : triage.risk_color === 'amber'  ? 'bg-amber-900/30 border-amber-700'
                  : 'bg-red-900/30 border-red-700'
                }`}>
                  <p className={`font-bold text-base mb-1 ${
                    triage.risk_color === 'green' ? 'text-green-400'
                    : triage.risk_color === 'amber'  ? 'text-amber-400'
                    : 'text-red-400'
                  }`}>
                    {triage.risk_level === 'Stable' ? '🟢' : triage.risk_level === 'Alert' ? '🟡' : '🔴'} {triage.risk_level}
                  </p>
                  <p className="text-xs text-slate-300">{triage.advice_tanglish}</p>
                </div>
              )}

              {/* Vitals Cards */}
              <VitalsPanel vitals={vitals} />

              {/* Continue to Interview */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={startInterview}
                  className="w-full py-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-violet-600 via-cyan-600 to-blue-600 hover:from-violet-500 hover:to-cyan-500 text-white shadow-2xl shadow-violet-900/40 transition-all hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <span>🩺</span>
                  <span>அறிகுறிகளைப் பதிவு செய்க (Start Symptom Check)</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              STEP 4: DYNAMIC AI SYMPTOM INTERVIEW
          ════════════════════════════════════════════════════════════════════ */}
          {step === STEPS.INTERVIEW && (
            <div className="space-y-4 animate-fade-in text-left">
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
              STEP 5: CDSS PRESCRIPTION REPORT & DOCTOR/NURSE VERIFICATION
          ════════════════════════════════════════════════════════════════════ */}
          {step === STEPS.PRESCRIPTION && (
            <div className="space-y-4 animate-fade-in text-left">
              {prescriptionLoading ? (
                <div className="text-center py-16 space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-violet-900/40 border-2 border-violet-700 flex items-center justify-center text-3xl animate-pulse">
                    🤖
                  </div>
                  <p className="text-violet-400 font-medium text-sm">CDSS Clinical Assessment Generating...</p>
                  <p className="text-slate-500 text-xs" style={{ fontFamily: 'Noto Sans Tamil, sans-serif' }}>
                    AI சிகிச்சை அறிக்கை தயாரிக்கிறது...
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
                <>
                  <PrescriptionReport
                    report={prescription}
                    vitals={vitals}
                    patient={activePatient}
                    pastVisits={activePatient?.past_visits || []}
                    triage={triage}
                    onNewScan={handleNewScan}
                    onRestart={handleRestart}
                    onOpenDoctorModal={() => setDoctorModalOpen(true)}
                    doctorToken={doctorToken}
                  />

                  {/* Doctor/Nurse Verification Modal Dialog */}
                  <DoctorVerificationModal
                    isOpen={doctorModalOpen}
                    onClose={() => setDoctorModalOpen(false)}
                    patient={activePatient}
                    vitals={vitals}
                    triage={triage}
                    report={prescription}
                    onVerificationComplete={(tokenData) => {
                      setDoctorToken(tokenData);
                    }}
                  />
                </>
              ) : null}
            </div>
          )}

        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 px-4 py-2 text-center">
        <p className="text-[11px] text-slate-600">
          ⚕️ MediSense AI is a Clinical Decision Support System (CDSS) for preliminary screening • Verified by Licensed Practitioners
        </p>
      </footer>
    </div>
  );
}
