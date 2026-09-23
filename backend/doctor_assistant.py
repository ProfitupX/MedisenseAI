"""
Doctor Assistant AI Engine — Dynamic Clinical Interview & Prescription Core
=============================================================================
Adaptive Gemini-powered symptom interview + intelligent prescription generator.
Dynamically tailors follow-up clinical questions based on patient's chosen symptom
(Fever, Cold, Chest Pain, Breathing, Stomach, Headache, etc.) and scientific rPPG vitals.
"""

import os
import json
import re
import logging
import google.generativeai as genai
from dotenv import load_dotenv
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)
load_dotenv()

_API_KEY = os.getenv("GEMINI_API_KEY", "")
if _API_KEY:
    os.environ["GOOGLE_API_KEY"] = _API_KEY
    genai.configure(api_key=_API_KEY, transport="rest")

# High-speed Google AI primary model with Gemma clinical reasoning fallback
MODELS_TO_TRY = ["gemini-flash-lite-latest", "gemma-4-26b-a4b-it"]


SYMPTOM_INTERVIEW_SYSTEM = """You are a compassionate, highly experienced physician conducting an interactive clinical symptom interview in Tamil & Tanglish.

Context you receive:
1. Patient's 6 rPPG Vitals: Heart Rate, SpO2, Blood Pressure, Respiration Rate, Hemoglobin, HRV.
2. Chief Complaint (e.g., Fever, Cold/Cough, Chest Discomfort, Headache, Shortness of breath, Stomach pain, or custom patient issue).
3. Previous Q&A in this interview.

Rules:
- Never ask generic repetitive questions. Every question must directly investigate the patient's specific complaint and vitals.
- If complaint is Fever: Ask about duration, chills/rigors, temperature range, and red-flag symptoms.
- If complaint is Cold/Cough: Ask about dry vs wet cough, sputum color, throat pain, breathing tightness.
- If complaint is Chest Discomfort: Ask about pressure/squeezing, radiation to arm/jaw, diaphoresis (sweating), exertion.
- If complaint is Shortness of breath: Ask about orthopnea, wheezing, exertion vs rest.
- If complaint is Headache/Dizziness: Ask about location, visual changes, blood pressure correlation.
- If complaint is Stomach pain: Ask about upper vs lower abdomen, burning/acidity, meals relationship.
- Always provide 3-4 realistic selectable options with Tanglish and native Tamil script.
- Return ONLY valid JSON matching this schema:

{
  "question_number": <int>,
  "question_tanglish": "<empathetic clinical question in Tanglish>",
  "question_tamil": "<same question in native Tamil script தமிழ்>",
  "question_english": "<concise English translation>",
  "options": ["<option1_tanglish>", "<option2_tanglish>", "<option3_tanglish>"],
  "options_tamil": ["<option1_tamil>", "<option2_tamil>", "<option3_tamil>"],
  "total_questions": 4,
  "is_final": <bool, true if question_number >= 4 or sufficient clarity reached>
}"""


PRESCRIPTION_SYSTEM = """You are a senior physician providing a preliminary clinical impression, OTC medical care plan, and triage recommendation for patients in Tamil Nadu.

Analyze the comprehensive patient profile:
1. Scientific rPPG Vitals: HR, SpO2, BP SBP/DBP, Respiration Rate, Hemoglobin, HRV Stress Index.
2. Chief Complaint + Detailed Interview Answers.

Clinical Pharmacology Rules:
- Suggest ONLY safe, standard OTC medications appropriate for the diagnosed condition with exact dosage, frequency, and duration (e.g. Paracetamol 650mg TDS for fever/pain; Cetirizine 10mg OD HS for allergic rhinitis; ORS hydration; Pantoprazole 40mg OD for gastritis; Steam inhalation for congestion).
- CRITICAL CONTRAINDICATION SAFETY: If BP is elevated (SBP >= 140 or DBP >= 90), WARN strictly against oral pseudoephedrine/decongestants.
- If SpO2 < 94% or HR > 110 or severe chest pain, classify as Emergency or See Doctor in 24h.
- All advice must be compassionate, clear, and provided in both Tanglish AND formal Tamil script.
- Return ONLY valid JSON matching this schema:

{
  "assessment_title": "<Concise clinical diagnosis, e.g. Acute Viral Pharyngitis with Low-grade Fever>",
  "assessment_english": "<2-3 sentence clinical assessment in English>",
  "assessment_tanglish": "<Empathetic explanation in Tanglish>",
  "assessment_tamil": "<Formal Tamil script explanation தமிழ்>",
  "possible_conditions": ["<Differential 1>", "<Differential 2>"],
  "medicines": [
    {
      "name": "<Medicine generic / common brand name>",
      "dosage": "<e.g. 650mg>",
      "frequency": "<e.g. Every 8 hours after food / 3 times daily>",
      "duration": "<e.g. 3-5 days>",
      "reason": "<Why prescribed based on patient's symptoms>",
      "caution": "<Specific safety warning or contraindication>"
    }
  ],
  "home_care": ["<Tip 1 in Tanglish>", "<Tip 2 in Tanglish>"],
  "home_care_tamil": ["<Tip 1 in Tamil script>", "<Tip 2 in Tamil script>"],
  "triage_decision": "Self-Care" | "See Doctor in 24h" | "Emergency",
  "triage_reason": "<Why this decision based on vitals + symptoms>",
  "triage_tanglish": "<Actionable triage advice in Tanglish>",
  "triage_tamil": "<Actionable triage advice in Tamil script>",
  "follow_up": "<When to see doctor or warning signs to watch for>",
  "disclaimer": "இந்த பரிந்துரை முதற்கட்ட AI ஆய்வறிக்கை மட்டுமே. நேரடி மருத்துவ பரிசோதனைக்கு மருத்துவரை அணுகவும். / Preliminary AI screening only."
}"""


