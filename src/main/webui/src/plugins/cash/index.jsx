import { useI18n } from '../../core/i18n.jsx';
import Denied from '../../core/Denied.jsx';
import Autocomplete from '../../core/Autocomplete.jsx';
import { useConfirm } from '../../core/confirm.jsx';
import { useDebounced } from '../../core/useDebounced.js';
import { useAsyncQuery } from '../../core/useasyncquery.js';
import { cashApi } from '../../api/cashApi.js';
import { printCashVoucher } from './print.js';
import { inventoryApi } from '../../api/inventoryApi.js';
import { partnersStore, accountsStore, warehousesStore, vnd, formatDate } from '../../core/masterdata.js';
import { formatDateTime } from '../../core/dateFormat.js';

const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => today().slice(0, 8) + '01';
const PREFIX = { receipt: 'PT', payment: 'PC', exchange: 'PD' };
const VOUCHER_KINDS = ['receipt', 'payment', 'exchange'];

// Mục menu con trong ngăn điều hướng (MiniSidebar) của module
const KINDS = [
  { id: 'receipt', icon: '🧾' },
  { id: 'payment', icon: '💸' },
  { id: 'exchange', icon: '💱' },
  { id: 'book', icon: '📒' },
  { id: 'fromInventory', icon: '📦' },
];

const CURRENCIES = ['USD', 'EUR', 'JPY', 'GBP', 'AUD'];
const PAGE_SIZES = [5, 10, 20, 50];

const blankVoucher = (type) => ({
  type,
  date: today(),
  partnerId: '',
  partnerName: '',
  accountId: '',
  name: '',
  amount: 0,
  currency: type === 'exchange' ? 'USD' : 'VND',
  amountCurrency: 0,
  fxRate: 0,
  sourceDocId: null,
  sourceDocNo: '',
});

const lineTotal = (doc) =>
  (doc.lines || []).reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);

