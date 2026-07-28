import React, { useState, useEffect } from 'react';
import { 
  Volume2, 
  Sparkles, 
  Trash2, 
  CornerDownLeft, 
  Plus, 
  Wand2, 
  Send,
  MessageSquare,
  ChevronRight,
  Lightbulb
} from 'lucide-react';

interface SmartSentenceBuilderProps {
  sentence: string[];
  onClear: () => void;
  onBackspace: () => void;
  onAddWord: (word: string) => void;
  onSpeak: (text: string) => void;
  onSendToChat?: (text: string) => void;
  candidates: string[];
}

export const SmartSentenceBuilder: React.FC<SmartSentenceBuilderProps> = ({
  sentence,
  onClear,
  onBackspace,
  onAddWord,
  onSpeak,
  onSendToChat,
  candidates,
}) => {
  const [naturalSentence, setNaturalSentence] = useState<string>('');
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState<boolean>(true);

  // Convert raw sign language keywords into a smooth natural Vietnamese sentence
  const formatNaturalSentence = (words: string[]): string => {
    if (!words || words.length === 0) return '';

    const cleanWords = words.filter(w => w.trim() !== '');
    if (cleanWords.length === 0) return '';

    const upper = cleanWords.map(w => w.toUpperCase().trim());

    // NLP Rule-based grammar transformation templates for Vietnamese Sign Language
    if (upper.length === 1) {
      if (upper[0] === 'HELLO' || upper[0] === 'XIN_CHAO') return 'Xin chào bạn!';
      if (upper[0] === 'SOS') return 'Cảnh báo khẩn cấp! Cần trợ giúp ngay lập tức!';
      if (upper[0] === 'UONG_NUOC') return 'Cho tôi xin một cốc nước.';
      if (upper[0] === 'LIKE') return 'Tôi rất thích điều này!';
      return upper[0];
    }

    if (upper.includes('SOS')) {
      return 'CẢNH BÁO KHẨN CẤP! Tôi đang cần hỗ trợ ngay!';
    }

    if (upper.includes('TÔI') && upper.includes('UONG_NUOC')) {
      return 'Tôi đang cảm thấy khát và muốn uống nước.';
    }

    if (upper.includes('TÔI') && upper.includes('MUỐN') && upper.includes('UONG_NUOC')) {
      return 'Tôi muốn uống một cốc nước.';
    }

    if (upper.includes('BẠN') && upper.includes('CẦN') && upper.includes('GIÚP')) {
      return 'Bạn có cần tôi hỗ trợ gì không?';
    }

    // Default join with natural capitalization and punctuation
    const joined = cleanWords.map(w => w.replace('_', ' ').toLowerCase()).join(' ');
    return joined.charAt(0).toUpperCase() + joined.slice(1) + '.';
  };

  useEffect(() => {
    const formatted = formatNaturalSentence(sentence);
    setNaturalSentence(formatted);

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
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', italic: 'true' }}>
            Các cử chỉ nhận dạng được từ Camera sẽ tự động được xếp vào đây...
          </span>
        )}
      </div>

      {/* AI Natural Sentence Result Display */}
      {sentence.length > 0 && (
        <div style={{ background: 'linear-gradient(90deg, rgba(0, 242, 254, 0.1), rgba(79, 172, 254, 0.05))', borderLeft: '4px solid var(--color-primary)', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', tracking: '0.5px', color: 'var(--color-primary)', fontWeight: '700', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
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

      {/* Smart Predictive Context Pills (Markov Suggestions) */}
      <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
          <Lightbulb size={14} style={{ color: '#f59e0b' }} />
          <span>Gợi ý cử chỉ tiếp theo (Markov Intelligence):</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {candidates && candidates.length > 0 ? (
            candidates.map((cand, idx) => {
              const cleanCand = cand.split(' ')[0];
              return (
                <button
                  key={idx}
                  onClick={() => onAddWord(cleanCand)}
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
                  <Plus size={12} /> {cleanCand}
                </button>
              );
            })
          ) : (
            <>
              <button onClick={() => onAddWord('MUỐN')} className="btn btn-secondary btn-small" style={{ fontSize: '0.78rem', padding: '4px 10px', borderRadius: '16px', color: 'rgba(255,255,255,0.8)' }}>+ MUỐN</button>
              <button onClick={() => onAddWord('CẦN')} className="btn btn-secondary btn-small" style={{ fontSize: '0.78rem', padding: '4px 10px', borderRadius: '16px', color: 'rgba(255,255,255,0.8)' }}>+ CẦN</button>
              <button onClick={() => onAddWord('THÍCH')} className="btn btn-secondary btn-small" style={{ fontSize: '0.78rem', padding: '4px 10px', borderRadius: '16px', color: 'rgba(255,255,255,0.8)' }}>+ THÍCH</button>
              <button onClick={() => onAddWord('GIÚP')} className="btn btn-secondary btn-small" style={{ fontSize: '0.78rem', padding: '4px 10px', borderRadius: '16px', color: 'rgba(255,255,255,0.8)' }}>+ GIÚP</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
