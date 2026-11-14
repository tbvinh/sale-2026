-- 26. DINING TABLES & MINI BAR F&B
CREATE TABLE IF NOT EXISTS dining_tables (
    id             VARCHAR(36) PRIMARY KEY,
    code           VARCHAR(50),
    name           VARCHAR(255) NOT NULL,
    area           VARCHAR(100) DEFAULT 'Khu vực chung',
    capacity       INT DEFAULT 4,
    status         VARCHAR(20) DEFAULT 'empty', -- empty | occupied | reserved
    active         BOOLEAN DEFAULT true,
    current_doc_id VARCHAR(50),
    note           VARCHAR(500),
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dining_tables_code_lower ON dining_tables (LOWER(code)) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dining_tables_name_lower ON dining_tables (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_dining_tables_area ON dining_tables (area);
CREATE INDEX IF NOT EXISTS idx_dining_tables_status ON dining_tables (status);

-- Đảm bảo có khách hàng mặc định 'Khách vãng lai'
INSERT INTO customers (id, code, name, phone, address)
VALUES ('khach-vang-lai', 'KH-VANGLAI', 'Khách vãng lai', '', 'Tại quán')
ON CONFLICT (id) DO NOTHING;

INSERT INTO partners (id, code, name, phone, address, kind)
VALUES ('khach-vang-lai', 'KH-VANGLAI', 'Khách vãng lai', '', 'Tại quán', 'customer')
ON CONFLICT (id) DO NOTHING;

-- Bổ sung quyền cho plugin minibar
INSERT INTO permissions (module, action, label)
VALUES 
    ('minibar', 'READ', 'Xem bàn & gọi món mini bar'),
    ('minibar', 'CREATE', 'Tạo order & mở bàn mini bar'),
    ('minibar', 'UPDATE', 'Chỉnh sửa món & bàn mini bar'),
    ('minibar', 'DELETE', 'Hủy món & xóa bàn mini bar')
ON CONFLICT (module, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.module = 'minibar'
WHERE LOWER(r.code) IN ('user', 'company_admin')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Dữ liệu mẫu danh mục bàn cho quán ăn, cà phê, quầy bar
INSERT INTO dining_tables (id, code, name, area, capacity, status, note) VALUES
('b-01', 'B01', 'Bàn 01', 'Tầng 1 (Trong nhà)', 4, 'empty', 'Gần cửa ra vào'),
('b-02', 'B02', 'Bàn 02', 'Tầng 1 (Trong nhà)', 4, 'empty', 'Bàn trung tâm'),
('b-03', 'B03', 'Bàn 03', 'Tầng 1 (Trong nhà)', 2, 'empty', 'Bàn đôi yên tĩnh'),
('b-04', 'B04', 'Bàn 04', 'Tầng 1 (Trong nhà)', 6, 'empty', 'Bàn gia đình'),
('b-05', 'SV01', 'Bàn Sân Vườn 1', 'Sân vườn (Ngoài trời)', 4, 'empty', 'Dưới tán cây'),
('b-06', 'SV02', 'Bàn Sân Vườn 2', 'Sân vườn (Ngoài trời)', 4, 'empty', 'Thoáng mát'),
('b-07', 'SV03', 'Bàn Sân Vườn 3', 'Sân vườn (Ngoài trời)', 8, 'empty', 'Bàn tiệc ngoài trời'),
('b-08', 'BAR01', 'Ghế Bar 01', 'Quầy Bar', 1, 'empty', 'Quầy pha chế mini bar'),
('b-09', 'BAR02', 'Ghế Bar 02', 'Quầy Bar', 1, 'empty', 'Quầy pha chế mini bar'),
('b-10', 'BAR03', 'Bàn Bar Tròn', 'Quầy Bar', 4, 'empty', 'Bàn cao quầy bar'),
('b-11', 'VIP01', 'Phòng VIP 1', 'Khu VIP Lầu 1', 10, 'empty', 'Phòng máy lạnh riêng biệt'),
('b-12', 'VIP02', 'Phòng VIP 2', 'Khu VIP Lầu 1', 12, 'empty', 'Phòng tiếp khách VIP')
ON CONFLICT (id) DO NOTHING;

