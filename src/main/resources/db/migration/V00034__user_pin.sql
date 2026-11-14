-- Migration thêm cột pin_code vào bảng users phục vụ khóa màn hình POS
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_code VARCHAR(100);

