/**
 * patientStorage.js — MediSense AI Patient & Longitudinal Visit Storage
 * =======================================================================
 * Manages patient profiles, repeat visit histories, and doctor approvals in LocalStorage.
 * Includes preloaded realistic demo patients for instant demonstration of
 * Repeat Visit Intelligence & Longitudinal Comparison.
 */

const STORAGE_KEY_PATIENTS = 'medisense_patients_v1';
const STORAGE_KEY_TOKENS   = 'medisense_tokens_v1';

export const DEMO_PATIENTS = [
  {
    uhid: 'MED-7821',
    name: 'Karthik Subramanian',
    name_tamil: 'கார்த்திக் சுப்ரமணியன்',
    age: 45,
    gender: 'Male',
    phone: '9840123456',
    address: 'Tambaram, Chennai',
    category: 'Hypertension Follow-up',
    past_visits: [
      {
        date: '2026-09-18 (5 days ago)',
        primary_complaint: 'Mild headache & work stress',
        vitals: {
          heart_rate_bpm: 72,
          spo2_percent: 98.5,
          blood_pressure: { sbp: 128, dbp: 82, category: 'Prehypertension' },
          respiration_rate: 16,
          hemoglobin_g_dl: 14.2,
          hrv: { rmssd_ms: 38, stress_index: 'Normal' }
        },
        triage_decision: 'Self-Care',
        doctor_notes: 'Advised lifestyle modification, salt reduction, and 30m daily brisk walk.'
      }
    ]
  },
  {
    uhid: 'MED-4019',
    name: 'Selvi Murugan',
    name_tamil: 'செல்வி முருகன்',
    age: 32,
    gender: 'Female',
    phone: '9840987654',
    address: 'Kanchipuram, TN',
    category: 'Viral Fever / Dengue Follow-up',
    past_visits: [
      {
        date: '2026-09-20 (3 days ago)',
        primary_complaint: 'High fever with severe body pain',
        vitals: {
          heart_rate_bpm: 96,
          spo2_percent: 98.0,
          blood_pressure: { sbp: 116, dbp: 74, category: 'Normal' },
          respiration_rate: 19,
          hemoglobin_g_dl: 12.6,
          hrv: { rmssd_ms: 22, stress_index: 'Elevated' }
        },
        triage_decision: 'See Doctor in 24h',
        doctor_notes: 'Dengue NS1 Antigen requested. Paracetamol 650mg TDS prescribed.'
      }
    ]
  },
  {
    uhid: 'MED-9102',
    name: 'Muthusamy Kuppusamy',
    name_tamil: 'முத்துசாமி குப்புசாமி',
    age: 68,
    gender: 'Male',
    phone: '9444112233',
    address: 'Salem, TN',
    category: 'Geriatric BP & Anemia Follow-up',
    past_visits: [
      {
        date: '2026-09-13 (10 days ago)',
        primary_complaint: 'General weakness & dizziness',
        vitals: {
          heart_rate_bpm: 78,
          spo2_percent: 95.5,
          blood_pressure: { sbp: 142, dbp: 90, category: 'Hypertension Stage 1' },
          respiration_rate: 17,
          hemoglobin_g_dl: 10.8,
          hrv: { rmssd_ms: 26, stress_index: 'Elevated' }
        },
        triage_decision: 'See Doctor in 24h',
        doctor_notes: 'Iron supplement + Telmisartan 40mg advised. Hemoglobin check ordered.'
      }
    ]
  }
];

export function getRegisteredPatients() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PATIENTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(DEMO_PATIENTS));
      return DEMO_PATIENTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEMO_PATIENTS;
  } catch (e) {
    console.error('Error loading patients from storage:', e);
    return DEMO_PATIENTS;
  }
}

export function savePatient(patient) {
  try {
    const list = getRegisteredPatients();
    const existingIdx = list.findIndex(p => p.uhid === patient.uhid || (patient.phone && p.phone === patient.phone));
    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...patient };
    } else {
      list.unshift(patient);
    }
    localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(list));
    return patient;
  } catch (e) {
    console.error('Error saving patient:', e);
    return patient;
  }
}

export function getPatientByUhid(uhid) {
  const list = getRegisteredPatients();
  return list.find(p => p.uhid?.toLowerCase() === uhid?.toLowerCase()) || null;
}

export function searchPatients(query) {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();
  const list = getRegisteredPatients();
  return list.filter(p => 
    p.name.toLowerCase().includes(q) ||
    p.uhid.toLowerCase().includes(q) ||
    (p.phone && p.phone.includes(q))
  );
}

export function addVisitToPatient(uhid, visitData) {
  try {
    const list = getRegisteredPatients();
    const idx = list.findIndex(p => p.uhid === uhid);
    if (idx >= 0) {
      const patient = list[idx];
      patient.past_visits = [visitData, ...(patient.past_visits || [])];
      list[idx] = patient;
      localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(list));
      return patient;
    }
  } catch (e) {
    console.error('Error adding visit:', e);
  }
  return null;
}

export function saveDoctorToken(tokenRecord) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TOKENS);
    const tokens = raw ? JSON.parse(raw) : [];
    tokens.unshift(tokenRecord);
    localStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify(tokens));
  } catch (e) {
    console.error('Error saving doctor token:', e);
  }
}
