import { useMemo, useState } from 'react';
import { useI18n } from '../../core/i18n.jsx';
import Denied from '../../core/Denied.jsx';
import { useDebounced } from '../../core/useDebounced.js';
import { useAsyncQuery } from '../../core/useasyncquery.js';
import { generalApi } from '../../api/generalApi.js';
import { cashApi } from '../../api/cashApi.js';
import { inventoryApi } from '../../api/inventoryApi.js';
import { accountsStore, vnd, formatDate } from '../../core/masterdata.js';

const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => today().slice(0, 8) + '01';
const qtyText = (n) => (n == null ? '' : Number(n).toLocaleString('vi-VN'));
// Chuẩn hoá chuỗi để tìm kiếm không phân biệt hoa/thường và dấu tiếng Việt
const fold = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

/* ---------- Cây báo cáo (nhóm I, II, III + mục trực tiếp) ---------- */

const GROUPS = [
  {
    id: 'g1', icon: '📘', title: 'reports.g1', items: [
      { id: 'g1-account-ledger', no: '1', icon: '📄', title: 'reports.accountLedger', source: 'general-lines', mode: 'account', kind: 'ledger', params: ['account'] },
      { id: 'g1-loan-ledger', no: '2', icon: '🏦', title: 'reports.loanLedger', source: 'general-lines', mode: 'loan', kind: 'ledger' },
      { id: 'g1-payment-ledger', no: '3', icon: '💳', title: 'reports.paymentLedger', source: 'general-lines', mode: 'payment', kind: 'ledger', params: ['partner'] },
      { id: 'g1-debt-summary', no: '4', icon: '📋', title: 'reports.debtSummary', source: 'general-lines', mode: 'debt-summary', kind: 'summary', params: ['partner'] },
      { id: 'g1-advance-summary', no: '5', icon: '🧾', title: 'reports.advanceSummary', source: 'general-lines', mode: 'advance-summary', kind: 'summary', params: ['partner'] },
      { id: 'g1-advance-ledger', no: '6', icon: '👤', title: 'reports.advanceLedger', source: 'general-lines', mode: 'advance', kind: 'ledger', params: ['partner'] },
      { id: 'g1-production-cost', no: '7', icon: '🏭', title: 'reports.productionCost', source: 'general-lines', mode: 'cost', kind: 'cost' },
      { id: 'g1-cash-ledger', no: '8', icon: '💵', title: 'reports.cashLedger', source: 'cash-book', kind: 'cashbook', params: ['account'] },
    ],
  },
  {
    id: 'g2', icon: '📗', title: 'reports.g2', items: [
      { id: 'g2-cash-ledger', no: '1', icon: '💵', title: 'reports.cashLedger', source: 'cash-book', kind: 'cashbook', params: ['account'] },
      { id: 'g2-general-ledger', no: '2', icon: '📚', title: 'reports.generalLedger', source: 'trial-balance', kind: 'trial' },
      { id: 'g2-detail-ledger', no: '3', icon: '📖', title: 'reports.detailLedger', source: 'trial-balance', kind: 'trial', params: ['account'] },
      { id: 'g2-loan-ledger', no: '4', icon: '🏦', title: 'reports.loanLedger', source: 'general-lines', mode: 'loan', kind: 'ledger' },
      { id: 'g2-payment-ledger', no: '5', icon: '💳', title: 'reports.paymentLedger', source: 'general-lines', mode: 'payment', kind: 'ledger', params: ['partner'] },
      { id: 'g2-debt-summary', no: '6', icon: '📋', title: 'reports.debtSummary', source: 'general-lines', mode: 'debt-summary', kind: 'summary', params: ['partner'] },
      { id: 'g2-advance-summary', no: '7', icon: '🧾', title: 'reports.advanceSummary', source: 'general-lines', mode: 'advance-summary', kind: 'summary', params: ['partner'] },
      { id: 'g2-advance-tracking', no: '8', icon: '👤', title: 'reports.advanceTracking', source: 'general-lines', mode: 'advance', kind: 'ledger', params: ['partner'] },
      { id: 'g2-general-journal', no: '9', icon: '📝', title: 'reports.generalJournal', source: 'general-lines', mode: 'all', kind: 'journal', params: ['q'] },
      { id: 'g2-sales-journal', no: 'a', sub: true, icon: '🛒', title: 'reports.salesJournal', source: 'sales', kind: 'sales', params: ['q'] },
      { id: 'g2-purchase-journal', no: 'b', sub: true, icon: '📦', title: 'reports.purchaseJournal', source: 'purchases', kind: 'purchases', params: ['q'] },
      { id: 'g2-receipt-journal', no: 'c', sub: true, icon: '📥', title: 'reports.receiptJournal', source: 'receipts', kind: 'cashjournal', params: ['q'] },
      { id: 'g2-payment-journal', no: 'd', sub: true, icon: '📤', title: 'reports.paymentJournal', source: 'payments', kind: 'cashjournal', params: ['q'] },
      { id: 'g2-production-cost', no: 'e', sub: true, icon: '🏭', title: 'reports.productionCost', source: 'general-lines', mode: 'cost', kind: 'cost' },
    ],
  },
  {
    id: 'g3', icon: '📙', title: 'reports.g3', items: [
      { id: 'g3-cash-ledger', no: '1', icon: '💵', title: 'reports.cashLedger', source: 'cash-book', kind: 'cashbook', params: ['account'] },
      { id: 'g3-account-ledger', no: '2', icon: '📄', title: 'reports.accountLedger', source: 'general-lines', mode: 'account', kind: 'ledger', params: ['account'] },
      { id: 'g3-account-main-ledger', no: '3', icon: '📚', title: 'reports.accountMainLedger', source: 'trial-balance', kind: 'trial', params: ['account'] },
      { id: 'g3-voucher-slip', no: '4', icon: '🧾', title: 'reports.voucherSlip', source: 'vouchers', kind: 'vouchers', params: ['q'] },
      { id: 'g3-voucher-register', no: '5', icon: '📑', title: 'reports.voucherRegister', source: 'vouchers', kind: 'vouchers', params: ['q'] },
      { id: 'g3-loan-ledger', no: '6', icon: '🏦', title: 'reports.loanLedger', source: 'general-lines', mode: 'loan', kind: 'ledger' },
      { id: 'g3-payment-ledger', no: '7', icon: '💳', title: 'reports.paymentLedger', source: 'general-lines', mode: 'payment', kind: 'ledger', params: ['partner'] },
      { id: 'g3-debt-summary', no: '8', icon: '📋', title: 'reports.debtSummary', source: 'general-lines', mode: 'debt-summary', kind: 'summary', params: ['partner'] },
      { id: 'g3-advance-summary', no: '9', icon: '🧾', title: 'reports.advanceSummary', source: 'general-lines', mode: 'advance-summary', kind: 'summary', params: ['partner'] },
      { id: 'g3-advance-tracking', no: 'a', sub: true, icon: '👤', title: 'reports.advanceTracking', source: 'general-lines', mode: 'advance', kind: 'ledger', params: ['partner'] },
      { id: 'g3-production-cost', no: 'b', sub: true, icon: '🏭', title: 'reports.productionCost', source: 'general-lines', mode: 'cost', kind: 'cost' },
    ],
  },
];

