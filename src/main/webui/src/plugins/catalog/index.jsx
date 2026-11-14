import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../core/i18n.jsx';
import { Loading } from '../../core/ui.jsx';
import Denied from '../../core/Denied.jsx';
import { useConfirm } from '../../core/confirm.jsx';
import {
  suppliersStore, customersStore, warehousesStore, materialTypesStore, materialsStore,
  employeesStore, unitsStore, partnersStore, vnd,
} from '../../core/masterdata.js';
import { useDebounced } from '../../core/useDebounced.js';
import { downloadFile } from '../../core/http.js';
import { apiFetch } from '../../core/api.js';
import MediaUpload from '../../core/MediaUpload.jsx';
import ProductTagPrintModal from '../../core/ProductTagPrintModal.jsx';

const CATS = [
  { id: 'customers', icon: '🧑‍💼', store: customersStore, path: '/customers' },
  { id: 'materials', icon: '📦', store: materialsStore, path: '/materials' },
  { id: 'materialTypes', icon: '🏷️', store: materialTypesStore, path: '/material-types' },
  { id: 'units', icon: '📏', store: unitsStore, path: '/units' },
  { id: 'warehouses', icon: '🏭', store: warehousesStore, path: '/warehouses' },
  { id: 'suppliers', icon: '🚚', store: suppliersStore, path: '/suppliers' },
  { id: 'partners', icon: '🤝', store: partnersStore, path: '/partners' },
  { id: 'employees', icon: '👨‍💼', store: employeesStore, path: '/employees' },
];

const PARTNER_KINDS = [
  { value: 'customer', labelKey: 'cat.kindCustomer' },
  { value: 'supplier', labelKey: 'cat.kindSupplier' },
  { value: 'both', labelKey: 'cat.kindBoth' },
  { value: 'other', labelKey: 'cat.kindOther' },
];

const MATERIAL_KINDS = [
  { value: 'material', labelKey: 'cat.kindMaterial' },
  { value: 'service', labelKey: 'cat.kindService' },
];

