/**
 * PrescriptionReport.jsx — Final AI Prescription & Triage Report
 * ================================================================
 * Displays: assessment, possible conditions, medicines, home care tips,
 * triage decision, and disclaimer. Tamil TTS reads the assessment aloud.
 */

import React, { useEffect, useRef } from 'react';
import { useTamilVoice } from '../hooks/useTamilVoice.js';

const TRIAGE_CONFIG = {
  'Self-Care':         { color: 'green',  icon: '🏠', bg: 'from-green-900/40  to-emerald-900/20', border: 'border-green-700',  text: 'text-green-400'  },
  'See Doctor in 24h': { color: 'amber',  icon: '🏥', bg: 'from-amber-900/40  to-yellow-900/20',  border: 'border-amber-700',  text: 'text-amber-400'  },
  'Emergency':         { color: 'red',    icon: '🚨', bg: 'from-red-900/50    to-rose-900/30',     border: 'border-red-700',    text: 'text-red-400'    },
};

export default function PrescriptionReport({ report, vitals, onNewScan, onRestart }) {
  const { speak, isSpeaking } = useTamilVoice();
  const hasSpoken = useRef(false);

  // Auto-speak triage decision + assessment on load with Tamil Neural voice
  useEffect(() => {
    if (report && !hasSpoken.current) {
      hasSpoken.current = true;
      const msg = report.triage_tamil || report.triage_tanglish || report.assessment_tamil || '';
      if (msg) {
        setTimeout(() => speak(msg), 800);
      }
    }
  }, [report, speak]);

  if (!report) return null;

  const triage = TRIAGE_CONFIG[report.triage_decision] || TRIAGE_CONFIG['Self-Care'];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-900/40 border border-violet-700 text-violet-300 text-sm font-medium mb-3">
          🩺 AI Health Report
        </div>
        <h2 className="text-xl font-bold text-white">{report.assessment_title}</h2>
        <p className="text-sm text-slate-400 mt-1">{report.assessment_english}</p>
      </div>

      {/* ── Assessment Card (Tanglish) ──────────────────────────────────────── */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-lg flex-shrink-0">
            🤖
          </div>
          <div className="flex-1">
            <p className="text-sm text-cyan-300 leading-relaxed mb-2">
              {report.assessment_tanglish}
            </p>
            <p className="text-xs text-slate-400 leading-relaxed" style={{ fontFamily: 'Noto Sans Tamil, sans-serif' }}>
              {report.assessment_tamil}
            </p>
          </div>
          <button
            onClick={() => speak(report.assessment_tamil || report.assessment_tanglish)}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 transition-all
              ${isSpeaking ? 'bg-violet-600 animate-pulse shadow-lg shadow-violet-900/50' : 'bg-slate-700 hover:bg-slate-600'} text-slate-300`}
            title="Listen to Assessment (Tamil AI Voice)"
          >
            {isSpeaking ? '🔊' : '🔈'}
          </button>
        </div>
      </div>

      {/* ── Triage Decision ─────────────────────────────────────────────────── */}
      <div className={`bg-gradient-to-r ${triage.bg} border ${triage.border} rounded-2xl p-5`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{triage.icon}</span>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-widest">Triage Decision / முடிவு</p>
              <p className={`text-xl font-bold ${triage.text}`}>{report.triage_decision}</p>
            </div>
          </div>
          <button
            onClick={() => speak(report.triage_tamil || report.triage_tanglish)}
            className="px-3 py-1.5 rounded-lg bg-slate-800/80 text-xs text-slate-300 hover:bg-slate-700 transition-all border border-slate-700/50 flex items-center gap-1.5"
            title="Listen to Triage (Tamil AI Voice)"
          >
            <span>🔈</span>
            <span>கேளுங்கள்</span>
          </button>
        </div>
        <p className="text-sm text-slate-200 mb-1">{report.triage_tanglish}</p>
        <p className="text-xs text-slate-400" style={{ fontFamily: 'Noto Sans Tamil, sans-serif' }}>
          {report.triage_tamil}
        </p>
      </div>

      {/* ── Possible Conditions ─────────────────────────────────────────────── */}
      {report.possible_conditions?.length > 0 && (
        <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
          <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-3">
            🔬 Possible Conditions
          </h3>
          <div className="flex flex-wrap gap-2">
            {report.possible_conditions.map((cond, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 rounded-full bg-blue-900/30 border border-blue-700 text-blue-300 text-xs font-medium"
              >
                {cond}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Medicines ───────────────────────────────────────────────────────── */}
      {report.medicines?.length > 0 && (
        <div>
          <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-3 px-1">
            💊 Suggested Medicines
          </h3>
          <div className="space-y-3">
            {report.medicines.map((med, idx) => (
              <div
                key={idx}
                className="bg-slate-800/50 border border-slate-700 rounded-xl p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-semibold text-white">{med.name}</p>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-900/40 border border-cyan-700 text-cyan-300 text-xs">
                    {med.dosage}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mb-2">
                  <div>
                    <span className="text-slate-500">அளவு / முறை: </span>
                    <span className="text-slate-300 font-medium">{med.frequency}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">கால அளவு: </span>
                    <span className="text-slate-300 font-medium">{med.duration || '3-5 நாட்கள்'}</span>
                  </div>
                </div>
                {med.reason && (
                  <p className="text-xs text-slate-400 mb-1.5 bg-slate-900/40 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 font-medium">பயன்: </span>
                    <span className="text-cyan-300">{med.reason}</span>
                  </p>
                )}
                {med.caution && (
                  <div className="flex items-start gap-1.5 mt-2 text-xs text-amber-300 bg-amber-950/30 p-2 rounded-lg border border-amber-900/50">
                    <span>⚠️</span>
                    <span>{med.caution}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Prescription disclaimer */}
          <p className="text-xs text-slate-600 mt-2 px-1">
            ⚕️ OTC medicines only — Always verify with a pharmacist before taking.
          </p>
        </div>
      )}

      {/* ── Home Care Tips ──────────────────────────────────────────────────── */}
      {report.home_care?.length > 0 && (
        <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
          <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-3">
            🏠 Home Care Tips
          </h3>
          <div className="space-y-2">
            {report.home_care.map((tip, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-green-400 flex-shrink-0 mt-0.5">✓</span>
                <div>
                  <p>{tip}</p>
                  {report.home_care_tamil?.[idx] && (
                    <p className="text-xs text-slate-500 mt-0.5" style={{ fontFamily: 'Noto Sans Tamil, sans-serif' }}>
                      {report.home_care_tamil[idx]}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Follow Up ───────────────────────────────────────────────────────── */}
      {report.follow_up && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-violet-900/20 border border-violet-800 text-sm">
          <span className="text-violet-400">📅</span>
          <p className="text-violet-300">{report.follow_up}</p>
        </div>
      )}

      {/* ── Vitals Summary Strip ────────────────────────────────────────────── */}
      {vitals && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-3">Scan Vitals Summary</p>
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div>
              <p className="text-slate-500">Heart Rate</p>
              <p className="text-cyan-400 font-bold">{vitals.heart_rate_bpm?.toFixed(0)} BPM</p>
            </div>
            <div>
              <p className="text-slate-500">SpO₂</p>
              <p className="text-green-400 font-bold">{vitals.spo2_percent?.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-slate-500">Blood Pressure</p>
              <p className="text-amber-400 font-bold">
                {vitals.blood_pressure?.sbp}/{vitals.blood_pressure?.dbp}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Resp Rate</p>
              <p className="text-blue-400 font-bold">{vitals.respiration_rate?.toFixed(0)} BrPM</p>
            </div>
            <div>
              <p className="text-slate-500">Hemoglobin</p>
              <p className="text-pink-400 font-bold">{vitals.hemoglobin_g_dl?.toFixed(1)} g/dL</p>
            </div>
            <div>
              <p className="text-slate-500">HRV RMSSD</p>
              <p className="text-purple-400 font-bold">{vitals.hrv?.rmssd_ms?.toFixed(0)} ms</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Disclaimer ──────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-800">
        <p className="text-xs text-slate-500 text-center leading-relaxed">
          ⚕️ {report.disclaimer}
        </p>
      </div>

      {/* ── Action Buttons ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onNewScan}
          className="py-3 px-4 rounded-xl text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-all"
        >
          🔄 New Scan
        </button>
        <button
          onClick={onRestart}
          className="py-3 px-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg transition-all"
        >
          🏠 Back to Home
        </button>
      </div>
    </div>
  );
}
