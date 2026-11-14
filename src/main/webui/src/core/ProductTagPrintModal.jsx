import { useState, useMemo, useRef } from 'react';
import { generateBarcodeSvg } from './barcode.js';
import { generateQrSvg } from './qrcode.js';
import { getActiveCompany } from './tenant.js';
import { useI18n } from './i18n.jsx';

const TAG_SIZES = [
  { id: '50x35', label: '50 × 35 mm (2 tem / hàng A4 - Chuẩn)', width: '50mm', height: '35mm', perRow: 2, barcodeH: 22, nameSize: '11px', qrSize: 54 },
  { id: '40x30', label: '40 × 30 mm (2 tem / hàng A4 - Nhỏ gọn)', width: '40mm', height: '30mm', perRow: 2, barcodeH: 18, nameSize: '10px', qrSize: 46 },
  { id: '70x45', label: '70 × 45 mm (1 tem / hàng - Thùng/Hộp lớn)', width: '70mm', height: '45mm', perRow: 1, barcodeH: 28, nameSize: '13px', qrSize: 66 },
  { id: '35x22', label: '35 × 22 mm (3 tem / hàng Tomy 138/145)', width: '35mm', height: '22mm', perRow: 3, barcodeH: 14, nameSize: '9px', qrSize: 34 },
];