const messages = {
  vi: {
    'cat.title': 'Danh mục', 'cat.suppliers': 'Nhà cung cấp', 'cat.customers': 'Khách hàng', 'cat.materials': 'Vật tư / Hàng hóa',
    'cat.materialTypes': 'Nhóm vật tư', 'cat.banks': 'Ngân hàng', 'cat.accounts': 'Tài khoản kế toán', 'cat.warehouses': 'Kho hàng',
    'cat.employees': 'Nhân viên', 'cat.closingEntries': 'Kết chuyển', 'cat.units': 'Đơn vị tính', 'cat.partners': 'Đối tượng', 'cat.departments': 'Phòng ban',
    'cat.code': 'Mã', 'cat.name': 'Tên', 'cat.phone': 'Điện thoại', 'cat.address': 'Địa chỉ',
    'cat.bankCode': 'Mã NH', 'cat.branch': 'Chi nhánh', 'cat.unit': 'Đơn vị tính', 'cat.price': 'Đơn giá', 'cat.type': 'Nhóm vật tư',
    'cat.email': 'Email', 'cat.position': 'Chức vụ', 'cat.department': 'Phòng ban', 'cat.manager': 'Trưởng phòng',
    'cat.fromAccount': 'TK nguồn', 'cat.toAccount': 'TK đích', 'cat.description': 'Diễn giải', 'cat.kind': 'Tính chất / Loại',
    'cat.kindCustomer': 'Khách hàng', 'cat.kindSupplier': 'Nhà cung cấp', 'cat.kindBoth': 'Cả hai', 'cat.kindOther': 'Khác',
    'cat.kindMaterial': 'Vật tư, hàng hóa', 'cat.kindService': 'Dịch vụ (Service)',
    'cat.accCode': 'Số hiệu TK', 'cat.new': 'Thêm mới', 'cat.edit': 'Sửa', 'cat.save': 'Lưu', 'cat.cancel': 'Hủy',
    'cat.empty': 'Chưa có dữ liệu.', 'cat.newType': 'Thêm nhóm vật tư mới',
    'cat.search': 'Tìm theo mã, tên, địa chỉ…', 'cat.all': 'Tất cả', 'cat.clear': 'Xóa bộ lọc',
    'cat.noResult': 'Không có kết quả phù hợp.', 'cat.range': 'Hiển thị {from}–{to} / {total}',
    'cat.priceFrom': 'Giá từ', 'cat.priceTo': 'Giá đến', 'cat.hasPhone': 'Có điện thoại', 'cat.noPhone': 'Chưa có điện thoại',
    'cat.accGroup': 'Nhóm TK', 'cat.image': 'Ảnh minh họa',
    'cat.saving': 'Đang lưu…', 'cat.saveFailed': 'Không thể lưu', 'cat.deleteFailed': 'Không thể xóa', 'cat.loadFailed': 'Không tải được dữ liệu', 'cat.retry': 'Thử lại',
    'cat.perPage': 'Dòng/trang', 'cat.pageOf': 'Trang {p} / {n}', 'cat.first': 'Trang đầu', 'cat.prev': 'Trang trước', 'cat.next': 'Trang sau', 'cat.last': 'Trang cuối',
    'cat.delete': 'Xóa', 'cat.confirmDelete': 'Bạn có chắc muốn xóa "{name}"? Thao tác này không thể hoàn tác.',
    'cat.newGroup': 'Thao tác', 'cat.importFile': 'Import', 'cat.importTitle': 'Import từ file CSV', 'cat.importTemplate': 'Tải file mẫu', 'cat.close': 'Đóng',
    'cat.importHint': 'File CSV (UTF-8, phân tách bằng , hoặc ;). Dòng đầu là tiêu đề cột. Cột: {cols}. Cột bắt buộc: {req}.',
    'cat.importBusy': 'Đang import…', 'cat.importDone': 'Đã import {n} dòng.', 'cat.importErrors': '{n} lỗi (các dòng lỗi được bỏ qua):',
    'cat.errEmpty': 'File trống', 'cat.errRead': 'Không đọc được file', 'cat.errHeader': 'File thiếu cột bắt buộc: {cols}',
    'cat.errLine': 'Dòng {line}: {msg}', 'cat.errRequired': 'Thiếu "{field}"', 'cat.errPrice': 'Đơn giá không hợp lệ',
    'cat.errDup': 'Trùng trong file: "{name}"', 'cat.errNoType': 'Không tìm thấy nhóm vật tư "{name}"',
    'cat.selectAll': 'Chọn tất cả trên trang', 'cat.selectRow': 'Chọn dòng', 'cat.selected': 'Đã chọn {n} dòng', 'cat.clearSel': 'Bỏ chọn',
    'cat.deleteSelected': 'Xóa đã chọn', 'cat.confirmBulkDelete': 'Bạn có chắc muốn xóa {n} dòng đã chọn? Thao tác này không thể hoàn tác.',
    'cat.bulkFailed': 'Không xóa được {n}/{total} dòng',
    'cat.exportExcel': 'Xuất Excel', 'cat.exportFailed': 'Không xuất được Excel',
    'cat.printTags': 'In tem nhãn', 'cat.printSelectedTags': 'In tem đã chọn',
  },
  en: {
    'cat.title': 'Master Data', 'cat.suppliers': 'Suppliers', 'cat.customers': 'Customers', 'cat.materials': 'Materials',
    'cat.materialTypes': 'Item groups', 'cat.banks': 'Banks', 'cat.accounts': 'Accounting Accounts', 'cat.warehouses': 'Warehouses',
    'cat.employees': 'Employees', 'cat.closingEntries': 'Closing entries', 'cat.units': 'Units of measure', 'cat.partners': 'Partners', 'cat.departments': 'Departments',
    'cat.code': 'Code', 'cat.name': 'Name', 'cat.phone': 'Phone', 'cat.address': 'Address',
    'cat.bankCode': 'Bank code', 'cat.branch': 'Branch', 'cat.unit': 'Unit', 'cat.price': 'Price', 'cat.type': 'Item group',
    'cat.email': 'Email', 'cat.position': 'Position', 'cat.department': 'Department', 'cat.manager': 'Manager',
    'cat.fromAccount': 'From account', 'cat.toAccount': 'To account', 'cat.description': 'Description', 'cat.kind': 'Partner type',
    'cat.kindCustomer': 'Customer', 'cat.kindSupplier': 'Supplier', 'cat.kindBoth': 'Both', 'cat.kindOther': 'Other',
    'cat.kindMaterial': 'Material / Goods', 'cat.kindService': 'Service',
    'cat.accCode': 'Account no.', 'cat.new': 'Add new', 'cat.edit': 'Edit', 'cat.save': 'Save', 'cat.cancel': 'Cancel',
    'cat.empty': 'No data yet.', 'cat.newType': 'Add new item group',
    'cat.search': 'Search by code, name, address…', 'cat.all': 'All', 'cat.clear': 'Clear filters',
    'cat.noResult': 'No matching results.', 'cat.range': 'Showing {from}–{to} of {total}',
    'cat.priceFrom': 'Price from', 'cat.priceTo': 'Price to', 'cat.hasPhone': 'Has phone', 'cat.noPhone': 'No phone',
    'cat.accGroup': 'Account group', 'cat.image': 'Image',
    'cat.saving': 'Saving…', 'cat.saveFailed': 'Could not save', 'cat.deleteFailed': 'Could not delete', 'cat.loadFailed': 'Could not load data', 'cat.retry': 'Retry',
    'cat.perPage': 'Rows/page', 'cat.pageOf': 'Page {p} / {n}', 'cat.first': 'First page', 'cat.prev': 'Previous page', 'cat.next': 'Next page', 'cat.last': 'Last page',
    'cat.delete': 'Delete', 'cat.confirmDelete': 'Are you sure you want to delete "{name}"? This cannot be undone.',
    'cat.newGroup': 'Actions', 'cat.importFile': 'Import', 'cat.importTitle': 'Import from CSV', 'cat.importTemplate': 'Download template', 'cat.close': 'Close',
    'cat.importHint': 'CSV file (UTF-8, separated by , or ;). First row is the header. Columns: {cols}. Required: {req}.',
    'cat.importBusy': 'Importing…', 'cat.importDone': 'Imported {n} rows.', 'cat.importErrors': '{n} errors (failed rows were skipped):',
    'cat.errEmpty': 'File is empty', 'cat.errRead': 'Could not read file', 'cat.errHeader': 'Missing required columns: {cols}',
    'cat.errLine': 'Row {line}: {msg}', 'cat.errRequired': '"{field}" is missing', 'cat.errPrice': 'Invalid price',
    'cat.errDup': 'Duplicate in file: "{name}"', 'cat.errNoType': 'Item group "{name}" not found',
    'cat.selectAll': 'Select all on this page', 'cat.selectRow': 'Select row', 'cat.selected': '{n} selected', 'cat.clearSel': 'Clear selection',
    'cat.deleteSelected': 'Delete selected', 'cat.confirmBulkDelete': 'Are you sure you want to delete {n} selected rows? This cannot be undone.',
    'cat.bulkFailed': 'Could not delete {n}/{total} rows',
    'cat.exportExcel': 'Export Excel', 'cat.exportFailed': 'Could not export Excel',
    'cat.printTags': 'Print Tags', 'cat.printSelectedTags': 'Print Selected Tags',
  },
};

