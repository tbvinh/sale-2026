-- PostgreSQL: Bảng lưu cấu hình hệ thống / thiết lập bán hàng
CREATE TABLE IF NOT EXISTS system_settings (
    setting_key   VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    description   VARCHAR(255),
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by    VARCHAR(50)
);

INSERT INTO system_settings (setting_key, setting_value, description)
VALUES ('inv_delete_policy', 'prompt', 'Chính sách xóa phiếu kho khi có chứng từ thu/chi liên kết: prompt (hỏi), cascade (tự động xóa liên kết), block (chặn xóa)')
ON CONFLICT (setting_key) DO NOTHING;

