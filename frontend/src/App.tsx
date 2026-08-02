import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Cpu, 
  Wifi, 
  WifiOff,
  Mic,
  MicOff,
  Play,
  AlertTriangle,
  Info,
  RotateCcw,
  Layers
} from 'lucide-react';

import { HandCamera } from './components/HandCamera';
import { GestureTrainer } from './components/GestureTrainer';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { ControlPanel } from './components/ControlPanel';
import { SmartSentenceBuilder } from './components/SmartSentenceBuilder';
import { QuickCommunicationCards } from './components/QuickCommunicationCards';
import { LiveChatHub, type ChatMessage } from './components/LiveChatHub';

import { type Landmark, type GestureSample, type GestureTemplate, type SystemSettings, type RecognitionStats } from './types';
import { extractFeatures, countExtendedFingers, detectDualHandGesture, resetEMAFilter } from './utils/algorithm';
import { drawHandSkeleton } from './utils/drawing';
import * as api from './utils/api';

function App() {
  // --- Core State ---
  const [samples, setSamples] = useState<GestureSample[]>([]);
  const [templates, setTemplates] = useState<GestureTemplate[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [stats, setStats] = useState<RecognitionStats | null>(null);
  
  // Real-time Frame State
  const [activeLandmarks, setActiveLandmarks] = useState<Landmark[] | null>(null);
  const [activeFeatureVector, setActiveFeatureVector] = useState<number[] | null>(null);
  
  // DTW Prediction State
  const [prediction, setPrediction] = useState<string>('KHÔNG PHÁT HIỆN TAY');
  const [confidence, setConfidence] = useState<number>(0);
  const [gestureFeedback, setGestureFeedback] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<string[]>([]);

  // Developer & Lecturer Mode State
  const [developerMode, setDeveloperMode] = useState<boolean>(false);
  const [fingerMatch, setFingerMatch] = useState<number>(0);
  const [palmMatch, setPalmMatch] = useState<number>(0);
  const [motionMatch, setMotionMatch] = useState<number>(0);
  const [bodyMatch, setBodyMatch] = useState<number>(0);
  const [trajectoryMatch, setTrajectoryMatch] = useState<number>(0);
  const [rawFeatures, setRawFeatures] = useState<number[][] | null>(null);
  const [selectedGraphNode, setSelectedGraphNode] = useState<string | null>(null);
  const [knowledgeGraph, setKnowledgeGraph] = useState<any>(null);
  const [evolutions, setEvolutions] = useState<any[]>([]);
  const [selectedEvolutionLabel, setSelectedEvolutionLabel] = useState<string>('HELLO');
  
  // Sentence building state
  const [sentence, setSentence] = useState<string[]>([]);
  const [lockInProgress, setLockInProgress] = useState<number>(0); // 0 to 100%
  
  // UI Navigation Tabs
  const [activeTab, setActiveTab] = useState<'trainer' | 'analytics' | 'settings'>('trainer');
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  
  // Burst recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingLabel, setRecordingLabel] = useState<string>('');
  const [recordingProgress, setRecordingProgress] = useState<number>(0);
  
  // Speech-to-Sign (Two-way communication) State
  const [isListening, setIsListening] = useState<boolean>(false);
  const [spokenText, setSpokenText] = useState<string>('');
  const [matchedGestures, setMatchedGestures] = useState<string[]>([]);
  const [selectedAvatarGesture, setSelectedAvatarGesture] = useState<string | null>(null);
  const [avatarFrameIdx, setAvatarFrameIdx] = useState<number>(0);
  const [avatarMaxFrames, setAvatarMaxFrames] = useState<number>(0);
  
  // SOS & Emergency Mode State
  const [sosActive, setSosActive] = useState<boolean>(false);
  
  // Smart 2-Way Live Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [mainViewTab, setMainViewTab] = useState<'WORKSPACE' | 'LIVE_CHAT'>('WORKSPACE');

  const addChatMessage = useCallback((text: string, sender: 'DEAF' | 'HEARING', signKeyword?: string) => {
    setChatMessages((prev) => [
      ...prev,
      {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        sender,
        text,
        signKeyword,
        timestamp: Date.now(),
      },
    ]);
  }, []);
  
  // Correction modal state
  const [showCorrectionModal, setShowCorrectionModal] = useState<boolean>(false);
  const [correctionTargetLabel, setCorrectionTargetLabel] = useState<string>('');

  // --- Refs ---
  const featureWindowRef = useRef<number[][]>([]);
  const landmarksWindowRef = useRef<Landmark[][]>([]);
  const lockInCounterRef = useRef<number>(0);
  const lockInTargetLabelRef = useRef<string | null>(null);
  const burstFeaturesBufferRef = useRef<number[][]>([]);
  const burstLandmarksBufferRef = useRef<Landmark[][]>([]);
  const isRecordingRef = useRef(isRecording);
  const avatarCanvasRef = useRef<HTMLCanvasElement>(null);
  const avatarIntervalRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wsCounterRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  const lastAppendedWordRef = useRef<{ label: string; time: number }>({ label: '', time: 0 });
  
  // Stability & Performance Throttle Refs
  const activeGestureLabelRef = useRef<string>('');
  const gestureStableCounterRef = useRef<number>(0);
  const lastSpokenTextRef = useRef<string>('');
  const lastSpokenTimeRef = useRef<number>(0);

  // Helper to check if two gesture labels are semantic synonyms (e.g. SO_5 and HI)
  const isSynonymGesture = (w1: string, w2: string) => {
    if (!w1 || !w2) return false;
    if (w1 === w2) return true;
    const greetings = ['SO_5', 'HI', 'HELLO', 'XIN_CHAO', 'XIN_CHÀO'];
    if (greetings.includes(w1) && greetings.includes(w2)) return true;
    return false;
  };

  // Streamlined instant sentence builder for real-time continuous gesture stream
  const tryAppendWordToSentence = useCallback((rawLabel: string) => {
    if (!rawLabel || rawLabel === 'ĐANG PHÂN TÍCH...' || rawLabel === 'KHÔNG PHÁT HIỆN TAY' || rawLabel === 'CHƯA CÓ DỮ LIỆU') {
      return;
    }

    const cleanLabel = rawLabel.split(' ')[0].split('(')[0].trim().toUpperCase();
    if (!cleanLabel) return;

    const now = Date.now();
    const last = lastAppendedWordRef.current;

    // Avoid duplicate rapid append if same word or synonym appended < 2000ms ago
    if (isSynonymGesture(last.label, cleanLabel) && now - last.time < 2000) {
      return;
    }

    lastAppendedWordRef.current = { label: cleanLabel, time: now };

    setSentence((prev) => {
      const lastInSentence = prev.length > 0 ? prev[prev.length - 1] : '';
      if (prev.length > 0 && isSynonymGesture(lastInSentence, cleanLabel) && now - last.time < 2000) {
        return prev;
      }
      const updated = [...prev, cleanLabel];
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'PREV_WORD',
          word: cleanLabel
        }));
      }
      return updated;
    });

    speakText(cleanLabel.toLowerCase());
  }, []);

  // Update recording reference
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // SOS Alarm loop
  useEffect(() => {
    let sosInterval: number | null = null;
    if (sosActive) {
      const playBeep = () => {
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioContextClass) return;
          const audioCtx = new AudioContextClass();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(950, audioCtx.currentTime); // High pitch whistle
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          
          gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.4);
        } catch (e) {
          console.warn('Web Audio Context not allowed or failed:', e);
        }
      };
      
      playBeep();
      sosInterval = window.setInterval(playBeep, 1200);
      speakText("Cảnh báo khẩn cấp! Phát hiện tín hiệu SOS! Yêu cầu hỗ trợ ngay lập tức!");
    }
    return () => {
      if (sosInterval) clearInterval(sosInterval);
    };
  }, [sosActive]);

  // --- API Load Handlers ---
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [fetchedSettings, fetchedTemplates, fetchedSamples, fetchedStats] = await Promise.all([
        api.fetchSettings(),
        api.fetchTemplates(),
        api.fetchSamples(),
        api.fetchStats()
      ]);
      setSettings(fetchedSettings);
      setTemplates(fetchedTemplates);
      setSamples(fetchedSamples);
      setStats(fetchedStats);
      setIsBackendConnected(true);

      // Default selected evolution to the first template if available
      if (fetchedTemplates.length > 0 && !selectedEvolutionLabel) {
        setSelectedEvolutionLabel(fetchedTemplates[0].label);
      }
    } catch (err) {
      console.error('Error connecting to backend:', err);
      setIsBackendConnected(false);
    } finally {
      setLoading(false);
    }
  }, [selectedEvolutionLabel]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load Developer Graph and version lineage data
  const loadDeveloperData = useCallback(async () => {
    try {
      const graph = await api.fetchKnowledgeGraph();
      setKnowledgeGraph(graph);

      if (selectedEvolutionLabel) {
        const evos = await api.fetchEvolutions(selectedEvolutionLabel);
        setEvolutions(evos);
      }
    } catch (err) {
      console.error('Error loading developer data:', err);
    }
  }, [selectedEvolutionLabel]);

  useEffect(() => {
    if (developerMode) {
      loadDeveloperData();
    }
  }, [developerMode, loadDeveloperData]);

  // --- WebSocket Connection & Real-time Matching ---
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWS = () => {
      if (ws) ws.close();

      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:5000/ws/gesture';
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket Connected to SignLink Backend');
        setIsBackendConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'PREDICTION') {
            const finalLabel = data.predicted;
            const avgConfidence = data.confidence;
            const feedbackMsg = data.feedback;

            setPrediction(finalLabel);
            setConfidence(avgConfidence);
            setGestureFeedback(feedbackMsg);
            setCandidates(data.candidates || []);

            // Set detailed sub-feature matching percentages (XDE)
            setFingerMatch(data.fingerMatch || 0);
            setPalmMatch(data.palmMatch || 0);
            setMotionMatch(data.motionMatch || 0);
            setBodyMatch(data.bodyMatch || 0);
            setTrajectoryMatch(data.trajectoryMatch || 0);
            setRawFeatures(data.features || null);

            // Streamlined zero-latency continuous sentence builder
            if (finalLabel !== 'ĐANG PHÂN TÍCH...' && finalLabel !== 'CHƯA CÓ DỮ LIỆU' && finalLabel !== 'KHÔNG PHÁT HIỆN TAY') {
              if (finalLabel === 'SOS') {
                if (!sosActive) {
                  setSosActive(true);
                  setSentence(prev => [...prev, 'SOS']);
                  speakText("Phát hiện tín hiệu khẩn cấp!");
                }
              } else {
                tryAppendWordToSentence(finalLabel);
              }
            } else {
              lockInTargetLabelRef.current = null;
              lockInCounterRef.current = 0;
              setLockInProgress(0);
            }
          }
        } catch (e) {
          console.warn('Error reading WS prediction:', e);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket closed, scheduling reconnect...');
        setIsBackendConnected(false);
        reconnectTimeout = setTimeout(connectWS, 3000);
      };

      ws.onerror = (err) => {
        console.error('WebSocket encountered error:', err);
        ws?.close();
      };

      wsRef.current = ws;
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [sosActive]);

  // --- Text-to-Speech Helper (Non-blocking & deduplicated to prevent JS thread lag) ---
  const speakText = (text: string) => {
    if (!window.speechSynthesis || !text) return;
    const now = Date.now();
    if (lastSpokenTextRef.current === text && now - lastSpokenTimeRef.current < 2000) {
      return;
    }
    lastSpokenTextRef.current = text;
    lastSpokenTimeRef.current = now;

    setTimeout(() => {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN';
        utterance.rate = 1.15;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Speech synthesis error:', e);
      }
    }, 0);
  };

  // --- Speech-to-Text Recognition Setup (Two-way communication) ---
  const startSpeechRecognition = () => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      alert('Trình duyệt của bạn không hỗ trợ nhận dạng giọng nói. Hãy dùng Google Chrome.');
      return;
    }

    const rec = new SpeechRecognitionClass();
    rec.lang = 'vi-VN';
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => {
      setIsListening(true);
      setSpokenText('Đang lắng nghe...');
      setMatchedGestures([]);
    };

    rec.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSpokenText(transcript);
      
      const query = transcript.toLowerCase();
      const matches: string[] = [];

      if (query.includes('chào') || query.includes('hello')) matches.push('HELLO');
      if (query.includes('uống') || query.includes('nước') || query.includes('uống nước')) matches.push('UONG_NUOC');
      if (query.includes('cứu') || query.includes('khẩn cấp') || query.includes('sos')) matches.push('SOS');
      if (query.includes('like') || query.includes('thích') || query.includes('tốt')) matches.push('LIKE');
      
      setMatchedGestures(matches);
      if (matches.length > 0) {
        triggerAvatarReplay(matches[0]);
      }
    };

    rec.onerror = (e: any) => {
      console.error('Speech recognition error:', e);
      setIsListening(false);
      setSpokenText('Lỗi nhận diện âm thanh.');
    };

    rec.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = rec;
    rec.start();
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  // --- Sign Avatar Skeletal Replay Engine ---
  const triggerAvatarReplay = (label: string) => {
    if (avatarIntervalRef.current) {
      clearInterval(avatarIntervalRef.current);
      avatarIntervalRef.current = null;
    }

    const template = templates.find(t => t.label === label);
    if (!template || !template.landmarksSequence || template.landmarksSequence.length === 0) {
      alert(`Không tìm thấy mẫu cử chỉ xương cho '${label}' để minh họa.`);
      return;
    }

    setSelectedAvatarGesture(label);
    const seq = template.landmarksSequence;
    setAvatarMaxFrames(seq.length);
    let frameIdx = 0;

    const canvas = avatarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    avatarIntervalRef.current = window.setInterval(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const frameLandmarks = seq[frameIdx];

      if (frameLandmarks && frameLandmarks.length === 21) {
        drawHandSkeleton(ctx, frameLandmarks, canvas.width, canvas.height, false);
      }

      setAvatarFrameIdx(frameIdx);
      frameIdx = (frameIdx + 1) % seq.length;
    }, 60);
  };

  const stopAvatarReplay = () => {
    if (avatarIntervalRef.current) {
      clearInterval(avatarIntervalRef.current);
      avatarIntervalRef.current = null;
    }
    setSelectedAvatarGesture(null);
    const canvas = avatarCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // --- Real-time Holistic Frame Processing ---
  const handleLandmarksDetected = useCallback((
    leftHand: Landmark[] | null,
    rightHand: Landmark[] | null,
    pose: Landmark[] | null
  ) => {
    let activeHand = rightHand || leftHand;
    
    if (!activeHand || activeHand.length !== 21) {
      handleTrackingLost();
      return;
    }

    setActiveLandmarks(activeHand);

    const fingerInfo = countExtendedFingers(activeHand);
    const { featureVector } = extractFeatures(activeHand, pose);
    setActiveFeatureVector(featureVector);

    // 1. Throttle prediction state update to prevent React render thrashing
    setPrediction((prev) => (prev === fingerInfo.details ? prev : fingerInfo.details));
    setConfidence(0.88);

    // 2. Hysteresis stability check: Require 3 consecutive stable frames (~90ms) before sentence lock-in
    if (activeGestureLabelRef.current === fingerInfo.label) {
      gestureStableCounterRef.current += 1;
      if (gestureStableCounterRef.current === 3) {
        tryAppendWordToSentence(fingerInfo.label);
      }
    } else {
      activeGestureLabelRef.current = fingerInfo.label;
      gestureStableCounterRef.current = 1;
    }

    const fWindow = featureWindowRef.current;
    const lWindow = landmarksWindowRef.current;
    fWindow.push(featureVector);
    lWindow.push(activeHand);
    if (fWindow.length > 30) fWindow.shift();
    if (lWindow.length > 30) lWindow.shift();

    if (isRecordingRef.current) {
      burstFeaturesBufferRef.current.push(featureVector);
      burstLandmarksBufferRef.current.push(activeHand);
      
      const currentCount = burstFeaturesBufferRef.current.length;
      const targetCount = 30;
      const progress = (currentCount / targetCount) * 100;
      setRecordingProgress(progress);

      if (currentCount >= targetCount) {
        setIsRecording(false);
        saveBurstSequence();
      }
      return;
    }

    const fullFrame: any[] = [];
    if (leftHand && leftHand.length === 21) {
      fullFrame.push(...leftHand.map(l => ({ x: l.x, y: l.y, z: l.z, visibility: 1 })));
    } else {
      for (let i = 0; i < 21; i++) fullFrame.push({ x: 0, y: 0, z: 0, visibility: 0 });
    }

    if (rightHand && rightHand.length === 21) {
      fullFrame.push(...rightHand.map(l => ({ x: l.x, y: l.y, z: l.z, visibility: 1 })));
    } else {
      for (let i = 0; i < 21; i++) fullFrame.push({ x: 0, y: 0, z: 0, visibility: 0 });
    }

    if (pose && pose.length === 33) {
      fullFrame.push(...pose.map(l => ({ x: l.x, y: l.y, z: l.z, visibility: 1 })));
    } else {
      for (let i = 0; i < 33; i++) fullFrame.push({ x: 0, y: 0, z: 0, visibility: 0 });
    }

    if (pose && pose[0]) {
      fullFrame.push({ x: pose[0].x, y: pose[0].y, z: pose[0].z, visibility: 1 });
    } else {
      fullFrame.push({ x: 0, y: 0, z: 0, visibility: 0 });
    }

    wsCounterRef.current += 1;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'FRAME',
        landmarks: fullFrame
      }));
    }
  }, [sosActive]);

  const handleTrackingLost = useCallback(() => {
    setActiveLandmarks(null);
    setActiveFeatureVector(null);
    setPrediction('KHÔNG PHÁT HIỆN TAY');
    setConfidence(0);
    setGestureFeedback(null);
    setCandidates([]);
    
    featureWindowRef.current = [];
    landmarksWindowRef.current = [];
    lockInTargetLabelRef.current = null;
    lockInCounterRef.current = 0;
    setLockInProgress(0);
  }, []);

  const saveBurstSequence = async () => {
    if (burstFeaturesBufferRef.current.length === 0 || !recordingLabel) return;
    setLoading(true);
    const label = recordingLabel;

    const sample: GestureSample = {
      id: `${label}_seq_${Date.now()}`,
      label: label,
      landmarksSequence: [...burstLandmarksBufferRef.current],
      featureVectors: [...burstFeaturesBufferRef.current],
      createdAt: Date.now()
    };

    try {
      await api.addSample(sample);
      burstFeaturesBufferRef.current = [];
      burstLandmarksBufferRef.current = [];
      setRecordingLabel('');
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Không thể lưu chuỗi mẫu cử chỉ.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSingleSample = async (label: string) => {
    if (!activeLandmarks || !activeFeatureVector) return;
    
    const sample: GestureSample = {
      id: `${label}_single_${Date.now()}`,
      label: label.toUpperCase(),
      landmarksSequence: [activeLandmarks],
      featureVectors: [activeFeatureVector],
      createdAt: Date.now()
    };

    setLoading(true);
    try {
      await api.addSample(sample);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartBurstRecord = (label: string) => {
    burstFeaturesBufferRef.current = [];
    burstLandmarksBufferRef.current = [];
    setRecordingLabel(label.toUpperCase());
    setRecordingProgress(0);
    setIsRecording(true);
  };

  const handleDeleteGesture = async (label: string) => {
    setLoading(true);
    try {
      await api.deleteGesture(label);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerOptimize = async () => {
    setLoading(true);
    try {
      await api.optimizeTemplates();
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSettings = async (newSettings: Partial<SystemSettings>) => {
    setLoading(true);
    try {
      const updated = await api.updateSettings(newSettings);
      setSettings(updated);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    setLoading(true);
    try {
      await api.clearLogs();
      const updatedStats = await api.fetchStats();
      setStats(updatedStats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- Real-time feedback validation button actions ---
  const handleConfirmPrediction = async (correct: boolean) => {
    if (prediction === 'KHÔNG PHÁT HIỆN TAY' || prediction === 'ĐANG PHÂN TÍCH...') return;
    setLoading(true);
    try {
      await api.logRecognition({
        predictedLabel: prediction,
        actualLabel: prediction,
        confidence: confidence,
        correct: correct,
        featureVectors: correct && rawFeatures ? rawFeatures : undefined,
        landmarksSequence: correct && landmarksWindowRef.current.length > 0 ? landmarksWindowRef.current : undefined
      });
      if (correct) {
        alert(`Đã xác nhận Đúng! Mẫu cử chỉ được tích hợp vào Prototype '${prediction}' (Vòng thích ứng trực tuyến).`);
      } else {
        alert(`Đã báo cáo Sai! Hệ thống thực hiện khôi phục (Rollback) bản tiến hóa gần nhất của '${prediction}' và áp dụng hình phạt trọng số.`);
      }
      await loadData();
      if (developerMode) {
        loadDeveloperData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCorrectPrediction = () => {
    if (prediction === 'KHÔNG PHÁT HIỆN TAY' || prediction === 'ĐANG PHÂN TÍCH...') return;
    setCorrectionTargetLabel('');
    setShowCorrectionModal(true);
  };

  const submitCorrection = async () => {
    if (!correctionTargetLabel.trim()) return;
    const correctLabel = correctionTargetLabel.trim().toUpperCase();

    setLoading(true);
    setShowCorrectionModal(false);

    setPrediction(correctLabel);
    setSentence((prev) => {
      if (prev.length > 0) {
        const copy = [...prev];
        copy[copy.length - 1] = correctLabel;
        return copy;
      }
      return [correctLabel];
    });
    speakText(correctLabel.toLowerCase());

    try {
      await api.logRecognition({
        predictedLabel: prediction,
        actualLabel: correctLabel,
        confidence: confidence,
        correct: false,
      });

      if (landmarksWindowRef.current.length > 0 && featureWindowRef.current.length > 0) {
        const newSample: GestureSample = {
          id: `${correctLabel}_correction_${Date.now()}`,
          label: correctLabel,
          landmarksSequence: [...landmarksWindowRef.current],
          featureVectors: [...featureWindowRef.current],
          createdAt: Date.now(),
        };
        await api.addSample(newSample);
      }

      await loadData();
    } catch (err) {
      console.error('Failed to submit correction:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCandidate = async (label: string) => {
    const cleanLabel = label.split(' ')[0].split('(')[0].trim().toUpperCase();
    if (!cleanLabel) return;
    setPrediction(cleanLabel);

    setSentence(prev => {
      const updated = [...prev, cleanLabel];
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'PREV_WORD',
          word: cleanLabel
        }));
      }
      return updated;
    });
    speakText(cleanLabel.toLowerCase());

    lockInTargetLabelRef.current = null;
    lockInCounterRef.current = 0;
    setLockInProgress(0);

    setLoading(true);
    try {
      await api.logRecognition({
        predictedLabel: prediction,
        actualLabel: cleanLabel,
        confidence: confidence,
        correct: false
      });

      const newSample: GestureSample = {
        id: `${cleanLabel}_suggestion_${Date.now()}`,
        label: cleanLabel,
        landmarksSequence: [...landmarksWindowRef.current],
        featureVectors: [...featureWindowRef.current],
        createdAt: Date.now()
      };
      await api.addSample(newSample);

      await loadData();
    } catch (err) {
      console.error('Failed to submit candidate selection:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- Sentence actions ---
  const handleBackspace = () => setSentence(prev => prev.slice(0, -1));
  const handleClearSentence = () => {
    setSentence([]);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'CLEAR_CONTEXT' }));
    }
  };

  // Trigger manual rollback on a specific label from developer view
  const triggerManualRollback = async (label: string) => {
    if (!confirm(`Bạn có chắc chắn muốn Rollback (hủy bản tiến hóa gần nhất) của '${label}'?`)) return;
    setLoading(true);
    try {
      await api.logRecognition({
        predictedLabel: label,
        actualLabel: label,
        confidence: 1.0,
        correct: false
      });
      alert(`Đã khôi phục thành công bản trước của '${label}' và giảm trọng số.`);
      await loadData();
      await loadDeveloperData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`app-container ${sosActive ? 'sos-active-alert' : ''}`}>
      {/* Header Bar */}
      <header>
        <div className="logo-container">
          <div className="logo-icon">
            <Cpu size={24} />
          </div>
          <div className="logo-text">
            <h1>SignLink AI</h1>
            <span>Bộ Công Cụ Giao Tiếp Ký Hiệu 2 Chiều</span>
          </div>
        </div>

        <div className="system-status">
          <button 
            className={`btn ${mainViewTab === 'WORKSPACE' ? 'btn-primary' : 'btn-secondary'} btn-small`} 
            onClick={() => setMainViewTab('WORKSPACE')}
            style={{ marginRight: '8px', fontWeight: 'bold' }}
          >
            🏠 Dịch Cử Chỉ & Huấn Luyện
          </button>

          <button 
            className={`btn ${mainViewTab === 'LIVE_CHAT' ? 'btn-primary' : 'btn-secondary'} btn-small`} 
            onClick={() => setMainViewTab('LIVE_CHAT')}
            style={{ marginRight: '12px', fontWeight: 'bold' }}
          >
            💬 Hội Thoại 2 Chiều (Live Chat)
          </button>

          <button 
            className={`btn ${developerMode ? 'btn-primary' : 'btn-secondary'} btn-small`} 
            onClick={() => setDeveloperMode(!developerMode)}
            style={{ marginRight: '10px', fontWeight: 'bold', border: '1px solid var(--color-primary)' }}
          >
            {developerMode ? 'CHẾ ĐỘ GIẢNG VIÊN (DEV)' : 'CHẾ ĐỘ NGƯỜI DÙNG'}
          </button>

          <button 
            className={`btn ${sosActive ? 'btn-danger animate-pulse' : 'btn-secondary'} btn-small`} 
            onClick={() => setSosActive(!sosActive)}
            style={{ marginRight: '16px', fontWeight: 'bold' }}
          >
            <AlertTriangle size={14} style={{ marginRight: '6px' }} />
            {sosActive ? 'TẮT BÁO ĐỘNG SOS' : 'BÁO ĐỘNG SOS'}
          </button>

          <div className="status-indicator">
            {isBackendConnected ? (
              <>
                <Wifi size={14} style={{ color: 'var(--color-success)' }} />
                <span>Trực Tuyến</span>
                <div className="status-dot online" />
              </>
            ) : (
              <>
                <WifiOff size={14} style={{ color: 'var(--color-danger)' }} />
                <span style={{ color: 'var(--color-danger)' }}>Ngoại Tuyến</span>
                <div className="status-dot offline" />
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Dashboard */}
      {mainViewTab === 'LIVE_CHAT' ? (
        <main style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
          <LiveChatHub
            messages={chatMessages}
            onSendMessage={(text, sender, keyword) => addChatMessage(text, sender, keyword)}
            onSpeak={speakText}
            templates={templates}
          />
        </main>
      ) : (
        <main className="dashboard-grid">
        {/* Left Column: Webcam & Live Translations */}
        <section className="main-view-column">
          {/* Webcam view */}
          <div className="glass-panel" style={{ padding: '20px', position: 'relative' }}>
            <h2 className="section-title">
              <Cpu size={18} />
              DỊCH CỬ CHỈ THỜI GIAN THỰC (CHIỀU 1)
            </h2>
            
            <HandCamera
              onLandmarksDetected={handleLandmarksDetected}
              onTrackingLost={handleTrackingLost}
              isRecording={isRecording}
            />

            {/* AI Posture Helper banner */}
            {gestureFeedback && (
              <div className="posture-feedback-banner animate-bounce">
                <Info size={16} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                <p>{gestureFeedback}</p>
              </div>
            )}
          </div>

          {/* Classification result banner */}
          <div className="glass-panel prediction-banner glow-primary">
            <div className="prediction-display">
              <span className="prediction-label">Cử chỉ nhận dạng được</span>
              <span className="prediction-value" style={{ fontSize: activeLandmarks && prediction === 'KHÔNG PHÁT HIỆN TAY' ? '22px' : undefined }}>
                {activeLandmarks && prediction === 'KHÔNG PHÁT HIỆN TAY'
                  ? (samples.length === 0 ? 'ĐÃ PHÁT HIỆN TAY (HÃY HUẤN LUYỆN CỬ CHỈ ĐẦU TIÊN)' : 'ĐÃ BẮT ĐƯỢC TAY (ĐANG PHÂN TÍCH...)')
                  : prediction}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="confidence-gauge">
                <div className="confidence-label">
                  <span>Khớp quỹ đạo</span>
                  <span style={{ color: 'var(--color-primary)', fontWeight: '600' }}>
                    {Math.round(confidence * 100)}%
                  </span>
                </div>
                <div className="progress-bar-container">
                  <div className="progress-bar-fill" style={{ width: `${confidence * 100}%` }} />
                </div>
              </div>

              {lockInProgress > 0 && (
                <div style={{ width: '100%', marginTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--color-primary)', marginBottom: '2px' }}>
                    <span>Đang tự động xác nhận câu...</span>
                    <span>{Math.round(lockInProgress)}%</span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${lockInProgress}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-primary), #00ff88)', transition: 'width 0.15s ease' }} />
                  </div>
                </div>
              )}

              {/* Confirm / Reject Buttons on the main screen */}
              {prediction !== 'KHÔNG PHÁT HIỆN TAY' && prediction !== 'ĐANG PHÂN TÍCH...' && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="btn btn-primary btn-small"
                    onClick={() => handleConfirmPrediction(true)}
                    style={{ background: 'var(--color-success)', color: '#000', padding: '4px 8px', fontSize: '11px' }}
                    title="Xác nhận cử chỉ chuẩn, ghi nhận tiến hóa"
                  >
                    Đúng
                  </button>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={handleCorrectPrediction}
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                    title="Báo cáo sai, chọn cử chỉ đúng để AI học ngay"
                  >
                    Sai (Sửa AI)
                  </button>
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => {
                      setPrediction('ĐANG PHÂN TÍCH...');
                      setConfidence(0);
                      setActiveLandmarks(null);
                      setActiveFeatureVector(null);
                      featureWindowRef.current = [];
                      landmarksWindowRef.current = [];
                      lockInTargetLabelRef.current = null;
                      lockInCounterRef.current = 0;
                      resetEMAFilter();
                      if (window.speechSynthesis) window.speechSynthesis.cancel();
                    }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      borderColor: '#00f2fe',
                      color: '#00f2fe',
                      background: 'rgba(0, 242, 254, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 'bold',
                    }}
                    title="Khôi phục ngay lập tức nếu AI bị đơ hoặc kẹt nhận diện"
                  >
                    <RotateCcw size={12} /> Reset AI
                  </button>
                </div>
              )}
            </div>

            {/* Candidate Suggestions */}
            {candidates.length > 0 && confidence < 0.85 && prediction !== 'KHÔNG PHÁT HIỆN TAY' && prediction !== 'ĐANG PHÂN TÍCH...' && (
              <div 
                style={{ 
                  marginTop: '12px', 
                  paddingTop: '12px', 
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  width: '100%'
                }}
              >
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
                  GỢI Ý TỪ KHÓA KHÁC (BẤM CHỌN NHANH):
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {candidates.map((candStr) => {
                    const parts = candStr.split(' ');
                    const label = parts[0];
                    return (
                      <button
                        key={candStr}
                        className="btn btn-secondary btn-small"
                        onClick={() => handleSelectCandidate(label)}
                        style={{ 
                          fontSize: '10px', 
                          padding: '4px 10px', 
                          background: 'rgba(0, 242, 254, 0.05)', 
                          borderColor: 'rgba(0, 242, 254, 0.2)'
                        }}
                      >
                        {candStr}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Developer Mode Panels */}
          {developerMode && (
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h3 className="section-title" style={{ fontSize: '15px' }}>
                <Layers size={16} />
                DEV ENGINE VISUALIZER
              </h3>

              {/* Sub-Feature Match Progress Dashboard */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                {[
                  { name: 'Ngón tay', value: fingerMatch },
                  { name: 'Góc nghiêng', value: palmMatch },
                  { name: 'Động năng', value: motionMatch },
                  { name: 'Gốc vai/đầu', value: bodyMatch },
                  { name: 'Quỹ đạo', value: trajectoryMatch }
                ].map((item) => (
                  <div key={item.name} style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>{item.name}</span>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--color-primary)', display: 'block', margin: '4px 0' }}>{Math.round(item.value)}%</span>
                    <div className="progress-bar-container" style={{ height: '4px' }}>
                      <div className="progress-bar-fill" style={{ width: `${item.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* 44-D Vector Table and Active Weights */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                    VECTOR ĐẶC TRƯNG 44 CHIỀU (GFEE):
                  </span>
                  <div style={{ height: '140px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', fontFamily: 'monospace', fontSize: '11px' }}>
                    {activeFeatureVector ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                        {activeFeatureVector.map((val, idx) => (
                          <div key={idx} style={{ padding: '2px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <span style={{ color: 'var(--color-secondary)' }}>F{idx}:</span> {val.toFixed(2)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '40px' }}>Không có dữ liệu đặc trưng tay.</div>
                    )}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                    TRỌNG SỐ THÍCH ỨNG (AFWE):
                  </span>
                  <div style={{ height: '140px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', fontFamily: 'monospace', fontSize: '11px' }}>
                    {templates.length > 0 ? (
                      (() => {
                        const activeTemplate = templates.find(t => t.label === prediction);
                        if (activeTemplate) {
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ fontWeight: 'bold', color: 'var(--color-primary)', marginBottom: '4px' }}>
                                Trọng số [{activeTemplate.label}]
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
                                <div>Ngón tay: 1.00</div>
                                <div>Nghiêng: 1.00</div>
                                <div>Động năng: 1.00</div>
                                <div>Gốc thân: 1.00</div>
                              </div>
                              <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '6px' }}>
                                Trọng số các chiều nhiễu tự động giảm khi người dùng xác nhận.
                              </span>
                            </div>
                          );
                        }
                        return <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '40px' }}>Không có template khớp để hiện trọng số.</div>;
                      })()
                    ) : (
                      <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '40px' }}>Không có template.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Version Evolution Lineage Tree */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                    PHẢ HỆ TIẾN HÓA PROTOTYPE (ILE):
                  </span>
                  <select 
                    value={selectedEvolutionLabel} 
                    onChange={(e) => {
                      setSelectedEvolutionLabel(e.target.value);
                      api.fetchEvolutions(e.target.value).then(setEvolutions);
                    }}
                    style={{ background: '#1e293b', border: '1px solid var(--border-color)', color: '#fff', fontSize: '11px', borderRadius: '4px', padding: '2px 6px' }}
                  >
                    {templates.map(t => (
                      <option key={t.label} value={t.label}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '10px 0', alignItems: 'center' }}>
                  {evolutions.length === 0 ? (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Không có dữ liệu tiến hóa.</span>
                  ) : (
                    evolutions.map((evo, idx) => (
                      <div key={evo.id} style={{ display: 'flex', alignItems: 'center' }}>
                        {idx > 0 && <span style={{ color: 'var(--text-muted)', margin: '0 8px', fontWeight: 'bold' }}>&larr;</span>}
                        <div 
                          style={{ 
                            background: idx === 0 ? 'rgba(0, 242, 254, 0.1)' : 'rgba(255,255,255,0.03)', 
                            border: idx === 0 ? '1px solid var(--color-primary)' : '1px solid var(--border-color)', 
                            padding: '8px 12px', 
                            borderRadius: '8px',
                            minWidth: '130px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 'bold', color: idx === 0 ? 'var(--color-primary)' : '#fff', fontSize: '12px' }}>
                              V{evo.version || 1}
                            </span>
                            {evo.variantName && (
                              <span style={{ background: 'var(--color-accent)', color: '#fff', fontSize: '9px', padding: '1px 4px', borderRadius: '3px' }}>
                                {evo.variantName}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                            Mẫu: {evo.sampleCount || 1} | Hợp lệ: {Math.round((evo.weight || 1.0) * 100)}%
                          </span>
                          {idx === 0 && evo.parentId && (
                            <button
                              className="btn btn-danger btn-small"
                              onClick={() => triggerManualRollback(evo.label)}
                              style={{ padding: '2px 6px', fontSize: '9px', marginTop: '6px', width: '100%' }}
                            >
                              <RotateCcw size={8} style={{ marginRight: '4px' }} />
                              Rollback bản này
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Interactive Knowledge Graph widget */}
              <div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                  BẢN ĐỒ LIÊN KẾT NGỮ NGHĨA KNOWLEDGE GRAPH (KGE):
                </span>
                <div style={{ height: '240px', background: '#090a0f', borderRadius: '10px', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
                  {knowledgeGraph && knowledgeGraph.nodes ? (() => {
                    // Category positions map (using actual backend IDs)
                    const catPositions: Record<string, { x: number; y: number }> = {
                      'Greeting': { x: 80, y: 50 },
                      'Feedback': { x: 200, y: 50 },
                      'Needs': { x: 320, y: 50 },
                      'Medical': { x: 120, y: 160 },
                      'Emergency': { x: 280, y: 160 },
                    };

                    const getPos = (id: string, nodeType: string): { x: number; y: number } => {
                      if (nodeType === 'category') {
                        return catPositions[id] || { x: 200, y: 120 };
                      } else {
                        // Find parent category via belongs_to link
                        const belongsToLink = knowledgeGraph.links.find(
                          (l: any) => l.source === id && l.type === 'belongs_to'
                        );
                        const parentId = belongsToLink?.target || 'Greeting';
                        const parentPos = catPositions[parentId] || { x: 200, y: 120 };

                        // Get siblings (other gestures belonging to same category)
                        const siblings = knowledgeGraph.nodes.filter((n: any) => {
                          if (n.type === 'category') return false;
                          const link = knowledgeGraph.links.find(
                            (l: any) => l.source === n.id && l.type === 'belongs_to'
                          );
                          return link?.target === parentId;
                        });
                        const sibIdx = siblings.findIndex((n: any) => n.id === id);
                        const totalSiblings = siblings.length || 1;
                        const startAngle = Math.PI * 0.3;
                        const angle = startAngle + (sibIdx / totalSiblings) * Math.PI * 1.4;
                        const r = 55;
                        return {
                          x: parentPos.x + r * Math.cos(angle),
                          y: parentPos.y + r * Math.sin(angle),
                        };
                      }
                    };

                    // Determine link stroke based on link type
                    const getLinkColor = (linkType: string) => {
                      if (linkType === 'belongs_to') return 'rgba(0, 242, 254, 0.2)';
                      if (linkType === 'association') return 'rgba(191, 85, 236, 0.3)';
                      if (linkType === 'subject_verb' || linkType === 'verb_object') return 'rgba(255, 193, 7, 0.25)';
                      return 'rgba(255, 255, 255, 0.1)';
                    };

                    return (
                      <svg width="100%" height="240" viewBox="0 0 400 240">
                        {/* Draw Links */}
                        {knowledgeGraph.links.map((link: any, idx: number) => {
                          const sourceNode = knowledgeGraph.nodes.find((n: any) => n.id === link.source);
                          const targetNode = knowledgeGraph.nodes.find((n: any) => n.id === link.target);
                          if (!sourceNode || !targetNode) return null;

                          const p1 = getPos(link.source, sourceNode.type);
                          const p2 = getPos(link.target, targetNode.type);

                          return (
                            <line 
                              key={idx} 
                              x1={p1.x} 
                              y1={p1.y} 
                              x2={p2.x} 
                              y2={p2.y} 
                              stroke={getLinkColor(link.type)} 
                              strokeWidth={link.type === 'belongs_to' ? 1.5 : 1} 
                              strokeDasharray={link.type === 'association' ? '4 3' : undefined}
                            />
                          );
                        })}

                        {/* Draw Nodes */}
                        {knowledgeGraph.nodes.map((node: any) => {
                          const p = getPos(node.id, node.type);
                          const isCat = node.type === 'category';
                          const isSelected = selectedGraphNode === node.id || prediction === node.id;

                          return (
                            <g 
                              key={node.id} 
                              transform={`translate(${p.x}, ${p.y})`}
                              onClick={() => setSelectedGraphNode(node.id)}
                              style={{ cursor: 'pointer' }}
                            >
                              <circle 
                                r={isCat ? 14 : 8} 
                                fill={isCat ? 'var(--color-accent)' : isSelected ? 'var(--color-success)' : 'var(--color-primary)'}
                                stroke={isSelected ? '#fff' : 'none'}
                                strokeWidth={isSelected ? 2 : 0}
                                style={{ filter: `drop-shadow(0px 0px ${isCat ? 8 : 4}px rgba(0, 242, 254, 0.4))` }}
                              />
                              <text 
                                y={isCat ? -20 : 18} 
                                fill="#fff" 
                                fontSize={isCat ? '10px' : '8px'} 
                                fontWeight="bold" 
                                textAnchor="middle"
                              >
                                {node.label}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    );
                  })() : (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '80px', fontSize: '13px' }}>
                      Đang tải bản đồ tri thức...
                    </div>
                  )}

                  {selectedGraphNode && (
                    <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.85)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '10px' }}>
                      <strong style={{ color: 'var(--color-primary)' }}>{selectedGraphNode}</strong> - 
                      {knowledgeGraph?.nodes?.find((n: any) => n.id === selectedGraphNode)?.type === 'category' ? ' Danh mục ngữ nghĩa' : ' Từ vựng ký hiệu'}
                      <button 
                        onClick={() => setSelectedGraphNode(null)} 
                        style={{ border: 'none', background: 'none', color: 'var(--color-danger)', marginLeft: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        Đóng
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Smart Sentence Builder (NLP & Predictive Context) */}
          <SmartSentenceBuilder
            sentence={sentence}
            onClear={handleClearSentence}
            onBackspace={handleBackspace}
            onAddWord={(word) => {
              setSentence(prev => [...prev, word]);
              speakText(word.toLowerCase());
            }}
            onSpeak={speakText}
            onSendToChat={(text) => addChatMessage(text, 'DEAF')}
            candidates={candidates}
          />

          {/* Quick Communication Cards (1-Tap Emergency & Everyday Actions) */}
          <div style={{ marginTop: '16px' }}>
            <QuickCommunicationCards
              onSelectCard={(keyword, speech) => {
                setSentence(prev => [...prev, keyword]);
                speakText(speech);
                addChatMessage(speech, 'DEAF', keyword);
              }}
              onTriggerAnimation={triggerAvatarReplay}
            />
          </div>
        </section>

        {/* Right Column: Two-way Speeches & Trainer Panels */}
        <section className="controls-column">
          {/* Speech-to-Sign Module (Two-way communication - CHIỀU 2) */}
          <div className="glass-panel">
            <h2 className="section-title">
              <Mic size={18} />
              DỊCH TIẾNG NÓI SANG KÝ HIỆU (CHIỀU 2)
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '-8px', marginBottom: '16px' }}>
              Người bình thường nói vào microphone, AI sẽ dịch thành văn bản lớn và tự động minh họa cử chỉ bằng bộ xương tay.
            </p>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
              {isListening ? (
                <button className="btn btn-danger" onClick={stopSpeechRecognition} style={{ flex: 1 }}>
                  <MicOff size={16} style={{ marginRight: '6px' }} />
                  Đang thu âm... Bấm để dừng
                </button>
              ) : (
                <button className="btn btn-primary" onClick={startSpeechRecognition} style={{ flex: 1 }}>
                  <Mic size={16} style={{ marginRight: '6px' }} />
                  Nói tiếng Việt (Mic)
                </button>
              )}
            </div>

            {spokenText && (
              <div 
                style={{ 
                  background: 'rgba(255,255,255,0.05)', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  marginBottom: '16px',
                  border: '1px solid var(--border-color)',
                  fontSize: '15px'
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '4px' }}>
                  VĂN BẢN GHI ĐƯỢC:
                </div>
                <div style={{ color: '#fff', fontWeight: '500' }}>"{spokenText}"</div>
              </div>
            )}

            {/* Split Screen for Skeletal Replay Avatar */}
            <div style={{ display: 'flex', gap: '16px' }}>
              {/* Animation Replay Canvas */}
              <div 
                style={{ 
                  flex: 1, 
                  background: '#090a0f', 
                  borderRadius: '10px', 
                  border: '1px solid var(--border-color)',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '180px'
                }}
              >
                <canvas 
                  ref={avatarCanvasRef} 
                  width={240} 
                  height={180} 
                  style={{ width: '100%', height: '180px', pointerEvents: 'none' }}
                />
                {!selectedAvatarGesture && (
                  <div style={{ position: 'absolute', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '12px' }}>
                    Chưa chạy minh họa. Chọn từ khóa bên cạnh để biểu diễn cử chỉ.
                  </div>
                )}
                {selectedAvatarGesture && (
                  <div style={{ position: 'absolute', bottom: '8px', left: '8px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span className="camera-badge" style={{ background: 'var(--bg-card)' }}>
                      MINH HỌA: {selectedAvatarGesture} ({avatarFrameIdx}/{avatarMaxFrames})
                    </span>
                    <button 
                      onClick={stopAvatarReplay}
                      style={{ 
                        background: 'rgba(0,0,0,0.6)', 
                        border: 'none', 
                        color: 'var(--color-danger)', 
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      Dừng
                    </button>
                  </div>
                )}
              </div>

              {/* Matched Keyword buttons */}
              <div style={{ width: '140px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>CỬ CHỈ TRÍCH XUẤT</span>
                {matchedGestures.length === 0 ? (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Không tìm thấy từ khóa ký hiệu.</span>
                ) : (
                  matchedGestures.map(label => (
                    <button 
                      key={label}
                      className="btn btn-secondary btn-small"
                      onClick={() => triggerAvatarReplay(label)}
                      style={{ 
                        textAlign: 'left', 
                        width: '100%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        background: selectedAvatarGesture === label ? 'rgba(0, 242, 254, 0.15)' : '',
                        borderColor: selectedAvatarGesture === label ? 'var(--color-primary)' : ''
                      }}
                    >
                      <Play size={10} />
                      {label}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Navigation Control tabs */}
          <div className="tabs-container">
            <button
              className={`tab-button ${activeTab === 'trainer' ? 'active' : ''}`}
              onClick={() => setActiveTab('trainer')}
            >
              Bộ Huấn Luyện
            </button>
            <button
              className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              Phân Tích AI
            </button>
            <button
              className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              Tham Số Mô Hình
            </button>
          </div>

          {/* Tab contents */}
          {activeTab === 'trainer' && (
            <GestureTrainer
              samples={samples}
              templates={templates}
              activeLandmarks={activeLandmarks}
              activeFeatureVector={activeFeatureVector}
              onAddSample={handleAddSingleSample}
              onStartBurstRecord={handleStartBurstRecord}
              onDeleteGesture={handleDeleteGesture}
              onTriggerOptimize={handleTriggerOptimize}
              isRecording={isRecording}
              recordingProgress={recordingProgress}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsDashboard
              stats={stats}
              onClearLogs={handleClearLogs}
              loading={loading}
            />
          )}

          {activeTab === 'settings' && (
            <ControlPanel
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onTriggerOptimize={handleTriggerOptimize}
              loading={loading}
            />
          )}
        </section>
      </main>
      )}

      {/* Correction Feedback Modal */}
      {showCorrectionModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
        >
          <div
            className="glass-panel"
            style={{
              padding: '24px',
              maxWidth: '440px',
              width: '100%',
              background: 'var(--bg-surface-solid)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <AlertTriangle size={24} style={{ color: 'var(--color-warning)' }} />
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>
                HIỆU CHỈNH LỖI NHẬN DIỆN
              </h2>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px', lineHeight: '1.5' }}>
              Hệ thống hiện tại nhận diện cử chỉ này là{' '}
              <strong style={{ color: 'var(--color-danger)' }}>{prediction}</strong>. Vui lòng điền
              nhãn chính xác để AI học lại vị trí khớp tay này.
            </p>

            <div style={{ marginBottom: '18px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                CHỌN NHANH TỪ DANH SÁCH CỬ CHỈ ĐÚNG:
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxHeight: '110px', overflowY: 'auto', padding: '4px' }}>
                {['CHUU_A', 'CHUU_B', 'CHUU_C', 'CHUU_D', 'CHUU_E', 'CHUU_G', 'CHUU_H', 'CHUU_I', 'CHUU_L', 'CHUU_M', 'CHUU_N', 'CHUU_O', 'CHUU_U', 'CHUU_V', 'CHUU_W', 'CHUU_Y', 'BAN_TIM', 'LIKE', 'CAM_ON', 'XIN_LOI', 'TAM_BIET', 'SO_5', 'SO_4', 'SO_3', 'SO_2', 'SO_1', 'OK', 'LOVE_YOU', 'SOS', 'HELLO', 'UONG_NUOC', 'AN_COM', ...templates.map((t) => t.label)]
                  .filter((val, idx, self) => self.indexOf(val) === idx)
                  .map((itemLabel) => (
                    <button
                      key={itemLabel}
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() => setCorrectionTargetLabel(itemLabel)}
                      style={{
                        fontSize: '11px',
                        padding: '4px 10px',
                        borderColor: correctionTargetLabel === itemLabel ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)',
                        background: correctionTargetLabel === itemLabel ? 'rgba(0, 242, 254, 0.25)' : 'rgba(255,255,255,0.03)',
                        color: correctionTargetLabel === itemLabel ? '#00f2fe' : '#fff',
                        fontWeight: correctionTargetLabel === itemLabel ? 'bold' : 'normal',
                      }}
                    >
                      {itemLabel}
                    </button>
                  ))}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label htmlFor="correction-label-input">HOẶC NHẬP TÊN CỬ CHỈ MỚI</label>
              <input
                id="correction-label-input"
                type="text"
                className="input-control"
                placeholder="VD: BAN_TIM, LIKE, CAM_ON, SO_5"
                value={correctionTargetLabel}
                onChange={(e) => setCorrectionTargetLabel(e.target.value.toUpperCase())}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowCorrectionModal(false)}>
                Hủy
              </button>
              <button
                className="btn btn-primary"
                onClick={submitCorrection}
                disabled={!correctionTargetLabel.trim()}
              >
                Gửi AI Học Lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
