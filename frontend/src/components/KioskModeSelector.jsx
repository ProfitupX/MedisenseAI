/**
 * KioskModeSelector.jsx — 3 Kiosk Registration Modes for MediSense AI
 * ======================================================================
 * Modes:
 *  1. Self-Service Kiosk (சுய சேவை) — Quick patient self-entry
 *  2. Nurse-Assisted Kiosk (செவிலியர் உதவி) — Large accessible touch targets, voice-assisted, elderly-friendly
 *  3. Returning Patient (மறு வருகை) — UHID/Phone search & 1-tap demo patient selection
 */

import React, { useState } from 'react';
import { DEMO_PATIENTS, searchPatients } from '../services/patientStorage.js';

export default function KioskModeSelector({
  selectedMode,
  onSelectMode,
  activePatient,
  onSelectPatient,
  onProceed,
  speak
}) {
  const [activeTab, setActiveTab] = useState(selectedMode || 'self'); // 'self' | 'nurse' | 'returning'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Walk-in form state
  const [walkinName, setWalkinName] = useState(activePatient?.name || '');
  const [walkinAge, setWalkinAge] = useState(activePatient?.age || '35');
  const [walkinGender, setWalkinGender] = useState(activePatient?.gender || 'Male');
  const [walkinPhone, setWalkinPhone] = useState(activePatient?.phone || '');

  // Handle Tab Switch
  const handleTabChange = (mode) => {
    setActiveTab(mode);
    onSelectMode(mode);
    if (mode === 'nurse' && speak) {
      speak('வணக்கம்! செவிலியர் உதவி முறை தேர்ந்தெடுக்கப்பட்டது. உங்கள் விவரங்களை தேர்வு செய்யவும் அல்லது உதவி கேட்கவும்.');
    } else if (mode === 'returning' && speak) {
      speak('மறு வருகை பதிவு. உங்கள் UHID எண் அல்லது தொலைபேசி எண்ணை உள்ளிடவும்.');
    }
  };

  // Handle Search in Returning Patient mode
  const handleSearch = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.trim()) {
      setSearchResults(searchPatients(q));
    } else {
      setSearchResults([]);
    }
  };

  // Select Demo / Found Patient
  const handlePickPatient = (pat) => {
    onSelectPatient(pat);
    if (speak) {
      speak(`${pat.name} நல்வரவு! முந்தைய பரிசோதனை விவரங்கள் ஏற்றப்பட்டன.`);
    }
  };

  // Handle Start Scan
  const handleStart = () => {
    if (activeTab === 'returning') {
      if (!activePatient) {
        alert('தயவுசெய்து ஒரு நோயாளியை தேர்வு செய்யவும் அல்லது Demo Profile-ஐ தேர்ந்தெடுக்கவும்.');
        return;
      }
      onProceed();
    } else {
      // Create new patient record
      const pat = {
        uhid: activePatient?.uhid || `MED-${Math.floor(1000 + Math.random() * 9000)}`,
        name: walkinName.trim() || (activeTab === 'nurse' ? 'Senior Patient' : 'Walk-in Patient'),
        age: parseInt(walkinAge) || 35,
        gender: walkinGender,
        phone: walkinPhone.trim() || 'N/A',
        is_nurse_assisted: activeTab === 'nurse',
        past_visits: []
      };
      onSelectPatient(pat);
      onProceed();
    }
  };

  return (
    <div className="space-y-5 animate-fade-in text-left">
      {/* ── Mode Selection Segmented Switcher ──────────────────────────────── */}
      <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-1.5 grid grid-cols-3 gap-1 shadow-xl">
        <button
          type="button"
          onClick={() => handleTabChange('self')}
          className={`py-3 px-2 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
            activeTab === 'self'
              ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <span className="text-base">🧑</span>
          <span>Self-Service</span>
          <span className="hidden sm:inline text-[10px] opacity-80">(சுய சேவை)</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('nurse')}
          className={`py-3 px-2 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
            activeTab === 'nurse'
              ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <span className="text-base">👩‍⚕️</span>
          <span>Nurse Assisted</span>
          <span className="hidden sm:inline text-[10px] opacity-80">(உதவி)</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('returning')}
          className={`py-3 px-2 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
            activeTab === 'returning'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <span className="text-base">🔄</span>
          <span>Returning Patient</span>
          <span className="hidden sm:inline text-[10px] opacity-80">(மறு வருகை)</span>
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          MODE 1: SELF-SERVICE KIOSK
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'self' && (
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🧑</span> Walk-in Check-in
              </h3>
              <p className="text-xs text-slate-400">விரைவு நோயாளி பதிவு (Quick entry)</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-cyan-900/40 border border-cyan-700/60 text-cyan-300 text-[11px] font-mono">
              Auto UHID
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                நோயாளி பெயர் (Patient Name)
              </label>
              <input
                type="text"
                value={walkinName}
                onChange={(e) => setWalkinName(e.target.value)}
                placeholder="Ex: Ramesh Kumar"
                className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                தொலைபேசி எண் (Mobile No)
              </label>
              <input
                type="tel"
                value={walkinPhone}
                onChange={(e) => setWalkinPhone(e.target.value)}
                placeholder="9876543210 (Optional)"
                className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                வயது (Age)
              </label>
              <input
                type="number"
                value={walkinAge}
                onChange={(e) => setWalkinAge(e.target.value)}
                min="5"
                max="110"
                className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                பாலினம் (Gender)
              </label>
              <select
                value={walkinGender}
                onChange={(e) => setWalkinGender(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-cyan-500"
              >
                <option value="Male">Male (ஆண்)</option>
                <option value="Female">Female (பெண்)</option>
                <option value="Other">Other (பிற)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          MODE 2: NURSE-ASSISTED KIOSK (Elderly / Rural Accessible)
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'nurse' && (
        <div className="bg-rose-950/20 border-2 border-rose-800/80 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-rose-800/40 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600/30 border border-rose-500 flex items-center justify-center text-2xl">
                👩‍⚕️
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Nurse-Assisted Mode</h3>
                <p className="text-xs text-rose-300">செவிலியர் உதவி & பெரிய பொத்தான்கள் (High Accessibility)</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => speak && speak('செவிலியர் உதவி கோரிக்கை அனுப்பப்பட்டது. சற்று பொறுங்கள்.')}
              className="px-3 py-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-900/40 animate-pulse"
            >
              <span>🔔</span>
              <span>Need Help? (உதவி)</span>
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-2">வயது குழுவை தேர்ந்தெடுக்கவும் (Select Age Group):</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'இளைஞர் (18-35)', val: '28' },
                  { label: 'நடுத்தர வயது (36-55)', val: '45' },
                  { label: 'முதியவர் (56+)', val: '65' }
                ].map(item => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setWalkinAge(item.val)}
                    className={`py-3 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                      walkinAge === item.val
                        ? 'bg-rose-600 border-rose-400 text-white shadow-lg'
                        : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:border-rose-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-300 mb-2">பாலினம் (Select Gender):</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: '👨 ஆண் (Male)', val: 'Male' },
                  { label: '👩 பெண் (Female)', val: 'Female' }
                ].map(item => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setWalkinGender(item.val)}
                    className={`py-3.5 px-3 rounded-xl text-sm font-bold border transition-all ${
                      walkinGender === item.val
                        ? 'bg-rose-600 border-rose-400 text-white shadow-lg'
                        : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:border-rose-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          MODE 3: RETURNING PATIENT (Longitudinal Visit Intelligence)
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'returning' && (
        <div className="bg-emerald-950/20 border-2 border-emerald-800/70 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-emerald-800/40 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🔄</span> Repeat Visit Intelligence
              </h3>
              <p className="text-xs text-emerald-300">முந்தைய பரிசோதனை ஒப்பீடு (Longitudinal Tracking)</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-900/50 border border-emerald-700 text-emerald-300 text-[11px] font-mono">
              3 Demo Profiles Ready
            </span>
          </div>

          {/* Quick Search */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              UHID அல்லது மொபைல் எண் தேடுக (Search UHID or Phone):
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearch}
              placeholder="Ex: MED-7821, Karthik, or 9840..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-emerald-700/60 text-slate-100 text-sm focus:outline-none focus:border-emerald-400"
            />
          </div>

          {/* Preloaded Demo Profiles for Quick Testing */}
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-2">
              👇 உடனடி பரிசோதனைக்கு மாதிரி நோயாளியைத் தேர்ந்தெடுக்கவும் (Pick Demo Patient):
            </p>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {(searchQuery.trim() ? searchResults : DEMO_PATIENTS).map(pat => {
                const isSelected = activePatient?.uhid === pat.uhid;
                const lastVisit = pat.past_visits?.[0];
                return (
                  <div
                    key={pat.uhid}
                    onClick={() => handlePickPatient(pat)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-emerald-900/40 border-emerald-500 shadow-lg shadow-emerald-950/50 scale-[1.01]'
                        : 'bg-slate-900/80 border-slate-700/80 hover:border-emerald-700/80'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{pat.name}</span>
                          <span className="text-xs text-emerald-400 font-mono">({pat.uhid})</span>
                          {isSelected && <span className="text-xs bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold">✓ Selected</span>}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {pat.age}y / {pat.gender} • {pat.category || 'General Follow-up'}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500 font-mono">
                        {pat.past_visits?.length || 0} prior visit
                      </span>
                    </div>

                    {lastVisit && (
                      <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] grid grid-cols-3 gap-2 text-slate-400">
                        <div>
                          <span className="text-slate-500">Last BP: </span>
                          <span className="text-amber-300 font-semibold">{lastVisit.vitals?.blood_pressure?.sbp}/{lastVisit.vitals?.blood_pressure?.dbp}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Last HR: </span>
                          <span className="text-cyan-300 font-semibold">{lastVisit.vitals?.heart_rate_bpm} BPM</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Last SpO₂: </span>
                          <span className="text-green-300 font-semibold">{lastVisit.vitals?.spo2_percent}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Active Patient Banner ────────────────────────────────────────── */}
      {activePatient && (
        <div className="bg-slate-900/90 border border-cyan-800/60 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">🪪</span>
            <div>
              <p className="text-xs font-bold text-cyan-300">
                Active Patient: {activePatient.name} ({activePatient.age}y / {activePatient.gender})
              </p>
              <p className="text-[11px] text-slate-400">
                UHID: <span className="font-mono text-slate-200">{activePatient.uhid}</span> • {activePatient.past_visits?.length > 0 ? `${activePatient.past_visits.length} past record(s) loaded for comparison` : 'New Walk-in Session'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Proceed to Scan Button ───────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleStart}
        className="w-full py-4 rounded-2xl font-bold text-base bg-gradient-to-r from-violet-600 via-cyan-600 to-blue-600 hover:from-violet-500 hover:to-cyan-500 text-white shadow-2xl shadow-violet-900/40 hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
      >
        <span>📷</span>
        <span>
          {activeTab === 'returning'
            ? 'தொடர் ஸ்கேன் தொடங்குக (Start Repeat Scan)'
            : 'பரிசோதனை தொடங்கு (Start Checkup & Face Scan)'}
        </span>
        <span>→</span>
      </button>
    </div>
  );
}
