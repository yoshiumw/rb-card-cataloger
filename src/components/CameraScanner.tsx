import React, { useRef, useEffect, useState } from 'react';
import { Camera, X, Loader2 } from 'lucide-react';
import Tesseract, { PSM } from 'tesseract.js';

// Configuration constants
const DEBUG = true;
const SHOW_DEBUG_THUMBNAIL = true;
const ENABLE_EROSION = false;
const ENABLE_MIN_OCR_CONFIDENCE_CHECK = false;
const MIN_OCR_CONFIDENCE = 0;
const REQUIRED_CONSECUTIVE_MATCHES = 2;
const RESTART_SCAN_DELAY = 1500;
const PSM_MODE = PSM.SINGLE_LINE; // Alternative: PSM.SPARSE_TEXT
const KNOWN_SET_CODES = ['OGN', 'SFD', 'UNL', 'VEN'];

// Diagnostic flags for isolating OCR failures
const INVERT_BINARIZED_OUTPUT = false;
const BYPASS_PREPROCESSING = true;

// Small box sized for a single short text line (e.g. "VEN • 101/166 • EN")
// Width is generous (positioning slack); height is tight (maximizes character pixel size)
// These are used ONLY for initial CSS sizing of the overlay - actual crop coords come from getBoundingClientRect()
const TEXT_BOX_WIDTH_RATIO = 0.75;   // Increased from 0.55 — more horizontal margin
const TEXT_BOX_HEIGHT_RATIO = 0.12;  // Increased from 0.06 — 2x taller to tolerate vertical sway

// Alignment check threshold
const MIN_DARK_PIXEL_RATIO = 0.05; // minimum fraction of dark pixels to proceed with OCR

// Crop smoothing configuration
const CROP_SMOOTHING_ENABLED = true;  // Set to false to disable smoothing for testing
const CROP_SMOOTHING_FRAMES = 5;  // Average crop position over last 5 frames

/**
 * Converts a bounding box expressed as fractions of the displayed video element
 * (e.g. where an on-screen overlay sits) into pixel coordinates on the raw video
 * frame, accounting for object-cover scaling/cropping.
 */
function mapDisplayRectToVideoRect(
  displayXRatio: number,
  displayYRatio: number,
  displayWidthRatio: number,
  displayHeightRatio: number,
  videoWidth: number,
  videoHeight: number,
  displayWidth: number,
  displayHeight: number
): { x: number; y: number; width: number; height: number } {
  const videoAspect = videoWidth / videoHeight;
  const displayAspect = displayWidth / displayHeight;

  let renderedWidth: number, renderedHeight: number, offsetX: number, offsetY: number;

  if (videoAspect > displayAspect) {
    // Video is relatively wider than display box -> full height shown, sides cropped
    renderedHeight = videoHeight;
    renderedWidth = videoHeight * displayAspect;
    offsetX = (videoWidth - renderedWidth) / 2;
    offsetY = 0;
  } else {
    // Video is relatively taller than display box -> full width shown, top/bottom cropped
    renderedWidth = videoWidth;
    renderedHeight = videoWidth / displayAspect;
    offsetX = 0;
    offsetY = (videoHeight - renderedHeight) / 2;
  }

  return {
    x: Math.floor(offsetX + displayXRatio * renderedWidth),
    y: Math.floor(offsetY + displayYRatio * renderedHeight),
    width: Math.floor(displayWidthRatio * renderedWidth),
    height: Math.floor(displayHeightRatio * renderedHeight),
  };
}

/**
 * Smooth crop position over multiple frames to dampen hand jitter.
 * Uses a moving average of the last N frames to stabilize the crop region.
 */
function smoothCropPosition(
  currentRect: { x: number; y: number; width: number; height: number },
  historyRef: React.MutableRefObject<Array<{ x: number; y: number; width: number; height: number }>>,
  maxHistoryLength: number
): { x: number; y: number; width: number; height: number } {
  historyRef.current.push(currentRect);
  if (historyRef.current.length > maxHistoryLength) {
    historyRef.current.shift();
  }

  const length = historyRef.current.length;
  const avgX = Math.floor(historyRef.current.reduce((sum, r) => sum + r.x, 0) / length);
  const avgY = Math.floor(historyRef.current.reduce((sum, r) => sum + r.y, 0) / length);
  const avgWidth = Math.floor(historyRef.current.reduce((sum, r) => sum + r.width, 0) / length);
  const avgHeight = Math.floor(historyRef.current.reduce((sum, r) => sum + r.height, 0) / length);

  return { x: avgX, y: avgY, width: avgWidth, height: avgHeight };
}

