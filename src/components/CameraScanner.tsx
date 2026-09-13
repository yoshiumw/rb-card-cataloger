import React, { useRef, useEffect, useState } from 'react';
import { Camera, X, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import Tesseract, { PSM } from 'tesseract.js';

// Configuration constants
const DEBUG = false;
const ENABLE_EROSION = false;
const MIN_OCR_CONFIDENCE = 60;
const REQUIRED_CONSECUTIVE_MATCHES = 2;
const PSM_MODE = PSM.SINGLE_LINE; // Alternative: PSM.SPARSE_TEXT

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Tesseract.Worker | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const lastMatchRef = useRef<{ id: string; count: number } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanningStatus, setScanningStatus] = useState('Initializing OCR engine...');
  const [showInstructions, setShowInstructions] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const isScanningRef = useRef(false);

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
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-•·/',
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
            width: { ideal: 1280 },
            height: { ideal: 720 }
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

      // Crop a larger region to capture card ID more reliably
      // Card IDs can appear in various positions depending on device orientation
      const cropWidth = Math.floor(canvas.width * 0.5);
      const cropHeight = Math.floor(canvas.height * 0.25);
      const cropX = 0;
      const cropY = canvas.height - cropHeight;
      if (DEBUG) console.log('[CameraScanner] Crop region:', { x: cropX, y: cropY, width: cropWidth, height: cropHeight });

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
        
        // Step 4: Apply Otsu's method for adaptive threshold binarization
        const otsuThreshold = computeOtsuThreshold(data);
        if (DEBUG) console.log('[CameraScanner] Otsu threshold computed:', otsuThreshold);
        
        for (let i = 0; i < data.length; i += 4) {
          const gray = data[i];
          const value = gray > otsuThreshold ? 255 : 0;
          data[i] = value;
          data[i + 1] = value;
          data[i + 2] = value;
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
        const imageUrl = scaledCanvas.toDataURL('image/png');
        if (DEBUG) console.log('[CameraScanner] Preprocessed image URL generated, size:', scaledWidth, 'x', scaledHeight);

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
          if (DEBUG) console.log('[CameraScanner] OCR Result words:', result.data.words);

          // Confidence-based filtering
          if (confidence < MIN_OCR_CONFIDENCE) {
            if (DEBUG) console.log('[CameraScanner] Low confidence result:', confidence, '(threshold:', MIN_OCR_CONFIDENCE, ')');
            setScanningStatus('Low confidence — adjust position/lighting');
            
            // Continue scanning
            if (isScanningRef.current) {
              setTimeout(scanFrame, 800);
            }
            return;
          }

          // Extract card ID using regex - handles multiple formats:
          // 1. "SFD • 100/1xx" (actual card format with bullet and set size)
          // 2. "SFD-100" (API format)
          // 3. "SFD-100-298" (API format with set size)
          
          let cardId: string | null = null;
          
          // Try to match "SET • NUMBER/TOTAL" format first
          const bulletPattern = /\b([A-Z]{2,5})\s*[•·]\s*(\d{1,4})(?:\/\d{1,4})?\b/i;
          const bulletMatch = text.match(bulletPattern);
          
          if (bulletMatch) {
            // Convert "SFD • 100/1xx" to "SFD-100"
            const setCode = bulletMatch[1].toUpperCase();
            const cardNumber = bulletMatch[2];
            cardId = `${setCode}-${cardNumber}`;
            if (DEBUG) console.log('[CameraScanner] Matched bullet pattern:', cardId);
          } else {
            // Try standard dash format
            const dashPattern = /\b([A-Z]{2,5}-\d{2,4}(?:-\d{2,4})?)\b/i;
            const dashMatch = text.match(dashPattern);
            
            if (dashMatch) {
              cardId = dashMatch[1].toUpperCase();
              if (DEBUG) console.log('[CameraScanner] Matched dash pattern:', cardId);
            } else {
              if (DEBUG) console.log('[CameraScanner] No pattern matched in text:', JSON.stringify(text));
            }
          }

          if (cardId) {
            if (DEBUG) console.log('[CameraScanner] Card ID detected:', cardId);
            
            // Consecutive matching logic
            if (lastMatchRef.current && lastMatchRef.current.id === cardId) {
              lastMatchRef.current.count++;
              if (DEBUG) console.log('[CameraScanner] Consecutive match count:', lastMatchRef.current.count);
              
              if (lastMatchRef.current.count >= REQUIRED_CONSECUTIVE_MATCHES) {
                if (DEBUG) console.log('[CameraScanner] Required consecutive matches reached:', REQUIRED_CONSECUTIVE_MATCHES);
                setScanningStatus(`✓ Found: ${cardId}`);
                
                // Stop scanning and notify parent
                setIsScanning(false);
                stopCamera();
                lastMatchRef.current = null;
                
                // Small delay before callback to show success message
                setTimeout(() => {
                  onCardIdDetected(cardId!);
                }, 500);
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
              {/* Scanning region indicator */}
              <div className="absolute bottom-20 left-4 w-[50%] h-[25%] border-4 border-purple-500 border-dashed animate-pulse rounded-lg">
                <div className="absolute top-0 left-0 w-full h-full bg-purple-500/20 rounded-lg" />
                <div className="absolute -top-6 left-0 text-xs text-purple-300 font-semibold">
                  Card ID Area
                </div>
              </div>
              
              {/* Status text - compact, positioned at bottom near scanning area */}
              <div className="absolute bottom-4 left-4 right-4 text-center">
                <div className="inline-block bg-black/80 px-4 py-2 rounded-lg backdrop-blur-sm max-w-full">
                  <p className="text-white text-xs font-medium truncate">
                    {isScanning && <Loader2 size={14} className="inline animate-spin mr-1" />}
                    {scanningStatus}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Collapsible Instructions */}
      {!error && (
        <div className="bg-gray-900 border-t border-gray-700 relative" style={{ zIndex: 20 }}>
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="w-full p-3 flex items-center justify-between text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <span className="text-sm font-medium">How to scan</span>
            {showInstructions ? (
              <ChevronUp size={18} />
            ) : (
              <ChevronDown size={18} />
            )}
          </button>
          {showInstructions && (
            <div className="px-4 pb-4 max-w-2xl mx-auto">
              <ul className="text-gray-400 text-sm space-y-1">
                <li>• Position the card so the ID in the bottom-left corner is within the purple frame</li>
                <li>• Ensure good lighting - avoid shadows and glare on the card</li>
                <li>• Hold steady while the scanner processes the image (watch for status updates)</li>
                <li>• The scanner will automatically detect and extract the card ID</li>
                <li>• If text is detected but not recognized, try adjusting the angle or distance</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
