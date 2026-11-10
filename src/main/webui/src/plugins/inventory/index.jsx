import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useI18n } from '../../core/i18n.jsx';
import { Loading } from '../../core/ui.jsx';
import Denied from '../../core/Denied.jsx';
import Autocomplete from '../../core/Autocomplete.jsx';
import { useConfirm } from '../../core/confirm.jsx';
import { inventoryApi } from '../../api/inventoryApi.js';   // FE-ST8: một nguồn API cho domain kho
import { cashApi } from '../../api/cashApi.js';
import { settingsApi } from '../../api/settingsApi.js';
import { printVoucher } from './voucher.js';
import { ArrowDownToLine, ArrowRightLeft, BarChart3, BookOpen, FileText, Receipt, Truck } from '../../core/icons.jsx';
import { useDebounced } from '../../core/useDebounced.js';
import { useAsyncQuery } from '../../core/useasyncquery.js';

import { suppliersStore, customersStore, warehousesStore, banksStore, materialsStore, searchSuppliers, searchCustomers, searchWarehouses, searchBanks, searchMaterials, vnd, registerReset } from '../../core/masterdata.js';

const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => today().slice(0, 8) + '01';
const PREFIX = { import: 'PN', export: 'PX', return: 'PT', transfer: 'PC' };
const lineTotal = (lines) => (lines || []).reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
const blankDoc = (type) => ({ type, partner: null, bank: null, warehouseIn: null, warehouseOut: null, date: today(), note: '', lines: [] });

// ---------- Store dùng API Thật ----------
// Truy vấn hiện tại được giữ lại để nút ⟳ / sau khi ghi có thể tải lại đúng trang đang xem.
let lastQuery = {};
let st = { docs: [], total: 0, loading: false, error: null };
const subs = new Set();
const set = (p) => { st = { ...st, ...p }; subs.forEach((f) => f()); };
const useDocs = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => st);

let idSeq = Date.now();
const nextId = () => ++idSeq;

// Tải danh sách theo điều kiện tìm kiếm/lọc/sắp xếp/phân trang (không truyền ⇒ dùng lại truy vấn gần nhất).
// Server trả { items, total } — items đã được cắt theo trang nên FE không lọc/phân trang lại.
async function load(params) {
  if (params !== undefined) lastQuery = params;
  set({ loading: true, error: null });
  try {
    const res = await inventoryApi.list(lastQuery);
    const docs = Array.isArray(res) ? res : (res?.items ?? []);
    set({ docs, total: Array.isArray(res) ? docs.length : (res?.total ?? docs.length), loading: false });
  } catch (err) {
    set({ loading: false, error: err?.message ?? String(err) });
  }
}

// Xoá cache khi đăng xuất / đổi tài khoản (FE-ST6) — auth.jsx gọi gián tiếp qua resetAllStores()
function resetDocs() {
  lastQuery = {};
  set({ docs: [], total: 0, loading: false, error: null });
}
registerReset(resetDocs);

async function saveDoc(doc, asImport = false) {
  const payload = {
    ...doc,
    bank: (doc.bank && doc.bank.id) ? { id: doc.bank.id, name: doc.bank.name } : null,
    warehouseIn: (doc.type === 'import' || doc.type === 'return' || doc.type === 'transfer') && doc.warehouseIn?.id
      ? { id: doc.warehouseIn.id, name: doc.warehouseIn.name } : null,
    warehouseOut: (doc.type === 'export' || doc.type === 'transfer') && doc.warehouseOut?.id
      ? { id: doc.warehouseOut.id, name: doc.warehouseOut.name } : null,
    partner: (doc.partner && doc.partner.id) ? { id: doc.partner.id, name: doc.partner.name } : null,
    lines: (doc.lines || []).map((l) => ({
      ...l,
      id: typeof l.id === 'number' && l.id < 100000000 ? l.id : null,
      product: l.product ? { id: l.product.id, name: l.product.name } : null,
      qty: Number(l.qty) || 0,
      price: Number(l.price) || 0,
    })),
  };

  const saved = payload.id
    ? (await inventoryApi.update(payload.id, payload)) ?? payload
    : asImport ? await inventoryApi.importDocs([payload]) : await inventoryApi.create(payload);
  await load();                       // total/trang do server quyết định ⇒ luôn tải lại sau khi ghi (FE-ST5)
  return saved;
}

async function removeDoc(id, deleteLinked) {
  await inventoryApi.delete(id, deleteLinked);
  await load();
}

async function removeDocs(ids, deleteLinked) {
  await inventoryApi.bulkDelete(ids, deleteLinked);
  await load();
}

async function requestDeleteDoc({ doc, t, confirm, onOpenPromptModal, onSuccess }) {
  if (doc.type !== 'import' && doc.type !== 'export' && doc.type !== 'return') {
    if (!(await confirm(t('inv.confirmDelete').replace('{name}', doc.no)))) return;
    try {
      await removeDoc(doc.id, false);
      onSuccess?.();
    } catch (e) {
      alert((t('inv.deleteFailed') || 'Xóa thất bại') + ': ' + (e?.message ?? e));
    }
    return;
  }

  let linkedVoucher = null;
  let policy = 'prompt';
  try {
    const [linkedRes, policyRes] = await Promise.all([
      cashApi.getBySource(doc.id).catch(() => null),
      settingsApi.get('inv_delete_policy').catch(() => null),
    ]);
    if (linkedRes && linkedRes.id && linkedRes.status !== 'cancelled') {
      linkedVoucher = linkedRes;
    }
    if (policyRes?.value) {
      policy = policyRes.value;
    }
  } catch (err) {
    console.error(err);
  }

  if (!linkedVoucher) {
    if (!(await confirm(t('inv.confirmDelete').replace('{name}', doc.no)))) return;
    try {
      await removeDoc(doc.id, false);
      onSuccess?.();
    } catch (e) {
      alert((t('inv.deleteFailed') || 'Xóa thất bại') + ': ' + (e?.message ?? e));
    }
    return;
  }

  const voucherTypeName = linkedVoucher.type === 'receipt' ? 'Phiếu thu' : 'Phiếu chi';
  const voucherInfo = `${voucherTypeName} ${linkedVoucher.no || ''} (${vnd(linkedVoucher.amount || 0)})`;

  if (policy === 'block') {
    alert(t('inv.deleteBlockedNotice').replace('{name}', doc.no).replace('{linked}', voucherInfo));
    return;
  }

  if (policy === 'cascade') {
    const ok = await confirm(
      t('inv.confirmDeleteCascade').replace('{name}', doc.no).replace('{linked}', voucherInfo)
    );
    if (!ok) return;
    try {
      await removeDoc(doc.id, true);
      onSuccess?.();
    } catch (e) {
      alert((t('inv.deleteFailed') || 'Xóa thất bại') + ': ' + (e?.message ?? e));
    }
    return;
  }

  // policy === 'prompt'
  onOpenPromptModal({
    doc,
    voucher: linkedVoucher,
    voucherInfo,
    onSuccess,
  });
}

// Global Search: gọi server (không phụ thuộc trang đang xem). Lỗi ⇒ trả [] để không làm vỡ khung tìm kiếm chung.
const search = async (q) => {
  const needle = (q ?? '').trim();
  if (!needle) return [];
  try {
    const res = await inventoryApi.list({ q: needle, page: 1, pageSize: 20 });
    const rows = Array.isArray(res) ? res : (res?.items ?? []);
    return rows.map((d) => ({ id: d.id, title: d.no, subtitle: d.partner?.name ?? d.type, state: { mode: 'form', editing: d } }));
  } catch {
    return [];
  }
};