/* ---------- Trạng thái tìm kiếm / lọc / sắp xếp / phân trang ---------- */

const NO_FILTERS = {};   // hằng số module để tham chiếu không đổi giữa các lần render
const NO_SELECTION = [];
// selected: id các dòng được tick (giữ khi đổi trang/sắp xếp; xóa khi đổi tìm kiếm/lọc/danh mục)
const EMPTY_VIEW = { q: '', filters: NO_FILTERS, sort: null, page: 1, selected: NO_SELECTION };
const PAGE_SIZES = [5, 10, 20, 50, 100];

// Bộ lọc gửi thẳng lên server dưới dạng query string: ?typeId=..&priceMin=..
//   kind: 'select' (options tĩnh) | 'number' | 'text'
function filtersFor(id, t, types) {
  if (id === 'materials') return [
    { key: 'kind', kind: 'select', label: t('cat.kind'), options: MATERIAL_KINDS.map((k) => ({ value: k.value, label: t(k.labelKey) })) },
    { key: 'typeId', kind: 'select', label: t('cat.type'), options: types.map((x) => ({ value: x.id, label: x.name })) },
    { key: 'priceMin', kind: 'number', label: t('cat.priceFrom') },
    { key: 'priceMax', kind: 'number', label: t('cat.priceTo') },
  ];
  if (id === 'partners') return [
    { key: 'kind', kind: 'select', label: t('cat.kind'), options: PARTNER_KINDS.map((k) => ({ value: k.value, label: t(k.labelKey) })) },
  ];
  if (id === 'suppliers' || id === 'customers') return [
    { key: 'phone', kind: 'select', label: t('cat.phone'),
      options: [{ value: 'has', label: t('cat.hasPhone') }, { value: 'none', label: t('cat.noPhone') }] },
  ];
  if (id === 'warehouses') return [{ key: 'address', kind: 'text', label: t('cat.address') }];
  return []; // materialTypes, units, employees: chỉ tìm kiếm
}

// Trì hoãn giá trị để không gọi API mỗi lần gõ phím (dùng chung: core/useDebounced.js)
// (đã chuyển sang core — xem RULES.md FE-PL16)

/* ---------- Cấu hình cột ---------- */