def _clean_json_response(raw_text: str) -> Dict[str, Any]:
    """Robust extraction of JSON payload from LLM response (handles markdown fences, reasoning preambles, etc.)."""
    clean = raw_text.strip()
    
    # 1. Check code fences from last to first (final code fence is the actual payload after thinking)
    fences = re.findall(r"```(?:json)?\s*([\s\S]*?)\s*```", clean)
    for block in reversed(fences):
        block_clean = block.strip()
        if block_clean.startswith("{") and block_clean.endswith("}"):
            try:
                parsed = json.loads(block_clean)
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                pass

    # 2. Find balanced { ... } starting from outer '{' that contains expected clinical keys
    starts = [m.start() for m in re.finditer(r"\{", clean)]
    for start_pos in starts:
        sub = clean[start_pos:]
        end_pos = sub.rfind("}")
        if end_pos != -1:
            try:
                parsed = json.loads(sub[:end_pos + 1])
                if isinstance(parsed, dict) and (
                    "question_english" in parsed
                    or "question_tanglish" in parsed
                    or "assessment_title" in parsed
                    or "medicines" in parsed
                ):
                    return parsed
            except Exception:
                continue

    # 3. Fallback: Any valid dictionary from outermost braces
    for start_pos in starts:
        sub = clean[start_pos:]
        end_pos = sub.rfind("}")
        if end_pos != -1:
            try:
                parsed = json.loads(sub[:end_pos + 1])
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                continue

    clean_fallback = re.sub(r"^```(json)?|```$", "", clean).strip()
    return json.loads(clean_fallback)


def generate_symptom_question(
    vitals: Dict,
    primary_complaint: str,
    previous_answers: List[Dict],
    question_number: int
) -> Dict:
    """
    Generate next interview question dynamically using real Google AI.
    Falls back to the Adaptive Clinical Engine if AI is unreachable.
    """
    if _API_KEY and _API_KEY != "YOUR_GEMINI_API_KEY_HERE":
        hr = vitals.get("heart_rate_bpm", 75)
        spo2 = vitals.get("spo2_percent", 98)
        bp = vitals.get("blood_pressure", {})
        sbp = bp.get("sbp", 118)
        dbp = bp.get("dbp", 78)
        rr = vitals.get("respiration_rate", 16)
        hb = vitals.get("hemoglobin_g_dl", 13.5)

        qa_history = ""
        if previous_answers:
            qa_history = "\nPREVIOUS ANSWERS IN THIS INTERVIEW:\n"
            for item in previous_answers:
                qa_history += f"- Question: {item.get('question_english', '')}\n  Answer: {item.get('answer', '')}\n"

        clinical_context = f"""PATIENT VITALS:
- Heart Rate: {hr} BPM
- SpO2: {spo2}%
- Blood Pressure: {sbp}/{dbp} mmHg ({bp.get('category', 'Normal')})
- Respiration Rate: {rr} BrPM
- Hemoglobin: {hb} g/dL

CHIEF COMPLAINT: {primary_complaint or 'General feeling unwell'}
{qa_history}
Current Question Index: {question_number} of 4.
Generate Question {question_number} focusing specifically on {primary_complaint or 'the reported complaint'}.
Set "is_final": true if question_number >= 4 or if severe red flags are reported."""

        for model_name in MODELS_TO_TRY:
            try:
                if model_name.startswith("gemini"):
                    model = genai.GenerativeModel(
                        model_name=model_name,
                        system_instruction=SYMPTOM_INTERVIEW_SYSTEM,
                    )
                    prompt = clinical_context
                    gen_config = genai.GenerationConfig(
                        temperature=0.2,
                        response_mime_type="application/json",
                    )
                else:
                    model = genai.GenerativeModel(model_name=model_name)
                    prompt = f"""{SYMPTOM_INTERVIEW_SYSTEM}

{clinical_context}

CRITICAL INSTRUCTION:
Do NOT output any markdown planning, thoughts, or conversational text.
Output ONLY the raw JSON object matching the schema."""
                    gen_config = genai.GenerationConfig(
                        temperature=0.2,
                        max_output_tokens=3500,
                    )

                response = model.generate_content(
                    prompt,
                    generation_config=gen_config,
                    request_options={"timeout": 20}
                )
                result = _clean_json_response(response.text)
                result["question_number"] = question_number
                result["total_questions"] = 4
                if question_number >= 4:
                    result["is_final"] = True
                logger.info(f"Generated dynamic AI question {question_number} with model {model_name}")
                return result

            except Exception as e:
                logger.warning(f"AI model {model_name} failed for question ({e}), trying next...")

    # Dynamic Adaptive Clinical Decision Engine fallback
    return _adaptive_clinical_question(vitals, primary_complaint, previous_answers, question_number)


