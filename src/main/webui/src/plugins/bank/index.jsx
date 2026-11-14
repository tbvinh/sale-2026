import { useI18n } from '../../core/i18n.jsx';
import Denied from '../../core/Denied.jsx';
import Autocomplete from '../../core/Autocomplete.jsx';
import { useConfirm } from '../../core/confirm.jsx';
import { useDebounced } from '../../core/useDebounced.js';
import { useAsyncQuery } from '../../core/useasyncquery.js';
import { bankApi } from '../../api/bankApi.js';
import { banksStore, accountsStore, partnersStore, vnd, formatDate } from '../../core/masterdata.js';

const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => today().slice(0, 8) + '01';
const PREFIX = { credit: 'BC', debit: 'BN', transfer: 'LC' };
const VOUCHER_KINDS = ['credit', 'debit', 'transfer'];

// Mục menu con trong ngăn điều hướng (MiniSidebar) của module
const KINDS = [
  { id: 'credit', icon: '📥' },
  { id: 'debit', icon: '📤' },
  { id: 'transfer', icon: '🔁' },
  { id: 'ledger', icon: '📘' },
];

const PAGE_SIZES = [5, 10, 20, 50];

const blankVoucher = (type) => ({
  type,
  date: today(),
  bankId: '',
  toBankId: '',
  partnerId: '',
  partnerName: '',
  accountId: '',
  name: '',
  amount: 0,
  currency: 'VND',
});

