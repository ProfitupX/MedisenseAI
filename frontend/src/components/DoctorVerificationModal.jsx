/**
 * DoctorVerificationModal.jsx — CDSS Clinician & Nurse Verification Portal
 * ==========================================================================
 * Automatically adapts based on triage severity routing:
 *  - Doctor Mode (High Risk / Emergency / Severe): Issues DOC-XXX with OPD room & Lab Orders
 *  - Nurse Mode (Normal / Stable / Routine): Issues NUR-XXX with Nurse Wellness Desk instructions
 */

import React, { useState } from 'react';
import { patientDb } from '../services/patientDb.js';

const COMMON_LAB_TESTS = [
  { id: 'cbc', label: 'Complete Blood Count (CBC + Platelets)', category: 'Hematology' },
  { id: 'dengue', label: 'Dengue NS1 Antigen & IgM/IgG', category: 'Serology' },
  { id: 'ecg', label: '12-Lead Electrocardiogram (ECG)', category: 'Cardiology' },
  { id: 'rbs', label: 'Random Blood Sugar (RBS) & HbA1c', category: 'Biochemistry' },
  { id: 'cxr', label: 'Chest X-Ray (PA View)', category: 'Radiology' },
  { id: 'lipid', label: 'Lipid Profile (Cholesterol)', category: 'Biochemistry' },
  { id: 'kft', label: 'Kidney Function Test (Creatinine/Urea)', category: 'Renal' },
  { id: 'lft', label: 'Liver Function Test (LFT/Bilirubin)', category: 'Hepatic' },
];

