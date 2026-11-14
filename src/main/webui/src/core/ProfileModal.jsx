import { useState } from 'react';
import { useAuth } from './auth.jsx';
import { useI18n } from './i18n.jsx';

export default function ProfileModal({ onClose }) {
  const { user, updateProfile } = useAuth();
  const { t } = useI18n();

  const [fullName, setFullName] = useState(user?.name || '');
  const [imageUrl, setImageUrl] = useState(user?.imageUrl || '');
  
  // PIN states
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [clearPinFlag, setClearPinFlag] = useState(false);

  // Password states
  const [showPwdSection, setShowPwdSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSave = async (e) => {
    e?.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate PIN
    if (!clearPinFlag && pin) {
      if (!/^\d{4,6}$/.test(pin)) {
        setError(t('profile.pinLengthError') || 'Mã PIN phải gồm từ 4 đến 6 chữ số (0-9)');
        return;
      }
      if (pin !== confirmPin) {
        setError(t('profile.pinMismatch') || 'Xác nhận mã PIN không khớp');
        return;
      }
    }

    // Validate Password
    if (newPassword) {
      if (!currentPassword) {
        setError(t('profile.currentPwdRequired') || 'Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu');
        return;
      }
      if (newPassword.length < 6) {
        setError(t('profile.pwdLengthError') || 'Mật khẩu mới phải từ 6 ký tự trở lên');
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setError(t('profile.pwdMismatch') || 'Xác nhận mật khẩu mới không khớp');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        fullName: fullName.trim(),
        imageUrl: imageUrl.trim(),
      };

      if (clearPinFlag) {
        payload.pin = '';
      } else if (pin) {
        payload.pin = pin;
      }

      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.password = newPassword;
      }

      await updateProfile(payload);
      setSuccess(t('profile.saveSuccess') || 'Cập nhật hồ sơ thành công!');
      setTimeout(() => {
        onClose?.();
      }, 900);
    } catch (err) {
      setError(err?.message || 'Có lỗi xảy ra khi cập nhật hồ sơ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="confirm-backdrop" style={{ zIndex: 10000005 }} onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        className="confirm-box"
        style={{
          width: '460px',
          maxWidth: '94vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          borderRadius: '12px',
          background: '#fff',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>👤</span> {t('profile.title') || 'Hồ sơ cá nhân & Mã PIN'}
          </h3>
          <button type="button" className="tb" onClick={onClose} style={{ fontSize: '18px', padding: '4px 8px' }}>
            ✕
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontSize: '13px', marginBottom: '14px' }}>
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', color: '#15803d', fontSize: '13px', marginBottom: '14px' }}>
            ✅ {success}
          </div>
        )}

        <form onSubmit={handleSave}>
          {/* User info card */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
            <span className="avatar lg" style={{ width: '48px', height: '48px', fontSize: '20px', flexShrink: 0 }}>
              {imageUrl ? <img src={imageUrl} alt={user?.username} /> : (user?.name || user?.username || '?')[0].toUpperCase()}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#1e293b' }}>{user?.name || user?.username}</div>
              <div style={{ fontSize: '12.5px', color: '#64748b' }}>@{user?.username}</div>
              <span className="usermenu-role" style={{ marginTop: '4px', display: 'inline-block' }}>
                {user?.roleName || user?.role}
              </span>
            </div>
          </div>

          {/* Full name & avatar URL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: '600', color: '#334155' }}>
              {t('profile.fullName') || 'Họ và tên'}
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nhập họ và tên..."
                style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: '600', color: '#334155' }}>
              {t('profile.avatarUrl') || 'Đường dẫn ảnh đại diện (URL)'}
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
              />
            </label>
          </div>

          {/* PIN Section */}
          <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px', background: '#fdfcfe', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>
                <span>🔒</span> {t('profile.posPinTitle') || 'Mã PIN khóa màn hình POS'}
              </div>
              <div>
                {user?.hasPin && !clearPinFlag ? (
                  <span style={{ fontSize: '11.5px', fontWeight: '600', color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: '12px' }}>
                    ✅ Đã bật mã PIN
                  </span>
                ) : (
                  <span style={{ fontSize: '11.5px', fontWeight: '600', color: '#94a3b8', background: '#f1f5f9', padding: '2px 8px', borderRadius: '12px' }}>
                    ⚪ Chưa có mã PIN
                  </span>
                )}
              </div>
            </div>

            <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#64748b', lineHeight: '1.4' }}>
              Mã PIN gồm 4 đến 6 chữ số dùng để mở khóa nhanh POS khi nhân viên tạm rời quầy thu ngân/bàn.
            </p>

            {clearPinFlag ? (
              <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px dashed #fca5a5', borderRadius: '6px', fontSize: '12.5px', color: '#dc2626', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Mã PIN sẽ bị xóa khi bạn bấm Lưu.</span>
                <button type="button" className="tb" onClick={() => setClearPinFlag(false)} style={{ fontSize: '12px' }}>
                  Hủy xóa
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                      {user?.hasPin ? 'Đổi mã PIN mới (4-6 số)' : 'Cài đặt mã PIN mới (4-6 số)'}
                    </label>
                    <input
                      type={showPin ? 'text' : 'password'}
                      maxLength={6}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="vd: 1234"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', letterSpacing: '2px', boxSizing: 'border-box' }}
                    />
                  </div>
                  {pin && (
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                        Xác nhận mã PIN
                      </label>
                      <input
                        type={showPin ? 'text' : 'password'}
                        maxLength={6}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="Nhập lại mã PIN"
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', letterSpacing: '2px', boxSizing: 'border-box' }}
                      />
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setShowPin((v) => !v)}
                    style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '12px', cursor: 'pointer', padding: 0 }}
                  >
                    {showPin ? '🙈 Ẩn mã PIN' : '👁️ Hiện mã PIN'}
                  </button>
                  {user?.hasPin && (
                    <button
                      type="button"
                      onClick={() => setClearPinFlag(true)}
                      style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '12px', cursor: 'pointer', padding: 0 }}
                    >
                      🗑️ Xóa mã PIN hiện tại
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Change password toggle */}
          <div style={{ marginBottom: '18px' }}>
            <button
              type="button"
              onClick={() => setShowPwdSection((v) => !v)}
              style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '13px', fontWeight: '600', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span>{showPwdSection ? '▼' : '▶'}</span> {t('profile.changePassword') || 'Đổi mật khẩu tài khoản'}
            </button>

            {showPwdSection && (
              <div style={{ marginTop: '10px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: '600', color: '#475569' }}>
                  {t('profile.currentPassword') || 'Mật khẩu hiện tại'}
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Nhập mật khẩu hiện tại..."
                    style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
                  />
                </label>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: '600', color: '#475569' }}>
                    {t('profile.newPassword') || 'Mật khẩu mới (tối thiểu 6 ký tự)'}
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mật khẩu mới..."
                      style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
                    />
                  </label>
                  <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: '600', color: '#475569' }}>
                    {t('profile.confirmNewPassword') || 'Xác nhận mật khẩu mới'}
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu..."
                      style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
                    />
                  </label>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '12px', cursor: 'pointer', padding: 0 }}
                  >
                    {showPassword ? '🙈 Ẩn mật khẩu' : '👁️ Hiện mật khẩu'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              {t('common.cancel') || 'Hủy'}
            </button>
            <button type="submit" className="btn primary" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {saving ? '⏳ Đang lưu...' : (t('common.save') || 'Lưu thay đổi')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

