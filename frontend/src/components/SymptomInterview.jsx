/**
 * SymptomInterview.jsx — Adaptive AI Clinical Symptom Interview
 * ==============================================================
 * Step 1: Chief Complaint Selection (Fever, Cold, Chest Pain, Headache, etc. + Voice/Text)
 * Step 2: Dynamic, symptom-specific clinical follow-up Q&A
 * Features:
 * - Native Tamil Neural TTS question reading
 * - Tamil Speech-to-Text (STT) voice answer input
 * - Dynamic option selection + custom text support
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useTamilVoice } from '../hooks/useTamilVoice.js';

// Common presenting symptoms
const SYMPTOM_PRESETS = [
  { id: 'fever',    icon: '🌡️', title: 'காய்ச்சல்', en: 'Fever / High Body Temp', desc: 'உடல் சூடு, நடுக்கம், சோர்வு' },
  { id: 'cold',     icon: '🤧', title: 'சளி & இருமல்', en: 'Cold & Cough', desc: 'வறட்டு/சளி இருமல், தொண்டை வலி, மூக்கடைப்பு' },
  { id: 'headache', icon: '🤕', title: 'தலைவலி & மயக்கம்', en: 'Headache & Dizziness', desc: 'ஒற்றைத் தலைவலி, பாரம், கண் மங்குதல்' },
  { id: 'breath',   icon: '🫁', title: 'மூச்சுத்திணறல்', en: 'Shortness of Breath', desc: 'சுவாசிப்பதில் சிரமம், நெஞ்சு இறுக்கம்' },
  { id: 'chest',    icon: '💔', title: 'நெஞ்சு அசௌகரியம்', en: 'Chest Discomfort / Heart Racing', desc: 'படபடப்பு, வலி, வியர்வை' },
  { id: 'stomach',  icon: '🤢', title: 'வயிற்று வலி & அசிடிட்டி', en: 'Stomach Pain & Acidity', desc: 'நெஞ்செரிச்சல், குமட்டல், செரியாமை' },
  { id: 'fatigue',  icon: '🥱', title: 'உடல் சோர்வு & வலி', en: 'Fatigue & Body Ache', desc: 'தசை வலி, பலவீனம், மூட்டு வலி' },
];

export default function SymptomInterview({
  primaryComplaint,
  onSelectComplaint,
  question,
  onAnswer,
  isLoading
}) {
  const { speak, isSpeaking, startListening, isListening, sttTranscript } = useTamilVoice();

  const [selectedOption, setSelectedOption] = useState(null);
  const [customText, setCustomText]         = useState('');
  const [customInputMode, setCustomInputMode] = useState(false);

  // ── Auto-speak on symptom selection screen ──────────────────────────────────
  useEffect(() => {
    let t = null;
    if (!primaryComplaint) {
      t = setTimeout(() => {
        speak('உங்களுக்கு என்ன உடல் பிரச்சனை உள்ளது? கீழே உள்ளதை தேர்ந்தெடுக்கவும் அல்லது பேசிப் பதிவு செய்யவும்.');
      }, 350);
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [primaryComplaint, speak]);

  // ── Auto-speak question when it changes ────────────────────────────────────
  useEffect(() => {
    let t = null;
    if (primaryComplaint && question) {
      const speechText = question.question_tamil || question.question_tanglish;
      if (speechText) {
        t = setTimeout(() => {
          speak(speechText);
        }, 300);
      }
    }
    setSelectedOption(null);
    setCustomText('');
    setCustomInputMode(false);

    return () => {
      if (t) clearTimeout(t);
    };
  }, [primaryComplaint, question?.question_number, speak]);

  // ── Update custom input from STT ───────────────────────────────────────────
  useEffect(() => {
    if (sttTranscript) {
      setCustomText(sttTranscript);
    }
  }, [sttTranscript]);

  const handleOptionClick = useCallback((option) => {
    setSelectedOption(option);
    setCustomInputMode(false);
    setCustomText('');
  }, []);

  const handleSubmitAnswer = useCallback(() => {
    const finalAnswer = selectedOption || customText.trim();
    if (!finalAnswer) return;
    onAnswer({
      question_number: question.question_number,
      question_english: question.question_english,
      answer: finalAnswer,
    });
  }, [selectedOption, customText, question, onAnswer]);

  const handleVoiceInput = useCallback(() => {
    setCustomInputMode(true);
    setSelectedOption(null);
    startListening((transcript) => {
      setCustomText(transcript);
    }, 'ta-IN');
  }, [startListening]);

  // ═════════════════════════════════════════════════════════════════════════════
  // VIEW 1: CHIEF COMPLAINT SELECTION (Fever, Cold, Chest Pain, etc.)
  // ═════════════════════════════════════════════════════════════════════════════
  if (!primaryComplaint) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center text-2xl mb-3 shadow-lg shadow-violet-900/40">
            🩺
          </div>
          <h2 className="text-xl font-bold text-white mb-1">
            உங்களுக்கு என்ன உடல் பிரச்சனை உள்ளது?
          </h2>
          <p className="text-xs text-cyan-400 font-medium">
            What is your main symptom or health concern?
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            கீழே உள்ளவற்றில் ஒன்றைத் தேர்ந்தெடுக்கவும் அல்லது உங்கள் சொந்த வார்த்தைகளில் பேசவும்/டைப் செய்யவும்:
          </p>
        </div>

        {/* Symptom Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SYMPTOM_PRESETS.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelectComplaint(`${item.title} (${item.en})`)}
              className="p-3.5 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/80 text-left transition-all duration-200 flex items-start gap-3 group hover:shadow-lg hover:shadow-cyan-950/30"
            >
              <span className="text-2xl p-2 rounded-xl bg-slate-900/80 group-hover:scale-110 transition-transform">
                {item.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
                  {item.title}
                </p>
                <p className="text-[11px] text-slate-400 font-mono">
                  {item.en}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                  {item.desc}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Custom / Voice Symptom Box */}
        <div className="bg-slate-900/70 border border-slate-700/80 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <span>✍️</span>
              <span>வேறு ஏதேனும் பிரச்சனை என்றால் இங்கே கூறவும்:</span>
            </label>
            <span className="text-[11px] text-slate-500">Other symptoms</span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="எ.கா: 2 நாட்களாக கடுமையான முதுகு வலி..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
            />
            <button
              onClick={handleVoiceInput}
              className={`px-3 py-2 rounded-xl transition-all text-sm border flex items-center gap-1.5 ${
                isListening
                  ? 'border-red-500 bg-red-950/50 text-red-400 animate-pulse'
                  : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-violet-500 hover:text-violet-300'
              }`}
              title="Speak in Tamil via Microphone"
            >
              <span>{isListening ? '🎙️' : '🎤'}</span>
              <span className="text-xs font-medium">{isListening ? 'கேட்கிறது...' : 'பேசவும்'}</span>
            </button>
          </div>

          {customText.trim() && (
            <button
              onClick={() => onSelectComplaint(customText.trim())}
              className="w-full py-2.5 rounded-xl font-semibold text-xs bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-md transition-all"
            >
              அறிகுறியை உறுதிப்படுத்துக →
            </button>
          )}
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // VIEW 2: ADAPTIVE SYMPTOM Q&A
  // ═════════════════════════════════════════════════════════════════════════════
  if (!question) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="w-12 h-12 border-3 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto" />
        <p className="text-sm text-cyan-300 font-medium">அடுத்த கேள்வியை தயார் செய்கிறது...</p>
        <p className="text-xs text-slate-500">Preparing follow-up medical question...</p>
      </div>
    );
  }

  const progress = ((question.question_number - 1) / (question.total_questions || 4)) * 100;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Active Symptom Indicator Badge */}
      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">பிரச்சனை:</span>
          <span className="text-cyan-300 font-medium truncate max-w-[200px]">{primaryComplaint}</span>
        </div>
        <button
          onClick={() => onSelectComplaint('')}
          className="text-slate-400 hover:text-slate-200 text-[11px] underline"
        >
          மாற்று
        </button>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex justify-between text-xs text-slate-400 mb-1.5">
          <span className="font-medium text-cyan-400">
            கேள்வி {question.question_number} / {question.total_questions || 4}
          </span>
          <span className="text-slate-500">
            Question {question.question_number} of {question.total_questions || 4}
          </span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 via-cyan-500 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 shadow-xl">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-lg flex-shrink-0 shadow-md">
            🩺
          </div>
          <div className="flex-1 min-w-0">
            {/* Tamil Script Question */}
            <p className="text-sm font-semibold text-white leading-relaxed mb-1" style={{ fontFamily: 'Noto Sans Tamil, sans-serif' }}>
              {question.question_tamil}
            </p>
            {/* Tanglish & English */}
            <p className="text-xs text-cyan-300 leading-relaxed">
              {question.question_tanglish}
            </p>
            {question.question_english && (
              <p className="text-[11px] text-slate-500 italic mt-0.5">
                {question.question_english}
              </p>
            )}
          </div>

          {/* Voice Speak Button */}
          <button
            onClick={() => speak(question.question_tamil || question.question_tanglish)}
            disabled={isSpeaking}
            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0 transition-all border ${
              isSpeaking
                ? 'border-violet-500 bg-violet-600 text-white animate-pulse shadow-lg shadow-violet-900/50'
                : 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title="Listen to question (Tamil AI Voice)"
          >
            {isSpeaking ? '🔊' : '🔈'}
          </button>
        </div>

        {/* Options List */}
        <div className="space-y-2 mt-4">
          {question.options.map((option, idx) => {
            const tamilLabel = question.options_tamil?.[idx];
            const isSelected = selectedOption === option;

            return (
              <button
                key={idx}
                onClick={() => handleOptionClick(option)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all duration-200 border flex flex-col gap-0.5 ${
                  isSelected
                    ? 'border-cyan-500 bg-cyan-950/40 text-cyan-200 shadow-md shadow-cyan-950/50 scale-[1.01]'
                    : 'border-slate-700/80 bg-slate-900/50 text-slate-300 hover:border-slate-500 hover:bg-slate-800/60'
                }`}
              >
                {tamilLabel && (
                  <span className="font-semibold text-white text-xs" style={{ fontFamily: 'Noto Sans Tamil, sans-serif' }}>
                    {tamilLabel}
                  </span>
                )}
                <span className="text-xs text-slate-400 font-medium">
                  {option}
                </span>
              </button>
            );
          })}
        </div>

        {/* Custom Typing & Voice Input */}
        <div className="mt-4 pt-3 border-t border-slate-700/60 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>அல்லது உங்கள் பதிலை எழுதவும் / பேசவும்:</span>
            <span>Type or speak answer</span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={customText}
              onChange={(e) => {
                setCustomText(e.target.value);
                setSelectedOption(null);
                setCustomInputMode(true);
              }}
              placeholder="உங்கள் பதிலை இங்கே உள்ளிடவும்..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
            />
            <button
              onClick={handleVoiceInput}
              className={`px-3 py-2 rounded-xl transition-all text-xs border flex items-center gap-1.5 ${
                isListening
                  ? 'border-red-500 bg-red-950/50 text-red-400 animate-pulse'
                  : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-violet-500 hover:text-violet-300'
              }`}
              title="Voice answer in Tamil"
            >
              <span>{isListening ? '🎙️' : '🎤'}</span>
              <span>{isListening ? 'கேட்கிறது...' : 'குரல்'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Submit / Next Button */}
      <button
        onClick={handleSubmitAnswer}
        disabled={(!selectedOption && !customText.trim()) || isLoading}
        className={`w-full py-4 rounded-xl font-bold text-sm transition-all duration-200 shadow-xl ${
          (selectedOption || customText.trim()) && !isLoading
            ? 'bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white shadow-violet-900/40 hover:scale-[1.01]'
            : 'bg-slate-800 text-slate-600 cursor-not-allowed'
        }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-slate-500 border-t-cyan-400 rounded-full animate-spin" />
            AI ஆய்வு செய்கிறது...
          </span>
        ) : question.is_final ? (
          '✅ பரிசோதனையை முடித்து அறிக்கை காண்க (Get Prescription)'
        ) : (
          'அடுத்த கேள்விக்கு செல்க →'
        )}
      </button>
    </div>
  );
}
