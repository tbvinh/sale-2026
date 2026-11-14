import { useState } from 'react';
import { useI18n } from '../../core/i18n.jsx';
import Denied from '../../core/Denied.jsx';
import { TableMap } from './TableMap.jsx';
import { OrderView } from './OrderView.jsx';
import { TableCatalog } from './TableCatalog.jsx';
import { AreaManager } from './AreaManager.jsx';
import { HistoryView } from './HistoryView.jsx';
import { ShiftManager } from './ShiftManager.jsx';

const messages = {
  vi: {
    'minibar.title': 'Mini Bar / Quán ăn',
    'minibar.map': 'Sơ đồ bàn',
    'minibar.catalog': 'Danh mục bàn',
    'minibar.areas': 'Khu vực / Tầng',
    'minibar.history': 'Lịch sử hóa đơn',
    'minibar.shifts': 'Bàn giao ca',
    'minibar.order': 'Gọi món / Order',
    'minibar.views': 'Chức năng',

    // Table Map
    'minibar.mapTitle': 'Sơ đồ Bàn ăn & Phòng phục vụ',
    'minibar.mapSub': 'Chọn bàn để gọi món, thanh toán hoặc đặt trước',
    'minibar.statusEmpty': 'Trống',
    'minibar.statusOccupied': 'Đang có khách',
    'minibar.statusReserved': 'Đặt trước',
    'minibar.allAreas': 'Tất cả khu vực',
    'minibar.capacity': 'Sức chứa',
    'minibar.people': 'người',
    'minibar.openShiftPrompt': 'Chưa mở ca làm việc',
    'minibar.openShiftBtn': 'Mở ca ngay',
    'minibar.reserveTable': 'Đặt trước bàn',
    'minibar.cancelReservation': 'Hủy đặt trước',
    'minibar.customerName': 'Tên khách hàng',
    'minibar.customerPhone': 'Số điện thoại',
    'minibar.reservedTime': 'Thời gian đặt',
    'minibar.emptyTables': 'bàn trống',
    'minibar.occupiedTables': 'bàn có khách',
    'minibar.reservedTables': 'bàn đặt trước',

    // Order View
    'minibar.orderFor': 'Gọi món cho',
    'minibar.selectItems': 'Chọn món & Đồ uống',
    'minibar.searchItem': 'Tìm món theo tên hoặc mã…',
    'minibar.orderList': 'Danh sách món đã gọi',
    'minibar.item': 'Món / Hàng hóa',
    'minibar.qty': 'Số lượng',
    'minibar.unitPrice': 'Đơn giá',
    'minibar.amount': 'Thành tiền',
    'minibar.subtotal': 'Tiền hàng',
    'minibar.discount': 'Giảm giá',
    'minibar.serviceFee': 'Phí dịch vụ',
    'minibar.grandTotal': 'Tổng thanh toán',
    'minibar.checkout': 'Thanh toán',
    'minibar.saveDraft': 'Lưu tạm',
    'minibar.printReceipt': 'In tạm tính',
    'minibar.changeTable': 'Chuyển bàn',
    'minibar.confirmCheckout': 'Xác nhận thanh toán',
    'minibar.checkoutSuccess': 'Thanh toán thành công',
    'minibar.noItemsSelected': 'Chưa có món nào được chọn',
    'minibar.customerPaid': 'Tiền khách đưa',
    'minibar.changeReturn': 'Tiền thối lại',
    'minibar.note': 'Ghi chú bàn / món',

    // Table Catalog
    'minibar.manageTables': 'Quản lý Danh mục Bàn',
    'minibar.manageTablesSub': 'Thiết lập danh sách bàn, khu vực và sức chứa cho quán',
    'minibar.manageAreasBtn': 'Quản lý & Đổi tên tầng',
    'minibar.addTable': 'Thêm bàn mới',
    'minibar.editTable': 'Sửa thông tin bàn',
    'minibar.tableCode': 'Mã bàn',
    'minibar.tableName': 'Tên bàn',
    'minibar.area': 'Khu vực / Tầng',
    'minibar.seatCapacity': 'Sức chứa (số khách)',
    'minibar.confirmDeleteTable': 'Bạn có chắc chắn muốn xóa bàn này?',

    // Area Manager
    'minibar.manageAreas': 'Quản lý Khu vực & Tầng',
    'minibar.manageAreasSub': 'Thêm tầng mới, đổi tên hoặc sắp xếp bàn theo khu vực',
    'minibar.addFloor': 'Thêm tầng / khu vực mới',
    'minibar.renameFloor': 'Đổi tên khu vực',
    'minibar.deleteFloor': 'Xóa khu vực',
    'minibar.floorName': 'Tên tầng / khu vực',
    'minibar.tableCount': 'Số lượng bàn',
    'minibar.totalCapacity': 'Tổng sức chứa',
    'minibar.addTableToFloor': 'Thêm bàn vào tầng này',

    // Shifts
    'minibar.shiftTitle': 'Quản lý & Bàn giao Ca làm việc',
    'minibar.shiftSub': 'Quản lý mở ca, kiểm kê tiền mặt thực tế và bàn giao ca',
    'minibar.currentShift': 'Ca làm việc hiện tại',
    'minibar.shiftHistory': 'Lịch sử các ca làm việc',
    'minibar.openNewShift': 'Mở ca làm việc mới',
    'minibar.closeShift': 'Kết thúc & Bàn giao ca',
    'minibar.shiftCode': 'Mã ca',
    'minibar.shiftName': 'Tên ca',
    'minibar.staff': 'Nhân viên thu ngân',
    'minibar.warehouse': 'Kho áp dụng',
    'minibar.openTime': 'Thời gian mở ca',
    'minibar.closeTime': 'Thời gian đóng ca',
    'minibar.openBalance': 'Số dư đầu ca',
    'minibar.revenueInShift': 'Doanh thu trong ca',
    'minibar.cashInShift': 'Tiền mặt thu trong ca',
    'minibar.systemExpectedCash': 'Tiền mặt hệ thống tính',
    'minibar.actualCash': 'Tiền mặt thực tế kiểm đếm',
    'minibar.cashDifference': 'Chênh lệch tiền mặt',
    'minibar.shiftReceipts': 'Chi tiết phiếu thu trong ca',
    'minibar.shiftStatusOpen': 'Đang hoạt động',
    'minibar.shiftStatusClosed': 'Đã kết thúc',

    // History
    'minibar.historyTitle': 'Lịch sử Bán hàng & Tổng hợp Thu chi Kho Bar',
    'minibar.historySub': 'Tổng hợp phiếu xuất kho bán hàng dịch vụ và phiếu thu tiền mặt theo kho Bar / Nhà hàng',
    'minibar.exporting': 'Đang xuất…',
    'minibar.appliedWarehouse': 'Kho áp dụng',
    'minibar.pageRevenue': 'Doanh thu xuất bán (Trang này)',
    'minibar.cashReceipts': 'Thu tiền mặt',
    'minibar.totalExportDocs': 'Tổng số phiếu xuất',
    'minibar.searchHistory': 'Tìm theo số phiếu, tên khách, bàn…',
    'minibar.filterMonth': 'Tháng',
    'minibar.docNo': 'Số phiếu',
    'minibar.docDate': 'Ngày phiếu',
    'minibar.customer': 'Khách hàng',
    'minibar.table': 'Bàn',
    'minibar.reprintBill': 'In lại bill',
    'minibar.viewDetail': 'Xem chi tiết',

    // New keys for AreaManager, OrderView, ShiftManager, TableCatalog, TableMap
    'minibar.areaGeneral': 'Khu vực chung',
    'minibar.renameAreaFailed': 'Đổi tên khu vực thất bại',
    'minibar.addTableFailed': 'Thêm bàn thất bại',
    'minibar.enterFloorPrompt': 'Vui lòng nhập tên tầng / khu vực mới',
    'minibar.addFloorFailed': 'Thêm tầng thất bại',
    'minibar.deleteAreaFailed': 'Xóa khu vực thất bại',
    'minibar.readOnlyAreasHint': 'Bạn đang ở chế độ xem. Chỉ Quản trị viên mới có quyền thêm/sửa/xóa khu vực.',
    'minibar.searchAreaPlaceholder': 'Tìm theo tên tầng, khu vực…',
    'minibar.deleteFloorConfirm': 'Xóa tầng / khu vực này?',
    'minibar.transferTablesTo': 'Chuyển toàn bộ bàn sang khu vực:',
    'minibar.noItemsToPrint': 'Không có món nào để in tạm tính!',
    'minibar.selectTargetTablePrompt': 'Vui lòng chọn bàn đích muốn chuyển đến!',
    'minibar.transferConfirm': 'Xác nhận chuyển order từ bàn {from} sang bàn {to}?',
    'minibar.transferSuccess': 'Chuyển bàn thành công!',
    'minibar.transferFailed': 'Chuyển bàn thất bại: ',
    'minibar.confirmCancelOrder': 'Bạn có chắc chắn muốn hủy order và giải phóng bàn {table}?',
    'minibar.cancelOrderSuccess': 'Đã hủy order và giải phóng bàn!',
    'minibar.cancelFailed': 'Hủy order thất bại: ',
    'minibar.emptyOrderCheckoutWarn': 'Bàn chưa có món nào! Vui lòng chọn món trước khi thanh toán.',
    'minibar.defaultCustomer': 'Khách lẻ',
    'minibar.confirmCheckoutSub': 'Kiểm tra kỹ số lượng món, tiền thu thực tế trước khi xác nhận lưu phiếu.',
    'minibar.checkoutFailed': 'Thanh toán thất bại: ',
    'minibar.indoor': 'Trong nhà',
    'minibar.selectWarehouse': 'Chọn kho xuất',
    'minibar.portions': 'phần',
    'minibar.cancelOrder': 'Hủy bàn',
    'minibar.selectItemsHint': 'Chọn danh mục hoặc tìm kiếm để thêm món',
    'minibar.orderNotePlaceholder': 'Ghi chú cho bếp / quầy bar (ít đá, không cay...)',
    'minibar.totalQty': 'Tổng số lượng:',
    'minibar.toOtherTable': 'sang bàn khác',
    'minibar.selectTable': '-- Chọn bàn --',
    'minibar.cashPaidInShift': 'Tiền mặt đã nộp trong ca',
    'minibar.collapseDetail': 'Thu gọn',
    'minibar.openShiftPromptSub': 'Bạn cần mở ca làm việc để thực hiện gọi món và thanh toán cho khách.',
    'minibar.openNewShiftPrompt': 'Mở ca làm việc để bắt đầu ghi nhận doanh thu và phiếu thu trong ca.',
    'minibar.balanced': 'Khớp chuẩn',
    'minibar.confirmOpenShift': 'Xác nhận mở ca',
    'minibar.shortage': 'Thiếu',
    'minibar.surplus': 'Thừa',
    'minibar.handoverTo': 'Bàn giao cho nhân viên',
    'minibar.closeShiftNotePlaceholder': 'Ghi chú lý do chênh lệch hoặc lưu ý khi bàn giao ca...',
    'minibar.confirmCloseShift': 'Xác nhận chốt & đóng ca',
    'minibar.handoverReport': 'BIÊN BẢN BÀN GIAO CA',
    'minibar.invoicesInShift': 'Hóa đơn / Phiếu xuất trong ca',
    'minibar.noReceiptsInShift': 'Chưa có phiếu thu nào phát sinh trong ca này.',
    'minibar.printShiftSummary': 'In biên bản bàn giao ca',
    'minibar.statusOccupiedHint': 'Bàn đang có khách. Vui lòng thanh toán hoặc giải phóng bàn trước khi xóa.',
    'minibar.deleteTableFailed': 'Xóa bàn thất bại: ',
    'minibar.readOnlyTableHint': 'Bạn đang ở chế độ xem. Chỉ Quản trị viên mới có quyền thêm, sửa hoặc xóa danh mục bàn.',
    'minibar.searchTablePlaceholder': 'Tìm bàn theo mã, tên, khu vực…',
    'minibar.allStatuses': 'Tất cả trạng thái',
    'minibar.clearFilter': 'Xóa bộ lọc',
    'minibar.noTablesFound': 'Không tìm thấy bàn nào phù hợp',
    'minibar.reservedInfo': 'Thông tin đặt trước',
    'minibar.arrivalTime': 'Giờ khách đến',
    'minibar.tableNotePlaceholder': 'Ghi chú (bàn VIP, gần cửa sổ...)',
    'minibar.saveTableInfo': 'Lưu thông tin bàn',
    'minibar.enterCustomerPrompt': 'Vui lòng nhập tên khách hàng đặt bàn!',
    'minibar.reserveError': 'Lỗi khi lưu thông tin đặt bàn: ',
    'minibar.updateStatusFailed': 'Cập nhật trạng thái bàn thất bại',
    'minibar.tableOpenedEmpty': 'Bàn đã mở (chưa có món)',
    'minibar.noName': 'Chưa đặt tên',
    'minibar.openTableAction': 'Mở bàn',
    'minibar.orderAction': 'Gọi món',
    'minibar.transferAction': 'Chuyển bàn',
    'minibar.checkInTable': 'Nhận bàn',
  },
  en: {
    'minibar.title': 'Mini Bar / Dining',
    'minibar.map': 'Table Map',
    'minibar.catalog': 'Dining Tables',
    'minibar.areas': 'Floors & Areas',
    'minibar.history': 'Sales History',
    'minibar.shifts': 'Shift Handover',
    'minibar.order': 'Table Order',
    'minibar.views': 'Functions',

    // Table Map
    'minibar.mapTitle': 'Table & Room Map',
    'minibar.mapSub': 'Select a table to order, checkout, or reserve',
    'minibar.statusEmpty': 'Empty',
    'minibar.statusOccupied': 'Occupied',
    'minibar.statusReserved': 'Reserved',
    'minibar.allAreas': 'All Areas',
    'minibar.capacity': 'Capacity',
    'minibar.people': 'guests',
    'minibar.openShiftPrompt': 'No active shift in progress',
    'minibar.openShiftBtn': 'Open shift now',
    'minibar.reserveTable': 'Reserve table',
    'minibar.cancelReservation': 'Cancel reservation',
    'minibar.customerName': 'Customer name',
    'minibar.customerPhone': 'Phone number',
    'minibar.reservedTime': 'Reservation time',
    'minibar.emptyTables': 'empty tables',
    'minibar.occupiedTables': 'occupied tables',
    'minibar.reservedTables': 'reserved tables',

    // Order View
    'minibar.orderFor': 'Order for',
    'minibar.selectItems': 'Select Items & Drinks',
    'minibar.searchItem': 'Search item by name or code…',
    'minibar.orderList': 'Ordered Items',
    'minibar.item': 'Item / Product',
    'minibar.qty': 'Quantity',
    'minibar.unitPrice': 'Unit price',
    'minibar.amount': 'Amount',
    'minibar.subtotal': 'Subtotal',
    'minibar.discount': 'Discount',
    'minibar.serviceFee': 'Service fee',
    'minibar.grandTotal': 'Total payment',
    'minibar.checkout': 'Checkout',
    'minibar.saveDraft': 'Save draft',
    'minibar.printReceipt': 'Print receipt',
    'minibar.changeTable': 'Change table',
    'minibar.confirmCheckout': 'Confirm checkout',
    'minibar.checkoutSuccess': 'Checkout completed',
    'minibar.noItemsSelected': 'No items selected yet',
    'minibar.customerPaid': 'Cash received',
    'minibar.changeReturn': 'Change return',
    'minibar.note': 'Table / Item note',

    // Table Catalog
    'minibar.manageTables': 'Manage Dining Tables',
    'minibar.manageTablesSub': 'Configure tables, areas and seating capacities',
    'minibar.manageAreasBtn': 'Manage floors & areas',
    'minibar.addTable': 'Add new table',
    'minibar.editTable': 'Edit table info',
    'minibar.tableCode': 'Table code',
    'minibar.tableName': 'Table name',
    'minibar.area': 'Area / Floor',
    'minibar.seatCapacity': 'Capacity (guests)',
    'minibar.confirmDeleteTable': 'Are you sure you want to delete this table?',

    // Area Manager
    'minibar.manageAreas': 'Manage Areas & Floors',
    'minibar.manageAreasSub': 'Add new floors, rename or organize tables by area',
    'minibar.addFloor': 'Add floor / area',
    'minibar.renameFloor': 'Rename area',
    'minibar.deleteFloor': 'Delete area',
    'minibar.floorName': 'Area / floor name',
    'minibar.tableCount': 'Number of tables',
    'minibar.totalCapacity': 'Total capacity',
    'minibar.addTableToFloor': 'Add table to this area',

    // Shifts
    'minibar.shiftTitle': 'Shift Management & Handover',
    'minibar.shiftSub': 'Open shifts, count cash on hand, and hand over shifts',
    'minibar.currentShift': 'Current Shift',
    'minibar.shiftHistory': 'Shift History',
    'minibar.openNewShift': 'Open New Shift',
    'minibar.closeShift': 'Close & Hand Over Shift',
    'minibar.shiftCode': 'Shift code',
    'minibar.shiftName': 'Shift name',
    'minibar.staff': 'Cashier / Staff',
    'minibar.warehouse': 'Warehouse',
    'minibar.openTime': 'Start time',
    'minibar.closeTime': 'End time',
    'minibar.openBalance': 'Opening balance',
    'minibar.revenueInShift': 'Shift sales revenue',
    'minibar.cashInShift': 'Cash collected in shift',
    'minibar.systemExpectedCash': 'Expected system cash',
    'minibar.actualCash': 'Actual cash counted',
    'minibar.cashDifference': 'Cash variance',
    'minibar.shiftReceipts': 'Receipt vouchers in shift',
    'minibar.shiftStatusOpen': 'In Progress',
    'minibar.shiftStatusClosed': 'Closed',

    // History
    'minibar.historyTitle': 'Bar Sales History & Cash Summary',
    'minibar.historySub': 'Sales export docs and cash receipts summary for Bar / Restaurant',
    'minibar.exporting': 'Exporting…',
    'minibar.appliedWarehouse': 'Applied warehouse',
    'minibar.pageRevenue': 'Sales revenue (this page)',
    'minibar.cashReceipts': 'Cash receipts',
    'minibar.totalExportDocs': 'Total export docs',
    'minibar.searchHistory': 'Search by doc no, customer, table…',
    'minibar.filterMonth': 'Month',
    'minibar.docNo': 'Doc No',
    'minibar.docDate': 'Date',
    'minibar.customer': 'Customer',
    'minibar.table': 'Table',
    'minibar.reprintBill': 'Reprint bill',
    'minibar.viewDetail': 'View detail',

    // New keys for AreaManager, OrderView, ShiftManager, TableCatalog, TableMap
    'minibar.areaGeneral': 'General Area',
    'minibar.renameAreaFailed': 'Failed to rename area',
    'minibar.addTableFailed': 'Failed to add table',
    'minibar.enterFloorPrompt': 'Please enter the new floor / area name',
    'minibar.addFloorFailed': 'Failed to add floor',
    'minibar.deleteAreaFailed': 'Failed to delete area',
    'minibar.readOnlyAreasHint': 'You are in read-only mode. Only Admins can add/edit/delete areas.',
    'minibar.searchAreaPlaceholder': 'Search by floor or area name…',
    'minibar.deleteFloorConfirm': 'Delete this floor / area?',
    'minibar.transferTablesTo': 'Transfer all tables to area:',
    'minibar.noItemsToPrint': 'No items to print receipt!',
    'minibar.selectTargetTablePrompt': 'Please select a destination table!',
    'minibar.transferConfirm': 'Confirm transferring order from table {from} to table {to}?',
    'minibar.transferSuccess': 'Table transferred successfully!',
    'minibar.transferFailed': 'Failed to transfer table: ',
    'minibar.confirmCancelOrder': 'Are you sure you want to cancel order and free table {table}?',
    'minibar.cancelOrderSuccess': 'Order cancelled and table freed!',
    'minibar.cancelFailed': 'Failed to cancel order: ',
    'minibar.emptyOrderCheckoutWarn': 'Table has no items! Please select items before checkout.',
    'minibar.defaultCustomer': 'Walk-in guest',
    'minibar.confirmCheckoutSub': 'Please check items and actual payment received carefully before confirming.',
    'minibar.checkoutFailed': 'Checkout failed: ',
    'minibar.indoor': 'Indoor',
    'minibar.selectWarehouse': 'Select warehouse',
    'minibar.portions': 'portions',
    'minibar.cancelOrder': 'Cancel table order',
    'minibar.selectItemsHint': 'Select a category or search to add items',
    'minibar.orderNotePlaceholder': 'Notes for kitchen / bar (less ice, mild...)',
    'minibar.totalQty': 'Total qty:',
    'minibar.toOtherTable': 'to another table',
    'minibar.selectTable': '-- Select table --',
    'minibar.cashPaidInShift': 'Cash turned in during shift',
    'minibar.collapseDetail': 'Collapse',
    'minibar.openShiftPromptSub': 'You need to open a shift to take orders and process payments.',
    'minibar.openNewShiftPrompt': 'Open a work shift to start recording sales and cash receipts.',
    'minibar.balanced': 'Balanced',
    'minibar.confirmOpenShift': 'Confirm open shift',
    'minibar.shortage': 'Shortage',
    'minibar.surplus': 'Surplus',
    'minibar.handoverTo': 'Hand over to',
    'minibar.closeShiftNotePlaceholder': 'Notes on variance or remarks for shift handover...',
    'minibar.confirmCloseShift': 'Confirm close shift',
    'minibar.handoverReport': 'SHIFT HANDOVER REPORT',
    'minibar.invoicesInShift': 'Invoices / Export slips in shift',
    'minibar.noReceiptsInShift': 'No cash receipts recorded in this shift.',
    'minibar.printShiftSummary': 'Print shift handover report',
    'minibar.statusOccupiedHint': 'Table is currently occupied. Please checkout or free the table before deleting.',
    'minibar.deleteTableFailed': 'Failed to delete table: ',
    'minibar.readOnlyTableHint': 'You are in read-only mode. Only Admins can add, edit, or delete dining tables.',
    'minibar.searchTablePlaceholder': 'Search tables by code, name, area…',
    'minibar.allStatuses': 'All statuses',
    'minibar.clearFilter': 'Clear filters',
    'minibar.noTablesFound': 'No matching tables found',
    'minibar.reservedInfo': 'Reservation Info',
    'minibar.arrivalTime': 'Arrival time',
    'minibar.tableNotePlaceholder': 'Notes (VIP table, near window...)',
    'minibar.saveTableInfo': 'Save table info',
    'minibar.enterCustomerPrompt': 'Please enter customer name!',
    'minibar.reserveError': 'Error saving reservation: ',
    'minibar.updateStatusFailed': 'Failed to update table status',
    'minibar.tableOpenedEmpty': 'Table opened (no items yet)',
    'minibar.noName': 'Unnamed',
    'minibar.openTableAction': 'Open table',
    'minibar.orderAction': 'Order',
    'minibar.transferAction': 'Transfer',
    'minibar.checkInTable': 'Check-in',
  },
};

