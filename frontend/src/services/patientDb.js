/**
 * patientDb.js — Fresh Real Database Layer (Supabase-Ready)
 * ==========================================================
 * Clean asynchronous database service using IndexedDB / LocalStorage.
 * Starts 100% FRESH with zero dummy records.
 * Schema maps directly to Supabase PostgreSQL tables for effortless future migration.
 *
 * Stores:
 *  - patients: id, uhid, name, age, gender, phone, face_descriptor, face_photo, is_nurse_assisted, created_at
 *  - visits: id, uhid, timestamp, vitals, primary_complaint, symptom_qa, triage, prescription, assigned_route, doctor_token
 *  - tokens: token_id, token_number, uhid, assigned_role ('doctor' | 'nurse'), opd_room, timestamp, status
 */

const DB_NAME = 'MediSenseAI_LocalDB';
const DB_VERSION = 1;
const STORAGE_KEY_PATIENTS = 'medisense_real_patients';
const STORAGE_KEY_VISITS   = 'medisense_real_visits';
const STORAGE_KEY_TOKENS   = 'medisense_real_tokens';

class PatientDatabase {
  constructor() {
    this._initStorage();
  }

  _initStorage() {
    if (!localStorage.getItem(STORAGE_KEY_PATIENTS)) {
      localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEY_VISITS)) {
      localStorage.setItem(STORAGE_KEY_VISITS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEY_TOKENS)) {
      localStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify([]));
    }
  }

  // ── Patients API ──────────────────────────────────────────────────────────

  async getAllPatients() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PATIENTS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('patientDb getAllPatients error:', e);
      return [];
    }
  }

  async getPatientByUhid(uhid) {
    if (!uhid) return null;
    const patients = await this.getAllPatients();
    return patients.find(p => p.uhid.toLowerCase() === uhid.toLowerCase().trim()) || null;
  }

  async getPatientByPhone(phone) {
    if (!phone) return null;
    const cleanPhone = phone.replace(/\D/g, '');
    const patients = await this.getAllPatients();
    return patients.find(p => p.phone && p.phone.replace(/\D/g, '') === cleanPhone) || null;
  }

  async createPatient(patientData) {
    const patients = await this.getAllPatients();
    const uhid = patientData.uhid || `MED-${Math.floor(100000 + Math.random() * 900000)}`;
    const newPatient = {
      id: `pat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      uhid: uhid,
      name: patientData.name || 'Anonymous Patient',
      age: parseInt(patientData.age) || 30,
      gender: patientData.gender || 'Male',
      phone: patientData.phone || '',
      face_descriptor: patientData.face_descriptor || null, // 12-dim numeric array
      face_photo: patientData.face_photo || null, // Base64 JPEG data URL
      is_nurse_assisted: Boolean(patientData.is_nurse_assisted),
      created_at: new Date().toISOString(),
      past_visits: []
    };

    patients.unshift(newPatient);
    localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(patients));
    return newPatient;
  }

  async updatePatient(uhid, updateData) {
    const patients = await this.getAllPatients();
    const idx = patients.findIndex(p => p.uhid.toLowerCase() === uhid.toLowerCase());
    if (idx >= 0) {
      patients[idx] = { ...patients[idx], ...updateData, updated_at: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(patients));
      return patients[idx];
    }
    return null;
  }

  // ── Visits API ────────────────────────────────────────────────────────────

  async getAllVisits() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_VISITS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('patientDb getAllVisits error:', e);
      return [];
    }
  }

  async getPatientVisits(uhid) {
    if (!uhid) return [];
    const visits = await this.getAllVisits();
    return visits.filter(v => v.uhid.toLowerCase() === uhid.toLowerCase().trim());
  }

  async addVisit(visitData) {
    const visits = await this.getAllVisits();
    const newVisit = {
      id: `vis_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      uhid: visitData.uhid,
      date: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      timestamp: new Date().toISOString(),
      vitals: visitData.vitals,
      primary_complaint: visitData.primary_complaint || '',
      symptom_answers: visitData.symptom_answers || [],
      triage: visitData.triage || {},
      triage_decision: visitData.triage_decision || 'Self-Care',
      prescription: visitData.prescription || null,
      assigned_route: visitData.assigned_route || 'nurse', // 'doctor' | 'nurse'
      doctor_notes: visitData.doctor_notes || '',
      doctor_token: visitData.doctor_token || null
    };

    visits.unshift(newVisit);
    localStorage.setItem(STORAGE_KEY_VISITS, JSON.stringify(visits));

    // Also link visit into patient's embedded cache
    const patient = await this.getPatientByUhid(visitData.uhid);
    if (patient) {
      const updatedVisits = [newVisit, ...(patient.past_visits || [])];
      await this.updatePatient(visitData.uhid, { past_visits: updatedVisits });
    }

    return newVisit;
  }

  // ── Tokens API ────────────────────────────────────────────────────────────

  async getAllTokens() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_TOKENS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('patientDb getAllTokens error:', e);
      return [];
    }
  }

  async saveToken(tokenData) {
    const tokens = await this.getAllTokens();
    tokens.unshift(tokenData);
    localStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify(tokens));
    return tokenData;
  }

  // ── Database Maintenance ──────────────────────────────────────────────────

  async clearAllData() {
    localStorage.removeItem(STORAGE_KEY_PATIENTS);
    localStorage.removeItem(STORAGE_KEY_VISITS);
    localStorage.removeItem(STORAGE_KEY_TOKENS);
    this._initStorage();
    return true;
  }
}

export const patientDb = new PatientDatabase();
export default patientDb;