const messages = {
  vi: { 'inv.importFile': 'Import', 'inv.importTitle': 'Import phiếu từ file CSV', 'inv.importTemplate': 'Tải file mẫu', 'inv.close': 'Đóng',
    'inv.importHint': 'File CSV (UTF-8, phân tách bằng , hoặc ;). Mỗi dòng là 1 dòng hàng; các dòng cùng cột "ref" thuộc cùng 1 phiếu. Cột bắt buộc: type (import/export/return), partner, product, qty. Đối tác/sản phẩm/ngân hàng chưa có sẽ được tạo mới trong Danh mục nếu bạn có quyền.',
    'inv.importBusy': 'Đang import…', 'inv.importDone': 'Đã import {n} phiếu.', 'inv.importErrors': '{n} lỗi (các phiếu lỗi được bỏ qua):',
    'inv.errEmpty': 'File trống', 'inv.errRead': 'Không đọc được file', 'inv.errHeader': 'File thiếu cột bắt buộc: {cols}',
    'inv.errLine': 'Dòng {line}: {msg}', 'inv.errType': 'Loại phiếu không hợp lệ (import/export/return)', 'inv.errPartner': 'Thiếu đối tác',
    'inv.errDate': 'Ngày không hợp lệ (YYYY-MM-DD hoặc DD/MM/YYYY)', 'inv.errProduct': 'Thiếu sản phẩm', 'inv.errQty': 'Số lượng phải lớn hơn 0',
    'inv.errPrice': 'Đơn giá không hợp lệ', 'inv.errNotFound': 'Không tìm thấy "{name}" trong Danh mục',
    'inv.selectAll': 'Chọn tất cả trên trang', 'inv.selectRow': 'Chọn phiếu', 'inv.selected': 'Đã chọn {n} phiếu',
    'inv.clearSel': 'Bỏ chọn', 'inv.deleteSelected': 'Xóa đã chọn', 'inv.confirmBulkDelete': 'Bạn có chắc muốn xóa {n} phiếu đã chọn? Thao tác này không thể hoàn tác.',
    'inv.title': 'Nhập xuất kho', 'inv.filters': 'Loại phiếu', 'inv.all': 'Tất cả', 'inv.import': 'Nhập kho', 'inv.export': 'Xuất kho', 'inv.return': 'Trả hàng', 'inv.transfer': 'Điều chuyển',
    'inv.no': 'Số phiếu', 'inv.type': 'Loại phiếu', 'inv.partner': 'Đối tác', 'inv.supplier': 'Nhà cung cấp', 'inv.customer': 'Khách hàng',
    'inv.date': 'Ngày', 'inv.note': 'Ghi chú', 'inv.lines': 'Chi tiết hàng hóa', 'inv.product': 'Sản phẩm', 'inv.qty': 'Số lượng', 'inv.price': 'Đơn giá',
    'inv.lineTotal': 'Thành tiền', 'inv.grandTotal': 'Tổng cộng', 'inv.addLine': 'Thêm dòng', 'inv.save': 'Lưu phiếu', 'inv.delete': 'Xóa phiếu',
    'inv.back': 'Danh sách', 'inv.empty': 'Chưa có phiếu nào.', 'inv.validate': 'Vui lòng chọn đối tác và thêm ít nhất 1 dòng hàng (mỗi dòng phải chọn sản phẩm, số lượng > 0).',
    'inv.validateWarehouse': 'Phiếu điều chuyển phải chọn đủ kho nhập và kho xuất.',
    'inv.bank': 'Ngân hàng thanh toán', 'inv.searchBank': 'Gõ để tìm ngân hàng…', 'inv.newSupplier': 'nhà cung cấp', 'inv.newCustomer': 'khách hàng', 'inv.newMaterial': 'vật tư', 'inv.newBank': 'ngân hàng',
    'inv.warehouseIn': 'Kho nhập', 'inv.warehouseOut': 'Kho xuất', 'inv.searchWarehouse': 'Gõ để tìm kho…', 'inv.newWarehouse': 'kho',
    'inv.searchPartner': 'Gõ để tìm…', 'inv.searchProduct': 'Gõ để tìm sản phẩm…', 'inv.newImport': 'Phiếu nhập mới', 'inv.newExport': 'Phiếu xuất mới', 'inv.newReturn': 'Phiếu trả mới', 'inv.newTransfer': 'Phiếu điều chuyển', 'inv.newGroup': 'Tạo phiếu',
    'inv.search': 'Tìm theo số phiếu, đối tác, ghi chú…', 'inv.clear': 'Xóa bộ lọc', 'inv.noResult': 'Không có kết quả phù hợp.',
    'inv.range': 'Hiển thị {from}–{to} / {total}', 'inv.dateFrom': 'Từ ngày', 'inv.dateTo': 'Đến ngày',
    'inv.perPage': 'Dòng/trang', 'inv.pageOf': 'Trang {p} / {n}', 'inv.first': 'Trang đầu', 'inv.prev': 'Trang trước', 'inv.next': 'Trang sau', 'inv.last': 'Trang cuối',
    'inv.confirmDeleteLine': 'Bạn có chắc muốn xóa dòng "{name}"?',
    'inv.master': 'Thông tin chung', 'inv.collapse': 'Thu gọn', 'inv.expand': 'Mở rộng',
    'inv.moveUp': 'Chuyển lên', 'inv.moveDown': 'Chuyển xuống', 'inv.drag': 'Kéo để đổi thứ tự',
    'inv.edit': 'Sửa', 'inv.deleteRow': 'Xóa', 'inv.confirmDelete': 'Bạn có chắc muốn xóa phiếu "{name}"? Thao tác này không thể hoàn tác.',
    'inv.loadFailed': 'Không tải được danh sách phiếu', 'inv.saveFailed': 'Lưu phiếu thất bại', 'inv.deleteFailed': 'Không xóa được phiếu',
    'inv.createReceiptOnSave': 'Tạo phiếu thu tiền mặt ngay (Bán hàng thu tiền ngay)',
    'inv.createReceiptHint': 'Hệ thống sẽ tự động tạo một phiếu thu tiền mặt liên kết trực tiếp với phiếu xuất kho này.',
    'inv.linkedReceipt': 'Phiếu thu liên kết',
    'inv.openReceipt': 'Xem phiếu thu',
    'inv.receiptCreated': 'Đã tạo phiếu thu tiền mặt',
    'inv.receiptCreateFailed': 'Lưu phiếu xuất thành công nhưng không tạo được phiếu thu',
    'inv.deleteBlockedNotice': 'Phiếu kho "{name}" đang có chứng từ liên kết: {linked}.\n\nHệ thống đang thiết lập CHẶN xóa khi còn chứng từ liên kết. Vui lòng hủy chứng từ liên kết trước khi xóa phiếu kho.',
    'inv.confirmDeleteCascade': 'Phiếu kho "{name}" đang có chứng từ liên kết: {linked}.\n\nHệ thống đang thiết lập TỰ ĐỘNG HỦY chứng từ liên kết khi xóa. Bạn có chắc chắn muốn xóa không?',
    'inv.deletePromptTitle': 'Xác nhận xóa phiếu kho có chứng từ liên kết',
    'inv.deleteBothAction': 'Hủy cả phiếu kho và chứng từ liên kết',
    'inv.deleteInvOnlyAction': 'Chỉ xóa phiếu kho (giữ lại chứng từ liên kết)',
    'inv.bulkDeleteCascadeHint': 'Lưu ý: Các chứng từ thu/chi liên kết sẽ được tự động hủy theo chính sách hệ thống.',
    'inv.bulkDeletePromptHint': 'Hệ thống đang cấu hình hỏi khi xóa. Bạn có muốn đồng thời HỦY các chứng từ thu/chi liên kết không?\n- Chọn [Đồng ý] để hủy luôn chứng từ thu/chi liên kết.\n- Chọn [Hủy] để dừng thao tác.',
    'inv.menuImport': 'Các phiếu nhập', 'inv.menuExport': 'Các phiếu xuất', 'inv.menuTransfer': 'Phiếu điều chuyển kho',
    'inv.print': 'In phiếu', 'inv.exportExcel': 'Xuất Excel', 'inv.exportFailed': 'Không xuất được Excel',
    'inv.stt': 'STT',
    'inv.voucherImport': 'PHIẾU NHẬP KHO', 'inv.voucherExport': 'PHIẾU XUẤT KHO',
    'inv.voucherTransfer': 'PHIẾU ĐIỀU CHUYỂN KHO', 'inv.voucherReturn': 'PHIẾU TRẢ HÀNG',
    'inv.voucherCompany': 'CÔNG TY KẾ TOÁN', 'inv.voucherAddress': 'Địa chỉ: ...................................',
    'inv.voucherPhone': 'Điện thoại: ...............................',
    'inv.voucherAddressLabel': 'Địa chỉ', 'inv.voucherTax': 'Mã số thuế', 'inv.voucherPhoneLabel': 'Điện thoại',
    'inv.voucherForm': 'Mẫu số {no}', 'inv.voucherFormRef': '(Ban hành theo TT 200/2014/TT-BTC)',
    'inv.voucherDate': 'Ngày {d} tháng {m} năm {y}',
    'inv.voucherDeliverer': 'Người giao', 'inv.voucherReceiver': 'Người nhận',
    'inv.createdBy': 'Người lập phiếu', 'inv.deliverer': 'Người giao hàng', 'inv.receiver': 'Người nhận hàng',
    'inv.keeper': 'Thủ kho', 'inv.chiefAccountant': 'Kế toán trưởng', 'inv.signHint': '(Ký, họ tên)',
    'inv.materialLedger': 'Sổ chi tiết vật liệu, sản phẩm, hàng hóa',
    'inv.stockSummary': 'Bảng tổng hợp NXT vật liệu, sản phẩm, hàng hóa',
    'inv.salesLedger': 'Sổ chi tiết bán hàng', 'inv.salesCogs': 'Sổ chi tiết bán hàng và giá vốn',
    'inv.selectMaterial': 'Chọn vật tư, sản phẩm, hàng hóa…', 'inv.materialRequired': 'Chọn một vật tư để xem sổ chi tiết.',
    'inv.materialCode': 'Mã hàng', 'inv.materialName': 'Tên hàng', 'inv.unit': 'ĐVT',
    'inv.openingQty': 'Tồn đầu (SL)', 'inv.openingValue': 'Tồn đầu (GT)',
    'inv.inQty': 'Nhập (SL)', 'inv.inValue': 'Nhập (GT)', 'inv.outQty': 'Xuất (SL)', 'inv.outValue': 'Xuất (GT)',
    'inv.closingQty': 'Tồn cuối (SL)', 'inv.closingValue': 'Tồn cuối (GT)',
    'inv.balanceQty': 'Tồn sau (SL)', 'inv.balanceValue': 'Tồn sau (GT)',
    'inv.revenue': 'Doanh thu', 'inv.cost': 'Giá vốn', 'inv.profit': 'Lãi gộp',
    'inv.reportEmpty': 'Không có dữ liệu trong khoảng ngày đã chọn.',
    'inv.reportSearch': 'Tìm theo mã hoặc tên hàng…' },
  en: { 'inv.importFile': 'Import', 'inv.importTitle': 'Import documents from CSV', 'inv.importTemplate': 'Download template', 'inv.close': 'Close',
    'inv.importHint': 'CSV file (UTF-8, separated by , or ;). Each row is one line item; rows sharing the same "ref" belong to one document. Required columns: type (import/export/return), partner, product, qty. Missing partners/products/banks are created in Master Data if you have permission.',
    'inv.importBusy': 'Importing…', 'inv.importDone': 'Imported {n} documents.', 'inv.importErrors': '{n} errors (failed documents were skipped):',
    'inv.errEmpty': 'File is empty', 'inv.errRead': 'Could not read file', 'inv.errHeader': 'Missing required columns: {cols}',
    'inv.errLine': 'Row {line}: {msg}', 'inv.errType': 'Invalid type (import/export/return)', 'inv.errPartner': 'Partner is missing',
    'inv.errDate': 'Invalid date (YYYY-MM-DD or DD/MM/YYYY)', 'inv.errProduct': 'Product is missing', 'inv.errQty': 'Qty must be greater than 0',
    'inv.errPrice': 'Invalid unit price', 'inv.errNotFound': '"{name}" was not found in Master Data',
    'inv.selectAll': 'Select all on this page', 'inv.selectRow': 'Select document', 'inv.selected': '{n} selected',
    'inv.clearSel': 'Clear selection', 'inv.deleteSelected': 'Delete selected', 'inv.confirmBulkDelete': 'Are you sure you want to delete {n} selected documents? This cannot be undone.',
    'inv.title': 'Inventory', 'inv.filters': 'Type', 'inv.all': 'All', 'inv.import': 'Stock in', 'inv.export': 'Stock out', 'inv.return': 'Return', 'inv.transfer': 'Transfer',
    'inv.no': 'No.', 'inv.type': 'Type', 'inv.partner': 'Partner', 'inv.supplier': 'Supplier', 'inv.customer': 'Customer',
    'inv.date': 'Date', 'inv.note': 'Note', 'inv.lines': 'Line items', 'inv.product': 'Product', 'inv.qty': 'Qty', 'inv.price': 'Unit price',
    'inv.lineTotal': 'Line total', 'inv.grandTotal': 'Grand total', 'inv.addLine': 'Add line', 'inv.save': 'Save', 'inv.delete': 'Delete document',
    'inv.back': 'Document list', 'inv.empty': 'No documents yet.', 'inv.validate': 'Please choose a partner and add at least one line (each line needs a product and qty > 0).',
    'inv.validateWarehouse': 'Transfer documents require both stock-in and stock-out warehouses.',
    'inv.bank': 'Payment bank', 'inv.searchBank': 'Type to search banks…', 'inv.newSupplier': 'supplier', 'inv.newCustomer': 'customer', 'inv.newMaterial': 'material', 'inv.newBank': 'bank',
    'inv.warehouseIn': 'Stock-in warehouse', 'inv.warehouseOut': 'Stock-out warehouse', 'inv.searchWarehouse': 'Type to search warehouses…', 'inv.newWarehouse': 'warehouse',
    'inv.searchPartner': 'Type to search…', 'inv.searchProduct': 'Type to search products…', 'inv.newImport': 'New stock-in', 'inv.newExport': 'New stock-out', 'inv.newReturn': 'New return', 'inv.newTransfer': 'New transfer', 'inv.newGroup': 'New document',
    'inv.search': 'Search by number, partner, note…', 'inv.clear': 'Clear filters', 'inv.noResult': 'No matching results.',
    'inv.range': 'Showing {from}–{to} of {total}', 'inv.dateFrom': 'From date', 'inv.dateTo': 'To date',
    'inv.perPage': 'Rows/page', 'inv.pageOf': 'Page {p} / {n}', 'inv.first': 'First page', 'inv.prev': 'Previous page', 'inv.next': 'Next page', 'inv.last': 'Last page',
    'inv.confirmDeleteLine': 'Are you sure you want to delete line "{name}"?',
    'inv.master': 'General info', 'inv.collapse': 'Collapse', 'inv.expand': 'Expand',
    'inv.moveUp': 'Move up', 'inv.moveDown': 'Move down', 'inv.drag': 'Drag to reorder',
    'inv.edit': 'Edit', 'inv.deleteRow': 'Delete', 'inv.confirmDelete': 'Are you sure you want to delete document "{name}"? This cannot be undone.',
    'inv.loadFailed': 'Could not load documents', 'inv.saveFailed': 'Could not save the document', 'inv.deleteFailed': 'Could not delete the document',
    'inv.createReceiptOnSave': 'Create cash receipt immediately (Instant cash sales)',
    'inv.createReceiptHint': 'The system will automatically create a cash receipt linked directly to this export doc.',
    'inv.linkedReceipt': 'Linked cash receipt',
    'inv.openReceipt': 'View cash receipt',
    'inv.receiptCreated': 'Cash receipt created successfully',
    'inv.receiptCreateFailed': 'Export doc saved, but failed to create cash receipt',
    'inv.deleteBlockedNotice': 'Document "{name}" has linked cash voucher: {linked}.\n\nSystem policy is set to BLOCK deletion while linked vouchers exist. Please cancel the linked voucher first.',
    'inv.confirmDeleteCascade': 'Document "{name}" has linked cash voucher: {linked}.\n\nSystem policy is set to CASCADE cancel linked vouchers. Are you sure you want to delete?',
    'inv.deletePromptTitle': 'Delete Document with Linked Voucher',
    'inv.deleteBothAction': 'Cancel both document & linked voucher',
    'inv.deleteInvOnlyAction': 'Delete only document (keep linked voucher)',
    'inv.bulkDeleteCascadeHint': 'Note: Linked cash vouchers will be automatically cancelled according to system policy.',
    'inv.bulkDeletePromptHint': 'System policy is set to prompt. Do you want to ALSO cancel linked cash vouchers?\n- Choose [Yes] to cancel linked cash vouchers as well.\n- Choose [No] to stop.',
    'inv.menuImport': 'Import vouchers', 'inv.menuExport': 'Export vouchers', 'inv.menuTransfer': 'Transfer vouchers',
    'inv.print': 'Print', 'inv.exportExcel': 'Export Excel', 'inv.exportFailed': 'Could not export Excel',
    'inv.stt': 'No.',
    'inv.voucherImport': 'STOCK-IN VOUCHER', 'inv.voucherExport': 'STOCK-OUT VOUCHER',
    'inv.voucherTransfer': 'STOCK TRANSFER VOUCHER', 'inv.voucherReturn': 'GOODS RETURN VOUCHER',
    'inv.voucherCompany': 'ACCOUNTING COMPANY', 'inv.voucherAddress': 'Address: ...................................',
    'inv.voucherPhone': 'Phone: .....................................',
    'inv.voucherAddressLabel': 'Address', 'inv.voucherTax': 'Tax code', 'inv.voucherPhoneLabel': 'Phone',
    'inv.voucherForm': 'Form No. {no}', 'inv.voucherFormRef': '(Issued under Circular 200/2014/TT-BTC)',
    'inv.voucherDate': 'Date {m}/{d}/{y}',
    'inv.voucherDeliverer': 'Deliverer', 'inv.voucherReceiver': 'Receiver',
    'inv.createdBy': 'Prepared by', 'inv.deliverer': 'Deliverer', 'inv.receiver': 'Receiver',
    'inv.keeper': 'Storekeeper', 'inv.chiefAccountant': 'Chief accountant', 'inv.signHint': '(Signature, full name)',
    'inv.materialLedger': 'Materials & goods ledger',
    'inv.stockSummary': 'Inventory summary (NXT)',
    'inv.salesLedger': 'Sales detail ledger', 'inv.salesCogs': 'Sales & COGS ledger',
    'inv.selectMaterial': 'Choose a material/product…', 'inv.materialRequired': 'Choose a material to view its ledger.',
    'inv.materialCode': 'Item code', 'inv.materialName': 'Item name', 'inv.unit': 'Unit',
    'inv.openingQty': 'Opening qty', 'inv.openingValue': 'Opening value',
    'inv.inQty': 'In qty', 'inv.inValue': 'In value', 'inv.outQty': 'Out qty', 'inv.outValue': 'Out value',
    'inv.closingQty': 'Closing qty', 'inv.closingValue': 'Closing value',
    'inv.balanceQty': 'Balance qty', 'inv.balanceValue': 'Balance value',
    'inv.revenue': 'Revenue', 'inv.cost': 'COGS', 'inv.profit': 'Gross profit',
    'inv.reportEmpty': 'No data in the selected range.',
    'inv.reportSearch': 'Search by item code or name…' },
};

