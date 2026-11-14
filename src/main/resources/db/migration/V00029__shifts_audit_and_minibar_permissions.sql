-- V00029: Bàn giao ca (shifts), Audit Trail (audit_logs) và bổ sung phân quyền cho Mini Bar

-- 1. Bổ sung module 'minibar' và 'shifts' vào bảng permissions
INSERT INTO permissions (module, action, label)
SELECT m.module, a.action, m.module || ':' || a.action
FROM (VALUES ('minibar'), ('shifts')) AS m(module)
CROSS JOIN (VALUES ('READ'), ('CREATE'), ('UPDATE'), ('DELETE'), ('IMPORT'), ('EXPORT')) AS a(action)
ON CONFLICT (module, action) DO NOTHING;

-- Cấp quyền mặc định cho vai trò user đối với minibar và shifts
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.module IN ('minibar', 'shifts') AND p.action IN ('READ', 'CREATE', 'UPDATE')
WHERE r.code = 'user'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 2. Bảng ca làm việc (shifts)
CREATE TABLE IF NOT EXISTS shifts (
    id              VARCHAR(36) PRIMARY KEY,
    code            VARCHAR(50) NOT NULL,
    name            VARCHAR(100) NOT NULL,
    warehouse_id    VARCHAR(36) REFERENCES warehouses(id) ON DELETE SET NULL,
    warehouse_name  VARCHAR(255),
    opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at       TIMESTAMPTZ,
    opened_by       VARCHAR(100) NOT NULL,
    closed_by       VARCHAR(100),
    handover_to     VARCHAR(100),
    opening_cash    BIGINT NOT NULL DEFAULT 0,
    total_sales     BIGINT NOT NULL DEFAULT 0,
    total_receipts  BIGINT NOT NULL DEFAULT 0,
    total_payments  BIGINT NOT NULL DEFAULT 0,
    expected_cash   BIGINT NOT NULL DEFAULT 0,
    actual_cash     BIGINT,
    difference      BIGINT DEFAULT 0,
    status          VARCHAR(20) NOT NULL DEFAULT 'open',
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_shifts_status CHECK (status IN ('open', 'closed'))
);

CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts (status);
CREATE INDEX IF NOT EXISTS idx_shifts_opened_at ON shifts (opened_at DESC);

-- 3. Bổ sung shift_id vào inv_doc và cash_vouchers
ALTER TABLE inv_doc ADD COLUMN IF NOT EXISTS shift_id VARCHAR(36) REFERENCES shifts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_inv_doc_shift ON inv_doc (shift_id);

ALTER TABLE cash_vouchers ADD COLUMN IF NOT EXISTS shift_id VARCHAR(36) REFERENCES shifts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cash_vouchers_shift ON cash_vouchers (shift_id);

-- 4. Bảng nhật ký hoạt động / kiểm toán (audit_logs)
CREATE TABLE IF NOT EXISTS audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    username    VARCHAR(100) NOT NULL,
    module      VARCHAR(50)  NOT NULL,
    action      VARCHAR(50)  NOT NULL,
    target_id   VARCHAR(100),
    description TEXT         NOT NULL,
    ip_address  VARCHAR(50),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_username   ON audit_logs (username);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module     ON audit_logs (module);