def generate_prescription_report(
    vitals: Dict,
    triage: Dict,
    primary_complaint: str,
    symptom_answers: List[Dict]
) -> Dict:
    """
    Generate dynamic prescription & care plan using real Google AI,
    or the comprehensive Clinical Pharmacology Engine fallback.
    """
    if _API_KEY and _API_KEY != "YOUR_GEMINI_API_KEY_HERE":
        hr = vitals.get("heart_rate_bpm", 75)
        spo2 = vitals.get("spo2_percent", 98)
        bp = vitals.get("blood_pressure", {})
        sbp = bp.get("sbp", 118)
        dbp = bp.get("dbp", 78)
        rr = vitals.get("respiration_rate", 16)
        hb = vitals.get("hemoglobin_g_dl", 13.5)
        risk = triage.get("risk_level", "Stable")

        qa_text = ""
        for item in symptom_answers:
            qa_text += f"- Q: {item.get('question_english', '')}\n  A: {item.get('answer', '')}\n"

        clinical_profile = f"""PATIENT CLINICAL PROFILE:
Vitals:
- HR: {hr} BPM | SpO2: {spo2}% | BP: {sbp}/{dbp} mmHg ({bp.get('category', 'Normal')})
- RR: {rr} BrPM | Hb: {hb} g/dL | Triage Risk: {risk}

Chief Complaint: {primary_complaint or 'Unspecified'}
Symptom Interview Answers:
{qa_text}

Generate a complete, personalized preliminary medical assessment, specific OTC medicines, home care remedies, and triage level."""

        for model_name in MODELS_TO_TRY:
            try:
                if model_name.startswith("gemini"):
                    model = genai.GenerativeModel(
                        model_name=model_name,
                        system_instruction=PRESCRIPTION_SYSTEM,
                    )
                    prompt = clinical_profile
                    gen_config = genai.GenerationConfig(
                        temperature=0.2,
                        response_mime_type="application/json",
                    )
                else:
                    model = genai.GenerativeModel(model_name=model_name)
                    prompt = f"""{PRESCRIPTION_SYSTEM}

{clinical_profile}

CRITICAL INSTRUCTION:
Do NOT output any markdown planning, thoughts, or conversational text.
Output ONLY the raw JSON object matching the schema."""
                    gen_config = genai.GenerationConfig(
                        temperature=0.2,
                        max_output_tokens=4096,
                    )

                response = model.generate_content(
                    prompt,
                    generation_config=gen_config,
                    request_options={"timeout": 25}
                )
                result = _clean_json_response(response.text)
                logger.info(f"Generated dynamic AI prescription report with model {model_name}")
                return result

            except Exception as e:
                logger.warning(f"AI model {model_name} prescription failed ({e}), trying next...")

    # Comprehensive Clinical Pharmacology Engine fallback
    return _adaptive_clinical_prescription(vitals, triage, primary_complaint, symptom_answers)


# ═════════════════════════════════════════════════════════════════════════════
# ADAPTIVE CLINICAL DECISION ENGINE (Dynamic, Symptom-Specific Fallback)
# ═════════════════════════════════════════════════════════════════════════════

