import { useState } from 'react';
import { useI18n } from '../../core/i18n.jsx';
import Denied from '../../core/Denied.jsx';
import Autocomplete from '../../core/Autocomplete.jsx';
import { useConfirm } from '../../core/confirm.jsx';
import { useDebounced } from '../../core/useDebounced.js';
import { useAsyncQuery } from '../../core/useasyncquery.js';
import { generalApi } from '../../api/generalApi.js';
import { partnersStore, accountsStore, vnd, formatDate } from '../../core/masterdata.js';

const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => today().slice(0, 8) + '01';
const PREFIX = { journal: 'PK', offset: 'BT' };
const VOUCHER_KINDS = ['journal', 'offset'];
const COMMAND_API = {
  profitLoss: 'close-profit-loss',
  renumber: 'renumber',
  print: 'print',
  recalculate: 'recalculate',
};

// Mục menu con trong ngăn điều hướng (MiniSidebar) của module
const KINDS = [
  { id: 'profitLoss', icon: '📉' },
  { id: 'journal', icon: '📝' },
  { id: 'offset', icon: '🤝' },
  { id: 'trialBalance', icon: '📊' },
  { id: 'renumber', icon: '🔢' },
  { id: 'print', icon: '🖨' },
  { id: 'recalculate', icon: '♻️' },
];

const PAGE_SIZES = [5, 10, 20, 50];

const blankLine = () => ({ accountId: '', debit: 0, credit: 0, note: '' });
const blankVoucher = (type) => ({
  type,
  date: today(),
  partnerId: '',
  partnerName: '',
  name: '',
  lines: [blankLine(), blankLine()],
});

