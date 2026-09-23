/**
 * FaceCapture.jsx — High-Precision Medical Facial ROI Capture
 * ==============================================================
 * Optimized for Laptop Webcams & Mobile Devices with Portrait & Landscape Modes.
 *
 * Key Capabilities:
 * - Default Portrait Size (3:4 — 480×640) for focused clinical facial analysis
 * - One-click Portrait / Landscape Mode Switcher (📱 3:4 Portrait / 💻 4:3 Landscape)
 * - True Aspect-Ratio Center-Cropping: Zero facial distortion or stretching on laptop webcams
 * - Device Enumeration: Select between Integrated Webcam, USB Camera, etc.
 * - Front / Rear camera toggle for mobile devices
 * - Anatomical Oval Alignment Guide with real-time distance and centering feedback (Tanglish/English)
 * - Precise Forehead and Bilateral Cheeks ROI extraction for rPPG signal filtration
 * - One-click "Enable Webcam / Retry" button with helpful troubleshooting guidance
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';

const { FaceMesh, FACEMESH_TESSELATION, drawConnectors } = window;

// ── ROI Landmark Groups (PMC12165443) ──────────────────────────
const FOREHEAD_LANDMARKS    = [10, 67, 109, 10, 151, 337, 299, 338];
const LEFT_CHEEK_LANDMARKS   = [116, 123, 147, 213, 192, 214, 210, 206];
const RIGHT_CHEEK_LANDMARKS  = [345, 352, 376, 433, 416, 434, 430, 426];

function extractROIMeanRGB(imageData, landmarks, canvasWidth, canvasHeight, lmIndices) {
  const points = lmIndices.map(i => ({
    x: landmarks[i].x * canvasWidth,
    y: landmarks[i].y * canvasHeight,
  }));

  const minX = Math.max(0, Math.floor(Math.min(...points.map(p => p.x))));
  const maxX = Math.min(canvasWidth - 1, Math.ceil(Math.max(...points.map(p => p.x))));
  const minY = Math.max(0, Math.floor(Math.min(...points.map(p => p.y))));
  const maxY = Math.min(canvasHeight - 1, Math.ceil(Math.max(...points.map(p => p.y))));

  if (maxX <= minX || maxY <= minY) return null;

  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const idx = (y * canvasWidth + x) * 4;
      rSum += imageData.data[idx];
      gSum += imageData.data[idx + 1];
      bSum += imageData.data[idx + 2];
      count++;
    }
  }

  if (count === 0) return null;
  return { r: rSum / count, g: gSum / count, b: bSum / count };
}

function mergeROIs(...rois) {
  const valid = rois.filter(Boolean);
  if (valid.length === 0) return null;
  return {
    r: valid.reduce((s, v) => s + v.r, 0) / valid.length,
    g: valid.reduce((s, v) => s + v.g, 0) / valid.length,
    b: valid.reduce((s, v) => s + v.b, 0) / valid.length,
  };
}

export default function FaceCapture({ phase, onFrame, onFaceDetected }) {
  const videoRef        = useRef(null);
  const displayCanvasRef = useRef(null);
  const cropCanvasRef   = useRef(null);
  const offscreenRef    = useRef(null);
  const faceMeshRef     = useRef(null);
  const animFrameIdRef  = useRef(null);
  const streamRef       = useRef(null);
  const isProcessingRef = useRef(false);

  // Default to Portrait mode (3:4 ratio: 480×640)
  const [orientationMode, setOrientationMode] = useState('portrait'); // 'portrait' | 'landscape'
  const [faceDetected, setFaceDetected]       = useState(false);
  const [alignmentMsg, setAlignmentMsg]       = useState('Camera munnaadi face-ai vakkavum');
  const [isReady, setIsReady]                 = useState(false);
  const [facingMode, setFacingMode]           = useState('user'); // 'user' (front/webcam) or 'environment'
  const [availableDevices, setAvailableDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [isCameraActive, setIsCameraActive]   = useState(false);
  const [isLoading, setIsLoading]             = useState(true);
  const [error, setError]                     = useState(null);

  const isPortrait   = orientationMode === 'portrait';
  const canvasWidth  = isPortrait ? 480 : 640;
  const canvasHeight = isPortrait ? 640 : 480;

  // ── Enumerate connected camera devices ─────────────────────────────────────
  const refreshDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      setAvailableDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (e) {
      console.warn('Device enumeration failed:', e);
    }
  }, [selectedDeviceId]);

  // ── Stop current video stream ──────────────────────────────────────────────
  const stopStream = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  // ── MediaPipe Results Callback ─────────────────────────────────────────────
  const handleResults = useCallback((results) => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.save();
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw the cropped video frame
    if (results.image) {
      ctx.drawImage(results.image, 0, 0, canvasWidth, canvasHeight);
    }

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const landmarks = results.multiFaceLandmarks[0];
      setFaceDetected(true);
      onFaceDetected?.(true);

      // Bounding box computation in canvas pixels
      const pts = landmarks.map(p => ({ x: p.x * canvasWidth, y: p.y * canvasHeight }));
      const minX = Math.min(...pts.map(p => p.x));
      const maxX = Math.max(...pts.map(p => p.x));
      const minY = Math.min(...pts.map(p => p.y));
      const maxY = Math.max(...pts.map(p => p.y));
      const faceW = maxX - minX;
      const centerX = (minX + maxX) / 2;

      // Distance & Alignment validation
      let ready = true;
      let msg = 'Super! Face locked. Hold still.';

      if (faceW < canvasWidth * 0.28) {
        msg = 'Konjam kitta vaanga (Move Closer)';
        ready = false;
      } else if (faceW > canvasWidth * 0.72) {
        msg = 'Konjam pinnaadi ponga (Step Back)';
        ready = false;
      } else if (centerX < canvasWidth * 0.36) {
        msg = 'Face-ai center-ku vaanga (Move Right)';
        ready = false;
      } else if (centerX > canvasWidth * 0.64) {
        msg = 'Face-ai center-ku vaanga (Move Left)';
        ready = false;
      }

      setAlignmentMsg(msg);
      setIsReady(ready);

      // Anatomical Oval Alignment Guide (Dashed Oval in center)
      const ovalColor = ready ? 'rgba(0, 255, 157, 0.85)' : 'rgba(0, 212, 255, 0.6)';
      ctx.beginPath();
      ctx.ellipse(
        canvasWidth / 2,
        canvasHeight * 0.48,
        canvasWidth * (isPortrait ? 0.32 : 0.24),
        canvasHeight * (isPortrait ? 0.34 : 0.38),
        0, 0, 2 * Math.PI
      );
      ctx.strokeStyle = ovalColor;
      ctx.lineWidth = ready ? 3 : 2;
      ctx.setLineDash(ready ? [] : [6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Subtle Face Mesh Overlay during active scanning
      if (phase === 'scanning' && drawConnectors) {
        drawConnectors(ctx, landmarks, FACEMESH_TESSELATION, {
          color: 'rgba(0,212,255,0.07)',
          lineWidth: 0.5,
        });
      }

      // Extract ROI RGB using offscreen canvas to avoid visual artifacts
      if (offscreenRef.current) {
        const offCtx = offscreenRef.current.getContext('2d', { willReadFrequently: true });
        offCtx.drawImage(results.image, 0, 0, canvasWidth, canvasHeight);
        const imageData = offCtx.getImageData(0, 0, canvasWidth, canvasHeight);

        const foreheadRGB   = extractROIMeanRGB(imageData, landmarks, canvasWidth, canvasHeight, FOREHEAD_LANDMARKS);
        const leftCheekRGB  = extractROIMeanRGB(imageData, landmarks, canvasWidth, canvasHeight, LEFT_CHEEK_LANDMARKS);
        const rightCheekRGB = extractROIMeanRGB(imageData, landmarks, canvasWidth, canvasHeight, RIGHT_CHEEK_LANDMARKS);
        const merged        = mergeROIs(foreheadRGB, leftCheekRGB, rightCheekRGB);

        if (merged && phase === 'scanning') {
          onFrame?.(merged);
        }
      }

      // Draw ROI bounding boxes
      const drawROIBox = (lmIndices, color) => {
        const p = lmIndices.map(i => ({ x: landmarks[i].x * canvasWidth, y: landmarks[i].y * canvasHeight }));
        const x0 = Math.min(...p.map(pt => pt.x));
        const y0 = Math.min(...p.map(pt => pt.y));
        const x1 = Math.max(...p.map(pt => pt.x));
        const y1 = Math.max(...p.map(pt => pt.y));

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      };

      if (phase === 'scanning' || phase === 'idle') {
        drawROIBox(FOREHEAD_LANDMARKS,   'rgba(0,212,255,0.85)');
        drawROIBox(LEFT_CHEEK_LANDMARKS,  'rgba(0,255,157,0.85)');
        drawROIBox(RIGHT_CHEEK_LANDMARKS, 'rgba(0,255,157,0.85)');
      }

      // Live scan beam effect during scan
      if (phase === 'scanning') {
        const beamY = ((Date.now() / 2000) % 1) * canvasHeight;
        const grd = ctx.createLinearGradient(0, beamY - 4, 0, beamY + 4);
        grd.addColorStop(0, 'transparent');
        grd.addColorStop(0.5, 'rgba(0, 212, 255, 0.4)');
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.fillRect(0, beamY - 4, canvasWidth, 8);
      }

    } else {
      setFaceDetected(false);
      setIsReady(false);
      setAlignmentMsg('Face frame-la theriya maattikudhu. Nera paarkavum.');
      onFaceDetected?.(false);

      // Default idle guide oval
      ctx.beginPath();
      ctx.ellipse(
        canvasWidth / 2,
        canvasHeight * 0.48,
        canvasWidth * (isPortrait ? 0.32 : 0.24),
        canvasHeight * (isPortrait ? 0.34 : 0.38),
        0, 0, 2 * Math.PI
      );
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [phase, onFrame, onFaceDetected, canvasWidth, canvasHeight, isPortrait]);

  // ── Start Webcam with Center-Cropped Processing Loop ───────────────────────
  const startCamera = useCallback(async () => {
    if (!FaceMesh) {
      setError('MediaPipe library not loaded. Please check your internet connection and refresh.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    stopStream();

    // Prepare offscreen canvases
    if (!cropCanvasRef.current) {
      cropCanvasRef.current = document.createElement('canvas');
    }
    cropCanvasRef.current.width  = canvasWidth;
    cropCanvasRef.current.height = canvasHeight;

    if (!offscreenRef.current) {
      offscreenRef.current = document.createElement('canvas');
    }
    offscreenRef.current.width  = canvasWidth;
    offscreenRef.current.height = canvasHeight;

    // Initialize FaceMesh model
    try {
      const faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.60,
        minTrackingConfidence: 0.60,
      });

      faceMesh.onResults(handleResults);
      faceMeshRef.current = faceMesh;
    } catch (err) {
      setError(`FaceMesh init error: ${err.message}`);
      setIsLoading(false);
      return;
    }

    // Flexible webcam constraints: works with any laptop webcam
    const constraints = {
      audio: false,
      video: selectedDeviceId
        ? { deviceId: { exact: selectedDeviceId } }
        : {
            facingMode: facingMode,
            width:  { ideal: 1280, min: 640 },
            height: { ideal: 720,  min: 480 },
          },
    };

    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (strictErr) {
        console.warn('Strict constraints failed, falling back to basic video:', strictErr);
        // Fallback for laptop webcams with strict drivers
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = stream;
      if (!videoRef.current) return;

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      setIsCameraActive(true);
      setIsLoading(false);
      refreshDevices();

      // Start continuous frame processing loop
      const processLoop = async () => {
        const video = videoRef.current;
        const cropCanvas = cropCanvasRef.current;
        const faceMesh = faceMeshRef.current;

        if (video && video.readyState >= 2 && cropCanvas && faceMesh) {
          const vw = video.videoWidth;
          const vh = video.videoHeight;

          if (vw > 0 && vh > 0) {
            // Aspect-ratio center-crop: prevents stretching on laptop webcams
            const targetRatio = canvasWidth / canvasHeight;
            const videoRatio  = vw / vh;
            let sx = 0, sy = 0, sw = vw, sh = vh;

            if (videoRatio > targetRatio) {
              // Video is wider than target (e.g. 16:9 webcam on 3:4 portrait)
              sw = vh * targetRatio;
              sx = (vw - sw) / 2;
            } else {
              // Video is taller than target
              sh = vw / targetRatio;
              sy = (vh - sh) / 2;
            }

            const cropCtx = cropCanvas.getContext('2d');
            cropCtx.drawImage(video, sx, sy, sw, sh, 0, 0, canvasWidth, canvasHeight);

            // Send un-distorted cropped frame to FaceMesh
            if (!isProcessingRef.current) {
              isProcessingRef.current = true;
              try {
                await faceMesh.send({ image: cropCanvas });
              } catch (e) {
                // Ignore transient frame send errors
              } finally {
                isProcessingRef.current = false;
              }
            }
          }
        }

        // Schedule next frame
        if (videoRef.current && videoRef.current.srcObject) {
          animFrameIdRef.current = requestAnimationFrame(processLoop);
        }
      };

      animFrameIdRef.current = requestAnimationFrame(processLoop);

    } catch (err) {
      console.error('Camera startup error:', err);
      setIsLoading(false);
      setIsCameraActive(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera permission denied. Browser address bar-la camera icon-a click panni "Allow" kudukkavum.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('Laptop-la webcam kandupidika mudiyala. Camera connect aagirukannu paarkavum.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Webcam is already in use by another application (Zoom, Teams, etc.). Athanai close pannavum.');
      } else {
        setError(`Camera error: ${err.message}. Click "Retry Camera" below.`);
      }
    }
  }, [canvasWidth, canvasHeight, facingMode, selectedDeviceId, handleResults, stopStream, refreshDevices]);

  // Restart camera when orientation or device changes
  useEffect(() => {
    startCamera();
    return () => {
      stopStream();
      faceMeshRef.current?.close();
    };
  }, [startCamera, stopStream]);

  // Flip front/back on mobile
  const toggleFacingMode = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  // Toggle Portrait vs Landscape mode
  const toggleOrientation = () => {
    setOrientationMode(prev => prev === 'portrait' ? 'landscape' : 'portrait');
  };

  return (
    <div className="relative w-full flex flex-col items-center justify-center">
      {/* Hidden raw video element */}
      <video
        ref={videoRef}
        playsInline
        muted
        style={{ display: 'none' }}
      />

      {/* Main Camera Frame */}
      <div
        className={`relative rounded-2xl overflow-hidden border border-slate-700/80 shadow-2xl bg-black flex justify-center items-center transition-all duration-300 ${
          isPortrait ? 'w-full max-w-[380px] aspect-[3/4]' : 'w-full aspect-[4/3]'
        }`}
        style={{ minHeight: isPortrait ? '420px' : '320px' }}
      >
        {/* Render Canvas */}
        <canvas
          ref={displayCanvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="w-full h-full object-cover"
          style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
        />

        {/* Loading Spinner Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-3 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
            <p className="text-xs text-cyan-300 font-medium">Laptop Webcam தொடங்குகிறது...</p>
            <p className="text-[11px] text-slate-400">Starting Camera Feed...</p>
          </div>
        )}

        {/* Top Control Bar */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          {/* Status Badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md shadow-lg pointer-events-auto
            ${isReady
              ? 'bg-emerald-950/80 border border-emerald-500/60 text-emerald-300'
              : faceDetected
              ? 'bg-amber-950/80 border border-amber-500/60 text-amber-300'
              : 'bg-slate-900/80 border border-slate-700 text-slate-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isReady ? 'bg-emerald-400 animate-ping' : faceDetected ? 'bg-amber-400' : 'bg-red-400'}`} />
            <span>{isReady ? 'Ready to Scan' : faceDetected ? 'Adjusting' : 'Align Face'}</span>
          </div>

          {/* Quick Actions (Portrait Switcher + Flip) */}
          <div className="flex items-center gap-2 pointer-events-auto">
            {/* Portrait / Landscape Toggle Button */}
            <button
              onClick={toggleOrientation}
              className="px-2.5 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-200 flex items-center gap-1.5 transition-all shadow-md"
              title={isPortrait ? 'Switch to Landscape (4:3)' : 'Switch to Portrait (3:4)'}
            >
              <span>{isPortrait ? '📱' : '💻'}</span>
              <span className="font-medium">{isPortrait ? 'Portrait' : 'Landscape'}</span>
            </button>

            {/* Camera Flip (Mobile / Multi-cam) */}
            {availableDevices.length > 1 && (
              <button
                onClick={toggleFacingMode}
                className="w-8 h-8 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 flex items-center justify-center transition-all shadow-md"
                title="Switch Camera Device"
              >
                🔄
              </button>
            )}
          </div>
        </div>

        {/* Bottom Live Alignment Guidance HUD */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-col gap-1.5 items-center pointer-events-none">
          <div
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md border text-center transition-all duration-200 shadow-xl ${
              isReady
                ? 'bg-emerald-950/90 border-emerald-500/70 text-emerald-300'
                : faceDetected
                ? 'bg-slate-900/90 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-900/90 border-slate-700 text-slate-300'
            }`}
          >
            {alignmentMsg}
          </div>
        </div>
      </div>

      {/* Camera Selection & Troubleshooting Strip */}
      <div className="mt-3 w-full flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
        {/* Device selector if multiple webcams */}
        {availableDevices.length > 1 ? (
          <div className="flex items-center gap-1.5 text-slate-400">
            <span>📷 Camera:</span>
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
            >
              {availableDevices.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <span className="text-slate-500 text-[11px]">
            💻 Laptop Webcam Active • {isPortrait ? 'Portrait 3:4 (480×640)' : 'Landscape 4:3 (640×480)'}
          </span>
        )}

        {/* Retry / Re-enable Camera button */}
        <button
          onClick={startCamera}
          className="text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 underline text-[11px]"
        >
          <span>↻ Reconnect Camera</span>
        </button>
      </div>

      {/* Error / Permissions Guide */}
      {error && (
        <div className="mt-3 p-3 bg-red-950/70 border border-red-500/50 rounded-xl text-xs text-red-300 text-center w-full shadow-lg">
          <p className="font-semibold mb-1">⚠️ {error}</p>
          <div className="mt-2 flex justify-center gap-2">
            <button
              onClick={startCamera}
              className="px-3 py-1 bg-red-800 hover:bg-red-700 text-white rounded-lg font-medium transition"
            >
              Retry Camera Permission
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