const DIRECT_REPORTS = [
  { id: 'financial-statements', icon: '📊', title: 'reports.financialStatements', source: 'trial-balance', kind: 'financial', params: ['statement'] },
  { id: 'total-debt', icon: '📌', title: 'reports.totalDebt', source: 'general-lines', mode: 'debt-summary', kind: 'summary', params: ['partner'] },
];

const ALL_REPORTS = [...GROUPS.flatMap((g) => g.items), ...DIRECT_REPORTS];

const COLUMNS = {
  ledger: [
    { key: 'date', label: 'reports.date' },
    { key: 'no', label: 'reports.no' },
    { key: 'name', label: 'reports.name' },
    { key: 'partner', label: 'reports.partner' },
    { key: 'account', label: 'reports.account' },
    { key: 'debit', label: 'reports.debit', num: true, money: true },
    { key: 'credit', label: 'reports.credit', num: true, money: true },
    { key: 'balance', label: 'reports.balance', num: true, money: true },
  ],
  summary: [
    { key: 'partner', label: 'reports.partner' },
    { key: 'debit', label: 'reports.debit', num: true, money: true },
    { key: 'credit', label: 'reports.credit', num: true, money: true },
    { key: 'balance', label: 'reports.balance', num: true, money: true },
  ],
  trial: [
    { key: 'code', label: 'reports.code' },
    { key: 'name', label: 'reports.accountName' },
    { key: 'openingDebit', label: 'reports.openingDebit', num: true, money: true },
    { key: 'openingCredit', label: 'reports.openingCredit', num: true, money: true },
    { key: 'periodDebit', label: 'reports.periodDebit', num: true, money: true },
    { key: 'periodCredit', label: 'reports.periodCredit', num: true, money: true },
    { key: 'closingDebit', label: 'reports.closingDebit', num: true, money: true },
    { key: 'closingCredit', label: 'reports.closingCredit', num: true, money: true },
  ],
  journal: [
    { key: 'date', label: 'reports.date' },
    { key: 'no', label: 'reports.no' },
    { key: 'name', label: 'reports.name' },
    { key: 'partner', label: 'reports.partner' },
    { key: 'account', label: 'reports.account' },
    { key: 'debit', label: 'reports.debit', num: true, money: true },
    { key: 'credit', label: 'reports.credit', num: true, money: true },
  ],
  cost: [
    { key: 'date', label: 'reports.date' },
    { key: 'no', label: 'reports.no' },
    { key: 'name', label: 'reports.name' },
    { key: 'account', label: 'reports.account' },
    { key: 'amount', label: 'reports.amount', num: true, money: true },
  ],
  cashbook: [
    { key: 'date', label: 'reports.date' },
    { key: 'no', label: 'reports.no' },
    { key: 'name', label: 'reports.name' },
    { key: 'partner', label: 'reports.partner' },
    { key: 'receipt', label: 'reports.receipt', num: true, money: true },
    { key: 'payment', label: 'reports.payment', num: true, money: true },
    { key: 'balance', label: 'reports.balance', num: true, money: true },
  ],
  sales: [
    { key: 'date', label: 'reports.date' },
    { key: 'no', label: 'reports.no' },
    { key: 'partner', label: 'reports.partner' },
    { key: 'product', label: 'reports.product' },
    { key: 'qty', label: 'reports.qty', num: true, qty: true },
    { key: 'price', label: 'reports.price', num: true, money: true },
    { key: 'revenue', label: 'reports.revenue', num: true, money: true },
  ],
  purchases: [
    { key: 'no', label: 'reports.no' },
    { key: 'date', label: 'reports.date' },
    { key: 'partner', label: 'reports.partner' },
    { key: 'note', label: 'reports.note' },
    { key: 'total', label: 'reports.total', num: true, money: true },
  ],
  cashjournal: [
    { key: 'date', label: 'reports.date' },
    { key: 'no', label: 'reports.no' },
    { key: 'name', label: 'reports.name' },
    { key: 'partner', label: 'reports.partner' },
    { key: 'amount', label: 'reports.amount', num: true, money: true },
  ],
  vouchers: [
    { key: 'date', label: 'reports.date' },
    { key: 'no', label: 'reports.no' },
    { key: 'name', label: 'reports.name' },
    { key: 'partner', label: 'reports.partner' },
    { key: 'amount', label: 'reports.amount', num: true, money: true },
  ],
};


