const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function printKitchenTicket({ tableName, round, items, staffName, note, targetName = 'BÁO CHẾ BIẾN' }, t) {
  const d = new Date();
  const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const rows = (items || []).map((it, idx) => {
    const q = it.qty != null ? Number(it.qty) : 1;
    const unitText = it.unit ? ` ${esc(it.unit)}` : '';
    const noteText = it.note ? `<div class="item-note">👉 <i>${esc(it.note)}</i></div>` : '';
    return `
      <div class="item-row">
        <div class="item-header">
          <span class="item-name">${idx + 1}. <b>${esc(it.productName || it.name)}</b></span>
          <span class="item-qty">x<b>${q}</b>${unitText}</span>
        </div>
        ${noteText}
      </div>
    `;
  }).join('');

  const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>KOT - ${esc(tableName)} - Đợt ${round || 1}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0 auto;
    width: 76mm;
    max-width: 100%;
    padding: 3mm 2mm;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    font-size: 13px;
    line-height: 1.3;
    color: #000;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .c { text-align: center; }
  .b { font-weight: 700; }
  .dashed { border-top: 1.5px dashed #000; margin: 6px 0; }
  .double { border-top: 2px solid #000; margin: 6px 0; }
  .title {
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.5px;
    text-align: center;
  }
  .table-box {
    text-align: center;
    background: #000;
    color: #fff;
    font-size: 22px;
    font-weight: 900;
    padding: 4px 6px;
    margin: 6px 0;
    border-radius: 4px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .meta-row {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    margin: 2px 0;
  }
  .item-row {
    padding: 5px 0;
    border-bottom: 1px dashed #777;
  }
  .item-row:last-child {
    border-bottom: none;
  }
  .item-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 14.5px;
  }
  .item-name {
    flex: 1;
    word-break: break-word;
    padding-right: 8px;
  }
  .item-qty {
    font-size: 18px;
    font-weight: 800;
    white-space: nowrap;
  }
  .item-note {
    font-size: 12px;
    color: #222;
    margin-top: 2px;
    padding-left: 14px;
  }
  .order-note {
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    padding: 4px 8px;
    font-size: 12px;
    margin-top: 6px;
    border-radius: 4px;
  }
  .footer {
    text-align: center;
    font-size: 11px;
    font-style: italic;
    margin-top: 8px;
  }
</style>
</head>
<body>
  <div class="title">PHIẾU ${esc(targetName)}</div>
  <div class="table-box">${esc(tableName)}</div>
  
  <div class="meta-row">
    <span>Thời gian: <b>${timeStr}</b></span>
    <span>Ngày: <b>${dateStr}</b></span>
  </div>
  <div class="meta-row">
    <span>Đợt gọi: <b style="font-size:14px">ĐỢT ${round || 1}</b></span>
    <span>NV: <b>${esc(staffName || 'Phục vụ')}</b></span>
  </div>
  
  ${note ? `<div class="order-note">📝 Ghi chú bàn: <b>${esc(note)}</b></div>` : ''}

  <div class="double"></div>
  <div class="items-wrap">
    ${rows || '<div class="c" style="padding:10px 0;">(Không có món)</div>'}
  </div>
  <div class="double"></div>

  <div class="footer">-- Chúc quý khách ngon miệng --</div>
</body>
</html>`;

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const w = frame.contentWindow;
  w.document.open();
  w.document.write(html);
  w.document.close();
  const fire = () => {
    try {
      w.focus();
      w.print();
    } catch (_) {}
    finally {
      setTimeout(() => {
        if (frame.parentNode) frame.parentNode.removeChild(frame);
      }, 2000);
    }
  };
  if (frame.contentDocument?.readyState === 'complete') {
    setTimeout(fire, 80);
  } else {
    frame.addEventListener('load', () => setTimeout(fire, 80), { once: true });
  }
}

