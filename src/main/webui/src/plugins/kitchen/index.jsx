import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { kitchenApi } from '../../api/kitchenApi.js';
import { useTenant } from '../../core/tenant.js';

// Web Audio API Synthesizer: Chuông báo đơn mới (không cần file âm thanh bên ngoài)
function playKitchenChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const now = ctx.currentTime;
    // Nốt 1: 659.25 Hz (E5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Nốt 2: 880 Hz (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.18);
    gain2.gain.setValueAtTime(0.35, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.65);
  } catch (_) {}
}

const messages = {
  vi: {
    'kitchen.title': 'Bếp / Bar (KDS)',
    'kitchen.kdsTitle': 'MÀN HÌNH BẾP & QUẦY BAR (KDS)',
    'kitchen.allTickets': 'Tất cả đơn chờ',
    'kitchen.waiting': 'Chờ chế biến',
    'kitchen.preparing': 'Đang chế biến',
    'kitchen.completed': 'Đã hoàn thành',
    'kitchen.showCompleted': 'Hiện đơn đã xong',
    'kitchen.refresh': 'Làm mới',
    'kitchen.soundOn': '🔔 Âm báo: BẬT',
    'kitchen.soundOff': '🔕 Âm báo: TẮT',
    'kitchen.fullscreen': '⛶ Toàn màn hình',
    'kitchen.exitFullscreen': '✖ Thu nhỏ',
    'kitchen.searchPlaceholder': 'Tìm theo tên món, tên bàn…',
    'kitchen.allAreas': 'Tất cả khu vực',
    'kitchen.round': 'Đợt',
    'kitchen.roundShort': 'Đợt {round}',
    'kitchen.staff': 'Phục vụ',
    'kitchen.guest': 'Khách',
    'kitchen.waitingTime': 'Chờ',
    'kitchen.minutes': 'phút',
    'kitchen.seconds': 'giây',
    'kitchen.statusSent': 'Chờ làm',
    'kitchen.statusPreparing': 'Đang làm',
    'kitchen.statusServed': 'Đã xong',
    'kitchen.statusCancelled': 'Đã hủy',
    'kitchen.btnStartRound': '👩‍🍳 Nhận làm cả đợt',
    'kitchen.btnCompleteRound': '✅ HOÀN THÀNH ĐỢT',
    'kitchen.emptyTickets': 'Hiện tại không có đơn nào đang chờ chế biến.',
    'kitchen.liveConnected': 'Trực tiếp (SSE)',
    'kitchen.liveConnecting': 'Đang kết nối lại…',
    'kitchen.newOrderNotification': 'Có đơn mới gửi tới bếp!',
    'kitchen.urgentBadge': 'QUÁ HẠN (>15p)',
    'kitchen.warningBadge': 'ĐỢI LÂU (>7p)',
    'kitchen.normalBadge': 'Vừa gửi',
    'kitchen.totalPending': 'Tổng chờ',
    'kitchen.itemsCount': 'món',
    'kitchen.confirmCancel': 'Bếp xác nhận hủy món "{name}"?',
    'kitchen.cancelReasonPrompt': 'Nhập lý do hủy (ví dụ: Hết nguyên liệu, Khách đổi ý):',
    'kitchen.cancelSuccess': 'Đã hủy món thành công.',
  },
  en: {
    'kitchen.title': 'Kitchen / Bar (KDS)',
    'kitchen.kdsTitle': 'KITCHEN & BAR DISPLAY SYSTEM (KDS)',
    'kitchen.allTickets': 'All Pending',
    'kitchen.waiting': 'Waiting',
    'kitchen.preparing': 'In Progress',
    'kitchen.completed': 'Completed',
    'kitchen.showCompleted': 'Show Completed',
    'kitchen.refresh': 'Refresh',
    'kitchen.soundOn': '🔔 Sound: ON',
    'kitchen.soundOff': '🔕 Sound: OFF',
    'kitchen.fullscreen': '⛶ Fullscreen',
    'kitchen.exitFullscreen': '✖ Exit Fullscreen',
    'kitchen.searchPlaceholder': 'Search dish, table…',
    'kitchen.allAreas': 'All Areas',
    'kitchen.round': 'Round',
    'kitchen.roundShort': 'Round {round}',
    'kitchen.staff': 'Staff',
    'kitchen.guest': 'Guests',
    'kitchen.waitingTime': 'Wait',
    'kitchen.minutes': 'mins',
    'kitchen.seconds': 'secs',
    'kitchen.statusSent': 'Pending',
    'kitchen.statusPreparing': 'Cooking',
    'kitchen.statusServed': 'Done',
    'kitchen.statusCancelled': 'Cancelled',
    'kitchen.btnStartRound': '👩‍🍳 Start All',
    'kitchen.btnCompleteRound': '✅ COMPLETE ROUND',
    'kitchen.emptyTickets': 'No active orders waiting in the kitchen right now.',
    'kitchen.liveConnected': 'Live (SSE)',
    'kitchen.liveConnecting': 'Reconnecting…',
    'kitchen.newOrderNotification': 'New order sent to kitchen!',
    'kitchen.urgentBadge': 'URGENT (>15m)',
    'kitchen.warningBadge': 'WAITING (>7m)',
    'kitchen.normalBadge': 'Just sent',
    'kitchen.totalPending': 'Total waiting',
    'kitchen.itemsCount': 'items',
    'kitchen.confirmCancel': 'Confirm cancel item "{name}"?',
    'kitchen.cancelReasonPrompt': 'Enter cancellation reason (e.g. Out of ingredients):',
    'kitchen.cancelSuccess': 'Item cancelled successfully.',
  },
};