const MENU_ITEMS = [
  { id: 'map', icon: '🍽️', labelKey: 'minibar.map' },
  { id: 'catalog', icon: '🪑', labelKey: 'minibar.catalog' },
  { id: 'areas', icon: '🏢', labelKey: 'minibar.areas' },
  { id: 'history', icon: '📋', labelKey: 'minibar.history' },
  { id: 'shifts', icon: '⏱️', labelKey: 'minibar.shifts' },
];

function Menu({ state, setState, t: propT }) {
  const { t: i18nT } = useI18n();
  const t = propT || i18nT;
  const activeTab = state.tab || 'map';
  return (
    <div className="catmenu" role="tablist" aria-label="Mini Bar">
      {MENU_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={activeTab === item.id}
          className={`catitem ${activeTab === item.id ? 'active' : ''}`}
          onClick={() => setState({ tab: item.id, activeTable: null }, { replace: true })}
        >
          <span className="catico" aria-hidden="true">{item.icon}</span>
          <span className="catname">{t(item.labelKey)}</span>
        </button>
      ))}
    </div>
  );
}

function ribbon({ state, setState, can, t }) {
  const activeTab = state.tab || 'map';
  return {
    tabs: [
      {
        id: 'minibar',
        title: 'minibar.title',
        groups: [
          {
            id: 'views',
            title: 'minibar.views',
            items: [
              {
                id: 'btn-map',
                icon: '🍽️',
                label: 'minibar.map',
                active: activeTab === 'map',
                onClick: () => setState({ tab: 'map', activeTable: null }),
              },
              {
                id: 'btn-catalog',
                icon: '🪑',
                label: 'minibar.catalog',
                active: activeTab === 'catalog',
                onClick: () => setState({ tab: 'catalog', activeTable: null }),
              },
              {
                id: 'btn-areas',
                icon: '🏢',
                label: 'minibar.areas',
                active: activeTab === 'areas',
                onClick: () => setState({ tab: 'areas', activeTable: null }),
              },
              {
                id: 'btn-history',
                icon: '📋',
                label: 'minibar.history',
                active: activeTab === 'history',
                onClick: () => setState({ tab: 'history', activeTable: null }),
              },
              {
                id: 'btn-shifts',
                icon: '⏱️',
                label: 'minibar.shifts',
                active: activeTab === 'shifts',
                onClick: () => setState({ tab: 'shifts', activeTable: null }),
              },
            ],
          },
        ],
      },
    ],
  };
}