// sortKey: tên field gửi lên server khi sắp xếp (mặc định = key). Riêng "Loại vật tư" sắp theo tên loại.
function schemaFor(id, t, types) {
  if (id === 'materials') return [
    { key: 'code', label: t('cat.code') },
    { key: 'kind', label: t('cat.kind'),
      display: (it) => (it.kind === 'service' ? '🛎️ ' + t('cat.kindService') : '📦 ' + t('cat.kindMaterial')),
      render: (editing, update) => (
        <select value={editing.kind ?? 'material'} onChange={(e) => update({ kind: e.target.value })}>
          {MATERIAL_KINDS.map((k) => <option key={k.value} value={k.value}>{t(k.labelKey)}</option>)}
        </select>
      ) },
    { key: 'name', label: t('cat.name'), display: (it) => (
      <span className="medianame">
        {it.imageUrl ? <img src={it.imageUrl} alt="" /> : null}{it.name}
      </span>) },
    { key: 'unit', label: t('cat.unit') },
    { key: 'price', label: t('cat.price'), type: 'number', display: (it) => vnd(it.price) },
    { key: 'typeId', label: t('cat.type'), sortKey: 'typeName',
      display: (it) => types.find((x) => x.id === it.typeId)?.name ?? '',
      render: (editing, update) => (
        <div className="typerow">
          <select value={editing.typeId ?? ''} onChange={(e) => update({ typeId: e.target.value })}>
            <option value="">--</option>
            {types.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <button type="button" className="tb" title={t('cat.newType')} onClick={async () => {
            const n = prompt(t('cat.newType') + '?');
            if (n) { try { const created = await materialTypesStore.add({ name: n }); update({ typeId: created.id }); } catch (e) { alert(t('cat.saveFailed') + ': ' + e.message); } }
          }}>➕</button>
        </div>) },
    { key: 'imageUrl', label: t('cat.image'),
      render: (editing, update) => (
        <MediaUpload type="products" value={editing.imageUrl ?? ''} onChange={(url) => update({ imageUrl: url })} />
      ) },
  ];
  if (id === 'materialTypes') return [{ key: 'name', label: t('cat.name') }];
  if (id === 'warehouses') return [{ key: 'code', label: t('cat.code') }, { key: 'name', label: t('cat.name') }, { key: 'address', label: t('cat.address') }];
  if (id === 'employees') return [
    { key: 'code', label: t('cat.code') },
    { key: 'name', label: t('cat.name') },
    { key: 'phone', label: t('cat.phone') },
    { key: 'email', label: t('cat.email') },
    { key: 'position', label: t('cat.position') },
  ];
  if (id === 'units') return [{ key: 'code', label: t('cat.code') }, { key: 'name', label: t('cat.unit') }];
  if (id === 'partners') return [
    { key: 'code', label: t('cat.code') },
    { key: 'name', label: t('cat.name') },
    { key: 'phone', label: t('cat.phone') },
    { key: 'address', label: t('cat.address') },
    { key: 'kind', label: t('cat.kind'),
      display: (it) => t(PARTNER_KINDS.find((k) => k.value === it.kind)?.labelKey ?? 'cat.kindOther'),
      render: (editing, update) => (
        <select value={editing.kind ?? 'other'} onChange={(e) => update({ kind: e.target.value })}>
          {PARTNER_KINDS.map((k) => <option key={k.value} value={k.value}>{t(k.labelKey)}</option>)}
        </select>) },
  ];
  return [{ key: 'code', label: t('cat.code') }, { key: 'name', label: t('cat.name') }, { key: 'phone', label: t('cat.phone') }, { key: 'address', label: t('cat.address') }]; // suppliers/customers
}

/* ---------- Import CSV ---------- */

// Cột CSV cho từng danh mục (tên cột trùng key của bản ghi; riêng vật tư dùng "type" = tên loại vật tư)
const IMPORT_SPEC = {
  suppliers: { cols: ['code', 'name', 'phone', 'address'], required: ['name'], sample: ['NCC001', 'NCC Phong Vũ', '0901234567', 'TP.HCM'] },
  customers: { cols: ['code', 'name', 'phone', 'address'], required: ['name'], sample: ['KH001', 'Công ty TNHH ABC', '0907654321', 'Hà Nội'] },
  warehouses: { cols: ['code', 'name', 'address'], required: ['name'], sample: ['KHO001', 'Kho trung tâm', 'TP.HCM'] },
  materials: { cols: ['code', 'name', 'unit', 'price', 'type', 'kind'], required: ['name'], sample: ['VT001', 'Bàn phím cơ', 'cái', '700000', 'Phụ kiện', 'material'] },
  materialTypes: { cols: ['name'], required: ['name'], sample: ['Phụ kiện'] },
  employees: { cols: ['code', 'name', 'phone', 'email', 'position'], required: ['name'], sample: ['NV001', 'Nguyễn Văn A', '0901234567', 'a@congty.vn', 'Nhân viên kinh doanh'] },
  units: { cols: ['code', 'name'], required: ['name'], sample: ['DVT001', 'Cái'] },
  partners: { cols: ['code', 'name', 'phone', 'address', 'kind'], required: ['name'], sample: ['DT001', 'Công ty ABC', '0901234567', 'TP.HCM', 'customer'] },
};

// Chuyển tên cột CSV snake_case sang field của entity (from_account -> fromAccount)
const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

const norm = (s) => (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'd').replace(/\s+/g, ' ').toLowerCase().trim();

const csvEsc = (v) => (/[",;\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);

function downloadTemplate(catId) {
  const spec = IMPORT_SPEC[catId];
  const text = [spec.cols.join(','), spec.sample.map(csvEsc).join(',')].join('\r\n');
  const blob = new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'catalog-' + catId + '-template.csv';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// Parser CSV nhỏ: hỗ trợ dấu ngoặc kép, dấu phân cách , hoặc ; (Excel tiếng Việt hay xuất ;)
function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/, 1)[0];
  const delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

const parseNum = (v) => {
  const x = String(v ?? '').trim().replace(/\s/g, '');
  if (x === '') return NaN;
  return Number(/^\d{1,3}([.,]\d{3})+$/.test(x) ? x.replace(/[.,]/g, '') : x.replace(',', '.'));   // 700.000 -> 700000
};

// Trả về { ok, errors }. Dòng lỗi bị bỏ qua, các dòng hợp lệ vẫn được thêm.
async function importRows(text, { catId, path, types, can, t }) {
  const spec = IMPORT_SPEC[catId];
  const rows = parseCsv(text);
  if (!rows.length) return { ok: 0, errors: [t('cat.errEmpty')] };
  const head = rows[0].map((h) => norm(h));
  const idx = Object.fromEntries(spec.cols.map((c) => [c, head.indexOf(c)]));
  const missing = spec.required.filter((c) => idx[c] < 0);
  if (missing.length) return { ok: 0, errors: [t('cat.errHeader').replace('{cols}', missing.join(', '))] };
  const cell = (r, c) => (idx[c] >= 0 ? (r[idx[c]] ?? '').trim() : '');

  const errors = [];
  const err = (line, msg) => errors.push(t('cat.errLine').replace('{line}', line).replace('{msg}', msg));
  const typeCache = [...types];            // loại vật tư đã biết (kể cả loại vừa tự tạo trong lúc import)
  const seen = new Set();                  // chống trùng ngay trong file
  let ok = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 1;
    const rec = {};
    spec.cols.forEach((c) => { if (c !== 'type' && idx[c] >= 0) rec[camel(c)] = cell(r, c); });

    const lack = spec.required.find((c) => !cell(r, c));
    if (lack) { err(line, t('cat.errRequired').replace('{field}', lack)); continue; }

    const key = norm(rec.code || rec.name);
    if (seen.has(key)) { err(line, t('cat.errDup').replace('{name}', rec.code || rec.name)); continue; }

    if (catId === 'materials') {
      const raw = cell(r, 'price');
      const price = raw === '' ? 0 : parseNum(raw);
      if (!(price >= 0)) { err(line, t('cat.errPrice')); continue; }
      rec.price = price;
      const typeName = cell(r, 'type');
      rec.typeId = null;
      if (typeName) {
        let ty = typeCache.find((x) => norm(x.name) === norm(typeName));
        if (!ty) {
          if (!can('catalog', 'create')) { err(line, t('cat.errNoType').replace('{name}', typeName)); continue; }
          try { ty = await materialTypesStore.add({ name: typeName }); typeCache.push(ty); }
          catch (e) { err(line, e?.message ?? String(e)); continue; }
        }
        rec.typeId = ty.id;
      }
    }

    try { await apiFetch('/api' + path + '/import', { method: 'POST', body: [rec] }); seen.add(key); ok++; }
    catch (e) { err(line, e?.message ?? String(e)); }
  }
  return { ok, errors };
}

/* ---------- CSS riêng của plugin (có thể chuyển sang file style chung) ---------- */

const CSS = `
.invtable.zebra tbody tr:nth-child(even) { background: rgba(128,128,128,.09); }
.invtable.zebra tbody tr:hover { background: rgba(15,108,189,.10); }
.selcol { width: 32px; text-align: center; }
.invtable tr.sel td { background: rgba(15,108,189,.16); }
.bulkbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 8px 0; padding: 8px 12px; border-radius: 6px; background: rgba(15,108,189,.12); }
.importbox { margin: 8px 0 12px; padding: 12px 14px; border: 1px dashed var(--border, #d0d5dd); border-radius: 8px; }
.importhead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.importhint { margin: 0 0 10px; font-size: 12.5px; color: var(--muted, #667085); }
.importacts { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.importres { margin-top: 10px; font-size: 13px; }
.importerr { margin: 6px 0 0; padding-left: 18px; color: #b42318; max-height: 160px; overflow: auto; }
`;

/* ---------- Giao diện ---------- */

function Menu({ state, setState }) {
  const { t } = useI18n();
  return (<>
    <h3>{t('cat.title')}</h3>
    {CATS.map((c) => (
      <button key={c.id} className={'item' + (state.category === c.id ? ' on' : '')}
        // Đổi danh mục -> reset tìm kiếm / bộ lọc / sắp xếp / trang / lựa chọn vì mỗi danh mục có cột khác nhau
        onClick={() => setState({ category: c.id, editing: null, error: null, importing: false, ...EMPTY_VIEW })}>{c.icon} {t('cat.' + c.id)}</button>
    ))}
  </>);
}

// Ribbon của Danh mục: Thêm mới (form trống) + Import. (Bản cũ copy từ Nhập xuất kho nên gọi blankDoc không tồn tại.)
const ribbon = ({ setState, can }) => ({
  tabs: [{ id: 'catalog', title: 'cat.title', groups: [{ id: 'actions', title: 'cat.newGroup', items: [
    { id: 'cat-new', icon: '➕', label: 'cat.new', disabled: !can('catalog', 'create'), onClick: () => setState({ editing: {}, error: null, importing: false }) },
    { id: 'cat-import', icon: '📂', label: 'cat.importFile', disabled: !can('catalog', 'import'), onClick: () => setState({ editing: null, importing: true }) },
  ] }] }],
});

// Checkbox "chọn tất cả" có trạng thái lưng chừng (indeterminate)
function HeaderCheck({ checked, indeterminate, onChange, label, disabled }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate && !checked; }, [indeterminate, checked]);
  return <input ref={ref} type="checkbox" checked={checked} disabled={disabled} onChange={onChange} aria-label={label} title={label} />;
}

