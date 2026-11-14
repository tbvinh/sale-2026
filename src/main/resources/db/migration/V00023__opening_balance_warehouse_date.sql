-- V00023: Them warehouse_id va doc_date cho opening_balances (Ton kho dau ky)

ALTER TABLE opening_balances ADD COLUMN IF NOT EXISTS warehouse_id VARCHAR(36);
ALTER TABLE opening_balances ADD COLUMN IF NOT EXISTS doc_date DATE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_opening_balances_warehouse'
    ) THEN
        ALTER TABLE opening_balances
            ADD CONSTRAINT fk_opening_balances_warehouse
            FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_opening_balances_warehouse_id ON opening_balances (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_opening_balances_doc_date ON opening_balances (doc_date);

-- Cap nhat du lieu mau ton kho dau ky co san
UPDATE opening_balances
SET warehouse_id = (SELECT id FROM warehouses ORDER BY code ASC LIMIT 1),
    doc_date = COALESCE(doc_date, DATE '2026-01-01')
WHERE kind = 'material' AND warehouse_id IS NULL;