/* ---------- Tìm kiếm / lọc / sắp xếp / phân trang: SERVER (xem InvDocResource.list) ---------- */

const NO_FILTERS = {};
const EMPTY_VIEW = { q: '', filters: NO_FILTERS, sort: null, page: 1 };
const PAGE_SIZES = [5, 10, 20, 50, 100];

const filterDefs = (t) => [
  { key: 'dateFrom', label: t('inv.dateFrom') },
  { key: 'dateTo', label: t('inv.dateTo') },
];

// Điều kiện lọc/sắp xếp gửi lên server (whitelist sortable phía server: no, type, partner, date)
const buildQuery = (state) => {
  const filters = state.filters ?? NO_FILTERS;
  return {
    q: state.q ?? '',
    type: state.filterType && state.filterType !== 'all' ? state.filterType : '',
    dateFrom: filters.dateFrom ?? '',
    dateTo: filters.dateTo ?? '',
    page: state.page ?? 1,
    pageSize: state.pageSize ?? PAGE_SIZES[1],
    sort: state.sort?.key ?? '',
    dir: state.sort?.dir ?? 'asc',
  };
};

/* ---------- CSS riêng của plugin (có thể chuyển sang file style chung) ---------- */

const CSS = `
.invtable.zebra tbody tr:nth-child(even) { background: rgba(128,128,128,.09); }
.invtable.zebra tbody tr:hover { background: rgba(15,108,189,.10); }
.masterhead { display: flex; align-items: center; gap: 12px; margin: 8px 0; }
.mastersum { font-size: 13px; color: var(--muted, #667085); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.draghandle { cursor: grab; user-select: none; padding: 0 6px; color: var(--muted, #667085); }
.draghandle:active { cursor: grabbing; }
.invtable tr.dragging { opacity: .4; }
.invtable tr.dropbefore td { box-shadow: inset 0 2px 0 var(--accent, #0f6cbd); }
.invtable tr.dropafter td { box-shadow: inset 0 -2px 0 var(--accent, #0f6cbd); }
.lineacts { white-space: nowrap; }
.selcol { width: 32px; text-align: center; }
.invtable tr.sel td { background: rgba(15,108,189,.16); }
.bulkbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 8px 0; padding: 8px 12px; border-radius: 6px; background: rgba(15,108,189,.12); }
.importbox { margin: 8px 0 12px; padding: 12px 14px; border: 1px dashed var(--border, #d0d5dd); border-radius: 8px; }
.importhead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.importhint { margin: 0 0 10px; font-size: 12.5px; color: var(--muted, #667085); }
.importacts { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.importres { margin-top: 10px; font-size: 13px; }
.importerr { margin: 6px 0 0; padding-left: 18px; color: #b42318; max-height: 160px; overflow: auto; }
.reportsum { display: flex; flex-wrap: wrap; gap: 18px; margin: 10px 0; font-size: 13px; }
.reportsum b { font-size: 15px; }
.repnote { margin: 8px 0; color: var(--muted, #667085); font-size: 13px; }
.repac { min-width: 320px; }
.side .item svg { flex: none; }
.mico { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 6px; flex: none; }
.mi-import { color: #1d4ed8; background: #e6edff; }
.mi-export { color: #b3360a; background: #ffeadf; }
.mi-transfer { color: #7c3aed; background: #f0e9ff; }
.mi-ledger { color: #0f766e; background: #ddf5f1; }
.mi-summary { color: #be123c; background: #ffe4ea; }
.mi-sales { color: #126b34; background: #e3f7e9; }
.mi-cost { color: #8a5406; background: #fff5d6; }
`;

/* ---------- Giao diện ---------- */

const MENU_ITEMS = [
  { id: 'import', icon: ArrowDownToLine, tone: 'mi-import', label: 'inv.menuImport' },
  { id: 'export', icon: Truck, tone: 'mi-export', label: 'inv.menuExport' },
  { id: 'transfer', icon: ArrowRightLeft, tone: 'mi-transfer', label: 'inv.menuTransfer' },
  { id: 'material-ledger', icon: BookOpen, tone: 'mi-ledger', label: 'inv.materialLedger', report: true },
  { id: 'stock-summary', icon: BarChart3, tone: 'mi-summary', label: 'inv.stockSummary', report: true },
  { id: 'sales', icon: FileText, tone: 'mi-sales', label: 'inv.salesLedger', report: true },
  { id: 'sales-cogs', icon: Receipt, tone: 'mi-cost', label: 'inv.salesCogs', report: true },
];