export function KitchenScreen({ can = () => true, t = (k) => k }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // all | waiting | preparing | completed
  const [areaFilter, setAreaFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem('kds_sound') !== 'false';
    } catch {
      return true;
    }
  });
  const [sseStatus, setSseStatus] = useState('connecting'); // connected | connecting
  const [nowTime, setNowTime] = useState(() => new Date());
  const [newOrderAlert, setNewOrderAlert] = useState(null);
  const companyId = useTenant();

  // Digital clock update every 1 second
  useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Toggle Sound
  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('kds_sound', String(next));
      } catch (_) {}
      return next;
    });
  };

  // Fetch tickets from backend
  const loadTickets = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await kitchenApi.getOrders(includeCompleted);
      setTickets(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Lỗi tải dữ liệu bếp:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [includeCompleted]);

  // Subscribe to real-time Quarkus SSE Notification
  useEffect(() => {
    loadTickets();

    const unsubscribe = kitchenApi.subscribeEvents(
      (event) => {
        setSseStatus('connected');
        if (event && event.type === 'NEW_ORDER') {
          // Play chime sound
          if (soundEnabled) {
            playKitchenChime();
          }
          // Highlight alert banner
          setNewOrderAlert({
            tableName: event.tableName || 'Bàn ' + event.tableId,
            round: event.round || 1,
            itemCount: event.itemCount || 1,
          });
          setTimeout(() => setNewOrderAlert(null), 5000);
        }
        // Refresh tickets in background
        loadTickets(true);
      },
      () => {
        setSseStatus('connecting');
      },
      companyId
    );

    // Fallback polling interval every 12 seconds
    const interval = setInterval(() => {
      loadTickets(true);
    }, 12000);

    return () => {
      unsubscribe?.();
      clearInterval(interval);
    };
  }, [loadTickets, soundEnabled, companyId]);

  // Handle single item status update
  const handleItemStatusChange = async (item, nextStatus) => {
    let cancelReason = '';
    if (nextStatus === 'cancelled') {
      const reason = window.prompt(t('kitchen.cancelReasonPrompt') || 'Nhập lý do hủy món:');
      if (reason === null) return;
      cancelReason = reason.trim() || 'Bếp báo hủy';
    }

    try {
      await kitchenApi.updateItemStatus(item.id, nextStatus, cancelReason);
      // Optimistic update
      setTickets((prev) =>
        prev.map((tk) => ({
          ...tk,
          items: tk.items.map((it) => (it.id === item.id ? { ...it, status: nextStatus, cancelReason } : it)),
        }))
      );
    } catch (err) {
      alert(err?.message || 'Lỗi cập nhật trạng thái món');
      loadTickets(true);
    }
  };

  // Start whole round (preparing)
  const handleStartRound = async (ticket) => {
    try {
      await kitchenApi.preparingRound(ticket.orderId, ticket.round);
      loadTickets(true);
    } catch (err) {
      alert(err?.message || 'Lỗi nhận chế biến');
    }
  };

  // Complete whole round (served)
  const handleCompleteRound = async (ticket) => {
    try {
      await kitchenApi.completeRound(ticket.orderId, ticket.round);
      loadTickets(true);
    } catch (err) {
      alert(err?.message || 'Lỗi hoàn thành đợt');
    }
  };

  // Distinct areas
  const areas = useMemo(() => {
    const set = new Set();
    tickets.forEach((tk) => {
      if (tk.area) set.add(tk.area);
    });
    return Array.from(set);
  }, [tickets]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((tk) => {
      if (areaFilter && tk.area !== areaFilter) return false;

      if (statusFilter === 'waiting') {
        const hasSent = tk.items.some((it) => it.status === 'sent');
        if (!hasSent) return false;
      } else if (statusFilter === 'preparing') {
        const hasPrep = tk.items.some((it) => it.status === 'preparing');
        if (!hasPrep) return false;
      } else if (statusFilter === 'completed') {
        if (!tk.allServed) return false;
      }

      if (searchTerm) {
        const q = searchTerm.toLowerCase().trim();
        const matchTable = (tk.tableName || '').toLowerCase().includes(q);
        const matchItems = tk.items.some((it) => (it.productName || '').toLowerCase().includes(q));
        if (!matchTable && !matchItems) return false;
      }

      return true;
    });
  }, [tickets, areaFilter, statusFilter, searchTerm]);

  // Overall stats
  const stats = useMemo(() => {
    let pendingItems = 0;
    let waitingTickets = 0;
    tickets.forEach((tk) => {
      if (!tk.allServed) {
        waitingTickets++;
        tk.items.forEach((it) => {
          if (it.status === 'sent' || it.status === 'preparing') {
            pendingItems += Number(it.qty) || 1;
          }
        });
      }
    });
    return { waitingTickets, pendingItems };
  }, [tickets]);

  if (!can('kitchen', 'read') && !can('minibar', 'read')) {
    return (
      <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
        <h3>🔒 Bạn không có quyền truy cập Màn hình Bếp (KDS)</h3>
        <p>Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0f172a', // Dark theme chuyên dụng cho bếp
        color: '#f8fafc',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        minHeight: '100%',
        height: 'calc(100vh - 120px)',
        overflow: 'hidden',
      }}
    >
      {/* KDS Top Bar */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 18px',
          background: '#1e293b',
          borderBottom: '2px solid #334155',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '24px' }}>🍳</span>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '0.5px', color: '#f8fafc' }}>
              {t('kitchen.kdsTitle') || 'MÀN HÌNH BẾP & QUẦY BAR (KDS)'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#94a3b8' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: sseStatus === 'connected' ? '#4ade80' : '#facc15',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: sseStatus === 'connected' ? '#22c55e' : '#eab308',
                  }}
                />
                {sseStatus === 'connected' ? (t('kitchen.liveConnected') || 'Trực tiếp (SSE)') : (t('kitchen.liveConnecting') || 'Đang kết nối lại…')}
              </span>
              <span>•</span>
              <span style={{ color: '#fbbf24', fontWeight: '700' }}>
                🔥 {stats.waitingTickets} đơn chờ ({stats.pendingItems} món)
              </span>
            </div>
          </div>
        </div>

        {/* Right Tools & Clock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Live Clock */}
          <div
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              background: '#0f172a',
              border: '1px solid #334155',
              fontSize: '15px',
              fontWeight: '700',
              color: '#38bdf8',
              letterSpacing: '1px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            ⏱️ {nowTime.toLocaleTimeString('vi-VN')}
          </div>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={toggleSound}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: soundEnabled ? '#22c55e' : '#64748b',
              background: soundEnabled ? '#14532d' : '#334155',
              color: soundEnabled ? '#86efac' : '#cbd5e1',
            }}
          >
            {soundEnabled ? (t('kitchen.soundOn') || '🔔 Âm báo: BẬT') : (t('kitchen.soundOff') || '🔕 Âm báo: TẮT')}
          </button>

          {/* Manual Refresh */}
          <button
            type="button"
            disabled={loading}
            onClick={() => loadTickets()}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              border: '1px solid #475569',
              background: '#334155',
              color: '#f8fafc',
            }}
          >
            {loading ? '⏳…' : '🔄 ' + (t('kitchen.refresh') || 'Làm mới')}
          </button>
        </div>
      </header>

      {/* New Order Alert Banner */}
      {newOrderAlert && (
        <div
          style={{
            padding: '10px 18px',
            background: '#b91c1c',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '15px',
            fontWeight: '700',
            animation: 'pulse 1s infinite',
          }}
        >
          <span>
            🛎️ {t('kitchen.newOrderNotification') || 'Có đơn mới gửi tới bếp:'}{' '}
            <b>{newOrderAlert.tableName}</b> - Đợt {newOrderAlert.round} ({newOrderAlert.itemCount} món)!
          </span>
          <button
            type="button"
            onClick={() => setNewOrderAlert(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '18px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          padding: '10px 18px',
          background: '#131d2e',
          borderBottom: '1px solid #1e293b',
        }}
      >
        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: t('kitchen.allTickets') || 'Tất cả đơn chờ' },
            { id: 'waiting', label: t('kitchen.waiting') || 'Chờ làm' },
            { id: 'preparing', label: t('kitchen.preparing') || 'Đang làm' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                border: '1px solid',
                borderColor: statusFilter === tab.id ? '#38bdf8' : '#334155',
                background: statusFilter === tab.id ? '#0284c7' : '#1e293b',
                color: statusFilter === tab.id ? '#fff' : '#94a3b8',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}

          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              fontSize: '12.5px',
              color: '#cbd5e1',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={includeCompleted}
              onChange={(e) => setIncludeCompleted(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            {t('kitchen.showCompleted') || 'Hiện đơn đã xong'}
          </label>
        </div>

        {/* Area Filter & Search */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {areas.length > 0 && (
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#f8fafc',
                fontSize: '13px',
              }}
            >
              <option value="">{t('kitchen.allAreas') || 'Tất cả khu vực'}</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          )}

          <input
            type="text"
            placeholder={t('kitchen.searchPlaceholder') || 'Tìm món, bàn…'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#f8fafc',
              fontSize: '13px',
              width: '180px',
            }}
          />
        </div>
      </div>

      {/* Main Ticket Cards Grid */}
      <div
        style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '16px',
          alignContent: 'start',
        }}
      >
        {filteredTickets.length === 0 ? (
          <div
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: '60px 20px',
              color: '#64748b',
            }}
          >
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>🍽️</span>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#94a3b8' }}>
              {t('kitchen.emptyTickets') || 'Hiện tại không có đơn nào đang chờ chế biến.'}
            </div>
            <div style={{ fontSize: '13px', marginTop: '6px' }}>
              Khi nhân viên order tại bàn bấm "Gửi bếp / Bar", các món sẽ lập tức xuất hiện tại đây cùng chuông báo!
            </div>
          </div>
        ) : (
          filteredTickets.map((ticket) => {
            const isAllServed = ticket.allServed;
            const isUrgent = ticket.urgency === 'urgent';
            const isWarning = ticket.urgency === 'warning';

            // Calculate live wait time
            const sentDate = ticket.sentAt ? new Date(ticket.sentAt) : new Date();
            const elapsedMins = Math.max(0, Math.floor((nowTime.getTime() - sentDate.getTime()) / 60000));

            let timerColor = '#22c55e'; // Green
            let timerBg = '#14532d';
            let borderColor = '#334155';
            if (isUrgent || elapsedMins >= 15) {
              timerColor = '#ef4444'; // Red
              timerBg = '#7f1d1d';
              borderColor = '#dc2626';
            } else if (isWarning || elapsedMins >= 7) {
              timerColor = '#f59e0b'; // Amber
              timerBg = '#78350f';
              borderColor = '#d97706';
            }

            if (isAllServed) {
              borderColor = '#15803d';
            }

            return (
              <div
                key={`${ticket.orderId}_R${ticket.round}`}
                style={{
                  background: isAllServed ? '#14291e' : '#1e293b',
                  borderRadius: '10px',
                  border: `2px solid ${borderColor}`,
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  opacity: isAllServed ? 0.75 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Ticket Header */}
                <div
                  style={{
                    padding: '10px 14px',
                    background: isAllServed ? '#166534' : isUrgent ? '#991b1b' : isWarning ? '#9a3412' : '#0f172a',
                    borderBottom: '1px solid #334155',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px', fontWeight: '900', color: '#fff' }}>
                        {ticket.tableName}
                      </span>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: '800',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(255, 255, 255, 0.2)',
                          color: '#fff',
                        }}
                      >
                        ĐỢT {ticket.round}
                      </span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#cbd5e1', marginTop: '2px' }}>
                      📍 {ticket.area} {ticket.guestCount ? `· ${ticket.guestCount} khách` : ''}{' '}
                      {ticket.staffName ? `· NV: ${ticket.staffName}` : ''}
                    </div>
                  </div>

                  {/* Elapsed Timer Pill */}
                  <div
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: timerBg,
                      color: timerColor,
                      fontSize: '13px',
                      fontWeight: '800',
                      border: `1px solid ${timerColor}`,
                      textAlign: 'right',
                    }}
                  >
                    ⏱️ {elapsedMins} {t('kitchen.minutes') || 'phút'}
                  </div>
                </div>

                {/* Table general note */}
                {ticket.orderNote && (
                  <div
                    style={{
                      padding: '6px 12px',
                      background: '#334155',
                      color: '#fde047',
                      fontSize: '12px',
                      borderBottom: '1px solid #475569',
                    }}
                  >
                    📝 {ticket.orderNote}
                  </div>
                )}

                {/* Items List */}
                <div style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {ticket.items.map((item, idx) => {
                    const isCancelled = item.status === 'cancelled';
                    const isServed = item.status === 'served';
                    const isPreparing = item.status === 'preparing';

                    return (
                      <div
                        key={item.id || idx}
                        style={{
                          padding: '8px',
                          borderRadius: '6px',
                          background: isCancelled ? '#450a0a' : isServed ? '#064e3b' : isPreparing ? '#1e3a8a' : '#0f172a',
                          border: '1px solid',
                          borderColor: isCancelled ? '#7f1d1d' : isServed ? '#059669' : isPreparing ? '#2563eb' : '#334155',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '8px',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                            <span
                              style={{
                                fontSize: '16px',
                                fontWeight: '900',
                                color: isCancelled ? '#94a3b8' : '#f8fafc',
                                textDecoration: isCancelled ? 'line-through' : 'none',
                              }}
                            >
                              x{item.qty}
                            </span>
                            <span
                              style={{
                                fontSize: '15px',
                                fontWeight: '700',
                                color: isCancelled ? '#94a3b8' : '#f8fafc',
                                textDecoration: isCancelled ? 'line-through' : 'none',
                              }}
                            >
                              {item.productName}
                            </span>
                            {item.unit && (
                              <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>({item.unit})</span>
                            )}
                          </div>

                          {/* Item Note (Special cooking instructions) */}
                          {item.note && (
                            <div
                              style={{
                                marginTop: '4px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: '#78350f',
                                color: '#fef08a',
                                fontSize: '12px',
                                fontWeight: '600',
                                display: 'inline-block',
                              }}
                            >
                              👉 {item.note}
                            </div>
                          )}

                          {isCancelled && item.cancelReason && (
                            <div style={{ fontSize: '11px', color: '#f87171', marginTop: '2px' }}>
                              [Hủy: {item.cancelReason}]
                            </div>
                          )}
                        </div>

                        {/* Status Toggle Buttons */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                          {!isCancelled && !isServed && (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {!isPreparing && (
                                <button
                                  type="button"
                                  onClick={() => handleItemStatusChange(item, 'preparing')}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11.5px',
                                    fontWeight: '700',
                                    background: '#1d4ed8',
                                    color: '#fff',
                                    border: 'none',
                                    cursor: 'pointer',
                                  }}
                                  title="Bếp nhận làm món này"
                                >
                                  Làm
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleItemStatusChange(item, 'served')}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11.5px',
                                  fontWeight: '700',
                                  background: '#16a34a',
                                  color: '#fff',
                                  border: 'none',
                                  cursor: 'pointer',
                                }}
                                title="Đã làm xong món"
                              >
                                Xong
                              </button>
                            </div>
                          )}

                          {isServed && (
                            <button
                              type="button"
                              onClick={() => handleItemStatusChange(item, 'preparing')}
                              style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                background: '#065f46',
                                color: '#a7f3d0',
                                border: '1px solid #10b981',
                                cursor: 'pointer',
                              }}
                              title="Bấm để chuyển lại làm lại nếu cần"
                            >
                              ✓ Xong
                            </button>
                          )}

                          {isCancelled && (
                            <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: '700' }}>
                              Đã hủy
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Ticket Action Footer */}
                <div
                  style={{
                    padding: '8px 12px',
                    background: '#0f172a',
                    borderTop: '1px solid #334155',
                    display: 'flex',
                    gap: '8px',
                  }}
                >
                  {!isAllServed && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStartRound(ticket)}
                        style={{
                          flex: 1,
                          padding: '8px 10px',
                          borderRadius: '6px',
                          fontSize: '12.5px',
                          fontWeight: '700',
                          background: '#2563eb',
                          color: '#fff',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {t('kitchen.btnStartRound') || '👩‍🍳 Nhận làm cả đợt'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCompleteRound(ticket)}
                        style={{
                          flex: 1.2,
                          padding: '8px 10px',
                          borderRadius: '6px',
                          fontSize: '12.5px',
                          fontWeight: '800',
                          background: '#16a34a',
                          color: '#fff',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {t('kitchen.btnCompleteRound') || '✅ HOÀN THÀNH ĐỢT'}
                      </button>
                    </>
                  )}

                  {isAllServed && (
                    <div
                      style={{
                        width: '100%',
                        textAlign: 'center',
                        color: '#4ade80',
                        fontSize: '13px',
                        fontWeight: '700',
                        padding: '4px 0',
                      }}
                    >
                      ✓ Đã hoàn thành toàn bộ đợt này
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default {
  id: 'kitchen',
  icon: '🍳',
  title: 'kitchen.title',
  order: 2.3,
  messages,
  View: KitchenScreen,
};