function Toolbar({ state, setState, filterDefs, countLabel, fetching }) {
  const { t } = useI18n();
  const q = state.q ?? '';
  const filters = state.filters ?? NO_FILTERS;
  const active = !!q || filterDefs.some((f) => filters[f.key] !== undefined && filters[f.key] !== '');
  // Đổi tìm kiếm/lọc thì bỏ lựa chọn, tránh xóa nhầm các dòng không còn nhìn thấy
  const setFilter = (key, value) => setState({ filters: { ...filters, [key]: value }, page: 1, selected: NO_SELECTION }, { replace: true });

  return (
    <div className="cattools">
      <div className="searchbox">
        <span aria-hidden="true">🔍</span>
        <input type="search" value={q} placeholder={t('cat.search')} aria-label={t('cat.search')}
          onChange={(e) => setState({ q: e.target.value, page: 1, selected: NO_SELECTION }, { replace: true })} />
        {q && <button type="button" className="xbtn" title={t('cat.clear')} onClick={() => setState({ q: '', page: 1, selected: NO_SELECTION }, { replace: true })}>✕</button>}
      </div>

      {filterDefs.map((f) => (
        <label key={f.key} className="filter">
          <span>{f.label}</span>
          {f.kind === 'select' ? (
            <select value={filters[f.key] ?? ''} onChange={(e) => setFilter(f.key, e.target.value)}>
              <option value="">{t('cat.all')}</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input type={f.kind === 'number' ? 'number' : 'text'} min={f.kind === 'number' ? '0' : undefined}
              value={filters[f.key] ?? ''} onChange={(e) => setFilter(f.key, e.target.value)} />
          )}
        </label>
      ))}

      {active && <button type="button" className="tb" onClick={() => setState(EMPTY_VIEW, { replace: true })}>✕ {t('cat.clear')}</button>}
      <span className="catcount" aria-live="polite">{fetching ? '⏳ ' : ''}{countLabel}</span>
    </div>
  );
}

function Pager({ page, totalPages, pageSize, setState }) {
  const { t } = useI18n();
  const go = (p) => setState({ page: Math.min(Math.max(1, p), totalPages) }, { replace: true });
  return (
    <div className="pager">
      <label className="filter perpage">
        <span>{t('cat.perPage')}</span>
        <select value={pageSize} onChange={(e) => setState({ pageSize: +e.target.value, page: 1 }, { replace: true })}>
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <div className="pagenav">
        <button type="button" className="tb" title={t('cat.first')} aria-label={t('cat.first')} disabled={page <= 1} onClick={() => go(1)}>⏮</button>
        <button type="button" className="tb" title={t('cat.prev')} aria-label={t('cat.prev')} disabled={page <= 1} onClick={() => go(page - 1)}>◀</button>
        <span className="pageinfo" aria-live="polite">{t('cat.pageOf').replace('{p}', page).replace('{n}', totalPages)}</span>
        <button type="button" className="tb" title={t('cat.next')} aria-label={t('cat.next')} disabled={page >= totalPages} onClick={() => go(page + 1)}>▶</button>
        <button type="button" className="tb" title={t('cat.last')} aria-label={t('cat.last')} disabled={page >= totalPages} onClick={() => go(totalPages)}>⏭</button>
      </div>
    </div>
  );
}

