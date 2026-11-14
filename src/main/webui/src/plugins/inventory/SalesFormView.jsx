import { useEffect, useRef, useState } from 'react';
import Autocomplete from '../../core/Autocomplete.jsx';
import { useConfirm } from '../../core/confirm.jsx';
import { cashApi } from '../../api/cashApi.js';
import { inventoryApi } from '../../api/inventoryApi.js';
import {
  customersStore,
  warehousesStore,
  searchCustomers,
  searchWarehouses,
  searchMaterials,
  findMaterialByCode,
  vnd,
  formatDate,
} from '../../core/masterdata.js';
import { printThermalReceipt } from './voucher.js';
import ProductTagPrintModal from '../../core/ProductTagPrintModal.jsx';

const lineTotal = (lines) => (lines || []).reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
const lineQty = (lines) => (lines || []).reduce((s, l) => s + (Number(l.qty) || 0), 0);

export function SalesFormView({
  state,
  setState,
  can,
  t,
  bus,
  saveDoc,
  printVoucher,
  onDeletePrompt,
  requestDeleteDoc,
}) {
  const confirm = useConfirm();
  const editing = state.editing;
  const isNew = !editing.id;
  const savePerm = isNew ? can('inventory', 'create') : can('inventory', 'update');

  const update = (patch) => setState({ editing: { ...editing, ...patch } }, { replace: true });

  const [linkedVoucher, setLinkedVoucher] = useState(null);
  const [createVoucher, setCreateVoucher] = useState(isNew ? true : false); // Mặc định bán hàng thu tiền ngay
  const [saving, setSaving] = useState(false);
  const [lastScannedId, setLastScannedId] = useState(null);

  // Scanner state
  const [scanQuery, setScanQuery] = useState('');
  const [tagPrintItems, setTagPrintItems] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);

  const scannerRef = useRef(null);
  const dropdownRef = useRef(null);

  // Tự động chọn kho đầu tiên nếu chưa chọn kho
  const warehouses = warehousesStore.use().items;
  useEffect(() => {
    if (!editing.warehouseOut && warehouses.length > 0) {
      const firstWh = warehouses[0];
      update({ warehouseOut: { id: firstWh.id, name: firstWh.name } });
    }
  }, [warehouses]);

  // Kiểm tra chứng từ thu/chi liên kết nếu đang sửa phiếu
  useEffect(() => {
    if (!editing.id) {
      setLinkedVoucher(null);
      return;
    }
    let active = true;
    cashApi.getBySource(editing.id)
      .then((res) => {
        if (active && res && res.id) setLinkedVoucher(res);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [editing.id]);

  // Tự động focus ô quét mã hàng khi vào form
  useEffect(() => {
    scannerRef.current?.focus();
  }, []);

  // Hotkeys toàn màn hình: F3 để quét mã, F9 để Lưu & In, F10 để Lưu
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'F3') {
        e.preventDefault();
        scannerRef.current?.focus();
        scannerRef.current?.select();
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (savePerm && !saving) doSave(true);
      } else if (e.key === 'F10') {
        e.preventDefault();
        if (savePerm && !saving) doSave(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // Tìm kiếm gợi ý khi gõ ô mã hàng
  useEffect(() => {
    const q = scanQuery.trim();
    if (!q) {
      setSuggestions([]);
      setShowDropdown(false);
      setHighlightIdx(-1);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await searchMaterials(q);
        if (active) {
          setSuggestions(rows || []);
          setShowDropdown(true);
          setHighlightIdx(rows?.length > 0 ? 0 : -1);
          setSearching(false);
        }
      } catch {
        if (active) {
          setSuggestions([]);
          setSearching(false);
        }
      }
    }, 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [scanQuery]);

  // Thêm hoặc tăng số lượng hàng hóa vào danh sách
  const addOrIncrementProduct = (prod) => {
    if (!prod) return;
    const lines = editing.lines || [];
    const existingIndex = lines.findIndex((l) => l.product?.id === prod.id);

    let nextLines;
    let targetId;

    if (existingIndex >= 0) {
      const existing = lines[existingIndex];
      targetId = existing.id;
      nextLines = lines.map((l, idx) =>
        idx === existingIndex ? { ...l, qty: (Number(l.qty) || 0) + 1 } : l
      );
    } else {
      targetId = Date.now() + Math.random();
      const newLine = {
        id: targetId,
        product: {
          id: prod.id,
          code: prod.code,
          name: prod.name,
          unit: prod.unit,
          price: prod.price,
        },
        qty: 1,
        price: prod.price ?? 0,
      };
      nextLines = [...lines, newLine];
    }

    update({ lines: nextLines });

    // Hiệu ứng nhấp nháy dòng vừa thêm/tăng số lượng
    setLastScannedId(targetId);
    setTimeout(() => setLastScannedId(null), 1200);

    // Xóa ô tìm kiếm và giữ con trỏ
    setScanQuery('');
    setShowDropdown(false);
    scannerRef.current?.focus();
  };

  const handleScannerKeyDown = async (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setHighlightIdx((idx) => (idx + 1) % suggestions.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setHighlightIdx((idx) => (idx - 1 + suggestions.length) % suggestions.length);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setScanQuery('');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const q = scanQuery.trim();
      if (!q) return;

      // 1. Kiểm tra nếu đang highlight một dòng gợi ý
      if (highlightIdx >= 0 && suggestions[highlightIdx]) {
        addOrIncrementProduct(suggestions[highlightIdx]);
        return;
      }

      // 2. Tra cứu mã hàng chính xác (barcode scanner bắn mã SKU)
      const exact = await findMaterialByCode(q);
      if (exact) {
        addOrIncrementProduct(exact);
        return;
      }

      // 3. Nếu có danh sách gợi ý, chọn sản phẩm đầu tiên
      if (suggestions.length > 0) {
        addOrIncrementProduct(suggestions[0]);
        return;
      }

      alert(t('inv.noResult') || 'Không tìm thấy sản phẩm khớp với mã hàng này.');
    }
  };

  const updateLine = (id, patch) => {
    update({ lines: (editing.lines || []).map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  };

  const removeLine = async (l) => {
    const name = l.product?.name || t('inv.product');
    if (!(await confirm(t('inv.confirmDeleteLine').replace('{name}', name)))) return;
    update({ lines: (editing.lines || []).filter((x) => x.id !== l.id) });
    scannerRef.current?.focus();
  };

  const createCustomer = can('catalog', 'create')
    ? async (name) => {
        const c = await customersStore.add({ name });
        return { id: c.id, name: c.name };
      }
    : undefined;

  const createWarehouse = can('catalog', 'create')
    ? async (name) => {
        const w = await warehousesStore.add({ name });
        return { id: w.id, name: w.name };
      }
    : undefined;

  const total = lineTotal(editing.lines);
  const totalItemsCount = (editing.lines || []).length;
  const totalQuantities = lineQty(editing.lines);

  const doSave = async (andPrint = false) => {
    const lines = editing.lines || [];
    const linesOk = lines.length > 0 && lines.every((l) => l.product?.id != null && Number(l.qty) > 0);
    if (!editing.partner || !linesOk) {
      alert(t('inv.validate') || 'Vui lòng chọn khách hàng và ít nhất 1 mặt hàng hợp lệ.');
      return;
    }
    setSaving(true);
    try {
      const saved = await saveDoc({ ...editing, type: 'export', isSales: true });
      const docId = saved?.id || editing.id;

      if (createVoucher && docId && !linkedVoucher) {
        try {
          const createdVoucher = await cashApi.fromInventory(docId);
          if (createdVoucher?.code) {
            // Đã tạo thành công phiếu thu
          }
        } catch (err) {
          alert((t('inv.receiptCreateFailed') || 'Lưu phiếu xuất thành công nhưng không tạo được phiếu thu') + ': ' + (err?.message ?? err));
        }
      }

      if (andPrint) {
        printThermalReceipt({ ...saved, isSales: true }, t);
      }

      setState({
        mode: 'list',
        editing: null,
        report: null,
        filterType: 'export',
        page: 1,
      });
    } catch (e) {
      alert((t('inv.saveFailed') || 'Lưu phiếu thất bại') + ': ' + (e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pad pos-wrap">
      {/* 1. Header Bar: Tiêu đề + Chuyển chế độ + Hành động */}
      <div className="pos-top-bar">
        <div className="pos-title-area">
          <span className="pos-badge">{t('inv.simpleMode') || 'Chế độ đơn giản'}</span>
          <h2 style={{ margin: 0, fontSize: 20 }}>
            {isNew ? (t('inv.newSales') || 'Xuất bán hàng') : `${t('inv.newSales') || 'Xuất bán hàng'} · ${editing.no}`}
          </h2>
        </div>

        <div className="pos-top-actions">
          <button
            type="button"
            className="tb"
            title="Chuyển sang chế độ chuẩn"
            onClick={() => setState({ formStyle: 'standard' })}>
            ⇄ {t('inv.switchStandardMode') || 'Chế độ chuẩn'}
          </button>
          {!isNew && (
            <>
              <button
                type="button"
                className="tb"
                style={{ fontWeight: 600, color: '#0284c7' }}
                title="In mẫu phiếu cuộn giấy in nhiệt (K80 / K58)"
                onClick={() => printThermalReceipt({ ...editing, isSales: true }, t)}>
                🧾 In nhiệt
              </button>
              <button
                type="button"
                className="tb"
                title="In mẫu phiếu kho khổ A4"
                onClick={() => printVoucher({ ...editing, isSales: true }, t)}>
                📄 In A4
              </button>
              {(editing.lines || []).some((l) => l.product?.name || l.product?.code) && (
                <button
                  type="button"
                  className="tb"
                  title="In tem nhãn mã vạch + QR cho các sản phẩm trong phiếu này"
                  onClick={() => {
                    const items = (editing.lines || [])
                      .filter((l) => l.product?.name || l.product?.code)
                      .map((l) => ({
                        id: l.product?.id || l.productId || Math.random(),
                        code: l.product?.code || '',
                        name: l.product?.name || '',
                        price: Number(l.price) || Number(l.product?.price) || 0,
                        qty: Math.max(1, Math.round(Number(l.qty) || 1)),
                      }));
                    setTagPrintItems(items);
                  }}>
                  🏷️ In tem sp
                </button>
              )}
            </>
          )}
          <button type="button" className="tb" onClick={() => setState({ mode: 'list', editing: null })}>
            ← {t('inv.back')}
          </button>
          <button
            type="button"
            className="btn"
            style={{ background: '#059669', borderColor: '#059669' }}
            disabled={!savePerm || saving}
            onClick={() => doSave(true)}>
            ⚡ {saving ? 'Đang lưu…' : `${t('inv.saveAndPrint') || 'Lưu & In'} (F9)`}
          </button>
          <button
            type="button"
            className="btn"
            disabled={!savePerm || saving}
            onClick={() => doSave(false)}>
            💾 {saving ? 'Đang lưu…' : `${t('inv.save')} (F10)`}
          </button>
        </div>
      </div>

      {/* 2. MASTER HÀNG NGANG (Horizontal Master Strip) */}
      <div className="pos-master-strip">
        <div className="pos-field" style={{ flex: '2 1 240px' }}>
          <label className="pos-label">{t('inv.customer') || 'Khách hàng'} <span style={{ color: '#dc2626' }}>*</span></label>
          <Autocomplete
            value={editing.partner}
            onChange={(p) => update({ partner: p })}
            fetcher={searchCustomers}
            placeholder={t('inv.searchPartner') || 'Tìm khách hàng theo tên, mã…'}
            onCreate={createCustomer}
            createLabel={`${t('ac.create')} ${t('inv.newCustomer')}`}
          />
        </div>

        <div className="pos-field" style={{ flex: '1.2 1 180px' }}>
          <label className="pos-label">{t('inv.warehouseOut') || 'Kho xuất'}</label>
          <Autocomplete
            value={editing.warehouseOut}
            onChange={(w) => update({ warehouseOut: w })}
            fetcher={searchWarehouses}
            placeholder={t('inv.searchWarehouse') || 'Chọn kho…'}
            onCreate={createWarehouse}
            createLabel={`${t('ac.create')} ${t('inv.newWarehouse')}`}
          />
        </div>

        <div className="pos-field" style={{ flex: '1 1 140px' }}>
          <label className="pos-label">{t('inv.date') || 'Ngày lập'}</label>
          <input
            type="date"
            className="pos-input"
            value={editing.date}
            onChange={(e) => update({ date: e.target.value })}
          />
        </div>

        <div className="pos-field" style={{ flex: '2 1 220px' }}>
          <label className="pos-label">{t('inv.note') || 'Ghi chú'}</label>
          <input
            type="text"
            className="pos-input"
            placeholder="Ghi chú đơn bán hàng…"
            value={editing.note || ''}
            onChange={(e) => update({ note: e.target.value })}
          />
        </div>

        <div className="pos-field pos-check-field" style={{ flex: '1.5 1 200px' }}>
          <label className="pos-checkbox-label" title={t('inv.createReceiptHint')}>
            <input
              type="checkbox"
              checked={createVoucher}
              disabled={!!linkedVoucher}
              onChange={(e) => setCreateVoucher(e.target.checked)}
            />
            <span style={{ fontWeight: 600, color: createVoucher ? '#047857' : 'inherit' }}>
              💵 {t('inv.instantCashReceipt') || 'Thu tiền ngay (Phiếu thu)'}
            </span>
          </label>
        </div>
      </div>

      {/* Thông báo chứng từ thu liên kết nếu có */}
      {linkedVoucher && (
        <div className="pos-linked-box">
          <span>💵 <b>{t('inv.linkedReceipt')}:</b> <span style={{ color: '#047857', fontWeight: 600 }}>{linkedVoucher.code}</span> — {vnd(linkedVoucher.amount)} ({formatDate(linkedVoucher.date)})</span>
          <button
            type="button"
            className="tb"
            style={{ padding: '2px 8px', fontSize: 12, background: '#fff' }}
            onClick={() => bus?.emit('navigate', { pluginId: 'cash', state: { kind: 'receipt', q: linkedVoucher.code } })}>
            🔗 {t('inv.openReceipt')}
          </button>
        </div>
      )}

      {/* 3. THANH QUÉT MÃ VẠCH / NHẬP MÃ HÀNG NHANH (CHẾ ĐỘ ĐƠN GIẢN) */}
      <div className="pos-scanner-section">
        <div className="pos-scanner-box">
          <span className="pos-scanner-ico" aria-hidden="true">🏷️</span>
          <input
            ref={scannerRef}
            type="text"
            className="pos-scanner-input"
            value={scanQuery}
            placeholder={t('inv.scanBarcode') || 'Nhập mã hàng, quét mã vạch (F3) hoặc tìm tên sản phẩm…'}
            onChange={(e) => setScanQuery(e.target.value)}
            onKeyDown={handleScannerKeyDown}
            onFocus={() => scanQuery.trim() && setShowDropdown(true)}
          />
          {searching && <span className="pos-scanner-spinner">Đang tìm…</span>}
          {scanQuery && (
            <button
              type="button"
              className="pos-clear-btn"
              onClick={() => {
                setScanQuery('');
                setShowDropdown(false);
                scannerRef.current?.focus();
              }}>
              ✕
            </button>
          )}

          {/* Dropdown gợi ý sản phẩm */}
          {showDropdown && suggestions.length > 0 && (
            <div ref={dropdownRef} className="pos-dropdown-list">
              <div className="pos-dropdown-hint">
                <span>{t('inv.scanAddHint') || 'Dùng phím mũi tên ↑ ↓ để chọn, nhấn Enter để thêm'}</span>
                <span>{suggestions.length} kết quả</span>
              </div>
              {suggestions.map((p, idx) => (
                <div
                  key={p.id}
                  className={`pos-dropdown-item ${idx === highlightIdx ? 'highlighted' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Giữ focus input
                    addOrIncrementProduct(p);
                  }}
                  onMouseEnter={() => setHighlightIdx(idx)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="sku-tag">{p.code || 'SP'}</span>
                    <b style={{ fontSize: 14 }}>{p.name}</b>
                    <small style={{ color: 'var(--muted)' }}>({p.unit || 'cái'})</small>
                  </div>
                  <div style={{ fontWeight: 600, color: '#047857' }}>
                    {vnd(p.price)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. BẢNG CHI TIẾT HÀNG HÓA */}
      <div className="pos-table-card">
        <table className="pos-table zebra">
          <thead>
            <tr>
              <th style={{ width: 42, textAlign: 'center' }}>STT</th>
              <th style={{ width: 110 }}>Mã hàng</th>
              <th>Tên sản phẩm, dịch vụ</th>
              <th style={{ width: 80, textAlign: 'center' }}>ĐVT</th>
              <th style={{ width: 140, textAlign: 'center' }}>Số lượng</th>
              <th style={{ width: 140, textAlign: 'right' }}>Đơn giá</th>
              <th style={{ width: 150, textAlign: 'right' }}>Thành tiền</th>
              <th style={{ width: 50, textAlign: 'center' }}>Xóa</th>
            </tr>
          </thead>
          <tbody>
            {(editing.lines || []).map((l, i) => {
              const isFlashed = lastScannedId === l.id;
              const subtotal = (Number(l.qty) || 0) * (Number(l.price) || 0);
              return (
                <tr key={l.id} className={isFlashed ? 'row-flashed' : ''}>
                  <td style={{ textAlign: 'center', color: 'var(--muted)', fontWeight: 500 }}>{i + 1}</td>
                  <td>
                    <span className="sku-tag">{l.product?.code || '—'}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{l.product?.name || 'Chưa chọn'}</div>
                  </td>
                  <td style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    {l.product?.unit || 'cái'}
                  </td>
                  <td>
                    <div className="pos-qty-group">
                      <button
                        type="button"
                        className="pos-qty-btn"
                        onClick={() => updateLine(l.id, { qty: Math.max(1, (Number(l.qty) || 1) - 1) })}>
                        –
                      </button>
                      <input
                        type="number"
                        min="1"
                        className="pos-qty-input"
                        value={l.qty}
                        onChange={(e) => updateLine(l.id, { qty: Math.max(1, Number(e.target.value) || 1) })}
                      />
                      <button
                        type="button"
                        className="pos-qty-btn"
                        onClick={() => updateLine(l.id, { qty: (Number(l.qty) || 0) + 1 })}>
                        +
                      </button>
                    </div>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className="pos-price-input"
                      value={l.price}
                      onChange={(e) => updateLine(l.id, { price: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>
                    {vnd(subtotal)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="xbtn"
                      title={t('inv.deleteRow')}
                      onClick={() => removeLine(l)}>
                      🗑
                    </button>
                  </td>
                </tr>
              );
            })}
            {(!editing.lines || editing.lines.length === 0) && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--muted)' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🏷️</div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>Chưa có mặt hàng nào trong phiếu bán hàng</div>
                  <small>Quét mã vạch hoặc gõ mã hàng/tên sản phẩm ở ô tìm kiếm phía trên để thêm nhanh</small>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 5. THANH TỔNG KẾT & THANH TOÁN (Footer Summary) */}
      <div className="pos-summary-bar">
        <div className="pos-summary-left">
          <div className="pos-stat-pill">
            <span>{t('inv.itemCount') || 'Số mặt hàng'}:</span>
            <b>{totalItemsCount}</b>
          </div>
          <div className="pos-stat-pill">
            <span>{t('inv.totalQty') || 'Tổng số lượng'}:</span>
            <b style={{ color: '#0f6cbd' }}>{totalQuantities}</b>
          </div>
          <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>
            (Phím tắt: <b>F3</b> Quét mã | <b>F9</b> Lưu & In | <b>F10</b> Lưu)
          </span>
        </div>

        <div className="pos-summary-right">
          <div className="pos-grand-total">
            <span style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--muted)' }}>
              {t('inv.grandTotal') || 'Tổng tiền hàng'}:
            </span>
            <span className="pos-total-amount">{vnd(total)}</span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn"
              disabled={!savePerm || saving}
              onClick={() => doSave(false)}>
              💾 {saving ? 'Đang lưu…' : `${t('inv.save')} (F10)`}
            </button>
            <button
              type="button"
              className="btn"
              style={{ background: '#059669', borderColor: '#059669', fontSize: 15, padding: '8px 18px' }}
              disabled={!savePerm || saving}
              onClick={() => doSave(true)}>
              ⚡ {saving ? 'Đang lưu…' : `${t('inv.saveAndPrint') || 'Lưu & In'} (F9)`}
            </button>
          </div>
        </div>
      </div>

      {tagPrintItems && (
        <ProductTagPrintModal
          items={tagPrintItems}
          onClose={() => setTagPrintItems(null)}
          t={t}
        />
      )}
    </div>
  );
}

