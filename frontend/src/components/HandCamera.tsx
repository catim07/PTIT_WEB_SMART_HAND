import React, { useEffect, useRef, useState } from 'react';
import {
  Camera as CameraIcon,
  Loader2,
  Play,
  Settings,
  Monitor,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Hand,
  Zap,
  RotateCcw,
} from 'lucide-react';
import { type Landmark } from '../types';
import { drawHandSkeleton } from '../utils/drawing';
import { resetEMAFilter } from '../utils/algorithm';

interface HandCameraProps {
  onLandmarksDetected: (
    leftHand: Landmark[] | null,
    rightHand: Landmark[] | null,
    pose: Landmark[] | null
  ) => void;
  onTrackingLost: () => void;
  isRecording: boolean;
}

type ErrorType = 'PERMISSION_DENIED' | 'NOT_FOUND' | 'HARDWARE_IN_USE' | 'NOT_SUPPORTED' | 'UNKNOWN';

const FRAME_INTERVAL_MS = 33; // 30 FPS

/**
 * Robust getUserMedia with a hard timeout guard to prevent hardware driver hangs.
 */
const getUserMediaWithTimeout = (
  constraints: MediaStreamConstraints,
  timeoutMs = 5000
): Promise<MediaStream> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('HARDWARE_TIMEOUT: Thời gian phản hồi của thiết bị Camera vượt quá 5 giây.'));
    }, timeoutMs);

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        clearTimeout(timer);
        resolve(stream);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

