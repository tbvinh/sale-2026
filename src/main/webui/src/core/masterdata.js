import { USE_REAL_API } from './config.js';
import { createStore as createRealStore } from './createstore.js';
import { createMockStore } from './mockstore.js';

export { USE_REAL_API };
export { formatDate, formatDateTime, useDateFormat, getDateFormat, setDateFormat } from './dateFormat.js';
export const vnd = (n) => (n || 0).toLocaleString('vi-VN') + ' đ';
export const matchName = (q) => (x) => x.name.toLowerCase().includes(q.toLowerCase());

// Một cờ duy nhất (VITE_USE_REAL_API, xem config.js) quyết định nguồn dữ liệu của mọi danh mục:
//   false -> createMockStore(prefix, seed): API giả trong trình duyệt, dùng dữ liệu mẫu bên dưới
//   true  -> createRealStore(resource):     gọi API thật, `resource` là đường dẫn REST (dữ liệu mẫu bị bỏ qua)
// Hai store có cùng giao diện: use / useQuery / search / add / update / remove / load / reset / list.
// add/update/remove đều trả về Promise -> nơi gọi cần `await` (kể cả onCreate của Autocomplete).
const makeStore = (prefix, resource, seed) => (
  USE_REAL_API ? createRealStore(resource) : createMockStore(prefix, seed)
);

