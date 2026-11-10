import { useI18n } from '../../core/i18n.jsx';
import { Loading } from '../../core/ui.jsx';
import Denied from '../../core/Denied.jsx';
import { useConfirm } from '../../core/confirm.jsx';
import { useDebounced } from '../../core/useDebounced.js';
import {
  openingBalancesStore, materialsStore, vnd,
} from '../../core/masterdata.js';

/* ---------- Tồn kho đầu kỳ (Vật tư, hàng hóa) ---------- */

const CATS = [
  { id: 'material', icon: '📦' },
];

const DEFAULT_DIRECTION = {
  material: 'debit',
};

const FIELDS = {
  material: [
    { key: 'materialId', type: 'material', required: true },
    { key: 'quantity', type: 'quantity', required: true },
    { key: 'unitPrice', type: 'money', required: true },
    { key: 'name', type: 'text' },
  ],
};

const COLS = {
  material: ['code', 'name', 'materialId', 'quantity', 'unitPrice', 'amount'],
};

const LABELS = {
  code: 'open.code', name: 'open.name', amount: 'open.amount', quantity: 'open.quantity',
  unitPrice: 'open.unitPrice', materialId: 'open.materialName',
};

const NUMERIC = new Set(['quantity', 'unitPrice', 'amount']);

const messages = {
  vi: {
    'open.title': 'Tồn kho đầu kỳ',
    'open.material': 'Vật tư, hàng hóa',
    'open.code': 'Mã', 'open.name': 'Diễn giải', 'open.amount': 'Thành tiền', 'open.quantity': 'Số lượng',
    'open.unitPrice': 'Đơn giá', 'open.materialName': 'Vật tư, hàng hóa',
    'open.new': 'Thêm mới', 'open.edit': 'Sửa', 'open.save': 'Lưu', 'open.cancel': 'Hủy', 'open.delete': 'Xóa',
    'open.saving': 'Đang lưu…', 'open.search': 'Tìm theo mã, diễn giải…', 'open.all': 'Tất cả',
    'open.clear': 'Xóa bộ lọc', 'open.empty': 'Chưa có dữ liệu tồn kho đầu kỳ.', 'open.noResult': 'Không có kết quả phù hợp.',
    'open.loadFailed': 'Không tải được dữ liệu', 'open.saveFailed': 'Không thể lưu', 'open.retry': 'Thử lại',
    'open.confirmDelete': 'Bạn có chắc muốn xóa "{name}"? Thao tác này không thể hoàn tác.',
    'open.required': '{field} không được để trống.', 'open.total': 'Tổng cộng', 'open.entries': 'bản ghi',
    'open.pageOf': 'Trang {p} / {n}', 'open.prev': 'Trang trước', 'open.next': 'Trang sau',
  },
  en: {
    'open.title': 'Opening Inventory',
    'open.material': 'Inventory & Products',
    'open.code': 'Code', 'open.name': 'Description', 'open.amount': 'Total amount', 'open.quantity': 'Quantity',
    'open.unitPrice': 'Unit price', 'open.materialName': 'Product / Material',
    'open.new': 'New', 'open.edit': 'Edit', 'open.save': 'Save', 'open.cancel': 'Cancel', 'open.delete': 'Delete',
    'open.saving': 'Saving…', 'open.search': 'Search by code or description…', 'open.all': 'All',
    'open.clear': 'Clear filters', 'open.empty': 'No opening inventory data.', 'open.noResult': 'No matching results.',
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
          onClick={() => setState({ kind: c.id, editing: null, error: null, q: '', page: 1 })}>
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
    quantity: 1,
    unitPrice: 0,
    amount: 0,
  };
}

const ribbon = ({ state, setState, can }) => ({
  tabs: [{ id: 'opening', title: 'open.title', groups: [{ id: 'actions', title: 'open.title', items: [
    { id: 'open-new', icon: '➕', label: 'open.new', disabled: !can('opening', 'create'),
      onClick: () => setState({ editing: blankForm(state.kind ?? 'material'), error: null }) },
  ] }] }],
});