const messages = {
  vi: {
    'reports.title': 'Báo cáo',
    'reports.g1': 'I: Hình thức Nhật ký Sổ Cái',
    'reports.g2': 'II: Hình thức Nhật ký Chung',
    'reports.g3': 'III: Hình thức Chứng từ Ghi sổ',
    'reports.accountLedger': 'Sổ Chi Tiết Các Tài Khoản',
    'reports.loanLedger': 'Sổ Chi Tiết Tiền Vay',
    'reports.paymentLedger': 'Sổ Chi Tiết Thanh Toán',
    'reports.debtSummary': 'Bảng Tổng Hợp Công Nợ',
    'reports.advanceSummary': 'Bảng Tổng Hợp Tạm Ứng',
    'reports.advanceLedger': 'Sổ Chi Tiết Tạm Ứng',
    'reports.advanceTracking': 'Sổ Chi Tiết Theo Dõi Tạm Ứng',
    'reports.productionCost': 'Sổ Chi Phí Sản Xuất Kinh Doanh',
    'reports.cashLedger': 'Sổ Kế Toán Chi Tiết Quỹ Tiền Mặt',
    'reports.generalLedger': 'Sổ Cái Tổng Hợp',
    'reports.detailLedger': 'Sổ Cái Chi Tiết',
    'reports.accountMainLedger': 'Sổ Cái Các Tài Khoản',
    'reports.generalJournal': 'Sổ Nhật Ký Chung',
    'reports.salesJournal': 'Sổ Nhật Ký Bán Hàng',
    'reports.purchaseJournal': 'Sổ Nhật Ký Mua Hàng',
    'reports.receiptJournal': 'Sổ Nhật Ký Thu Tiền',
    'reports.paymentJournal': 'Sổ Nhật Ký Chi Tiền',
    'reports.voucherSlip': 'Phiếu Chứng Từ Ghi Sổ',
    'reports.voucherRegister': 'Sổ Đăng Ký Chứng Từ Ghi Sổ',
    'reports.financialStatements': 'Báo Cáo Tài Chính',
    'reports.totalDebt': 'Tổng Hợp Công Nợ',
    'reports.fromDate': 'Từ ngày', 'reports.toDate': 'Đến ngày',
    'reports.account': 'Tài khoản', 'reports.all': 'Tất cả',
    'reports.partner': 'Đối tượng', 'reports.keyword': 'Từ khóa',
    'reports.statement': 'Loại báo cáo',
    'reports.balanceSheet': 'Bảng cân đối kế toán',
    'reports.incomeStatement': 'Báo cáo kết quả kinh doanh',
    'reports.date': 'Ngày', 'reports.no': 'Số hiệu', 'reports.name': 'Diễn giải',
    'reports.debit': 'Nợ', 'reports.credit': 'Có', 'reports.balance': 'Số dư',
    'reports.amount': 'Số tiền', 'reports.receipt': 'Thu', 'reports.payment': 'Chi',
    'reports.product': 'Mặt hàng', 'reports.qty': 'Số lượng', 'reports.price': 'Đơn giá',
    'reports.revenue': 'Doanh thu', 'reports.total': 'Tổng cộng', 'reports.note': 'Ghi chú',
    'reports.code': 'Mã TK', 'reports.accountName': 'Tên tài khoản',
    'reports.openingDebit': 'Dư Nợ đầu kỳ', 'reports.openingCredit': 'Dư Có đầu kỳ',
    'reports.periodDebit': 'Phát sinh Nợ', 'reports.periodCredit': 'Phát sinh Có',
    'reports.closingDebit': 'Dư Nợ cuối kỳ', 'reports.closingCredit': 'Dư Có cuối kỳ',
    'reports.opening': 'Số dư đầu kỳ', 'reports.closing': 'Số dư cuối kỳ',
    'reports.totalReceipt': 'Tổng thu', 'reports.totalPayment': 'Tổng chi',
    'reports.cost': 'Giá vốn', 'reports.profit': 'Lợi nhuận',
    'reports.run': 'Xem báo cáo', 'reports.loading': 'Đang tải…',
    'reports.empty': 'Không có dữ liệu trong kỳ.', 'reports.loadFailed': 'Không tải được báo cáo',
    'reports.retry': 'Thử lại', 'reports.rows': 'dòng',
    'reports.partnerHint': 'Lọc theo tên đối tượng…',
    'reports.keywordHint': 'Tìm theo số hiệu hoặc diễn giải…',
    'reports.hint': 'Chọn kỳ báo cáo và tham số, sau đó xem kết quả.',
    'reports.filterMenu': 'Filter menu...', 'reports.clearFilter': 'Xóa lọc',
  },
  en: {
    'reports.title': 'Reports',
    'reports.g1': 'I: General Ledger Form',
    'reports.g2': 'II: General Journal Form',
    'reports.g3': 'III: Voucher Ledger Form',
    'reports.accountLedger': 'Detail Ledger by Account',
    'reports.loanLedger': 'Loan Detail Ledger',
    'reports.paymentLedger': 'Payment Detail Ledger',
    'reports.debtSummary': 'Debt Summary',
    'reports.advanceSummary': 'Advance Summary',
    'reports.advanceLedger': 'Advance Detail Ledger',
    'reports.advanceTracking': 'Advance Tracking Detail Ledger',
    'reports.productionCost': 'Production and Business Cost Ledger',
    'reports.cashLedger': 'Cash Book Detail Ledger',
    'reports.generalLedger': 'General Ledger Summary',
    'reports.detailLedger': 'General Ledger Detail',
    'reports.accountMainLedger': 'Account General Ledger',
    'reports.generalJournal': 'General Journal',
    'reports.salesJournal': 'Sales Journal',
    'reports.purchaseJournal': 'Purchase Journal',
    'reports.receiptJournal': 'Cash Receipt Journal',
    'reports.paymentJournal': 'Cash Payment Journal',
    'reports.voucherSlip': 'Voucher for Ledger Entry',
    'reports.voucherRegister': 'Voucher Register',
    'reports.financialStatements': 'Financial Statements',
    'reports.totalDebt': 'Debt Summary',
    'reports.fromDate': 'From', 'reports.toDate': 'To',
    'reports.account': 'Account', 'reports.all': 'All',
    'reports.partner': 'Partner', 'reports.keyword': 'Keyword',
    'reports.statement': 'Statement',
    'reports.balanceSheet': 'Balance Sheet',
    'reports.incomeStatement': 'Income Statement',
    'reports.date': 'Date', 'reports.no': 'No.', 'reports.name': 'Description',
    'reports.debit': 'Debit', 'reports.credit': 'Credit', 'reports.balance': 'Balance',
    'reports.amount': 'Amount', 'reports.receipt': 'Receipt', 'reports.payment': 'Payment',
    'reports.product': 'Item', 'reports.qty': 'Qty', 'reports.price': 'Unit price',
    'reports.revenue': 'Revenue', 'reports.total': 'Total', 'reports.note': 'Note',
    'reports.code': 'Account code', 'reports.accountName': 'Account name',
    'reports.openingDebit': 'Opening debit', 'reports.openingCredit': 'Opening credit',
    'reports.periodDebit': 'Period debit', 'reports.periodCredit': 'Period credit',
    'reports.closingDebit': 'Closing debit', 'reports.closingCredit': 'Closing credit',
    'reports.opening': 'Opening balance', 'reports.closing': 'Closing balance',
    'reports.totalReceipt': 'Total receipts', 'reports.totalPayment': 'Total payments',
    'reports.cost': 'Cost', 'reports.profit': 'Profit',
    'reports.run': 'Run report', 'reports.loading': 'Loading…',
    'reports.empty': 'No data in this period.', 'reports.loadFailed': 'Could not load report',
    'reports.retry': 'Retry', 'reports.rows': 'rows',
    'reports.partnerHint': 'Filter by partner name…',
    'reports.keywordHint': 'Search by voucher no. or description…',
    'reports.hint': 'Choose the period and parameters, then run the report.',
    'reports.filterMenu': 'Filter menu...', 'reports.clearFilter': 'Clear filter',
  },
};