const messages = {
  vi: {
    'general.title': 'Tổng hợp',
    'general.profitLoss': 'Kết chuyển lỗ lãi',
    'general.journal': 'Phiếu kế toán',
    'general.offset': 'Phiếu bù trừ công nợ',
    'general.trialBalance': 'Bảng cân đối số phát sinh',
    'general.renumber': 'Đánh lại số phiếu',
    'general.print': 'In phiếu',
    'general.recalculate': 'Tính lại số dư',
    'general.no': 'Số phiếu', 'general.date': 'Ngày', 'general.partner': 'Đối tượng',
    'general.name': 'Diễn giải', 'general.amount': 'Số tiền',
    'general.account': 'Tài khoản', 'general.accountDebit': 'TK Nợ', 'general.accountCredit': 'TK Có',
    'general.debit': 'Nợ', 'general.credit': 'Có', 'general.note': 'Ghi chú',
    'general.lines': 'Bút toán',
    'general.new': 'Thêm mới', 'general.edit': 'Sửa chứng từ', 'general.save': 'Lưu',
    'general.cancel': 'Hủy', 'general.close': 'Danh sách', 'general.delete': 'Hủy chứng từ',
    'general.saving': 'Đang lưu…',
    'general.search': 'Tìm theo số phiếu, diễn giải, đối tượng…', 'general.searchPartner': 'Tìm đối tượng…',
    'general.clear': 'Xóa bộ lọc', 'general.empty': 'Chưa có chứng từ nào.',
    'general.noResult': 'Không có kết quả phù hợp.',
    'general.loadFailed': 'Không tải được dữ liệu', 'general.saveFailed': 'Không thể lưu', 'general.retry': 'Thử lại',
    'general.confirmDelete': 'Hủy chứng từ "{no}"? Chứng từ vẫn được lưu vết nhưng không còn trong sổ.',
    'general.unbalanced': 'Tổng Nợ phải bằng tổng Có và lớn hơn 0.',
    'general.requiredAccount': 'Mỗi dòng phải chọn tài khoản và chỉ ghi Nợ hoặc Có.',
    'general.requiredPartner': 'Chọn đối tượng cho phiếu bù trừ công nợ.',
    'general.addLine': 'Thêm dòng',
    'general.entries': 'chứng từ', 'general.perPage': 'Số dòng',
    'general.pageOf': 'Trang {p} / {n}', 'general.prev': 'Trang trước', 'general.next': 'Trang sau',
    'general.fromDate': 'Từ ngày', 'general.toDate': 'Đến ngày',
    'general.accountCode': 'Số hiệu', 'general.accountName': 'Tên tài khoản',
    'general.openingDebit': 'Dư Nợ đầu kỳ', 'general.openingCredit': 'Dư Có đầu kỳ',
    'general.periodDebit': 'Phát sinh Nợ', 'general.periodCredit': 'Phát sinh Có',
    'general.closingDebit': 'Dư Nợ cuối kỳ', 'general.closingCredit': 'Dư Có cuối kỳ',
    'general.run': 'Chạy', 'general.running': 'Đang xử lý…', 'general.closeDlg': 'Đóng',
    'general.commandFailed': 'Không thực hiện được',
    'general.profitLossHint': 'Tính doanh thu và giá vốn trong kỳ, sau đó tạo phiếu kế toán kết chuyển lãi/lỗ (911 ↔ 421).',
    'general.renumberHint': 'Đánh lại số phiếu liên tục theo ngày lập cho loại chứng từ đã chọn.',
    'general.printHint': 'Đánh dấu đã in và liệt kê các phiếu đã lập trong khoảng ngày.',
    'general.recalculateHint': 'Tính lại số lượng và giá trị tồn kho cho toàn bộ vật tư, hàng hóa từ các phiếu nhập xuất.',
    'general.profitAccount': 'TK lợi nhuận', 'general.voucherType': 'Loại chứng từ', 'general.allTypes': 'Tất cả',
    'general.profit': 'Lãi', 'general.loss': 'Lỗ', 'general.revenue': 'Doanh thu', 'general.cost': 'Giá vốn',
    'general.createdVoucher': 'Đã tạo phiếu {no}',
    'general.renumbered': '{n} phiếu: {first} → {last}',
    'general.printed': '{n} phiếu đã được đánh dấu in.',
    'general.recalculated': '{n} vật tư · {qty} · {value}',
    'general.printList': 'Danh sách phiếu in',
  },
  en: {
    'general.title': 'General',
    'general.profitLoss': 'Profit & loss closing',
    'general.journal': 'General journal voucher',
    'general.offset': 'Debt offset voucher',
    'general.trialBalance': 'Trial balance',
    'general.renumber': 'Renumber vouchers',
    'general.print': 'Batch print vouchers',
    'general.recalculate': 'Recalculate balances',
    'general.no': 'Voucher no.', 'general.date': 'Date', 'general.partner': 'Partner',
    'general.name': 'Description', 'general.amount': 'Amount',
    'general.account': 'Account', 'general.accountDebit': 'Debit account', 'general.accountCredit': 'Credit account',
    'general.debit': 'Debit', 'general.credit': 'Credit', 'general.note': 'Note',
    'general.lines': 'Journal lines',
    'general.new': 'New', 'general.edit': 'Edit voucher', 'general.save': 'Save',
    'general.cancel': 'Cancel', 'general.close': 'Back to list', 'general.delete': 'Cancel voucher',
    'general.saving': 'Saving…',
    'general.search': 'Search by no., description, partner…', 'general.searchPartner': 'Search partner…',
    'general.clear': 'Clear filters', 'general.empty': 'No vouchers yet.',
    'general.noResult': 'No matching results.',
    'general.loadFailed': 'Could not load data', 'general.saveFailed': 'Could not save', 'general.retry': 'Retry',
    'general.confirmDelete': 'Cancel voucher "{no}"? It stays in the audit trail but leaves the books.',
    'general.unbalanced': 'Total debits must equal total credits and be greater than 0.',
    'general.requiredAccount': 'Each line needs an account and either a debit or a credit.',
    'general.requiredPartner': 'Please choose a partner for the offset voucher.',
    'general.addLine': 'Add line',
    'general.entries': 'vouchers', 'general.perPage': 'Rows',
    'general.pageOf': 'Page {p} / {n}', 'general.prev': 'Previous page', 'general.next': 'Next page',
    'general.fromDate': 'From', 'general.toDate': 'To',
    'general.accountCode': 'Account code', 'general.accountName': 'Account name',
    'general.openingDebit': 'Opening debit', 'general.openingCredit': 'Opening credit',
    'general.periodDebit': 'Period debit', 'general.periodCredit': 'Period credit',
    'general.closingDebit': 'Closing debit', 'general.closingCredit': 'Closing credit',
    'general.run': 'Run', 'general.running': 'Running…', 'general.closeDlg': 'Close',
    'general.commandFailed': 'Command failed',
    'general.profitLossHint': 'Compute revenue and COGS for the period, then create the closing journal voucher (911 ↔ 421).',
    'general.renumberHint': 'Renumber the selected voucher type sequentially by document date.',
    'general.printHint': 'Mark vouchers as printed and list the vouchers in the date range.',
    'general.recalculateHint': 'Recalculate quantity and value balances for every material from inventory documents.',
    'general.profitAccount': 'Profit account', 'general.voucherType': 'Voucher type', 'general.allTypes': 'All',
    'general.profit': 'Profit', 'general.loss': 'Loss', 'general.revenue': 'Revenue', 'general.cost': 'COGS',
    'general.createdVoucher': 'Created voucher {no}',
    'general.renumbered': '{n} vouchers: {first} → {last}',
    'general.printed': '{n} vouchers marked as printed.',
    'general.recalculated': '{n} materials · {qty} · {value}',
    'general.printList': 'Print list',
  },
};

