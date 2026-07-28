import React, { useState } from 'react';
import { 
  HeartPulse, 
  Utensils, 
  Navigation, 
  MessageCircle, 
  Volume2, 
  Play, 
  Sparkles,
  ShieldAlert,
  PhoneCall
} from 'lucide-react';

interface QuickCard {
  id: string;
  category: 'EMERGENCY' | 'DAILY' | 'TRAVEL' | 'GREETING';
  title: string;
  signKeyword: string;
  fullSpeech: string;
  icon: string;
}

interface QuickCommunicationCardsProps {
  onSelectCard: (signKeyword: string, fullSpeech: string) => void;
  onTriggerAnimation?: (signKeyword: string) => void;
}

const QUICK_CARDS: QuickCard[] = [
  // Emergency
  { id: 'sos_1', category: 'EMERGENCY', title: 'Cần Cấp Cứu Y Tế', signKeyword: 'SOS', fullSpeech: 'Cảnh báo khẩn cấp! Tôi đang cần hỗ trợ cấp cứu y tế ngay lập tức!', icon: '🆘' },
  { id: 'sos_2', category: 'EMERGENCY', title: 'Tôi Bị Bệnh / Đau', signKeyword: 'SOS', fullSpeech: 'Tôi đang cảm thấy rất đau và mệt trong người, xin giúp tôi!', icon: '🏥' },
  { id: 'sos_3', category: 'EMERGENCY', title: 'Gọi Cảnh Sát', signKeyword: 'SOS', fullSpeech: 'Xin vui lòng hỗ trợ gọi cảnh sát giúp tôi!', icon: '🚨' },

  // Daily Needs
  { id: 'daily_1', category: 'DAILY', title: 'Xin Một Cốc Nước', signKeyword: 'UONG_NUOC', fullSpeech: 'Cho tôi xin một cốc nước uống, tôi đang rất khát.', icon: '🥛' },
  { id: 'daily_2', category: 'DAILY', title: 'Muốn Ăn Cơm', signKeyword: 'UONG_NUOC', fullSpeech: 'Tôi muốn tìm chỗ ăn cơm hoặc mua đồ ăn.', icon: '🍚' },
  { id: 'daily_3', category: 'DAILY', title: 'Cần Trợ Giúp', signKeyword: 'HELLO', fullSpeech: 'Bạn có thể dành ít phút giúp đỡ tôi được không?', icon: '🤝' },

  // Travel
  { id: 'travel_1', category: 'TRAVEL', title: 'Tôi Bị Lạc Đường', signKeyword: 'SOS', fullSpeech: 'Tôi là người khiếm thính và tôi đang bị lạc đường, xin chỉ giúp tôi.', icon: '🗺️' },
  { id: 'travel_2', category: 'TRAVEL', title: 'Nhà Vệ Sinh Ở Đâu?', signKeyword: 'HELLO', fullSpeech: 'Xin hỏi nhà vệ sinh gần nhất ở đâu ạ?', icon: '🚻' },
  { id: 'travel_3', category: 'TRAVEL', title: 'Gọi Xe Ô Tô / Taxi', signKeyword: 'HELLO', fullSpeech: 'Giúp tôi gọi một chuyến xe taxi hoặc Grab với.', icon: '🚖' },

  // Greeting
  { id: 'greet_1', category: 'GREETING', title: 'Xin Chào Rất Vui Gặp Bạn', signKeyword: 'HELLO', fullSpeech: 'Xin chào bạn! Rất vui được gặp bạn hôm nay.', icon: '👋' },
  { id: 'greet_2', category: 'GREETING', title: 'Cảm Ơn Rất Nhiều', signKeyword: 'LIKE', fullSpeech: 'Cảm ơn sự hỗ trợ nhiệt tình của bạn rất nhiều!', icon: '🙏' },
  { id: 'greet_3', category: 'GREETING', title: 'Tôi Là Người Khiếm Thính', signKeyword: 'HELLO', fullSpeech: 'Tôi là người khiếm thính, tôi giao tiếp qua cử chỉ tay và ứng dụng SignLink AI.', icon: '🤟' },
];

export const QuickCommunicationCards: React.FC<QuickCommunicationCardsProps> = ({
  onSelectCard,
  onTriggerAnimation,
}) => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'EMERGENCY' | 'DAILY' | 'TRAVEL' | 'GREETING'>('ALL');

  const filteredCards = activeTab === 'ALL' 
    ? QUICK_CARDS 
    : QUICK_CARDS.filter(c => c.category === activeTab);

  return (
    <div className="card" style={{ background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0, 242, 254, 0.2)', borderRadius: '16px', padding: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
            <Sparkles size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#fff', fontWeight: '700' }}>Thẻ Giao Tiếp Nhanh 1-Chạm</h3>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Chạm để phát âm thanh & hiển thị mô phỏng cử chỉ 3D</span>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', overflowX: 'auto', pb: '4px' }}>
        <button 
          className={`btn btn-small ${activeTab === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('ALL')}
          style={{ fontSize: '0.78rem', padding: '5px 12px', borderRadius: '20px' }}
        >
          ⚡ Tất cả ({QUICK_CARDS.length})
        </button>
        <button 
          className={`btn btn-small ${activeTab === 'EMERGENCY' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('EMERGENCY')}
          style={{ fontSize: '0.78rem', padding: '5px 12px', borderRadius: '20px', borderColor: '#ef4444', color: activeTab === 'EMERGENCY' ? '#fff' : '#ef4444' }}
        >
          🆘 Khẩn cấp / Y tế
        </button>
        <button 
          className={`btn btn-small ${activeTab === 'DAILY' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('DAILY')}
          style={{ fontSize: '0.78rem', padding: '5px 12px', borderRadius: '20px' }}
        >
          🥛 Nhu cầu Ăn uống
        </button>
        <button 
          className={`btn btn-small ${activeTab === 'TRAVEL' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('TRAVEL')}
          style={{ fontSize: '0.78rem', padding: '5px 12px', borderRadius: '20px' }}
        >
          🗺️ Chỉ đường / Đi lại
        </button>
        <button 
          className={`btn btn-small ${activeTab === 'GREETING' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('GREETING')}
          style={{ fontSize: '0.78rem', padding: '5px 12px', borderRadius: '20px' }}
        >
          👋 Chào hỏi
        </button>
      </div>

      {/* Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
        {filteredCards.map((card) => (
          <div
            key={card.id}
            onClick={() => {
              onSelectCard(card.signKeyword, card.fullSpeech);
              if (onTriggerAnimation) onTriggerAnimation(card.signKeyword);
            }}
            style={{
              background: card.category === 'EMERGENCY' 
                ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(15, 23, 42, 0.6))'
                : 'rgba(30, 41, 59, 0.6)',
              border: card.category === 'EMERGENCY'
                ? '1px solid rgba(239, 68, 68, 0.4)'
                : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '12px 14px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between',
              gap: '8px'
            }}
            className="quick-card-item"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.6rem' }}>{card.icon}</span>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#fff', fontWeight: '600' }}>{card.title}</h4>
                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)' }}>Mẫu cử chỉ: {card.signKeyword}</span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)', lineClamp: 2, overflow: 'hidden' }}>
              "{card.fullSpeech}"
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Volume2 size={13} /> Chạm để phát nói & minh họa 3D
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
