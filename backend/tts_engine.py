"""
tts_engine.py — Advanced Neural Tamil TTS Engine
==================================================
Uses Microsoft Azure Neural TTS (via edge-tts) for ultra-realistic,
human-like Tamil speech synthesis with zero cost and no API keys required.

Voices:
  - ta-IN-PallaviNeural: Female, warm & caring (Dr./Nurse Pallavi)
  - ta-IN-ValluvarNeural: Male, clear & clinical (Dr. Valluvar)
  - en-IN-NeerjaNeural: Indian English Female

Fallback:
  - gTTS (Google Text-to-Speech) if Edge-TTS connection is unavailable.
"""

import io
import re
import hashlib
import logging
import asyncio
from typing import Optional, Dict

logger = logging.getLogger(__name__)

# Predefined high-quality neural voices
VOICES: Dict[str, str] = {
    "female": "ta-IN-PallaviNeural",
    "male": "ta-IN-ValluvarNeural",
    "pallavi": "ta-IN-PallaviNeural",
    "valluvar": "ta-IN-ValluvarNeural",
    "english": "en-IN-NeerjaNeural",
}

DEFAULT_TAMIL_VOICE = "ta-IN-PallaviNeural"

# In-memory LRU cache to instantly return audio for frequent phrases
_AUDIO_CACHE: Dict[str, bytes] = {}
_MAX_CACHE_ITEMS = 128


def _get_cache_key(text: str, voice: str, rate: str) -> str:
    key_str = f"{voice}:{rate}:{text.strip()}"
    return hashlib.md5(key_str.encode("utf-8")).hexdigest()


def contains_tamil_script(text: str) -> bool:
    """Checks if text contains native Tamil script characters (U+0B80 to U+0BFF)."""
    return bool(re.search(r"[\u0B80-\u0BFF]", text))


async def generate_neural_speech(
    text: str,
    voice: Optional[str] = None,
    rate: str = "+0%",
    volume: str = "+0%"
) -> bytes:
    """
    Synthesize text using Microsoft Edge Neural TTS.
    Returns MP3 bytes.
    """
    clean_text = text.strip()
    if not clean_text:
        return b""

    # Resolve voice name
    selected_voice = DEFAULT_TAMIL_VOICE
    if voice:
        voice_lower = voice.lower()
        if voice_lower in VOICES:
            selected_voice = VOICES[voice_lower]
        elif voice.startswith("ta-") or voice.startswith("en-"):
            selected_voice = voice

    cache_key = _get_cache_key(clean_text, selected_voice, rate)
    if cache_key in _AUDIO_CACHE:
        return _AUDIO_CACHE[cache_key]

    # Try Edge-TTS first (Studio-grade Azure Neural Voice)
    try:
        import edge_tts

        communicate = edge_tts.Communicate(clean_text, selected_voice, rate=rate, volume=volume)
        audio_buffer = bytearray()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_buffer.extend(chunk["data"])

        mp3_bytes = bytes(audio_buffer)
        if len(mp3_bytes) > 0:
            if len(_AUDIO_CACHE) >= _MAX_CACHE_ITEMS:
                # Remove oldest item
                _AUDIO_CACHE.pop(next(iter(_AUDIO_CACHE)))
            _AUDIO_CACHE[cache_key] = mp3_bytes
            return mp3_bytes

    except Exception as e:
        logger.warning(f"Edge-TTS failed ({e}), falling back to gTTS...")

    # Fallback to gTTS if Edge-TTS fails
    try:
        from gtts import gTTS

        lang = "ta" if contains_tamil_script(clean_text) else "en"
        tts = gTTS(text=clean_text, lang=lang, slow=False)
        out_buf = io.BytesIO()
        tts.write_to_fp(out_buf)
        return out_buf.getvalue()
    except Exception as fallback_err:
        logger.error(f"Fallback gTTS also failed: {fallback_err}")
        raise RuntimeError(f"All TTS synthesis engines failed: {fallback_err}")
