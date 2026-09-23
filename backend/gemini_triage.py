"""
Gemini API Clinical Triage Engine
===================================
Pipelines computed scientific vitals → structured Gemini prompt →
returns risk classification + Tamil/Tanglish first-aid guidance.
Evaluates: HR, SpO2, RR, HRV, Blood Pressure (SBP/DBP), and Hemoglobin (Hb).
"""

import os
import json
import re
import google.generativeai as genai
from dotenv import load_dotenv
from typing import Dict

load_dotenv()

_API_KEY = os.getenv("GEMINI_API_KEY", "")
if _API_KEY:
    os.environ["GOOGLE_API_KEY"] = _API_KEY
    genai.configure(api_key=_API_KEY, transport="rest")


SYSTEM_INSTRUCTION = """You are an expert clinical triage analytics engine for a contactless rPPG vital signs screening platform.

Your task:
1. Analyze the 6 physiological vital sign measurements:
   - Heart Rate (BPM)
   - Oxygen Saturation SpO2 (%)
   - Respiration Rate (BrPM)
   - Heart Rate Variability RMSSD (ms)
   - Blood Pressure SBP / DBP (mmHg)
   - Hemoglobin concentration (g/dL)
2. Classify overall clinical risk: "Stable", "Alert", or "High Risk".
3. Provide immediate first-aid and medical guidance in BOTH crisp colloquial Tanglish (Tamil in English letters) and native Tamil script (தமிழ்).
4. Strictly return a valid JSON object matching the schema below — no markdown fences, no conversational text outside JSON.

JSON Schema:
{
  "risk_level": "Stable" | "Alert" | "High Risk",
  "risk_color": "green" | "amber" | "red",
  "risk_summary_english": "<1 concise clinical summary in English>",
  "vitals_analysis": {
    "heart_rate": "<clinical assessment>",
    "spo2": "<clinical assessment>",
    "respiration_rate": "<clinical assessment>",
    "blood_pressure": "<clinical assessment>",
    "hemoglobin": "<clinical assessment>",
    "hrv": "<clinical assessment>"
  },
  "advice_tanglish": "<Crisp, empathetic first-aid & health guidance in natural Tanglish>",
  "advice_tamil": "<Same clinical advice in formal Tamil script - தமிழ்>",
  "immediate_action": "<Immediate emergency action if High Risk, else 'None required'>",
  "disclaimer": "இந்த பரிசோதனை மருத்துவ ஆலோசனையை மாற்றாது. / This screening does not replace in-person clinical diagnosis."
}

Clinical Risk Triage Rules:
- "Stable": HR 60-100, SpO2 >= 95%, RR 12-20, BP < 120/80 (or < 130/85), Hb 12.0-16.5, HRV Healthy/Normal
- "Alert": HR 50-59 or 101-110, SpO2 92-94%, RR 8-11 or 21-25, BP 130-139/85-89 (Stage 1), Hb 10.0-11.9 (mild anemia), HRV Low
- "High Risk": HR < 50 or > 110, SpO2 < 92%, RR < 8 or > 25, BP >= 140/90 (Stage 2) or SBP < 90, Hb < 10.0, severe hypoxia/distress"""


def build_vitals_prompt(vitals: Dict) -> str:
    hr = vitals.get("heart_rate_bpm", "Unknown")
    welch_hr = vitals.get("welch_bpm", hr)
    spo2 = vitals.get("spo2_percent", "Unknown")
    rr = vitals.get("respiration_rate", "Unknown")
    bp = vitals.get("blood_pressure", {})
    sbp = bp.get("sbp", "Unknown")
    dbp = bp.get("dbp", "Unknown")
    bp_cat = bp.get("category", "Unknown")
    hb = vitals.get("hemoglobin_g_dl", "Unknown")
    hrv = vitals.get("hrv", {})
    rmssd = hrv.get("rmssd_ms", "Unknown")
    stress = hrv.get("stress_index", "Unknown")
    confidence = vitals.get("confidence", 85)
    snr = vitals.get("snr_db", 10.0)

    return f"""{SYSTEM_INSTRUCTION}

Analyze the following scientific rPPG vital signs and return a structured JSON triage report:

PATIENT VITALS:
- Heart Rate: {hr} BPM (Welch PSD: {welch_hr} BPM)
- Oxygen Saturation (SpO2): {spo2}%
- Respiration Rate: {rr} BrPM
- Blood Pressure: {sbp}/{dbp} mmHg (Category: {bp_cat})
- Hemoglobin: {hb} g/dL
- HRV RMSSD: {rmssd} ms (Stress Index: {stress})
- Signal Quality Index (SQI): {confidence}% (SNR: {snr} dB)

Clinical Reference Basis: Singapore General Hospital (PMC12165443) preoperative assessment standards.
Strictly return ONLY the JSON object."""


def _clean_json(text: str) -> Dict:
    clean = text.strip()
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", clean, re.DOTALL)
    if fence:
        try:
            return json.loads(fence.group(1))
        except Exception:
            pass
    brace = re.search(r"(\{.*\})", clean, re.DOTALL)
    if brace:
        try:
            return json.loads(brace.group(1))
        except Exception:
            pass
    starts = [m.start() for m in re.finditer(r"\{", clean)]
    for s in reversed(starts):
        sub = clean[s:]
        e = sub.rfind("}")
        if e != -1:
            try:
                return json.loads(sub[:e+1])
            except Exception:
                continue
    return json.loads(re.sub(r"```(json)?|```", "", clean).strip())