const CSS = `
.invtable td.num { text-align: right; white-space: nowrap; }
.invtable tbody tr:hover { background: rgba(15,108,189,.08); }
.invtable td.acts { white-space: nowrap; text-align: right; }
.cmdwrap { min-height: 60vh; display: grid; place-items: center; padding: 24px; }
.cmddlg { width: min(560px, 100%); background: #fff; border: 1px solid var(--line, #e1e5ea); border-radius: 10px;
  box-shadow: 0 10px 30px #0002; padding: 20px; display: grid; gap: 12px; }
.cmdhead { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.cmdparams { display: grid; gap: 10px; }
.cmdparams label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted, #667085); }
.cmdparams input, .cmdparams select { padding: 6px 8px; border: 1px solid var(--line, #e1e5ea); border-radius: 6px; font-size: 14px; }
.cmdres { font-size: 13px; }
.cmderr { padding: 8px 10px; border-radius: 6px; background: #fdecea; color: #b42318; font-size: 13px; }
.gensum { display: flex; flex-wrap: wrap; gap: 18px; margin: 10px 0; font-size: 13px; }
.gensum b { font-size: 15px; }
.linetot { display: flex; justify-content: flex-end; gap: 18px; font-size: 13px; margin: 6px 0; }
.linetable select, .linetable input { width: 100%; padding: 4px 6px; border: 1px solid var(--line, #e1e5ea); border-radius: 4px; }
.linetable td.num input { width: 110px; text-align: right; }
`;

/* ---------- Sub-menu (MiniSidebar) ---------- */

function Menu({ state, setState }) {
  const { t } = useI18n();
  return (<>
    <h3>{t('general.title')}</h3>
    {KINDS.map((k) => (
      <button key={k.id} className={'item' + (state.kind === k.id ? ' on' : '')}
        onClick={() => setState({ kind: k.id, editing: null, error: null, page: 1 })}>
        {k.icon} {t('general.' + k.id)}
      </button>
    ))}
  </>);
}

const ribbon = ({ setState, can }) => ({
  tabs: [{ id: 'general', title: 'general.title', groups: [{ id: 'new', title: 'general.title', items: [
    { id: 'new-journal', icon: '📝', label: 'general.journal', disabled: !can('general', 'create'),
      onClick: () => setState({ kind: 'journal', editing: blankVoucher('journal'), error: null }) },
    { id: 'new-offset', icon: '🤝', label: 'general.offset', disabled: !can('general', 'create'),
      onClick: () => setState({ kind: 'offset', editing: blankVoucher('offset'), error: null }) },
  ] }] }],
});

const search = (q) => generalApi.list({ q, page: 1, pageSize: 20 }).then((res) => (res?.items ?? []).map((v) => (
  { id: v.id, title: v.code, subtitle: v.name, state: { kind: v.type, q: v.code } }
)));

/* ---------- Danh sách chứng từ ---------- */