const search = (q) => openingBalancesStore.search(q).then((rows) => rows.map((r) => (
  { id: r.id, title: r.name, subtitle: r.code, state: { kind: r.kind } }
)));

/* ---------- form field ---------- */

function Field({ f, form, setField, lists, t }) {
  const label = t(LABELS[f.key]);
  const value = form[f.key] ?? '';

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
  const kind = 'material';
  const fields = FIELDS[kind];
  const cols = COLS[kind];

  const materials = materialsStore.use().items;
  const lists = { material: materials };

  const q = state.q ?? '';
  const settledQ = useDebounced(q, 300);
  const page = Math.max(1, state.page ?? 1);
  const pageSize = state.pageSize ?? 10;

  const { items, total, loading, fetching, error: loadError, reload } = openingBalancesStore.useQuery(
    { q: settledQ, page, pageSize, filters: { kind: 'material' } },
    { enabled: q === settledQ },
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const editing = state.editing;

  const setField = (key, value, item) => {
    const patch = { [key]: value };
    if (item && !editing.name) patch.name = item.name;
    setState({ editing: { ...editing, ...patch } }, { replace: true });
  };

  const save = async () => {
    const lack = missingField(editing, fields);
    if (lack) {
      setState({ error: t('open.required').replace('{field}', t(LABELS[lack.key])) }, { replace: true });
      return;
    }
    const body = { ...editing, kind: 'material', direction: 'debit' };
    body.amount = (body.quantity || 0) * (body.unitPrice || 0);
    if (!body.name && body.materialId) body.name = findName(lists.material, body.materialId);
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
    const computed = (editing.quantity || 0) * (editing.unitPrice || 0);
    return (
      <div className="pad">
        <style>{CSS}</style>
        <h2>{editing.id ? t('open.edit') : t('open.new')} — {t('open.' + kind)}</h2>
        <div className="invmaster openform">
          {fields.map((f) => (
            <Field key={f.key} f={f} form={editing} setField={setField} lists={lists} t={t} />
          ))}
          <label>{t('open.total')}<input value={vnd(computed)} readOnly /></label>
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
      case 'materialId': return findName(lists.material, it.materialId);
      case 'amount': return vnd(it.amount || (it.quantity || 0) * (it.unitPrice || 0));
      case 'unitPrice': return vnd(it.unitPrice);
      case 'quantity': return (it.quantity || 0).toLocaleString();
      default: return it[key] ?? '';
    }
  };

  const pageTotal = items.reduce((s, it) => s + (it.amount || (it.quantity || 0) * (it.unitPrice || 0)), 0);
  const canDelete = can('opening', 'delete');
  const hasCriteria = !!q;

  return (
    <div className="pad">
      <style>{CSS}</style>
      <div className="ghead">
        <h2>{t('open.title')}</h2>
        {can('opening', 'create') && (
          <button className="tb" onClick={() => setState({ editing: blankForm(kind), error: null })}>
            ➕ {t('open.new')}
          </button>
        )}
      </div>

      <div className="cattools">
        <div className="searchbox">
          <span aria-hidden="true">🔍</span>
          <input type="search" value={q} placeholder={t('open.search')} aria-label={t('open.search')}
            onChange={(e) => setState({ q: e.target.value, page: 1 }, { replace: true })} />
          {q && <button type="button" className="xbtn" title={t('open.clear')}
            onClick={() => setState({ q: '', page: 1 }, { replace: true })}>✕</button>}
        </div>

        {hasCriteria && (
          <button type="button" className="tb"
            onClick={() => setState({ q: '', page: 1 }, { replace: true })}>
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
              {loadError ? t('open.loadFailed') : hasCriteria ? t('open.noResult') : t('open.empty')}
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
  return <Body key="material" {...props} />;
}

export default {
  id: 'opening', title: 'open.title', icon: '📦', order: 10, messages, search,
  initialState: { kind: 'material', q: '', page: 1, pageSize: 10, editing: null, error: null, saving: false },
  Menu, ribbon, View,
};
