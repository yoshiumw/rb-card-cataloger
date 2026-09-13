import React, { useRef, useEffect, useState } from 'react';
import { Camera, X, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import Tesseract from 'tesseract.js';

interface CameraScannerProps {
  onCardIdDetected: (cardId: string) => void;
  onClose: () => void;
}

export default function CameraScanner({ onCardIdDetected, onClose }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanningStatus, setScanningStatus] = useState('Initializing OCR engine...');
  const [showInstructions, setShowInstructions] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let mounted = true;
    
    console.log('[CameraScanner] Component mounted, initializing camera...');
    
    const initCamera = async () => {
      try {
        setError(null);
        console.log('[CameraScanner] Requesting camera access...');
        
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        
        console.log('[CameraScanner] Camera access granted, stream obtained');
        
        if (!mounted) {
          console.log('[CameraScanner] Component unmounted during camera init, stopping stream');
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        streamRef.current = stream;
        
        if (videoRef.current) {
          const video = videoRef.current;
          video.srcObject = stream;
          console.log('[CameraScanner] Video srcObject set');
          console.log('[CameraScanner] Video readyState before play:', video.readyState);
          
          // iOS Safari requires explicit play() call
          try {
            await video.play();
            console.log('[CameraScanner] Video playback started');
            console.log('[CameraScanner] Video readyState after play:', video.readyState);
          } catch (playErr) {
            console.error('[CameraScanner] Error playing video:', playErr);
          }
          
          // Track if we've already started scanning to avoid duplicates
          let scanStarted = false;
          const tryStartScanning = () => {
            if (scanStarted || !mounted) {
              console.log('[CameraScanner] Skipping duplicate startScanning call, scanStarted:', scanStarted, 'mounted:', mounted);
              return;
            }
            scanStarted = true;
            console.log('[CameraScanner] Video ready, starting scanning (readyState:', video.readyState, ')');
            startScanning();
          };
          
          // Multiple fallback methods to ensure scanning starts
          // Method 1: onloadedmetadata
          video.onloadedmetadata = () => {
            console.log('[CameraScanner] Video metadata loaded event fired');
            tryStartScanning();
          };
          
          // Method 2: onloadeddata - fires when first frame data is loaded
          video.onloadeddata = () => {
            console.log('[CameraScanner] Video loadeddata event fired');
            tryStartScanning();
          };
          
          // Method 3: oncanplay - fires when enough data is loaded to start playing
          video.oncanplay = () => {
            console.log('[CameraScanner] Video canplay event fired');
            tryStartScanning();
          };
          
          // Method 4: Fallback timeout - if events don't fire, start anyway after 2 seconds
          console.log('[CameraScanner] Setting 2s fallback timeout to start scanning');
          setTimeout(() => {
            console.log('[CameraScanner] Fallback timeout reached, readyState:', video.readyState);
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
      console.log('[CameraScanner] Component unmounting');
      mounted = false;
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    setIsScanning(false);
    
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
    console.log('[CameraScanner] startScanning called');
    // Set scanning flag immediately and start the scan loop
    setIsScanning(true);
    // Use requestAnimationFrame or small delay to ensure state propagates
    setTimeout(() => {
      console.log('[CameraScanner] Starting first scan frame');
      scanFrame();
    }, 100);
  };

  const scanFrame = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Check if we should continue scanning (use ref for immediate value)
    const shouldScan = isScanning;
    console.log('[CameraScanner] scanFrame started, video readyState:', video?.readyState, 'isScanning:', shouldScan);
    
    if (!shouldScan) {
      console.log('[CameraScanner] scanFrame aborted: scanning was stopped');
      return;
    }
    
    // Ensure video and canvas are ready
    if (!video || !canvas || video.readyState < 2) {
      // Video not ready yet, try again
      console.log('[CameraScanner] Video not ready (readyState:', video?.readyState, '), retrying in 100ms');
      if (isScanning) {
        setTimeout(scanFrame, 100);
      }
      return;
    }
    
    console.log('[CameraScanner] Video is ready, proceeding with OCR');

    const context = canvas.getContext('2d');
    if (!context) {
      console.error('[CameraScanner] Failed to get canvas context');
      return;
    }

    try {
      // Set canvas size to match video
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      console.log('[CameraScanner] Canvas size:', canvas.width, 'x', canvas.height);

      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Crop a larger region to capture card ID more reliably
      // Card IDs can appear in various positions depending on device orientation
      const cropWidth = Math.floor(canvas.width * 0.5);
      const cropHeight = Math.floor(canvas.height * 0.25);
      const cropX = 0;
      const cropY = canvas.height - cropHeight;
      console.log('[CameraScanner] Crop region:', { x: cropX, y: cropY, width: cropWidth, height: cropHeight });

      // Extract the region
      const imageData = context.getImageData(cropX, cropY, cropWidth, cropHeight);

      // Create a temporary canvas for the cropped region
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = cropWidth;
      tempCanvas.height = cropHeight;
      const tempContext = tempCanvas.getContext('2d');
      
      if (tempContext) {
        tempContext.putImageData(imageData, 0, 0);
        
        // Apply image preprocessing for better OCR accuracy
        // Convert to grayscale and increase contrast
        const pixels = tempContext.getImageData(0, 0, cropWidth, cropHeight);
        const data = pixels.data;
        for (let i = 0; i < data.length; i += 4) {
          // Convert to grayscale using luminance formula
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          
          // Apply threshold for binarization (improves OCR accuracy)
          const threshold = 128;
          const value = gray > threshold ? 255 : 0;
          
          data[i] = value;     // R
          data[i + 1] = value; // G
          data[i + 2] = value; // B
        }
        tempContext.putImageData(pixels, 0, 0);
        
        // Convert to data URL for Tesseract
        const imageUrl = tempCanvas.toDataURL('image/png');
        console.log('[CameraScanner] Image URL generated, length:', imageUrl.length);

        try {
          if (!isScanning) {
            console.log('[CameraScanner] Aborting before OCR: isScanning is false');
            return;
          }
          
          console.log('[CameraScanner] Starting Tesseract recognition...');
          console.log('[CameraScanner] Tesseract worker initializing with image size:', cropWidth, 'x', cropHeight);
          setScanningStatus('Loading OCR engine...');
          
          // Use Tesseract to recognize text with enhanced configuration for better accuracy
          const worker = await Tesseract.createWorker('eng', 2, {
            logger: (m) => {
              console.log('[Tesseract Logger]', m.status, m.progress ? `(${Math.round(m.progress * 100)}%)` : '');
              if (m.status === 'recognizing text' && isScanning) {
                setScanningStatus(`Recognizing... ${Math.round(m.progress * 100)}%`);
              } else if (m.status === 'initializing tesseract' && isScanning) {
                setScanningStatus('Initializing OCR engine...');
              } else if (m.status === 'loading tesseract core' && isScanning) {
                setScanningStatus('Loading OCR core...');
              } else if (m.status === 'initialized tesseract' && isScanning) {
                setScanningStatus('OCR initialized, processing...');
              }
            }
          });
          
          await worker.setParameters({
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-•·/',
            preserve_interword_spaces: '1'
          });
          
          const result = await worker.recognize(imageUrl);
          await worker.terminate();
          
          console.log('[CameraScanner] Tesseract recognition completed');

          if (!isScanning) {
            console.log('[CameraScanner] Aborting after OCR: isScanning is false');
            return;
          }

          const text = result.data.text;
          console.log('[CameraScanner] OCR Result text:', JSON.stringify(text));
          console.log('[CameraScanner] OCR Result confidence:', result.data.confidence);
          console.log('[CameraScanner] OCR Result words:', result.data.words);

          // Extract card ID using regex - handles multiple formats:
          // 1. "SFD • 100/1xx" (actual card format with bullet and set size)
          // 2. "SFD-100" (API format)
          // 3. "SFD-100-298" (API format with set size)
          
          let cardId = null;
          
          // Try to match "SET • NUMBER/TOTAL" format first
          const bulletPattern = /\b([A-Z]{2,5})\s*[•·]\s*(\d{1,4})(?:\/\d{1,4})?\b/i;
          const bulletMatch = text.match(bulletPattern);
          
          if (bulletMatch) {
            // Convert "SFD • 100/1xx" to "SFD-100"
            const setCode = bulletMatch[1].toUpperCase();
            const cardNumber = bulletMatch[2];
            cardId = `${setCode}-${cardNumber}`;
            console.log('[CameraScanner] Matched bullet pattern:', cardId);
          } else {
            // Try standard dash format
            const dashPattern = /\b([A-Z]{2,5}-\d{2,4}(?:-\d{2,4})?)\b/i;
            const dashMatch = text.match(dashPattern);
            
            if (dashMatch) {
              cardId = dashMatch[1].toUpperCase();
              console.log('[CameraScanner] Matched dash pattern:', cardId);
            } else {
              console.log('[CameraScanner] No pattern matched in text:', JSON.stringify(text));
            }
          }

          if (cardId) {
            console.log('[CameraScanner] Card ID detected:', cardId);
            setScanningStatus(`✓ Found: ${cardId}`);
            
            // Stop scanning and notify parent
            setIsScanning(false);
            stopCamera();
            
            // Small delay before callback to show success message
            setTimeout(() => {
              onCardIdDetected(cardId!);
            }, 500);
            return;
          }

          // Show what OCR detected for debugging
          if (isScanning) {
            const previewText = text.trim().substring(0, 60).replace(/\s+/g, ' ');
            console.log('[CameraScanner] OCR detected (no valid format):', previewText);
            
            // Provide more detailed feedback about what was found
            if (previewText.length > 0) {
              setScanningStatus(`Detected: "${previewText}" (no valid ID format)`);
            } else {
              setScanningStatus('No text detected. Adjust position/lighting.');
            }
          }
        } catch (err) {
          console.error('[CameraScanner] OCR error:', err);
          if (isScanning) {
            setScanningStatus('Processing error. Retrying...');
          }
        }
      }

      // Continue scanning if still active
      if (isScanning) {
        console.log('[CameraScanner] Scheduling next scan in 800ms');
        setTimeout(scanFrame, 800); // Scan every 0.8 seconds for faster feedback
      } else {
        console.log('[CameraScanner] Not scheduling next scan: isScanning is false');
      }
    } catch (err) {
      console.error('[CameraScanner] Error in scanFrame:', err);
      if (isScanning) {
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