export const suppliersStore = makeStore('NCC', '/suppliers', [
  { id: 's1', code: 'NCC0001', name: 'NCC Phong Vũ', phone: '028 7300 8888', address: 'TP.HCM' },
  { id: 's2', code: 'NCC0002', name: 'NCC Digiworld', phone: '028 3915 1919', address: 'TP.HCM' },
  { id: 's3', code: 'NCC0003', name: 'NCC An Phát', phone: '024 3795 9595', address: 'Hà Nội' },
  { id: 's4', code: 'NCC0004', name: 'NCC FPT Retail', phone: '028 7300 6666', address: 'TP.HCM' },
  { id: 's5', code: 'NCC0005', name: 'NCC Thế Giới Di Động', phone: '028 3812 5960', address: 'TP.HCM' },
  { id: 's6', code: 'NCC0006', name: 'NCC Viettel Store', phone: '024 6255 6789', address: 'Hà Nội' },
  { id: 's7', code: 'NCC0007', name: 'NCC Hanoicomputer (HAICOM)', phone: '024 3628 5551', address: 'Hà Nội' },
  { id: 's8', code: 'NCC0008', name: 'NCC GearVN', phone: '028 7108 1800', address: 'TP.HCM' },
  { id: 's9', code: 'NCC0009', name: 'NCC CellphoneS', phone: '028 7108 9666', address: 'TP.HCM' },
  { id: 's10', code: 'NCC0010', name: 'NCC Phúc Anh Computer', phone: '024 3574 5888', address: 'Hà Nội' },
  { id: 's11', code: 'NCC0011', name: 'NCC Nguyễn Kim', phone: '028 3821 1211', address: 'TP.HCM' },
  { id: 's12', code: 'NCC0012', name: 'NCC Điện Máy Xanh', phone: '028 3812 5961', address: 'TP.HCM' },
  { id: 's13', code: 'NCC0013', name: 'NCC MediaMart', phone: '024 6251 8888', address: 'Hà Nội' },
  { id: 's14', code: 'NCC0014', name: 'NCC Chợ Lớn Electronics', phone: '028 3856 3388', address: 'TP.HCM' },
  { id: 's15', code: 'NCC0015', name: 'NCC HC Home Center', phone: '024 3750 1188', address: 'Hà Nội' },
  { id: 's16', code: 'NCC0016', name: 'NCC Dấu khí Petrolimex', phone: '024 3851 2603', address: 'Hà Nội' },
  { id: 's17', code: 'NCC0017', name: 'NCC Viễn Thông A', phone: '028 3863 3333', address: 'TP.HCM' },
  { id: 's18', code: 'NCC0018', name: 'NCC Synnex FPT', phone: '028 7300 8000', address: 'TP.HCM' },
  { id: 's19', code: 'NCC0019', name: 'NCC DGW Distribution', phone: '028 3915 1920', address: 'TP.HCM' },
  { id: 's20', code: 'NCC0020', name: 'NCC Elite Corp', phone: '028 3512 3959', address: 'TP.HCM' },
  { id: 's21', code: 'NCC0021', name: 'NCC Viễn Sơn', phone: '028 3832 6085', address: 'TP.HCM' },
  { id: 's22', code: 'NCC0022', name: 'NCC Anh Ngọc Computer', phone: '024 3768 2345', address: 'Hà Nội' },
  { id: 's23', code: 'NCC0023', name: 'NCC Thủy Vũ Tech', phone: '0225 383 9999', address: 'Hải Phòng' },
  { id: 's24', code: 'NCC0024', name: 'NCC Phi Long Technology', phone: '0236 388 8888', address: 'Đà Nẵng' },
  { id: 's25', code: 'NCC0025', name: 'NCC Xuân Vinh Computer', phone: '0236 386 8888', address: 'Đà Nẵng' },
  { id: 's26', code: 'NCC0026', name: 'NCC Phương Tùng', phone: '0292 383 2222', address: 'Cần Thơ' },
  { id: 's27', code: 'NCC0027', name: 'NCC Sơn Long Cần Thơ', phone: '0292 381 1111', address: 'Cần Thơ' },
  { id: 's28', code: 'NCC0028', name: 'NCC BKAD Việt Nam', phone: '024 3868 1234', address: 'Hà Nội' },
  { id: 's29', code: 'NCC0029', name: 'NCC Hồng Hà Cần Thơ', phone: '0238 383 3666', address: 'Nghệ An' },
  { id: 's30', code: 'NCC0030', name: 'NCC Thiên Long Group', phone: '028 3750 5555', address: 'TP.HCM' },
  { id: 's31', code: 'NCC0031', name: 'NCC Văn Phòng Phẩm Hồng Hà', phone: '024 3856 2111', address: 'Hà Nội' },
  { id: 's32', code: 'NCC0032', name: 'NCC Deli Việt Nam', phone: '024 3200 8899', address: 'Hà Nội' },
  { id: 's33', code: 'NCC0033', name: 'NCC Đống Đa Paper', phone: '024 3852 4433', address: 'Hà Nội' },
  { id: 's34', code: 'NCC0034', name: 'NCC Giấy Bãi Bằng', phone: '0210 382 9222', address: 'Phú Thọ' },
  { id: 's35', code: 'NCC0035', name: 'NCC Văn Phòng Phẩm Bến Nghé', phone: '028 3829 1122', address: 'TP.HCM' },
  { id: 's36', code: 'NCC0036', name: 'NCC Mực In VMAX', phone: '028 3930 0888', address: 'TP.HCM' },
  { id: 's37', code: 'NCC0037', name: 'NCC Mực In Trang Nguyễn', phone: '0292 383 8989', address: 'Cần Thơ' },
  { id: 's38', code: 'NCC0038', name: 'NCC Canon Việt Nam', phone: '024 3771 1666', address: 'Hà Nội' },
  { id: 's39', code: 'NCC0039', name: 'NCC Epson Việt Nam', phone: '028 3925 5888', address: 'TP.HCM' },
  { id: 's40', code: 'NCC0040', name: 'NCC HP Inc Việt Nam', phone: '028 3823 4151', address: 'TP.HCM' },
  { id: 's41', code: 'NCC0041', name: 'NCC Dell Global Vietnam', phone: '028 3821 5400', address: 'TP.HCM' },
  { id: 's42', code: 'NCC0042', name: 'NCC Asus Vietnam', phone: '028 3811 7868', address: 'TP.HCM' },
  { id: 's43', code: 'NCC0043', name: 'NCC Acer Vietnam', phone: '028 3823 3323', address: 'TP.HCM' },
  { id: 's44', code: 'NCC0044', name: 'NCC Lenovo Vietnam', phone: '024 3946 0888', address: 'Hà Nội' },
  { id: 's45', code: 'NCC0045', name: 'NCC Samsung Electronics', phone: '028 3915 7388', address: 'TP.HCM' },
  { id: 's46', code: 'NCC0046', name: 'NCC LG Electronics', phone: '024 3934 5151', address: 'Hà Nội' },
  { id: 's47', code: 'NCC0047', name: 'NCC Sony Vietnam', phone: '028 3822 2227', address: 'TP.HCM' },
  { id: 's48', code: 'NCC0048', name: 'NCC Panasonic Vietnam', phone: '024 3955 0111', address: 'Hà Nội' },
  { id: 's49', code: 'NCC0049', name: 'NCC Daikin Air Conditioning', phone: '028 3811 1555', address: 'TP.HCM' },
  { id: 's50', code: 'NCC0050', name: 'NCC Toshiba Vietnam', phone: '028 3824 2888', address: 'TP.HCM' },
  { id: 's51', code: 'NCC0051', name: 'NCC Sunhouse Group', phone: '024 3736 6688', address: 'Hà Nội' },
  { id: 's52', code: 'NCC0052', name: 'NCC Kangroo Group', phone: '024 3628 1888', address: 'Hà Nội' },
  { id: 's53', code: 'NCC0053', name: 'NCC Hòa Phát Group', phone: '024 6281 8666', address: 'Hà Nội' },
  { id: 's54', code: 'NCC0054', name: 'NCC Nội Thất Xuân Hòa', phone: '024 3661 1111', address: 'Hà Nội' },
  { id: 's55', code: 'NCC0055', name: 'NCC Nội Thất 190', phone: '0225 375 8888', address: 'Hải Phòng' },
  { id: 's56', code: 'NCC0056', name: 'NCC Nhựa Bình Minh', phone: '028 3969 0973', address: 'TP.HCM' },
  { id: 's57', code: 'NCC0057', name: 'NCC Nhựa Tiền Phong', phone: '0225 381 3979', address: 'Hải Phòng' },
  { id: 's58', code: 'NCC0058', name: 'NCC Cadivi สาย điện', phone: '028 3829 9434', address: 'TP.HCM' },
  { id: 's59', code: 'NCC0059', name: 'NCC Đèn Rạng Đông', phone: '024 3858 4310', address: 'Hà Nội' },
  { id: 's60', code: 'NCC0060', name: 'NCC Thiết Bị Điện Điện Quang', phone: '028 3825 1020', address: 'TP.HCM' },
  { id: 's61', code: 'NCC0061', name: 'NCC Schneider Electric', phone: '028 3823 1818', address: 'TP.HCM' },
  { id: 's62', code: 'NCC0062', name: 'NCC ABB Vietnam', phone: '024 3861 1010', address: 'Hà Nội' },
  { id: 's63', code: 'NCC0063', name: 'NCC Bách Hóa Xanh (Sỉ)', phone: '028 3812 5962', address: 'TP.HCM' },
  { id: 's64', code: 'NCC0064', name: 'NCC WinCommerce', phone: '024 7106 6868', address: 'Hà Nội' },
  { id: 's65', code: 'NCC0065', name: 'NCC Central Retail Vietnam', phone: '028 3997 0088', address: 'TP.HCM' },
  { id: 's66', code: 'NCC0066', name: 'NCC MM Mega Market', phone: '028 3519 0390', address: 'TP.HCM' },
  { id: 's67', code: 'NCC0067', name: 'NCC Lotte Mart', phone: '028 3775 3232', address: 'TP.HCM' },
  { id: 's68', code: 'NCC0068', name: 'NCC Aeon Vietnam', phone: '028 6288 7711', address: 'TP.HCM' },
  { id: 's69', code: 'NCC0069', name: 'NCC Unilever Vietnam', phone: '028 5413 5688', address: 'TP.HCM' },
  { id: 's70', code: 'NCC0070', name: 'NCC P&G Vietnam', phone: '028 3521 0100', address: 'TP.HCM' },
  { id: 's71', code: 'NCC0071', name: 'NCC Nestlé Vietnam', phone: '028 3911 5115', address: 'TP.HCM' },
  { id: 's72', code: 'NCC0072', name: 'NCC Vinamilk', phone: '028 5415 5555', address: 'TP.HCM' },
  { id: 's73', code: 'NCC0073', name: 'NCC TH True Milk', phone: '024 3573 9777', address: 'Hà Nội' },
  { id: 's74', code: 'NCC0074', name: 'NCC Suntory PepsiCo', phone: '028 3821 9436', address: 'TP.HCM' },
  { id: 's75', code: 'NCC0075', name: 'NCC Coca-Cola Vietnam', phone: '028 3896 1000', address: 'TP.HCM' },
  { id: 's76', code: 'NCC0076', name: 'NCC Masan Consumer', phone: '028 3822 7866', address: 'TP.HCM' },
  { id: 's77', code: 'NCC0077', name: 'NCC Acecook Vietnam', phone: '028 3815 4064', address: 'TP.HCM' },
  { id: 's78', code: 'NCC0078', name: 'NCC Trung Nguyên Legend', phone: '028 3925 1852', address: 'TP.HCM' },
  { id: 's79', code: 'NCC0079', name: 'NCC Sabeco', phone: '028 3829 4083', address: 'TP.HCM' },
  { id: 's80', code: 'NCC0080', name: 'NCC Habeco', phone: '024 3845 3843', address: 'Hà Nội' },
  { id: 's81', code: 'NCC0081', name: 'NCC Chăn Ra Gối Đệm Sông Hồng', phone: '0228 364 9365', address: 'Nam Định' },
  { id: 's82', code: 'NCC0082', name: 'NCC Nệm Liên Á', phone: '028 3877 7999', address: 'TP.HCM' },
  { id: 's83', code: 'NCC0083', name: 'NCC Nệm Vạn Thành', phone: '028 3835 2999', address: 'TP.HCM' },
  { id: 's84', code: 'NCC0084', name: 'NCC May 10', phone: '024 3827 6923', address: 'Hà Nội' },
  { id: 's85', code: 'NCC0085', name: 'NCC Viết Tiến Garment', phone: '028 3864 0800', address: 'TP.HCM' },
  { id: 's86', code: 'NCC0086', name: 'NCC Bitis Feet\'s Care', phone: '028 3875 3443', address: 'TP.HCM' },
  { id: 's87', code: 'NCC0087', name: 'NCC Dược Hậu Giang (DHG)', phone: '0292 389 1433', address: 'Cần Thơ' },
  { id: 's88', code: 'NCC0088', name: 'NCC Traphaco Pharma', phone: '024 3681 4980', address: 'Hà Nội' },
  { id: 's89', code: 'NCC0089', name: 'NCC Dược Nam Hà', phone: '0228 384 9408', address: 'Nam Định' },
  { id: 's90', code: 'NCC0090', name: 'NCC Pharmacity Sỉ', phone: '028 7300 3388', address: 'TP.HCM' },
  { id: 's91', code: 'NCC0091', name: 'NCC Long Châu Pharma', phone: '028 7302 3456', address: 'TP.HCM' },
  { id: 's92', code: 'NCC0092', name: 'NCC Vận Tải Viettel Post', phone: '024 6266 0111', address: 'Hà Nội' },
  { id: 's93', code: 'NCC0093', name: 'NCC Logistics VNPost', phone: '024 3768 9352', address: 'Hà Nội' },
  { id: 's94', code: 'NCC0094', name: 'NCC Giao Hàng Nhanh (GHN)', phone: '028 7300 1200', address: 'TP.HCM' },
  { id: 's95', code: 'NCC0095', name: 'NCC Giao Hàng Tiết Kiệm (GHTK)', phone: '024 3218 1111', address: 'Hà Nội' },
  { id: 's96', code: 'NCC0096', name: 'NCC Vận Tải Nhất Tín', phone: '028 7302 1111', address: 'TP.HCM' },
  { id: 's97', code: 'NCC0097', name: 'NCC Tân Cảng Sài Gòn', phone: '028 3742 2234', address: 'TP.HCM' },
  { id: 's98', code: 'NCC0098', name: 'NCC Cảng Hải Phòng', phone: '0225 385 9911', address: 'Hải Phòng' },
  { id: 's99', code: 'NCC0099', name: 'NCC Bao Bì Á Châu', phone: '0274 378 2888', address: 'Bình Dương' },
  { id: 's100', code: 'NCC0100', name: 'NCC Bao Bì Đông Hải Bến Tre', phone: '0275 381 2222', address: 'Bến Tre' },
]);
export const warehousesStore = makeStore('KHO', '/warehouses', []);
export const customersStore = makeStore('KH', '/customers', [
  { id: 'c1', code: 'KH0001', name: 'Công ty TNHH ABC', phone: '090 1234 567', address: 'TP.HCM' },
  { id: 'c2', code: 'KH0002', name: 'Cửa hàng Minh Long', phone: '090 7654 321', address: 'Đà Nẵng' },
  { id: 'c3', code: 'KH0003', name: 'Nguyễn Văn Khách', phone: '090 1112 223', address: 'Hà Nội' },
]);
export const banksStore = makeStore('NH', '/banks', [
  { id: 'b1', code: 'VCB', name: 'Vietcombank', branch: 'Chi nhánh TP.HCM' },
  { id: 'b2', code: 'TCB', name: 'Techcombank', branch: 'Chi nhánh Hà Nội' },
  { id: 'b3', code: 'BIDV', name: 'BIDV', branch: 'Chi nhánh Đà Nẵng' },
]);
export const materialTypesStore = makeStore('LVT', '/material-types', [
  { id: 't1', name: 'Linh kiện máy tính' },
  { id: 't2', name: 'Thiết bị ngoại vi' },
  { id: 't3', name: 'Phụ kiện' },
]);
export const materialsStore = makeStore('VT', '/materials', [
  { id: 'p1', code: 'VT0001', name: 'Bàn phím cơ', unit: 'cái', price: 750000, typeId: 't2' },
  { id: 'p2', code: 'VT0002', name: 'Chuột không dây', unit: 'cái', price: 250000, typeId: 't2' },
  { id: 'p3', code: 'VT0003', name: 'Màn hình 24"', unit: 'cái', price: 3200000, typeId: 't2' },
  { id: 'p4', code: 'VT0004', name: 'Ổ cứng SSD 1TB', unit: 'cái', price: 1450000, typeId: 't1' },
  { id: 'p5', code: 'VT0005', name: 'RAM 16GB', unit: 'cái', price: 900000, typeId: 't1' },
]);
export const accountsStore = makeStore('TK', '/accounts', [
  { id: 'a1', code: '156', name: 'Hàng hóa' },
  { id: 'a2', code: '131', name: 'Phải thu khách hàng' },
  { id: 'a3', code: '331', name: 'Phải trả người bán' },
]);
export const departmentsStore = makeStore('PB', '/departments', [
  { id: 'd1', code: 'PB-KT', name: 'Phòng Kế toán', manager: 'Trần Thị Hoa', phone: '024 3852 1188' },
  { id: 'd2', code: 'PB-KHO', name: 'Phòng Kho vận', manager: 'Nguyễn Văn Bình', phone: '024 3852 1199' },
  { id: 'd3', code: 'PB-KD', name: 'Phòng Kinh doanh', manager: 'Lê Minh Châu', phone: '028 3822 3377' },
  { id: 'd4', code: 'PB-NS', name: 'Phòng Nhân sự', manager: 'Phạm Thu Dung', phone: '024 3852 1177' },
]);
export const employeesStore = makeStore('NV', '/employees', [
  { id: 'e1', code: 'NV0001', name: 'Nguyễn Văn An', phone: '090 123 4567', email: 'an.nguyen@banhang.vn', position: 'Kế toán trưởng', departmentId: 'd1' },
  { id: 'e2', code: 'NV0002', name: 'Trần Thị Bích', phone: '091 234 5678', email: 'bich.tran@banhang.vn', position: 'Kế toán viên', departmentId: 'd1' },
  { id: 'e3', code: 'NV0003', name: 'Lê Hoàng Cường', phone: '092 345 6789', email: 'cuong.le@banhang.vn', position: 'Thủ kho', departmentId: 'd2' },
  { id: 'e4', code: 'NV0004', name: 'Phạm Thu Dung', phone: '093 456 7890', email: 'dung.pham@banhang.vn', position: 'Trưởng phòng Nhân sự', departmentId: 'd4' },
  { id: 'e5', code: 'NV0005', name: 'Võ Minh Đức', phone: '094 567 8901', email: 'duc.vo@banhang.vn', position: 'Nhân viên kinh doanh', departmentId: 'd3' },
]);
export const unitsStore = makeStore('DVT', '/units', [
  { id: 'u1', code: 'DVT001', name: 'Cái' },
  { id: 'u2', code: 'DVT002', name: 'Chiếc' },
  { id: 'u3', code: 'DVT003', name: 'Bộ' },
  { id: 'u4', code: 'DVT004', name: 'Hộp' },
  { id: 'u5', code: 'DVT005', name: 'Thùng' },
  { id: 'u6', code: 'DVT006', name: 'Kg' },
  { id: 'u7', code: 'DVT007', name: 'Mét' },
  { id: 'u8', code: 'DVT008', name: 'Lít' },
]);
export const partnersStore = makeStore('DT', '/partners', [
  { id: 'pt1', code: 'DT0001', name: 'Công ty TNHH ABC', phone: '090 1234 567', address: 'TP. Hồ Chí Minh', kind: 'customer' },
  { id: 'pt2', code: 'DT0002', name: 'Công ty CP Phong Vũ', phone: '028 7300 8888', address: 'TP. Hồ Chí Minh', kind: 'supplier' },
  { id: 'pt3', code: 'DT0003', name: 'Nguyễn Văn Khách', phone: '090 1112 223', address: 'Hà Nội', kind: 'customer' },
  { id: 'pt4', code: 'DT0004', name: 'Công ty Digiworld', phone: '028 3915 1919', address: 'TP. Hồ Chí Minh', kind: 'both' },
]);
export const openingBalancesStore = makeStore('DK', '/opening-balances', []);
export const diningTablesStore = makeStore('BAN', '/dining-tables', [
  { id: 'dt1', code: 'BAN-01', name: 'Bàn 01', area: 'Tầng 1 (Trong nhà)', capacity: 4, status: 'empty', active: true, note: 'Gần cửa sổ' },
  { id: 'dt2', code: 'BAN-02', name: 'Bàn 02', area: 'Tầng 1 (Trong nhà)', capacity: 4, status: 'empty', active: true, note: '' },
  { id: 'dt3', code: 'BAN-03', name: 'Bàn 03', area: 'Tầng 1 (Trong nhà)', capacity: 2, status: 'empty', active: true, note: '' },
  { id: 'dt4', code: 'BAN-04', name: 'Bàn 04', area: 'Tầng 1 (Trong nhà)', capacity: 6, status: 'empty', active: true, note: 'Bàn tròn lớn' },
  { id: 'dt5', code: 'SV-01', name: 'Sân vườn 01', area: 'Sân vườn (Ngoài trời)', capacity: 4, status: 'empty', active: true, note: 'Có dù che nắng' },
  { id: 'dt6', code: 'SV-02', name: 'Sân vườn 02', area: 'Sân vườn (Ngoài trời)', capacity: 4, status: 'empty', active: true, note: 'Có dù che nắng' },
  { id: 'dt7', code: 'SV-03', name: 'Sân vườn 03', area: 'Sân vườn (Ngoài trời)', capacity: 8, status: 'empty', active: true, note: 'Bàn dài họp mặt' },
  { id: 'dt8', code: 'BAR-01', name: 'Bar 01', area: 'Quầy Bar', capacity: 1, status: 'empty', active: true, note: 'Ghế cao quầy bar' },
  { id: 'dt9', code: 'BAR-02', name: 'Bar 02', area: 'Quầy Bar', capacity: 1, status: 'empty', active: true, note: 'Ghế cao quầy bar' },
  { id: 'dt10', code: 'BAR-03', name: 'Bar 03', area: 'Quầy Bar', capacity: 1, status: 'empty', active: true, note: 'Ghế cao quầy bar' },
  { id: 'dt11', code: 'VIP-01', name: 'Phòng VIP 1', area: 'Khu VIP Lầu 1', capacity: 10, status: 'empty', active: true, note: 'Máy lạnh, tivi' },
  { id: 'dt12', code: 'VIP-02', name: 'Phòng VIP 2', area: 'Khu VIP Lầu 1', capacity: 12, status: 'empty', active: true, note: 'Máy lạnh riêng' },
]);
export const closingEntriesStore = makeStore('KC', '/closing-entries', [
  { id: 'kc1', code: 'KC0001', name: 'Kết chuyển doanh thu', fromAccount: '511', toAccount: '911', description: 'Kết chuyển doanh thu bán hàng cuối kỳ' },
  { id: 'kc2', code: 'KC0002', name: 'Kết chuyển giá vốn', fromAccount: '911', toAccount: '632', description: 'Kết chuyển giá vốn hàng bán cuối kỳ' },
  { id: 'kc3', code: 'KC0003', name: 'Kết chuyển chi phí quản lý', fromAccount: '911', toAccount: '642', description: 'Kết chuyển chi phí quản lý doanh nghiệp' },
  { id: 'kc4', code: 'KC0004', name: 'Kết chuyển lợi nhuận', fromAccount: '911', toAccount: '421', description: 'Kết chuyển lợi nhuận sau thuế' },
]);