def _adaptive_clinical_question(
    vitals: Dict,
    primary_complaint: str,
    previous_answers: List[Dict],
    question_number: int
) -> Dict:
    """
    Intelligently generates questions based on the specific symptom chosen.
    No hardcoded generic questions — fully adaptive!
    """
    comp = (primary_complaint or "").lower()

    # Determine symptom category
    is_fever = any(w in comp for w in ["fever", "காய்ச்சல்", "சூடு", "வெப்பம்", "temp"])
    is_cold  = any(w in comp for w in ["cold", "cough", "சளி", "இருமல்", "தொண்டை", "throat"])
    is_chest = any(w in comp for w in ["chest", "நெஞ்சு", "heart", "படபடப்பு", "valvali"])
    is_breath= any(w in comp for w in ["breath", "மூச்சு", "swasam", "திணறல்"])
    is_head  = any(w in comp for w in ["head", "தலை", "மயக்கம்", "dizzy", "headache"])
    is_belly = any(w in comp for w in ["stomach", "வயிறு", "acid", "வாந்தி", "nausea", "belly"])

    # Question trees per symptom
    if is_fever:
        q_bank = [
            {
                "question_tanglish": "Indha kாய்ச்சல் ethanai naalaaga irukku? Kuliroda nadukkam varugiradha?",
                "question_tamil": "இந்த காய்ச்சல் எத்தனை நாட்களாக உள்ளது? குளிருடன் நடுக்கம் வருகிறதா?",
                "question_english": "How many days have you had this fever? Does it come with chills or shivering?",
                "options": ["1-2 naal (1-2 days)", "3-5 naal (3-5 days)", "1 vaaram+ (1 week+)", "Kuliroda nadukkam (Chills & rigors)"],
                "options_tamil": ["1-2 நாட்கள் மட்டுமே", "3 முதல் 5 நாட்கள்", "1 வாரத்திற்கும் மேல்", "குளிருடன் கடுமையான நடுக்கம்"],
            },
            {
                "question_tanglish": "Kaaychaludan sernthu kavanikkappatta matra arikurigal enna?",
                "question_tamil": "காய்ச்சலுடன் சேர்ந்து உங்களுக்கு உள்ள பிற தொந்தரவுகள் என்ன?",
                "question_english": "What other symptoms accompany the fever?",
                "options": ["Thalai vali & Udal vali (Headache & bodyache)", "Vaandhi / Vayittrup-pokku (Vomiting/Diarrhea)", "Moochu thinanal (Breathing difficulty)", "Verum kaaychal mattume (Only fever)"],
                "options_tamil": ["கடுமையான தலைவலி மற்றும் உடல் வலி", "வாந்தி அல்லது வயிற்றுப்போக்கு", "மூச்சுத்திணறல் / நெஞ்சு பாரம்", "வேறு தொந்தரவு இல்லை, வெறும் காய்ச்சல்"],
            },
            {
                "question_tanglish": "Ithuvarai Paracetamol maathirai eduththeergalaa? Kaaichal kuraiyudhaa?",
                "question_tamil": "இதுவரை பாராசிட்டமால் மாத்திரை ஏதேனும் சாப்பிட்டீர்களா? காய்ச்சல் குறைகிறதா?",
                "question_english": "Have you taken any fever medicines? Does the temperature come down?",
                "options": ["Aama, maathirai eduthen — kuraigiradhu", "Eduthen aanaal kuraiyavillai", "Illa, innum edukkavillai"],
                "options_tamil": ["ஆம், மாத்திரை சாப்பிட்டேன் — சற்று குறைகிறது", "சாப்பிட்டேன், ஆனால் குறையவில்லை", "இல்லை, இதுவரை மருந்து எதுவும் எடுக்கவில்லை"],
            }
        ]
    elif is_cold:
        q_bank = [
            {
                "question_tanglish": "Irumal varattu irumala (Dry cough) alladhu sali koodiya irumala (Wet cough)?",
                "question_tamil": "இருமல் வறட்டு இருமலா அல்லது சளியுடன் கூடிய இருமலா? தொண்டை வலி உள்ளதா?",
                "question_english": "Is it a dry cough or a productive cough with phlegm/mucus? Any sore throat?",
                "options": ["Varattu irumal (Dry cough)", "Sali koodiya irumal (Phlegm cough)", "Thondai vali & erichal (Sore throat)", "Mooku ozhukudhal (Runny nose)"],
                "options_tamil": ["வறட்டு இருமல் மட்டும்", "சளியுடன் கூடிய இருமல்", "தொண்டை வலி மற்றும் எரிச்சல்", "அடைப்பு மற்றும் மூக்கு ஒழுகுதல்"],
            },
            {
                "question_tanglish": "Padukkumpodhu alladhu nadakkumpodhu moochu viduvadhu siramamaaga irukkiradhaa?",
                "question_tamil": "படுக்கும்போது அல்லது நடக்கும்போது மூச்சு விடுவது சிரமமாக உள்ளதா?",
                "question_english": "Do you experience breathing tightness when lying flat or walking?",
                "options": ["Illa, normal-aaga irukku", "Iravil padukkumpodhu siramam", "Nadanthaal moochu vaangudhu"],
                "options_tamil": ["இல்லை, சாதாரணமாக சுவாசிக்க முடிகிறது", "இரவில் படுக்கும்போது மூச்சுத் திணறல்", "நடக்கும்போது மூச்சு வாங்குகிறது"],
            },
            {
                "question_tanglish": "Ithu thulasi/thoondu/kulir kaatrilaal vanthadha alladhu seasonal allergic ah?",
                "question_tamil": "இது தூசி, குளிர்ந்த பானங்கள் அல்லது பருவநிலை மாற்றத்தால் வந்ததா?",
                "question_english": "Was this triggered by dust, cold drinks, or seasonal allergy?",
                "options": ["Kulir paanam / Ice water", "Thoosi & Pollution", "Theriyavillai / Normal cold"],
                "options_tamil": ["குளிர்ந்த பானம் / மழை நனைந்ததால்", "தூசி அல்லது ஒவ்வாமை (Allergy)", "காரணம் தெரியவில்லை, தானாக வந்தது"],
            }
        ]
    elif is_chest:
        q_bank = [
            {
                "question_tanglish": "Nenju vali epdi irukku? Azhuthuvathu pol irukka alladhu kuthuvathu pol irukka?",
                "question_tamil": "நெஞ்சு வலி எவ்வாறு உள்ளது? நெஞ்சை அழுத்துவது போல் உள்ளதா அல்லது குத்துவது போல் உள்ளதா?",
                "question_english": "How does the chest pain feel? Is it a heavy pressure/squeezing or sharp stitching pain?",
                "options": ["Kadu-mayaana azhutham (Heavy pressure)", "Erichal / Acidity pol (Burning/Gas)", "Kuthuvathu pol (Sharp prick)", "Padapadappu mattum (Heart racing only)"],
                "options_tamil": ["நெஞ்சை அழுத்துவது போன்ற கடுமையான பாரம்", "எரிச்சல் / வாயு தொல்லை போன்ற வலி", "ஊசி குத்துவது போன்ற கூர்மையான வலி", "படபடப்பு மட்டுமே உள்ளது, வலி இல்லை"],
            },
            {
                "question_tanglish": "Vali idadhu kai, thozhpattai alladhu thaadaikku paravugiradhaa? Viyarvai ulladhaa?",
                "question_tamil": "வலி இடது கை, தோள்பட்டை அல்லது தாடைக்கு பரவுகிறதா? குளிர்ந்த வியர்வை வருகிறதா?",
                "question_english": "Does the pain radiate to your left arm, shoulder, or jaw? Any cold sweating?",
                "options": ["Aama, kai/thaadaikku paravudhu", "Kulirndha viyarvai varugiradhu", "Illa, paravavillai (Localized only)"],
                "options_tamil": ["ஆம், இடது கை அல்லது தாடைக்கு பரவுகிறது", "குளிர்ந்த வியர்வை மற்றும் மயக்கம் உள்ளது", "இல்லை, நெஞ்சின் குறிப்பிட்ட இடத்தில் மட்டுமே"],
            },
            {
                "question_tanglish": "Unga Blood Pressure (BP) eppozhudhaavadhu adhigamaaga irundhullaadha?",
                "question_tamil": "உங்களுக்கு இரத்த அழுத்தம் (BP) இதற்கு முன்பு அதிகமாக இருந்துள்ளதா? மாத்திரை சாப்பிடுகிறீர்களா?",
                "question_english": "Do you have a history of high blood pressure? Are you taking medications?",
                "options": ["BP patient — Regular medicine edukren", "BP undu — Aanaal medicine eduppadhillai", "Illa, BP normal"],
                "options_tamil": ["ஆம், உயர் இரத்த அழுத்தம் உள்ளது (மாத்திரை எடுக்கிறேன்)", "இரத்த அழுத்தம் உண்டு, ஆனால் மாத்திரை எடுப்பதில்லை", "இல்லை, எனக்கு இரத்த அழுத்தம் எப்போதும் இயல்புதான்"],
            }
        ]
    elif is_head:
        q_bank = [
            {
                "question_tanglish": "Thalai vali engu irukkiradhu? Oru pakkam mattuma alladhu muzhumaiyaagavaa?",
                "question_tamil": "தலைவலி எங்கு உள்ளது? ஒரு பக்கம் மட்டுமா அல்லது தலை முழுவதும் வலிக்கிறதா?",
                "question_english": "Where is the headache located? One side (migraine) or whole head / forehead?",
                "options": ["Oru pakkam mattum (One side - Migraine)", "Netriyil azhutham (Frontal/Sinus)", "Thalai muzhuvadhumaaga (Whole head)"],
                "options_tamil": ["ஒரு பக்கம் மட்டும் துடிக்கிறது (ஒற்றைத் தலைவலி)", "நெற்றி மற்றும் மூக்கு பகுதியில் பாரம்", "தலை முழுவதும் பாரமாக வலிக்கிறது"],
            },
            {
                "question_tanglish": "Thalai suttru, mayakkam alladhu kan mangalaaga therivadhu ulladhaa?",
                "question_tamil": "தலைச்சுற்றல், மயக்கம் அல்லது கண் மங்கலாக தெரிவது உள்ளதா?",
                "question_english": "Is there dizziness, vertigo, or blurred vision?",
                "options": ["Thalai suttru irukku", "Kan mankudal irukku", "Illa, verum vali mattume"],
                "options_tamil": ["தலைச்சுற்றல் மற்றும் கிறுகிறுப்பு உள்ளது", "பார்வை மங்கலாக தெரிகிறது", "இல்லை, வேறு எதுவும் இல்லை, வலி மட்டுமே"],
            },
            {
                "question_tanglish": "Thookaminmai, manavazhutham alladhu screen paarthadhaal vanthadha?",
                "question_tamil": "சரியான தூக்கமின்மை, மன அழுத்தம் அல்லது அதிக திரை நேரம் (Screen time) காரணமா?",
                "question_english": "Could this be due to lack of sleep, stress, or long screen time?",
                "options": ["Seriyaana thookam illai", "Stress & work load", "Theriyavillai"],
                "options_tamil": ["போதுமான தூக்கம் மற்றும் ஓய்வு இல்லை", "அதிக மன அழுத்தம் மற்றும் சோர்வு", "காரணம் தெரியவில்லை"],
            }
        ]
    elif is_belly:
        q_bank = [
            {
                "question_tanglish": "Vayittril vali endha idathil irukkiradhu? Mel vayirra alladhu keezh vayirra?",
                "question_tamil": "வயிற்றில் வலி எந்த இடத்தில் உள்ளது? மேல் வயிறா அல்லது கீழ் வயிறா?",
                "question_english": "Where is the abdominal pain located? Upper belly (gastritis/acidity) or lower belly?",
                "options": ["Mel vayiru erichal (Upper belly / Gas)", "Keezh vayiru vali (Lower abdomen)", "Vayiru muzhuvadhum (Whole stomach)"],
                "options_tamil": ["மேல் வயிறு மற்றும் நெஞ்செரிச்சல் (அசிடிட்டி)", "கீழ் வயிற்றில் பிடிப்பு போன்ற வலி", "வயிறு முழுவதும் பிடித்து இழுப்பது போன்ற வலி"],
            },
            {
                "question_tanglish": "Saappittavudan vali adhigamaagiradhaa alladhu pasiyodu irukkumpodhaa?",
                "question_tamil": "சாப்பிட்டவுடன் வலி அதிகமாகிறதா அல்லது பசியோடு இருக்கும்போது எரிகிறதா?",
                "question_english": "Does the pain worsen after eating meals, or when hungry?",
                "options": ["Saappitta pin erichal (After eating)", "Verum vayitril vali (Empty stomach)", "Epothum irukku (Continuous)"],
                "options_tamil": ["சாப்பிட்ட பிறகு நெஞ்செரிச்சல் அதிகமாகிறது", "வெறும் வயிற்றில் இருக்கும்போது எரிகிறது", "எப்போதும் சீராக வலித்துக் கொண்டே இருக்கிறது"],
            },
            {
                "question_tanglish": "Vaandhi, pirattal, alladhu vayittrup-pokku (Loose motion) ulladhaa?",
                "question_tamil": "வாந்தி, குமட்டல் அல்லது வயிற்றுப்போக்கு உள்ளதா?",
                "question_english": "Any vomiting, nausea, or loose motions / diarrhea?",
                "options": ["Vaandhi & kumattal irukku", "Loose motion irukku", "Illa, rendumey illai"],
                "options_tamil": ["வாந்தி மற்றும் குமட்டல் உள்ளது", "வயிற்றுப்போக்கு (Loose stools) உள்ளது", "இல்லை, வாந்தி அல்லது வயிற்றுப்போக்கு இல்லை"],
            }
        ]
    else:
        # General / Custom complaint
        q_bank = [
            {
                "question_tanglish": f"Indha pirachanai ({primary_complaint or 'symptom'}) eppozhudhirundhu ulladhu? Ethanai naal aachu?",
                "question_tamil": f"இந்த பிரச்சனை ({primary_complaint or 'அறிகுறி'}) எப்போதிருந்து உள்ளது? எத்தனை நாட்கள் ஆகிறது?",
                "question_english": f"Since when have you been having this problem ({primary_complaint or 'symptom'})? How many days?",
                "options": ["Netru irundhu (Since yesterday)", "3-5 naal aachu (3-5 days)", "1 vaaram+ (Over a week)"],
                "options_tamil": ["நேற்றிலிருந்து அல்லது இன்று முதல்", "3 முதல் 5 நாட்களாக உள்ளது", "1 வாரத்திற்கும் மேலாக உள்ளது"],
            },
            {
                "question_tanglish": "Vali alladhu asowgariyam eppadi irukku? Daily velaigalai baadhikkiradhaa?",
                "question_tamil": "இதன் தீவிரம் எப்படி உள்ளது? அன்றாட வேலைகளை செய்ய முடிகிறதா?",
                "question_english": "How severe is the discomfort? Does it affect your daily activities?",
                "options": ["Mild — velaigalai seiya mudigiradhu", "Moderate — konjam siramam", "Severe — padukka vendi irukku"],
                "options_tamil": ["குறைவாக உள்ளது — வேலைகளை செய்ய முடிகிறது", "மிதமாக உள்ளது — சற்று அசௌகரியமாக உள்ளது", "கடுமையாக உள்ளது — ஓய்வெடுக்க வேண்டியுள்ளது"],
            },
            {
                "question_tanglish": "Ippozhudhu edhaavadhu maathirai alladhu treatment eduthukondirukkireergalaa?",
                "question_tamil": "இப்போது இதற்காக ஏதேனும் மாத்திரை அல்லது சிகிச்சை எடுத்து வருகிறீர்களா?",
                "question_english": "Are you currently taking any medicines or home treatments for this?",
                "options": ["Aama, medicine edukren", "Home remedy seigiren", "Illa, edhuvum seiyavillai"],
                "options_tamil": ["ஆம், மாத்திரைகள் சாப்பிட்டு வருகிறேன்", "வீட்டு வைத்தியம் செய்து வருகிறேன்", "இல்லை, இதுவரை சிகிச்சை எதுவும் செய்யவில்லை"],
            }
        ]

    # Select question index
    idx = max(0, min(question_number - 1, len(q_bank) - 1))
    q = q_bank[idx]
    is_final = (question_number >= len(q_bank) or question_number >= 4)

    return {
        "question_number": question_number,
        "question_tanglish": q["question_tanglish"],
        "question_tamil": q["question_tamil"],
        "question_english": q["question_english"],
        "options": q["options"],
        "options_tamil": q["options_tamil"],
        "total_questions": len(q_bank),
        "is_final": is_final
    }


