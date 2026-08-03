import React, { useState } from 'react';
import { X, ShieldCheck, UserCheck, Lock, Mail, User, Key, Sparkles } from 'lucide-react';
import { type AuthUser } from '../types';
import * as api from '../utils/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isLoginMode, setIsLoginMode] = useState<boolean>(true);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [role, setRole] = useState<'ADMIN' | 'USER'>('USER');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (isLoginMode) {
        const user = await api.loginUser({ email, password });
        onSuccess(user);
      } else {
        const user = await api.registerUser({ fullName, email, password, role });
        onSuccess(user);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Đã xảy ra lỗi!');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLoginAdmin = async () => {
    setErrorMsg('');
    setEmail('admin@signlink.vn');
    setPassword('admin123');
    setLoading(true);
    try {
      const user = await api.loginUser({ email: 'admin@signlink.vn', password: 'admin123' });
      onSuccess(user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi đăng nhập Admin!');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLoginUser = async () => {
    setErrorMsg('');
    setEmail('user@signlink.vn');
    setPassword('user123');
    setLoading(true);
    try {
      const user = await api.loginUser({ email: 'user@signlink.vn', password: 'user123' });
      onSuccess(user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi đăng nhập User!');
    } finally {
      setLoading(false);
    }
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
        maxWidth: '460px',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
        border: '1px solid rgba(0, 242, 254, 0.3)',
        borderRadius: '24px',
        padding: '32px',
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
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <X size={18} />
        </button>

        {/* Header Icon */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 16px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(0, 242, 254, 0.4)'
          }}>
            <Lock size={32} color="#0b1120" />
          </div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '1.5rem', fontWeight: '800' }}>
            {isLoginMode ? 'Đăng Nhập SignLink AI' : 'Tạo Tài Khoản Mới'}
          </h2>
          <p style={{ margin: '6px 0 0', color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.88rem' }}>
            Hệ thống phân quyền thông minh dành cho Người Dùng & Quản Trị Viên
          </p>
        </div>

        {/* Demo Quick Logins */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
          <button
            type="button"
            onClick={handleQuickLoginAdmin}
            style={{
              padding: '10px 12px',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '12px',
              color: '#f59e0b',
              fontSize: '0.8rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <ShieldCheck size={16} /> 👑 Thử Admin (Thầy)
          </button>

          <button
            type="button"
            onClick={handleQuickLoginUser}
            style={{
              padding: '10px 12px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '12px',
              color: '#10b981',
              fontSize: '0.8rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <UserCheck size={16} /> 👤 Thử User (Thành)
          </button>
        </div>

        {/* Form Error Banner */}
        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#f87171',
            borderRadius: '12px',
            padding: '10px 14px',
            fontSize: '0.85rem',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            {errorMsg}
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {!isLoginMode && (
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '6px' }}>Họ và Tên</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255, 255, 255, 0.4)' }} />
                <input
                  type="text"
                  required
                  placeholder="Nhập họ và tên của bạn"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 40px',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '12px',
                    color: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '6px' }}>Địa chỉ Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255, 255, 255, 0.4)' }} />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 40px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '12px',
                  color: '#fff',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '6px' }}>Mật Khẩu</label>
            <div style={{ position: 'relative' }}>
              <Key size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255, 255, 255, 0.4)' }} />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 40px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '12px',
                  color: '#fff',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {!isLoginMode && (
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '6px' }}>Vai Trò Tài Khoản</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'ADMIN' | 'USER')}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '12px',
                  color: '#fff',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                <option value="USER">👤 NGƯỜI DÙNG THƯỜNG (USER)</option>
                <option value="ADMIN">👑 QUẢN TRỊ VIÊN HỆ THỐNG (ADMIN)</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '10px',
              padding: '14px',
              background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
              border: 'none',
              borderRadius: '14px',
              color: '#0b1120',
              fontWeight: '800',
              fontSize: '1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 8px 24px rgba(0, 242, 254, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Sparkles size={18} /> {loading ? 'Đang Xử Lý...' : (isLoginMode ? 'Đăng Nhập Ngay' : 'Tạo Tài Khoản Mới')}
          </button>
        </form>

        {/* Switch Tab Footer */}
        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>
          {isLoginMode ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
          <button
            type="button"
            onClick={() => { setIsLoginMode(!isLoginMode); setErrorMsg(''); }}
            style={{ background: 'none', border: 'none', color: '#00f2fe', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {isLoginMode ? 'Đăng ký ngay' : 'Đăng nhập ngay'}
          </button>
        </div>
      </div>
    </div>
  );
};
