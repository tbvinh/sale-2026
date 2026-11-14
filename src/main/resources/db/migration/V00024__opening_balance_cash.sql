-- V00024: Cho phep kind = 'cash' trong opening_balances (Ton quy dau ky)

ALTER TABLE opening_balances DROP CONSTRAINT IF EXISTS ck_opening_balances_kind;
ALTER TABLE opening_balances ADD CONSTRAINT ck_opening_balances_kind
    CHECK (kind IN ('debt', 'loan', 'bank', 'account', 'material', 'tool', 'advance', 'cash'));

-- Cap nhat du lieu mau ton quy dau ky neu co
UPDATE opening_balances
SET kind = 'cash',
    doc_date = COALESCE(doc_date, DATE '2026-01-01')
WHERE kind = 'account' AND (code = 'DK0004' OR name ILIKE '%tiền mặt%');

