/**
 * VitalsPanel.jsx — Medical-Grade Vitals Display Panel
 * Displays 6 Core Scientific Parameters:
 * 1. Heart Rate (BPM) + SQI Confidence (%) + SNR (dB)
 * 2. Blood Pressure (SBP/DBP mmHg) + ISO/ESH Category
 * 3. Oxygen Saturation (SpO2 %)
 * 4. Respiration Rate (BrPM)
 * 5. Hemoglobin (Hb g/dL) (PMC12165443 SGH Model)
 * 6. Heart Rate Variability (RMSSD ms) + Stress Index
 */

import React from 'react';

function getRiskColor(metric, value) {
  if (value === null || value === undefined) return 'text-slate-500';
  switch (metric) {
    case 'hr':
      if (value < 50 || value > 110) return 'text-red-400';
      if (value < 60 || value > 100) return 'text-amber-400';
      return 'text-green-400';
    case 'bp':
      if (value.sbp >= 140 || value.dbp >= 90 || value.sbp < 90) return 'text-red-400';
      if (value.sbp >= 125 || value.dbp >= 80) return 'text-amber-400';
      return 'text-green-400';
    case 'spo2':
      if (value < 92) return 'text-red-400';
      if (value < 95) return 'text-amber-400';
      return 'text-green-400';
    case 'rr':
      if (value < 8 || value > 25) return 'text-red-400';
      if (value < 12 || value > 20) return 'text-amber-400';
      return 'text-green-400';
    case 'hb':
      if (value < 10.0 || value > 18.0) return 'text-red-400';
      if (value < 12.0) return 'text-amber-400';
      return 'text-green-400';
    case 'hrv':
      if (value < 20) return 'text-red-400';
      if (value < 45) return 'text-amber-400';
      return 'text-green-400';
    default:
      return 'text-slate-300';
  }
}

function getRiskBorder(metric, value) {
  const cls = getRiskColor(metric, value);
  return cls.replace('text-', 'border-');
}

function MetricCard({ icon, label, value, unit, subtext, metric, description, badge }) {
  const colorCls  = value !== null ? getRiskColor(metric, value) : 'text-slate-600';
  const borderCls = value !== null ? getRiskBorder(metric, value) : 'border-slate-700';

  return (
    <div className={`medical-card p-4 border-l-4 ${borderCls} animate-slide-up flex flex-col justify-between`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">{label}</span>
        </div>
        {badge && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-mono">
            {badge}
          </span>
        )}
      </div>

      <div className="my-2">
        <div className={`metric-value ${colorCls} text-3xl font-bold font-mono`}>
          {value !== null && value !== undefined ? (
            <>
              {typeof value === 'object' ? `${value.sbp}/${value.dbp}` : (typeof value === 'number' ? value.toFixed(value % 1 !== 0 ? 1 : 0) : value)}
              <span className="text-xs text-slate-400 ml-1 font-sans font-normal">{unit}</span>
            </>
          ) : (
            <span className="text-slate-600 text-2xl font-mono">-- {unit}</span>
          )}
        </div>
      </div>

      <div>
        {subtext && (
          <p className="text-xs font-medium text-slate-300 truncate">{subtext}</p>
        )}
        {description && (
          <p className="text-[11px] text-slate-500">{description}</p>
        )}
      </div>
    </div>
  );
}

export default function VitalsPanel({ vitals }) {
  const v = vitals || {};
  const bp = v.blood_pressure;
  const hrv = v.hrv;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {/* 1. Heart Rate */}
      <MetricCard
        icon="❤️"
        label="Heart Rate"
        value={v.heart_rate_bpm ?? null}
        unit="BPM"
        metric="hr"
        badge={v.confidence ? `SQI: ${v.confidence}%` : null}
        subtext={v.heart_rate_bpm ? (
          v.welch_bpm ? `Welch: ${v.welch_bpm} | IBI: ${v.peak_bpm}` : 'Normal Sinus Rhythm'
        ) : null}
        description="Normal: 60–100 BPM"
      />

      {/* 2. Blood Pressure */}
      <MetricCard
        icon="🩺"
        label="Blood Pressure"
        value={bp ? { sbp: bp.sbp, dbp: bp.dbp } : null}
        unit="mmHg"
        metric="bp"
        badge={bp ? bp.category : null}
        subtext={bp ? `MAP: ${bp.map} mmHg | PP: ${bp.pulse_pressure}` : null}
        description="PMC12165443 SGH Model"
      />

      {/* 3. SpO2 */}
      <MetricCard
        icon="🫁"
        label="SpO₂ Oxygen"
        value={v.spo2_percent ?? null}
        unit="%"
        metric="spo2"
        badge={v.snr_db ? `SNR: ${v.snr_db}dB` : null}
        subtext={v.spo2_percent ? (
          v.spo2_percent < 92 ? '⚠️ Critical Hypoxia'
          : v.spo2_percent < 95 ? '⚠️ Borderline Low'
          : 'Normal Oxygenation'
        ) : null}
        description="Normal: ≥ 95%"
      />

      {/* 4. Respiration Rate */}
      <MetricCard
        icon="🌬️"
        label="Resp. Rate"
        value={v.respiration_rate ?? null}
        unit="BrPM"
        metric="rr"
        subtext={v.respiration_rate ? (
          v.respiration_rate < 12 ? 'Bradypnea'
          : v.respiration_rate > 20 ? 'Tachypnea'
          : 'Normal Breathing Pattern'
        ) : null}
        description="Normal: 12–20 BrPM"
      />

      {/* 5. Hemoglobin */}
      <MetricCard
        icon="🩸"
        label="Hemoglobin"
        value={v.hemoglobin_g_dl ?? null}
        unit="g/dL"
        metric="hb"
        subtext={v.hemoglobin_g_dl ? (
          v.hemoglobin_g_dl < 11.5 ? '⚠️ Mild Anemia Range'
          : v.hemoglobin_g_dl > 16.5 ? 'Elevated Concentration'
          : 'Optimal Adult Baseline'
        ) : null}
        description="Normal: 12.0–16.5 g/dL"
      />

      {/* 6. HRV */}
      <MetricCard
        icon="📊"
        label="HRV RMSSD"
        value={hrv?.rmssd_ms ?? null}
        unit="ms"
        metric="hrv"
        badge={hrv?.stress_index ?? null}
        subtext={hrv?.classification ?? 'Autonomic Reserve'}
        description={hrv?.pnn50 ? `pNN50: ${hrv.pnn50}% | SDNN: ${hrv.sdnn_ms}ms` : 'Higher = Better Recovery'}
      />
    </div>
  );
}
