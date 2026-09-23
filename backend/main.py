"""
AntiGravity FastAPI Backend — Main Application
================================================
Endpoints:
  GET  /              → Health check
  POST /api/analyze   → Full rPPG pipeline + Gemini triage
  GET  /api/status    → Server status
  POST /api/symptom-interview → AI generates symptom questions
  POST /api/prescription-report → Final AI prescription + care plan
  GET  /api/tts       → Tamil TTS audio (gTTS)
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn
import io
import asyncio

from models import (
    AnalyzeRequest, AnalyzeResponse,
    SymptomInterviewRequest, SymptomInterviewResponse,
    PrescriptionRequest, PrescriptionResponse,
    TTSRequest,
)
from signal_processor import run_rppg_pipeline
from gemini_triage import get_gemini_triage
from doctor_assistant import generate_symptom_question, generate_prescription_report
from tts_engine import generate_neural_speech, VOICES

# ── App Init ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="AntiGravity rPPG API",
    description="Remote Photoplethysmography Medical Screening + AI Doctor Assistant Backend",
    version="2.0.0",
    docs_url="/docs",
)

# ── CORS (allow React dev server) ────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8001", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "app": "AntiGravity rPPG Medical Screening + AI Doctor Assistant API",
        "version": "2.0.0",
        "status": "operational",
        "docs": "/docs"
    }


@app.get("/api/status")
def status():
    return {"status": "ok", "message": "AntiGravity backend is running"}


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_vitals(request: AnalyzeRequest):
    """
    Main pipeline endpoint:
    1. Validate incoming RGB frame data
    2. Run rPPG signal processing (POS + Welch PSD + dual fusion)
    3. Pipe computed vitals to Gemini clinical triage
    4. Return structured response
    """
    frames_data = [{"r": f.r, "g": f.g, "b": f.b} for f in request.frames]

    # ── Signal Processing
    try:
        vitals = await asyncio.to_thread(run_rppg_pipeline, frames_data, request.fps)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Signal processing error: {str(e)}")

    # ── Scan Quality Assessment
    frame_count = len(frames_data)
    expected_frames = int(request.fps * 30)  # 30 second scan

    if frame_count >= expected_frames * 0.9:
        scan_quality = "Excellent"
    elif frame_count >= expected_frames * 0.7:
        scan_quality = "Good"
    elif frame_count >= expected_frames * 0.5:
        scan_quality = "Fair"
    else:
        scan_quality = "Poor — Consider rescanning"

    # ── Gemini Triage
    try:
        triage = await asyncio.to_thread(get_gemini_triage, vitals)
    except Exception as e:
        triage = {"error": str(e), "risk_level": "Unknown", "risk_color": "gray"}

    return AnalyzeResponse(
        vitals=vitals,
        triage=triage,
        scan_quality=scan_quality,
        message="Analysis complete"
    )


@app.post("/api/symptom-interview")
async def symptom_interview(request: SymptomInterviewRequest):
    """
    AI Doctor Assistant - Generate next symptom question dynamically with Google AI.
    Called once per question (up to 4 questions total).
    """
    try:
        prev = [{"question_number": a.question_number, "question_english": a.question_english, "answer": a.answer}
                for a in request.previous_answers]
        result = await asyncio.to_thread(
            generate_symptom_question,
            vitals=request.vitals,
            primary_complaint=request.primary_complaint or "",
            previous_answers=prev,
            question_number=request.question_number
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Symptom interview error: {str(e)}")


@app.post("/api/prescription-report")
async def prescription_report(request: PrescriptionRequest):
    """
    AI Doctor Assistant - Generate final prescription and care plan dynamically with Google AI.
    Called after all symptom questions are answered.
    """
    try:
        answers = [{"question_number": a.question_number, "question_english": a.question_english, "answer": a.answer}
                   for a in request.symptom_answers]
        result = await asyncio.to_thread(
            generate_prescription_report,
            vitals=request.vitals,
            triage=request.triage,
            primary_complaint=request.primary_complaint or "",
            symptom_answers=answers
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prescription report error: {str(e)}")


@app.get("/api/tts")
async def text_to_speech_get(
    text: str = Query(..., description="Text to convert to speech"),
    voice: str = Query(default="female", description="Voice ID: female (Pallavi), male (Valluvar), english"),
    rate: str = Query(default="+0%", description="Speech speed adjustment e.g. +0%, -10%, +15%"),
    lang: str = Query(default="ta", description="Legacy language parameter for backward compatibility")
):
    """
    Neural Tamil TTS (Azure Neural voices via edge-tts with gTTS fallback).
    Returns studio-quality MP3 audio stream.
    """
    try:
        mp3_bytes = await generate_neural_speech(text=text, voice=voice, rate=rate)
        if not mp3_bytes:
            raise HTTPException(status_code=400, detail="Empty speech generated")

        return StreamingResponse(
            io.BytesIO(mp3_bytes),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=speech.mp3",
                "Cache-Control": "public, max-age=3600"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS error: {str(e)}")


@app.post("/api/tts")
async def text_to_speech_post(request: TTSRequest):
    """
    Neural Tamil TTS via POST JSON body for longer paragraphs.
    """
    try:
        mp3_bytes = await generate_neural_speech(
            text=request.text,
            voice=request.voice or "female",
            rate=request.rate or "+0%"
        )
        if not mp3_bytes:
            raise HTTPException(status_code=400, detail="Empty speech generated")

        return StreamingResponse(
            io.BytesIO(mp3_bytes),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=speech.mp3",
                "Cache-Control": "public, max-age=3600"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS error: {str(e)}")


@app.get("/api/tts/voices")
async def list_available_voices():
    """Returns list of available neural AI voices for the frontend."""
    return [
        {
            "id": "female",
            "name": "பல்லவி (Dr. Pallavi - Female)",
            "subtitle": "Natural, warm & caring tone",
            "gender": "Female",
            "locale": "ta-IN",
            "model": "Microsoft Azure Neural (ta-IN-PallaviNeural)"
        },
        {
            "id": "male",
            "name": "வள்ளுவர் (Dr. Valluvar - Male)",
            "subtitle": "Clear, professional doctor tone",
            "gender": "Male",
            "locale": "ta-IN",
            "model": "Microsoft Azure Neural (ta-IN-ValluvarNeural)"
        },
        {
            "id": "english",
            "name": "Neerja (Indian English)",
            "subtitle": "Clear Indian English medical accent",
            "gender": "Female",
            "locale": "en-IN",
            "model": "Microsoft Azure Neural (en-IN-NeerjaNeural)"
        }
    ]


# ── Entry Point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