function VoucherView({ kind, state, setState, can }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const accounts = accountsStore.use().items;

  const q = state.q ?? '';
  const settledQ = useDebounced(q, 300);
  const page = Math.max(1, state.page ?? 1);
  const pageSize = state.pageSize ?? 10;
  const params = {
    type: kind, q: settledQ, dateFrom: state.dateFrom ?? '', dateTo: state.dateTo ?? '',
    page, pageSize, sort: 'date', dir: 'desc',
  };
  const { data, fetching, error: loadError, reload } = useAsyncQuery(
    'general:' + kind + ':' + JSON.stringify(params),
    (signal) => generalApi.list(params, { signal }),
    { enabled: q === settledQ },
  );
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (state.editing) {
    return <VoucherForm kind={kind} editing={state.editing} state={state} setState={setState}
      can={can} accounts={accounts} reload={reload} />;
  }

  const doDelete = async (v) => {
    if (!(await confirm(t('general.confirmDelete').replace('{no}', v.code)))) return;
    try { await generalApi.delete(v.id); reload(); }
    catch (e) { setState({ error: e.message }, { replace: true }); }
  };

  return (
    <div className="pad">
      <style>{CSS}</style>
      <div className="ghead">
        <h2>{t('general.' + kind)}</h2>
        {can('general', 'create') && (
          <button className="tb" onClick={() => setState({ editing: blankVoucher(kind), error: null, page: 1 })}>
            ➕ {t('general.new')}
          </button>
        )}
      </div>

      <div className="cattools">
        <div className="searchbox">
          <span aria-hidden="true">🔍</span>
          <input type="search" value={q} placeholder={t('general.search')} aria-label={t('general.search')}
            onChange={(e) => setState({ q: e.target.value, page: 1 }, { replace: true })} />
          {q && <button type="button" className="xbtn" title={t('general.clear')}
            onClick={() => setState({ q: '', page: 1 }, { replace: true })}>✕</button>}
        </div>
        <label className="filter">
          <span>{t('general.fromDate')}</span>
          <input type="date" value={state.dateFrom ?? ''}
            onChange={(e) => setState({ dateFrom: e.target.value, page: 1 }, { replace: true })} />
        </label>
        <label className="filter">
          <span>{t('general.toDate')}</span>
          <input type="date" value={state.dateTo ?? ''}
            onChange={(e) => setState({ dateTo: e.target.value, page: 1 }, { replace: true })} />
        </label>
        {(q || state.dateFrom || state.dateTo) && (
          <button type="button" className="tb"
            onClick={() => setState({ q: '', dateFrom: '', dateTo: '', page: 1 }, { replace: true })}>
            ✕ {t('general.clear')}
          </button>
        )}
        <span className="catcount" aria-live="polite">
          {fetching ? '⏳ ' : ''}{total} {t('general.entries')}
        </span>
      </div>

      {state.error && <p className="formError" role="alert">{state.error}</p>}
      {loadError && (
        <p className="formError" role="alert">
          {t('general.loadFailed')}: {loadError.message}{' '}
          <button type="button" className="tb" onClick={reload}>{t('general.retry')}</button>
        </p>
      )}
      <table className={'invtable' + (fetching ? ' fetching' : '')} aria-busy={fetching}>
        <thead>
          <tr>
            <th>{t('general.no')}</th>
            <th>{t('general.date')}</th>
            <th>{t('general.partner')}</th>
            <th>{t('general.name')}</th>
            <th className="num">{t('general.amount')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((v) => (
            <tr key={v.id}>
              <td>{v.code}</td>
              <td>{formatDate(v.date)}</td>
              <td>{v.partnerName || v.partnerId || ''}</td>
              <td>{v.name}</td>
              <td className="num">{vnd(v.amount)}</td>
              <td className="acts">
                {can('general', 'update') && (
                  <button type="button" className="xbtn" title={t('general.edit')} aria-label={t('general.edit')}
                    onClick={() => setState({
                      editing: { ...v, lines: (v.lines || []).map((l) => ({ ...l })) }, error: null,
                    })}>✏️</button>
                )}
                {can('general', 'delete') && (
                  <button type="button" className="xbtn" title={t('general.delete')} aria-label={t('general.delete')}
                    onClick={() => doDelete(v)}>🗑</button>
                )}
              </td>
            </tr>
          ))}
          {!items.length && fetching && (
            <tr><td colSpan={6} className="empty">⏳</td></tr>
          )}
          {!items.length && !fetching && (
            <tr><td colSpan={6} className="empty">
              {loadError ? t('general.loadFailed')
                : (q || state.dateFrom || state.dateTo) ? t('general.noResult') : t('general.empty')}
            </td></tr>
          )}
        </tbody>
      </table>

      {total > 0 && (
        <div className="pager">
          <label className="filter perpage">
            <span>{t('general.perPage')}</span>
            <select value={pageSize} onChange={(e) => setState({ pageSize: +e.target.value, page: 1 }, { replace: true })}>
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <div className="pagenav">
            <button type="button" className="tb" title={t('general.prev')} aria-label={t('general.prev')}
              disabled={page <= 1} onClick={() => setState({ page: page - 1 }, { replace: true })}>◀</button>
            <span className="pageinfo">{t('general.pageOf').replace('{p}', page).replace('{n}', totalPages)}</span>
            <button type="button" className="tb" title={t('general.next')} aria-label={t('general.next')}
              disabled={page >= totalPages} onClick={() => setState({ page: page + 1 }, { replace: true })}>▶</button>
          </div>
        </div>
      )}

    </div>
  );
}

