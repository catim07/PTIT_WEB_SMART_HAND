import React, { useState, useEffect } from 'react';
import { BarChart3, Clock, Trash2, Award, Zap, ShieldAlert, TrendingUp, Grid } from 'lucide-react';
import { type RecognitionStats } from '../types';
import * as api from '../utils/api';

interface AnalyticsDashboardProps {
  stats: RecognitionStats | null;
  onClearLogs: () => Promise<void>;
  loading: boolean;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  stats,
  onClearLogs,
  loading,
}) => {
  const [trends, setTrends] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'matrix' | 'health'>('summary');

  useEffect(() => {
    // Fetch BAE trend data when stats or component loads
    api.fetchTrends()
      .then(setTrends)
      .catch(err => console.warn('Failed to load trends:', err));
  }, [stats]);

  if (!stats) {
    return (
      <div className="glass-panel flex-column-gap" style={{ padding: '20px', alignItems: 'center' }}>
        <BarChart3 size={32} style={{ color: 'var(--text-muted)' }} />
        <p style={{ color: 'var(--text-muted)' }}>Đang tải dữ liệu phân tích hệ thống...</p>
      </div>
    );
  }

  const { totalRecognitions, correctRecognitions, accuracy, gestureCounts, recentLogs } = stats;
  const accuracyPct = Math.round(accuracy * 100);

  // SVG Bar Chart dimensions and setup
  const chartHeight = 120;
  const chartWidth = 320;
  const padding = 20;
  const barWidth = 30;
  const gap = 20;

  const entries = Object.entries(gestureCounts);
  const maxVal = entries.reduce((max, [_, val]) => (val > max ? val : max), 1);

  const handleClear = async () => {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử nhận diện?')) {
      await onClearLogs();
      setTrends(null);
    }
  };

  return (
    <div className="glass-panel flex-column-gap" style={{ padding: '20px' }}>
      <div>
        <h2 className="section-title">
          <BarChart3 size={18} />
          BẢNG PHÂN TÍCH HIỆU SUẤT (BAE)
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '-8px' }}>
          Đo lường chu kỳ tự thích ứng, độ chính xác tích lũy và phả hệ tối ưu hóa cử chỉ.
        </p>
      </div>

      {/* Gamification & Proficiency Cards */}
      {trends && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
          <div style={{ background: 'rgba(191, 85, 236, 0.08)', border: '1px solid rgba(191, 85, 236, 0.25)', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={24} style={{ color: 'var(--color-accent)' }} />
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Chuỗi Học Tập (Streak)</span>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>{trends.trainingStreak || 0} ngày liên tiếp</span>
            </div>
          </div>

          <div style={{ background: 'rgba(0, 230, 118, 0.08)', border: '1px solid rgba(0, 230, 118, 0.25)', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Award size={24} style={{ color: 'var(--color-success)' }} />
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Điểm Thành Thạo</span>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>{Math.round(trends.userProficiencyScore || 0)} / 100</span>
            </div>
          </div>
        </div>
      )}

      {/* Grid Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Tổng nhận diện</span>
          <div className="stat-value">{totalRecognitions}</div>
        </div>
        <div className="stat-card">
          <span className="stat-label">Chính xác</span>
          <div className="stat-value" style={{ color: 'var(--color-success)' }}>
            {correctRecognitions}
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-label">Độ chính xác</span>
          <div
            className={`stat-value`}
            style={{
              color:
                accuracyPct >= 80
                  ? 'var(--color-success)'
                  : accuracyPct >= 50
                  ? 'var(--color-warning)'
                  : 'var(--color-danger)',
            }}
          >
            {accuracyPct}%
          </div>
        </div>
      </div>

      {/* Sub-Tabs for BAE Metrics */}
      <div className="tabs-container" style={{ marginBottom: '12px', padding: '2px' }}>
        <button
          className={`tab-button ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
          style={{ fontSize: '11px', padding: '6px' }}
        >
          <TrendingUp size={12} style={{ marginRight: '4px' }} />
          Tần suất & Xu hướng
        </button>
        <button
          className={`tab-button ${activeTab === 'matrix' ? 'active' : ''}`}
          onClick={() => setActiveTab('matrix')}
          style={{ fontSize: '11px', padding: '6px' }}
        >
          <Grid size={12} style={{ marginRight: '4px' }} />
          Ma trận Nhầm lẫn
        </button>
        <button
          className={`tab-button ${activeTab === 'health' ? 'active' : ''}`}
          onClick={() => setActiveTab('health')}
          style={{ fontSize: '11px', padding: '6px' }}
        >
          <ShieldAlert size={12} style={{ marginRight: '4px' }} />
          Sức khỏe Prototype
        </button>
      </div>

      {/* Sub-Tab Contents */}
      {activeTab === 'summary' && (
        <>
          {/* Insights for challenging / improving items */}
          {trends && (
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Cử chỉ thách thức nhất:</span>
                <strong style={{ color: 'var(--color-danger)' }}>{trends.hardestGesture || 'N/A'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Cử chỉ tiến bộ nhanh nhất:</span>
                <strong style={{ color: 'var(--color-primary)' }}>{trends.mostImprovedGesture || 'N/A'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Quỹ đạo thích ứng:</span>
                <span style={{ color: trends.learningTrajectory === 'IMPROVING' ? 'var(--color-success)' : 'var(--color-warning)', fontWeight: 'bold' }}>
                  {trends.learningTrajectory === 'IMPROVING' ? 'TĂNG TRƯỞNG TỐT' : 'ỔN ĐỊNH'}
                </span>
              </div>
            </div>
          )}

          {/* SVG Bar Chart for Gesture frequency */}
          {entries.length > 0 ? (
            <div
              style={{
                background: 'rgba(0,0,0,0.15)',
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                <line
                  x1={padding}
                  y1={chartHeight - padding}
                  x2={chartWidth - padding}
                  y2={chartHeight - padding}
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="1"
                />
                <line
                  x1={padding}
                  y1={padding}
                  x2={chartWidth - padding}
                  y2={padding}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />

                {entries.map(([label, val], idx) => {
                  const x = padding + idx * (barWidth + gap);
                  const height = ((chartHeight - 2 * padding) * val) / maxVal;
                  const y = chartHeight - padding - height;

                  if (x + barWidth > chartWidth) return null;

                  return (
                    <g key={label}>
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={height}
                        fill="url(#barGradient)"
                        rx="4"
                      >
                        <title>{`${label}: ${val}`}</title>
                      </rect>
                      <text
                        x={x + barWidth / 2}
                        y={y - 4}
                        fill="var(--color-primary)"
                        fontSize="10"
                        fontWeight="700"
                        textAnchor="middle"
                      >
                        {val}
                      </text>
                      <text
                        x={x + barWidth / 2}
                        y={chartHeight - padding + 12}
                        fill="var(--text-muted)"
                        fontSize="9"
                        fontWeight="600"
                        textAnchor="middle"
                      >
                        {label.substring(0, 5)}
                      </text>
                    </g>
                  );
                })}

                <defs>
                  <linearGradient id="barGradient" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="var(--color-secondary)" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="var(--color-primary)" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          ) : (
            <div
              style={{
                background: 'rgba(0,0,0,0.1)',
                padding: '24px',
                borderRadius: '10px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px',
              }}
            >
              Chưa ghi nhận tần suất dịch cử chỉ nào.
            </div>
          )}
        </>
      )}

      {activeTab === 'matrix' && (
        <div style={{ background: 'rgba(0,0,0,0.25)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
            MA TRẬN NHẦM LẪN THỰC TẾ (PHÁT HIỆN GỬI SAI TỪ BỘ PHẢN HỒI):
          </span>
          {trends && trends.confusionMatrix && Object.keys(trends.confusionMatrix).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                <span>Thực tế</span>
                <span>Dự đoán</span>
                <span>Số lỗi</span>
              </div>
              {Object.entries(trends.confusionMatrix).map(([actual, predictions]: any) => 
                Object.entries(predictions).map(([pred, count]: any) => {
                  if (actual === pred) return null; // Only show errors
                  return (
                    <div key={`${actual}-${pred}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <span style={{ color: 'var(--color-success)' }}>{actual}</span>
                      <span style={{ color: 'var(--color-danger)' }}>{pred}</span>
                      <span style={{ fontWeight: 'bold' }}>{count}</span>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
              Không có lỗi nhận diện nào được ghi nhận. Hệ thống đang hoạt động hoàn hảo!
            </div>
          )}
        </div>
      )}

      {activeTab === 'health' && (
        <div style={{ background: 'rgba(0,0,0,0.25)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
            CHỈ SỐ SỨC KHỎE PROTOTYPE (ILE STABILITY INDEX):
          </span>
          {trends && trends.prototypeHealth && Object.keys(trends.prototypeHealth).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(trends.prototypeHealth).map(([label, health]: any) => (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                    <span>{label}</span>
                    <strong style={{ color: health >= 75 ? 'var(--color-success)' : 'var(--color-warning)' }}>{health}%</strong>
                  </div>
                  <div className="progress-bar-container" style={{ height: '4px' }}>
                    <div 
                      className="progress-bar-fill" 
                      style={{ 
                        width: `${health}%`, 
                        background: health >= 75 ? 'var(--color-success)' : 'var(--color-warning)' 
                      }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
              Đang chờ ghi nhận lịch sử học tập để đánh giá chỉ số sức khỏe của các mẫu cử chỉ.
            </div>
          )}
        </div>
      )}

      {/* Recent History Logs */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
          }}
        >
          <span
            style={{
              fontSize: '13px',
              fontWeight: '600',
              color: 'var(--text-bright)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Clock size={14} style={{ color: 'var(--color-primary)' }} />
            NHẬT KÝ NHẬN DIỆN GẦN ĐÂY
          </span>
          {recentLogs.length > 0 && (
            <button
              className="btn btn-danger btn-small"
              onClick={handleClear}
              disabled={loading}
              style={{
                background: 'transparent',
                borderColor: 'transparent',
                padding: '4px',
                color: 'var(--text-muted)',
              }}
              title="Xóa nhật ký"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>

        {recentLogs.length === 0 ? (
          <div
            style={{
              padding: '16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '12px',
              border: '1px dashed var(--border-color)',
              borderRadius: '8px',
            }}
          >
            Nhật ký đang trống.
          </div>
        ) : (
          <div className="log-list">
            {recentLogs.map((log, index) => {
              const time = new Date(log.timestamp).toLocaleTimeString();
              return (
                <div key={index} className={`log-item ${log.correct ? 'correct' : 'incorrect'}`}>
                  <span className="log-time">{time}</span>
                  <span className="log-labels">
                    {log.correct ? (
                      <span style={{ color: 'var(--color-success)' }}>{log.predicted}</span>
                    ) : (
                      <>
                        <span style={{ textDecoration: 'line-through', color: 'var(--color-danger)' }}>
                          {log.predicted}
                        </span>{' '}
                        &rarr; <span style={{ color: 'var(--color-success)' }}>{log.actual}</span>
                      </>
                    )}
                  </span>
                  <span className="log-conf">
                    {Math.round(log.confidence * 100)}% khớp
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
