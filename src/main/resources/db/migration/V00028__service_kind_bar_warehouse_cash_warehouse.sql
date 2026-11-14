-- V00028: Them loai 'service' cho danh muc hang hoa/vat tu, kho Bar / Nha hang mac dinh va kho cho phieu thu chi

-- 1. Them cot kind cho bang materials (mac dinh 'material' = vat tu, hang hoa; 'service' = dich vu theo chuan ke toan)
ALTER TABLE materials ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'material';
CREATE INDEX IF NOT EXISTS idx_materials_kind ON materials (kind);

-- 2. Kho mac dinh: Kho Bar / Nha hang cho plugin minibar
INSERT INTO warehouses (id, code, name, address)
SELECT 'wh-bar-nhahang-01', 'KHO-BAR', 'Kho Bar / Nhà hàng', 'Khu vực quầy Bar & Nhà hàng'
WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE LOWER(code) = 'kho-bar');

-- 3. Nhom vat tu mac dinh: Dich vu
INSERT INTO material_types (id, code, name)
SELECT 'mt-service-01', 'DV', 'Dịch vụ'
WHERE NOT EXISTS (SELECT 1 FROM material_types WHERE LOWER(code) = 'dv' OR LOWER(name) = 'dịch vụ');

-- 4. Them cot warehouse_id va warehouse_name cho cash_vouchers de tong hop thu chi theo kho
ALTER TABLE cash_vouchers
    ADD COLUMN IF NOT EXISTS warehouse_id VARCHAR(36) REFERENCES warehouses(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS warehouse_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_cash_vouchers_warehouse ON cash_vouchers (warehouse_id);

-- 5. Cap nhat du lieu kho cho cac phieu thu/chi da tao tu phieu xuat/nhap kho truoc day
UPDATE cash_vouchers v
SET warehouse_id = COALESCE(d.warehouse_out_id, d.warehouse_in_id),
    warehouse_name = COALESCE(d.warehouse_out_name, d.warehouse_in_name)
FROM inv_doc d
WHERE v.source_doc_id = d.id AND v.warehouse_id IS NULL;

