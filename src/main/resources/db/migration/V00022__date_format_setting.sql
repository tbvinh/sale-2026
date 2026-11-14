-- Định dạng ngày hiển thị: dd/mm/yyyy hoặc mm/dd/yyyy
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES ('date_format', 'dd/mm/yyyy', 'Định dạng ngày hiển thị: dd/mm/yyyy hoặc mm/dd/yyyy')
ON CONFLICT (setting_key) DO NOTHING;

