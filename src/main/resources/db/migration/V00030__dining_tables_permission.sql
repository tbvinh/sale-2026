-- V00030: Phân quyền riêng cho Danh mục bàn (tables)
-- Không cho phép người dùng thông thường (role 'user') Thêm / Sửa / Xóa danh mục bàn.

-- 1. Bổ sung module 'tables' vào bảng permissions
INSERT INTO permissions (module, action, label)
SELECT 'tables', a.action, 'tables:' || a.action
FROM (VALUES ('READ'), ('CREATE'), ('UPDATE'), ('DELETE'), ('IMPORT'), ('EXPORT')) AS a(action)
ON CONFLICT (module, action) DO NOTHING;

-- 2. Cấp quyền mặc định cho vai trò user: CHỈ ĐƯỢC XEM (READ), KHÔNG cấp CREATE, UPDATE, DELETE
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.module = 'tables' AND p.action = 'READ'
WHERE r.code = 'user'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Đảm bảo loại bỏ quyền CREATE, UPDATE, DELETE trên tables của role user nếu có
DELETE FROM role_permissions
WHERE role_id IN (SELECT id FROM roles WHERE code = 'user')
  AND permission_id IN (
    SELECT id FROM permissions 
    WHERE module = 'tables' AND action IN ('CREATE', 'UPDATE', 'DELETE', 'IMPORT', 'EXPORT')
  );

