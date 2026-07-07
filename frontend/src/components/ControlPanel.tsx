import React, { useState, useEffect } from 'react';
import { Sliders, RefreshCw, Save } from 'lucide-react';
import { type SystemSettings } from '../types';

interface ControlPanelProps {
  settings: SystemSettings | null;
  onUpdateSettings: (settings: Partial<SystemSettings>) => Promise<void>;
  onTriggerOptimize: () => Promise<void>;
  loading: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  settings,
  onUpdateSettings,
  onTriggerOptimize,
  loading,
}) => {
  const [knnK, setKnnK] = useState(3);
  const [kmeansK, setKmeansK] = useState(3);
  const [minConfidence, setMinConfidence] = useState(0.65);
  const [lr, setLr] = useState(5); // Learning rate in percentage (e.g. 5 = 5%)

  // Sync state with settings prop
  useEffect(() => {
    if (settings) {
      setKnnK(settings.knnK);
      setKmeansK(settings.kmeansK);
      setMinConfidence(settings.minConfidence);
    }
  }, [settings]);

  const handleSaveSettings = async () => {
    await onUpdateSettings({
      knnK,
      kmeansK,
      minConfidence,
    });
    alert('Đã cập nhật các cấu hình thành công!');
  };

  const handleOptimize = async () => {
    try {
      await onTriggerOptimize();
      alert('Đã chạy tối ưu hóa dữ liệu mẫu thành công!');
    } catch (err) {
      console.error(err);
    }
  };

  if (!settings) {
    return (
      <div className="glass-panel flex-column-gap" style={{ padding: '20px', alignItems: 'center' }}>
        <Sliders size={32} style={{ color: 'var(--text-muted)' }} />
        <p style={{ color: 'var(--text-muted)' }}>Đang tải cài đặt hệ thống...</p>
      </div>
    );
  }

  return (
    <div className="glass-panel flex-column-gap">
      <div>
        <h2 className="section-title">
          <Sliders size={18} />
          CẤU HÌNH THAM SỐ THUẬT TOÁN
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '-8px' }}>
          Tinh chỉnh các thông số của thuật toán KNN và nén phân cụm K-Means tự thiết kế.
        </p>
      </div>

      {/* KNN K */}
      <div className="slider-group">
        <div className="slider-header">
          <label htmlFor="knn-k-slider">KNN Neighborhood (k)</label>
          <span className="slider-value">{knnK} lân cận</span>
        </div>
        <input
          id="knn-k-slider"
          type="range"
          min="1"
          max="9"
          step="1"
          className="slider-input"
          value={knnK}
          onChange={(e) => setKnnK(parseInt(e.target.value))}
        />
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Số lượng mẫu gần nhất tham gia bỏ phiếu quyết định kết quả.
        </span>
      </div>

      {/* K-Means K */}
      <div className="slider-group">
        <div className="slider-header">
          <label htmlFor="kmeans-k-slider">Số cụm K-Means (K)</label>
          <span className="slider-value">{kmeansK} cụm/cử chỉ</span>
        </div>
        <input
          id="kmeans-k-slider"
          type="range"
          min="1"
          max="5"
          step="1"
          className="slider-input"
          value={kmeansK}
          onChange={(e) => setKmeansK(parseInt(e.target.value))}
        />
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Số lượng vector đại diện (centroids) tối đa đại diện cho mỗi cử chỉ trong cơ sở dữ liệu.
        </span>
      </div>

      {/* Confidence Threshold */}
      <div className="slider-group">
        <div className="slider-header">
          <label htmlFor="min-confidence-slider">Ngưỡng tin cậy tối thiểu</label>
          <span className="slider-value">{Math.round(minConfidence * 100)}%</span>
        </div>
        <input
          id="min-confidence-slider"
          type="range"
          min="0.5"
          max="0.95"
          step="0.05"
          className="slider-input"
          value={minConfidence}
          onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
        />
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Độ tin cậy tối thiểu để hiển thị kết quả. Dưới ngưỡng này hệ thống hiển thị "Đang phân tích...".
        </span>
      </div>

      {/* Adaptive Learning Rate */}
      <div className="slider-group">
        <div className="slider-header">
          <label htmlFor="learning-rate-slider">Tốc độ tự hiệu chuẩn (Learning Rate)</label>
          <span className="slider-value">{lr}%</span>
        </div>
        <input
          id="learning-rate-slider"
          type="range"
          min="1"
          max="20"
          step="1"
          className="slider-input"
          value={lr}
          onChange={(e) => setLr(parseInt(e.target.value))}
        />
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Mức độ cập nhật/tự thích ứng vector mẫu gốc đối với cấu trúc tay của người dùng hiện tại khi dịch chính xác.
        </span>
      </div>

      {/* Save and optimization trigger buttons */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
        <button
          className="btn btn-secondary"
          onClick={handleOptimize}
          disabled={loading}
          style={{ flex: 1 }}
        >
          <RefreshCw size={14} />
          Nén & Dọn Nhiễu
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSaveSettings}
          disabled={loading}
          style={{ flex: 1 }}
        >
          <Save size={14} />
          Lưu Cấu Hình
        </button>
      </div>
    </div>
  );
};