/* ---------- Nguồn dữ liệu ---------- */

function loadReport(report, params, signal) {
  const opts = { signal };
  switch (report.source) {
    case 'cash-book': return cashApi.book(params, opts);
    case 'trial-balance': return generalApi.trialBalance(params, opts);
    case 'general-lines': return generalApi.list(params, opts);
    case 'sales': return inventoryApi.sales(params);
    case 'purchases': return inventoryApi.list(params);
    case 'receipts':
    case 'payments': return cashApi.list(params, opts);
    case 'vouchers': return generalApi.list(params, opts);
    default: return Promise.resolve(null);
  }
}

const num = (v) => Number(v) || 0;
const byDate = (a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')) || String(a.no ?? '').localeCompare(String(b.no ?? ''));

function buildRows(report, data, { accountId, partner, statement }, accountMap) {
  if (!data) return [];

  const codeOf = (id) => accountMap.get(id)?.code ?? '';
  const labelOf = (id) => {
    const a = accountMap.get(id);
    return a ? `${a.code} - ${a.name}` : '';
  };
  const hasCode = (id, prefixes) => prefixes.some((p) => codeOf(id).startsWith(p));
  const partnerMatch = (name) => !partner || String(name ?? '').toLowerCase().includes(partner.toLowerCase());

  if (report.source === 'cash-book') {
    return (data.items ?? [])
      .filter((r) => partnerMatch(r.partnerName))
      .map((r) => ({
        id: r.id ?? r.no,
        date: r.date, no: r.no, name: r.name, partner: r.partnerName,
        receipt: num(r.receipt), payment: num(r.payment), balance: num(r.balance),
      }));
  }

  if (report.source === 'trial-balance') {
    let rows = (data.items ?? []).map((r) => ({ ...r, id: r.accountId ?? r.code }));
    if (report.params?.includes('account') && accountId) rows = rows.filter((r) => r.accountId === accountId);
    if (report.kind === 'financial') {
      const balanceSheet = statement !== 'income-statement';
      rows = rows.filter((r) => (balanceSheet ? /^[1-4]/.test(r.code || '') : /^[5-9]/.test(r.code || '')));
    }
    return rows;
  }


  if (report.source === 'general-lines') {
    const lines = [];
    (data.items ?? []).forEach((v) => (v.lines ?? []).forEach((l) => {
      lines.push({
        id: `${v.id}-${l.id}`, date: v.date, no: v.code, name: v.name,
        partner: v.partnerName, accountId: l.accountId, account: labelOf(l.accountId),
        note: l.note, debit: num(l.debit), credit: num(l.credit),
      });
    }));

    let rows = lines;
    if (report.mode === 'account') {
      if (accountId) rows = rows.filter((l) => l.accountId === accountId);
    } else if (report.mode === 'loan') {
      rows = rows.filter((l) => hasCode(l.accountId, ['31', '34']));
    } else if (report.mode === 'payment') {
      rows = rows.filter((l) => hasCode(l.accountId, ['131', '331']));
    } else if (report.mode === 'advance' || report.mode === 'advance-summary') {
      rows = rows.filter((l) => hasCode(l.accountId, ['141']));
    } else if (report.mode === 'debt-summary') {
      rows = rows.filter((l) => hasCode(l.accountId, ['131', '331']));
    } else if (report.mode === 'cost') {
      rows = rows.filter((l) => hasCode(l.accountId, ['6', '8']));
    }
    rows = rows.filter((l) => partnerMatch(l.partner)).sort(byDate);

    if (report.mode === 'debt-summary' || report.mode === 'advance-summary') {
      const map = new Map();
      rows.forEach((l) => {
        const key = l.partner || '';
        const item = map.get(key) ?? { id: 'p:' + key, partner: key, debit: 0, credit: 0 };
        item.debit += l.debit;
        item.credit += l.credit;
        map.set(key, item);
      });
      return [...map.values()].map((r) => ({ ...r, balance: r.debit - r.credit }));
    }

    if (report.mode === 'cost') return rows.map((l) => ({ ...l, amount: l.debit || l.credit }));

    let balance = 0;
    return rows.map((l) => {
      balance += l.debit - l.credit;
      return { ...l, balance };
    });
  }

  if (report.source === 'sales') {
    return (data.items ?? [])
      .filter((r) => partnerMatch(r.partnerName))
      .map((r, i) => ({
        id: `${r.no}-${r.productId}-${i}`,
        date: r.date, no: r.no, partner: r.partnerName, product: r.productName,
        qty: num(r.qty), price: num(r.price), revenue: num(r.revenue),
      }));
  }

  if (report.source === 'purchases') {
    return (data.items ?? [])
      .filter((d) => partnerMatch(d.partner?.name))
      .map((d) => ({
        id: d.id, no: d.no, date: d.date, partner: d.partner?.name ?? '', note: d.note ?? '',
        total: (d.lines ?? []).reduce((s, l) => s + num(l.qty) * num(l.price), 0),
      }));
  }

  if (report.source === 'receipts' || report.source === 'payments' || report.source === 'vouchers') {
    return (data.items ?? [])
      .filter((v) => partnerMatch(v.partnerName))
      .map((v) => ({
        id: v.id, date: v.date, no: v.code, name: v.name, partner: v.partnerName, amount: num(v.amount),
      }));
  }

  return [];
}


function reportSummary(report, data, rows, accountId) {
  const sum = (key) => rows.reduce((s, r) => s + num(r[key]), 0);
  if (report.kind === 'cashbook') {
    return [
      ['reports.opening', data?.opening],
      ['reports.totalReceipt', data?.totalReceipt],
      ['reports.totalPayment', data?.totalPayment],
      ['reports.closing', data?.closing],
    ];
  }
  if (report.kind === 'sales') {
    const out = [['reports.revenue', data?.totals?.revenue]];
    if (data?.withCost) out.push(['reports.cost', data.totals.cost], ['reports.profit', data.totals.profit]);
    return out;
  }
  if (report.kind === 'trial' || report.kind === 'financial') {
    const keys = ['openingDebit', 'openingCredit', 'periodDebit', 'periodCredit', 'closingDebit', 'closingCredit'];
    const filtered = report.params?.includes('account') || report.kind === 'financial' || !!accountId;
    return keys.map((k) => ['reports.' + k, filtered ? sum(k) : (data?.totals?.[k] ?? 0)]);
  }
  if (report.kind === 'purchases') return [['reports.total', sum('total')]];
  if (report.kind === 'cashjournal' || report.kind === 'vouchers') return [['reports.total', sum('amount')]];
  return [['reports.debit', sum('debit')], ['reports.credit', sum('credit')]];
}


/* ---------- MiniSidebar: nhóm báo cáo có thể thu gọn ---------- */

function Menu({ state, setState }) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [filterOpen, setFilterOpen] = useState({}); // ghi đè thu gọn khi đang lọc
  const keyword = fold(q.trim());
  const activeGroup = GROUPS.find((g) => g.items.some((r) => r.id === state.report))?.id;
  const saved = state.openGroups ?? {};
  const isOpen = (id) => saved[id] ?? (id === activeGroup || (!state.openGroups && id === 'g1'));
  const expandedOf = (id) => (keyword ? (filterOpen[id] ?? true) : isOpen(id));
  const toggle = (id) => {
    if (keyword) { setFilterOpen((o) => ({ ...o, [id]: !(o[id] ?? true) })); return; }
    setState({ openGroups: { ...saved, [id]: !isOpen(id) } }, { replace: true });
  };
  const select = (id) => setState({ report: id });
  const clearFilter = () => { setQ(''); setFilterOpen({}); };
  const match = (r) => !keyword || fold(t(r.title)).includes(keyword);
  const groups = GROUPS
    .map((g) => ({ ...g, items: g.items.filter(match) }))
    .filter((g) => !keyword || g.items.length);
  const directs = DIRECT_REPORTS.filter(match);
  const empty = !!keyword && !groups.length && !directs.length;

  const item = (r) => (
    <button key={r.id} type="button"
      aria-current={state.report === r.id ? 'page' : undefined}
      className={'item ritem' + (r.sub ? ' sub' : '') + (state.report === r.id ? ' on' : '')}
      onClick={() => select(r.id)}>
      {r.no && <span className="rno" aria-hidden="true">{r.no}.</span>}
      <span>{r.icon} {t(r.title)}</span>
    </button>
  );

  return (<>
    <h3>{t('reports.title')}</h3>
    <div className="rmenufilter">
      <div className="searchbox">
        <span aria-hidden="true">🔍</span>
        <input type="search" value={q} placeholder={t('reports.filterMenu')}
          aria-label={t('reports.filterMenu')}
          onChange={(e) => { setQ(e.target.value); if (!e.target.value) setFilterOpen({}); }} />
        {q && <button type="button" className="xbtn" title={t('reports.clearFilter')}
          aria-label={t('reports.clearFilter')} onClick={clearFilter}>✕</button>}
      </div>
    </div>
    {groups.map((g) => {
      const expanded = expandedOf(g.id);
      return (
        <div className="rgroup" key={g.id}>
          <button type="button" className="rgroup-head" aria-expanded={expanded}
            aria-controls={'rgroup-' + g.id} onClick={() => toggle(g.id)}>
            <span className="rchev" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
            <span>{g.icon} {t(g.title)}</span>
          </button>
          {expanded && <div className="rgroup-body" id={'rgroup-' + g.id}>{g.items.map(item)}</div>}
        </div>
      );
    })}
    {directs.length > 0 && <div className="rsep" />}
    {directs.map(item)}
    {empty && <p className="muted rfilterempty">{t('ac.empty')}</p>}
  </>);
}