/* ---------- Form chứng từ ---------- */

function VoucherForm({ kind, editing, state, setState, can, accounts, reload }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const savePerm = editing.id ? can('general', 'update') : can('general', 'create');
  const lines = editing.lines ?? [];
  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);

  const setLines = (next) => setState({ editing: { ...editing, lines: next } }, { replace: true });
  const updateLine = (idx, patch) => setLines(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLine = () => setLines([...lines, blankLine()]);
  const removeLine = (idx) => setLines(lines.filter((_, i) => i !== idx));

  // Phiếu bù trừ: dòng 0 = Nợ, dòng 1 = Có
  const amount = (lines[0]?.debit) || (lines[1]?.credit) || 0;
  const setAmount = (value) => setLines([
    { ...(lines[0] ?? blankLine()), debit: value, credit: 0 },
    { ...(lines[1] ?? blankLine()), debit: 0, credit: value },
  ]);
  const setLineAmount = (idx, field, value) => updateLine(idx,
    field === 'debit' ? { debit: value, credit: 0 } : { credit: value, debit: 0 });

  const save = async () => {
    const invalid = lines.find((l) => !l.accountId
      || ((Number(l.debit) || 0) <= 0 && (Number(l.credit) || 0) <= 0)
      || ((Number(l.debit) || 0) > 0 && (Number(l.credit) || 0) > 0));
    if (!lines.length || invalid) {
      setState({ error: t('general.requiredAccount') }, { replace: true });
      return;
    }
    if (totalDebit <= 0 || totalDebit !== totalCredit) {
      setState({ error: t('general.unbalanced') }, { replace: true });
      return;
    }
    if (kind === 'offset' && !editing.partnerId) {
      setState({ error: t('general.requiredPartner') }, { replace: true });
      return;
    }
    setState({ saving: true, error: null }, { replace: true });
    try {
      const body = {
        ...editing,
        type: kind,
        lines: lines.map((l) => ({
          accountId: l.accountId,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          note: l.note || '',
        })),
      };
      if (body.id) await generalApi.update(body.id, body); else await generalApi.create(body);
      setState({ editing: null, saving: false, error: null }, { replace: true });
      reload();
    } catch (e) {
      setState({ saving: false, error: (t('general.saveFailed') + ': ' + e.message) }, { replace: true });
    }
  };

  const doDelete = async () => {
    if (!(await confirm(t('general.confirmDelete').replace('{no}', editing.code)))) return;
    try {
      await generalApi.delete(editing.id);
      setState({ editing: null, error: null }, { replace: true });
      reload();
    } catch (e) {
      setState({ error: e.message }, { replace: true });
    }
  };

  const accountSelect = (value, onChange) => (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">--</option>
      {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
    </select>
  );

  return (
    <div className="pad">
      <style>{CSS}</style>
      <div className="ghead">
        <h2>{editing.id ? t('general.edit') : t('general.new')} — {t('general.' + kind)}</h2>
        <button className="tb" onClick={() => setState({ editing: null, error: null })}>← {t('general.close')}</button>
      </div>

      <div className="invmaster">
        <label>{t('general.date')}
          <input type="date" value={editing.date || ''}
            onChange={(e) => setState({ editing: { ...editing, date: e.target.value } }, { replace: true })} />
        </label>
        <label>{t('general.partner')}
          <Autocomplete
            value={editing.partnerId ? { id: editing.partnerId, name: editing.partnerName || '' } : null}
            onChange={(p) => setState({ editing: { ...editing, partnerId: p?.id ?? '', partnerName: p?.name ?? '' } }, { replace: true })}
            fetcher={(q) => partnersStore.search(q)} placeholder={t('general.searchPartner')} />
        </label>
        <label>{t('general.name')}
          <input value={editing.name || ''}
            onChange={(e) => setState({ editing: { ...editing, name: e.target.value } }, { replace: true })} />
        </label>
        {kind === 'offset' && (<>
          <label>{t('general.accountDebit')}{accountSelect(lines[0]?.accountId, (id) => updateLine(0, { accountId: id }))}</label>
          <label>{t('general.accountCredit')}{accountSelect(lines[1]?.accountId, (id) => updateLine(1, { accountId: id }))}</label>
          <label>{t('general.amount')}
            <input type="number" min="0" step="1000" value={amount}
              onChange={(e) => setAmount(+e.target.value || 0)} />
          </label>
        </>)}
      </div>

      {kind === 'journal' && (<>
        <h3>{t('general.lines')}</h3>
        <table className="invtable linetable">
          <thead>
            <tr>
              <th>#</th>
              <th>{t('general.account')}</th>
              <th className="num">{t('general.debit')}</th>
              <th className="num">{t('general.credit')}</th>
              <th>{t('general.note')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{accountSelect(l.accountId, (id) => updateLine(i, { accountId: id }))}</td>
                <td className="num">
                  <input type="number" min="0" className="qty" value={l.debit || 0}
                    onChange={(e) => setLineAmount(i, 'debit', +e.target.value || 0)} />
                </td>
                <td className="num">
                  <input type="number" min="0" className="qty" value={l.credit || 0}
                    onChange={(e) => setLineAmount(i, 'credit', +e.target.value || 0)} />
                </td>
                <td><input value={l.note || ''} onChange={(e) => updateLine(i, { note: e.target.value })} /></td>
                <td><button type="button" className="xbtn" onClick={() => removeLine(i)}>🗑</button></td>
              </tr>
            ))}
            {!lines.length && (
              <tr><td colSpan={6} className="empty">{t('general.requiredAccount')}</td></tr>
            )}
          </tbody>
        </table>
        <button type="button" className="tb" onClick={addLine}>➕ {t('general.addLine')}</button>
        <div className="linetot">
          <span>{t('general.debit')}: <b>{vnd(totalDebit)}</b></span>
          <span>{t('general.credit')}: <b>{vnd(totalCredit)}</b></span>
        </div>
      </>)}

      <p className="muted">{PREFIX[kind]}0001…</p>
      {state.error && <p className="formError" role="alert">{state.error}</p>}

      <div className="formActions">
        <button className="btn" disabled={!savePerm || state.saving} onClick={save}>
          {state.saving ? t('general.saving') : t('general.save')}
        </button>
        <button className="tb" disabled={state.saving} onClick={() => setState({ editing: null, error: null })}>
          {t('general.cancel')}
        </button>
        {editing.id && can('general', 'delete') && (
          <button className="tb" disabled={state.saving} onClick={doDelete}>🗑 {t('general.delete')}</button>
        )}
      </div>
    </div>
  );
}