/**
 * Sauvola's local adaptive thresholding method.
 * Uses integral images for efficient mean and stddev computation.
 */
function sauvolaThreshold(
  grayscale: Uint8ClampedArray,
  width: number,
  height: number,
  windowSize: number = 15,
  k: number = 0.2,
  r: number = 128
): Uint8ClampedArray {
  const totalPixels = width * height;
  const result = new Uint8ClampedArray(totalPixels);
  
  // Build integral image for mean computation
  const integral = new Float64Array(totalPixels + width + 1); // Extra row/col for padding
  const integralSquared = new Float64Array(totalPixels + width + 1);
  
  // Fill integral images
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    let rowSumSq = 0;
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const val = grayscale[idx];
      rowSum += val;
      rowSumSq += val * val;
      
      const integralIdx = (y + 1) * (width + 1) + (x + 1);
      integral[integralIdx] = rowSum + integral[y * (width + 1) + (x + 1)];
      integralSquared[integralIdx] = rowSumSq + integralSquared[y * (width + 1) + (x + 1)];
    }
  }
  
  const halfWindow = Math.floor(windowSize / 2);
  
  // Apply Sauvola thresholding
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      
      // Determine window bounds (clamp to image edges)
      const xMin = Math.max(0, x - halfWindow);
      const xMax = Math.min(width - 1, x + halfWindow);
      const yMin = Math.max(0, y - halfWindow);
      const yMax = Math.min(height - 1, y + halfWindow);
      
      const w = xMax - xMin + 1;
      const h = yMax - yMin + 1;
      const count = w * h;
      
      // Get sum and sum of squares from integral images
      const getSum = (xi: number, yi: number) => {
        const clampedX = Math.min(xi, width);
        const clampedY = Math.min(yi, height);
        return integral[(clampedY + 1) * (width + 1) + (clampedX + 1)];
      };
      const getSumSq = (xi: number, yi: number) => {
        const clampedX = Math.min(xi, width);
        const clampedY = Math.min(yi, height);
        return integralSquared[(clampedY + 1) * (width + 1) + (clampedX + 1)];
      };
      
      const sum = getSum(xMax, yMax) - getSum(xMin - 1, yMax) - getSum(xMax, yMin - 1) + getSum(xMin - 1, yMin - 1);
      const sumSq = getSumSq(xMax, yMax) - getSumSq(xMin - 1, yMax) - getSumSq(xMax, yMin - 1) + getSumSq(xMin - 1, yMin - 1);
      
      const mean = sum / count;
      const variance = (sumSq / count) - (mean * mean);
      const stddev = Math.sqrt(Math.max(0, variance));
      
      // Sauvola threshold formula: T = mean * (1 + k * ((stddev / r) - 1))
      const threshold = mean * (1 + k * ((stddev / r) - 1));
      
      result[idx] = grayscale[idx] > threshold ? 255 : 0;
    }
  }
  
  return result;
}

/**
 * Compute Otsu's threshold for adaptive binarization.
 * Analyzes the grayscale histogram to find optimal threshold automatically.
 */
function computeOtsuThreshold(grayscaleData: Uint8ClampedArray): number {
  // Build histogram (256 bins for 0-255 values)
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < grayscaleData.length; i += 4) {
    histogram[grayscaleData[i]]++;
  }

  const total = grayscaleData.length / 4;
  
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let maxVariance = 0;
  let threshold = 0;

  for (let i = 0; i < 256; i++) {
    wB += histogram[i];
    if (wB === 0) continue;
    
    wF = total - wB;
    if (wF === 0) break;

    sumB += i * histogram[i];

    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;

    const varianceBetween = wB * wF * Math.pow(mB - mF, 2);
    if (varianceBetween > maxVariance) {
      maxVariance = varianceBetween;
      threshold = i;
    }
  }

  return threshold;
}

interface CameraScannerProps {
  onCardIdDetected: (cardId: string) => void;
  onClose: () => void;
}