const messages = {
  vi: {
    'cash.title': 'Tiền mặt',
    'cash.receipt': 'Phiếu thu', 'cash.payment': 'Phiếu chi', 'cash.exchange': 'Phiếu đổi tiền tệ',
    'cash.book': 'Sổ quỹ tiền mặt', 'cash.fromInventory': 'Tạo phiếu thu - chi từ phiếu nhập xuất',
    'cash.no': 'Số phiếu', 'cash.date': 'Ngày', 'cash.type': 'Loại', 'cash.partner': 'Đối tượng',
    'cash.account': 'Tài khoản quỹ', 'cash.name': 'Diễn giải', 'cash.amount': 'Số tiền (VND)',
    'cash.currency': 'Ngoại tệ', 'cash.amountCurrency': 'Số ngoại tệ', 'cash.fxRate': 'Tỷ giá',
    'cash.sourceDoc': 'Phiếu xuất kho bán hàng',
    'cash.viewSourceDoc': 'Xem phiếu xuất kho bán hàng',
    'cash.openSourceDoc': 'Mở phiếu xuất kho bán hàng',
    'cash.new': 'Thêm mới', 'cash.newReceipt': 'Phiếu thu', 'cash.newPayment': 'Phiếu chi',
    'cash.newExchange': 'Đổi tiền tệ', 'cash.edit': 'Sửa phiếu', 'cash.save': 'Lưu', 'cash.cancel': 'Hủy',
    'cash.close': 'Danh sách', 'cash.delete': 'Hủy phiếu', 'cash.saving': 'Đang lưu…',
    'cash.search': 'Tìm theo số phiếu, diễn giải, đối tượng…', 'cash.searchPartner': 'Tìm đối tượng…',
    'cash.clear': 'Xóa bộ lọc', 'cash.empty': 'Chưa có phiếu nào.', 'cash.noResult': 'Không có kết quả phù hợp.',
    'cash.loadFailed': 'Không tải được dữ liệu', 'cash.saveFailed': 'Không thể lưu', 'cash.retry': 'Thử lại',
    'cash.confirmDelete': 'Hủy phiếu "{no}"? Phiếu vẫn được lưu vết nhưng không còn trong sổ quỹ.',
    'cash.requiredAmount': 'Số tiền phải lớn hơn 0.',
    'cash.requiredExchange': 'Phiếu đổi tiền tệ phải có số ngoại tệ và tỷ giá.',
    'cash.total': 'Tổng', 'cash.entries': 'phiếu', 'cash.perPage': 'Số dòng',
    'cash.pageOf': 'Trang {p} / {n}', 'cash.prev': 'Trang trước', 'cash.next': 'Trang sau',
    'cash.fromDate': 'Từ ngày', 'cash.toDate': 'Đến ngày', 'cash.all': 'Tất cả',
    'cash.opening': 'Tồn đầu kỳ', 'cash.closing': 'Tồn cuối kỳ',
    'cash.totalReceipt': 'Tổng thu', 'cash.totalPayment': 'Tổng chi', 'cash.running': 'Tồn quỹ',
    'cash.receiptShort': 'Thu', 'cash.paymentShort': 'Chi',
    'cash.bookHint': 'Sổ quỹ theo khoảng ngày; phiếu đổi tiền tệ ghi nhận theo giá trị VND quy đổi.',
    'cash.invHint': 'Chọn phiếu nhập (tạo phiếu chi) hoặc phiếu xuất/trả (tạo phiếu thu).',
    'cash.invType': 'Loại phiếu kho', 'cash.invNo': 'Số phiếu kho', 'cash.invPartner': 'Đối tác',
    'cash.invDate': 'Ngày', 'cash.invTotal': 'Giá trị', 'cash.createVoucher': 'Tạo phiếu',
    'cash.created': 'Đã tạo phiếu {no}.', 'cash.creating': 'Đang tạo…',
    'cash.prefixHint': 'Số phiếu tự sinh theo loại ({no}0001…).',
    'cash.exchangeNote': 'Quy đổi: {vnd} (số ngoại tệ × tỷ giá).',
    'cash.print': 'In phiếu', 'cash.printReceipt': 'PHIẾU THU', 'cash.printPayment': 'PHIẾU CHI',
    'cash.printCompany': 'CÔNG TY …', 'cash.printAddress': 'Địa chỉ', 'cash.printPhone': 'Điện thoại',
    'cash.printTax': 'MST', 'cash.printForm': 'Mẫu số {no}',
    'cash.printFormRef': '(Ban hành theo Thông tư số 200/2014/TT-BTC ngày 22/12/2014 của Bộ Tài chính)',
    'cash.printDate': 'Ngày {d} tháng {m} năm {y}', 'cash.printNo': 'Số',
    'cash.printPayer': 'Họ và tên người nộp tiền', 'cash.printPayee': 'Họ và tên người nhận tiền',
    'cash.printPayerSign': 'Người nộp tiền', 'cash.printPayeeSign': 'Người nhận tiền',
    'cash.printReasonReceipt': 'Lý do nộp', 'cash.printReasonPayment': 'Lý do nhận',
    'cash.printAmount': 'Số tiền', 'cash.printAmountWords': 'Bằng chữ',
    'cash.printReceived': 'Đã nhận đủ số tiền (viết bằng chữ)',
    'cash.printDebit': 'Nợ', 'cash.printCredit': 'Có',
    'cash.printPreparer': 'Người lập phiếu', 'cash.printCashier': 'Thủ quỹ',
    'cash.printChiefAccountant': 'Kế toán trưởng', 'cash.printDirector': 'Giám đốc',
    'cash.printSignHint': '(Ký, họ tên)',
  },
  en: {
    'cash.title': 'Cash',
    'cash.receipt': 'Cash receipt', 'cash.payment': 'Cash payment', 'cash.exchange': 'Currency exchange',
    'cash.book': 'Cash book', 'cash.fromInventory': 'Generate receipt/payment from inventory doc',
    'cash.no': 'Voucher no.', 'cash.date': 'Date', 'cash.type': 'Type', 'cash.partner': 'Partner',
    'cash.account': 'Cash account', 'cash.name': 'Description', 'cash.amount': 'Amount (VND)',
    'cash.currency': 'Currency', 'cash.amountCurrency': 'Foreign amount', 'cash.fxRate': 'Exchange rate',
    'cash.sourceDoc': 'Sales export doc',
    'cash.viewSourceDoc': 'View sales export doc',
    'cash.openSourceDoc': 'Open sales export doc',
    'cash.new': 'New', 'cash.newReceipt': 'Receipt', 'cash.newPayment': 'Payment',
    'cash.newExchange': 'Exchange', 'cash.edit': 'Edit voucher', 'cash.save': 'Save', 'cash.cancel': 'Cancel',
    'cash.close': 'Back to list', 'cash.delete': 'Cancel voucher', 'cash.saving': 'Saving…',
    'cash.search': 'Search by no., description, partner…', 'cash.searchPartner': 'Search partner…',
    'cash.clear': 'Clear filters', 'cash.empty': 'No vouchers yet.', 'cash.noResult': 'No matching results.',
    'cash.loadFailed': 'Could not load data', 'cash.saveFailed': 'Could not save', 'cash.retry': 'Retry',
    'cash.confirmDelete': 'Cancel voucher "{no}"? It stays in the audit trail but leaves the cash book.',
    'cash.requiredAmount': 'Amount must be greater than 0.',
    'cash.requiredExchange': 'Currency exchange needs a foreign amount and an exchange rate.',
    'cash.total': 'Total', 'cash.entries': 'vouchers', 'cash.perPage': 'Rows',
    'cash.pageOf': 'Page {p} / {n}', 'cash.prev': 'Previous page', 'cash.next': 'Next page',
    'cash.fromDate': 'From', 'cash.toDate': 'To', 'cash.all': 'All',
    'cash.opening': 'Opening balance', 'cash.closing': 'Closing balance',
    'cash.totalReceipt': 'Total receipts', 'cash.totalPayment': 'Total payments', 'cash.running': 'Balance',
    'cash.receiptShort': 'Receipt', 'cash.paymentShort': 'Payment',
    'cash.bookHint': 'Cash book for the selected range; exchange vouchers are recorded at their VND value.',
    'cash.invHint': 'Pick an import doc (creates a payment) or an export/return doc (creates a receipt).',
    'cash.invType': 'Inventory doc type', 'cash.invNo': 'Doc no.', 'cash.invPartner': 'Partner',
    'cash.invDate': 'Date', 'cash.invTotal': 'Value', 'cash.createVoucher': 'Create voucher',
    'cash.created': 'Created voucher {no}.', 'cash.creating': 'Creating…',
    'cash.prefixHint': 'Voucher no. is generated automatically ({no}0001…).',
    'cash.exchangeNote': 'Converted: {vnd} (foreign amount × rate).',
    'cash.print': 'Print voucher', 'cash.printReceipt': 'CASH RECEIPT', 'cash.printPayment': 'CASH PAYMENT',
    'cash.printCompany': 'COMPANY …', 'cash.printAddress': 'Address', 'cash.printPhone': 'Phone',
    'cash.printTax': 'Tax code', 'cash.printForm': 'Form No. {no}',
    'cash.printFormRef': '(Issued under Circular No. 200/2014/TT-BTC dated 22/12/2014 of the Ministry of Finance)',
    'cash.printDate': 'Date {d} month {m} year {y}', 'cash.printNo': 'No.',
    'cash.printPayer': 'Payer name', 'cash.printPayee': 'Payee name',
    'cash.printPayerSign': 'Payer', 'cash.printPayeeSign': 'Payee',
    'cash.printReasonReceipt': 'Reason for receipt', 'cash.printReasonPayment': 'Reason for payment',
    'cash.printAmount': 'Amount', 'cash.printAmountWords': 'In words',
    'cash.printReceived': 'Amount received in full (in words)',
    'cash.printDebit': 'Dr', 'cash.printCredit': 'Cr',
    'cash.printPreparer': 'Prepared by', 'cash.printCashier': 'Cashier',
    'cash.printChiefAccountant': 'Chief Accountant', 'cash.printDirector': 'Director',
    'cash.printSignHint': '(sign, full name)',
  },
};