// Toàn bộ hook nằm ở đây; View chỉ kiểm tra quyền rồi mới mount Body (nên không vi phạm thứ tự hook).
function Body({ state, setState, can }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const cat = CATS.find((c) => c.id === state.category);
  const types = materialTypesStore.use().items;   // danh sách nhỏ, tải đủ để đổ dropdown và hiển thị tên nhóm
  const [imp, setImp] = useState({ busy: false, result: null, key: 0 });
  const [exporting, setExporting] = useState(false);
  const [tagPrintItems, setTagPrintItems] = useState(null);

  const q = state.q ?? '';
  const filters = state.filters ?? NO_FILTERS;
  const sort = state.sort ?? null;
  const pageSize = state.pageSize ?? PAGE_SIZES[1];
  const page = Math.max(1, state.page ?? 1);

  // Debounce tìm kiếm + bộ lọc (so sánh bằng chuỗi nên không lệch tham chiếu).
  // Trong lúc chờ debounce thì hoãn gọi API (enabled=false) để không bắn request thừa khi vừa gõ vừa về trang 1.
  const critKey = JSON.stringify({ q, filters });
  const settledKey = useDebounced(critKey, 300);
  const settled = JSON.parse(settledKey);
  const { items, total, loading, fetching, error: loadError, reload } = cat.store.useQuery(
    { q: settled.q, filters: settled.filters, page, pageSize, sort },
    { enabled: critKey === settledKey },
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Nếu xóa hết dòng ở trang cuối (hoặc dữ liệu co lại) thì lùi về trang cuối còn dữ liệu
  useEffect(() => {
    if (!fetching && total > 0 && page > totalPages) setState({ page: totalPages }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetching, total, page, totalPages]);

  if (loading) return <Loading />;

  const schema = schemaFor(cat.id, t, types);
  const filterDefs = filtersFor(cat.id, t, types);
  const editing = state.editing;

  if (editing) {
    const savePerm = editing.id ? can('catalog', 'update') : can('catalog', 'create');
    return (
      <div className="pad">
        <h2>{editing.id ? t('cat.edit') : t('cat.new')} — {t('cat.' + cat.id)}</h2>
        <div className="invmaster">
          {schema.map((f) => (
            <label key={f.key}>{f.label}
              {f.render ? f.render(editing, (patch) => setState({ editing: { ...editing, ...patch } }, { replace: true }))
                : <input type={f.type ?? 'text'} value={editing[f.key] ?? ''}
                    onChange={(e) => setState({ editing: { ...editing, [f.key]: f.type === 'number' ? (+e.target.value || 0) : e.target.value } }, { replace: true })} />}
            </label>
          ))}
        </div>
        {state.error && <p className="formError" role="alert">{t('cat.saveFailed')}: {state.error}</p>}
        <div className="formActions">
          <button className="btn" disabled={!savePerm || state.saving} onClick={async () => {
            setState({ saving: true, error: null }, { replace: true });
            try {
              if (editing.id) await cat.store.update(editing.id, editing); else await cat.store.add(editing);
              setState({ editing: null, saving: false });
            } catch (e) {
              setState({ saving: false, error: e.message }, { replace: true });   // giữ nguyên form để người dùng sửa lại
            }
          }}>{state.saving ? t('cat.saving') : t('cat.save')}</button>
          <button className="tb" disabled={state.saving} onClick={() => setState({ editing: null, error: null })}>{t('cat.cancel')}</button>
        </div>
      </div>
    );
  }

  // Bấm tiêu đề cột: tăng dần -> giảm dần -> bỏ sắp xếp (server sắp xếp trên toàn bộ dữ liệu)
  const toggleSort = (key) => {
    const next = !sort || sort.key !== key ? { key, dir: 'asc' } : sort.dir === 'asc' ? { key, dir: 'desc' } : null;
    setState({ sort: next, page: 1 }, { replace: true });
  };

  // ----- Chọn nhiều + xóa hàng loạt -----
  // Dữ liệu phân trang trên server nên chỉ chọn được các dòng đang hiển thị; lựa chọn được giữ khi đổi trang/sắp xếp.
  const canDelete = can('catalog', 'delete');
  const busy = !!state.bulkBusy;
  const selSet = new Set(state.selected ?? NO_SELECTION);
  const pageIds = items.map((it) => it.id);
  const pageAllSelected = items.length > 0 && pageIds.every((id) => selSet.has(id));
  const pageSomeSelected = pageIds.some((id) => selSet.has(id));
  const setSel = (ids) => setState({ selected: ids }, { replace: true });
  const toggleOne = (id) => setSel(selSet.has(id) ? [...selSet].filter((x) => x !== id) : [...selSet, id]);
  const togglePage = () => setSel(pageAllSelected
    ? [...selSet].filter((x) => !pageIds.includes(x))
    : [...new Set([...selSet, ...pageIds])]);

  const onBulkDelete = async () => {
    const ids = [...selSet];
    if (!ids.length) return;
    if (!(await confirm(t('cat.confirmBulkDelete').replace('{n}', ids.length)))) return;
    setState({ bulkBusy: true, error: null }, { replace: true });
    const failed = [];
    let firstMsg = '';
    for (const id of ids) {   // lần lượt từng dòng để không dồn request lên server
      try { await cat.store.remove(id); }
      catch (e) { failed.push(id); firstMsg = firstMsg || (e?.message ?? String(e)); }
    }
    setState({
      bulkBusy: false,
      selected: failed,   // dòng xóa lỗi vẫn được giữ chọn để thử lại
      error: failed.length
        ? t('cat.bulkFailed').replace('{n}', failed.length).replace('{total}', ids.length) + ': ' + firstMsg
        : null,
    }, { replace: true });
    reload();
  };

  // ----- Xuất Excel -----
  // Server trả toàn bộ danh mục (không phân trang) dưới dạng .xlsx; tải bằng cookie phiên.
  const onExportExcel = async () => {
    setExporting(true);
    setState({ error: null }, { replace: true });
    try {
      await downloadFile(`/master/${cat.id}/export-excel`, `master-${cat.id}.xlsx`);
    } catch (e) {
      setState({ error: t('cat.exportFailed') + ': ' + e.message }, { replace: true });
    } finally {
      setExporting(false);
    }
  };

  // ----- Import -----
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImp((s) => ({ ...s, busy: true, result: null }));
    let result;
    try { result = await importRows(await file.text(), { catId: cat.id, path: cat.path, types, can, t }); }
    catch (err) { result = { ok: 0, errors: [t('cat.errRead') + ': ' + (err?.message ?? err)] }; }
    setImp((s) => ({ busy: false, result, key: s.key + 1 }));   // đổi key để chọn lại cùng 1 file vẫn chạy
    if (result.ok) { setState({ ...EMPTY_VIEW }, { replace: true }); reload(); }
  };

  const from = (page - 1) * pageSize + 1;
  const countLabel = total
    ? t('cat.range').replace('{from}', from).replace('{to}', from + items.length - 1).replace('{total}', total)
    : '';
  const hasCriteria = !!q || Object.values(filters).some((v) => v !== '' && v != null);
  const spec = IMPORT_SPEC[cat.id];

  return (
    <div className="pad">
      <div className="ghead">
        <h2>{t('cat.' + cat.id)}</h2>
        <div>
          {cat.id === 'materials' && items.length > 0 && (
            <button
              type="button"
              className="tb"
              title="In tem nhãn mã vạch + QR"
              onClick={() => {
                const toPrint = selSet.size > 0
                  ? items.filter((it) => selSet.has(it.id))
                  : items;
                setTagPrintItems(toPrint);
              }}
            >
              🏷️ {t('cat.printTags')}
            </button>
          )}{' '}
          {can('catalog', 'export') && (
            <button className="tb" disabled={exporting} onClick={onExportExcel}>
              {exporting ? '⏳' : '⬇'} {t('cat.exportExcel')}
            </button>
          )}{' '}
          {can('catalog', 'import') && (
            <button className="tb" onClick={() => setState({ importing: !state.importing }, { replace: true })}>📂 {t('cat.importFile')}</button>
          )}{' '}
          {can('catalog', 'create') && <button className="tb" onClick={() => setState({ editing: {}, error: null })}>➕ {t('cat.new')}</button>}
        </div>
      </div>

      {state.importing && can('catalog', 'import') && (
        <div className="importbox">
          <div className="importhead">
            <b>{t('cat.importTitle')} — {t('cat.' + cat.id)}</b>
            <button type="button" className="xbtn" title={t('cat.close')} aria-label={t('cat.close')} onClick={() => setState({ importing: false }, { replace: true })}>✕</button>
          </div>
          <p className="importhint">{t('cat.importHint').replace('{cols}', spec.cols.join(', ')).replace('{req}', spec.required.join(', '))}</p>
          <div className="importacts">
            <input key={imp.key} type="file" accept=".csv,text/csv" disabled={imp.busy} onChange={onFile} />
            <button type="button" className="tb" onClick={() => downloadTemplate(cat.id)}>⬇ {t('cat.importTemplate')}</button>
            {imp.busy && <span>⏳ {t('cat.importBusy')}</span>}
          </div>
          {imp.result && (
            <div className="importres" role="status">
              {imp.result.ok > 0 && <div>✅ {t('cat.importDone').replace('{n}', imp.result.ok)}</div>}
              {imp.result.errors.length > 0 && (<>
                <div>⚠️ {t('cat.importErrors').replace('{n}', imp.result.errors.length)}</div>
                <ul className="importerr">{imp.result.errors.map((m, i) => <li key={i}>{m}</li>)}</ul>
              </>)}
            </div>
          )}
        </div>
      )}

      {state.error && <p className="formError" role="alert">{state.error}</p>}
      {loadError && (
        <p className="formError" role="alert">
          {t('cat.loadFailed')}: {loadError.message} <button type="button" className="tb" onClick={reload}>{t('cat.retry')}</button>
        </p>
      )}

      <Toolbar state={state} setState={setState} filterDefs={filterDefs} countLabel={countLabel} fetching={fetching} />

      {selSet.size > 0 && (
        <div className="bulkbar" role="status">
          <b>{t('cat.selected').replace('{n}', selSet.size)}</b>
          <button type="button" className="tb" disabled={busy} onClick={() => setSel([])}>{t('cat.clearSel')}</button>
          {cat.id === 'materials' && (
            <button
              type="button"
              className="tb"
              disabled={busy}
              onClick={() => {
                const selectedItems = items.filter((it) => selSet.has(it.id));
                if (selectedItems.length) setTagPrintItems(selectedItems);
              }}
            >
              🏷️ {t('cat.printSelectedTags')} ({selSet.size})
            </button>
          )}
          <button type="button" className="tb" disabled={busy} onClick={onBulkDelete}>
            {busy ? '⏳ ' : '🗑 '}{t('cat.deleteSelected')} ({selSet.size})
          </button>
        </div>
      )}

      <table className={'invtable zebra' + (fetching ? ' fetching' : '')} aria-busy={fetching}>
        <thead>
          <tr>
            {canDelete && (
              <th className="selcol">
                <HeaderCheck checked={pageAllSelected} indeterminate={pageSomeSelected} disabled={busy || !items.length}
                  onChange={togglePage} label={t('cat.selectAll')} />
              </th>
            )}
            {schema.map((f) => {
              const sk = f.sortKey ?? f.key;
              const on = sort?.key === sk;
              return (
                <th key={f.key} className="sortable" aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className="thbtn" onClick={() => toggleSort(sk)}>
                    {f.label}<span className="sortmark">{on ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
                  </button>
                </th>
              );
            })}
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className={[state.busyId === it.id ? 'busy' : '', selSet.has(it.id) ? 'sel' : ''].join(' ').trim() || undefined} aria-busy={state.busyId === it.id}>
              {canDelete && (
                <td className="selcol">
                  <input type="checkbox" checked={selSet.has(it.id)} disabled={busy} onChange={() => toggleOne(it.id)}
                    aria-label={t('cat.selectRow') + ' ' + (it.name || it.code || '')} />
                </td>
              )}
              {schema.map((f) => <td key={f.key}>{f.display ? f.display(it) : it[f.key]}</td>)}
              <td>
                {cat.id === 'materials' && (
                  <button
                    type="button"
                    className="xbtn"
                    title={t('cat.printTags')}
                    aria-label={t('cat.printTags')}
                    onClick={() => setTagPrintItems([it])}
                  >
                    🏷️
                  </button>
                )}
                {can('catalog', 'update') && <button className="xbtn" onClick={() => setState({ editing: { ...it }, error: null })}>✏️</button>}
                {canDelete && (
                  <button className="xbtn" disabled={busy || state.busyId === it.id} title={t('cat.delete')} aria-label={t('cat.delete')} onClick={async () => {
                    const label = it.name || it.code || '';
                    if (!(await confirm(t('cat.confirmDelete').replace('{name}', label)))) return;
                    setState({ busyId: it.id, error: null }, { replace: true });
                    try {
                      await cat.store.remove(it.id);
                      setState({ busyId: null, selected: [...selSet].filter((x) => x !== it.id) }, { replace: true });
                    } catch (e) {
                      setState({ busyId: null, error: t('cat.deleteFailed') + ': ' + e.message }, { replace: true });
                    }
                  }}>🗑</button>
                )}
              </td>
            </tr>
          ))}
          {!items.length && !fetching && (
            <tr><td colSpan={schema.length + 1 + (canDelete ? 1 : 0)} className="empty">
              {loadError ? t('cat.loadFailed') : hasCriteria ? t('cat.noResult') : t('cat.empty')}
            </td></tr>
          )}
        </tbody>
      </table>

      {total > 0 && <Pager page={page} totalPages={totalPages} pageSize={pageSize} setState={setState} />}

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

function View(props) {
  if (!props.can('catalog', 'read')) return <Denied />;
  // key theo danh mục: đổi danh mục thì mount lại Body, không lẫn dữ liệu giữa các danh mục
  return (<>
    <style>{CSS}</style>
    <Body key={props.state.category} {...props} />
  </>);
}

export default { id: 'catalog', title: 'cat.title', icon: '🗂️', order: 3, messages,
  initialState: { category: 'customers', editing: null, saving: false, error: null, busyId: null, bulkBusy: false, importing: false, pageSize: 5, ...EMPTY_VIEW },
  Menu, ribbon, View };

/* ---------- CSS gợi ý (thêm vào file style chung của app) ----------

.cattools { display: flex; flex-wrap: wrap; align-items: end; gap: 10px 14px; margin: 8px 0 12px; }
.searchbox { display: flex; align-items: center; gap: 6px; min-width: 240px; flex: 1 1 260px; max-width: 420px;
  padding: 4px 8px; border: 1px solid var(--border, #d0d5dd); border-radius: 6px; background: var(--bg, #fff); }
.searchbox input { flex: 1; border: 0; outline: 0; background: transparent; font: inherit; padding: 4px 0; }
.searchbox:focus-within { border-color: var(--accent, #0f6cbd); box-shadow: 0 0 0 2px rgba(15,108,189,.2); }
.filter { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: var(--muted, #667085); }
.filter select, .filter input { font: inherit; font-size: 13px; padding: 4px 6px; min-width: 120px; }
.catcount { margin-left: auto; font-size: 12px; color: var(--muted, #667085); }
.invtable th.sortable { padding: 0; }
.thbtn { all: unset; box-sizing: border-box; display: block; width: 100%; padding: 6px 8px; cursor: pointer; font-weight: inherit; }
.thbtn:hover, .thbtn:focus-visible { background: rgba(0,0,0,.05); }
.sortmark { font-size: 10px; }
.pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-top: 10px; }
.pagenav { display: flex; align-items: center; gap: 6px; }
.pagenav .tb:disabled { opacity: .4; cursor: default; }
.pageinfo { min-width: 90px; text-align: center; font-size: 13px; }
.perpage { flex-direction: row; align-items: center; gap: 6px; }
.formError { margin: 8px 0; padding: 8px 10px; border-radius: 6px; background: #fdecea; color: #b42318; font-size: 13px; }
.invtable tr.busy { opacity: .5; pointer-events: none; }
.invtable.fetching { opacity: .6; transition: opacity .15s; }

*/