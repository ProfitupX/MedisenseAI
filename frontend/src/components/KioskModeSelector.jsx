/**
 * KioskModeSelector.jsx — Real-Time Face ID Kiosk Registration & Recognition
 * ============================================================================
 * 2 Streamlined Real-World Options:
 *  Option 1: New Patient Registration (Self-Service + Face ID Lock + Nurse Help)
 *  Option 2: Returning Patient (1-Click Face ID Auto-Login & Lookup)
 */

import React, { useState, useEffect } from 'react';
import { extractFaceDescriptor, findBestFaceMatch, captureFaceSnapshot } from '../services/faceRecognition.js';
import { patientDb } from '../services/patientDb.js';

export default function KioskModeSelector({
  activePatient,
  onSelectPatient,
  onProceed,
  speak,
  liveLandmarks,
  videoElement
}) {
  const [activeOption, setActiveOption] = useState('new'); // 'new' | 'returning'
  const [allRegisteredPatients, setAllRegisteredPatients] = useState([]);

  // Option 1: New Patient State
  const [name, setName] = useState('');
  const [age, setAge] = useState('32');
  const [gender, setGender] = useState('Male');
  const [phone, setPhone] = useState('');
  const [faceDescriptor, setFaceDescriptor] = useState(null);
  const [facePhoto, setFacePhoto] = useState(null);
  const [isNurseAssisted, setIsNurseAssisted] = useState(false);
  const [isFaceLocked, setIsFaceLocked] = useState(false);

  // Option 2: Returning Patient State
  const [isScanningFace, setIsScanningFace] = useState(false);
  const [faceMatchResult, setFaceMatchResult] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Load registered patients on mount
  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    const list = await patientDb.getAllPatients();
    setAllRegisteredPatients(list);
  };

  // ── Option 1: Lock Face ID for New Patient ──────────────────────────────────
  const handleLockFaceID = () => {
    if (!liveLandmarks || liveLandmarks.length < 468) {
      alert('கேமராவில் உங்கள் முகம் முழுமையாக தெரியவில்லை. கேமராவை நோக்கி நேராக பார்க்கவும்.');
      if (speak) speak('கேமராவில் முகம் தெளிவாக தெரியவில்லை. நேராக பார்க்கவும்.');
      return;
    }

    const descriptor = extractFaceDescriptor(liveLandmarks);
    if (!descriptor) {
      alert('முக அடையாளத்தை கணக்கிட முடியவில்லை. சற்று அருகில் வரவும்.');
      return;
    }

    const photo = captureFaceSnapshot(videoElement);
    setFaceDescriptor(descriptor);
    setFacePhoto(photo);
    setIsFaceLocked(true);

    if (speak) {
      speak('உங்கள் முக அடையாளம் வெற்றிகரமாக பதிவு செய்யப்பட்டது. உங்கள் பெயர் மற்றும் விவரங்களை உள்ளிடவும்.');
    }
  };

  // ── Option 1: Submit New Patient Registration ──────────────────────────────
  const handleRegisterNewPatient = async () => {
    if (!name.trim()) {
      alert('தயவுசெய்து நோயாளியின் பெயரை உள்ளிடவும் (Please enter Patient Name).');
      return;
    }

    const newPat = await patientDb.createPatient({
      name: name.trim(),
      age: parseInt(age) || 30,
      gender,
      phone: phone.trim(),
      face_descriptor: faceDescriptor,
      face_photo: facePhoto,
      is_nurse_assisted: isNurseAssisted,
    });

    onSelectPatient(newPat);
    await loadPatients();

    if (speak) {
      speak(`${newPat.name} நல்வரவு! உடல் பரிசோதனை தொடங்கப்படுகிறது.`);
    }

    onProceed();
  };

  // ── Option 2: Scan Face to Auto-Login Returning Patient ────────────────────
  const handleScanFaceAutoLogin = async () => {
    if (allRegisteredPatients.length === 0) {
      alert('பதிவு செய்யப்பட்ட நோயாளிகள் எவரும் இல்லை. புதிய நோயாளி பதிவை (Option 1) பயன்படுத்தவும்.');
      return;
    }

    if (!liveLandmarks || liveLandmarks.length < 468) {
      alert('கேமராவில் முகம் தெரியவில்லை. கேமராவை நேராக பார்க்கவும்.');
      if (speak) speak('கேமராவை நேராக பார்க்கவும்.');
      return;
    }

    setIsScanningFace(true);
    const descriptor = extractFaceDescriptor(liveLandmarks);

    if (!descriptor) {
      setIsScanningFace(false);
      alert('Face descriptor extraction failed. Please adjust lighting and face position.');
      return;
    }

    const matchInfo = findBestFaceMatch(descriptor, allRegisteredPatients);
    setIsScanningFace(false);

    if (matchInfo.match && matchInfo.confidence >= 70) {
      setFaceMatchResult(matchInfo);
      onSelectPatient(matchInfo.match);
      if (speak) {
        speak(`வணக்கம் ${matchInfo.match.name}! உங்கள் முகம் வெற்றிகரமாக அடையாளம் காணப்பட்டது.`);
      }
    } else {
      alert('முக அடையாளம் பொருந்தவில்லை. உங்கள் மொபைல் எண் அல்லது UHID மூலம் தேடலாம்.');
      if (speak) speak('முக அடையாளம் பொருந்தவில்லை. மொபைல் எண் மூலம் தேடவும்.');
    }
  };

  // ── Option 2: Search Manual ────────────────────────────────────────────────
  const handleSearchChange = (e) => {
    const q = e.target.value.toLowerCase().trim();
    setSearchQuery(e.target.value);
    if (!q) {
      setSearchResults([]);
      return;
    }
    const filtered = allRegisteredPatients.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.uhid.toLowerCase().includes(q) ||
      (p.phone && p.phone.includes(q))
    );
    setSearchResults(filtered);
  };

  const handlePickFoundPatient = (pat) => {
    onSelectPatient(pat);
    setFaceMatchResult({ match: pat, confidence: 100 });
    if (speak) {
      speak(`வணக்கம் ${pat.name}! உங்கள் முந்தைய விவரங்கள் ஏற்றப்பட்டன.`);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in text-left">
      
      {/* ── 2 Main Kiosk Option Tabs ───────────────────────────────────────── */}
      <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-1.5 grid grid-cols-2 gap-2 shadow-2xl">
        <button
          type="button"
          onClick={() => {
            setActiveOption('new');
            if (speak) speak('புதிய நோயாளி பதிவு. முகத்தை கேமராவில் காட்டி முக அடையாளம் பதிவு செய்யவும்.');
          }}
          className={`py-3.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
            activeOption === 'new'
              ? 'bg-gradient-to-r from-violet-600 via-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-900/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span className="text-lg">🪪</span>
          <div className="text-left leading-tight">
            <div>1. புதிய நோயாளி பதிவு</div>
            <div className="text-[10px] opacity-80 font-normal">New Registration + Face ID</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveOption('returning');
            if (speak) speak('ஏற்கனவே வந்த நோயாளி. முகத்தை ஸ்கேன் செய்து வரலாற்றை உடனடியாக ஏற்றவும்.');
          }}
          className={`py-3.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
            activeOption === 'returning'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-teal-900/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span className="text-lg">🔄</span>
          <div className="text-left leading-tight">
            <div>2. ஏற்கனவே வந்த நோயாளி</div>
            <div className="text-[10px] opacity-80 font-normal">Returning Patient + Face ID Login</div>
          </div>
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          OPTION 1: NEW PATIENT REGISTRATION (with Face ID Lock & Nurse Help)
      ════════════════════════════════════════════════════════════════════════ */}
      {activeOption === 'new' && (
        <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl p-5 space-y-4 shadow-xl">
          
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📷</span> Face ID Biometric Registration
              </h3>
              <p className="text-xs text-slate-400">முக அடையாளம் மற்றும் விவரங்களை பதிவு செய்க</p>
            </div>

            {/* Nurse Help Toggle for Elderly/Rural */}
            <button
              type="button"
              onClick={() => {
                const next = !isNurseAssisted;
                setIsNurseAssisted(next);
                if (next && speak) {
                  speak('செவிலியர் உதவி முறை செயல்படுத்தப்பட்டது. உதவி பெற தயங்காதீர்கள்.');
                }
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 border ${
                isNurseAssisted
                  ? 'bg-rose-600 border-rose-400 text-white shadow-lg shadow-rose-900/40 animate-pulse'
                  : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:border-rose-600'
              }`}
            >
              <span>👩‍⚕️</span>
              <span>Need Help? (செவிலியர் உதவி)</span>
            </button>
          </div>

          {/* Face ID Lock Button & Live Status */}
          <div className={`p-4 rounded-xl border transition-all ${
            isFaceLocked
              ? 'bg-emerald-950/30 border-emerald-500/80'
              : 'bg-slate-800/50 border-cyan-800/60'
          }`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {facePhoto ? (
                  <img
                    src={facePhoto}
                    alt="Face ID Snapshot"
                    className="w-14 h-14 rounded-xl object-cover border-2 border-emerald-400 shadow-md"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl text-cyan-400 animate-pulse">
                    👤
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>{isFaceLocked ? '✅ Face ID Locked' : '📷 Face Recognition Ready'}</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isFaceLocked
                      ? 'Biometric landmark signature saved successfully.'
                      : 'கேமராவை நோக்கி நேராக பார்த்து Face ID-ஐ Lock செய்யவும்.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLockFaceID}
                className={`py-2 px-3.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                  isFaceLocked
                    ? 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                    : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/50'
                }`}
              >
                <span>{isFaceLocked ? '↺ Re-lock' : '🔒 Lock Face ID'}</span>
              </button>
            </div>
          </div>

          {/* Demographic Input Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                நோயாளி பெயர் (Patient Name) <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Ramesh Kumar"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                தொலைபேசி எண் (Mobile Number)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex: 9876543210 (Optional)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                வயது (Age)
              </label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                min="5"
                max="115"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                பாலினம் (Gender)
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-cyan-500"
              >
                <option value="Male">Male (ஆண்)</option>
                <option value="Female">Female (பெண்)</option>
                <option value="Other">Other (பிற)</option>
              </select>
            </div>
          </div>

          {/* Submit New Patient */}
          <button
            type="button"
            onClick={handleRegisterNewPatient}
            className="w-full py-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-violet-600 via-cyan-600 to-blue-600 hover:from-violet-500 hover:to-cyan-500 text-white shadow-2xl shadow-violet-900/40 hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <span>📷</span>
            <span>பதிவு செய்து ஸ்கேன் தொடங்குக (Register & Start Face Scan)</span>
            <span>→</span>
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          OPTION 2: RETURNING PATIENT (1-Click Face ID Auto-Login & Lookup)
      ════════════════════════════════════════════════════════════════════════ */}
      {activeOption === 'returning' && (
        <div className="bg-slate-900/80 border border-teal-800/80 rounded-2xl p-5 space-y-4 shadow-xl">
          
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🔄</span> Returning Patient Verification
              </h3>
              <p className="text-xs text-teal-300">முந்தைய நோயாளி முகம் அறிதல் மற்றும் தேடல்</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-teal-950/60 border border-teal-700 text-teal-300 text-[11px] font-mono">
              {allRegisteredPatients.length} Registered Patients in DB
            </span>
          </div>

          {/* 1-Click Face ID Auto Login Scanner */}
          <div className="p-4 rounded-xl bg-teal-950/30 border border-teal-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">📷</span>
                <div>
                  <p className="text-xs font-bold text-white">Face ID Auto-Scan Login</p>
                  <p className="text-[11px] text-slate-300">கேமராவை நோக்கி பார்த்து 1-கிளிக்கில் வரலாற்றை மீட்டெடுக்கவும்.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleScanFaceAutoLogin}
                disabled={isScanningFace || allRegisteredPatients.length === 0}
                className="py-2.5 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-teal-950/50 flex items-center gap-1.5 disabled:opacity-50"
              >
                {isScanningFace ? '⏳ Scanning Face...' : '🔍 Scan Face to Login'}
              </button>
            </div>
          </div>

          {/* Recognized Patient Badge */}
          {faceMatchResult && faceMatchResult.match && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border-2 border-emerald-500 flex items-center justify-between shadow-xl">
              <div className="flex items-center gap-3">
                {faceMatchResult.match.face_photo ? (
                  <img
                    src={faceMatchResult.match.face_photo}
                    alt={faceMatchResult.match.name}
                    className="w-14 h-14 rounded-xl object-cover border-2 border-emerald-400 shadow"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-emerald-900/50 border border-emerald-600 flex items-center justify-center text-2xl">
                    ✓
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{faceMatchResult.match.name}</span>
                    <span className="text-xs text-emerald-400 font-mono">({faceMatchResult.match.uhid})</span>
                    <span className="text-[10px] bg-emerald-700 text-white px-1.5 py-0.5 rounded font-bold">
                      {faceMatchResult.confidence}% Face Match
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {faceMatchResult.match.age}y / {faceMatchResult.match.gender} • {faceMatchResult.match.past_visits?.length || 0} previous visit(s)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Fallback Search by Phone / UHID */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              அல்லது மொபைல் / UHID எண் தேடுக (Or Search by Mobile / UHID):
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Ex: MED-123456, Ramesh, or 9840..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-teal-400"
            />
          </div>

          {/* Search Results List */}
          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {searchResults.map(pat => (
                <div
                  key={pat.uhid}
                  onClick={() => handlePickFoundPatient(pat)}
                  className="p-3 bg-slate-950 border border-slate-800 hover:border-teal-500 rounded-xl cursor-pointer flex items-center justify-between transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    {pat.face_photo ? (
                      <img src={pat.face_photo} alt={pat.name} className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-lg">👤</div>
                    )}
                    <div>
                      <p className="text-xs font-bold text-white">{pat.name}</p>
                      <p className="text-[10px] text-slate-400">{pat.uhid} • {pat.phone || 'No phone'}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-xs bg-teal-900/40 text-teal-300 border border-teal-700 px-2.5 py-1 rounded-lg"
                  >
                    Select
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Proceed Button for Returning Patient */}
          <button
            type="button"
            onClick={() => {
              if (!activePatient) {
                alert('தயவுசெய்து ஒரு நோயாளியை தேர்ந்தெடுக்கவும் (Please select or scan patient).');
                return;
              }
              onProceed();
            }}
            disabled={!activePatient}
            className="w-full py-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-2xl shadow-teal-950/50 hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <span>📷</span>
            <span>தொடர் பரிசோதனை தொடங்குக (Start Repeat Scan)</span>
            <span>→</span>
          </button>
        </div>
      )}

    </div>
  );
}
