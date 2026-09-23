/**
 * GeminiReport.jsx — AI Clinical Triage Panel
 * Displays Gemini API triage output with Tamil/Tanglish toggle.
 */

import React, { useState } from 'react';

const RISK_CONFIG = {
  'Stable':    { bg: 'bg-green-900/30',  border: 'border-green-500/50',  text: 'text-green-400',  icon: '✅', badge: 'bg-green-500/20' },
  'Alert':     { bg: 'bg-amber-900/30',  border: 'border-amber-500/50',  text: 'text-amber-400',  icon: '⚠️', badge: 'bg-amber-500/20' },
  'High Risk': { bg: 'bg-red-900/30',    border: 'border-red-500/50',    text: 'text-red-400',    icon: '🚨', badge: 'bg-red-500/20' },
};

export default function GeminiReport({ triage, scanQuality }) {
  const [lang, setLang] = useState('tanglish'); // 'tamil' | 'tanglish'

  if (!triage) return null;
  if (triage.error) {
    return (
      <div className="medical-card p-4 border-l-4 border-slate-600">
        <p className="text-slate-400 text-sm">⚠️ AI triage unavailable: {triage.error}</p>
      </div>
    );
  }

  const risk   = triage.risk_level || 'Unknown';
  const config = RISK_CONFIG[risk] || { bg: 'bg-slate-900/30', border: 'border-slate-600', text: 'text-slate-300', icon: '❓', badge: 'bg-slate-700' };
  const advice = lang === 'tamil' ? triage.advice_tamil : triage.advice_tanglish;

  return (
    <div className={`medical-card border-l-4 ${config.border} animate-slide-up overflow-hidden`}>
      {/* Header */}
      <div className={`${config.bg} px-5 py-4 border-b border-slate-700/50`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{config.icon}</span>
            <div>
              <p className="text-xs font-mono text-slate-400 tracking-widest uppercase">Gemini AI Clinical Triage</p>
              <h3 className={`text-lg font-bold ${config.text}`}>{risk}</h3>
            </div>
          </div>
          {scanQuality && (
            <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-400 font-mono">
              {scanQuality}
            </span>
          )}
        </div>
        {triage.risk_summary_english && (
          <p className="text-sm text-slate-300 mt-2">{triage.risk_summary_english}</p>
        )}
      </div>

      {/* Vitals Analysis Grid */}
      {triage.vitals_analysis && (
        <div className="grid grid-cols-2 gap-2 px-5 py-3 border-b border-slate-700/30">
          {Object.entries(triage.vitals_analysis).map(([key, val]) => (
            <div key={key} className="text-xs">
              <span className="text-slate-500 capitalize">{key.replace('_', ' ')}: </span>
              <span className="text-slate-300">{val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Language Toggle + Advisory */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-slate-500 font-mono uppercase tracking-wider">Health Advisory</span>
          <div className="flex rounded-lg overflow-hidden border border-slate-700">
            <button
              onClick={() => setLang('tanglish')}
              className={`px-3 py-1 text-xs font-mono transition-colors ${lang === 'tanglish' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Tanglish
            </button>
            <button
              onClick={() => setLang('tamil')}
              className={`px-3 py-1 text-xs transition-colors ${lang === 'tamil' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              தமிழ்
            </button>
          </div>
        </div>

        <div className={`rounded-lg p-4 ${config.badge} border ${config.border}`}>
          <p className={`${lang === 'tamil' ? 'tamil-text' : 'text-sm'} text-slate-200 leading-relaxed`}>
            {advice}
          </p>
        </div>

        {/* Immediate Action */}
        {triage.immediate_action && triage.immediate_action !== 'None required' && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-red-900/20 border border-red-500/30">
            <span className="text-red-400 text-sm">🚨</span>
            <p className="text-sm text-red-300">{triage.immediate_action}</p>
          </div>
        )}

        {/* Disclaimer */}
        {triage.disclaimer && (
          <p className="mt-3 text-xs text-slate-600 border-t border-slate-800 pt-3">
            ⚠️ {triage.disclaimer}
          </p>
        )}
      </div>
    </div>
  );
}