export default function DoctorVerificationModal({
  isOpen,
  onClose,
  patient,
  vitals,
  triage,
  report,
  onVerificationComplete,
}) {
  if (!isOpen) return null;

  const isDoctorRoute = report?.assigned_role === 'doctor' || triage?.risk_level === 'High Risk' || report?.triage_decision === 'Emergency';

  // Clinician details (Doctor vs Nurse)
  const [verifierRole, setVerifierRole] = useState(isDoctorRoute ? 'doctor' : 'nurse');
  const [doctorName, setDoctorName] = useState(
    isDoctorRoute ? 'Dr. A. Senthil Kumar, MBBS, MD' : 'Staff Nurse Deepa, B.Sc. Nursing'
  );
  const [doctorRegNo, setDoctorRegNo] = useState(
    isDoctorRoute ? 'TN-84920-MC' : 'TN-NUR-5421'
  );
  const [specialty, setSpecialty] = useState(
    isDoctorRoute ? 'General Medicine & Cardiology CDSS' : 'Triage & Patient Wellness Care'
  );
  const [department, setDepartment] = useState(
    isDoctorRoute ? 'General Medicine' : 'Nurse Triage & Wellness Desk'
  );
  const [urgency, setUrgency] = useState(
    isDoctorRoute ? 'Priority / Urgent' : 'Routine'
  );

  // Editable Medicines
  const [medicines, setMedicines] = useState(
    report?.medicines ? JSON.parse(JSON.stringify(report.medicines)) : []
  );

  // Ordered Lab Tests
  const [selectedTests, setSelectedTests] = useState([
    report?.assessment_title?.toLowerCase().includes('fever') ? 'Complete Blood Count (CBC + Platelets)' : null,
    report?.assessment_title?.toLowerCase().includes('chest') ? '12-Lead Electrocardiogram (ECG)' : null,
  ].filter(Boolean));

  // Clinician Notes
  const [clinicalNotes, setClinicalNotes] = useState(
    `Patient evaluated via MediSense rPPG Kiosk. ${report?.assessment_title || 'Clinical impression noted'}. Vitals verified and guidance confirmed.`
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tokenResult, setTokenResult] = useState(null);

  const handleToggleTest = (testLabel) => {
    if (selectedTests.includes(testLabel)) {
      setSelectedTests(selectedTests.filter((t) => t !== testLabel));
    } else {
      setSelectedTests([...selectedTests, testLabel]);
    }
  };

  const handleUpdateMedicine = (idx, field, val) => {
    const updated = [...medicines];
    updated[idx][field] = val;
    setMedicines(updated);
  };

  const handleRemoveMedicine = (idx) => {
    setMedicines(medicines.filter((_, i) => i !== idx));
  };

  const handleAddMedicine = () => {
    setMedicines([
      ...medicines,
      {
        name: 'New Medicine (e.g. Tab Telmisartan 40mg)',
        dosage: '1 tablet',
        frequency: 'Once daily after breakfast',
        duration: '5 days',
        reason: 'Clinician confirmed',
        caution: 'Take after meals with water',
      },
    ]);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        patient_info: patient || { name: 'Walk-in Patient', uhid: 'MED-WALKIN', age: 30, gender: 'Male' },
        vitals: vitals || {},
        triage: triage || {},
        prescription_report: report || {},
        verifier_role: verifierRole,
        doctor_name: doctorName,
        doctor_reg_no: doctorRegNo,
        doctor_specialty: specialty,
        clinical_notes: clinicalNotes,
        prescribed_medicines: medicines,
        ordered_lab_tests: selectedTests,
        opd_department: department,
        urgency_level: urgency,
      };

      const res = await fetch('/api/doctor-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setTokenResult(data);

      // Save token in fresh local DB
      await patientDb.saveToken(data);

      if (onVerificationComplete) {
        onVerificationComplete(data);
      }
    } catch (err) {
      console.error('Verification error:', err);
      alert('Verification error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto text-left">
        
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-lg ${
              verifierRole === 'doctor'
                ? 'bg-gradient-to-br from-violet-600 to-cyan-500'
                : 'bg-gradient-to-br from-pink-600 to-rose-500'
            }`}>
              {verifierRole === 'doctor' ? '👨‍⚕️' : '👩‍⚕️'}
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>{verifierRole === 'doctor' ? 'Doctor CDSS Verification' : 'Nurse Triage Sign-Off'}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-mono font-bold ${
                  verifierRole === 'doctor'
                    ? 'bg-violet-900/60 border border-violet-700 text-violet-300'
                    : 'bg-rose-900/60 border border-rose-700 text-rose-300'
                }`}>
                  {verifierRole === 'doctor' ? 'Doctor Review' : 'Nurse Review'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {verifierRole === 'doctor' ? 'மருத்துவர் சரிபார்ப்பு & OPD டோக்கன்' : 'செவிலியர் சரிபார்ப்பு & வழிகாட்டுதல்'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all"
          >
            ✕
          </button>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-slate-200 text-sm">
          
          {tokenResult ? (
            /* Official Certified Digital Slip */
            <div className="space-y-5 animate-fade-in print:p-0">
              <div className={`border-2 rounded-2xl p-6 text-center space-y-4 shadow-2xl ${
                verifierRole === 'doctor'
                  ? 'bg-gradient-to-br from-violet-950/40 via-slate-900 to-slate-950 border-cyan-500/80'
                  : 'bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-950 border-rose-500/80'
              }`}>
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  verifierRole === 'doctor'
                    ? 'bg-cyan-900/50 border border-cyan-500 text-cyan-300'
                    : 'bg-rose-900/50 border border-rose-500 text-rose-300'
                }`}>
                  ✓ {tokenResult.status}
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-slate-400 uppercase tracking-widest">
                    {verifierRole === 'doctor' ? 'Doctor Consultation Token' : 'Nurse Triage Token'}
                  </p>
                  <h1 className={`text-4xl font-extrabold font-mono text-transparent bg-clip-text ${
                    verifierRole === 'doctor'
                      ? 'bg-gradient-to-r from-cyan-400 via-blue-300 to-violet-400'
                      : 'bg-gradient-to-r from-rose-400 via-pink-300 to-amber-300'
                  }`}>
                    {tokenResult.token_number}
                  </h1>
                  <p className="text-sm font-semibold text-white">{tokenResult.opd_room}</p>
                </div>

                {/* Patient + Biometric Snapshot Strip */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 text-xs text-left grid grid-cols-3 gap-3 items-center">
                  {patient?.face_photo ? (
                    <img
                      src={patient.face_photo}
                      alt="Verified Face"
                      className="w-16 h-16 rounded-xl object-cover border border-slate-700 shadow"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl">
                      👤
                    </div>
                  )}
                  <div className="col-span-2 space-y-1">
                    <div>
                      <span className="text-slate-500">Patient: </span>
                      <span className="text-white font-bold">{patient?.name || 'Walk-in'}</span>
                      <span className="text-slate-400 ml-1">({patient?.age}y / {patient?.gender})</span>
                    </div>
                    <div>
                      <span className="text-slate-500">UHID: </span>
                      <span className="text-cyan-300 font-mono">{patient?.uhid}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Clinician: </span>
                      <span className="text-white font-semibold">{tokenResult.verified_data?.doctor_name}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-200">
                  {tokenResult.summary_tamil}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="flex-1 py-3 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all flex items-center justify-center gap-2"
                  >
                    <span>🖨️</span>
                    <span>Print Token Slip</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg transition-all"
                  >
                    Done (முடிந்தது)
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Verification Form */
            <>
              {/* Severity Destination Badge */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                isDoctorRoute
                  ? 'bg-violet-950/40 border-violet-700/80'
                  : 'bg-teal-950/40 border-teal-700/80'
              }`}>
                <div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono border ${
                    isDoctorRoute
                      ? 'bg-rose-950/80 border-rose-600 text-rose-300'
                      : 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                  }`}>
                    {isDoctorRoute ? '🚨 Routed to DOCTOR (High Severity / Emergency)' : '✅ Routed to NURSE (Normal / Stable Triage)'}
                  </span>
                  <p className="text-xs text-white font-semibold mt-1">
                    {report?.assigned_destination || (isDoctorRoute ? 'Doctor Consultation Room 03' : 'Nurse Triage Desk 01')}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <p className="text-slate-400">Risk Level</p>
                  <p className="font-bold text-cyan-300">{triage?.risk_level || 'Stable'}</p>
                </div>
              </div>

              {/* Clinician Profile */}
              <div className="bg-slate-800/40 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                  <span>🩺</span> Verifier Credentials
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Name & Title</label>
                    <input
                      type="text"
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Registration Number</label>
                    <input
                      type="text"
                      value={doctorRegNo}
                      onChange={(e) => setDoctorRegNo(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* Prescribed Medications Editor */}
              <div className="bg-slate-800/40 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                    <span>💊</span> Approved Care & Medications ({medicines.length})
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddMedicine}
                    className="px-2.5 py-1 rounded-lg bg-cyan-900/40 border border-cyan-700 text-cyan-300 text-xs font-bold hover:bg-cyan-900/70"
                  >
                    + Add Item
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {medicines.map((med, idx) => (
                    <div key={idx} className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={med.name}
                          onChange={(e) => handleUpdateMedicine(idx, 'name', e.target.value)}
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white font-semibold text-xs"
                          placeholder="Medicine or Care item"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveMedicine(idx)}
                          className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded bg-red-950/30 border border-red-800"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <input
                          type="text"
                          value={med.dosage}
                          onChange={(e) => handleUpdateMedicine(idx, 'dosage', e.target.value)}
                          className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-200"
                          placeholder="Dosage"
                        />
                        <input
                          type="text"
                          value={med.frequency}
                          onChange={(e) => handleUpdateMedicine(idx, 'frequency', e.target.value)}
                          className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-200"
                          placeholder="Frequency"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lab Test Orders (Only for Doctor mode) */}
              {isDoctorRoute && (
                <div className="bg-slate-800/40 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                    <span>🔬</span> Order Diagnostic Investigations ({selectedTests.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {COMMON_LAB_TESTS.map((test) => {
                      const isChecked = selectedTests.includes(test.label);
                      return (
                        <label
                          key={test.id}
                          className={`p-2.5 rounded-xl border cursor-pointer flex items-center gap-2.5 transition-all ${
                            isChecked
                              ? 'bg-blue-950/40 border-blue-600 text-white'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleTest(test.label)}
                            className="rounded border-slate-700 text-blue-500 focus:ring-0"
                          />
                          <div>
                            <p className="font-medium text-[11px] leading-tight">{test.label}</p>
                            <span className="text-[10px] text-slate-500">{test.category}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Clinician Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  குறிப்புகள் (Clinician / Nurse Notes):
                </label>
                <textarea
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all text-xs"
                >
                  Cancel (ரத்து)
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className={`flex-2 py-3 px-6 rounded-xl font-bold text-white shadow-xl transition-all text-xs flex items-center justify-center gap-2 disabled:opacity-50 ${
                    isDoctorRoute
                      ? 'bg-gradient-to-r from-violet-600 via-cyan-600 to-blue-600 hover:from-violet-500 hover:to-cyan-500 shadow-violet-900/40'
                      : 'bg-gradient-to-r from-pink-600 via-rose-600 to-amber-600 hover:from-pink-500 hover:to-rose-500 shadow-rose-900/40'
                  }`}
                >
                  {isSubmitting ? (
                    <span>⏳ Issuing Token...</span>
                  ) : (
                    <>
                      <span>✓ {isDoctorRoute ? 'Approve & Issue Doctor Token (DOC-XXX)' : 'Verify & Issue Nurse Token (NUR-XXX)'}</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
