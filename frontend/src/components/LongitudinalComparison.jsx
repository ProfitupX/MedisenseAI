/**
 * LongitudinalComparison.jsx — Repeat Visit Vitals Delta & Trend Engine
 * =======================================================================
 * Computes and renders clinical vitals delta between the current scan
 * and the patient's previous historical visit(s).
 * Triggers Deterioration Alerts if vitals exhibit worsening hemodynamic trajectories.
 */

import React from 'react';

export default function LongitudinalComparison({ currentVitals, pastVisits }) {
  if (!pastVisits || pastVisits.length === 0 || !currentVitals) {
    return null;
  }

  const latestPast = pastVisits[0];
  const pastV = latestPast.vitals || {};
  const pastBP = pastV.blood_pressure || {};
  const currBP = currentVitals.blood_pressure || {};

  // Current values
  const currHR = currentVitals.heart_rate_bpm || 0;
  const currSBP = currBP.sbp || 120;
  const currDBP = currBP.dbp || 80;
  const currSpO2 = currentVitals.spo2_percent || 98;
  const currHb = currentVitals.hemoglobin_g_dl || 13.5;
  const currHRV = currentVitals.hrv?.rmssd_ms || 35;

  // Past values
  const prevHR = pastV.heart_rate_bpm || currHR;
  const prevSBP = pastBP.sbp || currSBP;
  const prevDBP = pastBP.dbp || currDBP;
  const prevSpO2 = pastV.spo2_percent || currSpO2;
  const prevHb = pastV.hemoglobin_g_dl || currHb;
  const prevHRV = pastV.hrv?.rmssd_ms || currHRV;

  // Delta calculations
  const deltaHR = Math.round(currHR - prevHR);
  const deltaSBP = Math.round(currSBP - prevSBP);
  const deltaDBP = Math.round(currDBP - prevDBP);
  const deltaSpO2 = parseFloat((currSpO2 - prevSpO2).toFixed(1));
  const deltaHb = parseFloat((currHb - prevHb).toFixed(1));

  // Deterioration detection
  const isBPDeteriorated = deltaSBP >= 12 || deltaDBP >= 8 || currSBP >= 140;
  const isSpO2Deteriorated = deltaSpO2 <= -2.5 || currSpO2 < 94;
  const isHRDeteriorated = deltaHR >= 15 || currHR > 105;
  const isWorsening = isBPDeteriorated || isSpO2Deteriorated || isHRDeteriorated;

  return (
    <div className="bg-slate-900/80 border border-slate-700/90 rounded-2xl p-5 space-y-4 shadow-xl animate-fade-in">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-900/50 border border-emerald-700 flex items-center justify-center text-lg">
            📈
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Repeat Visit Intelligence (நீண்டகால ஒப்பீடு)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Comparing Current Scan vs Previous Visit on <span className="text-emerald-400 font-semibold">{latestPast.date || 'Last Visit'}</span>
            </p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono border ${
          isWorsening
            ? 'bg-red-950/40 border-red-700 text-red-300'
            : 'bg-emerald-950/40 border-emerald-700 text-emerald-300'
        }`}>
          {isWorsening ? '⚠️ Deterioration Trend' : '✅ Stable / Improving'}
        </span>
      </div>

      {/* ── Clinical Deterioration / Improvement Banner ───────────────────── */}
      {isWorsening ? (
        <div className="bg-red-950/30 border-2 border-red-700/80 rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase tracking-wide">
            <span>🚨 WORSENING VITALS ALERT / உடல்நிலை பின்னடைவு எச்சரிக்கை</span>
          </div>
          <p className="text-sm text-slate-200">
            {isBPDeteriorated && `• Blood pressure has increased by ${deltaSBP > 0 ? `+${deltaSBP}` : deltaSBP} mmHg SBP since previous visit. `}
            {isSpO2Deteriorated && `• Blood oxygen has decreased by ${deltaSpO2}% SpO2. `}
            {isHRDeteriorated && `• Resting heart rate elevated by ${deltaHR > 0 ? `+${deltaHR}` : deltaHR} BPM. `}
          </p>
          <p className="text-xs text-slate-400 pt-1" style={{ fontFamily: 'Noto Sans Tamil, sans-serif' }}>
            முந்தைய வருகையுடன் ஒப்பிடும்போது இரத்த அழுத்தம் அல்லது இதய துடிப்பில் மாறுபாடு கண்டறியப்பட்டுள்ளது. மருத்துவர் நேரடி ஆலோசனை தேவை.
          </p>
        </div>
      ) : (
        <div className="bg-emerald-950/25 border border-emerald-700/70 rounded-xl p-3.5 flex items-center gap-3">
          <span className="text-2xl">🌿</span>
          <div>
            <p className="text-xs font-bold text-emerald-300">
              Positive Trajectory / சீரான உடல்நிலை
            </p>
            <p className="text-xs text-slate-300">
              Vital signs are stable and within safe physiological limits relative to previous visit baseline.
            </p>
          </div>
        </div>
      )}

      {/* ── Delta Metric Cards Grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Heart Rate Delta */}
        <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3">
          <p className="text-[11px] text-slate-400">Heart Rate (HR)</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-sm font-bold text-white">{currHR.toFixed(0)} <span className="text-[10px] text-slate-400">BPM</span></span>
            <span className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${
              deltaHR > 10 ? 'bg-red-900/40 text-red-300' : deltaHR < -5 ? 'bg-green-900/40 text-green-300' : 'bg-slate-700 text-slate-300'
            }`}>
              {deltaHR >= 0 ? `+${deltaHR}` : deltaHR}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Prev: {prevHR.toFixed(0)} BPM</p>
        </div>

        {/* Blood Pressure Delta */}
        <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3">
          <p className="text-[11px] text-slate-400">Blood Pressure</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-sm font-bold text-white">{currSBP}/{currDBP}</span>
            <span className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${
              deltaSBP > 10 ? 'bg-red-900/40 text-red-300' : deltaSBP < -5 ? 'bg-green-900/40 text-green-300' : 'bg-slate-700 text-slate-300'
            }`}>
              {deltaSBP >= 0 ? `+${deltaSBP}` : deltaSBP} SBP
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Prev: {prevSBP}/{prevDBP}</p>
        </div>

        {/* SpO2 Delta */}
        <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3">
          <p className="text-[11px] text-slate-400">Oxygen (SpO₂)</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-sm font-bold text-white">{currSpO2.toFixed(1)}%</span>
            <span className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${
              deltaSpO2 < -2 ? 'bg-red-900/40 text-red-300' : deltaSpO2 > 0 ? 'bg-green-900/40 text-green-300' : 'bg-slate-700 text-slate-300'
            }`}>
              {deltaSpO2 >= 0 ? `+${deltaSpO2}` : deltaSpO2}%
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Prev: {prevSpO2.toFixed(1)}%</p>
        </div>

        {/* Hemoglobin Delta */}
        <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3">
          <p className="text-[11px] text-slate-400">Hemoglobin (Hb)</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-sm font-bold text-white">{currHb.toFixed(1)} <span className="text-[10px] text-slate-400">g/dL</span></span>
            <span className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${
              deltaHb < -1 ? 'bg-red-900/40 text-red-300' : deltaHb > 0.5 ? 'bg-green-900/40 text-green-300' : 'bg-slate-700 text-slate-300'
            }`}>
              {deltaHb >= 0 ? `+${deltaHb}` : deltaHb}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Prev: {prevHb.toFixed(1)} g/dL</p>
        </div>
      </div>
    </div>
  );
}
