/**
 * ScanProgress.jsx — 30-second scan progress indicator
 */

import React from 'react';

export default function ScanProgress({ phase, progress, timeLeft, frameCount }) {
  if (phase === 'idle' || phase === 'results') return null;

  const isAnalyzing = phase === 'analyzing';

  return (
    <div className="medical-card p-4 animate-fade-in">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-mono text-slate-400 tracking-wider uppercase">
          {isAnalyzing ? '⚙️  Processing Signal...' : '📡  Scanning Vitals'}
        </span>
        {!isAnalyzing && (
          <span className="text-xs font-mono text-cyan-400">{timeLeft}s remaining</span>
        )}
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full scan-progress-bar rounded-full"
          style={{ width: `${isAnalyzing ? 100 : progress}%` }}
        />
      </div>

      <div className="flex justify-between mt-2 text-xs text-slate-500 font-mono">
        <span>{frameCount} frames captured</span>
        <span>{Math.round(progress)}%</span>
      </div>

      {isAnalyzing && (
        <p className="mt-2 text-xs text-cyan-400 font-mono text-center animate-pulse">
          Running CHROM rPPG algorithm + Gemini AI triage...
        </p>
      )}
    </div>
  );
}
