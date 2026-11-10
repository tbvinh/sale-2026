import { useEffect, useState } from 'react';
import { useI18n } from '../../core/i18n.jsx';
import { useAuth } from '../../core/auth.jsx';
import MediaUpload from '../../core/MediaUpload.jsx';
import { useConfirm } from '../../core/confirm.jsx';
import { Loading } from '../../core/ui.jsx';
import Denied from '../../core/Denied.jsx';
import { PLUGIN_IDS, ACTIONS } from '../../core/permissions.js';
import { getCompanyId, setActiveCompany, setCompanies } from '../../core/tenant.js';
import { resetAllStores } from '../../core/masterdata.js';
import { adminApi } from '../../api/adminApi.js';

const MODULE_KEYS = {
  inventory: 'inv.title', catalog: 'cat.title', opening: 'open.title', cash: 'cash.title',
  bank: 'bank.title', general: 'general.title', reports: 'reports.title',
};
const ACTION_KEYS = {
  read: 'admin.read', create: 'admin.create', update: 'admin.update',
  delete: 'admin.delete', import: 'admin.import', export: 'admin.export',
};

const messages = {
  vi: {
    'admin.title': 'Quản trị', 'admin.usersTab': 'Người dùng', 'admin.rolesTab': 'Vai trò & phân quyền',
    'admin.perm': 'Ma trận phân quyền', 'admin.plugin': 'Chức năng',
    'admin.read': 'Xem', 'admin.create': 'Thêm', 'admin.update': 'Sửa', 'admin.delete': 'Xóa',
    'admin.import': 'Import', 'admin.export': 'Export',
    'admin.note': 'Vai trò Quản trị viên luôn có đầy đủ quyền. Tick để cấp quyền chi tiết cho vai trò đang chọn.',
    'admin.username': 'Tên đăng nhập', 'admin.fullName': 'Họ tên', 'admin.password': 'Mật khẩu', 'admin.avatar': 'Ảnh đại diện',
    'admin.role': 'Vai trò', 'admin.active': 'Hoạt động', 'admin.actions': 'Thao tác',
    'admin.newUser': 'Thêm người dùng', 'admin.editUser': 'Sửa người dùng',
    'admin.searchUser': 'Tìm theo tên đăng nhập hoặc họ tên…',
    'admin.save': 'Lưu', 'admin.cancel': 'Hủy',
    'admin.confirmDeleteUser': 'Bạn có chắc muốn xóa người dùng "{name}"?',
    'admin.noUsers': 'Chưa có người dùng.', 'admin.loadFailed': 'Không tải được dữ liệu',
    'admin.passwordHint': 'Để trống nếu không đổi mật khẩu',
    'admin.newRole': 'Thêm vai trò', 'admin.editRole': 'Sửa vai trò', 'admin.roleCode': 'Mã vai trò',
    'admin.roleName': 'Tên vai trò', 'admin.roleDesc': 'Mô tả', 'admin.builtin': 'Hệ thống',
    'admin.userCount': 'Người dùng', 'admin.permissionCount': 'Quyền',
    'admin.confirmDeleteRole': 'Bạn có chắc muốn xóa vai trò "{name}"?',
    'admin.selectRole': 'Chọn vai trò để phân quyền', 'admin.saved': 'Đã lưu phân quyền.',
    'admin.adminFull': 'Vai trò Quản trị viên luôn có đầy đủ quyền.',
    'admin.noRoles': 'Chưa có vai trò.', 'admin.roleCodeHint': 'Chỉ gồm chữ thường, số, _ hoặc -',
    'admin.activeYes': 'Hoạt động', 'admin.activeNo': 'Đã khóa', 'admin.selectFirst': 'Chọn một vai trò ở cột bên trái.',
    'admin.companiesTab': 'Công ty', 'admin.companies': 'Danh mục công ty',
    'admin.companyCode': 'Mã công ty', 'admin.companyName': 'Tên công ty',
    'admin.companyAddress': 'Địa chỉ', 'admin.companyTaxCode': 'Mã số thuế', 'admin.companyPhone': 'Điện thoại',
    'admin.schemaName': 'Schema tenant', 'admin.companyStatus': 'Trạng thái', 'admin.createdAt': 'Ngày tạo',
    'admin.newCompany': 'Thêm công ty', 'admin.editCompany': 'Sửa công ty',
    'admin.schemaHint': 'Để trống để tự sinh từ mã công ty',
    'admin.companyActive': 'Hoạt động', 'admin.companyInactive': 'Ngừng hoạt động',
    'admin.confirmDeleteCompany': 'Bạn có chắc muốn xóa công ty "{name}" và toàn bộ dữ liệu tenant?',
    'admin.provisionNote': 'Tạo công ty sẽ tự tạo schema PostgreSQL và chạy migration cho tenant.',
    'admin.companySaved': 'Đã lưu công ty', 'admin.noData': 'Chưa có dữ liệu.',
    'admin.exportCompany': 'Xuất dữ liệu công ty (CSV ZIP)', 'admin.importCompany': 'Nhập dữ liệu công ty',
    'admin.selectAllCompanies': 'Chọn tất cả', 'admin.unselectAllCompanies': 'Bỏ chọn tất cả',
    'admin.exportSelected': 'Xuất công ty đã chọn ({n})', 'admin.exportingSelected': 'Đang xuất ({n})…',
    'admin.importFile': 'Tệp sao lưu (.zip — hỗ trợ gói 1 công ty, gói nhiều công ty hoặc chọn nhiều tệp)', 'admin.importTarget': 'Công ty đích',
    'admin.importNew': 'Tự động tạo mới / cập nhật theo mã công ty trong bản sao lưu', 'admin.importAction': 'Nhập dữ liệu',
    'admin.importing': 'Đang nhập…', 'admin.importProgress': 'Đang xử lý {p}%',
    'admin.importHint': 'Chấp nhận tệp .csv.zip của từng công ty hoặc gói nhiều công ty (companies-backup-*.zip).',
    'admin.importDone': 'Đã nhập {rows} dòng / {tables} bảng (schema {version}).',
    'admin.importMultiDone': 'Đã nhập {companies} công ty ({codes}) — tổng {rows} dòng / {tables} bảng.',
    'admin.cloneCompany': 'Nhân bản công ty',
    'admin.cloneHint': 'Tạo bản sao đầy đủ dữ liệu từ công ty "{name}".',
    'admin.cloneAction': 'Nhân bản', 'admin.cloning': 'Đang nhân bản…',
    'admin.cloneDone': 'Đã tạo công ty {code} ({rows} dòng / {tables} bảng).',
    'admin.truncateTab': 'Xóa dữ liệu phiếu',
    'admin.truncateNote': 'Tick chọn các loại chứng từ cần xóa trắng (Truncate) trong công ty đang chọn. Danh mục không bị ảnh hưởng.',
    'admin.truncateCompany': 'Công ty áp dụng',
    'admin.truncateDefaultCo': 'Công ty mặc định (public)',
    'admin.truncateSelectNonEmpty': 'Chọn các loại có phiếu',
    'admin.truncateAction': 'Truncate phiếu đã chọn ({n})',
    'admin.truncating': 'Đang xóa…',
    'admin.truncateConfirm': 'Bạn có chắc muốn xóa trắng (Truncate) {n} loại phiếu đã chọn của công ty "{company}"? Thao tác này không thể hoàn tác.',
    'admin.truncateDone': 'Đã xóa trắng {deleted} phiếu thuộc {types} loại chứng từ (schema {schema}).',
    'admin.voucherType': 'Loại chứng từ / phiếu',
    'admin.voucherPrefix': 'Ký hiệu',
    'admin.voucherTable': 'Bảng dữ liệu',
    'admin.voucherCount': 'Số phiếu hiện có',
    'admin.voucherSamples': 'Mã phiếu gần nhất',
    'admin.vtype.inv_import': 'Phiếu nhập kho',
    'admin.vtype.inv_export': 'Phiếu xuất kho',
    'admin.vtype.inv_return': 'Phiếu xuất trả nhà cung cấp',
    'admin.vtype.inv_transfer': 'Phiếu điều chuyển kho',
    'admin.vtype.cash_receipt': 'Phiếu thu tiền mặt',
    'admin.vtype.cash_payment': 'Phiếu chi tiền mặt',
    'admin.vtype.cash_exchange': 'Phiếu đổi tiền tệ',
    'admin.vtype.bank_credit': 'Báo có ngân hàng (Thu qua NH)',
    'admin.vtype.bank_debit': 'Báo nợ / Ủy nhiệm chi (Chi qua NH)',
    'admin.vtype.bank_transfer': 'Phiếu luân chuyển tiền tệ',
    'admin.vtype.general_journal': 'Phiếu kế toán tổng hợp',
    'admin.vtype.general_offset': 'Phiếu bù trừ công nợ',
    'admin.vtype.opening_balances': 'Tồn kho đầu kỳ (Vật tư, hàng hóa)',
    'admin.userCompanies': 'Công ty quản trị / Owner',
    'admin.allCompanies': 'Tất cả công ty (Quản trị hệ thống)',
    'admin.publicCoBadge': 'Công ty mặc định (public)',
    'admin.noCompanyAssigned': 'Chưa gán công ty',
    'admin.allowPublic': 'Cho phép truy cập Công ty mặc định (public)',
    'admin.assignCompanies': 'Phân quyền Công ty được phép quản trị / làm việc',
    'admin.isOwnerCol': 'Chủ sở hữu (Owner / Mặc định)',
    'admin.autoTenantUser': 'Đặt tự động theo Tenant (Owner)',
    'admin.autoTenantHint': 'Chọn công ty để tự động đặt username = user_<mã_cty>, vai trò Chủ sở hữu công ty (company_admin) và gán làm Owner:',
    'admin.companyOwnerCol': 'Owner / Người dùng',
    'admin.autoCreateOwner': 'Tự động tạo tài khoản Owner theo tenant (vai trò company_admin)',
    'admin.ownerUsername': 'Tài khoản Owner tự tạo',
    'admin.ownerPassword': 'Mật khẩu khởi tạo Owner',
    'admin.companyUsersSection': 'Người dùng được phép quản trị công ty này',
    'admin.ownerBadge': 'Owner',
  },
  en: {
    'admin.title': 'Administration', 'admin.usersTab': 'Users', 'admin.rolesTab': 'Roles & permissions',
    'admin.perm': 'Permission matrix', 'admin.plugin': 'Feature',
    'admin.read': 'Read', 'admin.create': 'Create', 'admin.update': 'Update', 'admin.delete': 'Delete',
    'admin.import': 'Import', 'admin.export': 'Export',
    'admin.note': 'The Admin role always has full access. Tick to grant granular permissions to the selected role.',
    'admin.username': 'Username', 'admin.fullName': 'Full name', 'admin.password': 'Password', 'admin.avatar': 'Avatar',
    'admin.role': 'Role', 'admin.active': 'Active', 'admin.actions': 'Actions',
    'admin.newUser': 'Add user', 'admin.editUser': 'Edit user',
    'admin.searchUser': 'Search by username or full name…',
    'admin.save': 'Save', 'admin.cancel': 'Cancel',
    'admin.confirmDeleteUser': 'Are you sure you want to delete user "{name}"?',
    'admin.noUsers': 'No users yet.', 'admin.loadFailed': 'Could not load data',
    'admin.passwordHint': 'Leave blank to keep the current password',
    'admin.newRole': 'Add role', 'admin.editRole': 'Edit role', 'admin.roleCode': 'Role code',
    'admin.roleName': 'Role name', 'admin.roleDesc': 'Description', 'admin.builtin': 'System',
    'admin.userCount': 'Users', 'admin.permissionCount': 'Permissions',
    'admin.confirmDeleteRole': 'Are you sure you want to delete role "{name}"?',
    'admin.selectRole': 'Select a role to assign permissions', 'admin.saved': 'Permissions saved.',
    'admin.adminFull': 'The Admin role always has full access.',
    'admin.noRoles': 'No roles yet.', 'admin.roleCodeHint': 'Lowercase letters, digits, _ or - only',
    'admin.activeYes': 'Active', 'admin.activeNo': 'Locked', 'admin.selectFirst': 'Select a role on the left.',
    'admin.companiesTab': 'Companies', 'admin.companies': 'Company catalog',
    'admin.companyCode': 'Company code', 'admin.companyName': 'Company name',
    'admin.companyAddress': 'Address', 'admin.companyTaxCode': 'Tax code', 'admin.companyPhone': 'Phone',
    'admin.schemaName': 'Tenant schema', 'admin.companyStatus': 'Status', 'admin.createdAt': 'Created at',
    'admin.newCompany': 'Add company', 'admin.editCompany': 'Edit company',
    'admin.schemaHint': 'Leave blank to generate from company code',
    'admin.companyActive': 'Active', 'admin.companyInactive': 'Inactive',
    'admin.confirmDeleteCompany': 'Are you sure you want to delete company "{name}" and all tenant data?',
    'admin.provisionNote': 'Creating a company provisions its PostgreSQL schema and runs tenant migrations.',
    'admin.companySaved': 'Company saved', 'admin.noData': 'No data yet.',
    'admin.exportCompany': 'Export company (CSV ZIP)', 'admin.importCompany': 'Import company',
    'admin.selectAllCompanies': 'Select all', 'admin.unselectAllCompanies': 'Unselect all',
    'admin.exportSelected': 'Export selected ({n})', 'admin.exportingSelected': 'Exporting ({n})…',
    'admin.importFile': 'Backup file (.zip — single company, multi-company bundle, or multiple files)', 'admin.importTarget': 'Target company',
    'admin.importNew': 'Auto-create / update by company code in backup', 'admin.importAction': 'Import data',
    'admin.importing': 'Importing…', 'admin.importProgress': 'Processing {p}%',
    'admin.importHint': 'Accepts single-company .csv.zip or multi-company bundle (companies-backup-*.zip).',
    'admin.importDone': 'Imported {rows} rows / {tables} tables (schema {version}).',
    'admin.importMultiDone': 'Imported {companies} companies ({codes}) — {rows} rows / {tables} tables.',
    'admin.cloneCompany': 'Clone company',
    'admin.cloneHint': 'Create a full data copy of "{name}".',
    'admin.cloneAction': 'Clone', 'admin.cloning': 'Cloning…',
    'admin.cloneDone': 'Created company {code} ({rows} rows / {tables} tables).',
    'admin.truncateTab': 'Truncate vouchers',
    'admin.truncateNote': 'Tick the voucher types to truncate in the selected company. Master data catalogs are preserved.',
    'admin.truncateCompany': 'Target company',
    'admin.truncateDefaultCo': 'Default company (public)',
    'admin.truncateSelectNonEmpty': 'Select non-empty types',
    'admin.truncateAction': 'Truncate selected ({n})',
    'admin.truncating': 'Truncating…',
    'admin.truncateConfirm': 'Are you sure you want to truncate {n} selected voucher types in "{company}"? This cannot be undone.',
    'admin.truncateDone': 'Truncated {deleted} vouchers across {types} voucher types (schema {schema}).',
    'admin.voucherType': 'Voucher type',
    'admin.voucherPrefix': 'Prefix',
    'admin.voucherTable': 'Table',
    'admin.voucherCount': 'Current count',
    'admin.voucherSamples': 'Recent voucher nos.',
    'admin.vtype.inv_import': 'Inventory Import (Receipt)',
    'admin.vtype.inv_export': 'Inventory Export (Issue)',
    'admin.vtype.inv_return': 'Supplier Return Voucher',
    'admin.vtype.inv_transfer': 'Warehouse Transfer Voucher',
    'admin.vtype.cash_receipt': 'Cash Receipt Voucher',
    'admin.vtype.cash_payment': 'Cash Payment Voucher',
    'admin.vtype.cash_exchange': 'Currency Exchange Voucher',
    'admin.vtype.bank_credit': 'Bank Credit Advice',
    'admin.vtype.bank_debit': 'Bank Debit / Payment Order',
    'admin.vtype.bank_transfer': 'Internal Bank Transfer',
    'admin.vtype.general_journal': 'General Journal Voucher',
    'admin.vtype.general_offset': 'Debt Offset Voucher',
    'admin.vtype.opening_balances': 'Opening Inventory (Products & Materials)',
    'admin.userCompanies': 'Assigned Companies / Owner',
    'admin.allCompanies': 'All companies (System Admin)',
    'admin.publicCoBadge': 'Default company (public)',
    'admin.noCompanyAssigned': 'No company assigned',
    'admin.allowPublic': 'Allow access to Default company (public)',
    'admin.assignCompanies': 'Assigned Companies for this User',
    'admin.isOwnerCol': 'Owner / Default on login',
    'admin.autoTenantUser': 'Auto-fill from Tenant (Owner)',
    'admin.autoTenantHint': 'Pick a company to auto-fill username = user_<code>, role = company_admin and set as Owner:',
    'admin.companyOwnerCol': 'Owner / Users',
    'admin.autoCreateOwner': 'Auto-create tenant Owner account (role: company_admin)',
    'admin.ownerUsername': 'Owner username',
    'admin.ownerPassword': 'Initial Owner password',
    'admin.companyUsersSection': 'Users allowed to manage this company',
    'admin.ownerBadge': 'Owner',
  },
};

