/**
 * App.jsx — AntiGravity rPPG Medical Screening Dashboard
 * =========================================================
 * Master layout composing all components into the full dashboard.
 * Includes navigation to AI Doctor Assistant page.
 */

import React, { useCallback, useState, useEffect } from 'react';
import FaceCapture  from './components/FaceCapture.jsx';
import WaveChart    from './components/WaveChart.jsx';
import VitalsPanel  from './components/VitalsPanel.jsx';
import ScanProgress from './components/ScanProgress.jsx';
import GeminiReport from './components/GeminiReport.jsx';
import DoctorAssistant from './pages/DoctorAssistant.jsx';
import { useRPPG }  from './hooks/useRPPG.js';
import { checkBackendStatus } from './services/api.js';

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard'); // 'dashboard' | 'doctor'

  const {
    phase, progress, timeLeft, vitals, triage, scanQuality,
    error, waveBuffer, frameCount,
    pushFrame, startScan, stopScan, reset,
  } = useRPPG();

  const [faceDetected, setFaceDetected] = useState(false);
  const [backendOk,    setBackendOk]    = useState(null);

  // Check backend health on mount
  useEffect(() => {
    checkBackendStatus()
      .then(ok => setBackendOk(ok))
      .catch(() => setBackendOk(false));
  }, []);

  const handleFaceDetected = useCallback((detected) => {
    setFaceDetected(detected);
  }, []);

  const canScan = phase === 'idle' && faceDetected && backendOk;
  const isActive = phase === 'scanning' || phase === 'analyzing';

  // ── Doctor Assistant Page ──────────────────────────────────────────────────
  if (currentPage === 'doctor') {
    return (
      <DoctorAssistant onBack={() => setCurrentPage('dashboard')} />
    );
  }

  // ── Main Dashboard ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-medical-bg text-slate-100" style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1530 50%, #0a0f1e 100%)' }}>

      {/* ── Top Navigation ─────────────────────────────── */}
      <header className="border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-sm text-white">MS</div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">MediSense AI</h1>
            <p className="text-xs text-slate-500">Contactless rPPG & CDSS</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {/* AI Doctor Assistant Nav Button */}
          <button
            onClick={() => setCurrentPage('doctor')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-violet-700 bg-violet-900/30 text-violet-300 hover:bg-violet-900/50 hover:text-violet-200 transition-all font-medium"
          >
            🩺 MediSense Kiosk & CDSS
          </button>

          {/* Backend status */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border
            ${backendOk === true  ? 'border-green-700 bg-green-900/20 text-green-400'
            : backendOk === false ? 'border-red-700   bg-red-900/20   text-red-400'
            :                       'border-slate-700 bg-slate-800     text-slate-400'}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${backendOk === true ? 'bg-green-400' : backendOk === false ? 'bg-red-400' : 'bg-slate-500'}`} />
            {backendOk === true ? 'Backend Connected' : backendOk === false ? 'Backend Offline' : 'Connecting...'}
          </div>

          {/* Phase badge */}
          <div className="font-mono text-slate-500 uppercase tracking-widest">{phase}</div>
        </div>
      </header>

      {/* ── AI Doctor Assistant Banner ────────────────── */}
      <div
        onClick={() => setCurrentPage('doctor')}
        className="mx-6 mt-4 p-4 rounded-2xl bg-gradient-to-r from-violet-900/40 via-cyan-900/30 to-blue-900/20 border border-violet-700/60 cursor-pointer hover:border-violet-500 transition-all group shadow-xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-xl shadow-md">
              🏥
            </div>
            <div>
              <p className="text-sm font-bold text-white flex items-center gap-2">
                <span>MediSense AI Kiosk & CDSS Portal</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-900/60 border border-cyan-700 text-cyan-300 font-mono">
                  3 Registration Modes
                </span>
              </p>
              <p className="text-xs text-slate-400">
                Self-Service / Nurse-Assisted / Returning Patient • Repeat Visit Delta Tracking • Doctor Sign-off
              </p>
            </div>
          </div>
          <div className="text-violet-400 group-hover:translate-x-1 transition-transform text-lg">→</div>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── LEFT COLUMN: Camera + Controls ─────────── */}
        <div className="flex flex-col gap-4">

          {/* Camera Panel */}
          <div className="medical-card p-4 glow-cyan">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-mono text-slate-400 uppercase tracking-widest">
                📷 Facial ROI Capture
              </h2>
              <span className="text-xs text-slate-500">Forehead + Bilateral Cheeks</span>
            </div>
            <FaceCapture
              phase={phase}
              onFrame={pushFrame}
              onFaceDetected={handleFaceDetected}
            />
          </div>

          {/* Scan Controls */}
          <div className="medical-card p-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Start Scan */}
              <button
                onClick={startScan}
                disabled={!canScan || isActive}
                className={`py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200
                  ${canScan && !isActive
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/30 hover:shadow-cyan-900/50'
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  }`}
              >
                {isActive ? '⏳ Scanning...' : '▶ Start 30s Scan'}
              </button>

              {/* Stop / Reset */}
              <button
                onClick={phase === 'scanning' ? stopScan : reset}
                disabled={phase === 'idle' || phase === 'analyzing'}
                className={`py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200
                  ${(phase === 'scanning' || phase === 'results' || phase === 'error')
                    ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  }`}
              >
                {phase === 'scanning' ? '⏹ Stop Early' : '↺ Reset'}
              </button>
            </div>

            {/* Guidance text */}
            <div className="mt-3 text-xs text-slate-500 text-center">
              {!faceDetected  && 'Position your face in the camera frame' }
              {faceDetected   && phase === 'idle'     && backendOk === false && '⚠️ Start Python backend first: cd backend && python main.py'}
              {faceDetected   && phase === 'idle'     && backendOk === true  && '✅ Face detected — Ready to scan!'}
              {phase === 'scanning'  && `📡 Collecting rPPG data... keep still and breathe normally`}
              {phase === 'analyzing' && '🧠 Running CHROM algorithm + Gemini AI triage...'}
              {phase === 'results'   && '✅ Analysis complete! Gemini AI report below.'}
              {phase === 'error'     && error}
            </div>
          </div>

          {/* Scan Progress */}
          <ScanProgress
            phase={phase}
            progress={progress}
            timeLeft={timeLeft}
            frameCount={frameCount}
          />

          {/* Backend offline warning */}
          {backendOk === false && (
            <div className="medical-card p-4 border-l-4 border-amber-600 animate-fade-in">
              <p className="text-amber-400 text-xs font-mono mb-2">⚠️ Python backend is not running</p>
              <p className="text-slate-400 text-xs">Start with:</p>
              <pre className="mt-1 text-xs bg-slate-900 rounded p-2 text-green-400 font-mono overflow-x-auto">
{`cd backend
pip install -r requirements.txt
python main.py`}
              </pre>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: Vitals + Charts + AI Report ─ */}
        <div className="flex flex-col gap-4">

          {/* Live Waveform Chart */}
          <WaveChart
            waveBuffer={waveBuffer}
            phase={phase}
            title="rPPG Pulse Waveform (Green Channel)"
          />

          {/* Vitals Metric Cards */}
          <div>
            <h2 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-3 px-1">
              📊 Computed Vital Signs
            </h2>
            <VitalsPanel vitals={vitals} />
          </div>

          {/* Gemini AI Clinical Triage */}
          {(triage || phase === 'analyzing') && (
            <div>
              {phase === 'analyzing' ? (
                <div className="medical-card p-6 text-center">
                  <div className="text-4xl mb-3 animate-pulse">🧠</div>
                  <p className="text-cyan-400 font-mono text-sm">Consulting Gemini AI Clinical Engine...</p>
                  <p className="text-slate-500 text-xs mt-1">Analyzing vitals for risk classification</p>
                </div>
              ) : (
                <GeminiReport triage={triage} scanQuality={scanQuality} />
              )}
            </div>
          )}

          {/* AI Doctor Assistant CTA (shown after results) */}
          {phase === 'results' && vitals && (
            <div
              onClick={() => setCurrentPage('doctor')}
              className="medical-card p-4 border border-violet-700/50 bg-violet-900/10 cursor-pointer hover:border-violet-600 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">🩺</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-violet-300">Continue to AI Doctor Assistant</p>
                  <p className="text-xs text-slate-400">Symptom interview + prescription report in Tamil</p>
                </div>
                <div className="text-violet-400 group-hover:translate-x-1 transition-transform">→</div>
              </div>
            </div>
          )}

          {/* Clinical Info Panel (shown on idle) */}
          {phase === 'idle' && (
            <div className="medical-card p-5 animate-fade-in">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                🔬 How It Works
              </h3>
              <div className="space-y-2 text-xs text-slate-400">
                <div className="flex gap-2">
                  <span className="text-cyan-400 font-mono">1.</span>
                  <span>MediaPipe FaceMesh detects <strong className="text-slate-300">forehead + cheek</strong> ROIs</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-cyan-400 font-mono">2.</span>
                  <span>Raw RGB pixel intensities extracted <strong className="text-slate-300">30 fps × 30 seconds</strong></span>
                </div>
                <div className="flex gap-2">
                  <span className="text-cyan-400 font-mono">3.</span>
                  <span><strong className="text-slate-300">POS rPPG algorithm</strong> + Butterworth filter removes motion artifacts</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-cyan-400 font-mono">4.</span>
                  <span><strong className="text-slate-300">Welch PSD + IBI fusion</strong> computes HR, HRV, SpO2, BP, Hb, RR</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-cyan-400 font-mono">5.</span>
                  <span><strong className="text-slate-300">Gemini AI</strong> triages results + Tamil/Tanglish health guidance</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800">
                <p className="text-xs text-slate-600">
                  📖 Algorithm validated: Singapore General Hospital (PMC12165443, 2025) —
                  200 patients, DBP MAPE 7.52%, Hb MAPE 8.52%
                </p>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="border-t border-slate-800 px-6 py-3 text-center">
        <p className="text-xs text-slate-600">
          ⚠️ AntiGravity rPPG is for informational screening only and does not constitute medical advice.
          Always consult a qualified healthcare professional for clinical diagnosis.
        </p>
      </footer>
    </div>
  );
}
