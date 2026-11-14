import { useRef, useState } from 'react';
import { useI18n } from '../../core/i18n.jsx';
import { Loading } from '../../core/ui.jsx';
import Denied from '../../core/Denied.jsx';
import { useConfirm } from '../../core/confirm.jsx';
import { useDebounced } from '../../core/useDebounced.js';
import { downloadFile, uploadFile } from '../../core/http.js';
import {
  openingBalancesStore, materialsStore, warehousesStore, accountsStore, vnd, formatDate,
} from '../../core/masterdata.js';

/* ---------- Tồn kho đầu kỳ & Tồn quỹ đầu kỳ ---------- */

const CATS = [
  { id: 'material', icon: '📦' },
  { id: 'cash', icon: '💵' },
];

const DEFAULT_DIRECTION = {
  material: 'debit',
  cash: 'debit',
};

const FIELDS = {
  material: [
    { key: 'date', type: 'date', required: true },
    { key: 'warehouseId', type: 'warehouse', required: true },
    { key: 'materialId', type: 'material', required: true },
    { key: 'quantity', type: 'quantity', required: true },
    { key: 'unitPrice', type: 'money', required: true },
    { key: 'name', type: 'text' },
  ],
  cash: [
    { key: 'date', type: 'date', required: true },
    { key: 'accountId', type: 'account', required: true },
    { key: 'amount', type: 'money', required: true },
    { key: 'name', type: 'text' },
  ],
};

const COLS = {
  material: ['code', 'date', 'warehouseId', 'materialId', 'quantity', 'unitPrice', 'amount', 'name'],
  cash: ['code', 'date', 'accountId', 'amount', 'name'],
};

const LABELS = {
  code: 'open.code', date: 'open.date', warehouseId: 'open.warehouse', name: 'open.name', amount: 'open.amount', quantity: 'open.quantity',
  unitPrice: 'open.unitPrice', materialId: 'open.materialName', accountId: 'open.cashAccount',
};

const NUMERIC = new Set(['quantity', 'unitPrice', 'amount']);

