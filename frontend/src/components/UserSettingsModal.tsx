import React from 'react';
import { X, Settings, Volume2, Sliders, Hand, Sparkles } from 'lucide-react';

export interface UserPreferences {
  speechRate: number; // 0.8, 1.0, 1.2
  speechPitch: number; // 0.9, 1.0, 1.1
  preferredHand: 'RIGHT' | 'LEFT' | 'BOTH';
  lockFrameThreshold: number; // 5, 8, 12
  enableChimeSound: boolean;
  autoSpeakOnLock: boolean;
}

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  onSavePreferences: (newPrefs: UserPreferences) => void;
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  isOpen,
  onClose,
  preferences,
  onSavePreferences,
}) => {
  if (!isOpen) return null;

  const handleChange = (key: keyof UserPreferences, value: any) => {
    onSavePreferences({
      ...preferences,
      [key]: value,
    });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(5, 10, 20, 0.85)',
      backdropFilter: 'blur(16px)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '500px',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.96))',
        border: '1px solid rgba(0, 242, 254, 0.3)',
        borderRadius: '24px',
        padding: '30px',
        boxShadow: '0 20px 60px rgba(0, 242, 254, 0.15)',
        position: 'relative',
        animation: 'fadeIn 0.3s ease-out'
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            color: '#fff',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <X size={18} />
        </button>

        {/* Header Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0b1120'
          }}>
            <Settings size={26} />
          </div>
          <div>
            <h2 style={{ margin: 0, color: '#fff', fontSize: '1.35rem', fontWeight: '800' }}>Cấu Hình Tối Ưu Người Dùng</h2>
            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>Tùy chỉnh tốc độ AI, âm thanh giọng nói và bàn tay ưu tiên</span>
          </div>
        </div>

        {/* Preferences Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* 1. Speech Rate */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00f2fe', fontWeight: '700', fontSize: '0.9rem' }}>
                <Volume2 size={18} /> Tốc Độc Đọc Giọng Nói (TTS)
              </div>
              <span style={{ color: '#fff', fontWeight: '700', fontSize: '0.85rem' }}>{preferences.speechRate}x</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {[0.8, 1.0, 1.2].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => handleChange('speechRate', rate)}
                  style={{
                    padding: '8px',
                    borderRadius: '10px',
                    border: preferences.speechRate === rate ? '1px solid #00f2fe' : '1px solid rgba(255,255,255,0.1)',
                    background: preferences.speechRate === rate ? 'rgba(0,242,254,0.2)' : 'rgba(255,255,255,0.03)',
                    color: preferences.speechRate === rate ? '#00f2fe' : '#fff',
                    fontWeight: '700',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  {rate === 0.8 ? 'Chậm (0.8x)' : rate === 1.0 ? 'Chuẩn (1.0x)' : 'Nhanh (1.2x)'}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Lock Frame Threshold */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: '700', fontSize: '0.9rem' }}>
                <Sliders size={18} /> Độ Nhạy Khóa Cử Chỉ AI
              </div>
              <span style={{ color: '#fff', fontWeight: '700', fontSize: '0.85rem' }}>{preferences.lockFrameThreshold} Khung hình (~{Math.round(preferences.lockFrameThreshold * 30)}ms)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {[
                { val: 5, label: 'Siêu Nhanh (5F)' },
                { val: 8, label: 'Chuẩn Mượt (8F)' },
                { val: 12, label: 'Cẩn Thận (12F)' }
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => handleChange('lockFrameThreshold', item.val)}
                  style={{
                    padding: '8px',
                    borderRadius: '10px',
                    border: preferences.lockFrameThreshold === item.val ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                    background: preferences.lockFrameThreshold === item.val ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.03)',
                    color: preferences.lockFrameThreshold === item.val ? '#10b981' : '#fff',
                    fontWeight: '700',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Preferred Hand */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontWeight: '700', fontSize: '0.9rem', marginBottom: '10px' }}>
              <Hand size={18} /> Bàn Tay Ưu Tiên Nhận Diện
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {[
                { val: 'RIGHT', label: '✋ Tay Phải' },
                { val: 'LEFT', label: '🤚 Tay Trái' },
                { val: 'BOTH', label: '🙌 Cả 2 Tay' }
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => handleChange('preferredHand', item.val as any)}
                  style={{
                    padding: '8px',
                    borderRadius: '10px',
                    border: preferences.preferredHand === item.val ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                    background: preferences.preferredHand === item.val ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.03)',
                    color: preferences.preferredHand === item.val ? '#f59e0b' : '#fff',
                    fontWeight: '700',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Sound & Auto-Speech Toggles */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span style={{ color: '#fff', fontSize: '0.88rem', fontWeight: '600' }}>🔔 Hiệu ứng âm thanh Chime khi nhận diện xong</span>
              <input
                type="checkbox"
                checked={preferences.enableChimeSound}
                onChange={(e) => handleChange('enableChimeSound', e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#00f2fe', cursor: 'pointer' }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span style={{ color: '#fff', fontSize: '0.88rem', fontWeight: '600' }}>🔊 Tự động phát âm thanh khi hoàn thành câu</span>
              <input
                type="checkbox"
                checked={preferences.autoSpeakOnLock}
                onChange={(e) => handleChange('autoSpeakOnLock', e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#00f2fe', cursor: 'pointer' }}
              />
            </label>
          </div>

        </div>

        {/* Save Footer Button */}
        <button
          onClick={onClose}
          style={{
            marginTop: '24px',
            width: '100%',
            padding: '14px',
            background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
            border: 'none',
            borderRadius: '14px',
            color: '#0b1120',
            fontWeight: '800',
            fontSize: '1rem',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(0, 242, 254, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <Sparkles size={18} /> Lưu Cấu Hình Tùy Chỉnh
        </button>

      </div>
    </div>
  );
};
