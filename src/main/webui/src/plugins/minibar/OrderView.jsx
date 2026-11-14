import { useState, useEffect, useMemo, useRef } from 'react';
import { useI18n } from '../../core/i18n.jsx';
import {
  materialsStore,
  materialTypesStore,
  warehousesStore,
  customersStore,
  searchCustomers,
  searchWarehouses,
  diningTablesStore,
  vnd,
  formatDate,
} from '../../core/masterdata.js';
import Autocomplete from '../../core/Autocomplete.jsx';
import { useConfirm } from '../../core/confirm.jsx';
import { inventoryApi } from '../../api/inventoryApi.js';
import { cashApi } from '../../api/cashApi.js';
import { shiftApi } from '../../api/shiftApi.js';
import { printThermalReceipt } from '../inventory/voucher.js';
import { getTableDraft, saveTableDraft, clearTableDraft, transferTableDraft } from './orderDrafts.js';

const DEFAULT_CUSTOMER = {
  id: 'khach-vang-lai',
  name: 'Khách vãng lai',
  code: 'KH-VANGLAI',
};

export function OrderView({ table, onBack, onOrderFinished, can, t: propT }) {
  const { t: i18nT } = useI18n();
  const t = propT || i18nT;
  const confirm = useConfirm();

  // Load stores
  const materials = materialsStore.use().items || [];
  const materialTypes = materialTypesStore.use().items || [];
  const warehouses = warehousesStore.use().items || [];
  const allTables = diningTablesStore.use().items || [];

  // Table order state
  const [customer, setCustomer] = useState(DEFAULT_CUSTOMER);
  const [warehouse, setWarehouse] = useState(null);
  const [lines, setLines] = useState([]);
  const [orderNote, setOrderNote] = useState('');
  const [openedAt, setOpenedAt] = useState(null);

  // Filter state for menu
  const [menuSearch, setMenuSearch] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState('');

  // UI state
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [targetTableId, setTargetTableId] = useState('');
  const [lastAddedId, setLastAddedId] = useState(null);

  // Initialize draft order or existing order
  useEffect(() => {
    if (!table) return;

    // Default warehouse: prioritize Kho Bar / Nha hang (plugin)
    if (warehouses.length > 0 && !warehouse) {
      const barWh = warehouses.find((w) =>
        /bar|nhà hàng|nha hang|quầy/i.test(w.name || '') ||
        /bar/i.test(w.code || '')
      ) || warehouses[0];
      setWarehouse({ id: barWh.id, name: barWh.name });
    }

    const draft = getTableDraft(table.id);
    if (draft && draft.lines && draft.lines.length > 0) {
      setLines(draft.lines);
      if (draft.customer) setCustomer(draft.customer);
      if (draft.warehouse) setWarehouse(draft.warehouse);
      if (draft.orderNote) setOrderNote(draft.orderNote);
      setOpenedAt(draft.openedAt || new Date().toISOString());
    } else {
      setLines([]);
      if (table.reservedCustomerName || table.reservedCustomerPhone) {
        setCustomer({
          id: 'khach-dat-ban',
          name: table.reservedCustomerName || 'Khách đặt trước',
          phone: table.reservedCustomerPhone || '',
          code: 'KH-DATBAN',
        });
      } else {
        setCustomer(DEFAULT_CUSTOMER);
      }
      setOrderNote(table.note ? `[Bàn đặt trước] ${table.note}` : '');
      setOpenedAt(new Date().toISOString());
    }
  }, [table?.id]);

  // Auto-save draft whenever lines, customer, or note changes
  useEffect(() => {
    if (!table || lines.length === 0) return;
    saveTableDraft(table.id, {
      tableName: table.name,
      customer,
      warehouse,
      lines,
      orderNote,
      openedAt: openedAt || new Date().toISOString(),
    });
  }, [table?.id, lines, customer, warehouse, orderNote, openedAt]);

  // Filtered menu items
  const filteredProducts = useMemo(() => {
    return materials.filter((m) => {
      if (selectedTypeId && m.typeId !== selectedTypeId) return false;
      if (menuSearch) {
        const q = menuSearch.toLowerCase().trim();
        const code = (m.code || '').toLowerCase();
        const name = (m.name || '').toLowerCase();
        return code.includes(q) || name.includes(q);
      }
      return true;
    });
  }, [materials, selectedTypeId, menuSearch]);

  // Totals
  const totalQty = useMemo(() => {
    return lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  }, [lines]);

  const totalAmount = useMemo(() => {
    return lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  }, [lines]);

  // Cart actions
  const handleAddItem = (product) => {
    setLastAddedId(product.id);
    setTimeout(() => setLastAddedId(null), 600);

    setLines((prev) => {
      const idx = prev.findIndex((l) => l.productId === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: Number(next[idx].qty || 0) + 1 };
        return next;
      }
      return [
        ...prev,
        {
          id: Date.now() + Math.random(),
          productId: product.id,
          productCode: product.code || '',
          productName: product.name,
          unit: product.unit || 'phần',
          qty: 1,
          price: Number(product.price) || 0,
          note: '',
        },
      ];
    });

    // Mark table occupied if it was empty
    if (table.status === 'empty') {
      diningTablesStore.update(table.id, { status: 'occupied' }).catch(() => { });
    }
  };

  const handleUpdateQty = (idx, delta) => {
    setLines((prev) => {
      const next = [...prev];
      const cur = next[idx];
      const newQty = (Number(cur.qty) || 0) + delta;
      if (newQty <= 0) {
        next.splice(idx, 1);
      } else {
        next[idx] = { ...cur, qty: newQty };
      }
      return next;
    });
  };

  const handleSetQty = (idx, val) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setLines((prev) => {
      const next = [...prev];
      if (num <= 0) {
        next.splice(idx, 1);
      } else {
        next[idx] = { ...next[idx], qty: num };
      }
      return next;
    });
  };

  const handleUpdateLineNote = (idx, note) => {
    setLines((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], note };
      return next;
    });
  };

  const handleRemoveLine = (idx) => {
    setLines((prev) => {
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
  };

  // In tạm tính (Interim Bill Print)
  const handlePrintInterimBill = () => {
    if (lines.length === 0) {
      alert(t('minibar.noItemsToPrint') || 'Chưa có món nào trong đơn để in tạm tính!');
      return;
    }
    const interimDoc = {
      no: `TT-${table.code}`,
      tableName: table.name,
      date: new Date().toISOString().slice(0, 10),
      partner: customer,
      note: `${t('minibar.printReceipt') || 'Tạm tính'}: ${table.name}${orderNote ? ` (${orderNote})` : ''}`,
      lines: lines.map((l, i) => ({
        id: i + 1,
        product: { id: l.productId, name: l.productName },
        qty: l.qty,
        price: l.price,
        note: l.note,
      })),
      isSales: true,
    };
    printThermalReceipt(interimDoc, t);
  };

  // Chuyển bàn
  const handleTransferTable = async () => {
    if (!targetTableId) {
      alert(t('minibar.selectTargetTablePrompt') || 'Vui lòng chọn bàn cần chuyển đến!');
      return;
    }
    const targetTable = allTables.find((item) => item.id === targetTableId);
    if (!targetTable) return;

    if (targetTable.status === 'occupied') {
      const ok = await confirm((t('minibar.transferConfirm') || `Bàn "${targetTable.name}" hiện đang có khách. Bạn có chắc muốn ghép vào bàn này?`));
      if (!ok) return;
    }

    try {
      transferTableDraft(table.id, targetTable.id);
      await diningTablesStore.update(table.id, { status: 'empty', currentDocId: null });
      await diningTablesStore.update(targetTable.id, { status: 'occupied' });
      setShowTransferModal(false);
      alert((t('minibar.transferSuccess') || `Đã chuyển order từ "${table.name}" sang "${targetTable.name}" thành công!`));
      onOrderFinished?.();
    } catch (err) {
      alert(err?.message || (t('minibar.transferFailed') || 'Lỗi khi chuyển bàn.'));
    }
  };

  // Hủy order
  const handleCancelOrder = async () => {
    const ok = await confirm((t('minibar.confirmCancelOrder') || `Bạn có chắc muốn hủy đơn gọi món của "${table.name}" và trả bàn về trạng thái trống?`));
    if (!ok) return;
    try {
      clearTableDraft(table.id);
      await diningTablesStore.update(table.id, {
        status: 'empty',
        currentDocId: null,
        reservedCustomerName: null,
        reservedCustomerPhone: null,
        reservedTime: null,
      });
      setLines([]);
      alert((t('minibar.cancelOrderSuccess') || `Đã hủy order và trả bàn "${table.name}" về trạng thái trống.`));
      onOrderFinished?.();
    } catch (err) {
      alert(err?.message || (t('minibar.cancelFailed') || 'Lỗi khi hủy đơn.'));
    }
  };

  // Thanh toán & Thu tiền (Core business logic: Xuất kho + Tạo phiếu thu tiền mặt)
  const handleCheckoutAndPay = async () => {
    if (lines.length === 0) {
      alert(t('minibar.emptyOrderCheckoutWarn') || 'Đơn hàng chưa có món nào, vui lòng chọn món trước khi thanh toán!');
      return;
    }

    const ok = await confirm(
      `${t('minibar.confirmCheckout') || 'Xác nhận thanh toán cho'} ${table.name}?\n` +
      `- ${t('minibar.grandTotal') || 'Tổng tiền'}: ${vnd(totalAmount)}\n` +
      `- ${t('minibar.customer') || 'Khách hàng'}: ${customer?.name || (t('minibar.defaultCustomer') || 'Khách vãng lai')}\n` +
      (t('minibar.confirmCheckoutSub') || `Hệ thống sẽ tự động tạo Phiếu xuất kho bán hàng và Phiếu thu tiền mặt tương ứng.`)
    );
    if (!ok) return;

    setPaying(true);
    try {
      // 0. Xác định ca làm việc hiện tại (nếu có mở ca)
      let currentShiftId = null;
      try {
        const curShift = await shiftApi.getCurrent(warehouse?.id);
        if (curShift?.hasOpenShift && curShift?.shift?.id) {
          currentShiftId = curShift.shift.id;
        }
      } catch (sErr) {
        console.warn('Không tải được ca làm việc hiện tại:', sErr);
      }

      // 1. Tạo Phiếu xuất kho bán hàng (type: 'export', isSales: true)
      const exportDocPayload = {
        type: 'export',
        isSales: true,
        shiftId: currentShiftId,
        date: new Date().toISOString().slice(0, 10),
        partner: customer && customer.id ? { id: customer.id, name: customer.name } : DEFAULT_CUSTOMER,
        warehouseOut: warehouse && warehouse.id ? { id: warehouse.id, name: warehouse.name } : null,
        note: `Bán hàng ${table.name || 'Bàn'}${orderNote ? ` - ${orderNote}` : ''}`,
        lines: lines.map((l) => ({
          product: { id: l.productId, name: l.productName },
          qty: Number(l.qty) || 1,
          price: Number(l.price) || 0,
        })),
      };

      const exportDoc = await inventoryApi.create(exportDocPayload);

      // 2. Tự động tạo Phiếu thu tiền mặt từ phiếu xuất kho vừa tạo
      let cashDoc = null;
      if (exportDoc && exportDoc.id) {
        try {
          cashDoc = await cashApi.fromInventory(exportDoc.id);
        } catch (cashErr) {
          console.warn('Lỗi tự động tạo phiếu thu tiền mặt:', cashErr);
        }
      }

      // 3. Giải phóng bàn (chuyển trạng thái về empty)
      await diningTablesStore.update(table.id, {
        status: 'empty',
        currentDocId: null,
        reservedCustomerName: null,
        reservedCustomerPhone: null,
        reservedTime: null,
      });

      // 4. Xóa draft order
      clearTableDraft(table.id);

      // 5. In nhiệt hóa đơn thanh toán
      try {
        await printThermalReceipt({ ...exportDoc, tableName: table.name, isSales: true }, t);
      } catch (printErr) {
        console.warn('In hóa đơn không thành công hoặc người dùng bỏ qua:', printErr);
      }

      alert(
        (t('minibar.checkoutSuccess') || 'Thanh toán thành công cho') + ` ${table.name}!\n` +
        `✅ ${t('inv.export') || 'Phiếu xuất kho'}: ${exportDoc?.no || 'OK'}\n` +
        (cashDoc ? `✅ ${t('minibar.cashReceipts') || 'Phiếu thu tiền mặt'}: ${cashDoc?.no || 'OK'}` : '')
      );

      onOrderFinished?.();
    } catch (err) {
      alert((t('minibar.checkoutFailed') || 'Thanh toán thất bại: ') + (err?.message || String(err)));
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="mb-order-wrap" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: '600px', background: '#f1f5f9', padding: '12px', gap: '12px' }}>
      {/* Top Header Bar */}
      <div style={{ background: '#fff', padding: '12px 18px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            className="tb"
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '13.5px', fontWeight: '600', borderRadius: '6px' }}
          >
            ← {t('minibar.map') || 'Sơ đồ bàn'}
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                {table.name} ({table.code})
              </h2>
              <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>
                {table.area || (t('minibar.indoor') || 'Trong nhà')}
              </span>
              <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>
                🪑 {table.capacity || 4} {t('minibar.people') || 'chỗ'}
              </span>
            </div>
          </div>
        </div>

        {/* Master inputs strip: Khách hàng & Kho xuất */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>{t('minibar.customer') || 'Khách hàng'}:</span>
            <div style={{ width: '220px' }}>
              <Autocomplete
                value={customer}
                onChange={setCustomer}
                search={searchCustomers}
                placeholder={t('minibar.defaultCustomer') || 'Khách vãng lai'}
                defaultOption={DEFAULT_CUSTOMER}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>{t('minibar.warehouse') || 'Kho xuất'}:</span>
            <div style={{ width: '180px' }}>
              <Autocomplete
                value={warehouse}
                onChange={setWarehouse}
                search={searchWarehouses}
                placeholder={t('minibar.selectWarehouse') || 'Chọn kho xuất...'}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-column POS workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 480px', gap: '12px', flex: 1, minHeight: 0 }}>
        {/* LEFT COLUMN: Menu / Item Picker */}
        <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Menu Search & Category Tabs */}
          <div style={{ padding: '12px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <div className="searchbox" style={{ flex: 1 }}>
                <span aria-hidden="true">🔍</span>
                <input
                  type="search"
                  value={menuSearch}
                  placeholder={t('minibar.searchItem') || 'Tìm món ăn, đồ uống theo tên hoặc mã...'}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  style={{ width: '100%', height: '38px', padding: '0 28px', borderRadius: '6px', fontSize: '13.5px' }}
                />
                {menuSearch && (
                  <button type="button" className="xbtn" onClick={() => setMenuSearch('')}>✕</button>
                )}
              </div>
            </div>

            {/* Category horizontal scrolling tabs */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              <button
                type="button"
                onClick={() => setSelectedTypeId('')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: '600',
                  border: '1px solid',
                  borderColor: !selectedTypeId ? '#0284c7' : '#cbd5e1',
                  background: !selectedTypeId ? '#0284c7' : '#fff',
                  color: !selectedTypeId ? '#fff' : '#475569',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                🍽️ {t('common.all') || 'Tất cả món'} ({materials.length})
              </button>
              {materialTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setSelectedTypeId(type.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: '600',
                    border: '1px solid',
                    borderColor: selectedTypeId === type.id ? '#0284c7' : '#cbd5e1',
                    background: selectedTypeId === type.id ? '#0284c7' : '#fff',
                    color: selectedTypeId === type.id ? '#fff' : '#475569',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {type.name}
                </button>
              ))}
            </div>
          </div>

          {/* Product Items Grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
            {filteredProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                <span style={{ fontSize: '32px' }}>🔍</span>
                <p style={{ marginTop: '8px' }}>{t('common.empty') || 'Không tìm thấy món ăn hoặc đồ uống nào.'}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '12px' }}>
                {filteredProducts.map((p) => {
                  const cartItem = lines.find((l) => l.productId === p.id);
                  const isJustAdded = lastAddedId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleAddItem(p)}
                      style={{
                        position: 'relative',
                        background: isJustAdded ? '#fef08a' : '#fff',
                        border: '1px solid',
                        borderColor: cartItem ? '#0284c7' : '#e2e8f0',
                        borderRadius: '8px',
                        padding: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: '95px',
                        userSelect: 'none',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = '#0284c7'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = cartItem ? '#0284c7' : '#e2e8f0'}
                    >
                      {cartItem && (
                        <span
                          style={{
                            position: 'absolute',
                            top: '-8px',
                            right: '-8px',
                            background: '#0284c7',
                            color: '#fff',
                            fontSize: '11px',
                            fontWeight: '700',
                            borderRadius: '12px',
                            padding: '2px 7px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                          }}
                        >
                          x{cartItem.qty}
                        </span>
                      )}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                          <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#1e293b', lineHeight: '1.3' }}>
                            {p.name}
                          </span>
                          {p.kind === 'service' && (
                            <span style={{ background: '#fef3c7', color: '#b45309', padding: '1px 5px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                              {t('common.service') || 'Dịch vụ'}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                          {p.code ? `[${p.code}]` : ''} · {p.unit || (p.kind === 'service' ? 'lần' : (t('minibar.portions') || 'phần'))}
                        </div>
                      </div>
                      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#047857' }}>
                          {vnd(p.price || 0)}
                        </span>
                        <span style={{ fontSize: '12px', color: '#0284c7', fontWeight: '600' }}>
                          + {t('common.add') || 'Thêm'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Order Bill / POS Slip */}
        <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Bill header */}
          <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
              📋 {t('minibar.orderList') || 'Phiếu gọi món'} ({lines.length} {t('minibar.item') || 'món'})
            </span>
            {lines.length > 0 && (
              <button
                type="button"
                className="tb"
                style={{ color: '#dc2626', fontSize: '12px', padding: '2px 8px' }}
                onClick={handleCancelOrder}
              >
                ✕ {t('minibar.cancelOrder') || 'Hủy đơn'}
              </button>
            )}
          </div>

          {/* Lines table */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {lines.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                <span style={{ fontSize: '36px' }}>☕</span>
                <p style={{ marginTop: '8px', fontSize: '14px' }}>{t('minibar.noItemsSelected') || 'Bàn chưa chọn món nào.'}</p>
                <p style={{ fontSize: '12.5px', color: '#cbd5e1' }}>{t('minibar.selectItemsHint') || 'Bấm vào món bên trái để thêm vào đơn hàng.'}</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>{t('minibar.item') || 'Tên món'}</th>
                    <th style={{ padding: '8px 6px', textAlign: 'center', width: '90px' }}>{t('minibar.qty') || 'Số lượng'}</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', width: '90px' }}>{t('minibar.amount') || 'Thành tiền'}</th>
                    <th style={{ padding: '8px 6px', width: '32px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((item, idx) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ fontWeight: '600', color: '#1e293b' }}>{item.productName}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span style={{ fontSize: '11.5px', color: '#64748b' }}>{vnd(item.price)}/{item.unit}</span>
                          <input
                            type="text"
                            placeholder={t('minibar.note') || 'Ghi chú...'}
                            value={item.note || ''}
                            onChange={(e) => handleUpdateLineNote(idx, e.target.value)}
                            style={{ height: '22px', fontSize: '11px', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0 6px', width: '130px' }}
                          />
                        </div>
                      </td>
                      <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(idx, -1)}
                            style={{ width: '24px', height: '26px', background: '#f8fafc', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => handleSetQty(idx, e.target.value)}
                            style={{ width: '36px', height: '26px', border: 'none', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', textAlign: 'center', fontWeight: '600', fontSize: '13px' }}
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(idx, 1)}
                            style={{ width: '24px', height: '26px', background: '#f8fafc', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '600', color: '#047857' }}>
                        {vnd((item.qty || 0) * (item.price || 0))}
                      </td>
                      <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                        <button
                          type="button"
                          className="xbtn"
                          style={{ fontSize: '12px', color: '#94a3b8' }}
                          title={t('common.delete') || 'Xóa món'}
                          onClick={() => handleRemoveLine(idx)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Bill Footer & Totals */}
          <div style={{ padding: '14px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
            {/* Ghi chú chung */}
            <div style={{ marginBottom: '10px' }}>
              <input
                type="text"
                placeholder={t('minibar.orderNotePlaceholder') || 'Ghi chú đơn hàng cho bếp / pha chế...'}
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                style={{ width: '100%', height: '32px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}
              />
            </div>

            {/* Totals row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '13px', color: '#64748b' }}>{t('minibar.totalQty') || 'Tổng số lượng'}:</span>{' '}
                <b style={{ fontSize: '14px', color: '#0f172a' }}>{totalQty}</b> {t('minibar.portions') || 'phần'}
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '13px', color: '#64748b', marginRight: '8px' }}>{t('minibar.grandTotal') || 'Tổng thanh toán'}:</span>
                <span style={{ fontSize: '20px', fontWeight: '700', color: '#047857' }}>
                  {vnd(totalAmount)}
                </span>
              </div>
            </div>

            {/* Action buttons row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <button
                type="button"
                className="tb"
                disabled={lines.length === 0}
                onClick={handlePrintInterimBill}
                style={{ padding: '8px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                📄 {t('minibar.printReceipt') || 'In tạm tính'}
              </button>
              <button
                type="button"
                className="tb"
                disabled={lines.length === 0}
                onClick={() => setShowTransferModal(true)}
                style={{ padding: '8px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                🔁 {t('minibar.changeTable') || 'Chuyển bàn'}
              </button>
            </div>

            {/* Big Checkout & Pay Button */}
            <button
              type="button"
              className="pb"
              disabled={lines.length === 0 || paying}
              onClick={handleCheckoutAndPay}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '15px',
                fontWeight: '700',
                borderRadius: '8px',
                background: '#059669',
                borderColor: '#047857',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: lines.length === 0 || paying ? 'not-allowed' : 'pointer',
              }}
            >
              <span>💵</span>
              {paying ? (t('common.processing') || 'Đang thanh toán & tạo phiếu thu...') : `${t('minibar.checkout') || 'Thanh toán & Thu tiền'} (${vnd(totalAmount)})`}
            </button>
          </div>
        </div>
      </div>

      {/* Transfer Table Modal */}
      {showTransferModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '10px', width: '100%', maxWidth: '400px', padding: '20px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>
              {t('minibar.changeTable') || 'Chuyển order từ'} {table.name} {t('minibar.toOtherTable') || 'sang bàn khác'}
            </h3>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                {t('minibar.selectTargetTablePrompt') || 'Chọn bàn đích:'}
              </label>
              <select
                value={targetTableId}
                onChange={(e) => setTargetTableId(e.target.value)}
                style={{ width: '100%', height: '38px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', background: '#fff' }}
              >
                <option value="">-- {t('minibar.selectTable') || 'Chọn bàn'} --</option>
                {allTables
                  .filter((item) => item.id !== table.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.code}) - {item.area} [{item.status === 'empty' ? (t('minibar.statusEmpty') || 'Trống') : (t('minibar.statusOccupied') || 'Đang phục vụ')}]
                    </option>
                  ))}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="tb"
                onClick={() => setShowTransferModal(false)}
                style={{ padding: '8px 16px', borderRadius: '6px' }}
              >
                {t('common.cancel') || 'Hủy'}
              </button>
              <button
                type="button"
                className="pb"
                onClick={handleTransferTable}
                style={{ padding: '8px 18px', borderRadius: '6px', fontWeight: '600' }}
              >
                {t('common.confirm') || 'Xác nhận chuyển'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