const money = (n) => Number(n || 0).toLocaleString('vi-VN');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default function ProductTagPrintModal({ items = [], onClose, t: propT }) {
  const { t: i18nT } = useI18n();
  const t = propT || i18nT;
  const activeCompany = getActiveCompany() || {};
  const [storeName, setStoreName] = useState(activeCompany.name || 'CỬA HÀNG TIỆN LỢI');
  const [tagSizeId, setTagSizeId] = useState('50x35');
  const [showStoreName, setShowStoreName] = useState(true);
  const [showItemName, setShowItemName] = useState(true);
  const [showItemCode, setShowItemCode] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);
  const [showQrCode, setShowQrCode] = useState(true);
  const [showCutBorder, setShowCutBorder] = useState(true);
  const [qrContentType, setQrContentType] = useState('code'); // 'code', 'code_price', 'full'

  // Quản lý danh sách sản phẩm và số lượng in
  const [itemQuantities, setItemQuantities] = useState(() => {
    const map = {};
    for (const it of items) {
      map[it.id] = Math.max(1, Number(it.qty) || 1);
    }
    return map;
  });

  const [activeItems, setActiveItems] = useState(() => items);

  const selectedSize = TAG_SIZES.find((s) => s.id === tagSizeId) || TAG_SIZES[0];

  const setAllQty = (qty) => {
    const val = Math.max(1, qty);
    setItemQuantities((prev) => {
      const next = { ...prev };
      for (const it of activeItems) next[it.id] = val;
      return next;
    });
  };

  const removeItem = (id) => {
    setActiveItems((prev) => prev.filter((it) => it.id !== id));
  };

  const updateItemQty = (id, delta) => {
    setItemQuantities((prev) => ({
      ...prev,
      [id]: Math.max(1, (Number(prev[id]) || 1) + delta),
    }));
  };

  // Mảng dẹp các tem sẽ in thực tế
  const expandedTags = useMemo(() => {
    const tags = [];
    for (const it of activeItems) {
      const count = Number(itemQuantities[it.id]) || 1;
      for (let i = 0; i < count; i++) {
        tags.push({ ...it, tagIdx: i + 1, totalForThis: count });
      }
    }
    return tags;
  }, [activeItems, itemQuantities]);

  const totalTags = expandedTags.length;

  const getQrData = (item) => {
    const code = item.code || item.id || 'ITEM';
    const priceStr = money(item.price);
    if (qrContentType === 'code_price') return `${code} | ${priceStr}d`;
    if (qrContentType === 'full') return `${item.name || ''} - ${code} - ${priceStr}d`;
    return code;
  };

  const doPrint = () => {
    if (!expandedTags.length) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;

    const tagsHtml = expandedTags.map((it) => {
      const barcodeHtml = showBarcode ? generateBarcodeSvg(it.code || it.id || 'ITEM', {
        height: selectedSize.barcodeH,
        showText: false,
        narrow: tagSizeId === '35x22' ? 1.2 : 1.5,
      }) : '';

      const qrHtml = showQrCode ? generateQrSvg(getQrData(it), selectedSize.qrSize) : '';
      const isCompact = tagSizeId === '35x22';
      const itemCode = it.code || it.id || '';

      return `<div class="tag-card">
        ${showCutBorder ? `<span class="cut-mark">✂</span>` : ''}
        ${showStoreName && storeName ? `<div class="tag-store">${esc(storeName)}</div>` : ''}
        ${showItemName ? `<div class="tag-name" title="${esc(it.name)}">${esc(it.name || 'Sản phẩm')}</div>` : ''}
        ${showPrice ? `<div class="tag-price">${money(it.price)} <span class="tag-currency">đ</span></div>` : ''}
        
        ${(showBarcode || showQrCode || showItemCode) ? `
          <div class="tag-codes-wrap ${isCompact ? 'stacked' : 'side-by-side'}">
            ${showBarcode ? `
              <div class="barcode-col">
                <div class="barcode-svg-wrap">${barcodeHtml}</div>
                ${showItemCode ? `<div class="tag-sku" title="${esc(itemCode)}">${esc(itemCode)}</div>` : ''}
              </div>
            ` : (showItemCode ? `
              <div class="tag-sku-standalone">Mã SP: <b>${esc(itemCode)}</b></div>
            ` : '')}
            ${showQrCode ? `<div class="qr-col">${qrHtml}</div>` : ''}
          </div>
        ` : ''}
      </div>`;
    }).join('\n');

    doc.open();
    doc.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>In tem nhãn sản phẩm (${totalTags} tem)</title>
  <style>
    @page {
      size: auto;
      margin: 6mm 4mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      background: #fff;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 3mm 3mm;
      justify-content: flex-start;
      align-content: flex-start;
    }
    .tag-card {
      width: ${selectedSize.width};
      min-height: ${selectedSize.height};
      max-height: ${selectedSize.height};
      overflow: hidden;
      box-sizing: border-box;
      padding: 1.5mm 2mm;
      position: relative;
      background: #fff;
      ${showCutBorder ? 'border: 1px dashed #777;' : 'border: 1px solid transparent;'}
      page-break-inside: avoid;
      break-inside: avoid;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .cut-mark {
      position: absolute;
      top: -1px;
      left: 1px;
      font-size: 8px;
      color: #888;
      line-height: 1;
      pointer-events: none;
    }
    .tag-store {
      font-size: ${tagSizeId === '35x22' ? '8px' : '9px'};
      font-weight: 700;
      text-transform: uppercase;
      text-align: center;
      color: #222;
      line-height: 1.1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 1px;
    }
    .tag-name {
      font-size: ${selectedSize.nameSize};
      font-weight: 700;
      color: #000;
      line-height: 1.15;
      text-align: center;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      margin-bottom: 1px;
    }
    .tag-sku {
      font-size: ${selectedSize.nameSize};
      font-weight: 700;
      color: #000;
      line-height: 1.15;
      text-align: center;
      letter-spacing: 0.5px;
      margin-top: 1.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
    .tag-sku-standalone {
      font-size: ${selectedSize.nameSize};
      font-weight: 700;
      color: #000;
      text-align: center;
      margin: 2px 0;
    }
    .tag-price {
      font-size: ${tagSizeId === '35x22' ? '10px' : tagSizeId === '70x45' ? '14px' : '12px'};
      font-weight: 800;
      text-align: center;
      color: #000;
      line-height: 1.1;
    }
    .tag-currency {
      font-size: 0.85em;
      font-weight: 600;
      text-decoration: underline;
    }
    .tag-codes-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: auto;
    }
    .tag-codes-wrap.side-by-side {
      flex-direction: row;
      gap: 2mm;
    }
    .tag-codes-wrap.stacked {
      flex-direction: column;
      gap: 1mm;
    }
    .barcode-col {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      min-width: 0;
    }
    .barcode-svg-wrap {
      width: 100%;
      display: flex;
      justify-content: center;
    }
    .qr-col {
      flex: 0 0 auto;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    svg {
      display: block;
      max-width: 100%;
    }
  </style>
</head>
<body>
  <div class="print-grid">
    ${tagsHtml}
  </div>
</body>
</html>`);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.error('Print failed:', err);
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 1500);
      }
    }, 400);
  };

  return (
    <div className="confirm-backdrop" style={{ zIndex: 1200, padding: 12 }} onMouseDown={onClose}>
      <div
        className="product-tag-modal"
        style={{
          width: '95vw',
          maxWidth: 1140,
          maxHeight: '92vh',
          background: '#fff',
          borderRadius: 8,
          boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          borderBottom: '1px solid #e5e7eb',
          background: '#f8fafc',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
              🏷️ {t('tag.title') || 'In tem nhãn hàng hóa (Mã vạch Barcode + QR Code)'}
            </h3>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {t('tag.printPreview') || 'Tùy chỉnh nội dung, số lượng in từng tem, có đường cắt nét đứt [✂] để dán lên bao bì sản phẩm'}
            </div>
          </div>
          <button
            type="button"
            className="xbtn"
            style={{ fontSize: 18, color: '#64748b', cursor: 'pointer', padding: '4px 8px' }}
            title={t('common.close') || 'Đóng'}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Modal Body: Left controls (40%), Right live preview (60%) */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Controls Panel */}
          <div style={{
            width: 420,
            flexShrink: 0,
            borderRight: '1px solid #e5e7eb',
            overflowY: 'auto',
            padding: 16,
            background: '#fafafa',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}>
            {/* Template Size */}
            <div style={{ background: '#fff', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 6, color: '#334155' }}>
                Kích thước tem nhãn:
              </label>
              <select
                style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13 }}
                value={tagSizeId}
                onChange={(e) => setTagSizeId(e.target.value)}
              >
                {TAG_SIZES.map((sz) => (
                  <option key={sz.id} value={sz.id}>{sz.label}</option>
                ))}
              </select>
            </div>

            {/* Display Toggles */}
            <div style={{ background: '#fff', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 8, color: '#334155' }}>
                Tùy chọn hiển thị trên tem:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 12.5 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={showStoreName} onChange={(e) => setShowStoreName(e.target.checked)} />
                  Tên cửa hàng
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={showItemName} onChange={(e) => setShowItemName(e.target.checked)} />
                  Tên hàng hóa
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} />
                  Đơn giá bán
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={showItemCode} onChange={(e) => setShowItemCode(e.target.checked)} />
                  Mã SKU (cỡ chữ lớn)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={showBarcode} onChange={(e) => setShowBarcode(e.target.checked)} />
                  Mã vạch (Barcode)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={showQrCode} onChange={(e) => setShowQrCode(e.target.checked)} />
                  Mã QR Code
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', gridColumn: 'span 2' }}>
                  <input type="checkbox" checked={showCutBorder} onChange={(e) => setShowCutBorder(e.target.checked)} />
                  Đường viền cắt nét đứt & biểu tượng kéo [✂]
                </label>
              </div>

              {showStoreName && (
                <div style={{ marginTop: 10 }}>
                  <span style={{ fontSize: 11.5, color: '#64748b' }}>Tên đơn vị hiển thị:</span>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="VD: CỬA HÀNG MINH ANH"
                    style={{ width: '100%', marginTop: 3, padding: '5px 8px', fontSize: 12.5, borderRadius: 4, border: '1px solid #cbd5e1' }}
                  />
                </div>
              )}

              {showQrCode && (
                <div style={{ marginTop: 10 }}>
                  <span style={{ fontSize: 11.5, color: '#64748b' }}>Nội dung mã QR:</span>
                  <select
                    style={{ width: '100%', marginTop: 3, padding: '4px 6px', fontSize: 12, borderRadius: 4, border: '1px solid #cbd5e1' }}
                    value={qrContentType}
                    onChange={(e) => setQrContentType(e.target.value)}
                  >
                    <option value="code">Mã hàng (Quét tra cứu nhanh)</option>
                    <option value="code_price">Mã hàng + Đơn giá</option>
                    <option value="full">Tên hàng + Mã + Đơn giá</option>
                  </select>
                </div>
              )}
            </div>

            {/* Product List & Quantity Adjustments */}
            <div style={{ background: '#fff', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: '#334155' }}>
                  Sản phẩm & Số tem ({activeItems.length}):
                </label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" className="tb" style={{ padding: '2px 6px', fontSize: 11 }} onClick={() => setAllQty(1)}>Tất cả = 1</button>
                  <button type="button" className="tb" style={{ padding: '2px 6px', fontSize: 11 }} onClick={() => setAllQty(2)}>2</button>
                  <button type="button" className="tb" style={{ padding: '2px 6px', fontSize: 11 }} onClick={() => setAllQty(5)}>5</button>
                  <button type="button" className="tb" style={{ padding: '2px 6px', fontSize: 11 }} onClick={() => setAllQty(10)}>10</button>
                </div>
              </div>

              <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: 4 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={{ padding: '4px 6px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Hàng hóa</th>
                      <th style={{ padding: '4px 6px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>Đơn giá</th>
                      <th style={{ padding: '4px 6px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', width: 85 }}>Số tem</th>
                      <th style={{ padding: '4px', borderBottom: '1px solid #e2e8f0', width: 28 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {activeItems.map((it) => {
                      const qty = itemQuantities[it.id] ?? 1;
                      return (
                        <tr key={it.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '4px 6px' }}>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{it.name || '---'}</div>
                            <div style={{ fontSize: 10.5, color: '#64748b' }}>{it.code || '---'}</div>
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'right', color: '#047857', fontWeight: 600 }}>
                            {money(it.price)}đ
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: 4, overflow: 'hidden' }}>
                              <button
                                type="button"
                                style={{ border: 'none', background: '#f1f5f9', width: 20, height: 22, cursor: 'pointer', padding: 0 }}
                                onClick={() => updateItemQty(it.id, -1)}
                              >-</button>
                              <input
                                type="number"
                                min="1"
                                max="999"
                                value={qty}
                                onChange={(e) => setItemQuantities((prev) => ({ ...prev, [it.id]: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                                style={{ width: 36, height: 22, border: 'none', textAlign: 'center', fontSize: 11.5, fontWeight: 700 }}
                              />
                              <button
                                type="button"
                                style={{ border: 'none', background: '#f1f5f9', width: 20, height: 22, cursor: 'pointer', padding: 0 }}
                                onClick={() => updateItemQty(it.id, 1)}
                              >+</button>
                            </div>
                          </td>
                          <td style={{ padding: '4px', textAlign: 'center' }}>
                            <button
                              type="button"
                              title="Bỏ qua sản phẩm này"
                              onClick={() => removeItem(it.id)}
                              style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {!activeItems.length && (
                      <tr>
                        <td colSpan="4" style={{ padding: 16, textAlign: 'center', color: '#94a3b8' }}>
                          Không có sản phẩm nào được chọn
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Live Preview Panel */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: '#e2e8f0',
            overflow: 'hidden',
          }}>
            {/* Preview Toolbar */}
            <div style={{
              padding: '8px 16px',
              background: '#f1f5f9',
              borderBottom: '1px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>
                👁️ Xem trước trang in: <span style={{ color: '#0369a1' }}>{totalTags} tem nhãn</span> ({selectedSize.label})
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b' }}>
                Đường nét đứt mô phỏng vị trí dùng kéo cắt
              </div>
            </div>

            {/* Scrollable Preview Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', justifyContent: 'center' }}>
              <div style={{
                background: '#fff',
                minHeight: '100%',
                width: '100%',
                maxWidth: 800,
                padding: '24px 20px',
                borderRadius: 4,
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                alignContent: 'flex-start',
                justifyContent: 'flex-start',
              }}>
                {expandedTags.map((it, idx) => {
                  const barcodeSvg = showBarcode ? generateBarcodeSvg(it.code || it.id || 'ITEM', {
                    height: selectedSize.barcodeH,
                    showText: false,
                    narrow: tagSizeId === '35x22' ? 1.2 : 1.5,
                  }) : '';

                  const qrSvg = showQrCode ? generateQrSvg(getQrData(it), selectedSize.qrSize) : '';
                  const isCompact = tagSizeId === '35x22';
                  const itemCode = it.code || it.id || '';

                  return (
                    <div
                      key={`${it.id}-${idx}`}
                      style={{
                        width: selectedSize.width,
                        minHeight: selectedSize.height,
                        maxHeight: selectedSize.height,
                        border: showCutBorder ? '1px dashed #777' : '1px solid #e2e8f0',
                        borderRadius: 3,
                        padding: '5px 7px',
                        boxSizing: 'border-box',
                        position: 'relative',
                        background: '#fff',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        overflow: 'hidden',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
                      }}
                    >
                      {showCutBorder && (
                        <span style={{ position: 'absolute', top: 0, left: 2, fontSize: 8, color: '#94a3b8', lineHeight: 1 }}>
                          ✂
                        </span>
                      )}

                      {showStoreName && storeName && (
                        <div style={{
                          fontSize: tagSizeId === '35x22' ? 8 : 9,
                          fontWeight: 700,
                          textAlign: 'center',
                          textTransform: 'uppercase',
                          color: '#334155',
                          lineHeight: 1.1,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {storeName}
                        </div>
                      )}

                      {showItemName && (
                        <div style={{
                          fontSize: selectedSize.nameSize,
                          fontWeight: 700,
                          textAlign: 'center',
                          color: '#0f172a',
                          lineHeight: 1.15,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}>
                          {it.name || 'Sản phẩm'}
                        </div>
                      )}

                      {showPrice && (
                        <div style={{
                          fontSize: tagSizeId === '35x22' ? 10 : tagSizeId === '70x45' ? 14 : 12,
                          fontWeight: 800,
                          textAlign: 'center',
                          color: '#000',
                          lineHeight: 1.1,
                        }}>
                          {money(it.price)} <span style={{ fontSize: '0.85em', textDecoration: 'underline' }}>đ</span>
                        </div>
                      )}

                      {(showBarcode || showQrCode || showItemCode) && (
                        <div style={{
                          display: 'flex',
                          flexDirection: isCompact ? 'column' : 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: isCompact ? 2 : 6,
                          marginTop: 'auto',
                        }}>
                          {showBarcode ? (
                            <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', minWidth: 0 }}>
                              <div
                                style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
                                dangerouslySetInnerHTML={{ __html: barcodeSvg }}
                              />
                              {showItemCode && (
                                <div style={{
                                  fontSize: selectedSize.nameSize,
                                  fontWeight: 700,
                                  textAlign: 'center',
                                  color: '#000',
                                  lineHeight: 1.15,
                                  letterSpacing: 0.5,
                                  marginTop: 1.5,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxWidth: '100%',
                                }} title={itemCode}>
                                  {itemCode}
                                </div>
                              )}
                            </div>
                          ) : (showItemCode ? (
                            <div style={{
                              fontSize: selectedSize.nameSize,
                              fontWeight: 700,
                              textAlign: 'center',
                              color: '#000',
                              margin: '2px 0',
                            }}>
                              Mã: <b>{itemCode}</b>
                            </div>
                          ) : null)}

                          {showQrCode && (
                            <div
                              style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'center' }}
                              dangerouslySetInnerHTML={{ __html: qrSvg }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {!expandedTags.length && (
                  <div style={{ padding: 40, textAlign: 'center', width: '100%', color: '#94a3b8' }}>
                    Chưa có tem nào để hiển thị. Vui lòng chọn ít nhất 1 sản phẩm.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #e5e7eb',
          background: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 13, color: '#475569' }}>
            {t('common.total') || 'Tổng cộng'}: <b style={{ color: '#0369a1', fontSize: 15 }}>{totalTags}</b> {t('tag.quantity') || 'tem nhãn'}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="tb" onClick={onClose}>
              {t('common.close') || 'Đóng'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={!totalTags}
              style={{
                background: '#0284c7',
                borderColor: '#0284c7',
                color: '#fff',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
              onClick={doPrint}
            >
              🖨️ {t('tag.print') || 'In ngay'} ({totalTags})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