/* ---------- Bảng cân đối số phát sinh ---------- */

function TrialBalance({ state, setState }) {
  const { t } = useI18n();
  const params = { dateFrom: state.trialFrom, dateTo: state.trialTo };
  const { data, fetching, error, reload } = useAsyncQuery(
    'gen:trial:' + JSON.stringify(params),
    (signal) => generalApi.trialBalance(params, { signal }),
    {},
  );
  const rows = data?.items ?? [];
  const totals = data?.totals ?? {};

  return (
    <div className="pad">
      <style>{CSS}</style>
      <div className="ghead">
        <h2>{t('general.trialBalance')}</h2>
        <button className="tb" onClick={reload}>⟳ {t('common.refresh')}</button>
      </div>

      <div className="cattools">
        <label className="filter">
          <span>{t('general.fromDate')}</span>
          <input type="date" value={state.trialFrom ?? ''}
            onChange={(e) => setState({ trialFrom: e.target.value }, { replace: true })} />
        </label>
        <label className="filter">
          <span>{t('general.toDate')}</span>
          <input type="date" value={state.trialTo ?? ''}
            onChange={(e) => setState({ trialTo: e.target.value }, { replace: true })} />
        </label>
        <span className="catcount">{fetching ? '⏳ ' : ''}{rows.length} {t('general.account')}</span>
      </div>

      {error && (
        <p className="formError" role="alert">
          {t('general.loadFailed')}: {error.message}{' '}
          <button type="button" className="tb" onClick={reload}>{t('general.retry')}</button>
        </p>
      )}

      <table className="invtable" aria-busy={fetching}>
        <thead>
          <tr>
            <th>{t('general.accountCode')}</th>
            <th>{t('general.accountName')}</th>
            <th className="num">{t('general.openingDebit')}</th>
            <th className="num">{t('general.openingCredit')}</th>
            <th className="num">{t('general.periodDebit')}</th>
            <th className="num">{t('general.periodCredit')}</th>
            <th className="num">{t('general.closingDebit')}</th>
            <th className="num">{t('general.closingCredit')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.accountId}>
              <td>{r.code}</td>
              <td>{r.name}</td>
              <td className="num">{vnd(r.openingDebit)}</td>
              <td className="num">{vnd(r.openingCredit)}</td>
              <td className="num">{vnd(r.periodDebit)}</td>
              <td className="num">{vnd(r.periodCredit)}</td>
              <td className="num">{vnd(r.closingDebit)}</td>
              <td className="num">{vnd(r.closingCredit)}</td>
            </tr>
          ))}
          {!rows.length && !fetching && (
            <tr><td colSpan={8} className="empty">{t('general.noResult')}</td></tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}><b>{t('general.amount')}</b></td>
            <td className="num"><b>{vnd(totals.openingDebit)}</b></td>
            <td className="num"><b>{vnd(totals.openingCredit)}</b></td>
            <td className="num"><b>{vnd(totals.periodDebit)}</b></td>
            <td className="num"><b>{vnd(totals.periodCredit)}</b></td>
            <td className="num"><b>{vnd(totals.closingDebit)}</b></td>
            <td className="num"><b>{vnd(totals.closingCredit)}</b></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* ---------- Lệnh xử lý (dialog nằm trong ContentViewArea) ---------- */

function CommandView({ command, state, setState, can }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const accounts = accountsStore.use().items;
  const profitAccounts = accounts.filter((a) => /^421/.test(a.code || ''));
  const accountOptions = profitAccounts.length ? profitAccounts : accounts;

  const close = () => setState({ kind: 'journal', editing: null, error: null });

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body = {};
      if (command === 'profitLoss') {
        body.dateFrom = state.cmdFrom;
        body.dateTo = state.cmdTo;
        if (state.cmdAccountId) body.accountId = state.cmdAccountId;
      }
      if (command === 'renumber') body.type = state.cmdType || 'journal';
      if (command === 'print') {
        body.type = state.cmdPrintType || '';
        body.dateFrom = state.cmdFrom;
        body.dateTo = state.cmdTo;
      }
      setResult(await generalApi.command(COMMAND_API[command], body));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cmdwrap">
      <style>{CSS}</style>
      <div className="cmddlg" role="dialog" aria-modal="true" aria-label={t('general.' + command)}>
        <div className="cmdhead">
          <h2>{t('general.' + command)}</h2>
          <button className="tb" onClick={close}>✕ {t('general.closeDlg')}</button>
        </div>
        <p className="muted">{t('general.' + command + 'Hint')}</p>

        <div className="cmdparams">
          {(command === 'profitLoss' || command === 'print') && (<>
            <label>{t('general.fromDate')}
              <input type="date" value={state.cmdFrom ?? ''}
                onChange={(e) => setState({ cmdFrom: e.target.value }, { replace: true })} />
            </label>
            <label>{t('general.toDate')}
              <input type="date" value={state.cmdTo ?? ''}
                onChange={(e) => setState({ cmdTo: e.target.value }, { replace: true })} />
            </label>
          </>)}

          {command === 'profitLoss' && (
            <label>{t('general.profitAccount')}
              <select value={state.cmdAccountId || ''}
                onChange={(e) => setState({ cmdAccountId: e.target.value }, { replace: true })}>
                <option value="">421</option>
                {accountOptions.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </select>
            </label>
          )}

          {command === 'renumber' && (
            <label>{t('general.voucherType')}
              <select value={state.cmdType || 'journal'}
                onChange={(e) => setState({ cmdType: e.target.value }, { replace: true })}>
                {VOUCHER_KINDS.map((x) => <option key={x} value={x}>{t('general.' + x)}</option>)}
              </select>
            </label>
          )}

          {command === 'print' && (
            <label>{t('general.voucherType')}
              <select value={state.cmdPrintType ?? ''}
                onChange={(e) => setState({ cmdPrintType: e.target.value }, { replace: true })}>
                <option value="">{t('general.allTypes')}</option>
                {VOUCHER_KINDS.map((x) => <option key={x} value={x}>{t('general.' + x)}</option>)}
              </select>
            </label>
          )}
        </div>

        {error && <p className="cmderr" role="alert">{t('general.commandFailed')}: {error}</p>}

        {result && (
          <div className="cmdres" role="status">
            {command === 'profitLoss' && (
              <p>✅ {t('general.createdVoucher').replace('{no}', result.voucher?.code ?? '')} —{' '}
                {result.profit >= 0 ? t('general.profit') : t('general.loss')}: <b>{vnd(Math.abs(result.profit))}</b>{' '}
                ({t('general.revenue')}: {vnd(result.revenue)} · {t('general.cost')}: {vnd(result.cost)})</p>
            )}
            {command === 'renumber' && (
              <p>✅ {t('general.renumbered').replace('{n}', result.count)
                .replace('{first}', result.first ?? '').replace('{last}', result.last ?? '')}</p>
            )}
            {command === 'recalculate' && (
              <p>✅ {t('general.recalculated').replace('{n}', result.materials)
                .replace('{qty}', Number(result.totalQty || 0).toLocaleString('vi-VN'))
                .replace('{value}', vnd(result.totalValue))}</p>
            )}
            {command === 'print' && (<>
              <p>✅ {t('general.printed').replace('{n}', result.count)}</p>
              <table className="invtable">
                <thead>
                  <tr>
                    <th>{t('general.no')}</th>
                    <th>{t('general.date')}</th>
                    <th>{t('general.name')}</th>
                    <th className="num">{t('general.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(result.items ?? []).map((v) => (
                    <tr key={v.id}>
                      <td>{v.no}</td><td>{formatDate(v.date)}</td><td>{v.name}</td>
                      <td className="num">{vnd(v.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>)}
          </div>
        )}

        <div className="formActions">
          <button className="btn" disabled={busy || !can('general', 'create')} onClick={run}>
            {busy ? t('general.running') : t('general.run')}
          </button>
          <button className="tb" disabled={busy} onClick={close}>{t('general.cancel')}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- View ---------- */

function View(props) {
  if (!props.can('general', 'read')) return <Denied />;
  const kind = props.state.kind ?? 'journal';
  if (kind === 'trialBalance') return <TrialBalance {...props} />;
  if (COMMAND_API[kind]) return <CommandView key={kind} command={kind} {...props} />;
  return <VoucherView {...props} kind={VOUCHER_KINDS.includes(kind) ? kind : 'journal'} />;
}

export default {
  id: 'general', title: 'general.title', icon: '🧮', order: 8, messages, search, Menu, ribbon, View,
  initialState: {
    kind: 'journal', q: '', dateFrom: '', dateTo: '', page: 1, pageSize: 10,
    editing: null, error: null, saving: false,
    trialFrom: firstOfMonth(), trialTo: today(),
    cmdFrom: firstOfMonth(), cmdTo: today(),
    cmdType: 'journal', cmdPrintType: '', cmdAccountId: '',
  },
};

