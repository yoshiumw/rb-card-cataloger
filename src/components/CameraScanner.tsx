import React, { useRef, useEffect, useState } from 'react';
import { Camera, X, Loader2 } from 'lucide-react';
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
  const [scanningStatus, setScanningStatus] = useState('Initializing camera...');
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const initCamera = async () => {
      try {
        setError(null);
        setScanningStatus('Requesting camera access...');
        
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        
        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          // iOS Safari requires explicit play() call
          try {
            await videoRef.current.play();
          } catch (playErr) {
            console.error('Error playing video:', playErr);
          }
          
          setScanningStatus('Camera ready. Position card ID in the frame.');
          
          // Start scanning after video is loaded
          videoRef.current.onloadedmetadata = () => {
            if (mounted) {
              startScanning();
            }
          };
        }
      } catch (err) {
        if (!mounted) return;
        
        console.error('Error accessing camera:', err);
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
    // Delay start to ensure video is fully ready (especially for iOS)
    setTimeout(() => {
      setIsScanning(true);
      scanFrame();
    }, 500);
  };

  const scanFrame = async () => {
    // Check if we should continue scanning
    if (!isScanning) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Ensure video and canvas are ready
    if (!video || !canvas || video.readyState < 2) {
      // Video not ready yet, try again
      if (isScanning) {
        setTimeout(scanFrame, 100);
      }
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) return;

    try {
      // Set canvas size to match video
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;

      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Crop the bottom-left region where card ID typically appears
      const cropWidth = Math.floor(canvas.width * 0.3);
      const cropHeight = Math.floor(canvas.height * 0.15);
      const cropX = 0;
      const cropY = canvas.height - cropHeight;

      // Extract the region
      const imageData = context.getImageData(cropX, cropY, cropWidth, cropHeight);

      // Create a temporary canvas for the cropped region
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = cropWidth;
      tempCanvas.height = cropHeight;
      const tempContext = tempCanvas.getContext('2d');
      
      if (tempContext) {
        tempContext.putImageData(imageData, 0, 0);
        
        // Convert to data URL for Tesseract
        const imageUrl = tempCanvas.toDataURL('image/png');

        try {
          if (!isScanning) return; // Check again before processing
          
          setScanningStatus('Processing image...');
          
          // Use Tesseract to recognize text
          const result = await Tesseract.recognize(imageUrl, 'eng', {
            logger: (m) => {
              if (m.status === 'recognizing text' && isScanning) {
                setScanningStatus(`Recognizing... ${Math.round(m.progress * 100)}%`);
              }
            }
          });

          if (!isScanning) return; // Check again after processing

          const text = result.data.text;
          console.log('OCR Result:', text);

          // Extract card ID using regex
          const cardIdPattern = /\b([A-Z]{2,5}-\d{2,4}(?:-\d{2,4})?)\b/i;
          const match = text.match(cardIdPattern);

          if (match) {
            const cardId = match[1].toUpperCase();
            console.log('Card ID detected:', cardId);
            setScanningStatus(`Found: ${cardId}`);
            
            // Stop scanning and notify parent
            setIsScanning(false);
            stopCamera();
            
            // Small delay before callback to show success message
            setTimeout(() => {
              onCardIdDetected(cardId);
            }, 500);
            return;
          }

          if (isScanning) {
            setScanningStatus('No card ID found. Adjust position...');
          }
        } catch (err) {
          console.error('OCR error:', err);
          if (isScanning) {
            setScanningStatus('Processing error. Retrying...');
          }
        }
      }

      // Continue scanning if still active
      if (isScanning) {
        setTimeout(scanFrame, 1500); // Scan every 1.5 seconds
      }
    } catch (err) {
      console.error('Error in scanFrame:', err);
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
              <div className="absolute bottom-20 left-4 w-[30%] h-[15%] border-4 border-purple-500 border-dashed animate-pulse rounded-lg">
                <div className="absolute top-0 left-0 w-full h-full bg-purple-500/20 rounded-lg" />
                <div className="absolute -top-6 left-0 text-xs text-purple-300 font-semibold">
                  Card ID
                </div>
              </div>
              
              {/* Status text */}
              <div className="absolute top-4 left-4 right-4 text-center">
                <div className="inline-block bg-black/80 px-6 py-3 rounded-lg backdrop-blur-sm">
                  <p className="text-white text-sm font-medium">
                    {isScanning && <Loader2 size={16} className="inline animate-spin mr-2" />}
                    {scanningStatus}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Instructions - positioned above video with higher z-index */}
      {!error && (
        <div className="bg-gray-900 border-t border-gray-700 p-4 relative" style={{ zIndex: 20 }}>
          <div className="max-w-2xl mx-auto">
            <h3 className="text-white font-semibold mb-2">How to scan:</h3>
            <ul className="text-gray-400 text-sm space-y-1">
              <li>• Position the card so the ID in the bottom-left corner is visible</li>
              <li>• Ensure good lighting and the card is in focus</li>
              <li>• Hold steady while the scanner processes the image</li>
              <li>• The scanner will automatically detect and extract the card ID</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
