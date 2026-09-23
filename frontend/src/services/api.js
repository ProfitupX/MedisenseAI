/**
 * api.js — Backend API service layer
 */

const BASE_URL = '/api';   // proxied to http://localhost:8000 via Vite

/**
 * Send RGB frame buffer to FastAPI for rPPG analysis + Gemini triage.
 * @param {Array<{r,g,b,timestamp}>} frames
 * @param {number} fps
 * @returns {Promise<{vitals, triage, scan_quality, message}>}
 */
export async function analyzeVitals(frames, fps = 30) {
  const response = await fetch(`${BASE_URL}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      frames: frames.map(({ r, g, b, timestamp }) => ({ r, g, b, timestamp })),
      fps,
      roi_source: 'forehead+cheeks',
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Check backend health.
 */
export async function checkBackendStatus() {
  const res = await fetch(`${BASE_URL}/status`);
  return res.ok;
}
