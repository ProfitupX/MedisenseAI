/**
 * PrescriptionReport.jsx — CDSS Clinical Report with Severity Routing
 * =====================================================================
 * Displays:
 *  - Clinical Assessment & Differential Diagnoses
 *  - Severity Routing Banner (Doctor Consultation for High Risk vs Nurse Desk for Normal)
 *  - Repeat Visit Longitudinal Vitals Delta (if returning patient)
 *  - AI Suggested Care Plan & Medications
 *  - Doctor / Nurse Verification & Token Issuance CTA
 *  - Bilingual narration in Tamil
 */

import React, { useEffect, useRef } from 'react';
import { useTamilVoice } from '../hooks/useTamilVoice.js';
import LongitudinalComparison from './LongitudinalComparison.jsx';

const TRIAGE_CONFIG = {
  'Self-Care':         { color: 'green',  icon: '🏠', bg: 'from-green-900/40  to-emerald-900/20', border: 'border-green-700',  text: 'text-green-400'  },
  'See Doctor in 24h': { color: 'amber',  icon: '🏥', bg: 'from-amber-900/40  to-yellow-900/20',  border: 'border-amber-700',  text: 'text-amber-400'  },
  'Emergency':         { color: 'red',    icon: '🚨', bg: 'from-red-900/50    to-rose-900/30',     border: 'border-red-700',    text: 'text-red-400'    },
};

