import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth.jsx';
import { useI18n } from './i18n.jsx';

export default function PosLockScreen({ onUnlock, onLogout }) {
  const { user, verifyPin, verifyPassword } = useAuth();
  const { t } = useI18n();

  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState(user?.hasPin ? 'pin' : 'password'); // 'pin' | 'password'
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [shake, setShake] = useState(false);

  // Live time for lock screen
  const [nowTime, setNowTime] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const triggerError = (msg) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleUnlockWithPin = useCallback(async (pinToTest) => {
    const code = pinToTest !== undefined ? pinToTest : pin;
    if (!code || code.length < 4) {
      triggerError(t('pos.pinMinLength') || 'Vui lòng nhập đủ mã PIN (tối thiểu 4 số)');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await verifyPin(code);
      setPin('');
      onUnlock?.();
    } catch (err) {
      setPin('');
      triggerError(err?.message || (t('pos.pinIncorrect') || 'Mã PIN không chính xác, vui lòng thử lại'));
    } finally {
      setSubmitting(false);
    }
  }, [pin, verifyPin, onUnlock, t]);

  const handleUnlockWithPassword = async (e) => {
    e?.preventDefault();
    if (!password) {
      triggerError(t('pos.passwordRequired') || 'Vui lòng nhập mật khẩu');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await verifyPassword(password);
      setPassword('');
      onUnlock?.();
    } catch (err) {
      triggerError(err?.message || (t('pos.passwordIncorrect') || 'Mật khẩu không chính xác'));
    } finally {
      setSubmitting(false);
    }
  };

  // Keyboard handler for typing PIN
  useEffect(() => {
    if (mode !== 'pin') return undefined;

    const onKeyDown = (e) => {
      // Ignore if user is inside another input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        setPin((prev) => {
          if (prev.length >= 6) return prev;
          const next = prev + e.key;
          return next;
        });
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setPin((prev) => prev.slice(0, -1));
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        e.preventDefault();
        setPin('');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleUnlockWithPin();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, handleUnlockWithPin]);

  const onKeypadPress = (val) => {
    setError(null);
    if (val === 'clear') {
      setPin('');
    } else if (val === 'backspace') {
      setPin((prev) => prev.slice(0, -1));
    } else {
      setPin((prev) => {
        if (prev.length >= 6) return prev;
        const next = prev + String(val);
        return next;
      });
    }
  };

  const username = user?.username || '?';
  const display = user?.name && user.name !== username ? user.name : username;

  return (
    <div
      className="pos-lock-screen"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999999,
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.97) 0%, rgba(30, 41, 59, 0.98) 100%)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '24px 16px',
        color: '#f8fafc',
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Header */}
      <div style={{ width: '100%', maxWidth: '600px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700', letterSpacing: '0.5px', color: '#94a3b8' }}>
          <span>🏪</span> {t('app.name')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '600', color: '#38bdf8', fontVariantNumeric: 'tabular-nums' }}>
          <span>⏱️</span>
          <span>{nowTime.toLocaleTimeString('vi-VN')}</span>
          <span style={{ color: '#64748b', margin: '0 4px' }}>•</span>
          <span style={{ color: '#cbd5e1', fontSize: '13px' }}>
            {nowTime.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Center Lock Box */}
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          background: 'rgba(30, 41, 59, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '20px',
          padding: '28px 24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          animation: shake ? 'shake 0.4s ease-in-out' : 'none',
        }}
      >
        {/* User Card */}
        <div style={{ position: 'relative', marginBottom: '14px' }}>
          <span
            className="avatar lg"
            style={{
              width: '64px',
              height: '64px',
              fontSize: '26px',
              border: '3px solid #38bdf8',
              boxShadow: '0 0 15px rgba(56, 189, 248, 0.3)',
            }}
          >
            {user?.imageUrl ? <img src={user.imageUrl} alt={username} /> : display[0].toUpperCase()}
          </span>
          <span
            style={{
              position: 'absolute',
              bottom: '-2px',
              right: '-2px',
              background: '#0ea5e9',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'grid',
              placeItems: 'center',
              fontSize: '11px',
              border: '2px solid #0f172a',
            }}
          >
            🔒
          </span>
        </div>

        <h2 style={{ margin: '0 0 4px 0', fontSize: '19px', fontWeight: '700', color: '#fff', textAlign: 'center' }}>
          {display}
        </h2>
        <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>@{username}</div>
        <span
          style={{
            fontSize: '11.5px',
            fontWeight: '600',
            padding: '2px 10px',
            borderRadius: '12px',
            background: 'rgba(56, 189, 248, 0.15)',
            color: '#38bdf8',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            marginBottom: '18px',
          }}
        >
          {user?.roleName || user?.role}
        </span>

        {/* Error message */}
        {error && (
          <div
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '8px',
              color: '#fca5a5',
              fontSize: '12.5px',
              textAlign: 'center',
              marginBottom: '16px',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Mode: PIN */}
        {mode === 'pin' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '13.5px', color: '#cbd5e1', marginBottom: '14px', fontWeight: '500' }}>
              {t('pos.enterPin') || 'Nhập mã PIN để mở khóa màn hình'}
            </div>

            {/* PIN Dots Display */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: '22px',
                height: '36px',
              }}
            >
              {[0, 1, 2, 3, 4, 5].map((idx) => {
                const filled = pin.length > idx;
                return (
                  <div
                    key={idx}
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      background: filled ? '#38bdf8' : 'rgba(255, 255, 255, 0.12)',
                      border: filled ? '2px solid #bae6fd' : '2px solid rgba(255, 255, 255, 0.25)',
                      boxShadow: filled ? '0 0 10px #38bdf8' : 'none',
                      transition: 'all 0.15s ease',
                      transform: filled ? 'scale(1.15)' : 'scale(1)',
                    }}
                  />
                );
              })}
            </div>

            {/* Touch Keypad */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                width: '100%',
                marginBottom: '16px',
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => onKeypadPress(num)}
                  disabled={submitting}
                  style={{
                    height: '52px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    fontSize: '22px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.1s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  }}
                  onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.94)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)'; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onKeypadPress('clear')}
                disabled={submitting}
                style={{
                  height: '52px',
                  borderRadius: '12px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.1s ease',
                }}
              >
                XÓA (C)
              </button>
              <button
                type="button"
                onClick={() => onKeypadPress(0)}
                disabled={submitting}
                style={{
                  height: '52px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  fontSize: '22px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.1s ease',
                }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.94)'; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                0
              </button>
              <button
                type="button"
                onClick={() => onKeypadPress('backspace')}
                disabled={submitting}
                style={{
                  height: '52px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#94a3b8',
                  fontSize: '20px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.1s ease',
                }}
              >
                ⌫
              </button>
            </div>

            {/* Unlock Button */}
            <button
              type="button"
              onClick={() => handleUnlockWithPin()}
              disabled={submitting || pin.length < 4}
              style={{
                width: '100%',
                height: '46px',
                borderRadius: '10px',
                background: pin.length >= 4 ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: pin.length >= 4 ? '#fff' : '#64748b',
                fontSize: '15px',
                fontWeight: '700',
                cursor: pin.length >= 4 ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: pin.length >= 4 ? '0 4px 14px rgba(2, 132, 199, 0.4)' : 'none',
                transition: 'all 0.15s ease',
                marginBottom: '14px',
              }}
            >
              {submitting ? '⏳ Đang kiểm tra...' : '🔓 Mở khóa POS'}
            </button>

            {/* Switch to password mode */}
            <button
              type="button"
              onClick={() => { setMode('password'); setError(null); }}
              style={{
                background: 'none',
                border: 'none',
                color: '#38bdf8',
                fontSize: '12.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span>🔑</span> Mở khóa bằng mật khẩu tài khoản
            </button>
          </div>
        )}

        {/* Mode: Password */}
        {mode === 'password' && (
          <form onSubmit={handleUnlockWithPassword} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '13.5px', color: '#cbd5e1', marginBottom: '12px', fontWeight: '500', textAlign: 'center' }}>
              {t('pos.enterPassword') || 'Nhập mật khẩu tài khoản để mở khóa'}
            </div>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mật khẩu của bạn..."
              autoFocus
              style={{
                width: '100%',
                height: '44px',
                padding: '0 14px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                background: 'rgba(15, 23, 42, 0.6)',
                color: '#fff',
                fontSize: '15px',
                marginBottom: '14px',
                boxSizing: 'border-box',
              }}
            />

            <button
              type="submit"
              disabled={submitting || !password}
              style={{
                width: '100%',
                height: '44px',
                borderRadius: '10px',
                background: password ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: password ? '#fff' : '#64748b',
                fontSize: '14.5px',
                fontWeight: '700',
                cursor: password ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '14px',
              }}
            >
              {submitting ? '⏳ Đang kiểm tra...' : '🔓 Mở khóa'}
            </button>

            {user?.hasPin && (
              <button
                type="button"
                onClick={() => { setMode('pin'); setError(null); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#38bdf8',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <span>🔢</span> Quay lại nhập mã PIN
              </button>
            )}
          </form>
        )}
      </div>

      {/* Bottom Actions */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <button
          type="button"
          onClick={onLogout}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '20px',
            padding: '8px 18px',
            color: '#cbd5e1',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.color = '#fca5a5'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.color = '#cbd5e1'; }}
        >
          <span>🚪</span> {t('pos.switchAccount') || 'Đổi tài khoản / Đăng xuất'}
        </button>
      </div>
    </div>
  );
}