function Menu({ state, setState }) {
  const { t } = useI18n();
  return (<>
    <h3>{t('inv.title')}</h3>
    {MENU_ITEMS.map((m) => {
      const on = m.report ? state.report === m.id : (!state.report && state.filterType === m.id);
      const Icon = m.icon;
      return (
        <button key={m.id} className={'item' + (on ? ' on' : '')}
          onClick={() => setState(m.report
            ? { report: m.id, mode: 'list', editing: null, page: 1 }
            : { filterType: m.id, report: null, mode: 'list', editing: null, page: 1 })}>
          <span className={'mico ' + m.tone} aria-hidden="true"><Icon size={16} /></span>
          <span>{t(m.label)}</span>
        </button>
      );
    })}
  </>);
}


// C: tạo phiếu Nhập/Xuất/Trả · R: xem danh sách + chi tiết · U/D: sửa/xóa trên danh sách hoặc trong form
const ribbon = ({ setState, can }) => ({
  tabs: [{ id: 'inventory', title: 'inv.title', groups: [{ id: 'new', title: 'inv.newGroup', items: [
    { id: 'new-import', icon: '📥', label: 'inv.newImport', disabled: !can('inventory', 'create'), onClick: () => setState({ mode: 'form', editing: blankDoc('import') }) },
    { id: 'new-export', icon: '📤', label: 'inv.newExport', disabled: !can('inventory', 'create'), onClick: () => setState({ mode: 'form', editing: blankDoc('export') }) },
    { id: 'new-return', icon: '↩️', label: 'inv.newReturn', disabled: !can('inventory', 'create'), onClick: () => setState({ mode: 'form', editing: blankDoc('return') }) },
    { id: 'new-transfer', icon: '🔁', label: 'inv.newTransfer', disabled: !can('inventory', 'create'), onClick: () => setState({ mode: 'form', editing: blankDoc('transfer') }) },
    { id: 'import-file', icon: '📂', label: 'inv.importFile', disabled: !can('inventory', 'import'), onClick: () => setState({ mode: 'list', editing: null, importing: true }) },
  ] }] }],
});

/* ---------- Import CSV ---------- */

const norm = (s) => (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'd').replace(/\s+/g, ' ').toLowerCase().trim();

const IMPORT_COLS = ['ref', 'type', 'partner', 'date', 'note', 'bank', 'product', 'qty', 'price'];
const IMPORT_REQUIRED = ['type', 'partner', 'product', 'qty'];
const TEMPLATE_CSV = [
  'ref,type,partner,date,note,bank,product,qty,price',
  'A1,import,NCC Phong Vũ,2026-10-01,Nhập đợt 1,,Bàn phím cơ,10,700000',
  'A1,import,NCC Phong Vũ,2026-10-01,Nhập đợt 1,,Chuột không dây,20,220000',
  'B1,export,Công ty TNHH ABC,2026-10-02,Giao tận nơi,,RAM 16GB,5,900000',
].join('\r\n');

function downloadTemplate() {
  const blob = new Blob(['\uFEFF' + TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'inventory-import-template.csv';
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
const parseDate = (v) => {
  const x = (v ?? '').trim();
  if (!x) return today();
  let m = x.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) { const d = x.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (d) m = [x, d[3], d[2].padStart(2, '0'), d[1].padStart(2, '0')]; }
  if (!m) return null;
  const iso = m[1] + '-' + m[2] + '-' + m[3];
  return Number.isNaN(Date.parse(iso)) ? null : iso;
};

// Trả về { ok, errors }. Phiếu có lỗi bị bỏ qua, các phiếu hợp lệ vẫn được lưu.
async function importDocs(text, { can, t }) {
  const rows = parseCsv(text);
  if (!rows.length) return { ok: 0, errors: [t('inv.errEmpty')] };
  const head = rows[0].map((h) => norm(h));
  const idx = Object.fromEntries(IMPORT_COLS.map((c) => [c, head.indexOf(c)]));
  const missing = IMPORT_REQUIRED.filter((c) => idx[c] < 0);
  if (missing.length) return { ok: 0, errors: [t('inv.errHeader').replace('{cols}', missing.join(', '))] };
  const cell = (r, c) => (idx[c] >= 0 ? (r[idx[c]] ?? '').trim() : '');

  // Gom các dòng cùng "ref" thành 1 phiếu (ref trống = mỗi dòng 1 phiếu); thông tin phiếu lấy ở dòng đầu
  const groups = [];
  const byRef = new Map();
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const ref = cell(r, 'ref');
    let g = ref ? byRef.get(ref) : null;
    if (!g) { g = { line, r, rows: [] }; groups.push(g); if (ref) byRef.set(ref, g); }
    g.rows.push({ line, r });
  });

  // Tìm bản ghi trong Danh mục theo tên (không phân biệt dấu/hoa thường); chưa có thì tạo nếu được phép
  const canCreate = can('catalog', 'create');
  const cache = new Map();
  const resolve = async (kind, name, fetcher, add) => {
    const key = kind + '|' + norm(name);
    if (cache.has(key)) return cache.get(key);
    const hit = (await fetcher(name)).find((x) => norm(x.name) === norm(name));
    const v = hit ?? (canCreate ? await add(name) : null);
    cache.set(key, v);
    return v;
  };
  const simpleAdd = (store) => async (name) => { const c = await store.add({ name }); return { id: c.id, name: c.name }; };
  const partnerRes = (type, name) => (type === 'import'
    ? resolve('s', name, searchSuppliers, simpleAdd(suppliersStore))
    : resolve('c', name, searchCustomers, simpleAdd(customersStore)));
  const bankRes = (name) => resolve('b', name, searchBanks, simpleAdd(banksStore));
  const productRes = (name) => resolve('p', name, searchMaterials, async (n) => {
    const m = await materialsStore.add({ name: n, unit: 'cái', price: 0, typeId: null });
    return { id: m.id, name: m.name, price: 0 };
  });

  const errors = [];
  let ok = 0;
  const err = (line, msg) => errors.push(t('inv.errLine').replace('{line}', line).replace('{msg}', msg));
  const notFound = (name) => t('inv.errNotFound').replace('{name}', name);

  for (const g of groups) {
    const type = cell(g.r, 'type').toLowerCase();
    if (!PREFIX[type]) { err(g.line, t('inv.errType')); continue; }
    const partnerName = cell(g.r, 'partner');
    if (!partnerName) { err(g.line, t('inv.errPartner')); continue; }
    const date = parseDate(cell(g.r, 'date'));
    if (!date) { err(g.line, t('inv.errDate')); continue; }

    // Kiểm tra dữ liệu từng dòng hàng trước khi đụng tới Danh mục (tránh tạo bản ghi mồ côi)
    const specs = [];
    let bad = false;
    for (const { line, r } of g.rows) {
      const pname = cell(r, 'product');
      const qty = parseNum(cell(r, 'qty'));
      const priceRaw = cell(r, 'price');
      const price = priceRaw === '' ? null : parseNum(priceRaw);
      if (!pname) { err(line, t('inv.errProduct')); bad = true; break; }
      if (!(qty > 0)) { err(line, t('inv.errQty')); bad = true; break; }
      if (price !== null && !(price >= 0)) { err(line, t('inv.errPrice')); bad = true; break; }
      specs.push({ pname, qty, price });
    }
    if (bad) continue;

    const partner = await partnerRes(type, partnerName);
    if (!partner) { err(g.line, notFound(partnerName)); continue; }
    const bankName = cell(g.r, 'bank');
    const bank = bankName ? await bankRes(bankName) : null;
    if (bankName && !bank) { err(g.line, notFound(bankName)); continue; }

    const lines = [];
    for (const sp of specs) {
      const product = await productRes(sp.pname);
      if (!product) { err(g.line, notFound(sp.pname)); bad = true; break; }
      lines.push({ id: nextId(), product: { id: product.id, name: product.name, price: product.price }, qty: sp.qty, price: sp.price ?? product.price ?? 0 });
    }
    try {
      await saveDoc({
        type, partner: { id: partner.id, name: partner.name }, bank: bank ? { id: bank.id, name: bank.name } : null,
        date, note: cell(g.r, 'note'), lines,
      }, true);
      ok++;
    } catch (e) {
      err(g.line, e?.message ?? String(e));
    }
  }
  return { ok, errors };
}

// Checkbox "chọn tất cả" có trạng thái lưng chừng (indeterminate)
function HeaderCheck({ checked, indeterminate, onChange, label }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate && !checked; }, [indeterminate, checked]);
  return <input ref={ref} type="checkbox" checked={checked} onChange={onChange} aria-label={label} title={label} />;
}

function Toolbar({ state, setState, t, countLabel }) {
  const q = state.q ?? '';
  const filters = state.filters ?? NO_FILTERS;
  const defs = filterDefs(t);
  const active = !!q || defs.some((f) => filters[f.key]);
  const setFilter = (key, value) => setState({ filters: { ...filters, [key]: value }, page: 1 }, { replace: true });

  return (
    <div className="cattools">
      <div className="searchbox">
        <span aria-hidden="true">🔍</span>
        <input type="search" value={q} placeholder={t('inv.search')} aria-label={t('inv.search')}
          onChange={(e) => setState({ q: e.target.value, page: 1 }, { replace: true })} />
        {q && <button type="button" className="xbtn" title={t('inv.clear')} onClick={() => setState({ q: '', page: 1 }, { replace: true })}>✕</button>}
      </div>

      {defs.map((f) => (
        <label key={f.key} className="filter">
          <span>{f.label}</span>
          <input type="date" value={filters[f.key] ?? ''} onChange={(e) => setFilter(f.key, e.target.value)} />
        </label>
      ))}

      {active && <button type="button" className="tb" onClick={() => setState(EMPTY_VIEW, { replace: true })}>✕ {t('inv.clear')}</button>}
      <span className="catcount" aria-live="polite">{countLabel}</span>
    </div>
  );
}

