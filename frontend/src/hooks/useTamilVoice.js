/**
 * useTamilVoice.js — Advanced Neural Tamil AI Voice Hook
 * ========================================================
 * High-definition neural Tamil TTS using backend Edge-TTS engine:
 *  - Female: 'female' (Dr. Pallavi — warm, caring, authentic Indian Tamil)
 *  - Male:   'male'   (Dr. Valluvar — authoritative, clinical Indian Tamil)
 *  - English: 'english' (Neerja — Indian English)
 *
 * Supports audio cancellation, streaming playback, and fallback to Web Speech API.
 */

import { useCallback, useRef, useState, useEffect } from 'react';

const API_BASE = '/api';

export function useTamilVoice() {
  const [isSpeaking, setIsSpeaking]     = useState(false);
  const [isListening, setIsListening]   = useState(false);
  const [sttTranscript, setSttTranscript] = useState('');
  const [voice, setVoice]               = useState(() => localStorage.getItem('ag_tts_voice') || 'female');
  const [rate, setRate]                 = useState(() => localStorage.getItem('ag_tts_rate') || '+0%');

  const audioRef      = useRef(null);
  const recognizerRef = useRef(null);

  // Sync voice preference to localStorage
  useEffect(() => {
    localStorage.setItem('ag_tts_voice', voice);
  }, [voice]);

  useEffect(() => {
    localStorage.setItem('ag_tts_rate', rate);
  }, [rate]);

  // ── TTS: Speak text via Neural Edge-TTS Backend ────────────────────────────
  const speak = useCallback(async (text, preferredVoice = null, speedRate = null) => {
    if (!text || typeof text !== 'string') return;
    const cleanText = text.trim();
    if (!cleanText) return;

    const activeVoice = preferredVoice || voice || 'female';
    const activeRate  = speedRate || rate || '+0%';

    // Stop any existing playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(true);

    try {
      // Use POST /api/tts for full Unicode stability and long medical summaries
      const response = await fetch(`${API_BASE}/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: cleanText,
          voice: activeVoice,
          rate: activeRate,
        }),
      });

      if (!response.ok) {
        throw new Error(`TTS API returned status ${response.status}`);
      }

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };

      audio.onerror = (e) => {
        console.warn('Audio element error, falling back to browser speech:', e);
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        _browserSpeak(cleanText, () => setIsSpeaking(false));
      };

      await audio.play();
    } catch (err) {
      console.warn('Neural TTS failed, falling back to browser synthesis:', err);
      _browserSpeak(cleanText, () => setIsSpeaking(false));
    }
  }, [voice, rate]);

  // ── Stop Speaking ──────────────────────────────────────────────────────────
  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  // ── STT: Voice Input Recognition (Tamil ta-IN) ─────────────────────────────
  const startListening = useCallback((onResult, lang = 'ta-IN') => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported in this browser');
      return false;
    }

    if (recognizerRef.current) {
      recognizerRef.current.stop();
    }

    const recognizer = new SpeechRecognition();
    recognizer.lang = lang;
    recognizer.continuous = false;
    recognizer.interimResults = true;
    recognizer.maxAlternatives = 1;
    recognizerRef.current = recognizer;

    recognizer.onstart = () => setIsListening(true);

    recognizer.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setSttTranscript(transcript);
      if (event.results[event.results.length - 1].isFinal) {
        onResult(transcript);
      }
    };

    recognizer.onerror = (event) => {
      console.warn('STT error:', event.error);
      setIsListening(false);
    };

    recognizer.onend = () => {
      setIsListening(false);
    };

    recognizer.start();
    return true;
  }, []);

  const stopListening = useCallback(() => {
    if (recognizerRef.current) {
      recognizerRef.current.stop();
    }
    setIsListening(false);
  }, []);

  return {
    speak,
    stopSpeaking,
    isSpeaking,
    voice,
    setVoice,
    rate,
    setRate,
    startListening,
    stopListening,
    isListening,
    sttTranscript,
  };
}

// ── Native Browser TTS Fallback ──────────────────────────────────────────────
function _browserSpeak(text, onEnd) {
  if (!window.speechSynthesis) {
    onEnd();
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  // Detect if Tamil script is present
  const hasTamil = /[\u0B80-\u0BFF]/.test(text);
  utter.lang = hasTamil ? 'ta-IN' : 'en-IN';
  utter.rate = 0.92;
  utter.onend = onEnd;
  utter.onerror = onEnd;
  window.speechSynthesis.speak(utter);
}
