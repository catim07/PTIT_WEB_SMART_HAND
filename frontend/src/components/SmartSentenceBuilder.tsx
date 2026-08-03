import React, { useState, useEffect } from 'react';
import { 
  Volume2, 
  Sparkles, 
  Trash2, 
  CornerDownLeft, 
  Plus, 
  Wand2, 
  Send,
  Lightbulb,
  Pause,
  Play
} from 'lucide-react';

interface SmartSentenceBuilderProps {
  sentence: string[];
  onClear: () => void;
  onBackspace: () => void;
  onAddWord: (word: string) => void;
  onSpeak: (text: string) => void;
  onSendToChat?: (text: string) => void;
  candidates: string[];
  isPaused?: boolean;
  onTogglePause?: () => void;
}

export const SmartSentenceBuilder: React.FC<SmartSentenceBuilderProps> = ({
  sentence,
  onClear,
  onBackspace,
  onAddWord,
  onSpeak,
  onSendToChat,
  candidates,
  isPaused = false,
  onTogglePause,
}) => {
  const [naturalSentence, setNaturalSentence] = useState<string>('');
  const [autoSpeakEnabled] = useState<boolean>(true);

  // Convert raw sign language keywords into a smooth natural Vietnamese sentence
  const formatNaturalSentence = (words: string[]): string => {
    if (!words || words.length === 0) return '';

    const cleanWords = words.filter(w => w.trim() !== '');
    if (cleanWords.length === 0) return '';

    const upper = cleanWords.map(w => w.toUpperCase().trim());

    // NLP Rule-based grammar transformation templates for Vietnamese Sign Language (VSL -> Natural Sentence)
    if (upper.length === 1) {
      if (upper[0] === 'HELLO' || upper[0] === 'XIN_CHAO') return 'Xin chào bạn!';
      if (upper[0] === 'SOS') return 'Cảnh báo khẩn cấp! Tôi đang cần hỗ trợ ngay lập tức!';
      if (upper[0] === 'UONG_NUOC') return 'Cho tôi xin một cốc nước uống.';
      if (upper[0] === 'LIKE') return 'Tôi rất thích điều này!';
      if (upper[0] === 'DISLIKE') return 'Tôi không thích điều này.';
      if (upper[0] === 'CAM_ON') return 'Xin chân thành cảm ơn bạn rất nhiều!';
      if (upper[0] === 'XIN_LOI') return 'Tôi rất xin lỗi bạn, mong bạn thông cảm.';
      if (upper[0] === 'YEU_THUONG') return 'Tôi rất yêu thương và trân trọng bạn.';
      if (upper[0] === 'GIUP_DOI') return 'Xin vui lòng hỗ trợ giúp đỡ tôi với.';
      if (upper[0] === 'TAM_BIET') return 'Tạm biệt bạn, hẹn gặp lại sau!';
      if (upper[0] === 'OK') return 'Được rồi, tôi hoàn toàn đồng ý!';
      return upper[0];
    }

    if (upper.includes('SOS')) {
      return 'CẢNH BÁO KHẨN CẤP! Tôi đang gặp nguy hiểm và cần hỗ trợ ngay!';
    }

    if ((upper.includes('TÔI') || upper.includes('TOI')) && upper.includes('UONG_NUOC')) {
      return 'Tôi đang cảm thấy khát và muốn xin một cốc nước.';
    }

    if ((upper.includes('TÔI') || upper.includes('TOI')) && (upper.includes('CẦN') || upper.includes('CAN')) && (upper.includes('GIÚP') || upper.includes('GIUP_DOI'))) {
      return 'Tôi đang rất cần sự giúp đỡ khẩn cấp từ bạn.';
    }

    if ((upper.includes('XIN_LOI') || upper.includes('XIN_LỖI')) && upper.includes('BẠN')) {
      return 'Tôi chân thành xin lỗi bạn, rất mong bạn thông cảm.';
    }

    if ((upper.includes('CAM_ON') || upper.includes('CẢM_ƠN')) && upper.includes('BẠN')) {
      return 'Cảm ơn bạn rất nhiều vì đã giúp đỡ tôi nhiệt tình.';
    }

    if (upper.includes('BẠN') && upper.includes('CẦN') && upper.includes('GIÚP')) {
      return 'Bạn có cần tôi hỗ trợ điều gì không?';
    }

    // Default join with natural capitalization and punctuation
    const joined = cleanWords.map(w => w.replace('_', ' ').toLowerCase()).join(' ');
    return joined.charAt(0).toUpperCase() + joined.slice(1) + '.';
  };

  // Web Audio API Audio Chime Feedback (Zero external mp3 asset dependency)
  const playRecognitionChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1); // E6 note
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
  };

  useEffect(() => {
    const formatted = formatNaturalSentence(sentence);
    setNaturalSentence(formatted);

    if (sentence.length > 0) {
      playRecognitionChime();
    }

    if (autoSpeakEnabled && formatted && sentence.length > 0) {
      // Small debounce before speaking
      const timer = setTimeout(() => {
        onSpeak(formatted);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [sentence, autoSpeakEnabled]);

  const handleSpeakCurrent = () => {
    const textToSpeak = naturalSentence || sentence.join(' ');
    if (textToSpeak) {
      onSpeak(textToSpeak);
    }
  };

  const handleSendChat = () => {
    const textToSend = naturalSentence || sentence.join(' ');
    if (textToSend && onSendToChat) {
      onSendToChat(textToSend);
      onClear();
    }
  };

  const getContextSuggestions = (words: string[]): string[] => {
    if (!words || words.length === 0) {
      return ['XIN_CHAO', 'CAM_ON', 'UONG_NUOC', 'AN_COM', 'SOS'];
    }
    const lastWord = words[words.length - 1].toUpperCase();
    if (lastWord === 'XIN_CHAO' || lastWord === 'HELLO') {
      return ['BẠN', 'RẤT_VUI', 'CẢM_ƠN', 'KHỎE_KHÔNG'];
    }
    if (lastWord === 'TOI' || lastWord === 'TÔI') {
      return ['MUỐN', 'CẦN', 'THÍCH', 'YÊU', 'UONG_NUOC', 'AN_COM'];
    }
    if (lastWord === 'UONG_NUOC') {
      return ['CỐC_NƯỚC', 'CĂN_TIN', 'CẢM_ƠN'];
    }
    if (lastWord === 'BAN_TIM' || lastWord === 'LIKE') {
      return ['CẢM_ƠN', 'RẤT_THÍCH', 'YÊU_THƯƠNG', 'OK'];
    }
    return ['CẢM_ƠN', 'BẠN', 'GIÚP', 'CẦN', 'OK'];
  };

  const dynamicSuggestions = candidates && candidates.length > 0 
    ? Array.from(new Set([...candidates.map(c => c.split(' ')[0]), ...getContextSuggestions(sentence)]))
    : getContextSuggestions(sentence);

  return (
    <div className="card" style={{ background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0, 242, 254, 0.2)', borderRadius: '16px', padding: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0, 242, 254, 0.15)', border: '1px solid var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
            <Sparkles size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#fff', fontWeight: '700' }}>Bộ Biên Dịch Câu Thông Minh AI</h3>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Tự động ghép cử chỉ & chuẩn hoá câu nói tự nhiên</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {onTogglePause && (
            <button 
              className="btn btn-secondary btn-small" 
              onClick={onTogglePause}
              title={isPaused ? "Bấm để tiếp tục tự động ghép từ từ camera" : "Tạm dừng ghép từ mới để dễ sửa câu"}
              style={{
                padding: '6px 10px',
                fontSize: '0.8rem',
                borderColor: isPaused ? '#f59e0b' : 'rgba(0, 242, 254, 0.4)',
                color: isPaused ? '#f59e0b' : 'var(--color-primary)',
                background: isPaused ? 'rgba(245, 158, 11, 0.15)' : 'rgba(0, 242, 254, 0.08)',
                fontWeight: '600'
              }}
            >
              {isPaused ? <Play size={14} /> : <Pause size={14} />} {isPaused ? 'Tiếp tục ghép' : 'Tạm dừng ghép'}
            </button>
          )}
          <button 
            className="btn btn-secondary btn-small" 
            onClick={onBackspace}
            disabled={sentence.length === 0}
            title="Xoá từ gần nhất"
            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
          >
            <CornerDownLeft size={14} /> Xoá từ
          </button>
          <button 
            className="btn btn-secondary btn-small" 
            onClick={onClear}
            disabled={sentence.length === 0}
            title="Xoá toàn bộ câu"
            style={{ padding: '6px 10px', fontSize: '0.8rem', color: '#f87171', borderColor: 'rgba(248, 113, 113, 0.3)' }}
          >
            <Trash2 size={14} /> Làm mới
          </button>
        </div>
      </div>

      {/* Recognized Keyword Badges Stream */}
      <div style={{ background: 'rgba(0, 0, 0, 0.35)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px', minHeight: '52px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        {sentence.length > 0 ? (
          sentence.map((word, idx) => (
            <span 
              key={idx} 
              style={{
                background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.2), rgba(79, 172, 254, 0.2))',
                border: '1px solid var(--color-primary)',
                color: '#fff',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '0.88rem',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 2px 8px rgba(0,242,254,0.15)'
              }}
            >
              {word}
            </span>
          ))
        ) : (
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', fontStyle: 'italic' }}>
            Các cử chỉ nhận dạng được từ Camera sẽ tự động được xếp vào đây...
          </span>
        )}
      </div>

      {/* AI Natural Sentence Result Display */}
      {sentence.length > 0 && (
        <div style={{ background: 'linear-gradient(90deg, rgba(0, 242, 254, 0.1), rgba(79, 172, 254, 0.05))', borderLeft: '4px solid var(--color-primary)', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-primary)', fontWeight: '700', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Wand2 size={12} /> Câu Tiếng Việt Chuẩn AI:
            </div>
            <div style={{ color: '#fff', fontSize: '1rem', fontWeight: '600' }}>
              {naturalSentence}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button 
              className="btn btn-primary btn-small"
              onClick={handleSpeakCurrent}
              style={{ padding: '6px 12px', gap: '6px', fontSize: '0.82rem' }}
            >
              <Volume2 size={15} /> Phát âm thanh
            </button>
            {onSendToChat && (
              <button 
                className="btn btn-secondary btn-small"
                onClick={handleSendChat}
                style={{ padding: '6px 12px', gap: '6px', fontSize: '0.82rem', borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
              >
                <Send size={14} /> Gửi vào Chat
              </button>
            )}
          </div>
        </div>
      )}

      {/* Smart Predictive Context Pills (Markov Intelligence) */}
      <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
          <Lightbulb size={14} style={{ color: '#f59e0b' }} />
          <span>Gợi ý cử chỉ tiếp theo (Markov Intelligence):</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {dynamicSuggestions.map((cand, idx) => (
            <button
              key={idx}
              onClick={() => onAddWord(cand)}
              className="btn btn-secondary btn-small"
              style={{
                fontSize: '0.78rem',
                padding: '4px 10px',
                borderRadius: '16px',
                borderColor: 'rgba(0, 242, 254, 0.4)',
                color: 'var(--color-primary)',
                background: 'rgba(0, 242, 254, 0.06)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Plus size={12} /> {cand}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