/* ---------- ContentViewArea: tham số + kết quả ---------- */

function ReportParams({ report, state, setState, accounts, reload, fetching }) {
  const { t } = useI18n();
  const set = (patch) => setState(patch, { replace: true });
  const cashAccounts = accounts.filter((a) => /^111/.test(a.code || ''));
  const accountOptions = report.kind === 'cashbook' && cashAccounts.length ? cashAccounts : accounts;

  return (
    <div className="cattools">
      <label className="filter">
        <span>{t('reports.fromDate')}</span>
        <input type="date" value={state.from ?? firstOfMonth()}
          onChange={(e) => set({ from: e.target.value })} />
      </label>
      <label className="filter">
        <span>{t('reports.toDate')}</span>
        <input type="date" value={state.to ?? today()}
          onChange={(e) => set({ to: e.target.value })} />
      </label>

      {report.params?.includes('account') && (
        <label className="filter">
          <span>{t('reports.account')}</span>
          <select value={state.accountId ?? ''} onChange={(e) => set({ accountId: e.target.value })}>
            <option value="">{t('reports.all')}</option>
            {accountOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
            ))}
          </select>
        </label>
      )}

      {report.params?.includes('partner') && (
        <label className="filter">
          <span>{t('reports.partner')}</span>
          <input type="text" value={state.partner ?? ''} placeholder={t('reports.partnerHint')}
            onChange={(e) => set({ partner: e.target.value })} />
        </label>
      )}

      {report.params?.includes('q') && (
        <label className="filter">
          <span>{t('reports.keyword')}</span>
          <input type="search" value={state.q ?? ''} placeholder={t('reports.keywordHint')}
            onChange={(e) => set({ q: e.target.value })} />
        </label>
      )}

      {report.params?.includes('statement') && (
        <label className="filter">
          <span>{t('reports.statement')}</span>
          <select value={state.statement ?? 'balance-sheet'}
            onChange={(e) => set({ statement: e.target.value })}>
            <option value="balance-sheet">{t('reports.balanceSheet')}</option>
            <option value="income-statement">{t('reports.incomeStatement')}</option>
          </select>
        </label>
      )}

      <button type="button" className="btn" onClick={reload} disabled={fetching}>
        {fetching ? t('reports.loading') : t('reports.run')}
      </button>
    </div>
  );
}