const messages = {
  vi: {
    'open.title': 'Số dư & Tồn kho đầu kỳ',
    'open.material': 'Vật tư, hàng hóa',
    'open.cash': 'Tồn quỹ đầu kỳ',
    'open.code': 'Mã', 'open.date': 'Ngày', 'open.warehouse': 'Kho', 'open.name': 'Diễn giải',
    'open.amount': 'Số tiền', 'open.quantity': 'Số lượng',
    'open.unitPrice': 'Đơn giá', 'open.materialName': 'Vật tư, hàng hóa',
    'open.cashAccount': 'Tài khoản quỹ',
    'open.accountSelect': '-- Chọn tài khoản quỹ --', 'open.allAccounts': 'Tất cả tài khoản quỹ',
    'open.warehouseSelect': '-- Chọn kho --', 'open.allWarehouses': 'Tất cả các kho',
    'open.exportExcel': 'Xuất Excel', 'open.templateExcel': 'Tải file mẫu', 'open.importExcel': 'Import Excel',
    'open.importTitle': 'Import tồn kho đầu kỳ từ file Excel / CSV',
    'open.importHint': 'Chọn tệp Excel (.xlsx) hoặc CSV (UTF-8). Cột bắt buộc: Mã vật tư, Mã kho, Số lượng, Đơn giá. Hệ thống sử dụng cặp (Mã vật tư, Mã kho) làm khoá duy nhất để thay thế (replace) số liệu, cho phép import nhiều lần mà không sợ trùng lặp.',
    'open.importTitleCash': 'Import tồn quỹ đầu kỳ từ file Excel / CSV',
    'open.importHintCash': 'Chọn tệp Excel (.xlsx) hoặc CSV (UTF-8). Cột bắt buộc: Mã tài khoản quỹ, Số tiền. Hệ thống sử dụng Mã tài khoản làm khoá duy nhất để thay thế (replace) số liệu, cho phép import nhiều lần mà không sợ trùng lặp.',
    'open.importBusy': 'Đang xử lý import…',
    'open.importDone': 'Đã import thành công {ok} dòng ({created} thêm mới, {updated} cập nhật).',
    'open.importErrors': '{n} lỗi cần khắc phục:',
    'open.selectFile': 'Chọn tệp…', 'open.close': 'Đóng',
    'open.new': 'Thêm mới', 'open.edit': 'Sửa', 'open.save': 'Lưu', 'open.cancel': 'Hủy', 'open.delete': 'Xóa',
    'open.saving': 'Đang lưu…', 'open.search': 'Tìm theo mã, diễn giải…', 'open.all': 'Tất cả',
    'open.clear': 'Xóa bộ lọc', 'open.empty': 'Chưa có dữ liệu tồn kho đầu kỳ.',
    'open.emptyCash': 'Chưa có dữ liệu tồn quỹ đầu kỳ.',
    'open.noResult': 'Không có kết quả phù hợp.',
    'open.loadFailed': 'Không tải được dữ liệu', 'open.saveFailed': 'Không thể lưu', 'open.retry': 'Thử lại',
    'open.confirmDelete': 'Bạn có chắc muốn xóa "{name}"? Thao tác này không thể hoàn tác.',
    'open.required': '{field} không được để trống.', 'open.total': 'Tổng cộng', 'open.entries': 'bản ghi',
    'open.pageOf': 'Trang {p} / {n}', 'open.prev': 'Trang trước', 'open.next': 'Trang sau',
  },
  en: {
    'open.title': 'Opening Balances & Inventory',
    'open.material': 'Inventory & Products',
    'open.cash': 'Opening Cash Fund',
    'open.code': 'Code', 'open.date': 'Date', 'open.warehouse': 'Warehouse', 'open.name': 'Description',
    'open.amount': 'Amount', 'open.quantity': 'Quantity',
    'open.unitPrice': 'Unit price', 'open.materialName': 'Product / Material',
    'open.cashAccount': 'Cash Account',
    'open.accountSelect': '-- Select cash account --', 'open.allAccounts': 'All cash accounts',
    'open.warehouseSelect': '-- Select warehouse --', 'open.allWarehouses': 'All warehouses',
    'open.exportExcel': 'Export Excel', 'open.templateExcel': 'Download template', 'open.importExcel': 'Import Excel',
    'open.importTitle': 'Import opening balances from Excel / CSV',
    'open.importHint': 'Select Excel (.xlsx) or CSV (UTF-8). Required: Material Code, Warehouse Code, Quantity, Unit Price. The composite key (Material Code, Warehouse Code) is used to replace opening balances, allowing safe multiple imports without duplicates.',
    'open.importTitleCash': 'Import opening cash fund from Excel / CSV',
    'open.importHintCash': 'Select Excel (.xlsx) or CSV (UTF-8). Required: Cash Account Code, Amount. The composite key (Account Code) is used to replace opening balances, allowing safe multiple imports without duplicates.',
    'open.importBusy': 'Processing import…',
    'open.importDone': 'Successfully imported {ok} rows ({created} created, {updated} updated).',
    'open.importErrors': '{n} errors to resolve:',
    'open.selectFile': 'Choose file…', 'open.close': 'Close',
    'open.new': 'New', 'open.edit': 'Edit', 'open.save': 'Save', 'open.cancel': 'Cancel', 'open.delete': 'Delete',
    'open.saving': 'Saving…', 'open.search': 'Search by code or description…', 'open.all': 'All',
    'open.clear': 'Clear filters', 'open.empty': 'No opening inventory data.',
    'open.emptyCash': 'No opening cash data.',
    'open.noResult': 'No matching results.',
    'open.loadFailed': 'Could not load data', 'open.saveFailed': 'Could not save', 'open.retry': 'Retry',
    'open.confirmDelete': 'Delete "{name}"? This cannot be undone.',
    'open.required': '{field} is required.', 'open.total': 'Total', 'open.entries': 'entries',
    'open.pageOf': 'Page {p} / {n}', 'open.prev': 'Previous page', 'open.next': 'Next page',
  },
};

const CSS = `
.invtable td.num { text-align: right; white-space: nowrap; }
.invtable tbody tr:hover { background: rgba(15,108,189,.08); }
.invtable td.acts { white-space: nowrap; text-align: right; }
.openform { max-width: 720px; }
.formError { margin: 8px 0; padding: 8px 10px; border-radius: 6px; background: #fdecea; color: #b42318; font-size: 13px; }
.importbox { margin: 8px 0 14px; padding: 12px 16px; border: 1px dashed var(--border, #d0d5dd); border-radius: 8px; background: rgba(15,108,189,.04); }
.importhead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.importhint { margin: 0 0 10px; font-size: 12.5px; color: var(--muted, #667085); line-height: 1.5; }
.importacts { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.importres { margin-top: 10px; font-size: 13px; }
.importerr { margin: 6px 0 0; padding-left: 18px; color: #b42318; max-height: 160px; overflow: auto; }
`;

