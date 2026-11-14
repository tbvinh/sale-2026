import { createContext, useContext, useState } from 'react';

const dict = { vi: {}, en: {} };
// Plugin đăng ký bản dịch riêng của mình qua plugin.messages
export const addMessages = (m) => Object.keys(m).forEach((l) => Object.assign((dict[l] ??= {}), m[l]));

addMessages({
  vi: {
    'app.name': 'PM Bán Hàng', 'logout': 'Đăng xuất',
    'login.title': 'Đăng nhập', 'login.user': 'Tên đăng nhập', 'login.pass': 'Mật khẩu',
    'login.submit': 'Đăng nhập', 'login.error': 'Sai tên đăng nhập hoặc mật khẩu.',
    'login.hint': 'Tài khoản demo: admin/123456 (Quản trị) · demo/123456 (Người dùng)',
    'common.refresh': 'Làm mới', 'common.searchIn': 'Tìm trong', 'nav.back': 'Quay lại', 'nav.forward': 'Tiến tới', 'perm.denied': 'Bạn không có quyền xem nội dung này. Liên hệ Quản trị viên.', 'role.admin': 'Quản trị viên', 'role.user': 'Người dùng', 'ac.empty': 'Không tìm thấy kết quả.', 'ac.create': 'Thêm mới', 'company.label': 'Công ty', 'company.default': 'Hệ thống (mặc định)',
    'common.exportExcel': 'Xuất Excel', 'common.actions': 'Thao tác', 'common.save': 'Lưu', 'common.saving': 'Đang lưu…', 'common.cancel': 'Hủy', 'common.delete': 'Xóa', 'common.edit': 'Sửa', 'common.add': 'Thêm', 'common.close': 'Đóng', 'common.all': 'Tất cả', 'common.status': 'Trạng thái', 'common.note': 'Ghi chú', 'common.total': 'Tổng cộng', 'common.filter': 'Bộ lọc', 'common.retry': 'Thử lại', 'common.loading': 'Đang tải…', 'common.date': 'Ngày', 'common.time': 'Giờ', 'common.month': 'Tháng', 'common.year': 'Năm', 'common.search': 'Tìm kiếm…', 'common.empty': 'Không có dữ liệu', 'common.confirm': 'Xác nhận', 'common.print': 'In', 'common.details': 'Chi tiết', 'common.default': 'Mặc định', 'common.service': 'Dịch vụ', 'common.processing': 'Đang xử lý…', 'common.readOnly': 'Chỉ xem',
    'tag.title': 'In mã vạch & Tem giá sản phẩm', 'tag.storeName': 'Tên cửa hàng', 'tag.size': 'Kích thước tem', 'tag.showStore': 'Hiện tên cửa hàng', 'tag.showName': 'Hiện tên sản phẩm', 'tag.showCode': 'Hiện mã sản phẩm', 'tag.showPrice': 'Hiện giá bán', 'tag.showBarcode': 'Hiện mã vạch', 'tag.showQr': 'Hiện mã QR', 'tag.showBorder': 'Hiện viền cắt tem', 'tag.printBtn': 'In tem', 'tag.quantity': 'Số lượng tem', 'tag.printPreview': 'Xem trước bản in', 'tag.close': 'Đóng', 'tag.print': 'In ngay',
    'media.choose': 'Chọn ảnh', 'media.change': 'Đổi ảnh', 'media.remove': 'Xóa ảnh', 'media.uploading': 'Đang tải…',
    'media.preview': 'Xem trước ảnh', 'media.hint': 'SVG, PNG, JPG, GIF, WEBP, BMP · tối đa 10 MB',
    'media.invalid': 'Chỉ hỗ trợ ảnh SVG, PNG, JPG, GIF, WEBP, BMP.', 'media.tooLarge': 'Ảnh tối đa 10 MB.', 'media.failed': 'Không tải được ảnh.',
  },
  en: {
    'app.name': 'PM Bán Hàng', 'logout': 'Sign out',
    'login.title': 'Sign in', 'login.user': 'Username', 'login.pass': 'Password',
    'login.submit': 'Sign in', 'login.error': 'Incorrect username or password.',
    'login.hint': 'Demo accounts: admin/123456 (Admin) · demo/123456 (User)',
    'common.refresh': 'Refresh', 'common.searchIn': 'Search in', 'nav.back': 'Back', 'nav.forward': 'Forward', 'perm.denied': 'You do not have permission to view this. Contact an Admin.', 'role.admin': 'Admin', 'role.user': 'User', 'ac.empty': 'No results found.', 'ac.create': 'Add new', 'company.label': 'Company', 'company.default': 'System (default)',
    'common.exportExcel': 'Export Excel', 'common.actions': 'Actions', 'common.save': 'Save', 'common.saving': 'Saving…', 'common.cancel': 'Cancel', 'common.delete': 'Delete', 'common.edit': 'Edit', 'common.add': 'Add', 'common.close': 'Close', 'common.all': 'All', 'common.status': 'Status', 'common.note': 'Note', 'common.total': 'Total', 'common.filter': 'Filter', 'common.retry': 'Retry', 'common.loading': 'Loading…', 'common.date': 'Date', 'common.time': 'Time', 'common.month': 'Month', 'common.year': 'Year', 'common.search': 'Search…', 'common.empty': 'No data', 'common.confirm': 'Confirm', 'common.print': 'Print', 'common.details': 'Details', 'common.default': 'Default', 'common.service': 'Service', 'common.processing': 'Processing…', 'common.readOnly': 'Read only',
    'tag.title': 'Print Barcode & Price Tags', 'tag.storeName': 'Store Name', 'tag.size': 'Tag Size', 'tag.showStore': 'Show store name', 'tag.showName': 'Show item name', 'tag.showCode': 'Show item code', 'tag.showPrice': 'Show price', 'tag.showBarcode': 'Show barcode', 'tag.showQr': 'Show QR code', 'tag.showBorder': 'Show cutting border', 'tag.printBtn': 'Print Tags', 'tag.quantity': 'Tag quantity', 'tag.printPreview': 'Print preview', 'tag.close': 'Close', 'tag.print': 'Print now',
    'media.choose': 'Choose image', 'media.change': 'Change image', 'media.remove': 'Remove image', 'media.uploading': 'Uploading…',
    'media.preview': 'Image preview', 'media.hint': 'SVG, PNG, JPG, GIF, WEBP, BMP · max 10 MB',
    'media.invalid': 'Only SVG, PNG, JPG, GIF, WEBP, BMP images are supported.', 'media.tooLarge': 'Image must be 10 MB or smaller.', 'media.failed': 'Could not upload the image.',
  },
});

const Ctx = createContext();
export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'vi');
  const change = (l) => { localStorage.setItem('lang', l); setLang(l); };
  const t = (k) => dict[lang]?.[k] ?? dict.vi[k] ?? k;
  return <Ctx.Provider value={{ lang, setLang: change, t }}>{children}</Ctx.Provider>;
}
export const useI18n = () => useContext(Ctx);

export function LangSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <select className="lang" value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language">
      <option value="vi">Tiếng Việt</option>
      <option value="en">English</option>
    </select>
  );
}
