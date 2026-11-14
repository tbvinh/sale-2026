-- 33. KITCHEN DISPLAY SYSTEM (KDS) PERMISSIONS
INSERT INTO permissions (module, action, label)
VALUES 
    ('kitchen', 'READ', 'Xem màn hình bếp / KDS'),
    ('kitchen', 'UPDATE', 'Chế biến & trả món bếp / KDS')
ON CONFLICT (module, action) DO NOTHING;

-- Cấp quyền mặc định cho các vai trò hiện hữu
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.module = 'kitchen'
WHERE LOWER(r.code) IN ('user', 'company_admin')
ON CONFLICT (role_id, permission_id) DO NOTHING;