function View(props) {
  const { t: i18nT } = useI18n();
  const { can, state, setState, t = i18nT } = props;

  // Allow access if user has 'minibar' or 'catalog' permission, or is admin
  if (!can('minibar', 'read') && !can('catalog', 'read')) {
    return <Denied />;
  }

  const tab = state.tab || 'map';

  if (tab === 'order' && state.activeTable) {
    return (
      <OrderView
        table={state.activeTable}
        onBack={() => setState({ tab: 'map', activeTable: null }, { replace: true })}
        onOrderFinished={() => setState({ tab: 'map', activeTable: null }, { replace: true })}
        can={can}
        t={t}
      />
    );
  }

  if (tab === 'catalog') {
    return (
      <TableCatalog
        can={can}
        t={t}
        onOpenAreas={() => setState({ tab: 'areas', activeTable: null }, { replace: true })}
      />
    );
  }

  if (tab === 'areas') {
    return (
      <AreaManager
        can={can}
        t={t}
        onOpenMap={() => setState({ tab: 'map', activeTable: null }, { replace: true })}
        onOpenCatalog={(area) => setState({ tab: 'catalog', activeTable: null, selectedArea: area }, { replace: true })}
      />
    );
  }

  if (tab === 'history') {
    return <HistoryView can={can} t={t} />;
  }

  if (tab === 'shifts') {
    return <ShiftManager can={can} t={t} />;
  }

  // Default: Table Map
  return (
    <TableMap
      onSelectTable={(table) => setState({ tab: 'order', activeTable: table }, { replace: true })}
      onOpenCatalog={() => setState({ tab: 'catalog', activeTable: null }, { replace: true })}
      onOpenAreas={() => setState({ tab: 'areas', activeTable: null }, { replace: true })}
      onOpenShifts={() => setState({ tab: 'shifts', activeTable: null }, { replace: true })}
      can={can}
      t={t}
    />
  );
}

export default {
  id: 'minibar',
  title: 'minibar.title',
  icon: '🍹',
  order: 2.2,
  messages,
  Menu,
  ribbon,
  View,
  initialState: {
    tab: 'map',
    activeTable: null,
  },
};