// Chỉ dùng ở chế độ giả lập: sắp xếp / tìm theo "Tên loại vật tư" (sort=typeName).
// API thật thì server tự join bảng loại vật tư.
if (materialsStore.resolve) {
  materialsStore.resolve.typeName = (it) => materialTypesStore.list.find((x) => x.id === it.typeId)?.name ?? '';
}

// Các store KHÁC (vd. store của plugin kho) đăng ký thêm hàm xoá cache — core KHÔNG import plugin
// (giữ đúng hướng phụ thuộc plugin → core).
const extraResetters = new Set();
export const registerReset = (fn) => { if (typeof fn === 'function') extraResetters.add(fn); };

// Xóa cache của mọi danh mục + các store đã đăng ký: gọi khi đăng xuất / đổi tài khoản.
export const resetAllStores = () => {
  [
    suppliersStore, customersStore, warehousesStore, banksStore, materialTypesStore, materialsStore, accountsStore,
    departmentsStore, employeesStore, unitsStore, partnersStore, closingEntriesStore, openingBalancesStore, diningTablesStore,
  ].forEach((s) => s.reset());
  extraResetters.forEach((fn) => fn());
};

// Tìm kiếm cho ô autocomplete. Giả lập: lọc trong bộ nhớ (có độ trễ). Thật: gọi server
// GET /<resource>?q=...&page=1&pageSize=20. Kết quả trả về tối đa 20 dòng.
export const searchSuppliers = (q) => suppliersStore.search(q).then((rows) => rows.map((s) => ({ id: s.id, name: s.name, hint: s.code })));
export const searchCustomers = (q) => customersStore.search(q).then((rows) => rows.map((c) => ({ id: c.id, name: c.name, hint: c.code })));
export const searchBanks = (q) => banksStore.search(q).then((rows) => rows.map((b) => ({ id: b.id, name: b.name, hint: b.code })));
export const searchWarehouses = (q) => warehousesStore.search(q).then((rows) => rows.map((w) => ({ id: w.id, name: w.name, hint: w.code })));
export const searchMaterials = (q) => materialsStore.search(q).then((rows) => rows.map((m) => ({
  id: m.id,
  code: m.code,
  name: m.name,
  unit: m.unit,
  price: m.price,
  kind: m.kind || 'material',
  hint: `${m.code ? '[' + m.code + '] ' : ''}${m.kind === 'service' ? '🛎️ [Dịch vụ] ' : ''}${vnd(m.price)}/${m.unit || (m.kind === 'service' ? 'lần' : 'cái')}`
})));

export const findMaterialByCode = async (code) => {
  if (!code) return null;
  const q = String(code).trim().toLowerCase();
  const rows = await materialsStore.search(q, { limit: 10 });
  const exact = rows.find((m) => String(m.code || '').trim().toLowerCase() === q);
  if (exact) {
    return {
      id: exact.id,
      code: exact.code,
      name: exact.name,
      unit: exact.unit,
      price: exact.price,
      hint: `${exact.code ? '[' + exact.code + '] ' : ''}${vnd(exact.price)}/${exact.unit || 'cái'}`
    };
  }
  return null;
};