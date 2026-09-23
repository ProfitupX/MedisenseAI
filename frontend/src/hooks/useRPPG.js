/**
 * useRPPG.js — Custom React hook orchestrating the full rPPG pipeline.
 *
 * Manages:
 * - 30-second frame collection timer
 * - RGB buffer accumulation
 * - POST to /api/analyze
 * - State transitions: idle → scanning → analyzing → results
 */

import { useState, useRef, useCallback } from 'react';
import { analyzeVitals } from '../services/api';

export const SCAN_DURATION_SECONDS = 30;
export const TARGET_FPS = 30;
export const TOTAL_FRAMES = SCAN_DURATION_SECONDS * TARGET_FPS;

export function useRPPG() {
  const [phase, setPhase]         = useState('idle');      // idle | scanning | analyzing | results | error
  const [progress, setProgress]   = useState(0);           // 0-100
  const [timeLeft, setTimeLeft]   = useState(SCAN_DURATION_SECONDS);
  const [vitals, setVitals]       = useState(null);
  const [triage, setTriage]       = useState(null);
  const [scanQuality, setScanQuality] = useState('');
  const [error, setError]         = useState(null);
  const [waveBuffer, setWaveBuffer] = useState([]);        // live wave preview

  const frameBufferRef = useRef([]);  // accumulated RGB frames
  const intervalRef    = useRef(null);
  const startTimeRef   = useRef(null);

  /**
   * Called by FaceCapture every frame with mean ROI RGB values.
   */
  const pushFrame = useCallback(({ r, g, b }) => {
    if (phase !== 'scanning') return;

    const now = performance.now();
    frameBufferRef.current.push({ r, g, b, timestamp: now });

    // Update live waveform preview (green channel normalized to -1..1)
    setWaveBuffer(prev => {
      const next = [...prev, (g - 128) / 128];
      return next.slice(-200);
    });

    // Update progress
    const elapsed  = (now - startTimeRef.current) / 1000;
    const pct      = Math.min(100, (elapsed / SCAN_DURATION_SECONDS) * 100);
    const remaining = Math.max(0, SCAN_DURATION_SECONDS - Math.floor(elapsed));
    setProgress(pct);
    setTimeLeft(remaining);

    // Auto-complete at 30 seconds
    if (elapsed >= SCAN_DURATION_SECONDS) {
      stopScan();
    }
  }, [phase]);

  const startScan = useCallback(() => {
    frameBufferRef.current = [];
    startTimeRef.current = performance.now();
    setPhase('scanning');
    setProgress(0);
    setTimeLeft(SCAN_DURATION_SECONDS);
    setWaveBuffer([]);
    setError(null);
    setVitals(null);
    setTriage(null);
  }, []);

  const stopScan = useCallback(async () => {
    if (phase !== 'scanning' && phase !== 'idle') return;

    const frames = frameBufferRef.current;
    if (frames.length < TARGET_FPS * 5) {
      setError('Not enough frames captured. Please ensure your face is visible and try again.');
      setPhase('error');
      return;
    }

    setPhase('analyzing');
    setProgress(100);

    try {
      const result = await analyzeVitals(frames, TARGET_FPS);
      setVitals(result.vitals);
      setTriage(result.triage);
      setScanQuality(result.scan_quality);
      setPhase('results');
    } catch (err) {
      setError(err.message || 'Analysis failed. Please try again.');
      setPhase('error');
    }
  }, [phase]);

  const reset = useCallback(() => {
    frameBufferRef.current = [];
    setPhase('idle');
    setProgress(0);
    setTimeLeft(SCAN_DURATION_SECONDS);
    setVitals(null);
    setTriage(null);
    setScanQuality('');
    setError(null);
    setWaveBuffer([]);
  }, []);

  return {
    phase, progress, timeLeft, vitals, triage, scanQuality, error, waveBuffer,
    pushFrame, startScan, stopScan, reset,
    frameCount: frameBufferRef.current?.length ?? 0,
  };
}