/* ---------- tiện ích ---------- */

const findName = (list, id) => {
  const x = list.find((i) => i.id === id);
  return x ? `${x.code ? x.code + ' - ' : ''}${x.name}` : '';
};

const isEmpty = (v) => v == null || v === '' || (typeof v === 'number' && v <= 0);

function missingField(form, fields) {
  return fields.find((f) => f.required && isEmpty(form[f.key])) ?? null;
}

/* ---------- sub-navigation ---------- */

function Menu({ state, setState }) {
  const { t } = useI18n();
  return (
    <>
      <h3>{t('open.title')}</h3>
      {CATS.map((c) => (
        <button key={c.id} className={'item' + (state.kind === c.id ? ' on' : '')}
          onClick={() => setState({ kind: c.id, editing: null, error: null, q: '', warehouseId: '', accountId: '', page: 1 })}>
          {c.icon} {t('open.' + c.id)}
        </button>
      ))}
    </>
  );
}

function blankForm(kind = 'material') {
  return {
    kind,
    direction: DEFAULT_DIRECTION[kind] || 'debit',
    date: new Date().toISOString().slice(0, 10),
    warehouseId: '',
    materialId: '',
    accountId: '',
    quantity: kind === 'material' ? 1 : 0,
    unitPrice: 0,
    amount: 0,
    name: '',
  };
}

const ribbon = ({ state, setState, can }) => {
  const kind = state.kind ?? 'material';
  const isCash = kind === 'cash';
  const templatePath = isCash ? '/opening-balances/template-excel?kind=cash' : '/opening-balances/template-excel';
  const templateFile = isCash ? 'ton-quy-dau-ky-mau.xlsx' : 'ton-kho-dau-ky-mau.xlsx';
  const exportPath = isCash
    ? '/opening-balances/export-excel?kind=cash' + (state.accountId ? `&accountId=${state.accountId}` : '')
    : '/opening-balances/export-excel' + (state.warehouseId ? `?warehouseId=${state.warehouseId}` : '');
  const exportFile = isCash ? 'ton-quy-dau-ky.xlsx' : 'ton-kho-dau-ky.xlsx';

  return {
    tabs: [{ id: 'opening', title: 'open.title', groups: [{ id: 'actions', title: 'open.title', items: [
      { id: 'open-new', icon: '➕', label: 'open.new', disabled: !can('opening', 'create'),
        onClick: () => setState({ editing: blankForm(kind), error: null }) },
      { id: 'open-import', icon: '📂', label: 'open.importExcel', disabled: !can('opening', 'import'),
        onClick: () => setState({ importing: !state.importing }) },
      { id: 'open-template', icon: '⬇', label: 'open.templateExcel', disabled: !can('opening', 'export'),
        onClick: () => downloadFile(templatePath, templateFile) },
      { id: 'open-export', icon: '📊', label: 'open.exportExcel', disabled: !can('opening', 'export'),
        onClick: () => downloadFile(exportPath, exportFile) },
    ] }] }],
  };
};

const search = (q) => openingBalancesStore.search(q).then((rows) => rows.map((r) => (
  { id: r.id, title: r.name, subtitle: r.code, state: { kind: r.kind } }
)));

/* ---------- form field ---------- */