export default function PrescriptionReport({
  report,
  vitals,
  patient,
  pastVisits,
  triage: triageData,
  onNewScan,
  onRestart,
  onOpenDoctorModal,
  doctorToken,
}) {
  const { speak, isSpeaking } = useTamilVoice();
  const hasSpoken = useRef(false);

  // Auto-speak triage decision + routing guidance on load with Tamil Neural voice
  useEffect(() => {
    if (report && !hasSpoken.current) {
      hasSpoken.current = true;
      const msg = report.routing_advice_tamil || report.triage_tamil || report.triage_tanglish || report.assessment_tamil || '';
      if (msg) {
        setTimeout(() => speak(msg), 800);
      }
    }
  }, [report, speak]);

  if (!report) return null;

  const triage = TRIAGE_CONFIG[report.triage_decision] || TRIAGE_CONFIG['Self-Care'];
  const isDoctorRoute = report.assigned_role === 'doctor' || triageData?.risk_level === 'High Risk' || report.triage_decision === 'Emergency';

  return (
    <div className="space-y-5 animate-fade-in text-left">
      
      {/* ── Patient Profile Badge with Face ID Photo ──────────────────────── */}
      {patient && (
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            {patient.face_photo ? (
              <img
                src={patient.face_photo}
                alt={patient.name}
                className="w-12 h-12 rounded-xl object-cover border border-cyan-500 shadow"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-violet-900/50 border border-violet-700 flex items-center justify-center text-xl">
                🪪
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{patient.name}</span>
                <span className="text-xs text-cyan-400 font-mono">({patient.uhid})</span>
              </div>
              <p className="text-xs text-slate-400">
                {patient.age}y / {patient.gender} • {patient.phone || 'Face ID Registered'}
              </p>
            </div>
          </div>
          {doctorToken ? (
            <div className="text-right">
              <span className={`px-3 py-1 rounded-full font-mono font-bold text-xs border ${
                doctorToken.token_number?.startsWith('DOC')
                  ? 'bg-violet-950/70 border-cyan-500 text-cyan-300'
                  : 'bg-rose-950/70 border-rose-500 text-rose-300'
              }`}>
                ✓ {doctorToken.token_number}
              </span>
              <p className="text-[10px] text-emerald-400 mt-1">{doctorToken.status?.split('(')[0]}</p>
            </div>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-amber-950/40 border border-amber-700 text-amber-300 text-xs">
              AI Draft (Pending Sign-off)
            </span>
          )}
        </div>
      )}

      {/* ── Severity Routing Banner (Doctor vs Nurse) ──────────────────────── */}
      <div className={`p-4 rounded-2xl border-2 shadow-xl ${
        isDoctorRoute
          ? 'bg-gradient-to-r from-red-950/50 via-slate-900 to-violet-950/40 border-red-600/90'
          : 'bg-gradient-to-r from-emerald-950/50 via-slate-900 to-teal-950/40 border-emerald-600/90'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{isDoctorRoute ? '🚨' : '👩‍⚕️'}</span>
            <div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono uppercase tracking-wider ${
                isDoctorRoute
                  ? 'bg-red-900/60 border border-red-500 text-red-200'
                  : 'bg-emerald-900/60 border border-emerald-500 text-emerald-200'
              }`}>
                {isDoctorRoute ? 'Doctor Consultation Required' : 'Nurse Triage & Wellness Desk'}
              </span>
              <h3 className="text-sm font-bold text-white mt-1">
                {report.assigned_destination || (isDoctorRoute ? 'Doctor Consultation Room 03' : 'Nurse Triage Desk 01')}
              </h3>
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-200">{report.routing_advice_tanglish}</p>
        <p className="text-[11px] text-slate-400 mt-0.5" style={{ fontFamily: 'Noto Sans Tamil, sans-serif' }}>
          {report.routing_advice_tamil}
        </p>
      </div>

      {/* ── Repeat Visit Longitudinal Comparison (if returning patient) ───── */}
      {pastVisits && pastVisits.length > 0 && (
        <LongitudinalComparison currentVitals={vitals} pastVisits={pastVisits} />
      )}

      {/* ── Longitudinal Trend Note (if generated by AI/backend) ────────────── */}
      {report.longitudinal_notes && (
        <div className="bg-cyan-950/30 border border-cyan-700/80 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-xl">📊</span>
          <div>
            <p className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
              Longitudinal Intelligence Trend
            </p>
            <p className="text-xs text-slate-200 mt-0.5">{report.longitudinal_notes}</p>
          </div>
        </div>
      )}

      {/* ── Doctor / Nurse Verification CTA Card ────────────────────────────── */}
      <div className="bg-slate-900/90 border-2 border-slate-700/90 rounded-2xl p-5 shadow-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
              isDoctorRoute
                ? 'bg-violet-600/30 border border-violet-500 text-violet-300'
                : 'bg-rose-600/30 border border-rose-500 text-rose-300'
            }`}>
              {isDoctorRoute ? '👨‍⚕️' : '👩‍⚕️'}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {isDoctorRoute ? 'Doctor Review & Prescription Approval' : 'Nurse Triage Verification & Token'}
              </h3>
              <p className="text-xs text-slate-400">
                {isDoctorRoute ? 'Physician examination sign-off • Order lab tests' : 'Nurse validation • Health advice confirmation'}
              </p>
            </div>
          </div>
          {doctorToken && <span className="text-xl">✅</span>}
        </div>

        {doctorToken ? (
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
            <div>
              <p className="font-bold text-cyan-300">
                Token #{doctorToken.token_number} ({doctorToken.opd_room})
              </p>
              <p className="text-slate-400 mt-0.5">
                Verified by {doctorToken.verified_data?.doctor_name}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenDoctorModal}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700"
            >
              View / Print Slip
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenDoctorModal}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm text-white shadow-xl transition-all flex items-center justify-center gap-2 ${
              isDoctorRoute
                ? 'bg-gradient-to-r from-violet-600 via-cyan-600 to-blue-600 hover:from-violet-500 hover:to-cyan-500 shadow-violet-950/50'
                : 'bg-gradient-to-r from-pink-600 via-rose-600 to-amber-600 hover:from-pink-500 hover:to-rose-500 shadow-rose-950/50'
            }`}
          >
            <span>{isDoctorRoute ? '👨‍⚕️' : '👩‍⚕️'}</span>
            <span>
              {isDoctorRoute
                ? 'மருத்துவர் சரிபார்ப்பு & டோக்கன் பெறுக (Doctor Sign-off)'
                : 'செவிலியர் சரிபார்ப்பு & டோக்கன் பெறுக (Nurse Verification)'}
            </span>
            <span>→</span>
          </button>
        )}
      </div>

      {/* ── Assessment Card ─────────────────────────────────────────────────── */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-lg flex-shrink-0">
            🤖
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white mb-1">{report.assessment_title}</p>
            <p className="text-xs text-cyan-300 leading-relaxed mb-2">
              {report.assessment_tanglish}
            </p>
            <p className="text-xs text-slate-400 leading-relaxed" style={{ fontFamily: 'Noto Sans Tamil, sans-serif' }}>
              {report.assessment_tamil}
            </p>
          </div>
          <button
            type="button"
            onClick={() => speak(report.assessment_tamil || report.assessment_tanglish)}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 transition-all ${
              isSpeaking ? 'bg-violet-600 animate-pulse shadow-lg shadow-violet-900/50' : 'bg-slate-700 hover:bg-slate-600'
            } text-slate-300`}
            title="Listen to Assessment"
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
              <p className="text-xs text-slate-400 uppercase tracking-widest">Triage Classification / நிலை</p>
              <p className={`text-xl font-bold ${triage.text}`}>{report.triage_decision}</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-200 mb-1">{report.triage_tanglish}</p>
        <p className="text-[11px] text-slate-400" style={{ fontFamily: 'Noto Sans Tamil, sans-serif' }}>
          {report.triage_tamil}
        </p>
      </div>

      {/* ── Suggested Medicines ─────────────────────────────────────────────── */}
      {report.medicines?.length > 0 && (
        <div>
          <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-3 px-1">
            💊 Recommended Care & OTC Medicines ({report.medicines.length})
          </h3>
          <div className="space-y-3">
            {report.medicines.map((med, idx) => (
              <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-semibold text-white">{med.name}</p>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-900/40 border border-cyan-700 text-cyan-300 text-xs">
                    {med.dosage}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mb-2">
                  <div>
                    <span className="text-slate-500">முறை: </span>
                    <span className="text-slate-300 font-medium">{med.frequency}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">காலம்: </span>
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
        </div>
      )}

      {/* ── Home Care Tips ──────────────────────────────────────────────────── */}
      {report.home_care?.length > 0 && (
        <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
          <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-3">
            🏠 Home Care Guidelines (வீட்டு பராமரிப்பு)
          </h3>
          <div className="space-y-2">
            {report.home_care.map((tip, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                <span className="text-green-400 flex-shrink-0 mt-0.5">✓</span>
                <div>
                  <p>{tip}</p>
                  {report.home_care_tamil?.[idx] && (
                    <p className="text-[11px] text-slate-500 mt-0.5" style={{ fontFamily: 'Noto Sans Tamil, sans-serif' }}>
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
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-violet-900/20 border border-violet-800 text-xs">
          <span className="text-violet-400">📅</span>
          <p className="text-violet-300">{report.follow_up}</p>
        </div>
      )}

      {/* ── Disclaimer ──────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-800">
        <p className="text-[11px] text-slate-500 text-center leading-relaxed">
          ⚕️ {report.disclaimer}
        </p>
      </div>

      {/* ── Action Buttons ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onNewScan}
          className="py-3 px-4 rounded-xl text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-all"
        >
          🔄 New Scan
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="py-3 px-4 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg transition-all"
        >
          🏠 Back to Home
        </button>
      </div>
    </div>
  );
}