function ReportTable({ report, rows, fetching }) {
  const { t } = useI18n();
  const cols = report.kind === 'financial' ? COLUMNS.trial : (COLUMNS[report.kind] ?? COLUMNS.vouchers);
  return (
    <table className="invtable" aria-busy={fetching}>
      <thead>
        <tr>{cols.map((c) => <th key={c.key} className={c.num ? 'num' : undefined}>{t(c.label)}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.id ?? i}>
            {cols.map((c) => (
              <td key={c.key} className={c.num ? 'num' : undefined}>
                {c.qty ? qtyText(r[c.key]) : c.money ? vnd(r[c.key]) : c.key === 'date' ? formatDate(r[c.key]) : (r[c.key] ?? '')}
              </td>
            ))}
          </tr>
        ))}
        {!rows.length && !fetching && (
          <tr><td colSpan={cols.length} className="empty">{t('reports.empty')}</td></tr>
        )}
      </tbody>
    </table>
  );
}


function ReportPage({ report, state, setState }) {
  const { t } = useI18n();
  const accounts = accountsStore.use().items;
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const keyword = state.q ?? '';
  const settledKeyword = useDebounced(keyword, 300);
  const dateFrom = state.from ?? firstOfMonth();
  const dateTo = state.to ?? today();
  const accountId = state.accountId ?? '';
  const partner = state.partner ?? '';
  const statement = state.statement ?? 'balance-sheet';

  const params = useMemo(() => {
    const p = { dateFrom, dateTo };
    if (report.params?.includes('q') && settledKeyword) p.q = settledKeyword;
    if (report.source === 'cash-book' && accountId) p.accountId = accountId;
    if (report.source === 'purchases') p.type = 'import';
    if (report.source === 'receipts') p.type = 'receipt';
    if (report.source === 'payments') p.type = 'payment';
    return p;
  }, [report, dateFrom, dateTo, settledKeyword, accountId]);

  const { data, fetching, error, reload } = useAsyncQuery(
    'reports:' + report.id + ':' + JSON.stringify(params) + ':' + (state.refresh ?? 0),
    (signal) => loadReport(report, params, signal),
    { enabled: keyword === settledKeyword },
  );

  const rows = useMemo(
    () => buildRows(report, data, { accountId, partner, statement }, accountMap),
    [report, data, accountId, partner, statement, accountMap],
  );
  const summary = reportSummary(report, data, rows, accountId);

  return (
    <div className="pad">
      <div className="ghead">
        <div>
          <h2>{t(report.title)}</h2>
          <p className="muted">{t('reports.hint')}</p>
        </div>
        <button type="button" className="tb" onClick={reload}>⟳ {t('common.refresh')}</button>
      </div>

      <ReportParams report={report} state={state} setState={setState}
        accounts={accounts} reload={reload} fetching={fetching} />
      <span className="catcount">{fetching ? '⏳ ' : ''}{rows.length} {t('reports.rows')}</span>

      {error && (
        <p className="formError" role="alert"
          style={{ margin: '8px 0', padding: '8px 12px', background: '#fdecea', color: '#b42318', borderRadius: 6 }}>
          {t('reports.loadFailed')}: {error.message}{' '}
          <button type="button" className="tb" onClick={reload}>{t('reports.retry')}</button>
        </p>
      )}

      {data && (
        <div className="reportsum">
          {summary.map(([label, value]) => (
            <span key={label}>{t(label)}: <b>{vnd(value)}</b></span>
          ))}
        </div>
      )}

      <ReportTable report={report} rows={rows} fetching={fetching} />
    </div>
  );
}

function View(props) {
  if (!props.can('reports', 'read')) return <Denied />;
  const report = ALL_REPORTS.find((r) => r.id === props.state.report) ?? ALL_REPORTS[0];
  return <ReportPage key={report.id} report={report} state={props.state} setState={props.setState} />;
}

const refresh = ({ state, setState }) => setState({ refresh: (state.refresh ?? 0) + 1 }, { replace: true });

export default {
  id: 'reports', title: 'reports.title', icon: '📊', order: 9, messages, Menu, refresh, View,
  initialState: {
    report: 'g1-account-ledger', openGroups: { g1: true },
    from: firstOfMonth(), to: today(), accountId: '', partner: '', q: '',
    statement: 'balance-sheet', refresh: 0,
  },
};

