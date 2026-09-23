/**
 * DoctorVerificationModal.jsx — CDSS Doctor / Nurse Verification & Sign-off Portal
 * =================================================================================
 * Enables clinical human-in-the-loop validation:
 *  - Doctor reviews & adjusts medications
 *  - Orders clinical laboratory investigations (CBC, Dengue NS1, ECG, RBS, etc.)
 *  - Appends clinical impression notes
 *  - Generates official OPD Token & digital prescription certificate
 */

import React, { useState } from 'react';
import { saveDoctorToken } from '../services/patientStorage.js';

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

  // Doctor details
  const [doctorName, setDoctorName] = useState('Dr. A. Senthil Kumar, MBBS, MD');
  const [doctorRegNo, setDoctorRegNo] = useState('TN-84920-MC');
  const [specialty, setSpecialty] = useState('General Medicine & CDSS');
  const [department, setDepartment] = useState('General Medicine');
  const [urgency, setUrgency] = useState(
    triage?.risk_level === 'High Risk' || report?.triage_decision === 'Emergency'
      ? 'Urgent'
      : triage?.risk_level === 'Alert'
      ? 'Priority'
      : 'Standard'
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

  // Doctor Notes
  const [doctorNotes, setDoctorNotes] = useState(
    `Patient evaluated via MediSense rPPG kiosk. ${report?.assessment_title || 'Clinical impression noted'}. Vitals reviewed and medication plan confirmed.`
  );

  // Submitting / Result state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tokenResult, setTokenResult] = useState(null);

  // Toggle Lab Test
  const handleToggleTest = (testLabel) => {
    if (selectedTests.includes(testLabel)) {
      setSelectedTests(selectedTests.filter((t) => t !== testLabel));
    } else {
      setSelectedTests([...selectedTests, testLabel]);
    }
  };

  // Medication handlers
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
        name: 'New Medication (e.g. Tab Telmisartan 40mg)',
        dosage: '1 tablet',
        frequency: 'Once daily after breakfast',
        duration: '5 days',
        reason: 'Clinician prescribed',
        caution: 'Take with water after food',
      },
    ]);
  };

  // Submit Approval
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        patient_info: patient || { name: 'Walk-in Patient', uhid: 'MED-WALKIN', age: 35, gender: 'Male' },
        vitals: vitals || {},
        triage: triage || {},
        prescription_report: report || {},
        doctor_name: doctorName,
        doctor_reg_no: doctorRegNo,
        doctor_specialty: specialty,
        clinical_notes: doctorNotes,
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
      saveDoctorToken(data);
      if (onVerificationComplete) {
        onVerificationComplete(data);
      }
    } catch (err) {
      console.error('Doctor verification error:', err);
      alert('Verification submission error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Print Token / Slip
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto text-left">
        
        {/* ── Modal Header ─────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center text-xl shadow-lg">
              👨‍⚕️
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Doctor / Nurse CDSS Verification</span>
                <span className="px-2 py-0.5 rounded-full bg-violet-900/50 border border-violet-700 text-violet-300 text-[10px] uppercase font-mono">
                  Human-in-the-Loop
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                மருத்துவர் சரிபார்ப்பு மற்றும் அதிகாரப்பூர்வ OPD டோக்கன்
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

        {/* ── Modal Body ───────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-slate-200 text-sm">
          
          {/* If Token already generated, show official digital slip */}
          {tokenResult ? (
            <div className="space-y-5 animate-fade-in print:p-0">
              <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border-2 border-emerald-500/80 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/50 border border-emerald-600 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                  ✓ Physician Verified & Certified
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-slate-400 uppercase tracking-widest">OPD Consultation Token</p>
                  <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-300 to-blue-400 font-mono">
                    {tokenResult.token_number}
                  </h1>
                  <p className="text-sm font-semibold text-cyan-300">{tokenResult.opd_room}</p>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 text-xs text-left grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-500">நோயாளி (Patient): </span>
                    <span className="text-white font-bold">{patient?.name || 'Walk-in Patient'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">UHID: </span>
                    <span className="text-cyan-300 font-mono">{patient?.uhid || 'MED-0000'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">மருத்துவர் (Doctor): </span>
                    <span className="text-white font-semibold">{tokenResult.verified_data?.doctor_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Medical Reg No: </span>
                    <span className="text-slate-300 font-mono">{tokenResult.verified_data?.doctor_reg_no}</span>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-slate-800">
                    <span className="text-slate-500">Timestamp: </span>
                    <span className="text-slate-300 font-mono">{tokenResult.timestamp}</span>
                  </div>
                </div>

                {/* Ordered Tests & Meds Summary */}
                {selectedTests.length > 0 && (
                  <div className="text-left bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs">
                    <p className="font-bold text-slate-300 mb-1.5">🔬 Ordered Lab Tests ({selectedTests.length}):</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTests.map((t, idx) => (
                        <span key={idx} className="px-2.5 py-1 rounded bg-blue-950/60 border border-blue-800 text-blue-300 font-medium">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-xl text-xs text-emerald-300">
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
                    className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg transition-all"
                  >
                    Close (முடிந்தது)
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ── Verification Form ── */
            <>
              {/* Patient & Scan Quick Strip */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <p className="text-slate-500">Patient</p>
                  <p className="font-bold text-white">{patient?.name || 'Walk-in Patient'}</p>
                  <p className="text-[10px] text-slate-400">{patient?.age}y / {patient?.gender} • {patient?.uhid}</p>
                </div>
                <div>
                  <p className="text-slate-500">Scan Vitals</p>
                  <p className="font-bold text-cyan-300">{vitals?.heart_rate_bpm?.toFixed(0)} BPM • {vitals?.spo2_percent?.toFixed(1)}% SpO₂</p>
                  <p className="text-[10px] text-amber-300">BP: {vitals?.blood_pressure?.sbp}/{vitals?.blood_pressure?.dbp} mmHg</p>
                </div>
                <div>
                  <p className="text-slate-500">AI Impression</p>
                  <p className="font-bold text-violet-300 truncate">{report?.assessment_title || 'General Screening'}</p>
                  <p className="text-[10px] text-slate-400">Risk: {triage?.risk_level || 'Stable'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Assigned Department</p>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="mt-0.5 w-full bg-slate-900 border border-slate-700 rounded-lg p-1 text-xs text-slate-200"
                  >
                    <option value="General Medicine">General Medicine</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Pulmonology">Pulmonology</option>
                    <option value="Emergency / Triage">Emergency / Triage</option>
                  </select>
                </div>
              </div>

              {/* 1. Doctor Profile */}
              <div className="bg-slate-800/40 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                  <span>🩺</span> Attending Physician Info
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Doctor Name & Credentials</label>
                    <input
                      type="text"
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-violet-500 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Medical Council Registration No</label>
                    <input
                      type="text"
                      value={doctorRegNo}
                      onChange={(e) => setDoctorRegNo(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-violet-500 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Review & Edit Medications */}
              <div className="bg-slate-800/40 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                    <span>💊</span> Approved Prescriptions ({medicines.length})
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddMedicine}
                    className="px-2.5 py-1 rounded-lg bg-violet-900/40 border border-violet-700 text-violet-300 text-xs font-bold hover:bg-violet-900/70"
                  >
                    + Add Medicine
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
                          placeholder="Medicine name"
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
                          placeholder="Dosage (e.g. 650mg)"
                        />
                        <input
                          type="text"
                          value={med.frequency}
                          onChange={(e) => handleUpdateMedicine(idx, 'frequency', e.target.value)}
                          className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-200"
                          placeholder="Frequency (e.g. TDS after food)"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Diagnostic Lab Test Orders */}
              <div className="bg-slate-800/40 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                  <span>🔬</span> Order Diagnostic Lab Tests ({selectedTests.length} Selected)
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

              {/* 4. Doctor Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  மருத்துவர் குறிப்பு (Doctor Clinical Notes):
                </label>
                <textarea
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* Action Buttons */}
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
                  className="flex-2 py-3 px-6 rounded-xl font-bold bg-gradient-to-r from-violet-600 via-cyan-600 to-blue-600 hover:from-violet-500 hover:to-cyan-500 text-white shadow-xl shadow-violet-900/40 transition-all text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>⏳ Verifying & Generating Token...</span>
                  ) : (
                    <>
                      <span>✓ Approve & Generate OPD Token</span>
                      <span>(டோக்கன் பெறுக)</span>
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