function Pager({ page, totalPages, pageSize, setState, t }) {
  const go = (p) => setState({ page: Math.min(Math.max(1, p), totalPages) }, { replace: true });
  return (
    <div className="pager">
      <label className="filter perpage">
        <span>{t('inv.perPage')}</span>
        <select value={pageSize} onChange={(e) => setState({ pageSize: +e.target.value, page: 1 }, { replace: true })}>
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <div className="pagenav">
        <button type="button" className="tb" title={t('inv.first')} aria-label={t('inv.first')} disabled={page <= 1} onClick={() => go(1)}>⏮</button>
        <button type="button" className="tb" title={t('inv.prev')} aria-label={t('inv.prev')} disabled={page <= 1} onClick={() => go(page - 1)}>◀</button>
        <span className="pageinfo" aria-live="polite">{t('inv.pageOf').replace('{p}', page).replace('{n}', totalPages)}</span>
        <button type="button" className="tb" title={t('inv.next')} aria-label={t('inv.next')} disabled={page >= totalPages} onClick={() => go(page + 1)}>▶</button>
        <button type="button" className="tb" title={t('inv.last')} aria-label={t('inv.last')} disabled={page >= totalPages} onClick={() => go(totalPages)}>⏭</button>
      </div>
    </div>
  );
}

