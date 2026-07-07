import React, { useEffect, useRef, useState } from 'react';
import { Camera as CameraIcon, AlertTriangle, Loader2 } from 'lucide-react';
import { type Landmark } from '../types';
import { drawHandSkeleton } from '../utils/drawing';

interface HandCameraProps {
  onLandmarksDetected: (
    leftHand: Landmark[] | null,
    rightHand: Landmark[] | null,
    pose: Landmark[] | null
  ) => void;
  onTrackingLost: () => void;
  isRecording: boolean;
}

export const HandCamera: React.FC<HandCameraProps> = ({
  onLandmarksDetected,
  onTrackingLost,
  isRecording,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [modelLoading, setModelLoading] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Keep callback refs up to date to avoid re-triggering effects
  const onLandmarksDetectedRef = useRef(onLandmarksDetected);
  const onTrackingLostRef = useRef(onTrackingLost);

  useEffect(() => {
    onLandmarksDetectedRef.current = onLandmarksDetected;
    onTrackingLostRef.current = onTrackingLost;
  }, [onLandmarksDetected, onTrackingLost]);

  useEffect(() => {
    let holistic: any = null;
    let camera: any = null;
    let active = true;

    async function initMediaPipe() {
      try {
        if (!window.Holistic || !window.Camera) {
          // Wait briefly in case scripts are still loading
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (!window.Holistic || !window.Camera) {
            throw new Error('MediaPipe Holistic library failed to load. Please check your internet connection.');
          }
        }

        // Initialize Holistic model
        holistic = new window.Holistic({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
        });

        holistic.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          refineFaceLandmarks: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        // Set callback for results
        holistic.onResults((results: any) => {
          if (!active) return;

          const canvas = canvasRef.current;
          if (!canvas) return;

          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Draw skeletons for both hands if present
          if (results.rightHandLandmarks) {
            drawHandSkeleton(ctx, results.rightHandLandmarks as Landmark[], canvas.width, canvas.height, isRecording);
          }
          if (results.leftHandLandmarks) {
            drawHandSkeleton(ctx, results.leftHandLandmarks as Landmark[], canvas.width, canvas.height, isRecording);
          }

          // Draw Pose body (shoulders, face center)
          if (results.poseLandmarks) {
            const leftShoulder = results.poseLandmarks[11];
            const rightShoulder = results.poseLandmarks[12];
            const nose = results.poseLandmarks[0];

            // Draw line connecting shoulders
            if (leftShoulder && rightShoulder) {
              ctx.beginPath();
              ctx.moveTo((1 - leftShoulder.x) * canvas.width, leftShoulder.y * canvas.height);
              ctx.lineTo((1 - rightShoulder.x) * canvas.width, rightShoulder.y * canvas.height);
              ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
              ctx.lineWidth = 4;
              ctx.stroke();

              // Draw shoulder nodes
              ctx.beginPath();
              ctx.arc((1 - leftShoulder.x) * canvas.width, leftShoulder.y * canvas.height, 6, 0, 2 * Math.PI);
              ctx.arc((1 - rightShoulder.x) * canvas.width, rightShoulder.y * canvas.height, 6, 0, 2 * Math.PI);
              ctx.fillStyle = '#00f2fe';
              ctx.fill();
            }

            // Draw nose landmark to denote mouth/face location
            if (nose) {
              ctx.beginPath();
              ctx.arc((1 - nose.x) * canvas.width, nose.y * canvas.height, 8, 0, 2 * Math.PI);
              ctx.fillStyle = '#ff1744';
              ctx.shadowBlur = 8;
              ctx.shadowColor = '#ff1744';
              ctx.fill();
              ctx.shadowBlur = 0;
            }
          }

          if (results.leftHandLandmarks || results.rightHandLandmarks) {
            // Dispatch both hand landmarks + pose landmarks to parent
            onLandmarksDetectedRef.current(
              results.leftHandLandmarks || null,
              results.rightHandLandmarks || null,
              results.poseLandmarks || null
            );
          } else {
            onTrackingLostRef.current();
          }
        });

        setModelLoading(false);

        // Start video stream
        const video = videoRef.current;
        if (video) {
          camera = new window.Camera(video, {
            onFrame: async () => {
              if (video && active) {
                await holistic.send({ image: video });
              }
            },
            width: 640,
            height: 480,
          });

          await camera.start();
          setCameraActive(true);
        }
      } catch (err: any) {
        console.error('Error starting MediaPipe Holistic:', err);
        setErrorMsg(err.message || 'Không thể khởi động camera hoặc mô hình Holistic.');
        setModelLoading(false);
      }
    }

    initMediaPipe();

    return () => {
      active = false;
      if (camera) {
        try {
          camera.stop();
        } catch (e) {
          console.warn('Error stopping camera:', e);
        }
      }
      if (holistic) {
        try {
          holistic.close();
        } catch (e) {
          console.warn('Error closing MediaPipe Holistic:', e);
        }
      }
    };
  }, [isRecording]);

  return (
    <div className="camera-wrapper">
      <video
        ref={videoRef}
        className="video-element"
        playsInline
        muted
        autoPlay
        style={{ display: cameraActive ? 'block' : 'none' }}
      />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="canvas-element"
        style={{ display: cameraActive ? 'block' : 'none' }}
      />

      {/* Loading Overlay */}
      {modelLoading && (
        <div className="camera-placeholder">
          <Loader2 className="animate-spin" size={48} style={{ color: 'var(--color-primary)' }} />
          <p>Đang khởi tạo máy ảnh & tải Holistic Model...</p>
        </div>
      )}

      {/* Error Overlay */}
      {errorMsg && (
        <div className="camera-placeholder" style={{ padding: '20px', textAlign: 'center' }}>
          <AlertTriangle size={48} style={{ color: 'var(--color-danger)' }} />
          <p style={{ marginTop: '12px', fontWeight: '500' }}>{errorMsg}</p>
          <button className="btn btn-secondary btn-small" style={{ marginTop: '12px' }} onClick={() => window.location.reload()}>
            Tải lại trang
          </button>
        </div>
      )}

      {/* HUD display */}
      {cameraActive && !modelLoading && (
        <div className="camera-hud">
          <div className="camera-badge">
            <CameraIcon size={14} style={{ color: 'var(--color-primary)' }} />
            <span>HOLISTIC TRACKING</span>
          </div>
          {isRecording && (
            <div className="camera-badge" style={{ border: '1px solid rgba(255,23,68,0.3)' }}>
              <div className="rec-dot animate-pulse" />
              <span style={{ color: 'var(--color-danger)' }}>DANG GHI CHUOI</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
