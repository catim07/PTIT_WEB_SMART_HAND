import React, { useState } from 'react';
import { Plus, Trash2, Zap, HelpCircle, RefreshCw, Edit3, RotateCcw } from 'lucide-react';
import { type GestureSample, type GestureTemplate } from '../types';

interface GestureTrainerProps {
  samples: GestureSample[];
  templates: GestureTemplate[];
  activeLandmarks: any | null;
  activeFeatureVector: number[] | null;
  onAddSample: (label: string) => Promise<void>;
  onStartBurstRecord: (label: string) => void;
  onDeleteGesture: (label: string) => Promise<void>;
  onTriggerOptimize: () => Promise<void>;
  isRecording: boolean;
  recordingProgress: number;
  labelMappings?: Record<string, string>;
  onUpdateLabelMapping?: (originalLabel: string, newLabel: string) => void;
  onResetLabelMapping?: (originalLabel: string) => void;
}

export const GestureTrainer: React.FC<GestureTrainerProps> = ({
  samples,
  templates,
  activeLandmarks,
  activeFeatureVector,
  onAddSample,
  onStartBurstRecord,
  onDeleteGesture,
  onTriggerOptimize,
  isRecording,
  recordingProgress,
  labelMappings = {},
  onUpdateLabelMapping,
  onResetLabelMapping,
}) => {
  const [newLabel, setNewLabel] = useState('');
  const [recordMode, setRecordMode] = useState<'single' | 'burst'>('burst');
  const [loading, setLoading] = useState(false);

  // Group samples by label to display statistics
  const sampleCounts = samples.reduce((acc, sample) => {
    acc[sample.label] = (acc[sample.label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const templateCounts = templates.reduce((acc, t) => {
    acc[t.label] = (acc[t.label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleCreateSample = async () => {
    if (!newLabel.trim()) return;
    const label = newLabel.trim().toUpperCase();

    if (!activeFeatureVector) {
      alert('Không phát hiện thấy bàn tay trong camera! Vui lòng đưa tay lên trước camera.');
      return;
    }

    setLoading(true);
    try {
      if (recordMode === 'single') {
        await onAddSample(label);
      } else {
        // Start 15-frame burst capture (approx 1.5 seconds)
        onStartBurstRecord(label);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (label: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa tất cả mẫu và bộ nhớ của cử chỉ '${label}' không?`)) {
      setLoading(true);
      try {
        await onDeleteGesture(label);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleOptimize = async () => {
    setLoading(true);
    try {
      await onTriggerOptimize();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const defaultHeuristics = [
    'SO_0', 'SO_1', 'SO_2', 'SO_3', 'SO_4', 'SO_5',
    'LIKE', 'BAN_TIM', 'UONG_NUOC', 'OK', 'LOVE_YOU',
    'CHUU_A', 'CHUU_B', 'CHUU_C', 'CHUU_D', 'CHUU_E', 'CHUU_G', 'CHUU_H', 'CHUU_I', 'CHUU_L', 'CHUU_M', 'CHUU_N', 'CHUU_O', 'CHUU_U', 'CHUU_V', 'CHUU_W', 'CHUU_Y'
  ];

  const registeredLabels = Array.from(
    new Set([
      ...defaultHeuristics,
      ...Object.keys(sampleCounts),
      ...Object.keys(templateCounts)
    ])
  );

  return (
    <div className="glass-panel flex-column-gap">
      <div>
        <h2 className="section-title">
          <Zap size={18} />
          HUẤN LUYỆN CỬ CHỈ MỚI
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '-8px' }}>
          Tự thiết lập cử chỉ tùy chỉnh bằng cách chụp các mẫu từ webcam. Giải thuật KNN sẽ tự động học các mẫu này.
        </p>
      </div>

      <div className="form-group">
        <label htmlFor="gesture-label-input">TÊN CỬ CHỈ MỚI (CHỮ IN HOA)</label>
        <input
          id="gesture-label-input"
          type="text"
          className="input-control"
          placeholder="VD: HELLO, LIKE, OK, HEART, A, B"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value.toUpperCase())}
          disabled={isRecording || loading}
        />
      </div>

      <div className="form-group">
        <label>PHƯƠNG THỨC GHI MẪU</label>
        <div className="tabs-container" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className={`tab-button ${recordMode === 'single' ? 'active' : ''}`}
            onClick={() => setRecordMode('single')}
            disabled={isRecording || loading}
          >
            Chụp 1 Khung Hình
          </button>
          <button
            type="button"
            className={`tab-button ${recordMode === 'burst' ? 'active' : ''}`}
            onClick={() => setRecordMode('burst')}
            disabled={isRecording || loading}
          >
            Ghi Chuỗi 15 Khung Hình (Nhanh)
          </button>
        </div>
      </div>

      {isRecording ? (
        <div style={{ padding: '8px 0' }}>
          <div className="confidence-label">
            <span style={{ color: 'var(--color-primary)', fontWeight: '600' }}>
              Đang ghi nhận mẫu cử chỉ...
            </span>
            <span>{Math.round(recordingProgress)}%</span>
          </div>
          <div className="progress-bar-container" style={{ marginTop: '8px' }}>
            <div className="progress-bar-fill" style={{ width: `${recordingProgress}%` }} />
          </div>
        </div>
      ) : (
        <button
          className="btn btn-primary"
          onClick={handleCreateSample}
          disabled={!newLabel.trim() || !activeLandmarks || loading}
        >
          <Plus size={16} />
          {recordMode === 'single' ? 'Chụp Mẫu Hiện Tại' : 'Bắt Đầu Ghi Chuỗi Mẫu'}
        </button>
      )}

      {/* Dataset Optimization Panel */}
      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          paddingTop: '20px',
          marginTop: '8px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}
        >
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-bright)' }}>
            DANH SÁCH CỬ CHỈ ĐÃ HUẤN LUYỆN
          </h3>
          <button
            className="btn btn-secondary btn-small"
            onClick={handleOptimize}
            disabled={samples.length === 0 || loading || isRecording}
            title="Sử dụng K-Means nén các mẫu trùng lặp và loại bỏ nhiễu"
            style={{ display: 'flex', gap: '6px', alignItems: 'center' }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Tối ưu hóa K-Means
          </button>
        </div>

        {registeredLabels.length === 0 ? (
          <div
            className="alert-banner info"
            style={{ display: 'flex', alignItems: 'flex-start', margin: 0 }}
          >
            <HelpCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Chưa có cử chỉ nào được thiết lập.</strong> Nhập tên cử chỉ ở trên, đưa tay lên trước camera và bấm <strong>Ghi Chuỗi Mẫu</strong> để bắt đầu huấn luyện.
            </div>
          </div>
        ) : (
          <div className="gesture-list">
            {registeredLabels.map((label) => {
              const mappedLabel = labelMappings[label];
              return (
                <div key={label} className="gesture-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="gesture-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="gesture-name">{label}</span>
                      {mappedLabel && (
                        <span style={{ fontSize: '0.72rem', background: 'rgba(0, 242, 254, 0.15)', border: '1px solid #00f2fe', color: '#00f2fe', padding: '1px 6px', borderRadius: '6px', fontWeight: 'bold' }}>
                          ➔ {mappedLabel} (Đã đổi)
                        </span>
                      )}
                    </div>
                    <span className="gesture-meta">
                      {sampleCounts[label] || 0} mẫu raw | {templateCounts[label] || 0} vector đại diện (K-Means)
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => {
                        const newName = prompt(`Nhập tên nhãn từ mới bạn muốn thay thế cho '${label}' (Ví dụ: PTIT, CHAO_THEY):`, mappedLabel || label);
                        if (newName && newName.trim() && onUpdateLabelMapping) {
                          onUpdateLabelMapping(label, newName.trim().toUpperCase());
                        }
                      }}
                      disabled={loading || isRecording}
                      title="Đổi tên/nhãn từ xuất ra trên camera"
                      style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#00f2fe', border: '1px solid rgba(0, 242, 254, 0.4)' }}
                    >
                      <Edit3 size={12} style={{ marginRight: '3px' }} />
                      {mappedLabel ? 'Sửa Nhãn' : 'Đổi Nhãn'}
                    </button>

                    {mappedLabel && onResetLabelMapping && (
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => onResetLabelMapping(label)}
                        disabled={loading || isRecording}
                        title="Khôi phục lại tên gốc ban đầu"
                        style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)' }}
                      >
                        <RotateCcw size={12} style={{ marginRight: '3px' }} />
                        Gốc
                      </button>
                    )}

                    <button
                      className="btn btn-danger btn-small"
                      onClick={() => handleDelete(label)}
                      disabled={loading || isRecording}
                      title="Xóa cử chỉ này"
                      style={{ padding: '6px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
