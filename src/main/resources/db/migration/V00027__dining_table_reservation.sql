-- 27. DINING TABLE RESERVATIONS
ALTER TABLE dining_tables ADD COLUMN IF NOT EXISTS reserved_customer_name VARCHAR(150);
ALTER TABLE dining_tables ADD COLUMN IF NOT EXISTS reserved_customer_phone VARCHAR(50);
ALTER TABLE dining_tables ADD COLUMN IF NOT EXISTS reserved_time VARCHAR(50);