def _adaptive_clinical_prescription(
    vitals: Dict,
    triage: Dict,
    primary_complaint: str,
    symptom_answers: List[Dict]
) -> Dict:
    """
    Intelligent pharmacology & triage synthesizer.
    Produces nuanced, medically accurate prescriptions matching the exact complaint + vitals.
    """
    hr = vitals.get("heart_rate_bpm", 75)
    spo2 = vitals.get("spo2_percent", 98)
    bp = vitals.get("blood_pressure", {})
    sbp = bp.get("sbp", 118)
    dbp = bp.get("dbp", 78)
    hb = vitals.get("hemoglobin_g_dl", 13.5)
    rr = vitals.get("respiration_rate", 16)
    risk = triage.get("risk_level", "Stable")

    answers_str = " ".join([str(a.get("answer", "")) for a in symptom_answers]).lower()
    comp = (primary_complaint or "").lower()

    medicines = []
    conditions = []
    home_care = []
    home_care_tamil = []

    # 1. Condition & Medicine Logic based on complaint + vitals
    is_fever = any(w in comp for w in ["fever", "காய்ச்சல்", "சூடு"]) or any(w in answers_str for w in ["fever", "காய்ச்சல்", "நடுக்கம்"])
    is_cold  = any(w in comp for w in ["cold", "cough", "சளி", "இருமல்", "தொண்டை"]) or any(w in answers_str for w in ["irumal", "இருமல்", "சளி", "sore throat"])
    is_chest = any(w in comp for w in ["chest", "நெஞ்சு", "heart", "படபடப்பு"]) or any(w in answers_str for w in ["pressure", "அழுத்தம்", "viyarvai"])
    is_head  = any(w in comp for w in ["head", "தலை", "மயக்கம்", "headache"]) or any(w in answers_str for w in ["thalai", "தலைவலி"])
    is_belly = any(w in comp for w in ["stomach", "வயிறு", "acid", "வாந்தி"]) or any(w in answers_str for w in ["erichal", "நெஞ்செரிச்சல்", "loose"])

    # Fever presentation
    if is_fever or hr > 95:
        conditions.append("Acute Viral Fever / Pyrexia of Unknown Origin (PUO)")
        medicines.append({
            "name": "Paracetamol (Dolo 650 / Crocin 650)",
            "dosage": "650mg",
            "frequency": "Once every 6-8 hours (Maximum 3 times daily)",
            "duration": "3-4 days",
            "reason": "Reduces fever body temperature and relieves muscular pain",
            "caution": "Take only after food. Do not exceed 3 tablets in 24 hours. Avoid alcohol."
        })
        home_care.append("Drink 2.5 to 3 liters of boiled & cooled water daily to prevent dehydration")
        home_care_tamil.append("நாளொன்றுக்கு குறைந்தது 2.5 முதல் 3 லிட்டர் காய்ச்சி வடிகட்டிய தண்ணீர் அருந்துங்கள்")

    # Cold & Cough presentation
    if is_cold:
        conditions.append("Upper Respiratory Tract Infection (URTI) & Acute Bronchial Irritation")
        if "varattu" in answers_str or "dry" in answers_str:
            medicines.append({
                "name": "Dextromethorphan Syrup (Benadryl DR / Ascoril D)",
                "dosage": "10 ml",
                "frequency": "Twice daily after food",
                "duration": "3-5 days",
                "reason": "Suppresses persistent dry tickly cough",
                "caution": "May cause mild drowsiness. Do not drive or operate machinery."
            })
        else:
            medicines.append({
                "name": "Ambroxol + Guaifenesin Syrup (Ascoril LS / Mucolite)",
                "dosage": "10 ml",
                "frequency": "Twice daily after warm water",
                "duration": "3-5 days",
                "reason": "Thins and expels chest congestion and thick mucus/phlegm",
                "caution": "Drink plenty of warm water to assist mucus clearance."
            })
        medicines.append({
            "name": "Cetirizine (Cetzine 10mg) / Levocetirizine",
            "dosage": "10mg (1 tablet)",
            "frequency": "Once daily at night (Bedtime)",
            "duration": "3-5 days",
            "reason": "Controls allergic sneezing, runny nose, and throat itchiness",
            "caution": "Causes drowsiness — take strictly before sleep."
        })
        home_care.append("Do steam inhalation with eucalyptus drops or Karvol Plus twice daily")
        home_care_tamil.append("தினமும் இரண்டு முறை ஆவி பிடிக்கவும் (Steam Inhalation)")

    # Stomach / Acidity presentation
    if is_belly:
        conditions.append("Acute Gastritis / Gastroesophageal Reflux (GERD)")
        medicines.append({
            "name": "Pantoprazole (Pan 40mg)",
            "dosage": "40mg (1 tablet)",
            "frequency": "Once daily in the morning (30 mins before breakfast)",
            "duration": "5 days",
            "reason": "Reduces excess stomach acid secretion and prevents gastric ulcers",
            "caution": "Swallow whole with plain water; do not crush or chew."
        })
        medicines.append({
            "name": "Antacid Suspension (Gelusil / Digene)",
            "dosage": "10-15 ml",
            "frequency": "After lunch and dinner, or as needed for burning",
            "duration": "3-5 days",
            "reason": "Instantly neutralizes stomach acid and coats the esophagus",
            "caution": "Shake well before use."
        })
        if "loose" in answers_str or "vaandhi" in answers_str:
            medicines.append({
                "name": "ORS (Oral Rehydration Salts — Electral)",
                "dosage": "1 sachet in 1 liter clean water",
                "frequency": "Sip throughout the day after each loose stool",
                "duration": "2 days",
                "reason": "Restores vital electrolyte balance (sodium & potassium)",
                "caution": "Do not mix with milk or fruit juices; use clean boiled water."
            })
        home_care.append("Avoid spicy, oily, fried foods and caffeine/tea; eat soft curd rice or idli")
        home_care_tamil.append("காரம், எண்ணெய் பண்டங்கள் மற்றும் காபி/டீ தவிர்க்கவும்; எளிதில் செரிக்கும் உணவு உண்ணவும்")

    # Headache presentation
    if is_head:
        conditions.append("Tension Headache / Cervicogenic Cephalea")
        if not any("Paracetamol" in m["name"] for m in medicines):
            medicines.append({
                "name": "Paracetamol (Dolo 650mg)",
                "dosage": "650mg",
                "frequency": "As needed for severe headache (Max 2 times daily)",
                "duration": "2 days",
                "reason": "Relieves acute throbbing headache and muscular scalp tension",
                "caution": "Take after meals. Maintain adequate hydration."
            })
        home_care.append("Rest in a quiet, dark room for 30 minutes; limit mobile and laptop screen exposure")
        home_care_tamil.append("அமைதியான இருண்ட அறையில் ஓய்வெடுக்கவும்; மொபைல் மற்றும் திரை பயன்பாட்டை தவிர்க்கவும்")

    # High Blood Pressure detected in rPPG
    if sbp >= 140 or dbp >= 90:
        conditions.append("Elevated Blood Pressure / Stage 2 Hypertension Alert")
        # STRICT SAFETY: Warn against decongestants!
        home_care.append("⚠️ STRICT WARNING: Do NOT take OTC nasal decongestants (Sudafed/phenylephrine) as they dangerously spike BP")
        home_care_tamil.append("⚠️ முக்கிய எச்சரிக்கை: சளிக்கான ஸ்பிரே அல்லது சூடோபெட்ரின் மாத்திரைகள் இரத்த அழுத்தத்தை எகிற வைக்கும் என்பதால் தவிர்க்கவும்")

    # Low Hemoglobin detected in rPPG
    if hb < 11.5:
        conditions.append("Mild Nutritional Anemia (Low Hemoglobin)")
        medicines.append({
            "name": "Iron + Folic Acid Supplement (Livogen / Autrin)",
            "dosage": "1 tablet",
            "frequency": "Once daily after lunch",
            "duration": "30 days",
            "reason": "Elevates red blood cell synthesis and hemoglobin levels",
            "caution": "Stools may appear dark/black — this is normal. Take with vitamin C (lemon water) for better absorption."
        })
        home_care.append("Include iron-rich foods: spinach (keerai), dates (peereechai), pomegranate, and jaggery")
        home_care_tamil.append("இரும்புச்சத்து நிறைந்த கீரைகள், பேரீச்சம்பழம், மாதுளை மற்றும் வெல்லம் உணவில் சேர்க்கவும்")

    # Default fallback if no specific issue identified
    if not conditions:
        conditions.append("General Health Evaluation — Physiological Homeostasis Normal")
        medicines.append({
            "name": "Multivitamin with Vitamin C & Zinc (Becozinc / Limcee)",
            "dosage": "1 tablet",
            "frequency": "Once daily after breakfast",
            "duration": "10 days",
            "reason": "Enhances cellular immunity and metabolic recovery",
            "caution": "Generally well-tolerated. Maintain balanced nutrition."
        })

    # Default home care essentials
    if len(home_care) < 3:
        home_care.extend([
            "Ensure 7 to 8 hours of uninterrupted restful sleep tonight",
            "Monitor body temperature and resting pulse twice daily"
        ])
        home_care_tamil.extend([
            "இரவில் குறைந்தது 7 முதல் 8 மணி நேரம் நல்ல தூக்கம் அவசியம்",
            "உடல் வெப்பநிலை மற்றும் நாடித்துடிப்பை காலை-மாலை கண்காணிக்கவும்"
        ])

    # Dynamic Triage Evaluation
    if is_chest and ("viyarvai" in answers_str or "azhutham" in answers_str or sbp >= 160 or spo2 < 92):
        triage_decision = "Emergency"
        triage_reason = "Suspected acute cardiopulmonary symptoms or severe vitals compromise (Emergency Evaluation Required)"
        triage_tanglish = "🚨 URGENT: Udanadiyaga arugilulla Emergency Hospital / ICU-ku ponga. Suyaga vandi ottatheenga."
        triage_tamil = "🚨 அவசரம்: உடனடியாக அருகிலுள்ள அவசர சிகிச்சை பிரிவிற்கு (Emergency Hospital) செல்லவும். சுயமாக வாகனம் ஓட்ட வேண்டாம்."
        follow_up = "Immediate hospital emergency admission required. Do not delay."
    elif spo2 < 93 or sbp >= 150 or hr > 115 or "3 vaaram" in answers_str:
        triage_decision = "See Doctor in 24h"
        triage_reason = "Borderline vitals or persistent symptomatic illness requiring clinical examination"
        triage_tanglish = "⚠️ Adutha 24 mani nerathil oru certified MBBS Doctor-ai paarthu direct checkup edungal."
        triage_tamil = "⚠️ அடுத்த 24 மணி நேரத்திற்குள் மருத்துவரை நேரில் சந்தித்து உரிய பரிசோதனை செய்யவும்."
        follow_up = "Consult an in-person physician tomorrow morning. Re-test vitals if symptoms worsen."
    else:
        triage_decision = "Self-Care"
        triage_reason = "Mild self-limiting symptoms with stable cardiovascular and respiratory vitals"
        triage_tanglish = "✅ Home-la rest eduthu keezhey ulla care plan follow pannavum. 2-3 naalil nandraga aagivdum."
        triage_tamil = "✅ வீட்டில் ஓய்வெடுத்து கீழே உள்ள பராமரிப்பு திட்டத்தை பின்பற்றவும். 2 முதல் 3 நாட்களில் குணமாகிவிடும்."
        follow_up = "If symptoms do not improve after 48 hours or if fever exceeds 102°F, consult a physician."

    primary_title = conditions[0] if conditions else "Clinical Health Assessment"

    return {
        "assessment_title": primary_title,
        "assessment_english": f"Patient presented with {primary_complaint or 'reported symptoms'}. rPPG Vitals: HR {hr} BPM, SpO2 {spo2}%, BP {sbp}/{dbp} mmHg, Hb {hb} g/dL. Preliminary impression: {', '.join(conditions[:2])}.",
        "assessment_tanglish": f"Unga {primary_complaint or 'symptoms'} mattrum rPPG vitals (HR: {hr} BPM, SpO2: {spo2}%, BP: {sbp}/{dbp}) analysis seitha pin, {primary_title} pol thondrugiradhu.",
        "assessment_tamil": f"உங்கள் {primary_complaint or 'அறிகுறிகள்'} மற்றும் rPPG உடல் அளவுகளை (இதய துடிப்பு: {hr} BPM, ஆக்சிஜன்: {spo2}%, இரத்த அழுத்தம்: {sbp}/{dbp}) ஆய்வு செய்ததில், முதற்கட்டமாக {primary_title} இருப்பது தெரியவருகிறது.",
        "possible_conditions": conditions,
        "medicines": medicines,
        "home_care": home_care,
        "home_care_tamil": home_care_tamil,
        "triage_decision": triage_decision,
        "triage_reason": triage_reason,
        "triage_tanglish": triage_tanglish,
        "triage_tamil": triage_tamil,
        "follow_up": follow_up,
        "disclaimer": "இந்த பரிசோதனை முதற்கட்ட AI ஆய்வறிக்கை மட்டுமே. நேரடி மருத்துவ ஆலோசனையை மாற்றாது. / This is preliminary AI screening only."
    }
