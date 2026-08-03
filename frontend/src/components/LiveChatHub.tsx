import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, 
  Mic, 
  MicOff, 
  Volume2, 
  Play, 
  Send, 
  User, 
  Hand, 
  Sparkles
} from 'lucide-react';
import { type GestureTemplate } from '../types';
import { drawHandSkeleton } from '../utils/drawing';

export interface ChatMessage {
  id: string;
  sender: 'DEAF' | 'HEARING' | 'ME' | 'OTHER';
  senderName?: string;
  senderRole?: string;
  text: string;
  signKeyword?: string;
  timestamp: number | string;
}

interface LiveChatHubProps {
  messages: ChatMessage[];
  roomId: string;
  onRoomChange: (newRoomId: string) => void;
  onSendMessage: (text: string, sender: 'DEAF' | 'HEARING', signKeyword?: string) => void;
  onSpeak: (text: string) => void;
  onClearChat?: () => void;
  templates: GestureTemplate[];
}

export const LiveChatHub: React.FC<LiveChatHubProps> = ({
  messages,
  roomId,
  onRoomChange,
  onSendMessage,
  onSpeak,
  onClearChat,
  templates,
}) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [activeAvatarGesture, setActiveAvatarGesture] = useState<string | null>(null);
  const [avatarFrameIdx, setAvatarFrameIdx] = useState(0);
  const [avatarMaxFrames, setAvatarMaxFrames] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const avatarIntervalRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Speech-to-Text Setup for Hearing User
  const toggleSpeechRecognition = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      alert('Trình duyệt không hỗ trợ Web Speech API. Hãy dùng Google Chrome.');
      return;
    }

    const rec = new SpeechRecognitionClass();
    rec.lang = 'vi-VN';
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => {
      setIsListening(true);
    };

    rec.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        let matchedKeyword = '';
        const lower = transcript.toLowerCase();
        if (lower.includes('chào') || lower.includes('hello')) matchedKeyword = 'HELLO';
        if (lower.includes('uống') || lower.includes('nước')) matchedKeyword = 'UONG_NUOC';
        if (lower.includes('cứu') || lower.includes('sos')) matchedKeyword = 'SOS';
        if (lower.includes('thích') || lower.includes('like')) matchedKeyword = 'LIKE';

        onSendMessage(transcript, 'HEARING', matchedKeyword || undefined);
        if (matchedKeyword) {
          playAvatarAnimation(matchedKeyword);
        }
      }
    };

    rec.onerror = (err: any) => {
      console.warn('Speech error:', err);
      setIsListening(false);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = rec;
    rec.start();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim(), 'HEARING');
    setInputText('');
  };

  // Play 3D Skeletal Animation Player on Canvas
  const playAvatarAnimation = (label: string) => {
    if (avatarIntervalRef.current) {
      clearInterval(avatarIntervalRef.current);
      avatarIntervalRef.current = null;
    }

    const template = templates.find(t => t.label === label);
    if (!template || !template.landmarksSequence || template.landmarksSequence.length === 0) {
      alert(`Chưa có chuỗi cử chỉ 3D mẫu cho '${label}' trong database.`);
      return;
    }

    setActiveAvatarGesture(label);
    const seq = template.landmarksSequence;
    setAvatarMaxFrames(seq.length);
    let frameIdx = 0;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    avatarIntervalRef.current = window.setInterval(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const frameLandmarks = seq[frameIdx];
      if (frameLandmarks && frameLandmarks.length === 21) {
        drawHandSkeleton(ctx, frameLandmarks, canvas.width, canvas.height, false);
      }

      setAvatarFrameIdx(frameIdx);
      frameIdx = (frameIdx + 1) % seq.length;
    }, 60);
  };

  const stopAvatarAnimation = () => {
    if (avatarIntervalRef.current) {
      clearInterval(avatarIntervalRef.current);
      avatarIntervalRef.current = null;
    }
    setActiveAvatarGesture(null);
  };

  const exportChatLog = () => {
    if (messages.length === 0) {
      alert('Chưa có tin nhắn nào để xuất file nhật ký.');
      return;
    }
    const logContent = messages.map((m) => {
      const senderLabel = m.senderName || (m.sender === 'DEAF' || m.sender === 'ME' ? 'Người Khiếm Thính (Ký Hiệu)' : 'Người Bình Thường (Tiếng Nói)');
      const timeStr = typeof m.timestamp === 'number' ? new Date(m.timestamp).toLocaleTimeString() : (m.timestamp || '');
      return `[${timeStr}] ${senderLabel}:\n  ${m.text}${m.signKeyword ? ` (Ký hiệu 3D: ${m.signKeyword})` : ''}\n`;
    }).join('\n----------------------------------------\n');

    const blob = new Blob([`NHẬT KÝ HỘI THOẠI SIGNLINK AI 2 CHIỀU\nThời gian xuất: ${new Date().toLocaleString()}\n\n----------------------------------------\n${logContent}`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SignLink_ChatLog_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card" style={{ background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0, 242, 254, 0.2)', borderRadius: '16px', padding: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0, 242, 254, 0.15)', border: '1px solid var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
            <MessageSquare size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#fff', fontWeight: '700' }}>Kênh Trò Chuyện 2 Chiều (Live Chat Hub)</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Hội thoại thời gian thực giữa Cử chỉ tay ⇄ Tiếng nói & Chữ viết</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(0,242,254,0.12)', border: '1px solid #00f2fe', borderRadius: '10px', padding: '2px 8px', fontSize: '0.72rem', color: '#00f2fe', fontWeight: '700' }}>
                <span>🔑 Mã Phòng: {roomId}</span>
                <button
                  onClick={() => {
                    const newRoom = prompt('Nhập Mã Phòng Chat Riêng (Ví dụ: PTIT-2026):', roomId);
                    if (newRoom && newRoom.trim()) {
                      onRoomChange(newRoom.trim().toUpperCase());
                    }
                  }}
                  style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.7rem', textDecoration: 'underline', padding: 0 }}
                >
                  (Đổi Mã Phòng)
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onClearChat && (
            <button
              onClick={onClearChat}
              className="btn btn-secondary btn-small"
              style={{ fontSize: '0.78rem', padding: '6px 10px', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}
            >
              🗑️ Xóa Lịch Sử
            </button>
          )}

          <button
            onClick={exportChatLog}
            className="btn btn-secondary btn-small"
            style={{ fontSize: '0.78rem', padding: '6px 10px', color: '#00f2fe', border: '1px solid rgba(0, 242, 254, 0.3)' }}
          >
            📥 Xuất Nhật Ký (.TXT)
          </button>

          <button
            onClick={toggleSpeechRecognition}
            className={`btn btn-small ${isListening ? 'btn-danger animate-pulse' : 'btn-primary'}`}
            style={{ gap: '6px', fontSize: '0.82rem', padding: '6px 12px' }}
          >
            {isListening ? <MicOff size={15} /> : <Mic size={15} />}
            {isListening ? 'Đang Nghe...' : 'Nói Tiếng Việt (Mic)'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: activeAvatarGesture ? '1fr 280px' : '1fr', gap: '14px' }}>
        {/* Chat Messages Log */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '380px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '12px', padding: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '6px' }}>
            {messages.length === 0 ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                💬 Bắt đầu cuộc trò chuyện! Người khiếm thính thực hiện cử chỉ tay hoặc người bình thường bấm mic nói.
              </div>
            ) : (
              messages.map((msg) => {
                const isDeaf = msg.sender === 'DEAF' || msg.sender === 'ME';
                return (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: isDeaf ? 'flex-start' : 'flex-end',
                      maxWidth: '80%',
                      background: isDeaf 
                        ? 'linear-gradient(135deg, rgba(0, 242, 254, 0.15), rgba(15, 23, 42, 0.7))'
                        : 'linear-gradient(135deg, rgba(79, 172, 254, 0.2), rgba(30, 41, 59, 0.8))',
                      border: isDeaf
                        ? '1px solid rgba(0, 242, 254, 0.3)'
                        : '1px solid rgba(79, 172, 254, 0.3)',
                      borderRadius: isDeaf ? '14px 14px 14px 2px' : '14px 14px 2px 14px',
                      padding: '10px 14px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: isDeaf ? 'var(--color-primary)' : '#60a5fa', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {isDeaf ? <Hand size={12} /> : <User size={12} />}
                        {msg.senderName ? msg.senderName : (isDeaf ? 'Người Khiếm Thính (Ký hiệu)' : 'Người Tiếng Nói')}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)' }}>
                        {typeof msg.timestamp === 'number'
                          ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : (msg.timestamp || 'Mới đây')}
                      </span>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.92rem', color: '#fff', lineHeight: '1.4' }}>{msg.text}</p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <button
                        onClick={() => onSpeak(msg.text)}
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 0, fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                      >
                        <Volume2 size={12} /> Đọc nói
                      </button>
                      {msg.signKeyword && (
                        <button
                          onClick={() => playAvatarAnimation(msg.signKeyword!)}
                          style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', padding: 0, fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                        >
                          <Play size={12} /> Minh họa Cử chỉ 3D ({msg.signKeyword})
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input Form */}
          <form onSubmit={handleFormSubmit} style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Nhập tin nhắn tiếng Việt..."
              style={{ flex: 1, background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '0.88rem' }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px', gap: '6px' }}>
              <Send size={15} /> Gửi
            </button>
          </form>
        </div>

        {/* 3D Sign Skeleton Avatar Player Panel */}
        {activeAvatarGesture && (
          <div style={{ background: 'rgba(0, 0, 0, 0.4)', borderRadius: '12px', padding: '12px', border: '1px solid var(--color-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={14} /> Minh Họa Cử Chỉ 3D: {activeAvatarGesture}
              </span>
              <button onClick={stopAvatarAnimation} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '0.8rem' }}>✕ Đóng</button>
            </div>

            <canvas
              ref={canvasRef}
              width={250}
              height={260}
              style={{ background: '#0f172a', borderRadius: '8px', border: '1px solid rgba(0, 242, 254, 0.3)', width: '100%', height: 'auto' }}
            />

            <div style={{ width: '100%', marginTop: '8px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
              Khung hình: {avatarFrameIdx + 1} / {avatarMaxFrames}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