const slugOwnerUsername = (code) => {
  const s = String(code ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!s) return 'user_company';
  return s.startsWith('user_') ? s : `user_${s}`;
};

const slugCompanyPrefix = (code) => {
  const s = String(code ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return s ? `${s}_` : '';
};

const buildPermMatrix = (mode = 'default') => {
  const m = {};
  for (const mod of PLUGIN_IDS) {
    m[mod] = {};
    for (const act of ACTIONS) {
      if (mode === 'full') m[mod][act] = true;
      else if (mode === 'readonly') m[mod][act] = act === 'read';
      else m[mod][act] = act !== 'delete';
    }
  }
  return m;
};

function Users({ can, isSystemAdmin = true, currentUser, onOpenBackup }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [companyList, setCompanyList] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async (search = q) => {
    setLoading(true);
    setError(null);
    try {
      const [users, roleList, allCos] = await Promise.all([
        adminApi.users.list({ q: search }),
        adminApi.roles.list().catch(() => []),
        (isSystemAdmin ? adminApi.companies.all() : adminApi.companies.list()).catch(() => []),
      ]);
      setRows(users?.items ?? []);
      setRoles(roleList ?? []);
      setCompanyList(allCos ?? []);
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(''); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const roleName = (code) => roles.find((r) => r.code === code)?.name ?? code;

  const primaryOwnerCo = () => {
    const activeCoId = getCompanyId();
    return companyList.find((c) => String(c.id) === String(activeCoId))
      ?? companyList.find((c) => String(c.id) === String(currentUser?.defaultCompanyId))
      ?? companyList[0]
      ?? null;
  };

  const openNew = () => {
    const defCo = primaryOwnerCo();
    setEditing({
      username: '',
      shortUsername: 'user1',
      fullName: '',
      password: '',
      imageUrl: '',
      role: isSystemAdmin
        ? (roles.find((r) => r.code === 'company_admin')?.code
            ?? roles.find((r) => r.code === 'user')?.code
            ?? roles[0]?.code ?? 'user')
        : 'user',
      active: true,
      allowPublic: false,
      companyIds: !isSystemAdmin && defCo ? [defCo.id] : [],
      ownerCompanyIds: [],
      defaultCompanyId: !isSystemAdmin && defCo ? defCo.id : null,
      permissions: buildPermMatrix('default'),
    });
  };

  const openEdit = (row) => {
    const cid = row.defaultCompanyId ?? row.companyIds?.[0];
    const co = companyList.find((c) => String(c.id) === String(cid)) ?? primaryOwnerCo();
    const prefix = slugCompanyPrefix(co?.code);
    const uname = String(row.username ?? '');
    const shortUname = prefix && uname.toLowerCase().startsWith(prefix)
      ? uname.slice(prefix.length)
      : uname;
    setEditing({
      ...row,
      originalUsername: uname,
      shortUsername: shortUname,
      password: '',
      allowPublic: row.role === 'admin' ? true : !!row.allowPublic,
      companyIds: Array.isArray(row.companyIds) ? [...row.companyIds] : [],
      ownerCompanyIds: Array.isArray(row.ownerCompanyIds) ? [...row.ownerCompanyIds] : [],
      defaultCompanyId: row.defaultCompanyId ?? null,
      permissions: row.permissions ? JSON.parse(JSON.stringify(row.permissions)) : buildPermMatrix('default'),
    });
  };

  const applyTenantPreset = (co) => {
    if (!co) return;
    const ownerRole = roles.find((r) => r.code === 'company_admin')?.code ?? editing.role;
    const nextCompanyIds = Array.from(new Set([...(editing.companyIds ?? []), co.id]));
    const nextOwners = Array.from(new Set([...(editing.ownerCompanyIds ?? []), co.id]));
    setEditing({
      ...editing,
      username: editing.id ? editing.username : slugOwnerUsername(co.code),
      fullName: editing.fullName || `Chủ sở hữu - ${co.name}`,
      password: editing.password || (!editing.id ? '123456' : ''),
      role: ownerRole,
      allowPublic: false,
      companyIds: nextCompanyIds,
      ownerCompanyIds: nextOwners,
      defaultCompanyId: co.id,
    });
  };

  const toggleUserCompany = (cid) => {
    const cur = new Set(editing.companyIds ?? []);
    const owners = new Set(editing.ownerCompanyIds ?? []);
    let defId = editing.defaultCompanyId;
    if (cur.has(cid)) {
      cur.delete(cid);
      owners.delete(cid);
      if (defId === cid) defId = Array.from(owners)[0] ?? Array.from(cur)[0] ?? null;
    } else {
      cur.add(cid);
      if (!defId) defId = cid;
    }
    setEditing({
      ...editing,
      companyIds: Array.from(cur),
      ownerCompanyIds: Array.from(owners),
      defaultCompanyId: defId,
    });
  };

  const toggleUserOwner = (cid) => {
    const cur = new Set(editing.companyIds ?? []);
    const owners = new Set(editing.ownerCompanyIds ?? []);
    let defId = editing.defaultCompanyId;
    if (owners.has(cid)) {
      owners.delete(cid);
      if (defId === cid) defId = Array.from(owners)[0] ?? Array.from(cur)[0] ?? null;
    } else {
      cur.add(cid);
      owners.add(cid);
      defId = cid;
    }
    setEditing({
      ...editing,
      companyIds: Array.from(cur),
      ownerCompanyIds: Array.from(owners),
      defaultCompanyId: defId,
    });
  };

  const togglePerm = (mod, act) => {
    const cur = editing.permissions ?? {};
    const nextMod = { ...(cur[mod] ?? {}), [act]: !cur[mod]?.[act] };
    setEditing({ ...editing, permissions: { ...cur, [mod]: nextMod } });
  };

  const toggleModuleAllPerms = (mod) => {
    const cur = editing.permissions ?? {};
    const allOn = ACTIONS.every((a) => !!cur[mod]?.[a]);
    const nextMod = {};
    for (const a of ACTIONS) nextMod[a] = !allOn;
    setEditing({ ...editing, permissions: { ...cur, [mod]: nextMod } });
  };

  const selectedSubCo = () => {
    const cid = editing?.defaultCompanyId ?? editing?.companyIds?.[0];
    return companyList.find((c) => String(c.id) === String(cid)) ?? primaryOwnerCo();
  };

  const computeEffectiveUsername = () => {
    if (!isSystemAdmin && editing?.role !== 'company_admin') {
      const co = selectedSubCo();
      const prefix = slugCompanyPrefix(co?.code);
      const raw = (editing.shortUsername ?? editing.username ?? '').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '_');
      if (!raw) return '';
      return raw.startsWith(prefix) ? raw : `${prefix}${raw}`;
    }
    return (editing.username ?? '').trim();
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const finalUsername = computeEffectiveUsername();
      const body = {
        username: finalUsername,
        fullName: (editing.fullName ?? '').trim(),
        imageUrl: editing.imageUrl ?? '',
        role: isSystemAdmin ? editing.role : 'user',
        active: !!editing.active,
        allowPublic: editing.role === 'admin' ? true : (isSystemAdmin ? !!editing.allowPublic : false),
        companyIds: editing.companyIds ?? [],
        ownerCompanyIds: isSystemAdmin ? (editing.ownerCompanyIds ?? []) : [],
        defaultCompanyId: editing.defaultCompanyId ?? null,
        customPermissions: editing.role !== 'admin' && editing.role !== 'company_admin',
        permissions: editing.permissions ?? null,
      };
      if (editing.password) body.password = editing.password;
      if (editing.id) await adminApi.users.update(editing.id, body);
      else await adminApi.users.create(body);
      setEditing(null);
      await load();
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    const name = row.fullName || row.username;
    if (!(await confirm(t('admin.confirmDeleteUser').replace('{name}', name)))) return;
    setError(null);
    try { await adminApi.users.remove(row.id); await load(); }
    catch (e) { setError(e?.message ?? String(e)); }
  };

  if (loading) return <Loading />;

  if (editing) {
    const isAdminUser = editing.role === 'admin';
    const isOwnerUser = editing.role === 'company_admin';
    const isEditingSelf = currentUser?.username && editing.username === currentUser.username;
    const subCo = selectedSubCo();
    const prefix = slugCompanyPrefix(subCo?.code);
    const previewLoginName = computeEffectiveUsername();

    return (
      <div>
        <h2>{editing.id ? t('admin.editUser') : t('admin.newUser')}</h2>
        {!editing.id && isSystemAdmin && companyList.length > 0 && (
          <div style={{ marginBottom: 14, padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>⚡ {t('admin.autoTenantUser')}</div>
            <div className="muted" style={{ marginBottom: 8 }}>{t('admin.autoTenantHint')}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {companyList.map((co) => (
                <button key={co.id} type="button" className="tb" onClick={() => applyTenantPreset(co)}>
                  🏢 {co.code} → <code>{slugOwnerUsername(co.code)}</code>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="admform">
          <label>{t('admin.username')}
            {!isSystemAdmin && !isOwnerUser && prefix ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="rolebadge" style={{ padding: '5px 8px', fontFamily: 'monospace', fontSize: 13 }}>
                    {prefix}
                  </span>
                  <input value={editing.shortUsername ?? ''} placeholder="vd: user1, ketoan1..."
                    onChange={(e) => setEditing({ ...editing, shortUsername: e.target.value })} />
                </div>
                <span className="muted" style={{ display: 'block', marginTop: 4 }}>
                  Tên đăng nhập: <code>{previewLoginName || `${prefix}user1`}</code> (tự gắn mã công ty để không trùng với công ty khác)
                </span>
              </div>
            ) : (
              <input value={editing.username}
                disabled={String(editing.originalUsername ?? '').toLowerCase() === 'admin'}
                onChange={(e) => setEditing({ ...editing, username: e.target.value })} />
            )}
          </label>
          <label>{t('admin.fullName')}
            <input value={editing.fullName ?? ''}
              onChange={(e) => setEditing({ ...editing, fullName: e.target.value })} />
          </label>
          <label>{t('admin.avatar')}
            <MediaUpload type="users" value={editing.imageUrl ?? ''}
              onChange={(url) => setEditing({ ...editing, imageUrl: url })} />
          </label>
          <label>{t('admin.password')}
            <input type="password" value={editing.password ?? ''} placeholder={t('admin.passwordHint')}
              onChange={(e) => setEditing({ ...editing, password: e.target.value })} />
          </label>
          {isSystemAdmin && (
            <label>{t('admin.role')}
              <select value={editing.role ?? ''} onChange={(e) => setEditing({ ...editing, role: e.target.value })}>
                {roles.map((r) => <option key={r.id} value={r.code}>{r.name}</option>)}
              </select>
            </label>
          )}
          {!isEditingSelf && (
            <label className="admcheck">
              <input type="checkbox" checked={!!editing.active}
                onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
              {t('admin.active')}
            </label>
          )}
        </div>

        {(isSystemAdmin || companyList.length > 1) && (
          <div style={{ marginTop: 16, maxWidth: 680 }}>
            <h3 style={{ margin: '0 0 8px' }}>🏢 {t('admin.assignCompanies')}</h3>
            {isAdminUser ? (
              <p className="muted">{t('admin.allCompanies')}</p>
            ) : (
              <>
                {isSystemAdmin && (
                  <label className="admcheck" style={{ marginBottom: 10 }}>
                    <input type="checkbox" checked={!!editing.allowPublic}
                      onChange={(e) => setEditing({ ...editing, allowPublic: e.target.checked })} />
                    {t('admin.allowPublic')}
                  </label>
                )}
                <table className="invtable zebra">
                  <thead>
                    <tr>
                      <th style={{ width: 42 }}>✓</th>
                      <th>{t('admin.companyCode')}</th>
                      <th>{t('admin.companyName')}</th>
                      {isSystemAdmin && <th>{t('admin.schemaName')}</th>}
                      {isSystemAdmin && <th>★ {t('admin.isOwnerCol')}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {companyList.map((co) => {
                      const checked = (editing.companyIds ?? []).includes(co.id);
                      const isOwner = (editing.ownerCompanyIds ?? []).includes(co.id);
                      return (
                        <tr key={co.id} style={checked ? { background: '#eff6ff' } : undefined}>
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={checked} onChange={() => toggleUserCompany(co.id)} />
                          </td>
                          <td><b>{co.code}</b></td>
                          <td>{co.name}</td>
                          {isSystemAdmin && <td><code>{co.schemaName}</code></td>}
                          {isSystemAdmin && (
                            <td>
                              <label className="admcheck" style={{ margin: 0 }}>
                                <input type="checkbox" checked={isOwner} onChange={() => toggleUserOwner(co.id)} />
                                <span>★ {t('admin.ownerBadge')}</span>
                              </label>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {!companyList.length && (
                      <tr><td colSpan={isSystemAdmin ? 5 : 3} className="empty">{t('admin.noData')}</td></tr>
                    )}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {!isAdminUser && (
          <div style={{ marginTop: 18, maxWidth: 760 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>
                {isOwnerUser
                  ? '🛡️ Quyền hạn của Chủ sở hữu công ty (Owner)'
                  : '🛡️ Phân quyền chức năng / chứng từ cho nhân viên này'}
              </h3>
              {!isOwnerUser && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="tb" onClick={() => setEditing({ ...editing, permissions: buildPermMatrix('full') })}>
                    ☑ Toàn quyền
                  </button>
                  <button type="button" className="tb" onClick={() => setEditing({ ...editing, permissions: buildPermMatrix('default') })}>
                    ✏️ Thêm/Sửa (Không Xóa)
                  </button>
                  <button type="button" className="tb" onClick={() => setEditing({ ...editing, permissions: buildPermMatrix('readonly') })}>
                    👁️ Chỉ xem
                  </button>
                </div>
              )}
            </div>
            {isOwnerUser && (
              <p className="admnote" style={{ marginBottom: 8 }}>
                ★ Tài khoản Chủ sở hữu công ty (Owner) mặc định có <b>toàn quyền Xem, Thêm, Sửa, Xóa, Import, Export</b> trên tất cả phân hệ và quyền <b>Xuất sao lưu / Nhập phục hồi dữ liệu công ty (.csv.zip)</b>.
              </p>
            )}
            <table className="permtable">
              <thead>
                <tr>
                  <th>{t('admin.plugin')}</th>
                  {ACTIONS.map((action) => <th key={action}>{t(ACTION_KEYS[action])}</th>)}
                </tr>
              </thead>
              <tbody>
                {PLUGIN_IDS.map((module) => (
                  <tr key={module}>
                    <td>
                      <button type="button" className="xbtn" style={{ fontWeight: 600 }}
                        disabled={isOwnerUser}
                        onClick={() => !isOwnerUser && toggleModuleAllPerms(module)}
                        title="Bật/tắt toàn bộ dòng này">
                        {t(MODULE_KEYS[module])}
                      </button>
                    </td>
                    {ACTIONS.map((action) => (
                      <td key={action}>
                        <input type="checkbox"
                          checked={isOwnerUser || !!editing.permissions?.[module]?.[action]}
                          disabled={isOwnerUser}
                          aria-label={`${t(MODULE_KEYS[module])} ${t(ACTION_KEYS[action])}`}
                          onChange={() => !isOwnerUser && togglePerm(module, action)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && <p className="formError" role="alert">{error}</p>}
        <div className="formActions" style={{ marginTop: 14 }}>
          <button className="btn" disabled={saving || !can('admin', editing.id ? 'update' : 'create')} onClick={save}>
            {t('admin.save')}
          </button>
          <button className="tb" disabled={saving} onClick={() => { setEditing(null); setError(null); }}>
            {t('admin.cancel')}
          </button>
        </div>
      </div>
    );
  }

  const quickExportOwnerCompany = async (co) => {
    const target = co ?? primaryOwnerCo();
    if (!target) return;
    setError(null);
    try {
      await adminApi.companies.export(target.id, target.code);
    } catch (e) {
      setError(e?.message ?? String(e));
    }
  };

  return (
    <div>
      <div className="cattools">
        <div className="searchbox">
          <span aria-hidden="true">🔍</span>
          <input type="search" value={q} placeholder={t('admin.searchUser')} aria-label={t('admin.searchUser')}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') load(q); }} />
        </div>
        <button type="button" className="tb" onClick={() => load(q)}>⟳ {t('common.refresh')}</button>
        {can('admin', 'create') && (
          <button type="button" className="tb" onClick={openNew}>➕ {t('admin.newUser')}</button>
        )}
        {!isSystemAdmin && primaryOwnerCo() && (
          <>
            <button type="button" className="tb" onClick={() => quickExportOwnerCompany()}>
              ⬇ Xuất sao lưu công ty ({primaryOwnerCo()?.code}.csv.zip)
            </button>
            {onOpenBackup && (
              <button type="button" className="tb" onClick={onOpenBackup}>
                ⬆ Nhập / Phục hồi công ty
              </button>
            )}
          </>
        )}
      </div>
      {error && <p className="formError" role="alert">{error}</p>}
      <table className="invtable zebra">
        <thead>
          <tr>
            <th>{t('admin.username')}</th><th>{t('admin.fullName')}</th><th>{t('admin.role')}</th>
            <th>{t('admin.userCompanies')}</th><th>{t('admin.active')}</th><th>{t('admin.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSelf = currentUser?.username && row.username === currentUser.username;
            const canDeleteRow = can('admin', 'delete') && !isSelf && (isSystemAdmin || row.role !== 'company_admin');
            const ownerCo = (row.companies ?? []).find((c) => c.isOwner) ?? row.companies?.[0] ?? null;
            return (
              <tr key={row.id}>
                <td>
                  <span className="medianame">
                    {row.imageUrl ? <img src={row.imageUrl} alt="" /> : null}{row.username}
                  </span>
                </td>
                <td>{row.fullName || ''}</td>
                <td>{roleName(row.role)}</td>
                <td>
                  {row.role === 'admin' ? (
                    <span className="rolebadge">{t('admin.allCompanies')}</span>
                  ) : (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(row.companies ?? []).map((c) => (
                        <span key={c.id} className="rolebadge"
                          style={c.isOwner ? { background: '#fef3c7', color: '#92400e', borderColor: '#f59e0b' } : undefined}
                          title={`${c.code} - ${c.name} (${c.schemaName})`}>
                          {c.isOwner ? `★ ${c.code} (${c.name})` : `${c.code} (${c.name})`}
                        </span>
                      ))}
                      {row.allowPublic && (
                        <span className="rolebadge" style={{ background: '#f1f5f9', color: '#475569' }}>
                          {t('admin.publicCoBadge')}
                        </span>
                      )}
                      {!(row.companies?.length) && !row.allowPublic && (
                        <span className="muted">{t('admin.noCompanyAssigned')}</span>
                      )}
                    </div>
                  )}
                </td>
                <td>{row.active ? t('admin.activeYes') : t('admin.activeNo')}</td>
                <td>
                  {row.role === 'company_admin' && ownerCo && (
                    <>
                      <button className="xbtn"
                        title={`Xuất sao lưu công ty ${ownerCo.code} (.csv.zip)`}
                        aria-label={`Xuất sao lưu công ty ${ownerCo.code}`}
                        onClick={() => quickExportOwnerCompany(ownerCo)}>⬇</button>
                      {!isSystemAdmin && onOpenBackup && (
                        <button className="xbtn"
                          title={`Nhập / Phục hồi dữ liệu công ty ${ownerCo.code}`}
                          aria-label={`Nhập / Phục hồi dữ liệu công ty ${ownerCo.code}`}
                          onClick={onOpenBackup}>⬆</button>
                      )}
                    </>
                  )}
                  {can('admin', 'update') && (
                    <button className="xbtn" title={t('admin.editUser')} aria-label={t('admin.editUser')}
                      onClick={() => openEdit(row)}>✏️</button>
                  )}
                  {canDeleteRow && (
                    <button className="xbtn" title={t('admin.delete')} aria-label={t('admin.delete')}
                      onClick={() => remove(row)}>🗑</button>
                  )}
                </td>
              </tr>
            );
          })}
          {!rows.length && <tr><td colSpan={6} className="empty">{t('admin.noUsers')}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Roles({ can }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const [roles, setRoles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [matrix, setMatrix] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async (preferId) => {
    setLoading(true);
    setError(null);
    try {
      const list = await adminApi.roles.list();
      const next = list?.find((r) => r.id === preferId)
        ?? list?.find((r) => r.id === selected?.id)
        ?? list?.find((r) => r.code === 'user')
        ?? list?.[0] ?? null;
      setRoles(list ?? []);
      setSelected(next);
      setMatrix(next ? await adminApi.roles.permissions(next.id) : {});
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectRole = async (role) => {
    setSelected(role);
    setError(null);
    setSaved(false);
    try { setMatrix(await adminApi.roles.permissions(role.id)); }
    catch (e) { setError(e?.message ?? String(e)); }
  };

  const toggle = (module, action) => {
    setSaved(false);
    setMatrix((m) => ({ ...m, [module]: { ...(m[module] ?? {}), [action]: !m[module]?.[action] } }));
  };

  const saveMatrix = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await adminApi.roles.savePermissions(selected.id, matrix);
      setSaved(true);
      const list = await adminApi.roles.list();
      setRoles(list ?? []);
      setSelected((cur) => (list ?? []).find((r) => r.id === cur?.id) ?? cur);
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const saveRole = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        code: (editing.code ?? '').trim(),
        name: (editing.name ?? '').trim(),
        description: (editing.description ?? '').trim(),
      };
      const roleId = editing.id;
      const saved = roleId ? await adminApi.roles.update(roleId, body) : await adminApi.roles.create(body);
      setEditing(null);
      await load(saved?.id ?? roleId);
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const removeRole = async (role) => {
    if (!(await confirm(t('admin.confirmDeleteRole').replace('{name}', role.name)))) return;
    setError(null);
    try { await adminApi.roles.remove(role.id); await load(); }
    catch (e) { setError(e?.message ?? String(e)); }
  };

  if (loading) return <Loading />;

  if (editing) {
    return (
      <div>
        <h2>{editing.id ? t('admin.editRole') : t('admin.newRole')}</h2>
        <div className="admform">
          <label>{t('admin.roleCode')}
            <input value={editing.code ?? ''} disabled={!!editing.id} placeholder={t('admin.roleCodeHint')}
              onChange={(e) => setEditing({ ...editing, code: e.target.value })} />
          </label>
          <label>{t('admin.roleName')}
            <input value={editing.name ?? ''}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </label>
          <label>{t('admin.roleDesc')}
            <input value={editing.description ?? ''}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          </label>
        </div>
        {error && <p className="formError" role="alert">{error}</p>}
        <div className="formActions">
          <button className="btn" disabled={saving || !can('admin', editing.id ? 'update' : 'create')} onClick={saveRole}>
            {t('admin.save')}
          </button>
          <button className="tb" disabled={saving} onClick={() => { setEditing(null); setError(null); }}>
            {t('admin.cancel')}
          </button>
        </div>
      </div>
    );
  }


  const isAdminRole = selected?.code === 'admin';

  return (
    <div>
      <div className="cattools">
        {can('admin', 'create') && (
          <button type="button" className="tb" onClick={() => setEditing({ code: '', name: '', description: '' })}>
            ➕ {t('admin.newRole')}
          </button>
        )}
      </div>
      {error && <p className="formError" role="alert">{error}</p>}

      <div className="admgrid">
        <div className="admroles">
          {roles.map((role) => (
            <button key={role.id} type="button" className={selected?.id === role.id ? 'on' : ''}
              onClick={() => selectRole(role)}>
              <span>{role.name}<br /><small>{role.code}</small></span>
              <small title={t('admin.userCount')}>{role.userCount}</small>
            </button>
          ))}
          {!roles.length && <p className="muted">{t('admin.noRoles')}</p>}
        </div>

        <div>
          {!selected ? <p className="muted">{t('admin.selectFirst')}</p> : (
            <>
              <div className="ghead">
                <h2>{selected.name} <small className="muted">({selected.code})</small></h2>
                <div>
                  {can('admin', 'update') && (
                    <button className="tb" title={t('admin.editRole')} aria-label={t('admin.editRole')}
                      onClick={() => setEditing({ ...selected })}>✏️ {t('admin.editRole')}</button>
                  )}{' '}
                  {can('admin', 'delete') && !selected.builtin && (
                    <button className="tb" title={t('admin.delete')} aria-label={t('admin.delete')}
                      onClick={() => removeRole(selected)}>🗑 {t('admin.delete')}</button>
                  )}
                </div>
              </div>
              {selected.description && <p className="muted">{selected.description}</p>}
              {isAdminRole && <p className="admnote">{t('admin.adminFull')}</p>}
              <p className="muted">{t('admin.note')}</p>

              <table className="permtable">
                <thead>
                  <tr>
                    <th>{t('admin.plugin')}</th>
                    {ACTIONS.map((action) => <th key={action}>{t(ACTION_KEYS[action])}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {PLUGIN_IDS.map((module) => (
                    <tr key={module}>
                      <td>{t(MODULE_KEYS[module])}</td>
                      {ACTIONS.map((action) => (
                        <td key={action}>
                          <input type="checkbox"
                            checked={isAdminRole || !!matrix[module]?.[action]}
                            disabled={isAdminRole || !can('admin', 'update')}
                            aria-label={`${t(MODULE_KEYS[module])} ${t(ACTION_KEYS[action])}`}
                            onChange={() => toggle(module, action)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="formActions">
                <button className="btn" disabled={saving || isAdminRole || !can('admin', 'update')} onClick={saveMatrix}>
                  {t('admin.save')}
                </button>
                {saved && <span className="okmark" role="status">{t('admin.saved')}</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


function Companies({ can, onOpenTruncate }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const [rows, setRows] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [exportingBatch, setExportingBatch] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFiles, setImportFiles] = useState([]);
  const [importTarget, setImportTarget] = useState('');
  const [restoreUsers, setRestoreUsers] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importPct, setImportPct] = useState(0);
  const [importError, setImportError] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneSource, setCloneSource] = useState(null);
  const [cloneForm, setCloneForm] = useState({ code: '', name: '' });
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState(null);
  const [cloneResult, setCloneResult] = useState(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [all, available, userRes] = await Promise.all([
        adminApi.companies.all(),
        adminApi.companies.list(),
        adminApi.users.list().catch(() => ({ items: [] })),
      ]);
      setRows(all ?? []);
      setSelectedIds((cur) => cur.filter((id) => (all ?? []).some((r) => r.id === id)));
      setCompanies(available ?? []);
      setAllUsers(userRes?.items ?? []);
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openNewCompany = () => setEditing({
    code: '', name: '', address: '', taxCode: '', phone: '', schemaName: '', status: 'active',
    autoCreateOwner: true, ownerUsername: '', ownerPassword: '123456',
    ownerUserId: null, userIds: [],
  });

  const openEditCompany = (row) => setEditing({
    ...row,
    schemaName: row.schemaName ?? '',
    autoCreateOwner: false,
    ownerUsername: row.suggestedOwnerUsername || slugOwnerUsername(row.code),
    ownerPassword: '123456',
    ownerUserId: row.ownerUserId ?? null,
    userIds: Array.isArray(row.userIds) ? [...row.userIds] : [],
  });

  const toggleCompanyUser = (uid) => {
    const cur = new Set(editing.userIds ?? []);
    let ownerId = editing.ownerUserId;
    if (cur.has(uid)) {
      cur.delete(uid);
      if (ownerId === uid) ownerId = null;
    } else {
      cur.add(uid);
      if (!ownerId) ownerId = uid;
    }
    setEditing({ ...editing, userIds: Array.from(cur), ownerUserId: ownerId });
  };

  const setCompanyOwnerUser = (uid) => {
    const cur = new Set(editing.userIds ?? []);
    if (uid) cur.add(uid);
    setEditing({ ...editing, userIds: Array.from(cur), ownerUserId: uid, autoCreateOwner: false });
  };

  const quickCreateOwner = async (row) => {
    setError(null);
    try {
      await adminApi.companies.update(row.id, {
        name: row.name,
        address: row.address,
        taxCode: row.taxCode,
        phone: row.phone,
        status: row.status,
        autoCreateOwner: true,
        ownerUsername: row.suggestedOwnerUsername || slugOwnerUsername(row.code),
        ownerPassword: '123456',
        userIds: row.userIds ?? [],
      });
      setSaved(true);
      await load(true);
    } catch (e) {
      setError(e?.message ?? String(e));
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const code = (editing.code ?? '').trim();
      const body = {
        code,
        name: (editing.name ?? '').trim(),
        address: (editing.address ?? '').trim(),
        taxCode: (editing.taxCode ?? '').trim(),
        phone: (editing.phone ?? '').trim(),
        schemaName: (editing.schemaName ?? '').trim(),
        status: editing.status ?? 'active',
        autoCreateOwner: !!editing.autoCreateOwner,
        ownerUsername: (editing.ownerUsername || slugOwnerUsername(code)).trim(),
        ownerPassword: editing.ownerPassword || '123456',
        ownerUserId: editing.ownerUserId ?? null,
        userIds: editing.userIds ?? [],
      };
      if (editing.id) await adminApi.companies.update(editing.id, body);
      else await adminApi.companies.create(body);
      setEditing(null);
      setSaved(true);
      await load();
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!(await confirm(t('admin.confirmDeleteCompany').replace('{name}', row.name)))) return;
    setError(null);
    try {
      await adminApi.companies.remove(row.id);
      if (String(getCompanyId()) === String(row.id)) setActiveCompany('');
      await load();
    } catch (e) {
      setError(e?.message ?? String(e));
    }
  };

  const exportCompany = async (row) => {
    setError(null);
    try {
      await adminApi.companies.export(row.id, row.code);
    } catch (e) {
      setError(e?.message ?? String(e));
    }
  };

  const allCompanyIds = rows.map((r) => r.id);
  const allCompaniesSelected = allCompanyIds.length > 0 && allCompanyIds.every((id) => selectedIds.includes(id));

  const toggleSelectCompany = (id) => {
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const toggleSelectAllCompanies = () => {
    setSelectedIds(allCompaniesSelected ? [] : allCompanyIds);
  };

  const exportSelectedCompanies = async () => {
    if (!selectedIds.length || exportingBatch) return;
    setExportingBatch(true);
    setError(null);
    try {
      if (selectedIds.length === 1) {
        const single = rows.find((r) => r.id === selectedIds[0]);
        await adminApi.companies.export(selectedIds[0], single?.code);
      } else {
        await adminApi.companies.exportBatch(selectedIds);
      }
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setExportingBatch(false);
    }
  };

  const openImport = () => {
    setImportOpen(true);
    setImportFiles([]);
    setImportTarget('');
    setRestoreUsers(true);
    setImportPct(0);
    setImportError(null);
    setImportResult(null);
  };

  const importCompany = async () => {
    if (!importFiles.length || importing) return;
    setImporting(true);
    setImportPct(0);
    setImportError(null);
    setImportResult(null);
    try {
      if (importFiles.length === 1) {
        const result = await adminApi.companies.import(importFiles[0], importTarget || null, setImportPct, restoreUsers);
        setImportResult(result);
      } else {
        let totalTables = 0;
        let totalRows = 0;
        let totalUsers = 0;
        let totalCos = 0;
        const codes = [];
        for (let i = 0; i < importFiles.length; i++) {
          const f = importFiles[i];
          const res = await adminApi.companies.import(
            f,
            null,
            (pct) => setImportPct(Math.round(((i + pct / 100) / importFiles.length) * 100)),
            restoreUsers,
          );
          if (res?.multi) {
            totalCos += Number(res.companyCount ?? 0);
            if (Array.isArray(res.codes)) codes.push(...res.codes);
          } else {
            totalCos += 1;
            if (res?.code) codes.push(res.code);
          }
          totalTables += Number(res?.tables ?? 0);
          totalRows += Number(res?.rows ?? 0);
          totalUsers += Number(res?.usersRestored ?? 0);
        }
        setImportResult({
          multi: true,
          companyCount: totalCos,
          codes,
          tables: totalTables,
          rows: totalRows,
          usersRestored: totalUsers,
        });
      }
      setImportPct(100);
      setImportFiles([]);
      resetAllStores();
      await load(true);
    } catch (e) {
      setImportError(e?.message ?? String(e));
    } finally {
      setImporting(false);
    }
  };

  const openClone = (row) => {
    setCloneSource(row);
    setCloneForm({
      code: (row.code + '_COPY').slice(0, 50),
      name: (row.name + ' (Copy)').slice(0, 150),
    });
    setCloneError(null);
    setCloneResult(null);
    setCloneOpen(true);
  };

  const cloneCompany = async () => {
    if (!cloneSource || cloning) return;
    const code = cloneForm.code.trim();
    const name = cloneForm.name.trim();
    if (!code || !name) return;
    setCloning(true);
    setCloneError(null);
    setCloneResult(null);
    try {
      const result = await adminApi.companies.clone(cloneSource.id, { code, name });
      setCloneResult(result);
      await load(true);
    } catch (e) {
      setCloneError(e?.message ?? String(e));
    } finally {
      setCloning(false);
    }
  };

  if (loading) return <Loading />;


  if (editing) {
    const autoOwnerName = editing.ownerUsername || slugOwnerUsername(editing.code);
    const selectableUsers = allUsers.filter((u) => u.role !== 'admin');
    return (
      <div>
        <h2>{editing.id ? t('admin.editCompany') : t('admin.newCompany')}</h2>
        <div className="admform">
          <label>{t('admin.companyCode')}
            <input value={editing.code ?? ''} disabled={!!editing.id}
              onChange={(e) => setEditing({ ...editing, code: e.target.value })} />
          </label>
          <label>{t('admin.companyName')}
            <input value={editing.name ?? ''}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </label>
          <label>{t('admin.companyAddress')}
            <input value={editing.address ?? ''}
              onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
          </label>
          <label>{t('admin.companyTaxCode')}
            <input value={editing.taxCode ?? ''}
              onChange={(e) => setEditing({ ...editing, taxCode: e.target.value })} />
          </label>
          <label>{t('admin.companyPhone')}
            <input value={editing.phone ?? ''}
              onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
          </label>
          <label>{t('admin.schemaName')}
            <input value={editing.schemaName ?? ''} disabled={!!editing.id} placeholder={t('admin.schemaHint')}
              onChange={(e) => setEditing({ ...editing, schemaName: e.target.value })} />
          </label>
          <label>{t('admin.companyStatus')}
            <select value={editing.status ?? 'active'}
              onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
              <option value="active">{t('admin.companyActive')}</option>
              <option value="inactive">{t('admin.companyInactive')}</option>
            </select>
          </label>
        </div>

        <div style={{ marginTop: 16, maxWidth: 680 }}>
          <h3 style={{ margin: '0 0 8px' }}>👤 {t('admin.companyUsersSection')}</h3>
          <div style={{ marginBottom: 12, padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6 }}>
            <label className="admcheck" style={{ marginBottom: editing.autoCreateOwner ? 8 : 0 }}>
              <input type="checkbox" checked={!!editing.autoCreateOwner}
                onChange={(e) => setEditing({ ...editing, autoCreateOwner: e.target.checked })} />
              <b>⚡ {t('admin.autoCreateOwner')}</b>
            </label>
            {editing.autoCreateOwner && (
              <div className="admform" style={{ marginTop: 8 }}>
                <label>{t('admin.ownerUsername')}
                  <input value={editing.ownerUsername || slugOwnerUsername(editing.code)}
                    onChange={(e) => setEditing({ ...editing, ownerUsername: e.target.value })} />
                </label>
                <label>{t('admin.ownerPassword')}
                  <input type="text" value={editing.ownerPassword ?? '123456'}
                    onChange={(e) => setEditing({ ...editing, ownerPassword: e.target.value })} />
                </label>
                <span className="muted" style={{ gridColumn: '1 / -1' }}>
                  Sẽ tạo/gán tài khoản <code>{autoOwnerName}</code> (vai trò <code>company_admin</code>) làm ★ Owner mặc định của công ty này.
                </span>
              </div>
            )}
          </div>

          {selectableUsers.length > 0 && (
            <table className="invtable zebra">
              <thead>
                <tr>
                  <th style={{ width: 42 }}>✓</th>
                  <th>{t('admin.username')}</th>
                  <th>{t('admin.fullName')}</th>
                  <th>{t('admin.role')}</th>
                  <th>★ {t('admin.isOwnerCol')}</th>
                </tr>
              </thead>
              <tbody>
                {selectableUsers.map((u) => {
                  const checked = (editing.userIds ?? []).includes(u.id);
                  const isOwner = editing.ownerUserId === u.id;
                  return (
                    <tr key={u.id} style={checked ? { background: '#eff6ff' } : undefined}>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleCompanyUser(u.id)} />
                      </td>
                      <td><b>{u.username}</b></td>
                      <td>{u.fullName || ''}</td>
                      <td><code>{u.role}</code></td>
                      <td>
                        <label className="admcheck" style={{ margin: 0 }}>
                          <input type="radio" name="companyOwner" checked={isOwner}
                            onChange={() => setCompanyOwnerUser(u.id)} />
                          <span>★ {t('admin.ownerBadge')}</span>
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {error && <p className="formError" role="alert">{error}</p>}
        <div className="formActions" style={{ marginTop: 14 }}>
          <button className="btn" disabled={saving || !can('admin', editing.id ? 'update' : 'create')} onClick={save}>
            {t('admin.save')}
          </button>
          <button className="tb" disabled={saving} onClick={() => { setEditing(null); setError(null); }}>
            {t('admin.cancel')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="cattools">
        {can('admin', 'create') && (
          <button type="button" className="tb" onClick={openNewCompany}>
            ➕ {t('admin.newCompany')}
          </button>
        )}
        {rows.length > 0 && (
          <button type="button" className="tb" onClick={toggleSelectAllCompanies}>
            {allCompaniesSelected ? `☐ ${t('admin.unselectAllCompanies')}` : `☑ ${t('admin.selectAllCompanies')} (${rows.length})`}
          </button>
        )}
        {can('admin', 'export') && (
          <button type="button" className="tb" disabled={!selectedIds.length || exportingBatch} onClick={exportSelectedCompanies}>
            ⬇ {(exportingBatch ? t('admin.exportingSelected') : t('admin.exportSelected')).replace('{n}', selectedIds.length)}
          </button>
        )}
        {can('admin', 'import') && (
          <button type="button" className="tb" onClick={openImport}>⬆ {t('admin.importCompany')}</button>
        )}
        <span className="muted">{t('admin.provisionNote')}</span>
      </div>
      {saved && <p className="okmark" role="status">{t('admin.companySaved')}</p>}
      {error && <p className="formError" role="alert">{error}</p>}

      <table className="invtable zebra">
        <thead>
          <tr>
            <th style={{ width: 36, textAlign: 'center' }}>
              <input type="checkbox" checked={allCompaniesSelected} onChange={toggleSelectAllCompanies}
                disabled={!rows.length} aria-label={t('admin.selectAllCompanies')} />
            </th>
            <th>{t('admin.companyCode')}</th><th>{t('admin.companyName')}</th>
            <th>{t('admin.schemaName')}</th><th>{t('admin.companyOwnerCol')}</th>
            <th>{t('admin.companyStatus')}</th><th>{t('admin.createdAt')}</th><th>{t('admin.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isChecked = selectedIds.includes(row.id);
            return (
              <tr key={row.id} className={isChecked ? 'sel' : ''} onClick={() => toggleSelectCompany(row.id)} style={{ cursor: 'pointer' }}>
                <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={isChecked} onChange={() => toggleSelectCompany(row.id)}
                    aria-label={`${row.code} - ${row.name}`} />
                </td>
                <td>{row.code}</td>
                <td>{row.name}</td>
                <td><code>{row.schemaName}</code></td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    {(row.users ?? []).map((u) => (
                      <span key={u.id} className="rolebadge"
                        style={u.isOwner ? { background: '#fef3c7', color: '#92400e', borderColor: '#f59e0b' } : undefined}
                        title={u.fullName || u.username}>
                        {u.isOwner ? `★ ${u.username}` : u.username}
                      </span>
                    ))}
                    {!row.ownerUsername && can('admin', 'update') && (
                      <button type="button" className="tb" style={{ padding: '2px 8px', fontSize: 12 }}
                        onClick={() => quickCreateOwner(row)}
                        title={`Tạo nhanh tài khoản Owner ${row.suggestedOwnerUsername || slugOwnerUsername(row.code)} (mật khẩu 123456)`}>
                        ⚡ Tạo <code>{row.suggestedOwnerUsername || slugOwnerUsername(row.code)}</code>
                      </button>
                    )}
                  </div>
                </td>
                <td>{row.status === 'active' ? t('admin.companyActive') : t('admin.companyInactive')}</td>
                <td>{String(row.createdAt ?? '').replace('T', ' ').slice(0, 19)}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  {can('admin', 'delete') && onOpenTruncate && (
                    <button className="xbtn" title={t('admin.truncateTab')} aria-label={t('admin.truncateTab')}
                      onClick={() => onOpenTruncate(String(row.id))}>🧹</button>
                  )}
                  {can('admin', 'create') && (
                    <button className="xbtn" title={t('admin.cloneCompany')} aria-label={t('admin.cloneCompany')}
                      onClick={() => openClone(row)}>📋</button>
                  )}
                  {can('admin', 'export') && (
                    <button className="xbtn" title={t('admin.exportCompany')} aria-label={t('admin.exportCompany')}
                      onClick={() => exportCompany(row)}>⬇</button>
                  )}
                  {can('admin', 'update') && (
                    <button className="xbtn" title={t('admin.editCompany')} aria-label={t('admin.editCompany')}
                      onClick={() => openEditCompany(row)}>✏️</button>
                  )}
                  {can('admin', 'delete') && (
                    <button className="xbtn" title={t('admin.delete')} aria-label={t('admin.delete')}
                      onClick={() => remove(row)}>🗑</button>
                  )}
                </td>
              </tr>
            );
          })}
          {!rows.length && <tr><td colSpan={8} className="empty">{t('admin.noData')}</td></tr>}
        </tbody>
      </table>

      {importOpen && (
        <div className="confirm-backdrop" onMouseDown={() => !importing && setImportOpen(false)}>
          <div className="confirm-box" style={{ width: 480 }} role="dialog" aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}>
            <h3>{t('admin.importCompany')}</h3>
            <p className="muted">{t('admin.importHint')}</p>
            <div className="admform" style={{ display: 'grid', gridTemplateColumns: '1fr', maxWidth: 'none' }}>
              <label>{t('admin.importFile')}
                <input type="file" multiple accept=".zip,.csv.zip,.tar.zip,application/zip" disabled={importing}
                  onChange={(e) => {
                    setImportFiles(Array.from(e.target.files ?? []));
                    setImportError(null);
                    setImportResult(null);
                  }} />
              </label>
              {importFiles.length <= 1 && (
                <label>{t('admin.importTarget')}
                  <select value={importTarget} disabled={importing}
                    onChange={(e) => setImportTarget(e.target.value)}>
                    <option value="">{t('admin.importNew')}</option>
                    {rows.map((row) => <option key={row.id} value={String(row.id)}>{row.code} - {row.name}</option>)}
                  </select>
                </label>
              )}
              <label className="admcheck">
                <input type="checkbox" checked={restoreUsers} disabled={importing}
                  onChange={(e) => setRestoreUsers(e.target.checked)} />
                <span>Khôi phục kèm tài khoản Owner & Sub-user từ bản sao lưu</span>
              </label>
              {importing && (
                <>
                  <progress value={importPct} max={100} style={{ width: '100%' }} />
                  <span className="muted">{t('admin.importProgress').replace('{p}', importPct)}</span>
                </>
              )}
              {importError && <p className="formError" role="alert">{importError}</p>}
              {importResult && (
                <p className="okmark" role="status">
                  {importResult.multi
                    ? t('admin.importMultiDone')
                        .replace('{companies}', importResult.companyCount)
                        .replace('{codes}', Array.isArray(importResult.codes) ? importResult.codes.join(', ') : '')
                        .replace('{tables}', importResult.tables)
                        .replace('{rows}', importResult.rows)
                    : t('admin.importDone')
                        .replace('{tables}', importResult.tables)
                        .replace('{rows}', importResult.rows)
                        .replace('{version}', importResult.schemaVersion)}
                  {importResult.usersRestored > 0 ? ` (+${importResult.usersRestored} tài khoản)` : ''}
                </p>
              )}
            </div>
            <div className="confirm-actions">
              <button className="tb" disabled={importing} onClick={() => setImportOpen(false)}>{t('admin.cancel')}</button>
              <button className="btn" disabled={!importFiles.length || importing} onClick={importCompany}>
                {importing ? t('admin.importing') : t('admin.importAction')}
              </button>
            </div>
          </div>
        </div>
      )}

      {cloneOpen && (
        <div className="confirm-backdrop" onMouseDown={() => !cloning && setCloneOpen(false)}>
          <div className="confirm-box" style={{ width: 420 }} role="dialog" aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}>
            <h3>{t('admin.cloneCompany')}</h3>
            <p className="muted">{t('admin.cloneHint').replace('{name}', cloneSource?.name ?? '')}</p>
            <div className="admform" style={{ display: 'grid', gridTemplateColumns: '1fr', maxWidth: 'none' }}>
              <label>{t('admin.companyCode')}
                <input value={cloneForm.code} disabled={cloning}
                  onChange={(e) => setCloneForm({ ...cloneForm, code: e.target.value })} />
              </label>
              <label>{t('admin.companyName')}
                <input value={cloneForm.name} disabled={cloning}
                  onChange={(e) => setCloneForm({ ...cloneForm, name: e.target.value })} />
              </label>
              {cloneError && <p className="formError" role="alert">{cloneError}</p>}
              {cloneResult && (
                <p className="okmark" role="status">
                  {t('admin.cloneDone')
                    .replace('{code}', cloneResult.code)
                    .replace('{rows}', cloneResult.rows)
                    .replace('{tables}', cloneResult.tables)}
                </p>
              )}
            </div>
            <div className="confirm-actions">
              <button className="tb" disabled={cloning} onClick={() => setCloneOpen(false)}>{t('admin.cancel')}</button>
              <button className="btn" disabled={cloning || !cloneForm.code.trim() || !cloneForm.name.trim()} onClick={cloneCompany}>
                {cloning ? t('admin.cloning') : t('admin.cloneAction')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VoucherTruncate({ can, initialCompanyId }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const [companies, setCompanyList] = useState([]);
  const [companyId, setCompanyId] = useState(() => initialCompanyId ?? getCompanyId() ?? '');
  const [schemaName, setSchemaName] = useState('public');
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [truncating, setTruncating] = useState(false);
  const [error, setError] = useState(null);
  const [doneMsg, setDoneMsg] = useState(null);

  const load = async (targetCo = companyId, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [coList, voucherData] = await Promise.all([
        adminApi.companies.all(),
        adminApi.companies.vouchers(targetCo || 'public'),
      ]);
      setCompanyList(coList ?? []);
      setSchemaName(voucherData?.schemaName ?? 'public');
      setItems(voucherData?.items ?? []);
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCompanyId !== undefined && initialCompanyId !== null) {
      setCompanyId(initialCompanyId);
      setSelected([]);
      setDoneMsg(null);
      load(initialCompanyId);
    } else {
      load(companyId);
    }
  }, [initialCompanyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeCompany = (nextId) => {
    setCompanyId(nextId);
    setSelected([]);
    setDoneMsg(null);
    load(nextId);
  };

  const toggle = (key) => {
    setDoneMsg(null);
    setSelected((cur) => (cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key]));
  };

  const allKeys = items.map((i) => i.key);
  const allChecked = allKeys.length > 0 && allKeys.every((k) => selected.includes(k));
  const toggleAll = () => {
    setDoneMsg(null);
    setSelected(allChecked ? [] : allKeys);
  };

  const selectNonEmpty = () => {
    setDoneMsg(null);
    setSelected(items.filter((i) => Number(i.count) > 0).map((i) => i.key));
  };

  const companyLabel = () => {
    if (!companyId) return t('admin.truncateDefaultCo');
    const found = companies.find((c) => String(c.id) === String(companyId));
    return found ? `${found.code} - ${found.name}` : companyId;
  };

  const runTruncate = async () => {
    if (!selected.length || truncating) return;
    const msg = t('admin.truncateConfirm')
      .replace('{n}', selected.length)
      .replace('{company}', companyLabel());
    if (!(await confirm(msg))) return;

    setTruncating(true);
    setError(null);
    setDoneMsg(null);
    try {
      const res = await adminApi.companies.truncateVouchers({
        companyId: companyId || 'public',
        types: selected,
      });
      setItems(res?.items ?? []);
      setSchemaName(res?.schemaName ?? schemaName);
      setSelected([]);
      resetAllStores();
      setDoneMsg(
        t('admin.truncateDone')
          .replace('{deleted}', res?.deleted ?? 0)
          .replace('{types}', res?.types ?? selected.length)
          .replace('{schema}', res?.schemaName ?? schemaName),
      );
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setTruncating(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <div className="cattools">
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <b>{t('admin.truncateCompany')}:</b>
          <select value={companyId} disabled={truncating} onChange={(e) => changeCompany(e.target.value)}>
            <option value="">{t('admin.truncateDefaultCo')}</option>
            {companies.map((c) => (
              <option key={c.id} value={String(c.id)}>{c.code} - {c.name} ({c.schemaName})</option>
            ))}
          </select>
        </label>
        <button type="button" className="tb" disabled={truncating} onClick={() => load(companyId)}>
          ⟳ {t('common.refresh')}
        </button>
        <button type="button" className="tb" disabled={truncating} onClick={selectNonEmpty}>
          ☑ {t('admin.truncateSelectNonEmpty')}
        </button>
        {can('admin', 'delete') && (
          <button type="button" className="btn" disabled={!selected.length || truncating} onClick={runTruncate}>
            🗑 {truncating ? t('admin.truncating') : t('admin.truncateAction').replace('{n}', selected.length)}
          </button>
        )}
      </div>
      <p className="muted">
        {t('admin.truncateNote')} Schema: <code>{schemaName}</code>
      </p>
      {doneMsg && <p className="okmark" role="status">{doneMsg}</p>}
      {error && <p className="formError" role="alert">{error}</p>}

      <table className="invtable zebra">
        <thead>
          <tr>
            <th style={{ width: 36, textAlign: 'center' }}>
              <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all" />
            </th>
            <th>{t('admin.plugin')}</th>
            <th>{t('admin.voucherType')}</th>
            <th>{t('admin.voucherPrefix')}</th>
            <th>{t('admin.voucherTable')}</th>
            <th style={{ textAlign: 'right' }}>{t('admin.voucherCount')}</th>
            <th>{t('admin.voucherSamples')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isChecked = selected.includes(item.key);
            return (
              <tr key={item.key} className={isChecked ? 'sel' : ''} onClick={() => toggle(item.key)} style={{ cursor: 'pointer' }}>
                <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={isChecked} onChange={() => toggle(item.key)}
                    aria-label={t('admin.vtype.' + item.key)} />
                </td>
                <td>{t(MODULE_KEYS[item.module] ?? item.module)}</td>
                <td><b>{t('admin.vtype.' + item.key)}</b></td>
                <td><code>{item.prefix}</code></td>
                <td><code>{item.table}</code></td>
                <td style={{ textAlign: 'right', fontWeight: item.count > 0 ? 700 : 400 }}>
                  {Number(item.count ?? 0).toLocaleString('vi-VN')}
                </td>
                <td className="muted">
                  {Array.isArray(item.samples) && item.samples.length ? item.samples.join(', ') : '—'}
                </td>
              </tr>
            );
          })}
          {!items.length && <tr><td colSpan={7} className="empty">{t('admin.noData')}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function OwnerCompanyBackup() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const [companies, setCompanyList] = useState([]);
  const [selectedId, setSelectedId] = useState(() => getCompanyId() || '');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [restoreUsers, setRestoreUsers] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importPct, setImportPct] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    adminApi.companies.list()
      .then((list) => {
        if (!alive) return;
        const arr = list ?? [];
        setCompanyList(arr);
        const cur = getCompanyId();
        const found = arr.find((c) => String(c.id) === String(cur)) ?? arr[0];
        if (found) setSelectedId(String(found.id));
      })
      .catch((e) => { if (alive) setError(e?.message ?? String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const currentCo = companies.find((c) => String(c.id) === String(selectedId)) ?? companies[0] ?? null;

  const doExport = async () => {
    if (!currentCo || exporting) return;
    setExporting(true);
    setError(null);
    try {
      await adminApi.companies.export(currentCo.id, currentCo.code);
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setExporting(false);
    }
  };

  const doImport = async () => {
    if (!currentCo || !importFile || importing) return;
    const ok = await confirm(
      `Bạn có chắc muốn phục hồi dữ liệu từ tệp "${importFile.name}" vào công ty "${currentCo.code} - ${currentCo.name}"? Toàn bộ dữ liệu hiện tại của công ty sẽ được thay thế bằng bản sao lưu.`,
    );
    if (!ok) return;
    setImporting(true);
    setImportPct(0);
    setError(null);
    setResult(null);
    try {
      const res = await adminApi.companies.import(importFile, String(currentCo.id), setImportPct, restoreUsers);
      setResult(res);
      setImportPct(100);
      setImportFile(null);
      resetAllStores();
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setImporting(false);
    }
  };

  if (loading) return <Loading />;
  if (!currentCo) return <p className="muted">{t('admin.noCompanyAssigned')}</p>;

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ padding: 16, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>🏢 Công ty đang chọn để Sao lưu / Phục hồi</h3>
        {companies.length > 1 ? (
          <label style={{ display: 'block', marginBottom: 10 }}>
            <b>Chọn công ty: </b>
            <select value={String(currentCo.id)} onChange={(e) => { setSelectedId(e.target.value); setResult(null); setError(null); }}>
              {companies.map((c) => <option key={c.id} value={String(c.id)}>{c.code} - {c.name}</option>)}
            </select>
          </label>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: 6, fontSize: 14 }}>
          <span className="muted">{t('admin.companyCode')}:</span><b>{currentCo.code}</b>
          <span className="muted">{t('admin.companyName')}:</span><b>{currentCo.name}</b>
          {currentCo.taxCode && <><span className="muted">{t('admin.companyTaxCode')}:</span><span>{currentCo.taxCode}</span></>}
          {currentCo.address && <><span className="muted">{t('admin.companyAddress')}:</span><span>{currentCo.address}</span></>}
        </div>
        <div style={{ marginTop: 14 }}>
          <button type="button" className="btn" disabled={exporting} onClick={doExport}>
            ⬇ {exporting ? 'Đang xuất bản sao lưu…' : `Xuất bản sao lưu công ty (${currentCo.code}.csv.zip)`}
          </button>
        </div>
      </div>

      <div style={{ padding: 16, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>⬆ Phục hồi dữ liệu công ty từ bản sao lưu (.csv.zip / .zip)</h3>
        <p className="muted">{t('admin.importHint')}</p>
        <div className="admform" style={{ display: 'grid', gridTemplateColumns: '1fr', maxWidth: 'none' }}>
          <label>{t('admin.importFile')}
            <input type="file" accept=".zip,.csv.zip,.tar.zip,application/zip" disabled={importing}
              onChange={(e) => {
                setImportFile(e.target.files?.[0] ?? null);
                setError(null);
                setResult(null);
              }} />
          </label>
          <label className="admcheck">
            <input type="checkbox" checked={restoreUsers} disabled={importing}
              onChange={(e) => setRestoreUsers(e.target.checked)} />
            <span>Khôi phục kèm tài khoản Owner, danh sách nhân viên (Sub-user) & phân quyền từ bản sao lưu</span>
          </label>
          {importing && (
            <>
              <progress value={importPct} max={100} style={{ width: '100%' }} />
              <span className="muted">{t('admin.importProgress').replace('{p}', importPct)}</span>
            </>
          )}
          {error && <p className="formError" role="alert">{error}</p>}
          {result && (
            <p className="okmark" role="status">
              {t('admin.importDone')
                .replace('{tables}', result.tables)
                .replace('{rows}', result.rows)
                .replace('{version}', result.schemaVersion)}
              {result.usersRestored > 0 ? ` (+${result.usersRestored} tài khoản)` : ''}
            </p>
          )}
        </div>
        <div className="formActions" style={{ marginTop: 12 }}>
          <button type="button" className="btn" disabled={!importFile || importing} onClick={doImport}>
            ⬆ {importing ? t('admin.importing') : t('admin.importAction')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Body({ can }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const isSystemAdmin = user?.role === 'admin';
  const [tab, setTab] = useState('users');
  const [truncateCoId, setTruncateCoId] = useState(null);

  const openTruncateFor = (coId) => {
    setTruncateCoId(coId ?? '');
    setTab('truncate');
  };

  if (!isSystemAdmin) {
    return (
      <div className="pad">
        <h2>👥 Quản trị công ty ({user?.name || user?.username})</h2>
        <div className="admtabs">
          <button type="button" className={tab === 'users' ? 'on' : ''} onClick={() => setTab('users')}>
            👤 Người dùng & phân quyền
          </button>
          <button type="button" className={tab === 'backup' ? 'on' : ''} onClick={() => setTab('backup')}>
            💾 Sao lưu & Phục hồi công ty
          </button>
        </div>
        {tab === 'backup' ? (
          <OwnerCompanyBackup />
        ) : (
          <Users can={can} isSystemAdmin={false} currentUser={user} onOpenBackup={() => setTab('backup')} />
        )}
      </div>
    );
  }

  return (
    <div className="pad">
      <h2>{t('admin.title')}</h2>
      <div className="admtabs">
        <button type="button" className={tab === 'users' ? 'on' : ''} onClick={() => setTab('users')}>
          👤 {t('admin.usersTab')}
        </button>
        <button type="button" className={tab === 'roles' ? 'on' : ''} onClick={() => setTab('roles')}>
          🛡️ {t('admin.rolesTab')}
        </button>
        <button type="button" className={tab === 'companies' ? 'on' : ''} onClick={() => setTab('companies')}>
          🏢 {t('admin.companiesTab')}
        </button>
        <button type="button" className={tab === 'truncate' ? 'on' : ''} onClick={() => setTab('truncate')}>
          🧹 {t('admin.truncateTab')}
        </button>
      </div>
      {tab === 'users' ? (
        <Users can={can} isSystemAdmin={true} currentUser={user} />
      ) : tab === 'roles' ? (
        <Roles can={can} />
      ) : tab === 'companies' ? (
        <Companies can={can} onOpenTruncate={openTruncateFor} />
      ) : (
        <VoucherTruncate can={can} initialCompanyId={truncateCoId} />
      )}
    </div>
  );
}

function View(props) {
  if (!props.can('admin', 'read')) return <Denied />;
  return <Body can={props.can} />;
}

export default { id: 'admin', title: 'admin.title', icon: '🛡️', order: 99, adminOnly: true, messages,
  initialState: {}, View };

