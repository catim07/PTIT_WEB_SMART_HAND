import React, { useEffect, useRef, useState } from 'react';
import {
  Camera as CameraIcon,
  AlertTriangle,
  Loader2,
  Play,
  RefreshCw,
  Settings,
  Monitor,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Hand,
} from 'lucide-react';
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

type ErrorType = 'PERMISSION_DENIED' | 'NOT_FOUND' | 'HARDWARE_IN_USE' | 'NOT_SUPPORTED' | 'UNKNOWN';

const FRAME_INTERVAL_MS = 33; // 30 FPS

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

  // Diagnostics State
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const [errorTitle, setErrorTitle] = useState<string>('');
  const [errorDescription, setErrorDescription] = useState<string>('');
  const [detectedDevices, setDetectedDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'CHROME' | 'FIREFOX' | 'WINDOWS'>('CHROME');

  // Keep callback refs up to date
  const onLandmarksDetectedRef = useRef(onLandmarksDetected);
  const onTrackingLostRef = useRef(onTrackingLost);

  useEffect(() => {
    onLandmarksDetectedRef.current = onLandmarksDetected;
    onTrackingLostRef.current = onTrackingLost;
  }, [onLandmarksDetected, onTrackingLost]);

  // Enumerate video devices
  const checkVideoDevices = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setDetectedDevices(videoInputs);
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
          ctx.moveTo((1 - 0.35) * canvas.width, 0.4 * canvas.height);
          ctx.lineTo((1 - 0.65) * canvas.width, 0.4 * canvas.height);
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

        const availableDevices = await checkVideoDevices();

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setErrorType('NOT_SUPPORTED');
          setErrorTitle('Trình duyệt không hỗ trợ API Camera (getUserMedia)');
          setErrorDescription('Vui lòng mở ứng dụng trong Google Chrome hoặc Microsoft Edge.');
          setModelLoading(false);
          return;
        }

        // 1. Get Direct HTML5 MediaStream with auto-retry and constraint fallback
        let stream: MediaStream | null = null;
        let lastError: any = null;

        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user',
              },
            });
            if (stream) break;
          } catch (err1: any) {
            lastError = err1;
            try {
              stream = await navigator.mediaDevices.getUserMedia({ video: true });
              if (stream) break;
            } catch (err2: any) {
              lastError = err2;
            }
          }
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 800));
          }
        }

        if (!stream) {
          const err2 = lastError || new Error('Unable to connect to camera');
          console.error('Camera getUserMedia error after retries:', err2);
          setModelLoading(false);
          if (err2.name === 'NotAllowedError' || err2.name === 'PermissionDeniedError') {
            setErrorType('PERMISSION_DENIED');
            setErrorTitle('Quyền truy cập Camera bị từ chối');
            setErrorDescription('Trình duyệt hoặc Windows đang chặn quyền truy cập camera. Hệ thống đang tự động thử xin lại...');
          } else if (err2.name === 'NotFoundError' || err2.name === 'DevicesNotFoundError' || availableDevices.length === 0) {
            setErrorType('NOT_FOUND');
            setErrorTitle('Không tìm thấy thiết bị Webcam nào');
            setErrorDescription('Kiểm tra cáp USB hoặc phím tắt bật camera phần ứng trên máy tính.');
          } else if (err2.name === 'NotReadableError' || err2.name === 'TrackStartError') {
            setErrorType('HARDWARE_IN_USE');
            setErrorTitle('Camera đang bị ứng dụng khác chiếm dụng (Đang tự động thử lại...)');
            setErrorDescription('Hãy đóng Zoom, Teams, Zalo, OBS hoặc ứng dụng Camera. Hệ thống sẽ tự động bật camera ngay khi bạn đóng ứng dụng đó.');
          } else {
            setErrorType('UNKNOWN');
            setErrorTitle('Không thể kết nối với Camera');
            setErrorDescription(err2.message || 'Lỗi không xác định.');
          }
          return;
        }

        mediaStreamRef.current = stream;

        // Bind stream to video element
        const video = videoRef.current;
        if (video && mediaStreamRef.current) {
          video.srcObject = mediaStreamRef.current;
          try {
            await video.play();
          } catch (e) {}
          setCameraActive(true);
        }

        // 2. Initialize MediaPipe Hands Singleton
        let retries = 0;
        while (!window.Hands && !window.Holistic && retries < 20) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          retries++;
        }
        if (!window.Hands && !window.Holistic) {
          throw new Error('Không thể nạp thư viện MediaPipe AI từ CDN. Vui lòng kiểm tra kết nối mạng.');
        }

        const handleResults = (results: any) => {
          if (!active) return;

          const canvas = canvasRef.current;
          if (!canvas) return;

          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          const video = videoRef.current;
          if (video && video.videoWidth > 0 && video.videoHeight > 0) {
            if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
            if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
          }

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          let leftHand: Landmark[] | null = null;
          let rightHand: Landmark[] | null = null;
          let pose: Landmark[] | null = null;

          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            results.multiHandLandmarks.forEach((landmarks: Landmark[], idx: number) => {
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
              drawHandSkeleton(ctx, landmarks, canvas.width, canvas.height, isRecording);
            });
          }

          if (results.rightHandLandmarks && results.rightHandLandmarks.length === 21) {
            rightHand = results.rightHandLandmarks;
            drawHandSkeleton(ctx, rightHand, canvas.width, canvas.height, isRecording);
          }
          if (results.leftHandLandmarks && results.leftHandLandmarks.length === 21) {
            leftHand = results.leftHandLandmarks;
            drawHandSkeleton(ctx, leftHand, canvas.width, canvas.height, isRecording);
          }

          if (results.poseLandmarks) {
            pose = results.poseLandmarks;
            const leftShoulder = pose[11];
            const rightShoulder = pose[12];

            if (leftShoulder && rightShoulder) {
              ctx.beginPath();
              ctx.moveTo((1 - leftShoulder.x) * canvas.width, leftShoulder.y * canvas.height);
              ctx.lineTo((1 - rightShoulder.x) * canvas.width, rightShoulder.y * canvas.height);
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
            onTrackingLostRef.current();
          }
        };

        if (!aiEngineRef.current) {
          if (window.Hands) {
            console.log('Initializing MediaPipe Hands Engine via UNPKG...');
            const hands = new window.Hands({
              locateFile: (file: string) => `https://unpkg.com/@mediapipe/hands/${file}`,
            });
            hands.setOptions({
              maxNumHands: 2,
              modelComplexity: 1,
              minDetectionConfidence: 0.2,
              minTrackingConfidence: 0.2,
            });
            hands.onResults(handleResults);
            aiEngineRef.current = hands;
          } else if (window.Holistic) {
            console.log('Initializing MediaPipe Holistic Engine via UNPKG...');
            const holistic = new window.Holistic({
              locateFile: (file: string) => `https://unpkg.com/@mediapipe/holistic/${file}`,
            });
            holistic.setOptions({
              modelComplexity: 1,
              smoothLandmarks: true,
              enableSegmentation: false,
              refineFaceLandmarks: false,
              minDetectionConfidence: 0.2,
              minTrackingConfidence: 0.2,
            });
            holistic.onResults(handleResults);
            aiEngineRef.current = holistic;
          }
        }

        setModelLoading(false);

        // 3. Direct 30 FPS RequestAnimationFrame Processing Loop
        let isProcessing = false;
        let lastFrameTime = 0;

        const processFrame = async () => {
          if (!active) return;

          const now = Date.now();
          const v = videoRef.current;
          if (
            v &&
            v.readyState >= 2 &&
            v.videoWidth > 0 &&
            aiEngineRef.current &&
            !isProcessing &&
            now - lastFrameTime >= FRAME_INTERVAL_MS
          ) {
            lastFrameTime = now;
            isProcessing = true;
            try {
              await aiEngineRef.current.send({ image: v });
            } catch (e) {
              console.warn('Frame process warning:', e);
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
  }, [isRecording, isSimulating, retryCount]);

  // Auto-recovery polling when camera is busy (HARDWARE_IN_USE) or error occurs
  useEffect(() => {
    if (!errorType || isSimulating) return;

    const timer = setInterval(() => {
      // Periodically trigger camera re-initialization automatically
      setRetryCount((prev) => prev + 1);
    }, 3500);

    return () => clearInterval(timer);
  }, [errorType, isSimulating]);

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

  const handleRequestPermissionAgain = async () => {
    try {
      setErrorTitle('Đang xin cấp lại quyền...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      setErrorType(null);
      setModelLoading(true);
      setRetryCount((prev) => prev + 1);
    } catch (e: any) {
      console.warn('Permission rejected:', e);
      setErrorType('PERMISSION_DENIED');
      setErrorTitle('Quyền truy cập Camera bị từ chối');
      setErrorDescription('Vui lòng nhấp vào biểu tượng 🔒 ở góc đường dẫn để cho phép Camera.');
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
          <p style={{ marginTop: '12px' }}>Đang kết nối Camera & nạp mô hình AI MediaPipe Hands...</p>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-primary)', fontWeight: '600', marginBottom: '4px' }}>
                <Monitor size={14} /> Tìm thấy {detectedDevices.length} thiết bị VideoInput:
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', color: 'rgba(255,255,255,0.8)' }}>
                {detectedDevices.map((dev, idx) => (
                  <li key={idx}>{dev.label || `Thiết bị Camera #${idx + 1}`}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.82rem', color: '#fca5a5' }}>
              ⚠️ Không phát hiện webcam phần cứng nào kết nối với hệ thống.
            </div>
          )}

          <div style={{ background: 'rgba(15, 23, 42, 0.6)', borderRadius: '10px', padding: '12px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid rgba(255,255,255,0.1)', pb: '8px', marginBottom: '10px' }}>
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
                    Bấm nút <b>Xin Lại Quyền Camera</b> bên dưới.
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button className="btn btn-primary btn-small" onClick={handleRequestPermissionAgain} style={{ gap: '6px', justifyContent: 'center' }}>
              <CheckCircle2 size={15} /> Xin Lại Quyền Camera
            </button>
            <button
              className="btn btn-secondary btn-small"
              onClick={() => {
                setErrorType(null);
                setIsSimulating(true);
              }}
              style={{ gap: '6px', justifyContent: 'center', borderColor: '#f59e0b', color: '#f59e0b' }}
            >
              <Play size={15} /> Bật Chế Độ Demo
            </button>
          </div>
        </div>
      )}

      {/* HUD display */}
      {(cameraActive || isSimulating) && (
        <div className="camera-hud">
          <div className="camera-badge" style={isSimulating ? { borderColor: '#f59e0b', color: '#f59e0b' } : {}}>
            <CameraIcon size={14} style={{ color: isSimulating ? '#f59e0b' : 'var(--color-primary)' }} />
            <span>{isSimulating ? 'CHẾ ĐỘ MÔ PHỎNG DEMO' : 'TRACKING SẴN SÀNG'}</span>
          </div>

          {handDetected && !isSimulating && (
            <div className="camera-badge" style={{ borderColor: 'var(--color-success)', color: 'var(--color-success)' }}>
              <Hand size={14} />
              <span>ĐÃ BẮT ĐƯỢC 21 KHỚP TAY</span>
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

      {/* Hand Positioning Helper Banner */}
      {!handDetected && cameraActive && !isSimulating && (
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(0, 242, 254, 0.3)',
            color: '#00f2fe',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            zIndex: 10,
            backdropFilter: 'blur(4px)',
            pointerEvents: 'none',
          }}
        >
          ✋ Đưa cả bàn tay (gồm cổ tay và 5 ngón tay) cách camera khoảng 30 - 40 cm
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