export default function CameraScanner({ onCardIdDetected, onClose }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Tesseract.Worker | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const lastMatchRef = useRef<{ id: string; count: number } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanningStatus, setScanningStatus] = useState('Initializing OCR engine...');
  const [debugImageUrl, setDebugImageUrl] = useState<string | null>(null);
  const [ocrDebugLog, setOcrDebugLog] = useState<string[]>([]);
  const [scannedCards, setScannedCards] = useState<string[]>([]);
  const [lastSuccessMessage, setLastSuccessMessage] = useState<string | null>(null);
  const MAX_DEBUG_LOG_LINES = 6;
  const streamRef = useRef<MediaStream | null>(null);
  const isScanningRef = useRef(false);
  const cropHistoryRef = useRef<Array<{ x: number; y: number; width: number; height: number }>>([]);

  useEffect(() => {
    let mounted = true;
    
    if (DEBUG) console.log('[CameraScanner] Component mounted, initializing camera...');
    
    // Initialize Tesseract worker once
    const initWorker = async () => {
      try {
        if (DEBUG) console.log('[CameraScanner] Initializing Tesseract worker...');
        const worker = await Tesseract.createWorker('eng', 2, {
          logger: (m) => {
            if (DEBUG) console.log('[Tesseract Logger]', m.status, m.progress ? `(${Math.round(m.progress * 100)}%)` : '');
          }
        });
        
        await worker.setParameters({
          // Include • (U+2022), · (U+00B7), and also . , since OCR often misreads bullets as periods/commas
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-•·/,.',
          preserve_interword_spaces: '1',
          tessedit_pageseg_mode: PSM_MODE
        });
        
        workerRef.current = worker;
        if (DEBUG) console.log('[CameraScanner] Tesseract worker initialized successfully');
      } catch (err) {
        console.error('[CameraScanner] Failed to initialize Tesseract worker:', err);
      }
    };
    
    initWorker();
    
    const initCamera = async () => {
      try {
        setError(null);
        if (DEBUG) console.log('[CameraScanner] Requesting camera access...');
        
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
        
        if (DEBUG) console.log('[CameraScanner] Camera access granted, stream obtained');
        
        if (!mounted) {
          if (DEBUG) console.log('[CameraScanner] Component unmounted during camera init, stopping stream');
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        streamRef.current = stream;
        
        if (videoRef.current) {
          const video = videoRef.current;
          video.srcObject = stream;
          if (DEBUG) console.log('[CameraScanner] Video srcObject set');
          if (DEBUG) console.log('[CameraScanner] Video readyState before play:', video.readyState);
          
          // iOS Safari requires explicit play() call
          try {
            await video.play();
            if (DEBUG) console.log('[CameraScanner] Video playback started');
            if (DEBUG) console.log('[CameraScanner] Video readyState after play:', video.readyState);
          } catch (playErr) {
            console.error('[CameraScanner] Error playing video:', playErr);
          }
          
          // Track if we've already started scanning to avoid duplicates
          let scanStarted = false;
          const tryStartScanning = () => {
            if (scanStarted || !mounted) {
              if (DEBUG) console.log('[CameraScanner] Skipping duplicate startScanning call, scanStarted:', scanStarted, 'mounted:', mounted);
              return;
            }
            scanStarted = true;
            if (DEBUG) console.log('[CameraScanner] Video ready, starting scanning (readyState:', video.readyState, ')');
            startScanning();
          };
          
          // Multiple fallback methods to ensure scanning starts
          // Method 1: onloadedmetadata
          video.onloadedmetadata = () => {
            if (DEBUG) console.log('[CameraScanner] Video metadata loaded event fired');
            tryStartScanning();
          };
          
          // Method 2: onloadeddata - fires when first frame data is loaded
          video.onloadeddata = () => {
            if (DEBUG) console.log('[CameraScanner] Video loadeddata event fired');
            tryStartScanning();
          };
          
          // Method 3: oncanplay - fires when enough data is loaded to start playing
          video.oncanplay = () => {
            if (DEBUG) console.log('[CameraScanner] Video canplay event fired');
            tryStartScanning();
          };
          
          // Method 4: Fallback timeout - if events don't fire, start anyway after 2 seconds
          if (DEBUG) console.log('[CameraScanner] Setting 2s fallback timeout to start scanning');
          setTimeout(() => {
            if (DEBUG) console.log('[CameraScanner] Fallback timeout reached, readyState:', video.readyState);
            tryStartScanning();
          }, 2000);
        }
      } catch (err) {
        if (!mounted) return;
        
        console.error('[CameraScanner] Error accessing camera:', err);
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError') {
            setError('Camera permission denied. Please allow camera access in your browser settings.');
          } else if (err.name === 'NotFoundError') {
            setError('No camera found. Please connect a camera or use manual entry.');
          } else {
            setError(`Camera error: ${err.message}`);
          }
        } else {
          setError('Failed to access camera. Please check permissions.');
        }
      }
    };
    
    initCamera();
    
    return () => {
      if (DEBUG) console.log('[CameraScanner] Component unmounting');
      mounted = false;
      
      // Terminate the worker on cleanup
      if (workerRef.current) {
        workerRef.current.terminate().catch(console.error);
        workerRef.current = null;
      }
      
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    console.log('[CameraScanner] stopCamera called');
    setIsScanning(false);
    isScanningRef.current = false;
    cropHistoryRef.current = [];  // Reset smoothing history
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startScanning = () => {
    if (DEBUG) console.log('[CameraScanner] startScanning called');
    // Set both state and ref immediately to avoid timing issues
    setIsScanning(true);
    isScanningRef.current = true;
    if (DEBUG) console.log('[CameraScanner] isScanning set to true (state and ref)');
    
    // Start the scan loop with minimal delay
    setTimeout(() => {
      if (DEBUG) console.log('[CameraScanner] Starting first scan frame');
      scanFrame();
    }, 50);
  };

  const scanFrame = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Check if we should continue scanning using the ref for immediate value
    const shouldScan = isScanningRef.current;
    if (DEBUG) console.log('[CameraScanner] scanFrame started, video readyState:', video?.readyState, 'isScanning (ref):', shouldScan);
    
    if (!shouldScan) {
      if (DEBUG) console.log('[CameraScanner] scanFrame aborted: scanning was stopped (ref check)');
      return;
    }
    
    // Guard against concurrent scans - skip if a previous recognition is still in flight
    if (isProcessingRef.current) {
      if (DEBUG) console.log('[CameraScanner] scanFrame skipped: previous recognition still in progress');
      if (isScanningRef.current) {
        setTimeout(scanFrame, 800);
      }
      return;
    }
    
    // Ensure video and canvas are ready
    if (!video || !canvas || video.readyState < 2) {
      // Video not ready yet, try again
      if (DEBUG) console.log('[CameraScanner] Video not ready (readyState:', video?.readyState, '), retrying in 100ms');
      if (isScanningRef.current) {
        setTimeout(scanFrame, 100);
      }
      return;
    }
    
    if (DEBUG) console.log('[CameraScanner] Video is ready, proceeding with OCR');

    const context = canvas.getContext('2d');
    if (!context) {
      console.error('[CameraScanner] Failed to get canvas context');
      return;
    }

    try {
      // Set canvas size to match video
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      if (DEBUG) console.log('[CameraScanner] Canvas size:', canvas.width, 'x', canvas.height);

      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Crop region: use overlay's actual on-screen position/size via getBoundingClientRect()
      // This accounts for object-cover scaling mismatch between displayed video and raw stream
      if (!overlayRef.current) {
        if (DEBUG) console.log('[CameraScanner] Overlay ref not ready, retrying in 100ms');
        if (isScanningRef.current) {
          setTimeout(scanFrame, 100);
        }
        return;
      }

      const videoRect = videoRef.current?.getBoundingClientRect();
      const overlayRect = overlayRef.current.getBoundingClientRect();

      if (!videoRect) {
        if (DEBUG) console.log('[CameraScanner] Video rect not ready, retrying in 100ms');
        if (isScanningRef.current) {
          setTimeout(scanFrame, 100);
        }
        return;
      }

      // Compute overlay position as fractions relative to the video's displayed box
      const displayXRatio = (overlayRect.left - videoRect.left) / videoRect.width;
      const displayYRatio = (overlayRect.top - videoRect.top) / videoRect.height;
      const displayWidthRatio = overlayRect.width / videoRect.width;
      const displayHeightRatio = overlayRect.height / videoRect.height;

      // Convert display coordinates to raw video frame pixel coordinates
      const cropRegion = mapDisplayRectToVideoRect(
        displayXRatio,
        displayYRatio,
        displayWidthRatio,
        displayHeightRatio,
        video.videoWidth,
        video.videoHeight,
        videoRect.width,
        videoRect.height
      );

      // Smooth crop position over multiple frames to dampen hand jitter
      const rectToUse = CROP_SMOOTHING_ENABLED 
        ? smoothCropPosition(cropRegion, cropHistoryRef, CROP_SMOOTHING_FRAMES)
        : cropRegion;

      const cropX = rectToUse.x;
      const cropY = rectToUse.y;
      const cropWidth = rectToUse.width;
      const cropHeight = rectToUse.height;

      if (DEBUG) console.log('[CameraScanner] Video rect:', videoRect.width, 'x', videoRect.height, 
        'Canvas:', canvas.width, 'x', canvas.height,
        'Overlay rect:', overlayRect.width.toFixed(1), 'x', overlayRect.height.toFixed(1),
        'Crop:', { x: cropX, y: cropY, width: cropWidth, height: cropHeight });

      // Extract the region
      const imageData = context.getImageData(cropX, cropY, cropWidth, cropHeight);

      // Create a temporary canvas for the cropped region
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = cropWidth;
      tempCanvas.height = cropHeight;
      const tempContext = tempCanvas.getContext('2d');
      
      if (tempContext) {
        tempContext.putImageData(imageData, 0, 0);
        
        // Apply advanced image preprocessing for better OCR accuracy
        const imgCropWidth = imageData.width;
        const imgCropHeight = imageData.height;
        
        let imageUrl: string;
        
        // BYPASS_PREPROCESSING mode: skip all preprocessing and send raw crop directly to Tesseract
        if (BYPASS_PREPROCESSING) {
          // Scale up 2-3x with smoothing enabled for gentler upscale
          const bypassScale = 3;
          const bypassScaledWidth = imgCropWidth * bypassScale;
          const bypassScaledHeight = imgCropHeight * bypassScale;
          
          const bypassCanvas = document.createElement('canvas');
          bypassCanvas.width = bypassScaledWidth;
          bypassCanvas.height = bypassScaledHeight;
          const bypassContext = bypassCanvas.getContext('2d');
          
          if (!bypassContext) return;
          
          // Enable smoothing for gentler upscale
          bypassContext.imageSmoothingEnabled = true;
          bypassContext.imageSmoothingQuality = 'high';
          bypassContext.drawImage(tempCanvas, 0, 0, bypassScaledWidth, bypassScaledHeight);
          
          // Convert to data URL for Tesseract
          imageUrl = bypassCanvas.toDataURL('image/png');
          
          // Update debug thumbnail state
          if (SHOW_DEBUG_THUMBNAIL) {
            setDebugImageUrl(imageUrl);
          }
          
          if (DEBUG) console.log('[CameraScanner] BYPASS_PREPROCESSING=true: sending raw crop to Tesseract');
          
          // Skip alignment check in bypass mode (no grayscaleValues available)
        } else {
          // Standard preprocessing pipeline (grayscale + Sauvola + optional erosion)
        
          // Step 1: Scale up 4x for maximum character detail (increased from 3x)
          const scale = 4;
          const scaledWidth = imgCropWidth * scale;
          const scaledHeight = imgCropHeight * scale;
          
          const scaledCanvas = document.createElement('canvas');
          scaledCanvas.width = scaledWidth;
          scaledCanvas.height = scaledHeight;
          const scaledContext = scaledCanvas.getContext('2d');
          
          if (!scaledContext) return;
          
          // Draw with smoothing disabled for sharper edges
          scaledContext.imageSmoothingEnabled = false;
          scaledContext.drawImage(tempCanvas, 0, 0, scaledWidth, scaledHeight);
          
          // Step 2: Get pixels and apply preprocessing
          const pixels = scaledContext.getImageData(0, 0, scaledWidth, scaledHeight);
          const data = pixels.data;
          
          // Step 3: Convert to grayscale using luminance formula
          for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            data[i] = gray;     // R
            data[i + 1] = gray; // G
            data[i + 2] = gray; // B
          }
          
          // Step 4: Apply Sauvola's local adaptive thresholding
          // Extract grayscale values (every 4th byte starting at index 0)
          const grayscaleValues = new Uint8ClampedArray(scaledWidth * scaledHeight);
          for (let i = 0; i < data.length; i += 4) {
            grayscaleValues[i / 4] = data[i];
          }
          
          const binaryResult = sauvolaThreshold(grayscaleValues, scaledWidth, scaledHeight);
          if (DEBUG) console.log('[CameraScanner] Sauvola thresholding applied');
          
          // Apply binary result back to RGBA data
          for (let i = 0; i < binaryResult.length; i++) {
            const idx = i * 4;
            const value = binaryResult[i];
            data[idx] = value;
            data[idx + 1] = value;
            data[idx + 2] = value;
          }
          
          // Polarity inversion pass (for white-on-dark text scenarios)
          if (INVERT_BINARIZED_OUTPUT) {
            for (let i = 0; i < data.length; i += 4) {
              const inverted = 255 - data[i];
              data[i] = inverted;
              data[i + 1] = inverted;
              data[i + 2] = inverted;
            }
            if (DEBUG) console.log('[CameraScanner] INVERT_BINARIZED_OUTPUT=true: polarity inverted');
          }
          
          // Step 5: Apply morphological erosion to remove small noise (optional)
          if (ENABLE_EROSION) {
            const erodedData = new Uint8ClampedArray(data);
            const width = scaledWidth;
            const height = scaledHeight;
            
            for (let y = 1; y < height - 1; y++) {
              for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
                let minVal = 255;
                
                // Check 3x3 neighborhood
                for (let dy = -1; dy <= 1; dy++) {
                  for (let dx = -1; dx <= 1; dx++) {
                    const nIdx = ((y + dy) * width + (x + dx)) * 4;
                    if (data[nIdx] < minVal) {
                      minVal = data[nIdx];
                    }
                  }
                }
                
                erodedData[idx] = minVal;
                erodedData[idx + 1] = minVal;
                erodedData[idx + 2] = minVal;
              }
            }
            
            // Copy eroded data back
            for (let i = 0; i < data.length; i++) {
              data[i] = erodedData[i];
            }
          }
          
          scaledContext.putImageData(pixels, 0, 0);
          
          // Convert to data URL for Tesseract
          imageUrl = scaledCanvas.toDataURL('image/png');
          
          // Update debug thumbnail state
          if (SHOW_DEBUG_THUMBNAIL) {
            setDebugImageUrl(imageUrl);
          }
          
          if (DEBUG) console.log('[CameraScanner] Preprocessed image URL generated, size:', scaledWidth, 'x', scaledHeight);
  
          // Alignment check: skip OCR if not enough dark pixels in the crop region
          // This avoids wasting CPU/battery on frames where the card isn't aligned yet
          let darkPixelCount = 0;
          for (let i = 0; i < grayscaleValues.length; i++) {
            if (grayscaleValues[i] < 100) darkPixelCount++;
          }
          const darkPixelRatio = darkPixelCount / grayscaleValues.length;
          if (darkPixelRatio < MIN_DARK_PIXEL_RATIO) {
            if (DEBUG) console.log('[CameraScanner] Skipping OCR: insufficient dark pixels (ratio:', darkPixelRatio.toFixed(3), ')');
            setScanningStatus('Align the card corner with the guide');
            if (isScanningRef.current) {
              setTimeout(scanFrame, 800);
            }
            return;
          }
          if (DEBUG) console.log('[CameraScanner] Alignment check passed: dark pixel ratio =', darkPixelRatio.toFixed(3));
        }

        try {
          if (!isScanningRef.current) {
            if (DEBUG) console.log('[CameraScanner] Aborting before OCR: isScanning (ref) is false');
            return;
          }
          
          // Wait for worker to be ready
          if (!workerRef.current) {
            if (DEBUG) console.log('[CameraScanner] Worker not ready, retrying in 500ms');
            setScanningStatus('Initializing OCR...');
            if (isScanningRef.current) {
              setTimeout(scanFrame, 500);
            }
            return;
          }
          
          if (DEBUG) console.log('[CameraScanner] Starting Tesseract recognition...');
          setScanningStatus('Recognizing text...');
          
          // Mark as processing to prevent concurrent scans
          isProcessingRef.current = true;
          
          const result = await workerRef.current.recognize(imageUrl);

          // Log raw output for debugging
          const recognizedWords = (result.data as any).words ?? [];
          const wordCount = Array.isArray(recognizedWords) ? recognizedWords.length : 0;
          console.log('[OCR RAW]', {
            text: JSON.stringify(result.data.text),
            confidence: result.data.confidence,
            wordCount,
          });

          // Push formatted entry to on-screen debug log (only if thumbnail is shown)
          if (SHOW_DEBUG_THUMBNAIL) {
            const preview = result.data.text.trim().replace(/\s+/g, ' ').slice(0, 50);
            const setCodeMatch = preview.match(new RegExp(`(${KNOWN_SET_CODES.join('|')})`, 'i'));
            const status = setCodeMatch ? `✓ Set found: ${setCodeMatch[1]}` : `Raw: "${preview}"`;
            setOcrDebugLog(prev => [status, ...prev].slice(0, MAX_DEBUG_LOG_LINES));
          }

          // Release the processing lock
          isProcessingRef.current = false;
          
          if (DEBUG) console.log('[CameraScanner] Tesseract recognition completed');

          if (!isScanningRef.current) {
            if (DEBUG) console.log('[CameraScanner] Aborting after OCR: isScanning (ref) is false');
            return;
          }

          const text = result.data.text;
          const confidence = result.data.confidence;
          if (DEBUG) console.log('[CameraScanner] OCR Result text:', JSON.stringify(text));
          if (DEBUG) console.log('[CameraScanner] OCR Result confidence:', confidence);

          // Confidence-based filtering (disabled by default because OCR confidence is unreliable here).
          if (ENABLE_MIN_OCR_CONFIDENCE_CHECK && confidence < MIN_OCR_CONFIDENCE) {
            if (DEBUG) console.log('[CameraScanner] Low confidence result:', confidence, '(threshold:', MIN_OCR_CONFIDENCE, ')');
            setScanningStatus('Low confidence — adjust position/lighting');
            
            // Continue scanning
            if (isScanningRef.current) {
              setTimeout(scanFrame, 800);
            }
            return;
          }

          // Build a regex that matches ONLY known set codes followed by card numbers
          // Pattern: SET_CODE • NUMBER/TOTAL (e.g. "VEN • 153/221" or "SFD-100-298")
          const setCodePattern = KNOWN_SET_CODES.join('|');
          const strictPattern = new RegExp(
            `\\b(${setCodePattern})\\s*[-•·.\\s]+\\s*(\\d{1,4})\\s*(?:[/-•·]\\s*\\d{1,4})?\\b`,
            'i'
          );

          const match = text.match(strictPattern);
          let cardId: string | null = null;

          if (match) {
            const setCode = match[1].toUpperCase();
            const cardNumber = match[2];
            cardId = `${setCode}-${cardNumber}`;
            console.log('[CameraScanner] Matched known set code:', cardId, 'from:', JSON.stringify(text));
          } else {
            console.log('[CameraScanner] No match against known set codes in:', JSON.stringify(text));
          }

          if (cardId) {
            if (DEBUG) console.log('[CameraScanner] Card ID detected:', cardId);
            
            // Consecutive matching logic
            if (lastMatchRef.current && lastMatchRef.current.id === cardId) {
              lastMatchRef.current.count++;
              if (DEBUG) console.log('[CameraScanner] Consecutive match count:', lastMatchRef.current.count);
              
              if (lastMatchRef.current.count >= REQUIRED_CONSECUTIVE_MATCHES) {
                if (DEBUG) console.log('[CameraScanner] Required consecutive matches reached:', REQUIRED_CONSECUTIVE_MATCHES);
                console.log('[CameraScanner] Card ID detected:', cardId);
                setScanningStatus(`✓ Added: ${cardId}`);

                onCardIdDetected(cardId);
                setScannedCards(prev => [...prev, cardId]);
                setLastSuccessMessage(cardId);
                setTimeout(() => setLastSuccessMessage(null), 2000);
                setOcrDebugLog([]);

                setIsScanning(false);
                isScanningRef.current = false;
                lastMatchRef.current = null;

                setTimeout(() => {
                  setIsScanning(true);
                  isScanningRef.current = true;
                  scanFrame();
                }, RESTART_SCAN_DELAY);
                return;
              }
            } else {
              // New ID or different ID - reset counter
              lastMatchRef.current = { id: cardId, count: 1 };
              if (DEBUG) console.log('[CameraScanner] New ID detected, resetting counter');
            }
            
            setScanningStatus(`Match found (${lastMatchRef.current.count}/${REQUIRED_CONSECUTIVE_MATCHES}): ${cardId}`);
          } else {
            // Reset match tracking when no valid ID is found
            lastMatchRef.current = null;
          }

          // Show what OCR detected for debugging
          if (isScanningRef.current) {
            const previewText = text.trim().substring(0, 60).replace(/\s+/g, ' ');
            if (DEBUG) console.log('[CameraScanner] OCR detected (no valid format):', previewText);
            
            // Provide more detailed feedback about what was found
            if (previewText.length > 0) {
              setScanningStatus(`Detected: "${previewText}" (no valid ID format)`);
            } else {
              setScanningStatus('No text detected. Adjust position/lighting.');
            }
          }
        } catch (err) {
          // Release the processing lock on error
          isProcessingRef.current = false;
          console.error('[CameraScanner] OCR error:', err);
          if (isScanningRef.current) {
            setScanningStatus('Processing error. Retrying...');
          }
        }
      }

      // Continue scanning if still active
      if (isScanningRef.current && !isProcessingRef.current) {
        if (DEBUG) console.log('[CameraScanner] Scheduling next scan in 800ms');
        setTimeout(scanFrame, 800); // Scan every 0.8 seconds for faster feedback
      } else {
        if (DEBUG) console.log('[CameraScanner] Not scheduling next scan: isScanning (ref) is false or processing in progress');
      }
    } catch (err) {
      console.error('[CameraScanner] Error in scanFrame:', err);
      if (isScanningRef.current) {
        setScanningStatus('Scanning error. Retrying...');
        setTimeout(scanFrame, 1500);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 p-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Camera size={24} />
          Scan Card
        </h2>
        <button
          onClick={() => {
            const message = scannedCards.length > 0 
              ? `Scanned ${scannedCards.length} card${scannedCards.length > 1 ? 's' : ''}`
              : 'No cards scanned';
            console.log('[CameraScanner]', message, scannedCards);
            stopCamera();
            onClose();
          }}
          className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
        {error ? (
          <div className="text-center p-8">
            <div className="text-red-400 mb-4">
              <Camera size={64} className="mx-auto mb-4 opacity-50" />
            </div>
            <p className="text-white mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
            >
              Use Manual Entry
            </button>
          </div>
        ) : (
          <>
            {/* Video element - positioned absolutely to not interfere with overlays */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              controls={false}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ 
                transform: 'scale(1)',
                zIndex: 1
              }}
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Scanning overlay - higher z-index to stay on top */}
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
              {/* Debug thumbnail: show what Tesseract actually receives */}
              {SHOW_DEBUG_THUMBNAIL && debugImageUrl && (
                <div
                  className="absolute top-4 right-4 border-2 border-red-500 bg-black"
                  style={{ zIndex: 30, maxWidth: '40%' }}
                >
                  <img src={debugImageUrl} alt="OCR debug preview" style={{ width: '100%', display: 'block' }} />
                  <p className="text-red-400 text-[10px] text-center border-t border-red-500/50">OCR input</p>
                  <div className="bg-black/90 px-1 py-1 max-h-32 overflow-y-auto">
                    {ocrDebugLog.length === 0 ? (
                      <p className="text-gray-500 text-[9px] text-center">No OCR results yet</p>
                    ) : (
                      ocrDebugLog.map((line, i) => (
                        <p
                          key={i}
                          className={`text-[9px] font-mono leading-tight ${i === 0 ? 'text-green-400' : 'text-gray-500'}`}
                        >
                          {line}
                        </p>
                      ))
                    )}
                  </div>
                </div>
              )}
              
              {/* Text box guide in bottom-left */}
              <div
                ref={overlayRef}
                className="absolute bottom-8 left-4 border-4 border-purple-500 border-dashed rounded-lg animate-pulse pointer-events-none"
                style={{
                  width: `${TEXT_BOX_WIDTH_RATIO * 100}%`,
                  height: `${TEXT_BOX_HEIGHT_RATIO * 100}%`,
                }}
              >
                <div className="absolute -top-6 left-0 text-xs text-purple-300 font-semibold whitespace-nowrap">
                  Fill this box with the ID line
                </div>
              </div>
            </div>

            {lastSuccessMessage && (
              <div
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-500 text-white px-6 py-3 rounded-lg font-bold text-lg shadow-lg animate-bounce pointer-events-none"
                style={{ zIndex: 40 }}
              >
                ✓ Added: {lastSuccessMessage}
              </div>
            )}

            <button
              onClick={() => {
                setScannedCards([]);
                setLastSuccessMessage(null);
                setScanningStatus('Ready to scan');
              }}
              className="absolute bottom-4 right-4 px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
              style={{ zIndex: 25 }}
            >
              Clear ({scannedCards.length})
            </button>
          </>
        )}
      </div>

      {/* Scanning status bar - compact, positioned at bottom */}
      {!error && (
        <div className="bg-gray-900 border-t border-gray-700 p-3 relative" style={{ zIndex: 20 }}>
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-block bg-black/80 px-4 py-2 rounded-lg backdrop-blur-sm max-w-full">
              <p className="text-white text-xs font-medium line-clamp-1 overflow-hidden text-ellipsis whitespace-nowrap">
                {isScanning && <Loader2 size={14} className="inline animate-spin mr-1" />}
                {scanningStatus}
                {scannedCards.length > 0 && (
                  <span className="ml-2 text-purple-400">({scannedCards.length} scanned)</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