const messages = {
  vi: {
    'bank.title': 'Ngân hàng',
    'bank.credit': 'Báo có ngân hàng', 'bank.debit': 'Báo nợ ngân hàng',
    'bank.transfer': 'Phiếu luân chuyển tiền tệ', 'bank.ledger': 'Sổ tiền gửi ngân hàng',
    'bank.no': 'Số chứng từ', 'bank.date': 'Ngày', 'bank.bank': 'Ngân hàng',
    'bank.toBank': 'Ngân hàng nhận', 'bank.partner': 'Đối tượng', 'bank.account': 'Tài khoản đối ứng',
    'bank.name': 'Diễn giải', 'bank.amount': 'Số tiền', 'bank.type': 'Loại',
    'bank.new': 'Thêm mới', 'bank.newCredit': 'Báo có', 'bank.newDebit': 'Báo nợ',
    'bank.newTransfer': 'Luân chuyển', 'bank.edit': 'Sửa chứng từ', 'bank.save': 'Lưu',
    'bank.cancel': 'Hủy', 'bank.close': 'Danh sách', 'bank.delete': 'Hủy chứng từ',
    'bank.saving': 'Đang lưu…',
    'bank.search': 'Tìm theo số chứng từ, diễn giải, đối tượng…', 'bank.searchPartner': 'Tìm đối tượng…',
    'bank.clear': 'Xóa bộ lọc', 'bank.empty': 'Chưa có chứng từ nào.',
    'bank.noResult': 'Không có kết quả phù hợp.', 'bank.loadFailed': 'Không tải được dữ liệu',
    'bank.saveFailed': 'Không thể lưu', 'bank.retry': 'Thử lại',
    'bank.confirmDelete': 'Hủy chứng từ "{no}"? Chứng từ vẫn được lưu vết nhưng không còn trong sổ tiền gửi.',
    'bank.requiredAmount': 'Số tiền phải lớn hơn 0.',
    'bank.requiredBank': 'Chưa chọn ngân hàng.',
    'bank.requiredToBank': 'Phiếu luân chuyển phải có ngân hàng nhận khác ngân hàng nguồn.',
    'bank.entries': 'chứng từ', 'bank.perPage': 'Số dòng',
    'bank.pageOf': 'Trang {p} / {n}', 'bank.prev': 'Trang trước', 'bank.next': 'Trang sau',
    'bank.fromDate': 'Từ ngày', 'bank.toDate': 'Đến ngày',
    'bank.opening': 'Số dư đầu kỳ', 'bank.closing': 'Số dư cuối kỳ',
    'bank.totalIn': 'Tổng ghi có', 'bank.totalOut': 'Tổng ghi nợ', 'bank.running': 'Số dư',
    'bank.inShort': 'Ghi có', 'bank.outShort': 'Ghi nợ',
    'bank.ledgerHint': 'Sổ tiền gửi theo ngân hàng và khoảng ngày; phiếu luân chuyển ghi nợ ngân hàng nguồn và ghi có ngân hàng nhận.',
    'bank.bankRequired': 'Chọn ngân hàng để xem sổ tiền gửi.',
    'bank.noBank': 'Chưa có ngân hàng nào trong danh mục.',
    'bank.prefixHint': 'Số chứng từ tự sinh theo loại ({no}0001…).',
  },
  en: {
    'bank.title': 'Bank',
    'bank.credit': 'Bank credit advice', 'bank.debit': 'Bank debit advice',
    'bank.transfer': 'Internal transfer voucher', 'bank.ledger': 'Bank deposit ledger',
    'bank.no': 'Voucher no.', 'bank.date': 'Date', 'bank.bank': 'Bank',
    'bank.toBank': 'Destination bank', 'bank.partner': 'Partner', 'bank.account': 'Offset account',
    'bank.name': 'Description', 'bank.amount': 'Amount', 'bank.type': 'Type',
    'bank.new': 'New', 'bank.newCredit': 'Credit advice', 'bank.newDebit': 'Debit advice',
    'bank.newTransfer': 'Transfer', 'bank.edit': 'Edit voucher', 'bank.save': 'Save',
    'bank.cancel': 'Cancel', 'bank.close': 'Back to list', 'bank.delete': 'Cancel voucher',
    'bank.saving': 'Saving…',
    'bank.search': 'Search by no., description, partner…', 'bank.searchPartner': 'Search partner…',
    'bank.clear': 'Clear filters', 'bank.empty': 'No vouchers yet.',
    'bank.noResult': 'No matching results.', 'bank.loadFailed': 'Could not load data',
    'bank.saveFailed': 'Could not save', 'bank.retry': 'Retry',
    'bank.confirmDelete': 'Cancel voucher "{no}"? It stays in the audit trail but leaves the ledger.',
    'bank.requiredAmount': 'Amount must be greater than 0.',
    'bank.requiredBank': 'Please choose a bank.',
    'bank.requiredToBank': 'A transfer needs a destination bank different from the source bank.',
    'bank.entries': 'vouchers', 'bank.perPage': 'Rows',
    'bank.pageOf': 'Page {p} / {n}', 'bank.prev': 'Previous page', 'bank.next': 'Next page',
    'bank.fromDate': 'From', 'bank.toDate': 'To',
    'bank.opening': 'Opening balance', 'bank.closing': 'Closing balance',
    'bank.totalIn': 'Total credits', 'bank.totalOut': 'Total debits', 'bank.running': 'Balance',
    'bank.inShort': 'Credit', 'bank.outShort': 'Debit',
    'bank.ledgerHint': 'Deposit ledger by bank and date range; a transfer debits the source bank and credits the destination bank.',
    'bank.bankRequired': 'Choose a bank to view its deposit ledger.',
    'bank.noBank': 'No banks in the catalog yet.',
    'bank.prefixHint': 'Voucher no. is generated automatically ({no}0001…).',
  },
};

const CSS = `
.invtable td.num { text-align: right; white-space: nowrap; }
.invtable tbody tr:hover { background: rgba(15,108,189,.08); }
.invtable td.acts { white-space: nowrap; text-align: right; }
.banksum { display: flex; flex-wrap: wrap; gap: 18px; margin: 10px 0; font-size: 13px; }
.banksum b { font-size: 15px; }
.bookrow td { font-variant-numeric: tabular-nums; }
`;

/* ---------- Sub-menu (MiniSidebar) ---------- */

function Menu({ state, setState }) {
  const { t } = useI18n();
  return (<>
    <h3>{t('bank.title')}</h3>
    {KINDS.map((k) => (
      <button key={k.id} className={'item' + (state.kind === k.id ? ' on' : '')}
        onClick={() => setState({ kind: k.id, editing: null, error: null, page: 1 })}>
        {k.icon} {t('bank.' + k.id)}
      </button>
    ))}
  </>);
}