const CSS = `
.invtable td.num { text-align: right; white-space: nowrap; }
.invtable tbody tr:hover { background: rgba(15,108,189,.08); }
.invtable td.acts { white-space: nowrap; text-align: right; }
.cashsum { display: flex; flex-wrap: wrap; gap: 18px; margin: 10px 0; font-size: 13px; }
.cashsum b { font-size: 15px; }
.bookrow td { font-variant-numeric: tabular-nums; }
`;

/* ---------- Sub-menu (MiniSidebar) ---------- */

function Menu({ state, setState }) {
  const { t } = useI18n();
  return (<>
    <h3>{t('cash.title')}</h3>
    {KINDS.map((k) => (
      <button key={k.id} className={'item' + (state.kind === k.id ? ' on' : '')}
        onClick={() => setState({ kind: k.id, editing: null, error: null, page: 1, invMsg: null, invError: null })}>
        {k.icon} {t('cash.' + k.id)}
      </button>
    ))}
  </>);
}

const ribbon = ({ setState, can }) => ({
  tabs: [{ id: 'cash', title: 'cash.title', groups: [{ id: 'new', title: 'cash.title', items: [
    { id: 'new-receipt', icon: '🧾', label: 'cash.newReceipt', disabled: !can('cash', 'create'),
      onClick: () => setState({ kind: 'receipt', editing: blankVoucher('receipt'), error: null }) },
    { id: 'new-payment', icon: '💸', label: 'cash.newPayment', disabled: !can('cash', 'create'),
      onClick: () => setState({ kind: 'payment', editing: blankVoucher('payment'), error: null }) },
    { id: 'new-exchange', icon: '💱', label: 'cash.newExchange', disabled: !can('cash', 'create'),
      onClick: () => setState({ kind: 'exchange', editing: blankVoucher('exchange'), error: null }) },
  ] }] }],
});