function ListView({ state, setState, docs, total, can, t, error, loading, onDeletePrompt }) {
  const confirm = useConfirm();
  const [imp, setImp] = useState({ busy: false, result: null, key: 0 });
  const q = state.q ?? '';
  const filters = state.filters ?? NO_FILTERS;
  const sort = state.sort ?? null;
  const pageSize = state.pageSize ?? PAGE_SIZES[1];

  // Truy vấn ở SERVER: gõ xong 300ms mới gọi (debounce), đổi trang/dòng-trang/sắp xếp thì gọi ngay.
  const critKey = JSON.stringify({ q, filterType: state.filterType, dateFrom: filters.dateFrom ?? '', dateTo: filters.dateTo ?? '' });
  const settledKey = useDebounced(critKey, 300);
  useEffect(() => {
    if (critKey !== settledKey) return;                       // còn đang gõ ⇒ chưa gọi API
    setState({ selected: [] }, { replace: true });            // đổi điều kiện/trang ⇒ bỏ lựa chọn cũ (tránh xoá nhầm)
    load(buildQuery(state));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settledKey, state.page, pageSize, sort?.key, sort?.dir]);

  const items = docs;                                         // server đã cắt trang
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, state.page ?? 1), totalPages);   // tự lùi trang khi dữ liệu co lại
  useEffect(() => { if (page !== (state.page ?? 1)) setState({ page }, { replace: true }); }, [page]);

  const from = total ? (page - 1) * pageSize + 1 : 0;
  const countLabel = total
    ? t('inv.range').replace('{from}', from).replace('{to}', from + items.length - 1).replace('{total}', total)
    : '';
  const hasCriteria = !!q || Object.values(filters).some((v) => v !== '' && v != null);

  // Bấm tiêu đề cột: tăng dần -> giảm dần -> bỏ sắp xếp (server nhận khoá qua whitelist sortable)
  const toggleSort = (key) => {
    const next = !sort || sort.key !== key ? { key, dir: 'asc' } : sort.dir === 'asc' ? { key, dir: 'desc' } : null;
    setState({ sort: next, page: 1 }, { replace: true });
  };

  const onDelete = (d) => {
    requestDeleteDoc({
      doc: d,
      t,
      confirm,
      onOpenPromptModal: onDeletePrompt,
      onSuccess: () => {},
    });
  };

  // ----- Chọn nhiều + xóa hàng loạt -----
  // Lựa chọn chỉ áp dụng cho các phiếu TRÊN TRANG hiện tại (dữ liệu đã phân trang ở server)
  const canDelete = can('inventory', 'delete');
  const selSet = new Set(state.selected ?? []);
  const selected = items.filter((d) => selSet.has(d.id));
  const pageAllSelected = items.length > 0 && items.every((d) => selSet.has(d.id));
  const pageSomeSelected = items.some((d) => selSet.has(d.id));
  const setSel = (ids) => setState({ selected: ids }, { replace: true });
  const toggleOne = (id) => setSel(selSet.has(id) ? [...selSet].filter((x) => x !== id) : [...selSet, id]);
  const togglePage = () => {
    const ids = items.map((d) => d.id);
    setSel(pageAllSelected ? [...selSet].filter((x) => !ids.includes(x)) : [...new Set([...selSet, ...ids])]);
  };
  const onBulkDelete = async () => {
    if (!selected.length) return;
    let policy = 'prompt';
    try {
      const p = await settingsApi.get('inv_delete_policy');
      if (p?.value) policy = p.value;
    } catch {}

    if (policy === 'block') {
      if (!(await confirm(t('inv.confirmBulkDelete').replace('{n}', selected.length)))) return;
      try {
        await removeDocs(selected.map((d) => d.id), false);
        setSel([]);
      } catch (e) {
        alert((t('inv.deleteFailed') || 'Xóa thất bại') + ': ' + (e?.message ?? e));
      }
    } else if (policy === 'cascade') {
      const ok = await confirm(
        t('inv.confirmBulkDelete').replace('{n}', selected.length) + '\n\n' +
        (t('inv.bulkDeleteCascadeHint') || 'Lưu ý: Các chứng từ thu/chi liên kết sẽ được tự động hủy theo chính sách hệ thống.')
      );
      if (!ok) return;
      try {
        await removeDocs(selected.map((d) => d.id), true);
        setSel([]);
      } catch (e) {
        alert((t('inv.deleteFailed') || 'Xóa thất bại') + ': ' + (e?.message ?? e));
      }
    } else {
      const ok = await confirm(
        t('inv.confirmBulkDelete').replace('{n}', selected.length) + '\n\n' +
        (t('inv.bulkDeletePromptHint') || 'Hệ thống đang cấu hình hỏi khi xóa. Bạn có muốn đồng thời HỦY các chứng từ thu/chi liên kết không?\n- Chọn [Đồng ý] để hủy luôn chứng từ thu/chi liên kết.\n- Chọn [Hủy] để dừng thao tác.')
      );
      if (!ok) return;
      try {
        await removeDocs(selected.map((d) => d.id), true);
        setSel([]);
      } catch (e) {
        alert((t('inv.deleteFailed') || 'Xóa thất bại') + ': ' + (e?.message ?? e));
      }
    }
  };

  // ----- Import -----
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImp((s) => ({ ...s, busy: true, result: null }));
    let result;
    try { result = await importDocs(await file.text(), { can, t }); }
    catch (err) { result = { ok: 0, errors: [t('inv.errRead') + ': ' + (err?.message ?? err)] }; }
    setImp((s) => ({ busy: false, result, key: s.key + 1 }));   // đổi key để chọn lại cùng 1 file vẫn chạy
    if (result.ok) setState({ filterType: 'all', ...EMPTY_VIEW }, { replace: true });   // cho phiếu mới hiện ở đầu danh sách
  };

  const cols = [
    { key: 'no', label: t('inv.no') },
    { key: 'type', label: t('inv.type') },
    { key: 'partner', label: t('inv.partner') },
    { key: 'date', label: t('inv.date') },
    // TODO(§10.5 architectural: cột grand_total): sắp xếp theo tổng cộng cần cột tổng trên inv_doc ⇒ tạm chưa sort ở server
    { key: 'total', label: t('inv.grandTotal'), sortable: false },
  ];

  return (
    <div className="pad">
      <div className="ghead">
        <h2>{t('inv.title')}</h2>
        {can('inventory', 'import') && (
          <button className="tb" onClick={() => setState({ importing: !state.importing }, { replace: true })}>📂 {t('inv.importFile')}</button>
        )}
      </div>

      {state.importing && can('inventory', 'import') && (
        <div className="importbox">
          <div className="importhead">
            <b>{t('inv.importTitle')}</b>
            <button type="button" className="xbtn" title={t('inv.close')} aria-label={t('inv.close')} onClick={() => setState({ importing: false }, { replace: true })}>✕</button>
          </div>
          <p className="importhint">{t('inv.importHint')}</p>
          <div className="importacts">
            <input key={imp.key} type="file" accept=".csv,text/csv" disabled={imp.busy} onChange={onFile} />
            <button type="button" className="tb" onClick={downloadTemplate}>⬇ {t('inv.importTemplate')}</button>
            {imp.busy && <span>⏳ {t('inv.importBusy')}</span>}
          </div>
          {imp.result && (
            <div className="importres" role="status">
              {imp.result.ok > 0 && <div>✅ {t('inv.importDone').replace('{n}', imp.result.ok)}</div>}
              {imp.result.errors.length > 0 && (<>
                <div>⚠️ {t('inv.importErrors').replace('{n}', imp.result.errors.length)}</div>
                <ul className="importerr">{imp.result.errors.map((m, i) => <li key={i}>{m}</li>)}</ul>
              </>)}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="formError" role="alert" style={{ margin: '8px 0', padding: '8px 12px', background: '#fdecea', color: '#b42318', borderRadius: 6 }}>
          ⚠️ {t('inv.loadFailed')}: {error} <button type="button" className="tb" onClick={load} style={{ marginLeft: 8 }}>⟳ {t('common.refresh')}</button>
        </p>
      )}

      <div className="ghead" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <h2>{state.filterType && state.filterType !== 'all' ? t('inv.menu' + state.filterType[0].toUpperCase() + state.filterType.slice(1)) : t('inv.title')}</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {can('inventory', 'create') && (
            <>
              <button type="button" className="btn" onClick={() => setState({ mode: 'form', editing: blankDoc('export') })}>
                ➕ {t('inv.newExport')}
              </button>
              <button type="button" className="btn" style={{ background: '#0284c7' }} onClick={() => setState({ mode: 'form', editing: blankDoc('import') })}>
                ➕ {t('inv.newImport')}
              </button>
              <button type="button" className="tb" onClick={() => setState({ mode: 'form', editing: blankDoc('transfer') })}>
                ➕ {t('inv.newTransfer')}
              </button>
              <button type="button" className="tb" onClick={() => setState({ mode: 'form', editing: blankDoc('return') })}>
                ➕ {t('inv.newReturn')}
              </button>
            </>
          )}
          {can('inventory', 'import') && (
            <button type="button" className="tb" onClick={() => setState({ importing: !state.importing })}>
              📂 {t('inv.importFile')}
            </button>
          )}
        </div>
      </div>

      <Toolbar state={state} setState={setState} t={t} countLabel={countLabel} />

      {loading && !items.length && <Loading />}

      {selected.length > 0 && (
        <div className="bulkbar" role="status">
          <b>{t('inv.selected').replace('{n}', selected.length)}</b>
          <button type="button" className="tb" onClick={() => setSel([])}>{t('inv.clearSel')}</button>
          <button type="button" className="tb" onClick={onBulkDelete}>🗑 {t('inv.deleteSelected')} ({selected.length})</button>
        </div>
      )}

      <table className="invtable zebra">
        <thead>
          <tr>
            {canDelete && (
              <th className="selcol">
                <HeaderCheck checked={pageAllSelected} indeterminate={pageSomeSelected} onChange={togglePage} label={t('inv.selectAll')} />
              </th>
            )}
            {cols.map((c) => {
              const on = sort?.key === c.key;
              if (c.sortable === false) return <th key={c.key}>{c.label}</th>;
              return (
                <th key={c.key} className="sortable" aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className="thbtn" onClick={() => toggleSort(c.key)}>
                    {c.label}<span className="sortmark">{on ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
                  </button>
                </th>
              );
            })}
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((d) => (
            <tr key={d.id} className={selSet.has(d.id) ? 'sel' : undefined}>
              {canDelete && (
                <td className="selcol">
                  <input type="checkbox" checked={selSet.has(d.id)} onChange={() => toggleOne(d.id)} aria-label={t('inv.selectRow') + ' ' + d.no} />
                </td>
              )}
              <td>{d.no}</td><td>{t('inv.' + d.type)}</td><td>{d.partner?.name}</td><td>{d.date}</td><td>{vnd(lineTotal(d.lines))}</td>
              <td className="acts" style={{ whiteSpace: 'nowrap' }}>
                <button type="button" className="tb" style={{ padding: '3px 8px', fontSize: 13, marginRight: 4 }} title={t('inv.print')} onClick={() => printVoucher(d, t)}>🖨 {t('inv.print')}</button>
                <button type="button" className="tb" style={{ padding: '3px 8px', fontSize: 13, marginRight: 4 }} title={t('inv.edit')} onClick={() => setState({ mode: 'form', editing: d })}>✏️ {t('inv.edit')}</button>
                {can('inventory', 'delete') && (
                  <button type="button" className="tb" style={{ padding: '3px 8px', fontSize: 13, color: '#dc2626' }} title={t('inv.delete')} onClick={() => onDelete(d)}>🗑 {t('inv.delete')}</button>
                )}
              </td>
            </tr>
          ))}
          {!items.length && (
            <tr><td colSpan={cols.length + 1 + (canDelete ? 1 : 0)} className="empty">{hasCriteria ? t('inv.noResult') : t('inv.empty')}</td></tr>
          )}
        </tbody>
      </table>

      {total > 0 && <Pager page={page} totalPages={totalPages} pageSize={pageSize} setState={setState} t={t} />}
    </div>
  );
}

// Form master-detail: master = loại phiếu + đối tác (autocomplete) + ngày + ghi chú
// detail = danh sách dòng hàng, mỗi dòng chọn sản phẩm bằng autocomplete (tự điền đơn giá)
function FormView({ state, setState, can, t, bus, onDeletePrompt }) {
  const confirm = useConfirm();
  const editing = state.editing;
  const isNew = !editing.id;
  const savePerm = isNew ? can('inventory', 'create') : can('inventory', 'update');
  const partnerFetcher = editing.type === 'import' ? searchSuppliers : searchCustomers;
  const partnerStore = editing.type === 'import' ? suppliersStore : customersStore;
  const showWarehouseIn = editing.type === 'import' || editing.type === 'return' || editing.type === 'transfer';
  const showWarehouseOut = editing.type === 'export' || editing.type === 'transfer';
  const update = (patch) => setState({ editing: { ...editing, ...patch } }, { replace: true });

  const [linkedVoucher, setLinkedVoucher] = useState(null);
  const [createReceipt, setCreateReceipt] = useState(false);

  useEffect(() => {
    if (!editing.id) {
      setLinkedVoucher(null);
      return;
    }
    let active = true;
    cashApi.getBySource(editing.id)
      .then((res) => {
        if (active && res && res.id) setLinkedVoucher(res);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [editing.id]);

  // store.add của Danh mục là bất đồng bộ (bên Danh mục cũng `await store.add`), nên phải await
  // để lấy id thật; nếu không thì c.id / c.name là undefined và phiếu lưu ra dữ liệu hỏng.
  const createPartner = can('catalog', 'create') ? async (name) => { const c = await partnerStore.add({ name }); return { id: c.id, name: c.name }; } : undefined;
  const createBank = can('catalog', 'create') ? async (name) => { const b = await banksStore.add({ name }); return { id: b.id, name: b.name }; } : undefined;
  const createWarehouse = can('catalog', 'create') ? async (name) => { const w = await warehousesStore.add({ name }); return { id: w.id, name: w.name }; } : undefined;
  const createMaterial = can('catalog', 'create') ? async (name) => { const m = await materialsStore.add({ name, unit: 'cái', price: 0, typeId: null }); return { id: m.id, name: m.name, price: 0 }; } : undefined;
  const updateLine = (id, patch) => update({ lines: editing.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  const addLine = () => update({ lines: [...editing.lines, { id: Date.now() + Math.random(), product: null, qty: 1, price: 0 }] });
  // Dòng trống (chưa chọn sản phẩm, giá = 0) xóa thẳng; dòng đã có dữ liệu thì hỏi xác nhận
  const isLineEmpty = (l) => !l.product && !l.price;
  const removeLine = async (l) => {
    if (!isLineEmpty(l)) {
      const name = l.product?.name || t('inv.product');
      if (!(await confirm(t('inv.confirmDeleteLine').replace('{name}', name)))) return;
    }
    update({ lines: editing.lines.filter((x) => x.id !== l.id) });
  };
  const total = lineTotal(editing.lines);

  const [masterOpen, setMasterOpen] = useState(true);   // thu gọn master để detail hiển thị nhiều dòng hơn
  const [drag, setDrag] = useState({ from: null, over: null });
  // Đổi thứ tự dòng: dùng chung cho kéo thả và nút ▲▼
  const moveLine = (from, to) => {
    if (from == null || to == null || from === to || to < 0 || to >= editing.lines.length) return;
    const next = [...editing.lines];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    update({ lines: next });
  };
  const endDrag = () => setDrag({ from: null, over: null });
  const summary = [t('inv.' + editing.type), editing.partner?.name, editing.warehouseIn?.name, editing.warehouseOut?.name, editing.bank?.name, editing.date, editing.note].filter(Boolean).join(' · ');

  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const onExportExcel = async () => {
    setExporting(true);
    try {
      await inventoryApi.exportExcel(editing.id, editing.no);
    } catch (e) {
      alert(t('inv.exportFailed') + ': ' + (e?.message ?? e));
    } finally {
      setExporting(false);
    }
  };
  const doSave = async () => {
    const linesOk = editing.lines.every((l) => l.product?.id != null && l.qty > 0);
    if (!editing.partner || !editing.lines.length || !linesOk) { alert(t('inv.validate')); return; }
    if (editing.type === 'transfer' && !(editing.warehouseIn?.id && editing.warehouseOut?.id)) {
      alert(t('inv.validateWarehouse')); return;
    }
    setSaving(true);
    try {
      const saved = await saveDoc(editing);
      const docId = saved?.id || editing.id;
      if (editing.type === 'export' && createReceipt && docId && !linkedVoucher) {
        try {
          const createdVoucher = await cashApi.fromInventory(docId);
          if (createdVoucher?.code) {
            alert(t('inv.receiptCreated') + ': ' + createdVoucher.code);
          }
        } catch (err) {
          alert((t('inv.receiptCreateFailed') || 'Không thể tạo phiếu thu') + ': ' + (err?.message ?? err));
        }
      }
      // Phiếu mới: bỏ tìm kiếm/lọc/sắp xếp/trang để phiếu vừa tạo hiện ngay ở đầu danh sách.
      // Phiếu cũ: giữ nguyên bộ lọc người dùng đang xem.
      setState(isNew
        ? { mode: 'list', editing: null, report: null, filterType: editing.type, ...EMPTY_VIEW }
        : { mode: 'list', editing: null, report: null });
    } catch (e) {
      alert((t('inv.saveFailed') || 'Lưu phiếu thất bại') + ': ' + (e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };
  const doDelete = () => {
    requestDeleteDoc({
      doc: editing,
      t,
      confirm,
      onOpenPromptModal: onDeletePrompt,
      onSuccess: () => setState({ mode: 'list', editing: null }),
    });
  };

  return (
    <div className="pad">
      <div className="ghead">
        <h2>{isNew ? t('inv.new' + editing.type[0].toUpperCase() + editing.type.slice(1)) : editing.no}</h2>
        <div>
          <button className="tb" onClick={() => printVoucher(editing, t)}>🖨 {t('inv.print')}</button>{' '}
          {!isNew && can('inventory', 'export') && <button className="tb" disabled={exporting} onClick={onExportExcel}>⬇ {t('inv.exportExcel')}</button>}{' '}
          <button className="tb" onClick={() => setState({ mode: 'list', editing: null })}>← {t('inv.back')}</button>
        </div>
      </div>

      <div className="masterhead">
        <button type="button" className="tb" aria-expanded={masterOpen} onClick={() => setMasterOpen((v) => !v)}>
          {masterOpen ? '▾' : '▸'} {t('inv.master')}
        </button>
        {!masterOpen && <span className="mastersum">{summary}</span>}
      </div>

      {masterOpen && <div className="invmaster">
        <label>{t('inv.type')}
          <select value={editing.type} disabled={!isNew} onChange={(e) => {
            const type = e.target.value;
            update({
              type, partner: null,
              warehouseIn: (type === 'import' || type === 'return' || type === 'transfer') ? editing.warehouseIn : null,
              warehouseOut: (type === 'export' || type === 'transfer') ? editing.warehouseOut : null,
            });
          }}>
            <option value="import">{t('inv.import')}</option>
            <option value="export">{t('inv.export')}</option>
            <option value="return">{t('inv.return')}</option>
            <option value="transfer">{t('inv.transfer')}</option>
          </select>
        </label>
        <label>{editing.type === 'import' ? t('inv.supplier') : t('inv.customer')}
          <Autocomplete value={editing.partner} onChange={(p) => update({ partner: p })} fetcher={partnerFetcher} placeholder={t('inv.searchPartner')}
            onCreate={createPartner} createLabel={t('ac.create') + ' ' + t(editing.type === 'import' ? 'inv.newSupplier' : 'inv.newCustomer')} />
        </label>
        <label>{t('inv.bank')}
          <Autocomplete value={editing.bank} onChange={(b) => update({ bank: b })} fetcher={searchBanks} placeholder={t('inv.searchBank')}
            onCreate={createBank} createLabel={t('ac.create') + ' ' + t('inv.newBank')} />
        </label>
        {showWarehouseIn && (
          <label>{t('inv.warehouseIn')}
            <Autocomplete value={editing.warehouseIn} onChange={(w) => update({ warehouseIn: w })} fetcher={searchWarehouses} placeholder={t('inv.searchWarehouse')}
              onCreate={createWarehouse} createLabel={t('ac.create') + ' ' + t('inv.newWarehouse')} />
          </label>
        )}
        {showWarehouseOut && (
          <label>{t('inv.warehouseOut')}
            <Autocomplete value={editing.warehouseOut} onChange={(w) => update({ warehouseOut: w })} fetcher={searchWarehouses} placeholder={t('inv.searchWarehouse')}
              onCreate={createWarehouse} createLabel={t('ac.create') + ' ' + t('inv.newWarehouse')} />
          </label>
        )}
        <label>{t('inv.date')}<input type="date" value={editing.date} onChange={(e) => update({ date: e.target.value })} /></label>
        <label>{t('inv.note')}<input value={editing.note} onChange={(e) => update({ note: e.target.value })} /></label>
      </div>}

      <h3>{t('inv.lines')}</h3>
      <table className="invtable zebra">
        <thead><tr><th /><th>{t('inv.product')}</th><th>{t('inv.qty')}</th><th>{t('inv.price')}</th><th>{t('inv.lineTotal')}</th><th /></tr></thead>
        <tbody>
          {editing.lines.map((l, i) => {
            const dropCls = drag.from !== null && drag.over === i && drag.from !== i ? (drag.from < i ? ' dropafter' : ' dropbefore') : '';
            return (
              <tr key={l.id} className={(drag.from === i ? 'dragging' : '') + dropCls}
                onDragOver={(e) => { if (drag.from === null) return; e.preventDefault(); if (drag.over !== i) setDrag((d) => ({ ...d, over: i })); }}
                onDrop={(e) => { e.preventDefault(); moveLine(drag.from, i); endDrag(); }}>
                <td>
                  <span className="draghandle" draggable title={t('inv.drag')} aria-label={t('inv.drag')}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(l.id));
                      const tr = e.currentTarget.closest('tr');
                      if (tr) e.dataTransfer.setDragImage(tr, 10, 10);
                      setDrag({ from: i, over: i });
                    }}
                    onDragEnd={endDrag}>⠿</span>
                </td>
                <td><Autocomplete value={l.product} onChange={(p) => updateLine(l.id, { product: p, price: p?.price ?? l.price })} fetcher={searchMaterials} placeholder={t('inv.searchProduct')}
                  onCreate={createMaterial} createLabel={t('ac.create') + ' ' + t('inv.newMaterial')} /></td>
                <td><input type="number" min="1" className="qty" value={l.qty} onChange={(e) => updateLine(l.id, { qty: +e.target.value || 0 })} /></td>
                <td><input type="number" min="0" className="qty" value={l.price} onChange={(e) => updateLine(l.id, { price: +e.target.value || 0 })} /></td>
                <td>{vnd(l.qty * l.price)}</td>
                <td className="lineacts">
                  <button type="button" className="xbtn" title={t('inv.moveUp')} aria-label={t('inv.moveUp')} disabled={i === 0} onClick={() => moveLine(i, i - 1)}>▲</button>
                  <button type="button" className="xbtn" title={t('inv.moveDown')} aria-label={t('inv.moveDown')} disabled={i === editing.lines.length - 1} onClick={() => moveLine(i, i + 1)}>▼</button>
                  <button type="button" className="xbtn" title={t('inv.deleteRow')} aria-label={t('inv.deleteRow')} onClick={() => removeLine(l)}>🗑</button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot><tr><td colSpan={4} style={{ textAlign: 'right' }}><b>{t('inv.grandTotal')}</b></td><td colSpan={2}><b>{vnd(total)}</b></td></tr></tfoot>
      </table>
      <button className="tb" onClick={addLine}>➕ {t('inv.addLine')}</button>

      {editing.type === 'export' && (
        linkedVoucher ? (
          <div style={{ margin: '14px 0', padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>💵</span>
              <span>
                <b>{t('inv.linkedReceipt')}:</b> <span style={{ color: '#047857', fontWeight: 600 }}>{linkedVoucher.code}</span>
                {' — '}{vnd(linkedVoucher.amount)} ({linkedVoucher.date})
              </span>
            </div>
            <button
              type="button"
              className="tb"
              style={{ background: '#fff', border: '1px solid #059669', color: '#059669', fontWeight: 500 }}
              onClick={() => bus?.emit('navigate', { pluginId: 'cash', state: { kind: 'receipt', q: linkedVoucher.code } })}>
              🔗 {t('inv.openReceipt')}
            </button>
          </div>
        ) : (
          <div style={{ margin: '14px 0', padding: '10px 14px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, color: '#0f172a', margin: 0 }}>
              <input
                type="checkbox"
                checked={createReceipt}
                onChange={(e) => setCreateReceipt(e.target.checked)}
                style={{ width: 17, height: 17, cursor: 'pointer' }}
              />
              <span>{t('inv.createReceiptOnSave')}</span>
            </label>
            {createReceipt && (
              <p style={{ margin: '6px 0 0 25px', fontSize: 13, color: '#475569' }}>
                {t('inv.createReceiptHint')}
              </p>
            )}
          </div>
        )
      )}

      <div className="formActions">
        <button className="btn" disabled={!savePerm || saving} onClick={doSave}>{saving ? 'Đang lưu…' : t('inv.save')}</button>
        <button type="button" className="tb" onClick={() => printVoucher(editing, t)}>🖨 {t('inv.print')}</button>
        {!isNew && can('inventory', 'delete') && <button type="button" className="tb" style={{ color: '#dc2626' }} onClick={doDelete}>🗑 {t('inv.delete')}</button>}
        <button type="button" className="tb" onClick={() => setState({ mode: 'list', editing: null })}>← {t('inv.back')}</button>
      </div>
    </div>
  );
}

/* ---------- Báo cáo kho (4-7) ---------- */

const qtyText = (n) => (n == null ? '' : Number(n).toLocaleString('vi-VN'));

function ReportRange({ state, setState, t }) {
  return (<>
    <label className="filter">
      <span>{t('inv.dateFrom')}</span>
      <input type="date" value={state.reportFrom ?? ''}
        onChange={(e) => setState({ reportFrom: e.target.value }, { replace: true })} />
    </label>
    <label className="filter">
      <span>{t('inv.dateTo')}</span>
      <input type="date" value={state.reportTo ?? ''}
        onChange={(e) => setState({ reportTo: e.target.value }, { replace: true })} />
    </label>
  </>);
}

function MaterialLedgerReport({ state, setState, t }) {
  const materials = materialsStore.use().items;
  const material = materials.find((m) => m.id === state.reportMaterialId) || null;
  const params = {
    materialId: state.reportMaterialId ?? '',
    dateFrom: state.reportFrom ?? '',
    dateTo: state.reportTo ?? '',
  };
  const { data, fetching, error, reload } = useAsyncQuery(
    'invrep:material:' + JSON.stringify(params),
    () => inventoryApi.materialLedger(params),
    { enabled: !!params.materialId },
  );
  const rows = data?.items ?? [];

  return (
    <div className="pad">
      <style>{CSS}</style>
      <div className="ghead">
        <h2>{t('inv.materialLedger')}</h2>
        <button className="tb" onClick={reload}>⟳ {t('common.refresh')}</button>
      </div>

      <div className="cattools">
        <label className="filter repac">
          <span>{t('inv.materialName')}</span>
          <Autocomplete value={material ? { id: material.id, name: material.name } : null}
            onChange={(m) => setState({ reportMaterialId: m?.id ?? '' }, { replace: true })}
            fetcher={searchMaterials} placeholder={t('inv.selectMaterial')} />
        </label>
        <ReportRange state={state} setState={setState} t={t} />
        <span className="catcount">{fetching ? '⏳ ' : ''}{rows.length} {t('inv.lines')}</span>
      </div>

      {!params.materialId && <p className="repnote">{t('inv.materialRequired')}</p>}
      {error && <p className="formError" role="alert">{t('inv.loadFailed')}: {error.message}</p>}

      <div className="reportsum">
        <span>{t('inv.openingQty')}: <b>{qtyText(data?.openingQty)}</b></span>
        <span>{t('inv.openingValue')}: <b>{vnd(data?.openingValue)}</b></span>
        <span>{t('inv.inQty')}: <b>{qtyText(data?.totalInQty)}</b></span>
        <span>{t('inv.outQty')}: <b>{qtyText(data?.totalOutQty)}</b></span>
        <span>{t('inv.closingQty')}: <b>{qtyText(data?.closingQty)}</b></span>
        <span>{t('inv.closingValue')}: <b>{vnd(data?.closingValue)}</b></span>
      </div>

      <table className="invtable zebra" aria-busy={fetching}>
        <thead>
          <tr>
            <th>{t('inv.date')}</th>
            <th>{t('inv.no')}</th>
            <th>{t('inv.type')}</th>
            <th>{t('inv.partner')}</th>
            <th className="num">{t('inv.qty')}</th>
            <th className="num">{t('inv.price')}</th>
            <th className="num">{t('inv.lineTotal')}</th>
            <th className="num">{t('inv.balanceQty')}</th>
            <th className="num">{t('inv.balanceValue')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={7}><b>{t('inv.openingQty')}</b></td>
            <td className="num"><b>{qtyText(data?.openingQty)}</b></td>
            <td className="num"><b>{vnd(data?.openingValue)}</b></td>
          </tr>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.date}</td>
              <td>{r.no}</td>
              <td>{t('inv.' + r.type)}</td>
              <td>{r.partnerName || ''}</td>
              <td className="num">{qtyText(r.qty)}</td>
              <td className="num">{vnd(r.price)}</td>
              <td className="num">{vnd(r.amount)}</td>
              <td className="num">{qtyText(r.balanceQty)}</td>
              <td className="num">{vnd(r.balanceValue)}</td>
            </tr>
          ))}
          {!rows.length && !fetching && params.materialId && (
            <tr><td colSpan={9} className="empty">{t('inv.reportEmpty')}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StockSummaryReport({ state, setState, t }) {
  const q = state.reportQ ?? '';
  const settledQ = useDebounced(q, 300);
  const params = { dateFrom: state.reportFrom ?? '', dateTo: state.reportTo ?? '', q: settledQ };
  const { data, fetching, error, reload } = useAsyncQuery(
    'invrep:nxt:' + JSON.stringify(params),
    () => inventoryApi.stockSummary(params),
    { enabled: q === settledQ },
  );
  const rows = data?.items ?? [];
  const totals = data?.totals ?? {};

  return (
    <div className="pad">
      <style>{CSS}</style>
      <div className="ghead">
        <h2>{t('inv.stockSummary')}</h2>
        <button className="tb" onClick={reload}>⟳ {t('common.refresh')}</button>
      </div>

      <div className="cattools">
        <div className="searchbox">
          <span aria-hidden="true">🔍</span>
          <input type="search" value={q} placeholder={t('inv.reportSearch')} aria-label={t('inv.reportSearch')}
            onChange={(e) => setState({ reportQ: e.target.value }, { replace: true })} />
          {q && <button type="button" className="xbtn" title={t('inv.clear')}
            onClick={() => setState({ reportQ: '' }, { replace: true })}>✕</button>}
        </div>
        <ReportRange state={state} setState={setState} t={t} />
        <span className="catcount">{fetching ? '⏳ ' : ''}{rows.length} {t('inv.materialName')}</span>
      </div>

      {error && <p className="formError" role="alert">{t('inv.loadFailed')}: {error.message}</p>}

      <table className="invtable zebra" aria-busy={fetching}>
        <thead>
          <tr>
            <th>{t('inv.materialCode')}</th>
            <th>{t('inv.materialName')}</th>
            <th>{t('inv.unit')}</th>
            <th className="num">{t('inv.openingQty')}</th>
            <th className="num">{t('inv.openingValue')}</th>
            <th className="num">{t('inv.inQty')}</th>
            <th className="num">{t('inv.inValue')}</th>
            <th className="num">{t('inv.outQty')}</th>
            <th className="num">{t('inv.outValue')}</th>
            <th className="num">{t('inv.closingQty')}</th>
            <th className="num">{t('inv.closingValue')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.productId}>
              <td>{r.code}</td>
              <td>{r.name}</td>
              <td>{r.unit}</td>
              <td className="num">{qtyText(r.openingQty)}</td>
              <td className="num">{vnd(r.openingValue)}</td>
              <td className="num">{qtyText(r.inQty)}</td>
              <td className="num">{vnd(r.inValue)}</td>
              <td className="num">{qtyText(r.outQty)}</td>
              <td className="num">{vnd(r.outValue)}</td>
              <td className="num">{qtyText(r.closingQty)}</td>
              <td className="num">{vnd(r.closingValue)}</td>
            </tr>
          ))}
          {!rows.length && !fetching && (
            <tr><td colSpan={11} className="empty">{t('inv.reportEmpty')}</td></tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}><b>{t('inv.grandTotal')}</b></td>
            <td className="num"><b>{qtyText(totals.openingQty)}</b></td>
            <td className="num"><b>{vnd(totals.openingValue)}</b></td>
            <td className="num"><b>{qtyText(totals.inQty)}</b></td>
            <td className="num"><b>{vnd(totals.inValue)}</b></td>
            <td className="num"><b>{qtyText(totals.outQty)}</b></td>
            <td className="num"><b>{vnd(totals.outValue)}</b></td>
            <td className="num"><b>{qtyText(totals.closingQty)}</b></td>
            <td className="num"><b>{vnd(totals.closingValue)}</b></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function SalesReport({ state, setState, t, withCost }) {
  const q = state.reportQ ?? '';
  const settledQ = useDebounced(q, 300);
  const params = { dateFrom: state.reportFrom ?? '', dateTo: state.reportTo ?? '', q: settledQ };
  const { data, fetching, error, reload } = useAsyncQuery(
    'invrep:sales:' + withCost + ':' + JSON.stringify(params),
    () => (withCost ? inventoryApi.salesCogs(params) : inventoryApi.sales(params)),
    { enabled: q === settledQ },
  );
  const rows = data?.items ?? [];
  const totals = data?.totals ?? {};

  return (
    <div className="pad">
      <style>{CSS}</style>
      <div className="ghead">
        <h2>{t(withCost ? 'inv.salesCogs' : 'inv.salesLedger')}</h2>
        <button className="tb" onClick={reload}>⟳ {t('common.refresh')}</button>
      </div>

      <div className="cattools">
        <div className="searchbox">
          <span aria-hidden="true">🔍</span>
          <input type="search" value={q} placeholder={t('inv.reportSearch')} aria-label={t('inv.reportSearch')}
            onChange={(e) => setState({ reportQ: e.target.value }, { replace: true })} />
          {q && <button type="button" className="xbtn" title={t('inv.clear')}
            onClick={() => setState({ reportQ: '' }, { replace: true })}>✕</button>}
        </div>
        <ReportRange state={state} setState={setState} t={t} />
        <span className="catcount">{fetching ? '⏳ ' : ''}{rows.length} {t('inv.lines')}</span>
      </div>

      {error && <p className="formError" role="alert">{t('inv.loadFailed')}: {error.message}</p>}

      <table className="invtable zebra" aria-busy={fetching}>
        <thead>
          <tr>
            <th>{t('inv.date')}</th>
            <th>{t('inv.no')}</th>
            <th>{t('inv.customer')}</th>
            <th>{t('inv.product')}</th>
            <th className="num">{t('inv.qty')}</th>
            <th className="num">{t('inv.price')}</th>
            <th className="num">{t('inv.revenue')}</th>
            {withCost && <th className="num">{t('inv.cost')}</th>}
            {withCost && <th className="num">{t('inv.profit')}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.date}</td>
              <td>{r.no}</td>
              <td>{r.partnerName || ''}</td>
              <td>{r.productName}</td>
              <td className="num">{qtyText(r.qty)}</td>
              <td className="num">{vnd(r.price)}</td>
              <td className="num">{vnd(r.revenue)}</td>
              {withCost && <td className="num">{vnd(r.cost)}</td>}
              {withCost && <td className="num">{vnd(r.profit)}</td>}
            </tr>
          ))}
          {!rows.length && !fetching && (
            <tr><td colSpan={withCost ? 9 : 7} className="empty">{t('inv.reportEmpty')}</td></tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6}><b>{t('inv.grandTotal')}</b></td>
            <td className="num"><b>{vnd(totals.revenue)}</b></td>
            {withCost && <td className="num"><b>{vnd(totals.cost)}</b></td>}
            {withCost && <td className="num"><b>{vnd(totals.profit)}</b></td>}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ReportView({ state, setState, t }) {
  switch (state.report) {
    case 'material-ledger': return <MaterialLedgerReport state={state} setState={setState} t={t} />;
    case 'stock-summary': return <StockSummaryReport state={state} setState={setState} t={t} />;
    case 'sales': return <SalesReport state={state} setState={setState} t={t} withCost={false} />;
    case 'sales-cogs': return <SalesReport state={state} setState={setState} t={t} withCost />;
    default: return null;
  }
}

// Toàn bộ hook nằm trong Body; View chỉ kiểm tra quyền rồi mới mount Body (không vi phạm thứ tự hook).
function Body(props) {
  const { state } = props;
  const { t } = useI18n();
  const { docs, total, loading, error } = useDocs();
  const [deletePrompt, setDeletePrompt] = useState(null);
  // KHÔNG return <Loading /> ở đây: unmount ListView sẽ chạy lại effect tải dữ liệu khi mount
  // (mount → load → unmount → mount → load …) ⇒ vòng lặp request vô hạn khi kết quả rỗng.
  // Spinner được hiển thị bên trong ListView để component luôn được giữ mount.
  return (<>
    <style>{CSS}</style>
    {state.mode === 'form' && state.editing
      ? <FormView {...props} onDeletePrompt={setDeletePrompt} t={t} />
      : state.report
        ? <ReportView state={state} setState={props.setState} t={t} />
        : <ListView {...props} onDeletePrompt={setDeletePrompt} docs={docs} total={total} error={error} loading={loading} t={t} />}

    {deletePrompt && (
      <div className="confirm-backdrop" onMouseDown={() => setDeletePrompt(null)}>
        <div className="confirm-box" style={{ width: 480 }} role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
          <h3 style={{ fontSize: 16, color: '#dc2626', marginBottom: 12 }}>🗑 {t('inv.deletePromptTitle')}</h3>
          <p style={{ margin: '0 0 10px', fontSize: 14 }}>
            Phiếu kho <strong>{deletePrompt.doc.no}</strong> đang có chứng từ liên kết:
          </p>
          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 6, marginBottom: 16, border: '1px solid #e2e8f0', fontSize: 13, color: '#0f172a' }}>
            <strong>{deletePrompt.voucherInfo}</strong>
          </div>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
            Hệ thống đang cấu hình hỏi người dùng khi xóa phiếu kho có chứng từ liên kết. Vui lòng chọn thao tác xử lý:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              className="btn danger"
              style={{ width: '100%', textAlign: 'center', padding: '9px 14px', fontSize: 13, fontWeight: 600 }}
              onClick={async () => {
                const doc = deletePrompt.doc;
                const cb = deletePrompt.onSuccess;
                setDeletePrompt(null);
                try {
                  await removeDoc(doc.id, true);
                  cb?.();
                } catch (e) {
                  alert((t('inv.deleteFailed') || 'Xóa thất bại') + ': ' + (e?.message ?? e));
                }
              }}
            >
              🗑 {t('inv.deleteBothAction')}
            </button>
            <button
              type="button"
              className="tb"
              style={{ width: '100%', textAlign: 'center', padding: '9px 14px', fontSize: 13, border: '1px solid #cbd5e1', background: '#fff' }}
              onClick={async () => {
                const doc = deletePrompt.doc;
                const cb = deletePrompt.onSuccess;
                setDeletePrompt(null);
                try {
                  await removeDoc(doc.id, false);
                  cb?.();
                } catch (e) {
                  alert((t('inv.deleteFailed') || 'Xóa thất bại') + ': ' + (e?.message ?? e));
                }
              }}
            >
              📄 {t('inv.deleteInvOnlyAction')}
            </button>
            <button
              type="button"
              className="tb"
              style={{ width: '100%', textAlign: 'center', padding: '6px 14px', fontSize: 13, color: '#64748b' }}
              onClick={() => setDeletePrompt(null)}
            >
              {t('admin.cancel') || 'Đóng'}
            </button>
          </div>
        </div>
      </div>
    )}
  </>);
}

function View(props) {
  if (!props.can('inventory', 'read')) return <Denied />;
  return <Body {...props} />;
}

export default {
  id: 'inventory', title: 'inv.title', icon: '📦', order: 1, messages, search, refresh: load,
  initialState: { mode: 'list', filterType: 'all', report: null, reportFrom: firstOfMonth(), reportTo: today(), reportMaterialId: '', reportQ: '', editing: null, pageSize: 5, selected: [], importing: false, ...EMPTY_VIEW }, Menu, ribbon, View,
  // Không còn setup(){ load() }: dữ liệu kho nay cần đăng nhập (CS-S1) và Body tự tải theo truy vấn hiện tại.
};