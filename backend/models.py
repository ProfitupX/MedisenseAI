"""
Pydantic models for AntiGravity API request/response validation.
Includes scientific DSP metrics: BP, Hemoglobin, SQI, SNR, and detailed HRV.
Also includes Doctor Assistant: Symptom Interview + Prescription Report models.
"""
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any


class RGBFrame(BaseModel):
    r: float = Field(..., ge=0, le=255, description="Mean Red channel intensity (0-255)")
    g: float = Field(..., ge=0, le=255, description="Mean Green channel intensity (0-255)")
    b: float = Field(..., ge=0, le=255, description="Mean Blue channel intensity (0-255)")
    timestamp: Optional[float] = None


class AnalyzeRequest(BaseModel):
    frames: List[RGBFrame] = Field(..., min_length=150, description="RGB frames (min 5s at 30fps)")
    fps: float = Field(default=30.0, ge=5.0, le=60.0)
    roi_source: str = Field(default="forehead+cheeks", description="Region of interest used")


class BloodPressureResult(BaseModel):
    sbp: int
    dbp: int
    map: int
    category: str
    pulse_pressure: int


class HRVResult(BaseModel):
    rmssd_ms: float
    sdnn_ms: float
    pnn50: float
    stress_index: str
    classification: str


class VitalsResult(BaseModel):
    heart_rate_bpm: float
    welch_bpm: Optional[float] = None
    peak_bpm: Optional[float] = None
    spo2_percent: float
    respiration_rate: float
    blood_pressure: BloodPressureResult
    hemoglobin_g_dl: float
    hrv: HRVResult
    snr_db: float
    confidence: int
    waveform: List[float]
    frames_analyzed: int
    fps_used: float


class AnalyzeResponse(BaseModel):
    vitals: VitalsResult
    triage: Dict[str, Any]
    scan_quality: str
    message: str


# ── Doctor Assistant Models ────────────────────────────────────────────────────

class SymptomAnswer(BaseModel):
    question_number: int
    question_english: str
    answer: str


class SymptomInterviewRequest(BaseModel):
    vitals: Dict[str, Any] = Field(..., description="rPPG vitals from scan")
    primary_complaint: Optional[str] = Field(default="", description="Chief complaint / primary symptom (e.g., Fever, Cold, Chest pain, or custom text)")
    previous_answers: List[SymptomAnswer] = Field(default=[], description="All previous Q&A")
    question_number: int = Field(default=1, ge=1, le=6)


class SymptomInterviewResponse(BaseModel):
    question_number: int
    question_tanglish: str
    question_tamil: str
    question_english: str
    options: List[str]
    options_tamil: List[str]
    total_questions: int
    is_final: bool


class PrescriptionRequest(BaseModel):
    vitals: Dict[str, Any] = Field(..., description="rPPG vitals from scan")
    triage: Dict[str, Any] = Field(..., description="Triage result")
    primary_complaint: Optional[str] = Field(default="", description="Chief complaint")
    symptom_answers: List[SymptomAnswer] = Field(..., description="All symptom interview answers")


class MedicineItem(BaseModel):
    name: str
    dosage: str
    frequency: str
    reason: str
    caution: str


class PrescriptionResponse(BaseModel):
    assessment_title: str
    assessment_english: str
    assessment_tanglish: str
    assessment_tamil: str
    possible_conditions: List[str]
    medicines: List[Dict[str, Any]]
    home_care: List[str]
    home_care_tamil: List[str]
    triage_decision: str
    triage_reason: str
    triage_tanglish: str
    triage_tamil: str
    follow_up: str
    disclaimer: str


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Text to synthesize")
    voice: Optional[str] = Field(default="female", description="Voice ID: female, male, english, or exact voice code")
    rate: Optional[str] = Field(default="+0%", description="Speech rate adjustment e.g. +0%, -10%")

