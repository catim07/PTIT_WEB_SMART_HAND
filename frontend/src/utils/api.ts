import { type GestureSample, type GestureTemplate, type RecognitionStats, type SystemSettings, type AuthUser, type LoginCredentials, type RegisterData } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function loginUser(credentials: LoginCredentials): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Đăng nhập thất bại!');
  return data;
}

export async function registerUser(regData: RegisterData): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(regData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Đăng ký thất bại!');
  return data;
}

export async function getMe(token: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Phiên đăng nhập hết hạn!');
  return res.json();
}

export async function fetchSettings(): Promise<SystemSettings> {
  // Return default values as they are now processed client-side and via WebSocket thresholds
  return {
    kmeansK: 3,
    knnK: 1,
    minConfidence: 0.65
  };
}

export async function updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
  // Settings can be saved to localStorage to be persistent in client sessions
  localStorage.setItem('signlink_settings', JSON.stringify(settings));
  return {
    kmeansK: settings.kmeansK || 3,
    knnK: settings.knnK || 1,
    minConfidence: settings.minConfidence || 0.65
  };
}

export async function fetchSamples(): Promise<GestureSample[]> {
  const res = await fetch(`${API_BASE}/api/gestures/samples`);
  if (!res.ok) throw new Error('Failed to fetch samples');
  const data = await res.json();
  return data.map((s: any) => ({
    id: s.id,
    label: s.label,
    landmarksSequence: JSON.parse(s.landmarksSequence),
    featureVectors: s.featureVectors ? JSON.parse(s.featureVectors) : [],
    createdAt: s.createdAt
  }));
}

export async function addSample(sample: GestureSample, userId?: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/gestures/samples`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: userId || '00000000-0000-0000-0000-000000000000',
      label: sample.label,
      landmarksSequence: sample.landmarksSequence
    }),
  });
  if (!res.ok) throw new Error('Failed to save training sample');
  return res.json();
}

export async function deleteSample(id: string): Promise<any> {
  // Deleting single samples can delete by calling standard backend delete
  const res = await fetch(`${API_BASE}/api/gestures/samples/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete sample');
  return res.json();
}

export async function deleteGesture(label: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/gestures/${label}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete gesture');
  return res.json();
}

export async function fetchTemplates(): Promise<GestureTemplate[]> {
  const res = await fetch(`${API_BASE}/api/gestures/templates`);
  if (!res.ok) throw new Error('Failed to fetch templates');
  const data = await res.json();
  return data.map((t: any) => ({
    id: t.id,
    label: t.label,
    featureVectors: JSON.parse(t.featureVectors),
    landmarksSequence: t.landmarksSequence ? JSON.parse(t.landmarksSequence) : [],
    sampleCount: t.sampleCount,
    isPrototype: true,
    updatedAt: t.updatedAt
  }));
}

export async function optimizeTemplates(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/gestures/optimize`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to optimize templates');
  return res.json();
}

export async function syncAdaptedTemplate(_id: string, _featureVectors: number[][]): Promise<any> {
  // Now handled dynamically on the backend when correct=true log is posted
  return { message: "Optimistic local sync done" };
}

export async function logRecognition(log: {
  predictedLabel: string;
  actualLabel: string;
  confidence: number;
  correct: boolean;
  featureVectors?: number[][];
  landmarksSequence?: any[][];
}): Promise<any> {
  const res = await fetch(`${API_BASE}/api/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: '00000000-0000-0000-0000-000000000000',
      predictedLabel: log.predictedLabel,
      actualLabel: log.actualLabel,
      confidence: log.confidence,
      correct: log.correct,
      featureVectors: log.featureVectors,
      landmarksSequence: log.landmarksSequence
    }),
  });
  if (!res.ok) throw new Error('Failed to save log');
  return res.json();
}

export async function fetchStats(): Promise<RecognitionStats> {
  const res = await fetch(`${API_BASE}/api/logs/stats`);
  if (!res.ok) throw new Error('Failed to fetch statistics');
  const data = await res.json();
  return {
    totalRecognitions: data.totalRecognitions,
    correctRecognitions: data.correctRecognitions,
    accuracy: data.accuracy,
    gestureCounts: data.gestureCounts,
    recentLogs: data.recentLogs.map((l: any) => ({
      timestamp: l.timestamp || Date.now(),
      predicted: l.predictedLabel,
      actual: l.actualLabel,
      confidence: l.confidence,
      correct: l.correct
    }))
  };
}

export async function clearLogs(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/logs`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to clear logs');
  return res.json();
}

export async function fetchEvolutions(label: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/api/gestures/templates/evolutions/${label}`);
  if (!res.ok) throw new Error('Failed to fetch evolutions');
  return res.json();
}

export async function fetchKnowledgeGraph(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/gestures/knowledge/graph`);
  if (!res.ok) throw new Error('Failed to fetch knowledge graph');
  return res.json();
}

export async function fetchTrends(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/logs/trends`);
  if (!res.ok) throw new Error('Failed to fetch trends');
  return res.json();
}
