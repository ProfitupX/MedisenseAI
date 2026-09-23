# MediSense AI — Contactless rPPG Clinical Triage & CDSS

> Zero-hardware, contactless health screening kiosk and Clinical Decision Support System (CDSS) powered by Computer Vision rPPG and Google Gemini AI.

---

## 🌟 Key Capabilities

- 📷 **Contactless rPPG Vitals Extraction**: 30-second camera scan extracting Heart Rate (BPM), Blood Oxygen (SpO₂), Respiration Rate (BrPM), Blood Pressure (SBP/DBP), Hemoglobin (g/dL), and HRV (RMSSD).
- 🩺 **AI Clinical Interview & Triaging**: Dynamic symptom inquiry and risk assessment tailored for rural and semi-urban patients in **Tamil** and **Tanglish**.
- 📋 **Doctor Verification & CDSS Report**: Clinical Decision Support System generating preliminary OTC recommendations, clinical justifications, and doctor sign-off workflows.
- 🗣️ **Neural Tamil Voice Interaction**: Natural voice guidance with edge-tts neural voice assistance.

---

## 🏗️ Architecture

```
Webcam (React + MediaPipe FaceMesh) 
               │
               ▼ (RGB temporal signals)
FastAPI Backend (POS/CHROM rPPG Signal Processing + Welch PSD)
               │
               ▼ (Vital signs + Interview answers)
Google Gemini AI Engine (Clinical Triage & Assessment)
               │
               ▼
Doctor / Nurse Verification & Patient Summary
```

---

## 💻 Tech Stack

| Component | Technology |
|---|---|
| **Frontend** | React 18, Vite, MediaPipe FaceMesh, Chart.js, Tailwind CSS, Lucide Icons |
| **Backend** | FastAPI, Python 3.10+, NumPy, SciPy, Uvicorn |
| **AI Triage & CDSS** | Google Gemini Flash / Gemma |
| **Voice Engine** | Edge-TTS (Tamil Neural Voice) / gTTS fallback |
| **Algorithm** | Dual-ROI Plane-Orthogonal-to-Skin (POS) & CHROM rPPG + Welch PSD |

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.10+
- Node.js 18+
- Google Gemini API Key ([Get one here](https://aistudio.google.com/))

### 2. Backend Setup
```powershell
cd backend
pip install -r requirements.txt
cp .env.example .env
# Open .env and insert your GEMINI_API_KEY
python main.py
```
*Backend runs on `http://localhost:8001` (Docs: `http://localhost:8001/docs`)*

### 3. Frontend Setup
```powershell
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173`*

---

## 🔬 Clinical Basis & Reference

Algorithm design informed by clinical contactless hemodynamic research:
- **PMC12165443** — *"Remote Photoplethysmography Technology for Blood Pressure and Hemoglobin Level Assessment in the Preoperative Assessment Setting"* (Singapore General Hospital, 2025)
- Dual-ROI tracking (Forehead + Bilateral Cheeks) for robust motion compensation and dermal perfusion capture.

---

## ⚠️ Medical Disclaimer

*MediSense AI is a Clinical Decision Support System (CDSS) designed for preliminary screening and triaging assistance. It is NOT an autonomous medical device and does not replace evaluation by certified healthcare practitioners.*
