// Bản in phiếu kho (A4) dùng chung cho nhập / xuất / điều chuyển / trả hàng.
// Chỉ dựng HTML + CSS rồi in bằng iframe ẩn — không cần thư viện ngoài.

import { apiFetch } from '../../core/api.js';
import { getActiveCompany, setCompanies } from '../../core/tenant.js';
import { generateBarcodeSvg } from '../../core/barcode.js';
import { generateQrSvg } from '../../core/qrcode.js';

export { generateBarcodeSvg, generateQrSvg };

const TYPES = {
  import:   { title: 'inv.voucherImport',   form: '01 - VT', whIn: true,  whOut: false, partner: 'inv.voucherDeliverer', sign: 'inv.deliverer' },
  export:   { title: 'inv.voucherExport',   form: '02 - VT', whIn: false, whOut: true,  partner: 'inv.voucherReceiver',  sign: 'inv.receiver' },
  transfer: { title: 'inv.voucherTransfer', form: '03 - VT', whIn: true,  whOut: true,  partner: 'inv.partner',          sign: 'inv.receiver' },
  return:   { title: 'inv.voucherReturn',   form: '01 - VT', whIn: true,  whOut: false, partner: 'inv.voucherDeliverer', sign: 'inv.deliverer' },
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Number(n || 0).toLocaleString('vi-VN');
const docLines = (doc) => (Array.isArray(doc?.lines) ? doc.lines : []);
const amount = (l) => (Number(l?.qty) || 0) * (Number(l?.price) || 0);

export function voucherHtml(doc, t, company) {
  const kind = TYPES[doc?.type] ?? TYPES.import;
  const titleKey = (doc?.isSales && doc?.type === 'export') ? 'inv.voucherSalesExport' : kind.title;
  const [y = '', m = '', d = ''] = String(doc?.date ?? '').split('-');
  const rows = docLines(doc);
  const totalQty = rows.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  const total = rows.reduce((s, l) => s + amount(l), 0);
  const c = company ?? {};
  const companyName = c.name || t('inv.voucherCompany');
  const addressLine = c.address
    ? `${esc(t('inv.voucherAddressLabel'))}: ${esc(c.address)}`
    : esc(t('inv.voucherAddress'));
  const taxLine = c.taxCode ? `${esc(t('inv.voucherTax'))}: ${esc(c.taxCode)}` : '';
  const phoneLine = c.phone
    ? `${esc(t('inv.voucherPhoneLabel'))}: ${esc(c.phone)}`
    : esc(t('inv.voucherPhone'));

  const warehouses = [];
  if (kind.whOut && doc?.warehouseOut?.name) warehouses.push(`${t('inv.warehouseOut')}: <b>${esc(doc.warehouseOut.name)}</b>`);
  if (kind.whIn && doc?.warehouseIn?.name) warehouses.push(`${t('inv.warehouseIn')}: <b>${esc(doc.warehouseIn.name)}</b>`);

  const items = rows.map((l, i) => `<tr>
      <td class="c">${i + 1}</td>
      <td>${l.product?.code ? `<span style="font-family: monospace; font-size: 11px; color: #444;">[${esc(l.product.code)}]</span> ` : ''}${esc(l.product?.name ?? '')}</td>
      <td class="n">${money(l.qty)}</td>
      <td class="n">${money(l.price)}</td>
      <td class="n">${money(amount(l))}</td>
    </tr>`).join('');

  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>${esc(doc?.no ?? t(titleKey))}</title>
<style>
  @page { size: A4 portrait; margin: 14mm 15mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Times New Roman", serif; font-size: 13px; color: #000; }
  .head { display: flex; justify-content: space-between; gap: 20px; }
  .company { font-weight: 700; text-transform: uppercase; }
  .form { text-align: center; font-size: 11.5px; line-height: 1.35; }
  h1 { margin: 16px 0 2px; text-align: center; font-size: 20px; letter-spacing: .5px; }
  .date { text-align: center; font-style: italic; margin-bottom: 8px; }
  .meta { display: flex; justify-content: space-between; margin: 4px 0; }
  .info div { margin: 3px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { border: 1px solid #000; padding: 4px 6px; }
  th { text-align: center; background: #f2f2f2; font-weight: 700; }
  td.c { text-align: center; width: 36px; }
  td.n { text-align: right; white-space: nowrap; }
  tfoot td { font-weight: 700; }
  .note { margin-top: 6px; font-style: italic; }
  .sigs { display: flex; justify-content: space-between; margin-top: 26px; text-align: center; }
  .sig { width: 24%; }
  .sig b { display: block; }
  .sig i { display: block; font-size: 11.5px; margin-bottom: 58px; }
</style></head>
<body>
  <div class="head">
    <div>
      <div class="company">${esc(companyName)}</div>
      <div>${addressLine}</div>
      ${taxLine ? `<div>${taxLine}</div>` : ''}
      <div>${phoneLine}</div>
    </div>
    <div class="form">${esc(t('inv.voucherForm').replace('{no}', kind.form))}<br/>${esc(t('inv.voucherFormRef'))}</div>
  </div>
  <h1>${esc(t(titleKey))}</h1>
  <div class="date">${esc(t('inv.voucherDate').replace('{d}', d).replace('{m}', m).replace('{y}', y))}</div>
  <div class="meta"><span>${esc(t('inv.no'))}: <b>${esc(doc?.no ?? '')}</b></span></div>
  <div class="info">
    <div>${esc(t(kind.partner))}: <b>${esc(doc?.partner?.name ?? '')}</b></div>
    ${warehouses.map((x) => `<div>${x}</div>`).join('')}
    ${doc?.bank?.name ? `<div>${esc(t('inv.bank'))}: ${esc(doc.bank.name)}</div>` : ''}
  </div>
  <table>
    <thead><tr>
      <th>${esc(t('inv.stt'))}</th><th>${esc(t('inv.product'))}</th>
      <th>${esc(t('inv.qty'))}</th><th>${esc(t('inv.price'))}</th><th>${esc(t('inv.lineTotal'))}</th>
    </tr></thead>
    <tbody>${items || `<tr><td colspan="5" class="c">${esc(t('inv.empty'))}</td></tr>`}</tbody>
    <tfoot><tr>
      <td colspan="2" style="text-align:right">${esc(t('inv.grandTotal'))}</td>
      <td class="n">${money(totalQty)}</td><td></td><td class="n">${money(total)}</td>
    </tr></tfoot>
  </table>
  ${doc?.note ? `<div class="note">${esc(t('inv.note'))}: ${esc(doc.note)}</div>` : ''}
  <div class="sigs">
    <div class="sig"><b>${esc(t('inv.createdBy'))}</b><i>${esc(t('inv.signHint'))}</i></div>
    <div class="sig"><b>${esc(t(kind.sign))}</b><i>${esc(t('inv.signHint'))}</i></div>
    <div class="sig"><b>${esc(t('inv.keeper'))}</b><i>${esc(t('inv.signHint'))}</i></div>
    <div class="sig"><b>${esc(t('inv.chiefAccountant'))}</b><i>${esc(t('inv.signHint'))}</i></div>
  </div>
</body></html>`;
}

// Lấy công ty đang chọn từ phiên; nếu thiếu thông tin in thì nạp lại từ API.
async function resolveCompany() {
  let company = getActiveCompany();
  if (company && (company.address || company.taxCode || company.phone)) return company;
  try {
    const list = await apiFetch('/api/companies', { silent401: true });
    if (Array.isArray(list)) {
      setCompanies(list);
      company = getActiveCompany() ?? company;
    }
  } catch { /* giữ dữ liệu phiên hiện có */ }
  return company;
}

// In bằng iframe ẩn: hộp thoại in của trình duyệt hiển thị đúng bản in (xem trước) rồi in.
export async function printVoucher(doc, t) {
  const company = await resolveCompany();
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const w = frame.contentWindow;
  w.document.open();
  w.document.write(voucherHtml(doc, t, company));
  w.document.close();
  const fire = () => {
    try { w.focus(); w.print(); } finally { setTimeout(() => frame.remove(), 1500); }
  };
  if (frame.contentDocument?.readyState === 'complete') setTimeout(fire, 80);
  else frame.addEventListener('load', () => setTimeout(fire, 80), { once: true });
}

/* ==========================================================================
   CẤU HÌNH & XUẤT BẢN IN NHIỆT (K80 / K58) CHO PHIẾU XUẤT BÁN HÀNG
   ========================================================================== */

export const DEFAULT_THERMAL_CONFIG = {
  paperSize: 'k80', // 'k80' (80mm) | 'k58' (58mm)
  receiptTitle: 'PHIẾU XUẤT BÁN HÀNG',
  subTitle: 'Hóa đơn kiêm phiếu xuất kho',
  showStoreName: true,
  storeName: '',
  showStoreAddress: true,
  storeAddress: '',
  showStorePhone: true,
  storePhone: '',
  showTaxCode: true,
  showVoucherNo: true,
  showDateTime: true,
  showCustomer: true,
  showCustomerPhone: true,
  showCustomerAddress: true,
  showWarehouse: true,
  showCashier: true,
  cashierName: '',
  itemLayout: 'multi-line', // 'multi-line' | 'table'
  showItemCode: true,
  showItemUnit: true,
  showItemIndex: true,
  showTotalQty: true,
  showGrandTotal: true,
  showPaymentMethod: true,
  paymentMethod: 'Tiền mặt',
  showAmountInWords: false,
  thankYouMessage: 'Cảm ơn quý khách và hẹn gặp lại!',
  returnPolicy: 'Quý khách vui lòng kiểm tra hàng hóa trước khi nhận.',
  showBarcode: true,
  showQrCode: false,
  qrContent: '',
};

let cachedThermalConfig = null;

export async function getThermalReceiptConfig() {
  if (cachedThermalConfig) return cachedThermalConfig;
  try {
    const res = await apiFetch('/api/settings/thermal_receipt_config', { silent401: true });
    if (res?.value) {
      const parsed = typeof res.value === 'string' ? JSON.parse(res.value) : res.value;
      cachedThermalConfig = { ...DEFAULT_THERMAL_CONFIG, ...parsed };
      return cachedThermalConfig;
    }
  } catch { /* fallback to default */ }
  return { ...DEFAULT_THERMAL_CONFIG };
}

export function clearThermalConfigCache() {
  cachedThermalConfig = null;
}

// generateBarcodeSvg and generateQrSvg are imported from core and re-exported above.


export function thermalReceiptHtml(doc, t, company, customConfig) {
  const cfg = { ...DEFAULT_THERMAL_CONFIG, ...(customConfig ?? {}) };
  const isK58 = cfg.paperSize === 'k58';
  const c = company ?? {};

  const storeName = cfg.showStoreName ? (cfg.storeName?.trim() || c.name || 'CỬA HÀNG BÁN HÀNG') : '';
  const storeAddress = cfg.showStoreAddress ? (cfg.storeAddress?.trim() || c.address || '') : '';
  const storePhone = cfg.showStorePhone ? (cfg.storePhone?.trim() || c.phone || '') : '';
  const taxCode = cfg.showTaxCode ? (c.taxCode || '') : '';

  const rows = docLines(doc);
  const totalQty = rows.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  const total = rows.reduce((s, l) => s + amount(l), 0);

  let dateFormatted = '';
  if (doc?.createdAt) {
    try {
      const cd = new Date(doc.createdAt);
      if (!isNaN(cd.getTime())) {
        const dd = String(cd.getDate()).padStart(2, '0');
        const mm = String(cd.getMonth() + 1).padStart(2, '0');
        const yy = cd.getFullYear();
        const hh = String(cd.getHours()).padStart(2, '0');
        const mi = String(cd.getMinutes()).padStart(2, '0');
        dateFormatted = `${dd}/${mm}/${yy} ${hh}:${mi}`;
      }
    } catch (_) {}
  }
  if (!dateFormatted) {
    const [y = '', m = '', d = ''] = String(doc?.date ?? '').split('-');
    dateFormatted = (d && m && y) ? `${d}/${m}/${y}` : (doc?.date || '');
  }

  // Render danh sách sản phẩm theo kiểu Multi-line (chuyên cho in nhiệt) hoặc Bảng cột
  let itemsHtml = '';
  if (cfg.itemLayout === 'multi-line') {
    itemsHtml = rows.map((l, i) => {
      const idxText = cfg.showItemIndex ? `${i + 1}. ` : '';
      const codeText = cfg.showItemCode && l.product?.code ? `[${esc(l.product.code)}] ` : '';
      const unitText = cfg.showItemUnit && l.product?.unit ? ` ${esc(l.product.unit)}` : '';
      return `<div class="item-block">
        <div class="item-name">${idxText}${codeText}<b>${esc(l.product?.name ?? '')}</b></div>
        <div class="item-calc">
          <span>${money(l.qty)}${unitText} × ${money(l.price)}</span>
          <span class="item-amt">${money(amount(l))}đ</span>
        </div>
      </div>`;
    }).join('');
  } else {
    itemsHtml = `<table class="tbl">
      <thead>
        <tr>
          ${cfg.showItemIndex ? '<th class="c">STT</th>' : ''}
          <th>Tên hàng</th>
          <th class="r">SL</th>
          <th class="r">Đ.Giá</th>
          <th class="r">T.Tiền</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((l, i) => `<tr>
          ${cfg.showItemIndex ? `<td class="c">${i + 1}</td>` : ''}
          <td>${cfg.showItemCode && l.product?.code ? `[${esc(l.product.code)}] ` : ''}${esc(l.product?.name ?? '')}</td>
          <td class="r">${money(l.qty)}</td>
          <td class="r">${money(l.price)}</td>
          <td class="r">${money(amount(l))}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  }

  const barcodeHtml = cfg.showBarcode && doc?.no ? generateBarcodeSvg(doc.no, isK58 ? 30 : 36) : '';
  const qrHtml = cfg.showQrCode ? generateQrSvg(cfg.qrContent || doc?.no, isK58 ? 84 : 96) : '';

  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<title>${esc(doc?.no ?? cfg.receiptTitle)}</title>
<style>
  @page {
    size: ${isK58 ? '58mm' : '80mm'} auto;
    margin: 0;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0 auto;
    width: ${isK58 ? '54mm' : '76mm'};
    max-width: 100%;
    padding: 3mm 1mm;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, Helvetica, sans-serif;
    font-size: ${isK58 ? '11px' : '12.5px'};
    line-height: 1.35;
    color: #000;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .c { text-align: center; }
  .r { text-align: right; }
  .b { font-weight: 700; }
  .dashed {
    border-top: 1px dashed #000;
    margin: 6px 0;
  }
  .double {
    border-top: 2px solid #000;
    margin: 6px 0;
  }
  .store-name {
    font-size: ${isK58 ? '13px' : '15px'};
    font-weight: 800;
    text-align: center;
    text-transform: uppercase;
    margin-bottom: 2px;
  }
  .store-info {
    text-align: center;
    font-size: ${isK58 ? '10px' : '11.5px'};
    color: #222;
    margin: 1px 0;
  }
  .title {
    font-size: ${isK58 ? '14px' : '16px'};
    font-weight: 800;
    text-align: center;
    text-transform: uppercase;
    margin: 6px 0 2px;
    letter-spacing: .3px;
  }
  .sub-title {
    font-size: ${isK58 ? '10px' : '11px'};
    text-align: center;
    font-style: italic;
    color: #444;
    margin-bottom: 4px;
  }
  .meta-row {
    display: flex;
    justify-content: space-between;
    margin: 2px 0;
    font-size: ${isK58 ? '10.5px' : '12px'};
  }
  .meta-row .label { color: #333; }
  .meta-row .val { font-weight: 600; text-align: right; }
  .item-block {
    margin: 4px 0;
    font-size: ${isK58 ? '11px' : '12px'};
  }
  .item-name { word-break: break-word; }
  .item-calc {
    display: flex;
    justify-content: space-between;
    font-size: ${isK58 ? '10.5px' : '11.5px'};
    color: #333;
    padding-left: 8px;
    margin-top: 1px;
  }
  .item-amt { font-weight: 700; color: #000; }
  .tbl {
    width: 100%;
    border-collapse: collapse;
    margin: 4px 0;
    font-size: ${isK58 ? '10px' : '11.5px'};
  }
  .tbl th, .tbl td {
    padding: 3px 2px;
    border-bottom: 1px dashed #ccc;
    text-align: left;
  }
  .tbl th {
    border-bottom: 1px solid #000;
    font-weight: 700;
  }
  .total-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin: 3px 0;
    font-size: ${isK58 ? '11px' : '12px'};
  }
  .grand-total {
    font-size: ${isK58 ? '14px' : '15.5px'};
    font-weight: 800;
    margin-top: 4px;
  }
  .note {
    font-size: ${isK58 ? '10px' : '11px'};
    font-style: italic;
    margin: 4px 0;
    color: #333;
  }
  .thank-you {
    text-align: center;
    font-weight: 700;
    font-size: ${isK58 ? '11.5px' : '13px'};
    margin: 8px 0 2px;
  }
  .policy {
    text-align: center;
    font-size: ${isK58 ? '9.5px' : '10.5px'};
    font-style: italic;
    color: #444;
    margin: 2px 0 6px;
  }
  .barcode-box { margin-top: 6px; text-align: center; }
</style>
</head>
<body>
  ${storeName ? `<div class="store-name">${esc(storeName)}</div>` : ''}
  ${storeAddress ? `<div class="store-info">${esc(storeAddress)}</div>` : ''}
  ${storePhone ? `<div class="store-info">Hotline: ${esc(storePhone)}</div>` : ''}
  ${taxCode ? `<div class="store-info">MST: ${esc(taxCode)}</div>` : ''}

  <div class="title">${esc(cfg.receiptTitle || 'PHIẾU XUẤT BÁN HÀNG')}</div>
  ${cfg.subTitle ? `<div class="sub-title">${esc(cfg.subTitle)}</div>` : ''}
  <div class="dashed"></div>

  ${cfg.showVoucherNo ? `<div class="meta-row"><span class="label">Số phiếu:</span><span class="val">${esc(doc?.no ?? '---')}</span></div>` : ''}
  ${cfg.showDateTime ? `<div class="meta-row"><span class="label">Ngày lập:</span><span class="val">${esc(dateFormatted)}</span></div>` : ''}
  ${cfg.showCustomer ? `<div class="meta-row"><span class="label">Khách hàng:</span><span class="val">${esc(doc?.partner?.name ?? 'Khách lẻ')}</span></div>` : ''}
  ${cfg.showCustomerPhone && doc?.partner?.phone ? `<div class="meta-row"><span class="label">Điện thoại:</span><span class="val">${esc(doc.partner.phone)}</span></div>` : ''}
  ${cfg.showCustomerAddress && doc?.partner?.address ? `<div class="meta-row"><span class="label">Địa chỉ:</span><span class="val">${esc(doc.partner.address)}</span></div>` : ''}
  ${cfg.showWarehouse && doc?.warehouseOut?.name ? `<div class="meta-row"><span class="label">Kho xuất:</span><span class="val">${esc(doc.warehouseOut.name)}</span></div>` : ''}
  ${cfg.showCashier ? `<div class="meta-row"><span class="label">Thu ngân:</span><span class="val">${esc(cfg.cashierName || doc?.createdBy || 'Admin')}</span></div>` : ''}

  <div class="dashed"></div>
  ${itemsHtml || '<div class="c" style="padding:10px 0;">(Không có hàng hóa)</div>'}
  <div class="dashed"></div>

  ${cfg.showTotalQty ? `<div class="total-row"><span>Tổng số lượng:</span><b>${money(totalQty)} món</b></div>` : ''}
  ${cfg.showGrandTotal ? `<div class="total-row grand-total"><span>TỔNG TIỀN:</span><span>${money(total)} đ</span></div>` : ''}
  ${cfg.showPaymentMethod ? `<div class="total-row"><span>Thanh toán:</span><span>${esc(cfg.paymentMethod || 'Tiền mặt')}</span></div>` : ''}
  ${doc?.note ? `<div class="note">Ghi chú: ${esc(doc.note)}</div>` : ''}

  <div class="dashed"></div>
  ${cfg.thankYouMessage ? `<div class="thank-you">${esc(cfg.thankYouMessage)}</div>` : ''}
  ${cfg.returnPolicy ? `<div class="policy">${esc(cfg.returnPolicy)}</div>` : ''}
  ${barcodeHtml ? `<div class="barcode-box">${barcodeHtml}</div>` : ''}
  ${qrHtml ? `<div class="barcode-box">${qrHtml}</div>` : ''}
</body></html>`;
}

// In phiếu nhiệt trực tiếp qua iframe ẩn
export async function printThermalReceipt(doc, t, customConfig) {
  const company = await resolveCompany();
  const config = customConfig || (await getThermalReceiptConfig());
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const w = frame.contentWindow;
  w.document.open();
  w.document.write(thermalReceiptHtml(doc, t, company, config));
  w.document.close();
  const fire = () => {
    try { w.focus(); w.print(); } finally { setTimeout(() => frame.remove(), 1500); }
  };
  if (frame.contentDocument?.readyState === 'complete') setTimeout(fire, 80);
  else frame.addEventListener('load', () => setTimeout(fire, 80), { once: true });
}