export const HandCamera: React.FC<HandCameraProps> = ({
  onLandmarksDetected,
  onTrackingLost,
  isRecording,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const aiEngineRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const [modelLoading, setModelLoading] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isResettingAI, setIsResettingAI] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // Diagnostics State
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const [errorTitle, setErrorTitle] = useState<string>('');
  const [errorDescription, setErrorDescription] = useState<string>('');
  const [detectedDevices, setDetectedDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'CHROME' | 'FIREFOX' | 'WINDOWS'>('CHROME');

  const isAIEvaluatingRef = useRef<boolean>(false);
  const lastResultsTimestampRef = useRef<number>(Date.now());

  // Keep callback refs up to date
  const onLandmarksDetectedRef = useRef(onLandmarksDetected);
  const onTrackingLostRef = useRef(onTrackingLost);

  useEffect(() => {
    onLandmarksDetectedRef.current = onLandmarksDetected;
    onTrackingLostRef.current = onTrackingLost;
  }, [onLandmarksDetected, onTrackingLost]);

  // Reset MediaPipe WASM Engine manually
  const handleResetAIEngine = () => {
    setIsResettingAI(true);
    resetEMAFilter();
    console.log('>>> Manual Reset of MediaPipe Hands Engine requested...');

    if (aiEngineRef.current) {
      try {
        aiEngineRef.current.close();
      } catch (e) {
        console.warn('Error closing engine during manual reset:', e);
      }
      aiEngineRef.current = null;
    }
    isAIEvaluatingRef.current = false;
    lastResultsTimestampRef.current = Date.now();

    setTimeout(() => {
      setIsResettingAI(false);
      setResetSuccessMessage(true);
      setTimeout(() => setResetSuccessMessage(false), 3000);
    }, 400);
  };

  // Automated AI Stall Watchdog: Releases evaluation lock if MediaPipe stalls (>4000ms) without tearing down camera stream
  useEffect(() => {
    if (!cameraActive || isSimulating) return;

    const watchdogInterval = setInterval(() => {
      const elapsed = Date.now() - lastResultsTimestampRef.current;
      if (elapsed > 4000 && isAIEvaluatingRef.current) {
        console.warn(`[AI Watchdog] MediaPipe response stalled for ${elapsed}ms. Re-releasing frame lock...`);
        lastResultsTimestampRef.current = Date.now();
        isAIEvaluatingRef.current = false;
      }
    }, 1000);

    return () => clearInterval(watchdogInterval);
  }, [cameraActive, isSimulating]);

  // Enumerate video devices
  const checkVideoDevices = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setDetectedDevices(videoInputs);
        if (videoInputs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoInputs[0].deviceId);
        }
        return videoInputs;
      }
    } catch (e) {
      console.warn('Unable to enumerate devices:', e);
    }
    return [];
  };

  // Demo Simulation mode loop
  useEffect(() => {
    if (!isSimulating) return;

    let animationFrameId: number;
    let startTime = Date.now();

    const renderSimulation = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.strokeStyle = 'rgba(0, 242, 254, 0.05)';
          ctx.lineWidth = 1;
          for (let x = 0; x < canvas.width; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
          }
          for (let y = 0; y < canvas.height; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
          }

          const elapsed = Date.now() - startTime;
          const simHand = generateSimulatedHand(elapsed);

          drawHandSkeleton(ctx, simHand, canvas.width, canvas.height, isRecording);

          const simPose: Landmark[] = [
            { x: 0.5, y: 0.2, z: 0 },
            ...Array(10).fill({ x: 0.5, y: 0.2, z: 0 }),
            { x: 0.35, y: 0.4, z: 0 },
            { x: 0.65, y: 0.4, z: 0 },
          ];

          ctx.beginPath();
          ctx.moveTo(0.35 * canvas.width, 0.4 * canvas.height);
          ctx.lineTo(0.65 * canvas.width, 0.4 * canvas.height);
          ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
          ctx.lineWidth = 4;
          ctx.stroke();

          setHandDetected(true);
          onLandmarksDetectedRef.current(null, simHand, simPose);
        }
      }
      animationFrameId = requestAnimationFrame(renderSimulation);
    };

    renderSimulation();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isSimulating, isRecording]);

  useEffect(() => {
    if (isSimulating) return;

    let active = true;
    let animationFrameId: number;

    async function initCameraAndEngine() {
      try {
        setErrorType(null);
        setErrorTitle('');
        setErrorDescription('');
        setModelLoading(true);

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }

        const availableDevices = await checkVideoDevices();

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setErrorType('NOT_SUPPORTED');
          setErrorTitle('Trình duyệt không hỗ trợ API Camera (getUserMedia)');
          setErrorDescription('Vui lòng mở ứng dụng trong Google Chrome hoặc Microsoft Edge.');
          setModelLoading(false);
          return;
        }

        // 1. Aggressive Multi-Stage Camera Acquisition (Fastest { video: true } first)
        let stream: MediaStream | null = null;
        let lastError: any = null;

        // Stage 1: Pure unconstrained video stream (Fastest, 0 constraints, 100% compatible)
        try {
          stream = await getUserMediaWithTimeout({ video: true }, 3000);
        } catch (e1: any) {
          lastError = e1;
        }

        // Stage 2: User selected deviceId (only if non-empty valid deviceId)
        if (!stream && selectedDeviceId && selectedDeviceId.trim() !== '') {
          try {
            stream = await getUserMediaWithTimeout(
              { video: { deviceId: selectedDeviceId } },
              3000
            );
          } catch (e0) {
            lastError = e0;
          }
        }

        // Stage 3: Ideal 640x480 resolution stream
        if (!stream) {
          try {
            stream = await getUserMediaWithTimeout(
              {
                video: {
                  width: { ideal: 640 },
                  height: { ideal: 480 },
                },
              },
              3000
            );
          } catch (e3: any) {
            lastError = e3;
          }
        }

        // Stage 4: Iterate exact deviceIds for virtual/shared camera drivers
        if (!stream && availableDevices.length > 0) {
          for (const dev of availableDevices) {
            try {
              stream = await getUserMediaWithTimeout(
                { video: { deviceId: { exact: dev.deviceId } } },
                3000
              );
              if (stream) {
                setSelectedDeviceId(dev.deviceId);
                break;
              }
            } catch (d1) {
              try {
                stream = await getUserMediaWithTimeout(
                  { video: { deviceId: dev.deviceId } },
                  3000
                );
                if (stream) {
                  setSelectedDeviceId(dev.deviceId);
                  break;
                }
              } catch (d2) {}
            }
          }
        }

        // Stage 5: Ultra-basic fallback video constraint with 3s timeout
        if (!stream) {
          try {
            stream = await getUserMediaWithTimeout(
              { video: { width: { max: 320 }, height: { max: 240 } } },
              3000
            );
          } catch (e5: any) {
            lastError = e5;
          }
        }

        if (!stream) {
          const err2 = lastError || new Error('Unable to connect to camera');
          console.error('Camera getUserMedia error after aggressive retries:', err2);

          setModelLoading(false);
          if (
            err2.name === 'NotAllowedError' ||
            err2.name === 'PermissionDeniedError'
          ) {
            setErrorType('PERMISSION_DENIED');
            setErrorTitle('Quyền truy cập Camera bị từ chối');
            setErrorDescription(
              'Trình duyệt hoặc Windows đang chặn quyền truy cập camera. Bấm "Xin Lại Quyền" bên dưới.'
            );
          } else if (
            err2.name === 'NotFoundError' ||
            err2.name === 'DevicesNotFoundError' ||
            availableDevices.length === 0
          ) {
            setErrorType('NOT_FOUND');
            setErrorTitle('Không tìm thấy thiết bị Webcam nào');
            setErrorDescription(
              'Kiểm tra cáp USB hoặc phím tắt bật camera phần cứng trên máy tính.'
            );
          } else {
            setErrorType('HARDWARE_IN_USE');
            setErrorTitle('Thiết bị Camera đang bị ứng dụng khác chiếm dụng');
            setErrorDescription(
              'Camera của bạn có thể đang mở ở Zalo, Messenger, OBS, Zoom, hoặc Camera Windows. Bạn có thể Ép Bật lại hoặc chọn Chế Độ Mô Phỏng Demo bên dưới.'
            );
          }
          return;
        }

        mediaStreamRef.current = stream;
        setIsSimulating(false);
        setErrorType(null);
        setErrorTitle('');
        setErrorDescription('');

        // Stream Health Monitor & Track listeners
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onended = () => {
            console.warn('Camera video track ended unexpectedly. Re-acquiring...');
            setCameraActive(false);
            setRetryCount((prev) => prev + 1);
          };
          videoTrack.onmute = () => {
            console.warn('Camera video track muted.');
          };
          videoTrack.onunmute = () => {
            console.log('Camera video track unmuted.');
          };
        }

        // Bind stream to video element
        const video = videoRef.current;
        if (video && mediaStreamRef.current) {
          video.srcObject = mediaStreamRef.current;
          try {
            await video.play();
          } catch (e) {}
          setCameraActive(true);
          // Decouple Camera Display: Remove loading spinner as soon as video plays
          setModelLoading(false);
        }

        // 2. Results callback
        const handleResults = (results: any) => {
          if (!active) return;
          isAIEvaluatingRef.current = false;
          lastResultsTimestampRef.current = Date.now();

          const canvas = canvasRef.current;
          if (!canvas) return;

          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          const v = videoRef.current;
          if (v && v.videoWidth > 0 && v.videoHeight > 0) {
            if (canvas.width !== v.videoWidth) canvas.width = v.videoWidth;
            if (canvas.height !== v.videoHeight) canvas.height = v.videoHeight;
          }

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          let leftHand: Landmark[] | null = null;
          let rightHand: Landmark[] | null = null;
          let pose: Landmark[] | null = null;

          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            results.multiHandLandmarks.forEach(
              (landmarks: Landmark[], idx: number) => {
                if (!landmarks || landmarks.length !== 21) return;
                const handedness = results.multiHandedness?.[idx]?.label;
                if (handedness === 'Left') {
                  leftHand = landmarks;
                } else if (handedness === 'Right') {
                  rightHand = landmarks;
                } else {
                  if (!rightHand) rightHand = landmarks;
                  else if (!leftHand) leftHand = landmarks;
                }
                drawHandSkeleton(
                  ctx,
                  landmarks,
                  canvas.width,
                  canvas.height,
                  isRecording
                );
              }
            );
          }

          if (
            results.rightHandLandmarks &&
            results.rightHandLandmarks.length === 21
          ) {
            rightHand = results.rightHandLandmarks;
            drawHandSkeleton(
              ctx,
              results.rightHandLandmarks,
              canvas.width,
              canvas.height,
              isRecording
            );
          }
          if (
            results.leftHandLandmarks &&
            results.leftHandLandmarks.length === 21
          ) {
            leftHand = results.leftHandLandmarks;
            drawHandSkeleton(
              ctx,
              results.leftHandLandmarks,
              canvas.width,
              canvas.height,
              isRecording
            );
          }

          if (results.poseLandmarks) {
            const currentPose: Landmark[] = results.poseLandmarks;
            pose = currentPose;
            const leftShoulder = currentPose[11];
            const rightShoulder = currentPose[12];

            if (leftShoulder && rightShoulder) {
              ctx.beginPath();
              ctx.moveTo(
                leftShoulder.x * canvas.width,
                leftShoulder.y * canvas.height
              );
              ctx.lineTo(
                rightShoulder.x * canvas.width,
                rightShoulder.y * canvas.height
              );
              ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
              ctx.lineWidth = 4;
              ctx.stroke();
            }
          }

          if (leftHand || rightHand) {
            setHandDetected(true);
            onLandmarksDetectedRef.current(leftHand, rightHand, pose);
          } else {
            setHandDetected(false);
            resetEMAFilter();
            onTrackingLostRef.current();
          }
        };

        // Helper: Lazy-ensure MediaPipe Hands Engine instance
        const ensureEngine = () => {
          if (aiEngineRef.current) return aiEngineRef.current;
          const HandsClass = (window as any).Hands || (window as any).Holistic;
          if (HandsClass) {
            console.log('>>> Instantiating Local MediaPipe Hands Engine...');
            const engine = new HandsClass({
              locateFile: (file: string) => `/mediapipe/hands/${file}`,
            });
            engine.setOptions({
              maxNumHands: 2,
              modelComplexity: 1,
              minDetectionConfidence: 0.1,
              minTrackingConfidence: 0.1,
            });
            engine.onResults(handleResults);
            aiEngineRef.current = engine;
            return engine;
          }
          return null;
        };

        // Try initializing engine asynchronously in background
        setTimeout(() => {
          ensureEngine();
        }, 10);

        // 3. Continuous 30 FPS Processing Loop via Offscreen 2D Canvas Bitmap Snapshot
        let isProcessing = false;
        let lastFrameTime = 0;

        const processFrame = async () => {
          if (!active) return;

          // Strict Backpressure Guard: Skip frame if previous frame is still evaluating in Web Worker
          if (isAIEvaluatingRef.current) {
            if (active) animationFrameId = requestAnimationFrame(processFrame);
            return;
          }

          const now = Date.now();
          const v = videoRef.current;
          const engine = ensureEngine();

          if (
            v &&
            v.readyState >= 2 &&
            v.videoWidth > 0 &&
            engine &&
            !isProcessing &&
            now - lastFrameTime >= FRAME_INTERVAL_MS
          ) {
            lastFrameTime = now;
            isProcessing = true;
            isAIEvaluatingRef.current = true;
            try {
              await engine.send({ image: v });
            } catch (e) {
              console.warn('Frame process warning:', e);
              isAIEvaluatingRef.current = false;
            }
            isProcessing = false;
          }

          if (active) {
            animationFrameId = requestAnimationFrame(processFrame);
          }
        };

        animationFrameId = requestAnimationFrame(processFrame);
      } catch (err: any) {
        console.error('Error starting camera/AI:', err);
        setModelLoading(false);
        setErrorType('UNKNOWN');
        setErrorTitle('Không thể kết nối với Camera');
        setErrorDescription(err.message || 'Lỗi không xác định.');
      }
    }

    initCameraAndEngine();

    return () => {
      active = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isRecording, isSimulating, retryCount, selectedDeviceId]);

  // Clean up WASM model on unmount
  useEffect(() => {
    return () => {
      if (aiEngineRef.current) {
        try {
          aiEngineRef.current.close();
          aiEngineRef.current = null;
        } catch (e) {
          console.warn('Error closing WASM engine:', e);
        }
      }
    };
  }, []);

  // Handle Tab Focus Visibility Re-activation
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && cameraActive && videoRef.current) {
        if (videoRef.current.paused) {
          videoRef.current.play().catch(console.warn);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [cameraActive]);

  // Handle Hardware Device Change Events (e.g. physical laptop camera switch flipped ON/OFF)
  useEffect(() => {
    const handleDeviceChange = async () => {
      console.log('>>> Hardware devicechange event detected (Physical Switch / USB)...');
      await checkVideoDevices();
      // Auto-retry connection when physical hardware switch is flipped back ON
      if (!cameraActive) {
        setRetryCount((prev) => prev + 1);
      }
    };

    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    }
    return () => {
      if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      }
    };
  }, [cameraActive]);

  const handleForceRetryCamera = async () => {
    setIsSimulating(false);
    setErrorType(null);
    setModelLoading(true);
    try {
      const directStream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (directStream && videoRef.current) {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        }
        mediaStreamRef.current = directStream;
        videoRef.current.srcObject = directStream;
        await videoRef.current.play();
        setCameraActive(true);
        setModelLoading(false);
        return;
      }
    } catch (e) {
      console.warn('Direct user gesture getUserMedia warning:', e);
    }
    setRetryCount((prev) => prev + 1);
  };

  const handleRequestPermissionAgain = async () => {
    try {
      setErrorTitle('Đang xin cấp lại quyền...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      handleForceRetryCamera();
    } catch (e) {
      console.warn('Permission rejected:', e);
    }
  };

  const handleOpenWindowsPrivacy = () => {
    try {
      window.open('ms-settings:privacy-webcam');
    } catch (e) {
      alert('Mở Windows Settings -> Privacy & security -> Camera để bật quyền.');
    }
  };

  return (
    <div className="camera-wrapper">
      <video
        ref={videoRef}
        className="video-element"
        playsInline
        muted
        autoPlay
        style={{ display: 'block' }}
      />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="canvas-element"
        style={{ display: 'block' }}
      />

      {/* Loading Overlay */}
      {modelLoading && !isSimulating && !errorType && (
        <div className="camera-placeholder">
          <Loader2 className="animate-spin" size={48} style={{ color: 'var(--color-primary)' }} />
          <p style={{ marginTop: '12px' }}>Đang kết nối Camera Thật...</p>
        </div>
      )}

      {/* Diagnostics Panel */}
      {errorType && !isSimulating && (
        <div
          className="camera-placeholder"
          style={{
            padding: '20px',
            textAlign: 'left',
            maxWidth: '580px',
            margin: '0 auto',
            maxHeight: '460px',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <ShieldAlert size={36} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
            <div>
              <h4 style={{ color: '#fff', fontSize: '1.1rem', margin: 0 }}>{errorTitle}</h4>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', margin: '2px 0 0 0' }}>{errorDescription}</p>
            </div>
          </div>

          {detectedDevices.length > 0 ? (
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-primary)', fontWeight: '600', marginBottom: '6px' }}>
                <Monitor size={14} /> Tìm thấy {detectedDevices.length} thiết bị Camera:
              </div>
              <select
                value={selectedDeviceId}
                onChange={(e) => {
                  setSelectedDeviceId(e.target.value);
                  handleForceRetryCamera();
                }}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  background: '#090d16',
                  color: '#00f2fe',
                  border: '1px solid var(--color-primary)',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                }}
              >
                {detectedDevices.map((dev, idx) => (
                  <option key={dev.deviceId || idx} value={dev.deviceId}>
                    {dev.label || `Thiết bị Camera #${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.82rem', color: '#fca5a5' }}>
              ⚠️ Chưa quét thấy webcam phần cứng nào kết nối.
            </div>
          )}

          <div style={{ background: 'rgba(15, 23, 42, 0.6)', borderRadius: '10px', padding: '12px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '10px' }}>
              <button
                className={`btn btn-small ${activeTab === 'CHROME' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('CHROME')}
                style={{ fontSize: '0.78rem', padding: '4px 10px' }}
              >
                Chrome / Edge
              </button>
              <button
                className={`btn btn-small ${activeTab === 'FIREFOX' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('FIREFOX')}
                style={{ fontSize: '0.78rem', padding: '4px 10px' }}
              >
                Firefox
              </button>
              <button
                className={`btn btn-small ${activeTab === 'WINDOWS' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('WINDOWS')}
                style={{ fontSize: '0.78rem', padding: '4px 10px' }}
              >
                Quyền Windows 10/11
              </button>
            </div>

            <div style={{ fontSize: '0.83rem', lineHeight: '1.5', color: 'rgba(255,255,255,0.9)' }}>
              {activeTab === 'CHROME' && (
                <ol style={{ margin: 0, paddingLeft: '18px' }}>
                  <li>
                    Nhấp vào 🔒 <b>Ổ khóa</b> cạnh thanh URL <code>http://localhost:5173</code>.
                  </li>
                  <li>
                    Đổi <b>Camera</b> sang <b>Cho phép (Allow)</b>.
                  </li>
                  <li>
                    Bấm nút <b>⚡ Ép Bật Camera Thật</b> bên dưới.
                  </li>
                </ol>
              )}

              {activeTab === 'FIREFOX' && (
                <ol style={{ margin: 0, paddingLeft: '18px' }}>
                  <li>
                    Nhấp vào 🎥 <b>Camera gạch chéo</b> ở bên trái thanh URL.
                  </li>
                  <li>
                    Bấm <b>Xóa quyền đã chặn</b>.
                  </li>
                  <li>Tải lại trang và chọn Allow.</li>
                </ol>
              )}

              {activeTab === 'WINDOWS' && (
                <div>
                  <p style={{ margin: '0 0 8px 0' }}>Bật quyền truy cập camera trong hệ điều hành Windows:</p>
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={handleOpenWindowsPrivacy}
                    style={{ width: '100%', gap: '6px', justifyContent: 'center', background: 'rgba(0, 242, 254, 0.15)', border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }}
                  >
                    <Settings size={14} /> Mở Cài Đặt Quyền Camera Windows <ExternalLink size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <button className="btn btn-primary btn-small" onClick={handleForceRetryCamera} style={{ gap: '6px', justifyContent: 'center' }}>
              <Zap size={15} /> Ép Bật Camera Thật
            </button>
            <button className="btn btn-secondary btn-small" onClick={handleRequestPermissionAgain} style={{ gap: '6px', justifyContent: 'center' }}>
              <CheckCircle2 size={15} /> Xin Lại Quyền
            </button>
            <button
              className="btn btn-secondary btn-small"
              onClick={() => {
                setErrorType(null);
                setIsSimulating(true);
              }}
              style={{ gap: '6px', justifyContent: 'center', borderColor: '#f59e0b', color: '#f59e0b' }}
            >
              <Play size={15} /> Bật Demo
            </button>
          </div>
        </div>
      )}

      {/* HUD display with Manual AI Recovery Button */}
      {(cameraActive || isSimulating) && (
        <div className="camera-hud" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div className="camera-badge" style={isSimulating ? { borderColor: '#f59e0b', color: '#f59e0b' } : {}}>
            <CameraIcon size={14} style={{ color: isSimulating ? '#f59e0b' : 'var(--color-primary)' }} />
            <span>{isSimulating ? 'CHẾ ĐỘ MÔ PHỎNG DEMO' : 'TRACKING SẴN SÀNG'}</span>
          </div>

          {/* Prominent Recovery Button */}
          {!isSimulating && (
            <button
              onClick={handleResetAIEngine}
              disabled={isResettingAI}
              style={{
                background: 'rgba(0, 242, 254, 0.2)',
                border: '1px solid var(--color-primary)',
                color: '#00f2fe',
                padding: '4px 12px',
                borderRadius: '16px',
                fontSize: '0.78rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
                boxShadow: '0 0 10px rgba(0, 242, 254, 0.3)',
                transition: 'all 0.2s ease',
              }}
              title="Nhấp vào đây nếu AI không phát hiện được tay để khởi động lại bộ bắt khớp"
            >
              <RotateCcw size={13} className={isResettingAI ? 'animate-spin' : ''} />
              <span>{isResettingAI ? 'Đang Khôi Phục...' : '🔄 Khôi Phục AI Tracking'}</span>
            </button>
          )}

          {handDetected && !isSimulating && (
            <div className="camera-badge" style={{ borderColor: 'var(--color-success)', color: 'var(--color-success)' }}>
              <Hand size={14} />
              <span>ĐÃ BẮT ĐƯỢC 21 KHỚP TAY</span>
            </div>
          )}

          {resetSuccessMessage && (
            <div className="camera-badge animate-bounce" style={{ borderColor: '#10b981', color: '#10b981', background: 'rgba(16, 185, 129, 0.2)' }}>
              <CheckCircle2 size={14} />
              <span>ĐÃ KHÔI PHỤC BỘ NHẬN DIỆN AI!</span>
            </div>
          )}

          {isRecording && (
            <div className="camera-badge" style={{ border: '1px solid rgba(255,23,68,0.3)' }}>
              <div className="rec-dot animate-pulse" />
              <span style={{ color: 'var(--color-danger)' }}>DANG GHI CHUOI</span>
            </div>
          )}
        </div>
      )}

      {/* Hand Positioning Helper & Instant Recovery Floating Banner */}
      {!handDetected && cameraActive && !isSimulating && (
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(0, 242, 254, 0.4)',
            color: '#00f2fe',
            padding: '8px 16px',
            borderRadius: '24px',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 10,
            backdropFilter: 'blur(6px)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
          }}
        >
          <span>✋ Đưa cả bàn tay (cổ tay + 5 ngón) cách camera 30-40cm</span>
          <button
            onClick={handleResetAIEngine}
            disabled={isResettingAI}
            style={{
              background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
              color: '#090d16',
              border: 'none',
              padding: '4px 10px',
              borderRadius: '12px',
              fontWeight: 'bold',
              fontSize: '0.75rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <RotateCcw size={12} className={isResettingAI ? 'animate-spin' : ''} />
            Khôi Phục AI Ngay
          </button>
        </div>
      )}
    </div>
  );
};

// Helper function to generate simulated 21 hand landmarks for Demo Mode
function generateSimulatedHand(elapsedMs: number): Landmark[] {
  const t = elapsedMs * 0.002;
  const wristX = 0.5 + Math.sin(t * 0.5) * 0.08;
  const wristY = 0.6 + Math.cos(t * 0.7) * 0.04;
  const wristZ = 0;

  const landmarks: Landmark[] = new Array(21);
  landmarks[0] = { x: wristX, y: wristY, z: wristZ };

  const fingerBases = [
    { dx: -0.07, dy: -0.04 },
    { dx: -0.04, dy: -0.14 },
    { dx: 0.0, dy: -0.16 },
    { dx: 0.04, dy: -0.14 },
    { dx: 0.07, dy: -0.11 },
  ];

  let landmarkIndex = 1;
  fingerBases.forEach((base, f) => {
    const wave = Math.sin(t * 2 + f * 0.6) * 0.03;
    for (let segment = 1; segment <= 4; segment++) {
      landmarks[landmarkIndex++] = {
        x: wristX + base.dx * (segment / 4) + wave,
        y: wristY + base.dy * (segment / 4),
        z: -0.01 * segment,
      };
    }
  });

  return landmarks;
}