const search = (q) => cashApi.list({ q, page: 1, pageSize: 20 }).then((res) => (res?.items ?? []).map((v) => (
  { id: v.id, title: v.code, subtitle: v.name, state: { kind: v.type, q: v.code } }
)));

/* ---------- Danh sách phiếu ---------- */

function VoucherView({ kind, state, setState, can, bus }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const accounts = accountsStore.use().items;
  const warehouses = warehousesStore.use().items || [];

  const q = state.q ?? '';
  const settledQ = useDebounced(q, 300);
  const page = Math.max(1, state.page ?? 1);
  const pageSize = state.pageSize ?? 10;
  const params = {
    type: kind, q: settledQ, dateFrom: state.dateFrom ?? '', dateTo: state.dateTo ?? '',
    warehouseId: state.warehouseId ?? '',
    page, pageSize, sort: 'date', dir: 'desc',
  };
  const { data, fetching, error: loadError, reload } = useAsyncQuery(
    'cash:' + kind + ':' + JSON.stringify(params),
    (signal) => cashApi.list(params, { signal }),
    { enabled: q === settledQ },
  );
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const accountName = (id) => {
    const a = accounts.find((x) => x.id === id);
    return a ? `${a.code} - ${a.name}` : '';
  };

  if (state.editing) {
    return <VoucherForm kind={kind} editing={state.editing} state={state} setState={setState}
      can={can} accounts={accounts} reload={reload} bus={bus} />;
  }

  const doDelete = async (v) => {
    if (!(await confirm(t('cash.confirmDelete').replace('{no}', v.code)))) return;
    try { await cashApi.delete(v.id); reload(); }
    catch (e) { setState({ error: e.message }, { replace: true }); }
  };

  return (
    <div className="pad">
      <style>{CSS}</style>
      <div className="ghead" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <h2>{t('cash.' + kind)}</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {can('cash', 'create') && (
            <>
              <button type="button" className="btn" onClick={() => setState({ kind: 'receipt', editing: blankVoucher('receipt'), error: null, page: 1 })}>
                ➕ {t('cash.newReceipt')}
              </button>
              <button type="button" className="btn" style={{ background: '#0284c7' }} onClick={() => setState({ kind: 'payment', editing: blankVoucher('payment'), error: null, page: 1 })}>
                ➕ {t('cash.newPayment')}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="cattools">
        <div className="searchbox">
          <span aria-hidden="true">🔍</span>
          <input type="search" value={q} placeholder={t('cash.search')} aria-label={t('cash.search')}
            onChange={(e) => setState({ q: e.target.value, page: 1 }, { replace: true })} />
          {q && <button type="button" className="xbtn" title={t('cash.clear')}
            onClick={() => setState({ q: '', page: 1 }, { replace: true })}>✕</button>}
        </div>
        <label className="filter">
          <span>{t('cash.fromDate')}</span>
          <input type="date" value={state.dateFrom ?? ''}
            onChange={(e) => setState({ dateFrom: e.target.value, page: 1 }, { replace: true })} />
        </label>
        <label className="filter">
          <span>{t('cash.toDate')}</span>
          <input type="date" value={state.dateTo ?? ''}
            onChange={(e) => setState({ dateTo: e.target.value, page: 1 }, { replace: true })} />
        </label>
        <label className="filter">
          <span>Kho hàng:</span>
          <select
            value={state.warehouseId ?? ''}
            onChange={(e) => setState({ warehouseId: e.target.value, page: 1 }, { replace: true })}
          >
            <option value="">Tất cả kho</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </label>
        {(q || state.dateFrom || state.dateTo || state.warehouseId) && (
          <button type="button" className="tb"
            onClick={() => setState({ q: '', dateFrom: '', dateTo: '', warehouseId: '', page: 1 }, { replace: true })}>
            ✕ {t('cash.clear')}
          </button>
        )}
        <span className="catcount" aria-live="polite">
          {fetching ? '⏳ ' : ''}{total} {t('cash.entries')}
        </span>
      </div>

      {state.error && <p className="formError" role="alert">{state.error}</p>}
      {loadError && (
        <p className="formError" role="alert">
          {t('cash.loadFailed')}: {loadError.message}{' '}
          <button type="button" className="tb" onClick={reload}>{t('cash.retry')}</button>
        </p>
      )}
      <table className={'invtable' + (fetching ? ' fetching' : '')} aria-busy={fetching}>
        <thead>
          <tr>
            <th>{t('cash.no')}</th>
            <th>{t('cash.date')}</th>
            <th>{t('cash.partner')}</th>
            <th>{t('cash.name')}</th>
            <th>{t('cash.sourceDoc')}</th>
            {kind === 'exchange' && <th>{t('cash.currency')}</th>}
            <th>{t('cash.account')}</th>
            <th className="num">{t('cash.amount')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((v) => (
            <tr key={v.id}>
              <td>{v.code}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{v.createdAt ? formatDateTime(v.createdAt) : formatDate(v.date)}</td>
              <td>{v.partnerName || v.partnerId || ''}</td>
              <td>{v.name}</td>
              <td>
                {v.sourceDocNo ? (
                  <button
                    type="button"
                    className="tb"
                    style={{ padding: '2px 6px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    title={t('cash.viewSourceDoc')}
                    onClick={() => bus?.emit('navigate', { pluginId: 'inventory', state: { q: v.sourceDocNo, filterType: 'all', mode: 'list' } })}>
                    📦 {v.sourceDocNo}
                  </button>
                ) : '—'}
              </td>
              {kind === 'exchange' && <td>{v.amountCurrency} {v.currency}</td>}
              <td>{accountName(v.accountId)}</td>
              <td className="num">{vnd(v.amount)}</td>
              <td className="acts" style={{ whiteSpace: 'nowrap' }}>
                <button type="button" className="tb" style={{ padding: '3px 8px', fontSize: 13, marginRight: 4 }} title={t('cash.print')}
                  onClick={() => printCashVoucher(v, t)}>🖨 {t('cash.print')}</button>
                {can('cash', 'update') && (
                  <button type="button" className="tb" style={{ padding: '3px 8px', fontSize: 13, marginRight: 4 }} title={t('cash.edit')}
                    onClick={() => setState({ editing: { ...v }, error: null })}>✏️ {t('cash.edit')}</button>
                )}
                {can('cash', 'delete') && (
                  <button type="button" className="tb" style={{ padding: '3px 8px', fontSize: 13, color: '#dc2626' }} title={t('cash.delete')}
                    onClick={() => doDelete(v)}>🗑 {t('cash.delete')}</button>
                )}
              </td>
            </tr>
          ))}
          {!items.length && fetching && (
            <tr><td colSpan={kind === 'exchange' ? 9 : 8} className="empty">⏳</td></tr>
          )}
          {!items.length && !fetching && (
            <tr><td colSpan={kind === 'exchange' ? 9 : 8} className="empty">
              {loadError ? t('cash.loadFailed') : (q || state.dateFrom || state.dateTo) ? t('cash.noResult') : t('cash.empty')}
            </td></tr>
          )}
        </tbody>
      </table>

      {total > 0 && (
        <div className="pager">
          <label className="filter perpage">
            <span>{t('cash.perPage')}</span>
            <select value={pageSize} onChange={(e) => setState({ pageSize: +e.target.value, page: 1 }, { replace: true })}>
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <div className="pagenav">
            <button type="button" className="tb" title={t('cash.prev')} aria-label={t('cash.prev')}
              disabled={page <= 1} onClick={() => setState({ page: page - 1 }, { replace: true })}>◀</button>
            <span className="pageinfo">{t('cash.pageOf').replace('{p}', page).replace('{n}', totalPages)}</span>
            <button type="button" className="tb" title={t('cash.next')} aria-label={t('cash.next')}
              disabled={page >= totalPages} onClick={() => setState({ page: page + 1 }, { replace: true })}>▶</button>
          </div>
        </div>
      )}

    </div>
  );
}

/* ---------- Form phiếu thu / chi / đổi tiền tệ ---------- */


function VoucherForm({ kind, editing, state, setState, can, accounts, reload, bus }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const savePerm = editing.id ? can('cash', 'update') : can('cash', 'create');
  const accountOptions = accounts.filter((a) => /^111/.test(a.code || ''));
  const options = accountOptions.length ? accountOptions : accounts;

  const setField = (key, value) => setState({ editing: { ...editing, [key]: value } }, { replace: true });
  // Đổi tiền tệ: số tiền VND luôn = số ngoại tệ × tỷ giá (server cũng tính lại khi amount <= 0)
  const setExchange = (key, value) => {
    const next = { ...editing, [key]: value };
    next.amount = Math.round((Number(next.amountCurrency) || 0) * (Number(next.fxRate) || 0));
    setState({ editing: next }, { replace: true });
  };

  const save = async () => {
    if (!editing.amount || editing.amount <= 0) {
      setState({ error: t('cash.requiredAmount') }, { replace: true });
      return;
    }
    if (kind === 'exchange' && (!editing.amountCurrency || !editing.fxRate)) {
      setState({ error: t('cash.requiredExchange') }, { replace: true });
      return;
    }
    setState({ saving: true, error: null }, { replace: true });
    try {
      const body = { ...editing, type: kind };
      if (body.id) await cashApi.update(body.id, body); else await cashApi.create(body);
      setState({ editing: null, saving: false, error: null }, { replace: true });
      reload();
    } catch (e) {
      setState({ saving: false, error: (t('cash.saveFailed') + ': ' + e.message) }, { replace: true });
    }
  };

  const doDelete = async () => {
    if (!(await confirm(t('cash.confirmDelete').replace('{no}', editing.code)))) return;
    try {
      await cashApi.delete(editing.id);
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
        <h2>{editing.id ? t('cash.edit') : t('cash.new')} — {t('cash.' + kind)}</h2>
        <div>
          <button className="tb" onClick={() => printCashVoucher(editing, t)}>🖨 {t('cash.print')}</button>{' '}
          <button className="tb" onClick={() => setState({ editing: null, error: null })}>← {t('cash.close')}</button>
        </div>
      </div>

      <div className="invmaster">
        <label>{t('cash.date')}
          <input type="date" value={editing.date || ''} onChange={(e) => setField('date', e.target.value)} />
        </label>
        <label>{t('cash.account')}
          <select value={editing.accountId || ''} onChange={(e) => setField('accountId', e.target.value)}>
            <option value="">--</option>
            {options.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
          </select>
        </label>
        <label>{t('cash.partner')}
          <Autocomplete
            value={editing.partnerId ? { id: editing.partnerId, name: editing.partnerName || '' } : null}
            onChange={(p) => setState({ editing: { ...editing, partnerId: p?.id ?? '', partnerName: p?.name ?? '' } }, { replace: true })}
            fetcher={(q) => partnersStore.search(q)} placeholder={t('cash.searchPartner')} />
        </label>
        <label>{t('cash.name')}
          <input value={editing.name || ''} onChange={(e) => setField('name', e.target.value)} />
        </label>

        {kind === 'exchange' && (<>
          <label>{t('cash.currency')}
            <select value={editing.currency || 'USD'} onChange={(e) => setExchange('currency', e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>{t('cash.amountCurrency')}
            <input type="number" min="0" step="1" value={editing.amountCurrency || 0}
              onChange={(e) => setExchange('amountCurrency', +e.target.value || 0)} />
          </label>
          <label>{t('cash.fxRate')}
            <input type="number" min="0" step="1" value={editing.fxRate || 0}
              onChange={(e) => setExchange('fxRate', +e.target.value || 0)} />
          </label>
        </>)}

        <label>{t('cash.amount')}
          <input type="number" min="0" step="1000" readOnly={kind === 'exchange'} value={editing.amount || 0}
            onChange={(e) => setField('amount', +e.target.value || 0)} />
        </label>
      </div>

      {kind === 'exchange' && (
        <p className="muted">{t('cash.exchangeNote').replace('{vnd}', vnd(editing.amount))}</p>
      )}
      {editing.sourceDocNo && (
        <div style={{ margin: '12px 0', padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <span>📦 <b>{t('cash.sourceDoc')}:</b> <span style={{ color: '#1d4ed8', fontWeight: 600 }}>{editing.sourceDocNo}</span></span>
          <button
            type="button"
            className="tb"
            style={{ padding: '4px 10px', fontSize: 13, background: '#fff', border: '1px solid #2563eb', color: '#2563eb', fontWeight: 500 }}
            onClick={() => bus?.emit('navigate', { pluginId: 'inventory', state: { q: editing.sourceDocNo, filterType: 'all', mode: 'list' } })}>
            🔗 {t('cash.openSourceDoc')}
          </button>
        </div>
      )}
      <p className="muted">{t('cash.prefixHint').replace('{no}', PREFIX[kind])}</p>
      {state.error && <p className="formError" role="alert">{state.error}</p>}

      <div className="formActions">
        <button className="btn" disabled={!savePerm || state.saving} onClick={save}>
          {state.saving ? t('cash.saving') : t('cash.save')}
        </button>
        <button type="button" className="tb" onClick={() => printCashVoucher(editing, t)}>🖨 {t('cash.print')}</button>
        {editing.id && can('cash', 'delete') && (
          <button type="button" className="tb" style={{ color: '#dc2626' }} disabled={state.saving} onClick={doDelete}>🗑 {t('cash.delete')}</button>
        )}
        <button className="tb" disabled={state.saving} onClick={() => setState({ editing: null, error: null })}>
          {t('cash.cancel')}
        </button>
      </div>
    </div>
  );
}

/* ---------- Sổ quỹ tiền mặt ---------- */

function CashBook({ state, setState }) {
  const { t } = useI18n();
  const warehouses = warehousesStore.use().items || [];
  const params = { dateFrom: state.bookFrom, dateTo: state.bookTo, warehouseId: state.bookWarehouseId };
  const { data, fetching, error, reload } = useAsyncQuery(
    'cashbook:' + params.dateFrom + ':' + params.dateTo + ':' + (params.warehouseId || ''),
    (signal) => cashApi.book(params, { signal }),
    {},
  );
  const rows = data?.items ?? [];

  return (
    <div className="pad">
      <style>{CSS}</style>
      <div className="ghead">
        <h2>{t('cash.book')}</h2>
        <button className="tb" onClick={reload}>⟳ {t('common.refresh')}</button>
      </div>
      <p className="muted">{t('cash.bookHint')}</p>

      <div className="cattools">
        <label className="filter">
          <span>{t('cash.fromDate')}</span>
          <input type="date" value={state.bookFrom ?? ''}
            onChange={(e) => setState({ bookFrom: e.target.value }, { replace: true })} />
        </label>
        <label className="filter">
          <span>{t('cash.toDate')}</span>
          <input type="date" value={state.bookTo ?? ''}
            onChange={(e) => setState({ bookTo: e.target.value }, { replace: true })} />
        </label>
        <label className="filter">
          <span>Kho hàng:</span>
          <select
            value={state.bookWarehouseId ?? ''}
            onChange={(e) => setState({ bookWarehouseId: e.target.value }, { replace: true })}
          >
            <option value="">Tất cả kho</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </label>
        {state.bookWarehouseId && (
          <button type="button" className="tb"
            onClick={() => setState({ bookWarehouseId: '' }, { replace: true })}>
            ✕ Bỏ lọc kho
          </button>
        )}
        <span className="catcount">{fetching ? '⏳ ' : ''}{rows.length} {t('cash.entries')}</span>
      </div>

      {error && (
        <p className="formError" role="alert">
          {t('cash.loadFailed')}: {error.message}{' '}
          <button type="button" className="tb" onClick={reload}>{t('cash.retry')}</button>
        </p>
      )}

      <div className="cashsum">
        <span>{t('cash.opening')}: <b>{vnd(data?.opening)}</b></span>
        <span>{t('cash.totalReceipt')}: <b>{vnd(data?.totalReceipt)}</b></span>
        <span>{t('cash.totalPayment')}: <b>{vnd(data?.totalPayment)}</b></span>
        <span>{t('cash.closing')}: <b>{vnd(data?.closing)}</b></span>
      </div>

      <table className="invtable bookrow" aria-busy={fetching}>
        <thead>
          <tr>
            <th>{t('cash.date')}</th>
            <th>{t('cash.no')}</th>
            <th>{t('cash.name')}</th>
            <th>{t('cash.partner')}</th>
            <th className="num">{t('cash.receiptShort')}</th>
            <th className="num">{t('cash.paymentShort')}</th>
            <th className="num">{t('cash.running')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={4}><b>{t('cash.opening')}</b></td>
            <td className="num" /><td className="num" />
            <td className="num"><b>{vnd(data?.opening)}</b></td>
          </tr>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={{ whiteSpace: 'nowrap' }}>{r.createdAt ? formatDateTime(r.createdAt) : formatDate(r.date)}</td>
              <td>{r.no}</td>
              <td>{r.name}{r.type === 'exchange' && r.currency !== 'VND'
                ? ` (${r.amountCurrency} ${r.currency})` : ''}</td>
              <td>{r.partnerName || ''}</td>
              <td className="num">{r.receipt ? vnd(r.receipt) : ''}</td>
              <td className="num">{r.payment ? vnd(r.payment) : ''}</td>
              <td className="num">{vnd(r.balance)}</td>
            </tr>
          ))}
          {!rows.length && !fetching && (
            <tr><td colSpan={7} className="empty">{t('cash.empty')}</td></tr>
          )}
          <tr>
            <td colSpan={4}><b>{t('cash.closing')}</b></td>
            <td className="num"><b>{vnd(data?.totalReceipt)}</b></td>
            <td className="num"><b>{vnd(data?.totalPayment)}</b></td>
            <td className="num"><b>{vnd(data?.closing)}</b></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Tạo phiếu thu/chi từ phiếu nhập xuất ---------- */

function FromInventory({ state, setState, can }) {
  const { t } = useI18n();
  const q = state.invQ ?? '';
  const settledQ = useDebounced(q, 300);
  const page = Math.max(1, state.invPage ?? 1);
  const pageSize = 10;
  const params = { q: settledQ, type: state.invType || '', page, pageSize };
  const { data, fetching, error, reload } = useAsyncQuery(
    'cashinv:' + JSON.stringify(params),
    () => inventoryApi.list(params),
    { enabled: q === settledQ },
  );
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const doCreate = async (doc) => {
    setState({ invBusy: doc.id, invError: null, invMsg: null }, { replace: true });
    try {
      const created = await cashApi.fromInventory(doc.id);
      setState({ invBusy: null, invMsg: t('cash.created').replace('{no}', created.code) }, { replace: true });
      reload();
    } catch (e) {
      setState({ invBusy: null, invError: e.message }, { replace: true });
    }
  };

  return (
    <div className="pad">
      <style>{CSS}</style>
      <div className="ghead">
        <h2>{t('cash.fromInventory')}</h2>
      </div>
      <p className="muted">{t('cash.invHint')}</p>

      <div className="cattools">
        <div className="searchbox">
          <span aria-hidden="true">🔍</span>
          <input type="search" value={q} placeholder={t('inv.search')} aria-label={t('inv.search')}
            onChange={(e) => setState({ invQ: e.target.value, invPage: 1 }, { replace: true })} />
          {q && <button type="button" className="xbtn" title={t('cash.clear')}
            onClick={() => setState({ invQ: '', invPage: 1 }, { replace: true })}>✕</button>}
        </div>
        <label className="filter">
          <span>{t('cash.invType')}</span>
          <select value={state.invType || ''} onChange={(e) => setState({ invType: e.target.value, invPage: 1 }, { replace: true })}>
            <option value="">{t('cash.all')}</option>
            <option value="import">{t('inv.import')}</option>
            <option value="export">{t('inv.export')}</option>
            <option value="return">{t('inv.return')}</option>
          </select>
        </label>
        <span className="catcount">{fetching ? '⏳ ' : ''}{total} {t('cash.entries')}</span>
      </div>

      {state.invMsg && <p className="muted" role="status">✅ {state.invMsg}</p>}
      {state.invError && <p className="formError" role="alert">{state.invError}</p>}
      {error && (
        <p className="formError" role="alert">
          {t('cash.loadFailed')}: {error.message}{' '}
          <button type="button" className="tb" onClick={reload}>{t('cash.retry')}</button>
        </p>
      )}

      <table className={'invtable' + (fetching ? ' fetching' : '')} aria-busy={fetching}>
        <thead>
          <tr>
            <th>{t('cash.invNo')}</th>
            <th>{t('cash.invType')}</th>
            <th>{t('cash.invPartner')}</th>
            <th>{t('cash.invDate')}</th>
            <th className="num">{t('cash.invTotal')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((d) => {
            const type = d.type === 'import' ? 'payment' : 'receipt';
            const disabled = d.type === 'transfer' || !can('cash', 'create') || state.invBusy === d.id;
            return (
              <tr key={d.id}>
                <td>{d.no}</td>
                <td>{t('inv.' + d.type)}</td>
                <td>{d.partner?.name || ''}</td>
                <td>{formatDate(d.date)}</td>
                <td className="num">{vnd(lineTotal(d))}</td>
                <td className="acts">
                  <button type="button" className="tb" disabled={disabled} onClick={() => doCreate(d)}>
                    {state.invBusy === d.id ? t('cash.creating')
                      : `➕ ${t('cash.' + (type === 'payment' ? 'newPayment' : 'newReceipt'))}`}
                  </button>
                </td>
              </tr>
            );
          })}
          {!items.length && fetching && (
            <tr><td colSpan={6} className="empty">⏳</td></tr>
          )}
          {!items.length && !fetching && (
            <tr><td colSpan={6} className="empty">{error ? t('cash.loadFailed') : t('inv.empty')}</td></tr>
          )}
        </tbody>
      </table>

      {total > 0 && (
        <div className="pager">
          <span />
          <div className="pagenav">
            <button type="button" className="tb" title={t('cash.prev')} aria-label={t('cash.prev')}
              disabled={page <= 1} onClick={() => setState({ invPage: page - 1 }, { replace: true })}>◀</button>
            <span className="pageinfo">{t('cash.pageOf').replace('{p}', page).replace('{n}', totalPages)}</span>
            <button type="button" className="tb" title={t('cash.next')} aria-label={t('cash.next')}
              disabled={page >= totalPages} onClick={() => setState({ invPage: page + 1 }, { replace: true })}>▶</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- View ---------- */

function View(props) {
  if (!props.can('cash', 'read')) return <Denied />;
  const kind = props.state.kind ?? 'receipt';
  if (kind === 'book') return <CashBook {...props} />;
  if (kind === 'fromInventory') return <FromInventory {...props} />;
  return <VoucherView {...props} kind={VOUCHER_KINDS.includes(kind) ? kind : 'receipt'} />;
}

export default {
  id: 'cash', title: 'cash.title', icon: '💵', order: 2, messages, search, Menu, ribbon, View,
  initialState: {
    kind: 'receipt', q: '', dateFrom: '', dateTo: '', page: 1, pageSize: 10,
    editing: null, error: null, saving: false,
    bookFrom: firstOfMonth(), bookTo: today(),
    invQ: '', invType: '', invPage: 1, invMsg: null, invError: null, invBusy: null,
  },
};



