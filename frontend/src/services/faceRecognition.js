/**
 * faceRecognition.js — Real-Time Geometric Face ID Biometrics Engine
 * ===================================================================
 * Computes scale-invariant, rotation-compensated 12D geometric landmark vectors
 * from MediaPipe FaceMesh coordinates.
 * Enables instant 1-second Face ID registration and returning patient matching.
 */

// Helper to compute Euclidean distance in 3D
function distance3D(p1, p2) {
  if (!p1 || !p2) return 0;
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z || 0) - (p2.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Extracts normalized 12-dimensional geometric Face ID descriptor from MediaPipe landmarks
 * @param {Array} landmarks - 468 MediaPipe normalized landmarks
 * @returns {Array<number>|null} 12-dimensional feature vector
 */
export function extractFaceDescriptor(landmarks) {
  if (!landmarks || landmarks.length < 468) return null;

  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const noseTip = landmarks[1];
  const noseBridge = landmarks[168];
  const chin = landmarks[152];
  const forehead = landmarks[10];
  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];
  const mouthLeft = landmarks[61];
  const mouthRight = landmarks[291];
  const upperLip = landmarks[0];
  const lowerLip = landmarks[17];

  // Base normalization distance (Inter-pupillary / Inter-ocular distance)
  const iod = distance3D(leftEye, rightEye);
  if (iod < 0.01) return null; // Too small or invalid

  const descriptor = [
    parseFloat((distance3D(noseTip, chin) / iod).toFixed(4)),
    parseFloat((distance3D(noseBridge, noseTip) / iod).toFixed(4)),
    parseFloat((distance3D(forehead, noseBridge) / iod).toFixed(4)),
    parseFloat((distance3D(leftCheek, rightCheek) / iod).toFixed(4)),
    parseFloat((distance3D(mouthLeft, mouthRight) / iod).toFixed(4)),
    parseFloat((distance3D(noseTip, upperLip) / iod).toFixed(4)),
    parseFloat((distance3D(upperLip, lowerLip) / iod).toFixed(4)),
    parseFloat((distance3D(leftEye, leftCheek) / iod).toFixed(4)),
    parseFloat((distance3D(rightEye, rightCheek) / iod).toFixed(4)),
    parseFloat((distance3D(leftCheek, chin) / iod).toFixed(4)),
    parseFloat((distance3D(rightCheek, chin) / iod).toFixed(4)),
    parseFloat((distance3D(forehead, chin) / iod).toFixed(4)),
  ];

  return descriptor;
}

/**
 * Compares two 12D Face ID descriptors
 * @param {Array<number>} d1
 * @param {Array<number>} d2
 * @returns {{ isMatch: boolean, confidence: number, distance: number }}
 */
export function compareFaceDescriptors(d1, d2) {
  if (!d1 || !d2 || d1.length !== 12 || d2.length !== 12) {
    return { isMatch: false, confidence: 0, distance: 999 };
  }

  let sumSq = 0;
  for (let i = 0; i < 12; i++) {
    const diff = d1[i] - d2[i];
    sumSq += diff * diff;
  }

  const distance = Math.sqrt(sumSq);
  // Empirically calibrated for MediaPipe landmark ratios (typical match distance < 0.22)
  const maxThreshold = 0.28;
  const matchThreshold = 0.18;

  let confidence = Math.max(0, Math.min(100, Math.round((1 - distance / maxThreshold) * 100)));
  const isMatch = distance <= matchThreshold;

  return {
    isMatch,
    confidence,
    distance: parseFloat(distance.toFixed(4))
  };
}

/**
 * Searches a registered patient database for the best matching Face ID
 * @param {Array<number>} queryDescriptor
 * @param {Array} patients
 * @returns {{ match: object|null, confidence: number }}
 */
export function findBestFaceMatch(queryDescriptor, patients) {
  if (!queryDescriptor || !patients || patients.length === 0) {
    return { match: null, confidence: 0 };
  }

  let bestMatch = null;
  let highestConfidence = 0;
  let lowestDistance = 999;

  for (const patient of patients) {
    if (!patient.face_descriptor) continue;
    const result = compareFaceDescriptors(queryDescriptor, patient.face_descriptor);
    if (result.isMatch && result.confidence > highestConfidence) {
      highestConfidence = result.confidence;
      lowestDistance = result.distance;
      bestMatch = patient;
    }
  }

  return {
    match: bestMatch,
    confidence: highestConfidence,
    distance: lowestDistance
  };
}

/**
 * Captures a cropped JPEG face snapshot thumbnail from active video element
 * @param {HTMLVideoElement} video
 * @returns {string|null} Data URL (JPEG base64)
 */
export function captureFaceSnapshot(video) {
  try {
    if (!video || video.readyState < 2) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    
    // Draw centered square from video
    const minDim = Math.min(video.videoWidth, video.videoHeight);
    const startX = (video.videoWidth - minDim) / 2;
    const startY = (video.videoHeight - minDim) / 2;
    
    // Mirror horizontally to match webcam display
    ctx.translate(160, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, startX, startY, minDim, minDim, 0, 0, 160, 160);
    
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch (e) {
    console.error('Face snapshot capture error:', e);
    return null;
  }
}
