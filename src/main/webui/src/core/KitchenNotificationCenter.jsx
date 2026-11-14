import React, { useState, useEffect, useRef, useCallback } from 'react';
import { kitchenApi } from '../api/kitchenApi.js';
import { bus } from './plugins.js';
import { useAuth } from './auth.jsx';
import { useTenant } from './tenant.js';

// Web Audio API: Âm thanh báo món đã xong cho nhân viên phục vụ
export function playKitchenReadyChime() {
  try {
    const isMuted = localStorage.getItem('kitchen_chime_muted') === '1';
    if (isMuted) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Nốt 1: G5 (784Hz) - Âm vang nhẹ
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(783.99, now);
    gain1.gain.setValueAtTime(0.28, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Nốt 2: C6 (1046.5Hz) - Âm cao tươi vui báo hiệu món sẵn sàng
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1046.5, now + 0.16);
    gain2.gain.setValueAtTime(0.35, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.16);
    osc2.stop(now + 0.65);
  } catch (_) {
    // Không chặn UI nếu trình duyệt chưa cấp quyền AudioContext
  }
}

export default function KitchenNotificationCenter() {
  const { user } = useAuth();
  const companyId = useTenant();
  const [toasts, setToasts] = useState([]);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('kitchen_chime_muted') === '1');
  const panelRef = useRef(null);

  const toggleMute = (e) => {
    e?.stopPropagation();
    const next = !isMuted;
    setIsMuted(next);
    localStorage.setItem('kitchen_chime_muted', next ? '1' : '0');
  };

  const addToast = useCallback((toast) => {
    const item = {
      id: Date.now() + Math.random().toString(36).substr(2, 6),
      time: new Date(),
      ...toast,
    };

    setToasts((prev) => [item, ...prev].slice(0, 5));
    setHistory((prev) => [item, ...prev].slice(0, 30));

    // Tự động ẩn toast sau 8s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== item.id));
    }, 8000);
  }, []);

  const removeToast = (id, e) => {
    e?.stopPropagation();
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleOpenTable = (tableId, tableName) => {
    if (!tableId) return;
    // Chuyển sang plugin minibar và mở bàn tương ứng
    bus.emit('navigate', {
      pluginId: 'minibar',
      state: {
        tab: 'order',
        activeTableId: tableId,
        currentTableId: tableId,
        tableName: tableName,
        activeTable: null,
      },
    });
    // Đóng history panel nếu đang mở
    setShowHistory(false);
  };

  // Lắng nghe click ngoài để đóng history panel
  useEffect(() => {
    if (!showHistory) return;
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHistory]);

  // Kết nối SSE thông báo Bếp từ SmallRye Mutiny (theo tenant/công ty hiện tại)
  useEffect(() => {
    if (!user) return undefined;

    const handleMessage = (data) => {
      if (!data || typeof data !== 'object') return;

      // Lọc theo tenant: nếu người dùng đang ở 1 công ty cụ thể và event có tenantId khác thì bỏ qua
      if (companyId && data.companyId && String(data.companyId) !== String(companyId)) {
        return;
      }

      // Phát cho toàn bộ hệ thống qua Event Bus
      bus.emit('kitchen:event', data);

      const type = data.type;
      const tableName = data.tableName || data.tableId || 'Bàn';

      if (type === 'ROUND_COMPLETED') {
        playKitchenReadyChime();
        addToast({
          type: 'success',
          icon: '🍽️',
          title: `Bếp xong đợt món: ${tableName}`,
          message: `Đợt ${data.round} (${data.count || 0} món) đã sẵn sàng phục vụ!`,
          tableId: data.tableId,
          tableName: tableName,
        });
      } else if (type === 'ITEM_STATUS_CHANGED') {
        if (data.status === 'served') {
          playKitchenReadyChime();
          addToast({
            type: 'success',
            icon: '✅',
            title: `Món đã xong: ${tableName}`,
            message: `${data.productName || 'Món ăn'} (x${data.qty || 1}) đã chế biến xong, mời phục vụ!`,
            tableId: data.tableId,
            tableName: tableName,
          });
        } else if (data.status === 'preparing') {
          addToast({
            type: 'info',
            icon: '🔥',
            title: `Bếp đang làm: ${tableName}`,
            message: `${data.productName || 'Món'} đang được chế biến.`,
            tableId: data.tableId,
            tableName: tableName,
          });
        } else if (data.status === 'cancelled') {
          addToast({
            type: 'danger',
            icon: '⚠️',
            title: `Bếp báo hủy/hết: ${tableName}`,
            message: `${data.productName || 'Món'} đã bị hủy.`,
            tableId: data.tableId,
            tableName: tableName,
          });
        }
      } else if (type === 'ROUND_PREPARING') {
        addToast({
          type: 'info',
          icon: '🔥',
          title: `Bếp nhận làm: ${tableName}`,
          message: `Đang chế biến đợt ${data.round} (${data.count || 0} món).`,
          tableId: data.tableId,
          tableName: tableName,
        });
      } else if (type === 'NEW_ORDER') {
        addToast({
          type: 'neutral',
          icon: '🛎️',
          title: `Đã gửi bếp: ${tableName}`,
          message: `Đợt ${data.round} gồm ${data.itemCount || 0} món đã được chuyển đến bếp.`,
          tableId: data.tableId,
          tableName: tableName,
        });
      }
    };

    const unsubscribe = kitchenApi.subscribeEvents(handleMessage, undefined, companyId);
    return () => {
      unsubscribe?.();
    };
  }, [user, companyId, addToast]);

  return (
    <>
      {/* Nút chuông thông báo nổi góc dưới bên phải */}
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          right: '20px',
          bottom: '36px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          pointerEvents: 'auto',
        }}
      >
        {/* Lịch sử thông báo Popup */}
        {showHistory && (
          <div
            style={{
              width: '320px',
              maxHeight: '400px',
              background: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
              marginBottom: '10px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'fadeIn 0.15s ease',
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <b style={{ fontSize: '13px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🔔</span> Thông báo Bếp & Order
              </b>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={toggleMute}
                  title={isMuted ? 'Bật chuông thông báo' : 'Tắt chuông thông báo'}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    padding: '2px 4px',
                  }}
                >
                  {isMuted ? '🔕' : '🔔'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowHistory(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#94a3b8',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
              {history.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '12.5px' }}>
                  Chưa có thông báo mới từ Bếp
                </div>
              ) : (
                history.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => handleOpenTable(h.tableId, h.tableName)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      borderBottom: '1px solid #f1f5f9',
                      cursor: h.tableId ? 'pointer' : 'default',
                      background: h.type === 'success' ? '#f0fdf4' : h.type === 'danger' ? '#fef2f2' : '#ffffff',
                      marginBottom: '4px',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(0.97)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: h.type === 'success' ? '#166534' : h.type === 'danger' ? '#991b1b' : '#0369a1' }}>
                        {h.icon} {h.title}
                      </span>
                      <small style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                        {h.time ? h.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                      </small>
                    </div>
                    <div style={{ fontSize: '12px', color: '#334155', lineHeight: '1.4' }}>
                      {h.message}
                    </div>
                    {h.tableId && (
                      <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '3px', fontWeight: '600' }}>
                        👉 Nhấn để mở bàn
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Nút tròn nổi Bell Icon */}
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: toasts.length > 0 ? '#16a34a' : '#0284c7',
            color: '#ffffff',
            border: 'none',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            cursor: 'pointer',
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            transition: 'transform 0.15s ease',
          }}
          title={showHistory ? 'Đóng thông báo' : 'Xem thông báo bếp'}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <span>🍳</span>
          {toasts.length > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: '#ef4444',
                color: '#ffffff',
                fontSize: '10.5px',
                fontWeight: 'bold',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #ffffff',
                animation: 'pulse 1.5s infinite',
              }}
            >
              {toasts.length}
            </span>
          )}
        </button>
      </div>

      {/* Floating Toasts: Hiển thị ngay góc trên bên phải khi bếp hoàn thành */}
      <div
        style={{
          position: 'fixed',
          top: '55px',
          right: '18px',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxWidth: '380px',
          width: 'calc(100vw - 36px)',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isDanger = toast.type === 'danger';
          const bg = isSuccess ? '#ecfdf5' : isDanger ? '#fef2f2' : '#f0f9ff';
          const border = isSuccess ? '#6ee7b7' : isDanger ? '#fca5a5' : '#7dd3fc';
          const textHeader = isSuccess ? '#065f46' : isDanger ? '#991b1b' : '#0369a1';

          return (
            <div
              key={toast.id}
              onClick={() => handleOpenTable(toast.tableId, toast.tableName)}
              style={{
                pointerEvents: 'auto',
                background: bg,
                border: `1.5px solid ${border}`,
                borderRadius: '10px',
                padding: '12px 14px',
                boxShadow: '0 10px 20px -3px rgba(0, 0, 0, 0.15)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                cursor: toast.tableId ? 'pointer' : 'default',
                transform: 'translateY(0)',
                animation: 'slideInRight 0.25s ease',
                position: 'relative',
              }}
            >
              <span style={{ fontSize: '20px', lineHeight: 1 }}>{toast.icon}</span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                  <b style={{ fontSize: '13px', color: textHeader }}>
                    {toast.title}
                  </b>
                  <button
                    type="button"
                    onClick={(e) => removeToast(toast.id, e)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '14px',
                      padding: '0 4px',
                      lineHeight: 1,
                    }}
                    title="Đóng thông báo"
                  >
                    ✕
                  </button>
                </div>
                <div style={{ fontSize: '12.5px', color: '#1e293b', fontWeight: '500', lineHeight: '1.4' }}>
                  {toast.message}
                </div>
                {toast.tableId && (
                  <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '4px', fontWeight: '600' }}>
                    👉 Bấm vào đây để mở bàn ngay
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