function Field({ f, form, setField, lists, t }) {
  const label = t(LABELS[f.key]);
  const value = form[f.key] ?? '';

  if (f.type === 'warehouse') {
    const list = lists.warehouse || [];
    return (
      <label>{label}
        <select value={value} onChange={(e) => setField(f.key, e.target.value)}>
          <option value="">{t('open.warehouseSelect')}</option>
          {list.map((x) => <option key={x.id} value={x.id}>{x.code ? x.code + ' - ' : ''}{x.name}</option>)}
        </select>
      </label>
    );
  }

  if (f.type === 'account') {
    const list = lists.account || [];
    return (
      <label>{label}
        <select value={value} onChange={(e) => {
          const id = e.target.value;
          setField(f.key, id, list.find((x) => x.id === id));
        }}>
          <option value="">{t('open.accountSelect')}</option>
          {list.map((x) => <option key={x.id} value={x.id}>{x.code ? x.code + ' - ' : ''}{x.name}</option>)}
        </select>
      </label>
    );
  }

  if (f.type === 'date') {
    return (
      <label>{label}
        <input type="date" value={value} onChange={(e) => setField(f.key, e.target.value)} />
      </label>
    );
  }

  if (f.type === 'material') {
    const list = lists.material || [];
    return (
      <label>{label}
        <select value={value} onChange={(e) => {
          const id = e.target.value;
          setField(f.key, id, list.find((x) => x.id === id));
        }}>
          <option value="">-- Chọn vật tư, hàng hóa --</option>
          {list.map((x) => <option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}
        </select>
      </label>
    );
  }

  const numeric = f.type !== 'text';
  return (
    <label>{label}
      <input type={numeric ? 'number' : 'text'} min={numeric ? 0 : undefined}
        step={numeric ? '1' : undefined} value={value}
        onChange={(e) => setField(f.key, numeric ? (+e.target.value || 0) : e.target.value)} />
    </label>
  );
}

/* ---------- view ---------- */

function Body({ state, setState, can }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const kind = state.kind ?? 'material';
  const isCash = kind === 'cash';
  const fields = FIELDS[kind] || FIELDS.material;
  const cols = COLS[kind] || COLS.material;

  const materials = materialsStore.use().items;
  const warehouses = warehousesStore.use().items;
  const allAccounts = accountsStore.use().items;
  const cashAccounts = allAccounts.filter((a) => a.code?.startsWith('111'));
  const accounts = cashAccounts.length ? cashAccounts : allAccounts;
  const lists = { material: materials, warehouse: warehouses, account: accounts };

  const q = state.q ?? '';
  const settledQ = useDebounced(q, 300);
  const warehouseFilter = state.warehouseId ?? '';
  const accountFilter = state.accountId ?? '';
  const page = Math.max(1, state.page ?? 1);
  const pageSize = state.pageSize ?? 10;

  const filters = { kind };
  if (!isCash && warehouseFilter) filters.warehouseId = warehouseFilter;
  if (isCash && accountFilter) filters.accountId = accountFilter;

  const { items, total, loading, fetching, error: loadError, reload } = openingBalancesStore.useQuery(
    { q: settledQ, page, pageSize, filters },
    { enabled: q === settledQ },
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const editing = state.editing;

  const [impBusy, setImpBusy] = useState(false);
  const [impResult, setImpResult] = useState(null);
  const fileInputRef = useRef(null);

  const templatePath = isCash ? '/opening-balances/template-excel?kind=cash' : '/opening-balances/template-excel';
  const templateFile = isCash ? 'ton-quy-dau-ky-mau.xlsx' : 'ton-kho-dau-ky-mau.xlsx';
  const exportPath = isCash
    ? '/opening-balances/export-excel?kind=cash' + (accountFilter ? `&accountId=${accountFilter}` : '')
    : '/opening-balances/export-excel' + (warehouseFilter ? `?warehouseId=${warehouseFilter}` : '');
  const exportFile = isCash ? 'ton-quy-dau-ky.xlsx' : 'ton-kho-dau-ky.xlsx';

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImpBusy(true);
    setImpResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const url = isCash ? '/opening-balances/import-excel?kind=cash' : '/opening-balances/import-excel';
      const res = await uploadFile(url, formData);
      setImpResult(res);
      if (res.ok > 0) {
        reload();
      }
    } catch (err) {
      setImpResult({ ok: 0, errors: [err.message] });
    } finally {
      setImpBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const setField = (key, value, item) => {
    const patch = { [key]: value };
    if (item && !editing.name) {
      patch.name = isCash ? ('Tồn quỹ đầu kỳ ' + item.name) : item.name;
    }
    setState({ editing: { ...editing, ...patch } }, { replace: true });
  };

  const save = async () => {
    const lack = missingField(editing, fields);
    if (lack) {
      setState({ error: t('open.required').replace('{field}', t(LABELS[lack.key])) }, { replace: true });
      return;
    }
    const body = { ...editing, kind, direction: DEFAULT_DIRECTION[kind] || 'debit' };
    if (!isCash) {
      body.amount = (body.quantity || 0) * (body.unitPrice || 0);
      if (!body.name && body.materialId) body.name = findName(lists.material, body.materialId);
    } else {
      body.quantity = 0;
      body.unitPrice = 0;
      if (!body.name && body.accountId) body.name = 'Tồn quỹ đầu kỳ ' + findName(lists.account, body.accountId);
    }
    setState({ saving: true, error: null }, { replace: true });
    try {
      if (body.id) await openingBalancesStore.update(body.id, body);
      else await openingBalancesStore.add(body);
      setState({ editing: null, saving: false });
    } catch (e) {
      setState({ saving: false, error: e.message }, { replace: true });
    }
  };

  if (loading) return <Loading />;

  if (editing) {
    const savePerm = editing.id ? can('opening', 'update') : can('opening', 'create');
    const computed = isCash ? (editing.amount || 0) : ((editing.quantity || 0) * (editing.unitPrice || 0));
    return (
      <div className="pad">
        <style>{CSS}</style>
        <h2>{editing.id ? t('open.edit') : t('open.new')} — {t('open.' + kind)}</h2>
        <div className="invmaster openform">
          {fields.map((f) => (
            <Field key={f.key} f={f} form={editing} setField={setField} lists={lists} t={t} />
          ))}
          {!isCash && <label>{t('open.total')}<input value={vnd(computed)} readOnly /></label>}
        </div>
        {state.error && <p className="formError" role="alert">{t('open.saveFailed')}: {state.error}</p>}
        <div className="formActions">
          <button className="btn" disabled={!savePerm || state.saving} onClick={save}>
            {state.saving ? t('open.saving') : t('open.save')}
          </button>
          <button className="tb" disabled={state.saving} onClick={() => setState({ editing: null, error: null })}>
            {t('open.cancel')}
          </button>
        </div>
      </div>
    );
  }

  const cell = (key, it) => {
    switch (key) {
      case 'date': return formatDate(it.date);
      case 'warehouseId': return findName(lists.warehouse, it.warehouseId);
      case 'materialId': return findName(lists.material, it.materialId);
      case 'accountId': return findName(lists.account, it.accountId);
      case 'amount': return vnd(it.amount || (it.quantity || 0) * (it.unitPrice || 0));
      case 'unitPrice': return vnd(it.unitPrice);
      case 'quantity': return (it.quantity || 0).toLocaleString();
      default: return it[key] ?? '';
    }
  };

  const pageTotal = items.reduce((s, it) => s + (it.amount || (it.quantity || 0) * (it.unitPrice || 0)), 0);
  const canDelete = can('opening', 'delete');
  const hasCriteria = !!q || (!isCash ? !!warehouseFilter : !!accountFilter);

  return (
    <div className="pad">
      <style>{CSS}</style>
      <div className="ghead">
        <h2>{t('open.title')} — {t('open.' + kind)}</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {can('opening', 'create') && (
            <button className="tb" onClick={() => setState({ editing: blankForm(kind), error: null })}>
              ➕ {t('open.new')}
            </button>
          )}
          {can('opening', 'import') && (
            <button className="tb" onClick={() => setState({ importing: !state.importing })}>
              📂 {t('open.importExcel')}
            </button>
          )}
          {can('opening', 'export') && (
            <>
              <button className="tb" onClick={() => downloadFile(templatePath, templateFile)}>
                ⬇ {t('open.templateExcel')}
              </button>
              <button className="tb" onClick={() => downloadFile(exportPath, exportFile)}>
                📊 {t('open.exportExcel')}
              </button>
            </>
          )}
        </div>
      </div>

      {state.importing && can('opening', 'import') && (
        <div className="importbox">
          <div className="importhead">
            <b>{isCash ? t('open.importTitleCash') : t('open.importTitle')}</b>
            <button type="button" className="xbtn" title={t('open.close')} aria-label={t('open.close')}
              onClick={() => setState({ importing: false })}>✕</button>
          </div>
          <p className="importhint">{isCash ? t('open.importHintCash') : t('open.importHint')}</p>
          <div className="importacts">
            <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
              onChange={handleFileSelected} />
            <button type="button" className="btn" disabled={impBusy}
              onClick={() => fileInputRef.current?.click()}>
              {impBusy ? t('open.importBusy') : '📤 ' + t('open.selectFile')}
            </button>
            <button type="button" className="tb"
              onClick={() => downloadFile(templatePath, templateFile)}>
              ⬇ {t('open.templateExcel')}
            </button>
          </div>
          {impResult && (
            <div className="importres" role="status">
              {impResult.ok > 0 && (
                <div style={{ color: '#0f766e', fontWeight: '500', marginBottom: '6px' }}>
                  ✅ {t('open.importDone').replace('{ok}', impResult.ok).replace('{created}', impResult.created).replace('{updated}', impResult.updated)}
                </div>
              )}
              {impResult.errors?.length > 0 && (
                <div>
                  <div style={{ color: '#b42318', fontWeight: '500' }}>⚠️ {t('open.importErrors').replace('{n}', impResult.errors.length)}</div>
                  <ul className="importerr">{impResult.errors.map((m, i) => <li key={i}>{m}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="cattools">
        <div className="searchbox">
          <span aria-hidden="true">🔍</span>
          <input type="search" value={q} placeholder={t('open.search')} aria-label={t('open.search')}
            onChange={(e) => setState({ q: e.target.value, page: 1 }, { replace: true })} />
          {q && <button type="button" className="xbtn" title={t('open.clear')}
            onClick={() => setState({ q: '', page: 1 }, { replace: true })}>✕</button>}
        </div>

        {!isCash ? (
          <label className="filter">
            <span>{t('open.warehouse')}</span>
            <select value={warehouseFilter}
              onChange={(e) => setState({ warehouseId: e.target.value, page: 1 }, { replace: true })}>
              <option value="">{t('open.allWarehouses')}</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code ? w.code + ' - ' : ''}{w.name}</option>)}
            </select>
          </label>
        ) : (
          <label className="filter">
            <span>{t('open.cashAccount')}</span>
            <select value={accountFilter}
              onChange={(e) => setState({ accountId: e.target.value, page: 1 }, { replace: true })}>
              <option value="">{t('open.allAccounts')}</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.code ? a.code + ' - ' : ''}{a.name}</option>)}
            </select>
          </label>
        )}

        {hasCriteria && (
          <button type="button" className="tb"
            onClick={() => setState({ q: '', warehouseId: '', accountId: '', page: 1 }, { replace: true })}>
            ✕ {t('open.clear')}
          </button>
        )}
        <span className="catcount" aria-live="polite">
          {fetching ? '⏳ ' : ''}{total} {t('open.entries')} · {t('open.total')}: {vnd(pageTotal)}
        </span>
      </div>

      {state.error && <p className="formError" role="alert">{state.error}</p>}
      {loadError && (
        <p className="formError" role="alert">
          {t('open.loadFailed')}: {loadError.message}{' '}
          <button type="button" className="tb" onClick={reload}>{t('open.retry')}</button>
        </p>
      )}

      <table className={'invtable' + (fetching ? ' fetching' : '')} aria-busy={fetching}>
        <thead>
          <tr>
            {cols.map((k) => (
              <th key={k} className={NUMERIC.has(k) ? 'num' : undefined}>{t(LABELS[k])}</th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              {cols.map((k) => (
                <td key={k} className={NUMERIC.has(k) ? 'num' : undefined}>{cell(k, it)}</td>
              ))}
              <td className="acts">
                {can('opening', 'update') && (
                  <button type="button" className="xbtn" title={t('open.edit')} aria-label={t('open.edit')}
                    onClick={() => setState({ editing: { ...it }, error: null })}>✏️</button>
                )}
                {canDelete && (
                  <button type="button" className="xbtn" title={t('open.delete')} aria-label={t('open.delete')}
                    onClick={async () => {
                      if (!(await confirm(t('open.confirmDelete').replace('{name}', it.name || it.code || '')))) return;
                      setState({ error: null }, { replace: true });
                      try { await openingBalancesStore.remove(it.id); }
                      catch (e) { setState({ error: e.message }, { replace: true }); }
                    }}>🗑</button>
                )}
              </td>
            </tr>
          ))}
          {!items.length && !fetching && (
            <tr><td colSpan={cols.length + 1} className="empty">
              {loadError ? t('open.loadFailed') : hasCriteria ? t('open.noResult') : isCash ? t('open.emptyCash') : t('open.empty')}
            </td></tr>
          )}
        </tbody>
      </table>

      {total > 0 && (
        <div className="pager">
          <span />
          <div className="pagenav">
            <button type="button" className="tb" title={t('open.prev')} aria-label={t('open.prev')}
              disabled={page <= 1} onClick={() => setState({ page: page - 1 }, { replace: true })}>◀</button>
            <span className="pageinfo">{t('open.pageOf').replace('{p}', page).replace('{n}', totalPages)}</span>
            <button type="button" className="tb" title={t('open.next')} aria-label={t('open.next')}
              disabled={page >= totalPages} onClick={() => setState({ page: page + 1 }, { replace: true })}>▶</button>
          </div>
        </div>
      )}
    </div>
  );
}

function View(props) {
  if (!props.can('opening', 'read')) return <Denied />;
  return <Body key={props.state?.kind ?? 'material'} {...props} />;
}

export default {
  id: 'opening', title: 'open.title', icon: '📦', order: 10, messages, search,
  initialState: { kind: 'material', q: '', warehouseId: '', accountId: '', page: 1, pageSize: 10, editing: null, error: null, saving: false },
  Menu, ribbon, View,
};