const ribbon = ({ setState, can }) => ({
  tabs: [{ id: 'bank', title: 'bank.title', groups: [{ id: 'new', title: 'bank.title', items: [
    { id: 'new-credit', icon: '📥', label: 'bank.newCredit', disabled: !can('bank', 'create'),
      onClick: () => setState({ kind: 'credit', editing: blankVoucher('credit'), error: null }) },
    { id: 'new-debit', icon: '📤', label: 'bank.newDebit', disabled: !can('bank', 'create'),
      onClick: () => setState({ kind: 'debit', editing: blankVoucher('debit'), error: null }) },
    { id: 'new-transfer', icon: '🔁', label: 'bank.newTransfer', disabled: !can('bank', 'create'),
      onClick: () => setState({ kind: 'transfer', editing: blankVoucher('transfer'), error: null }) },
  ] }] }],
});

const search = (q) => bankApi.list({ q, page: 1, pageSize: 20 }).then((res) => (res?.items ?? []).map((v) => (
  { id: v.id, title: v.code, subtitle: v.name, state: { kind: v.type, q: v.code } }
)));

/* ---------- Form chứng từ ngân hàng ---------- */

function VoucherForm({ kind, editing, state, setState, can, banks, accounts, reload }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const savePerm = editing.id ? can('bank', 'update') : can('bank', 'create');
  const accountOptions = accounts.filter((a) => /^112/.test(a.code || ''));
  const options = accountOptions.length ? accountOptions : accounts;

  const setField = (key, value) => setState({ editing: { ...editing, [key]: value } }, { replace: true });

  const save = async () => {
    if (!editing.amount || editing.amount <= 0) {
      setState({ error: t('bank.requiredAmount') }, { replace: true });
      return;
    }
    if (!editing.bankId) {
      setState({ error: t('bank.requiredBank') }, { replace: true });
      return;
    }
    if (kind === 'transfer' && (!editing.toBankId || editing.toBankId === editing.bankId)) {
      setState({ error: t('bank.requiredToBank') }, { replace: true });
      return;
    }
    setState({ saving: true, error: null }, { replace: true });
    try {
      const body = { ...editing, type: kind, currency: 'VND' };
      if (body.id) await bankApi.update(body.id, body); else await bankApi.create(body);
      setState({ editing: null, saving: false, error: null }, { replace: true });
      reload();
    } catch (e) {
      setState({ saving: false, error: (t('bank.saveFailed') + ': ' + e.message) }, { replace: true });
    }
  };

  const doDelete = async () => {
    if (!(await confirm(t('bank.confirmDelete').replace('{no}', editing.code)))) return;
    try {
      await bankApi.delete(editing.id);
      setState({ editing: null, error: null }, { replace: true });
      reload();
    } catch (e) {
      setState({ error: e.message }, { replace: true });
    }
  };

  return (
    <div className="pad">
      <style>{CSS}</style>
      <div className="ghead">
        <h2>{editing.id ? t('bank.edit') : t('bank.new')} — {t('bank.' + kind)}</h2>
        <button className="tb" onClick={() => setState({ editing: null, error: null })}>← {t('bank.close')}</button>
      </div>

      <div className="invmaster">
        <label>{t('bank.date')}
          <input type="date" value={editing.date || ''} onChange={(e) => setField('date', e.target.value)} />
        </label>
        <label>{t('bank.bank')}
          <select value={editing.bankId || ''} onChange={(e) => setField('bankId', e.target.value)}>
            <option value="">--</option>
            {banks.map((b) => <option key={b.id} value={b.id}>{b.code} - {b.name}</option>)}
          </select>
        </label>
        {kind === 'transfer' && (
          <label>{t('bank.toBank')}
            <select value={editing.toBankId || ''} onChange={(e) => setField('toBankId', e.target.value)}>
              <option value="">--</option>
              {banks.filter((b) => b.id !== editing.bankId).map((b) => (
                <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
              ))}
            </select>
          </label>
        )}
        <label>{t('bank.partner')}
          <Autocomplete
            value={editing.partnerId ? { id: editing.partnerId, name: editing.partnerName || '' } : null}
            onChange={(p) => setState({ editing: { ...editing, partnerId: p?.id ?? '', partnerName: p?.name ?? '' } }, { replace: true })}
            fetcher={(q) => partnersStore.search(q)} placeholder={t('bank.searchPartner')} />
        </label>
        <label>{t('bank.account')}
          <select value={editing.accountId || ''} onChange={(e) => setField('accountId', e.target.value)}>
            <option value="">--</option>
            {options.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
          </select>
        </label>
        <label>{t('bank.name')}
          <input value={editing.name || ''} onChange={(e) => setField('name', e.target.value)} />
        </label>
        <label>{t('bank.amount')}
          <input type="number" min="0" step="1000" value={editing.amount || 0}
            onChange={(e) => setField('amount', +e.target.value || 0)} />
        </label>
      </div>

      <p className="muted">{t('bank.prefixHint').replace('{no}', PREFIX[kind])}</p>
      {state.error && <p className="formError" role="alert">{state.error}</p>}

      <div className="formActions">
        <button className="btn" disabled={!savePerm || state.saving} onClick={save}>
          {state.saving ? t('bank.saving') : t('bank.save')}
        </button>
        <button className="tb" disabled={state.saving} onClick={() => setState({ editing: null, error: null })}>
          {t('bank.cancel')}
        </button>
        {editing.id && can('bank', 'delete') && (
          <button className="tb" disabled={state.saving} onClick={doDelete}>🗑 {t('bank.delete')}</button>
        )}
      </div>
    </div>
  );
}

/* ---------- Danh sách chứng từ ---------- */

function VoucherView({ kind, state, setState, can }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const banks = banksStore.use().items;
  const accounts = accountsStore.use().items;

  const q = state.q ?? '';
  const settledQ = useDebounced(q, 300);
  const page = Math.max(1, state.page ?? 1);
  const pageSize = state.pageSize ?? 10;
  const params = {
    type: kind, q: settledQ, bankId: state.filterBankId ?? '',
    dateFrom: state.dateFrom ?? '', dateTo: state.dateTo ?? '',
    page, pageSize, sort: 'date', dir: 'desc',
  };
  const { data, fetching, error: loadError, reload } = useAsyncQuery(
    'bank:' + kind + ':' + JSON.stringify(params),
    (signal) => bankApi.list(params, { signal }),
    { enabled: q === settledQ },
  );
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const bankName = (id) => {
    const b = banks.find((x) => x.id === id);
    return b ? b.name : '';
  };
  const accountName = (id) => {
    const a = accounts.find((x) => x.id === id);
    return a ? `${a.code} - ${a.name}` : '';
  };

  if (state.editing) {
    return <VoucherForm kind={kind} editing={state.editing} state={state} setState={setState}
      can={can} banks={banks} accounts={accounts} reload={reload} />;
  }

  const doDelete = async (v) => {
    if (!(await confirm(t('bank.confirmDelete').replace('{no}', v.code)))) return;
    try { await bankApi.delete(v.id); reload(); }
    catch (e) { setState({ error: e.message }, { replace: true }); }
  };

  return (
    <div className="pad">
      <style>{CSS}</style>
      <div className="ghead">
        <h2>{t('bank.' + kind)}</h2>
        {can('bank', 'create') && (
          <button className="tb" onClick={() => setState({ editing: blankVoucher(kind), error: null, page: 1 })}>
            ➕ {t('bank.new')}
          </button>
        )}
      </div>

      <div className="cattools">
        <div className="searchbox">
          <span aria-hidden="true">🔍</span>
          <input type="search" value={q} placeholder={t('bank.search')} aria-label={t('bank.search')}
            onChange={(e) => setState({ q: e.target.value, page: 1 }, { replace: true })} />
          {q && <button type="button" className="xbtn" title={t('bank.clear')}
            onClick={() => setState({ q: '', page: 1 }, { replace: true })}>✕</button>}
        </div>
        <label className="filter">
          <span>{t('bank.bank')}</span>
          <select value={state.filterBankId ?? ''}
            onChange={(e) => setState({ filterBankId: e.target.value, page: 1 }, { replace: true })}>
            <option value="">--</option>
            {banks.map((b) => <option key={b.id} value={b.id}>{b.code} - {b.name}</option>)}
          </select>
        </label>
        <label className="filter">
          <span>{t('bank.fromDate')}</span>
          <input type="date" value={state.dateFrom ?? ''}
            onChange={(e) => setState({ dateFrom: e.target.value, page: 1 }, { replace: true })} />
        </label>
        <label className="filter">
          <span>{t('bank.toDate')}</span>
          <input type="date" value={state.dateTo ?? ''}
            onChange={(e) => setState({ dateTo: e.target.value, page: 1 }, { replace: true })} />
        </label>
        {(q || state.filterBankId || state.dateFrom || state.dateTo) && (
          <button type="button" className="tb"
            onClick={() => setState({ q: '', filterBankId: '', dateFrom: '', dateTo: '', page: 1 }, { replace: true })}>
            ✕ {t('bank.clear')}
          </button>
        )}
        <span className="catcount" aria-live="polite">
          {fetching ? '⏳ ' : ''}{total} {t('bank.entries')}
        </span>
      </div>

      {state.error && <p className="formError" role="alert">{state.error}</p>}
      {loadError && (
        <p className="formError" role="alert">
          {t('bank.loadFailed')}: {loadError.message}{' '}
          <button type="button" className="tb" onClick={reload}>{t('bank.retry')}</button>
        </p>
      )}
      <table className={'invtable' + (fetching ? ' fetching' : '')} aria-busy={fetching}>
        <thead>
          <tr>
            <th>{t('bank.no')}</th>
            <th>{t('bank.date')}</th>
            <th>{t('bank.bank')}</th>
            <th>{t('bank.partner')}</th>
            <th>{t('bank.name')}</th>
            <th>{t('bank.account')}</th>
            <th className="num">{t('bank.amount')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((v) => (
            <tr key={v.id}>
              <td>{v.code}</td>
              <td>{formatDate(v.date)}</td>
              <td>
                {v.type === 'transfer'
                  ? `${bankName(v.bankId)} → ${bankName(v.toBankId)}`
                  : bankName(v.bankId)}
              </td>
              <td>{v.partnerName || v.partnerId || ''}</td>
              <td>{v.name}</td>
              <td>{accountName(v.accountId)}</td>
              <td className="num">{vnd(v.amount)}</td>
              <td className="acts">
                {can('bank', 'update') && (
                  <button type="button" className="xbtn" title={t('bank.edit')} aria-label={t('bank.edit')}
                    onClick={() => setState({ editing: { ...v }, error: null })}>✏️</button>
                )}
                {can('bank', 'delete') && (
                  <button type="button" className="xbtn" title={t('bank.delete')} aria-label={t('bank.delete')}
                    onClick={() => doDelete(v)}>🗑</button>
                )}
              </td>
            </tr>
          ))}
          {!items.length && fetching && (
            <tr><td colSpan={8} className="empty">⏳</td></tr>
          )}
          {!items.length && !fetching && (
            <tr><td colSpan={8} className="empty">
              {loadError ? t('bank.loadFailed')
                : (q || state.filterBankId || state.dateFrom || state.dateTo) ? t('bank.noResult') : t('bank.empty')}
            </td></tr>
          )}
        </tbody>
      </table>

      {total > 0 && (
        <div className="pager">
          <label className="filter perpage">
            <span>{t('bank.perPage')}</span>
            <select value={pageSize} onChange={(e) => setState({ pageSize: +e.target.value, page: 1 }, { replace: true })}>
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <div className="pagenav">
            <button type="button" className="tb" title={t('bank.prev')} aria-label={t('bank.prev')}
              disabled={page <= 1} onClick={() => setState({ page: page - 1 }, { replace: true })}>◀</button>
            <span className="pageinfo">{t('bank.pageOf').replace('{p}', page).replace('{n}', totalPages)}</span>
            <button type="button" className="tb" title={t('bank.next')} aria-label={t('bank.next')}
              disabled={page >= totalPages} onClick={() => setState({ page: page + 1 }, { replace: true })}>▶</button>
          </div>
        </div>
      )}

    </div>
  );
}

/* ---------- Sổ tiền gửi ngân hàng ---------- */

function BankLedger({ state, setState }) {
  const { t } = useI18n();
  const banks = banksStore.use().items;
  const bankId = state.ledgerBankId || banks[0]?.id || '';
  const params = { bankId, dateFrom: state.bookFrom, dateTo: state.bookTo };
  const { data, fetching, error, reload } = useAsyncQuery(
    'bankledger:' + bankId + ':' + params.dateFrom + ':' + params.dateTo,
    (signal) => bankApi.ledger(params, { signal }),
    { enabled: !!bankId },
  );
  const rows = data?.items ?? [];
  const bankName = (id) => {
    const b = banks.find((x) => x.id === id);
    return b ? b.name : '';
  };
  // Phiếu luân chuyển: hiển thị thêm ngân hàng đối ứng để đọc sổ dễ hơn
  const counterpart = (r) => {
    if (r.type !== 'transfer') return '';
    return r.toBankId === bankId ? ` ← ${bankName(r.bankId)}` : ` → ${bankName(r.toBankId)}`;
  };

  return (
    <div className="pad">
      <style>{CSS}</style>
      <div className="ghead">
        <h2>{t('bank.ledger')}</h2>
        <button className="tb" onClick={reload}>⟳ {t('common.refresh')}</button>
      </div>
      <p className="muted">{t('bank.ledgerHint')}</p>

      <div className="cattools">
        <label className="filter">
          <span>{t('bank.bank')}</span>
          <select value={bankId} onChange={(e) => setState({ ledgerBankId: e.target.value }, { replace: true })}>
            {banks.map((b) => <option key={b.id} value={b.id}>{b.code} - {b.name}</option>)}
          </select>
        </label>
        <label className="filter">
          <span>{t('bank.fromDate')}</span>
          <input type="date" value={state.bookFrom ?? ''}
            onChange={(e) => setState({ bookFrom: e.target.value }, { replace: true })} />
        </label>
        <label className="filter">
          <span>{t('bank.toDate')}</span>
          <input type="date" value={state.bookTo ?? ''}
            onChange={(e) => setState({ bookTo: e.target.value }, { replace: true })} />
        </label>
        <span className="catcount">{fetching ? '⏳ ' : ''}{rows.length} {t('bank.entries')}</span>
      </div>

      {!banks.length && <p className="muted">{t('bank.noBank')}</p>}

      {error && (
        <p className="formError" role="alert">
          {t('bank.loadFailed')}: {error.message}{' '}
          <button type="button" className="tb" onClick={reload}>{t('bank.retry')}</button>
        </p>
      )}

      <div className="banksum">
        <span>{t('bank.opening')}: <b>{vnd(data?.opening)}</b></span>
        <span>{t('bank.totalIn')}: <b>{vnd(data?.totalIn)}</b></span>
        <span>{t('bank.totalOut')}: <b>{vnd(data?.totalOut)}</b></span>
        <span>{t('bank.closing')}: <b>{vnd(data?.closing)}</b></span>
      </div>

      <table className="invtable bookrow" aria-busy={fetching}>
        <thead>
          <tr>
            <th>{t('bank.date')}</th>
            <th>{t('bank.no')}</th>
            <th>{t('bank.name')}</th>
            <th>{t('bank.partner')}</th>
            <th className="num">{t('bank.inShort')}</th>
            <th className="num">{t('bank.outShort')}</th>
            <th className="num">{t('bank.running')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={4}><b>{t('bank.opening')}</b></td>
            <td className="num" /><td className="num" />
            <td className="num"><b>{vnd(data?.opening)}</b></td>
          </tr>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{formatDate(r.date)}</td>
              <td>{r.no}</td>
              <td>{r.name}{counterpart(r)}</td>
              <td>{r.partnerName || ''}</td>
              <td className="num">{r.in ? vnd(r.in) : ''}</td>
              <td className="num">{r.out ? vnd(r.out) : ''}</td>
              <td className="num">{vnd(r.balance)}</td>
            </tr>
          ))}
          {!rows.length && !fetching && (
            <tr><td colSpan={7} className="empty">{t('bank.empty')}</td></tr>
          )}
          <tr>
            <td colSpan={4}><b>{t('bank.closing')}</b></td>
            <td className="num"><b>{vnd(data?.totalIn)}</b></td>
            <td className="num"><b>{vnd(data?.totalOut)}</b></td>
            <td className="num"><b>{vnd(data?.closing)}</b></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ---------- View ---------- */

function View(props) {
  if (!props.can('bank', 'read')) return <Denied />;
  const kind = props.state.kind ?? 'credit';
  if (kind === 'ledger') return <BankLedger {...props} />;
  return <VoucherView {...props} kind={VOUCHER_KINDS.includes(kind) ? kind : 'credit'} />;
}

export default {
  id: 'bank', title: 'bank.title', icon: '🏦', order: 7, messages, search, Menu, ribbon, View,
  initialState: {
    kind: 'credit', q: '', filterBankId: '', dateFrom: '', dateTo: '', page: 1, pageSize: 10,
    editing: null, error: null, saving: false,
    ledgerBankId: '', bookFrom: firstOfMonth(), bookTo: today(),
  },
};