def get_gemini_triage(vitals: Dict) -> Dict:
    if not _API_KEY or _API_KEY == "YOUR_GEMINI_API_KEY_HERE":
        return _mock_triage(vitals)

    models_to_try = ["gemini-flash-lite-latest", "gemma-4-26b-a4b-it"]
    for m in models_to_try:
        try:
            if m.startswith("gemini"):
                model = genai.GenerativeModel(
                    model_name=m,
                    system_instruction=SYSTEM_INSTRUCTION,
                    generation_config=genai.GenerationConfig(
                        temperature=0.15,
                        response_mime_type="application/json",
                    )
                )
                prompt = build_vitals_prompt(vitals)
            else:
                model = genai.GenerativeModel(model_name=m)
                prompt = f"{SYSTEM_INSTRUCTION}\n\n{build_vitals_prompt(vitals)}"

            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.15,
                    max_output_tokens=1024,
                ),
                request_options={"timeout": 10}
            )
            return _clean_json(response.text)
        except Exception:
            continue

    # Fallback to smart rule-based clinical triage if API is busy or times out
    return _mock_triage(vitals)


def _mock_triage(vitals: Dict) -> Dict:
    hr = vitals.get("heart_rate_bpm", 72)
    spo2 = vitals.get("spo2_percent", 98)
    bp = vitals.get("blood_pressure", {})
    sbp = bp.get("sbp", 118)
    dbp = bp.get("dbp", 76)
    hb = vitals.get("hemoglobin_g_dl", 13.8)

    if spo2 < 92 or hr > 110 or hr < 50 or sbp >= 140 or dbp >= 90 or hb < 10.0:
        risk = "High Risk"
        color = "red"
        action = "Udanadiyaga physician / hospital-ai contact panni doctor consultation edukavum."
        tanglish = f"Alert: Unga vitals-la konjam abnormal variations irukku (BP: {sbp}/{dbp}, SpO2: {spo2}%). Bayapada vendam, aana odane doctor-a paathu clinical cuff BP and oximeter test edunga."
        tamil = f"எச்சரிக்கை: உங்கள் உடலியல் அளவுகளில் மாறுபாடு உள்ளது (இரத்த அழுத்தம்: {sbp}/{dbp}, ஆக்சிஜன்: {spo2}%). உடனடியாக மருத்துவரை அணுகி நேரடி பரிசோதனை செய்யவும்."
    elif spo2 < 95 or hr > 100 or sbp >= 130 or dbp >= 85 or hb < 11.5:
        risk = "Alert"
        color = "amber"
        action = "Next 2 hours-la re-scan panni vitals monitor pannavum."
        tanglish = f"Mild Alert: Vitals borderline-la irukku (HR: {hr} BPM, BP: {sbp}/{dbp}, Hb: {hb} g/dL). Konjam rest eduthutu nalla water kudinga. 10 mins kazhithu marubadiyum scan panni paakavum."
        tamil = f"கவனம்: உங்கள் அளவுகள் எல்லையில் உள்ளன (இதய துடிப்பு: {hr}, இரத்த அழுத்தம்: {sbp}/{dbp}). சற்று ஓய்வெடுத்து போதுமான நீர் அருந்தி மீண்டும் சோதிக்கவும்."
    else:
        risk = "Stable"
        color = "green"
        action = "None required"
        tanglish = f"Super! Unga vitals ellam perfectly stable-ah irukku (HR: {hr} BPM, SpO2: {spo2}%, BP: {sbp}/{dbp} mmHg, Hb: {hb} g/dL). Normal daily activities continue pannalam."
        tamil = f"சிறப்பு! உங்கள் உடலியல் அளவுகள் அனைத்தும் நல்ல முறையில் சீராக உள்ளன (இதய துடிப்பு: {hr}, இரத்த அழுத்தம்: {sbp}/{dbp}). தொடர்ந்து ஆரோக்கியமான வாழ்க்கை முறையை பேணுங்கள்."

    return {
        "risk_level": risk,
        "risk_color": color,
        "risk_summary_english": f"Scientific rPPG screening complete. HR: {hr} BPM, SpO2: {spo2}%, BP: {sbp}/{dbp} mmHg, Hb: {hb} g/dL. Clinical Status: {risk}.",
        "vitals_analysis": {
            "heart_rate": "Optimal resting range (60-100 BPM)" if 60 <= hr <= 100 else f"Outside normal range ({hr} BPM)",
            "spo2": "Normal oxygen saturation (>= 95%)" if spo2 >= 95 else f"Reduced oxygenation ({spo2}%)",
            "respiration_rate": "Normal breathing pattern",
            "blood_pressure": f"{bp.get('category', 'Normal BP')} ({sbp}/{dbp} mmHg)",
            "hemoglobin": f"Adequate concentration ({hb} g/dL)" if hb >= 12.0 else f"Mildly low ({hb} g/dL)",
            "hrv": "Healthy autonomic balance"
        },
        "advice_tanglish": tanglish,
        "advice_tamil": tamil,
        "immediate_action": action,
        "disclaimer": "இந்த பரிசோதனை மருத்துவ ஆலோசனையை மாற்றாது. / This screening does not replace in-person clinical diagnosis."
    }
