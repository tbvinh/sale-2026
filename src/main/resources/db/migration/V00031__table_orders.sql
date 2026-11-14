-- 31. TABLE ORDERS & ORDER ITEMS (ORDER TỪNG MÓN TẠI BÀN)
CREATE TABLE IF NOT EXISTS table_orders (
    id             BIGSERIAL PRIMARY KEY,
    table_id       VARCHAR(36) NOT NULL REFERENCES dining_tables(id) ON DELETE CASCADE,
    shift_id       VARCHAR(64),
    status         VARCHAR(20) NOT NULL DEFAULT 'active', -- active | completed | cancelled
    customer_name  VARCHAR(255) DEFAULT 'Khách vãng lai',
    customer_phone VARCHAR(50),
    guest_count    INT DEFAULT 1,
    note           VARCHAR(500),
    total_amount   NUMERIC(20,2) DEFAULT 0,
    created_by     VARCHAR(100),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at   TIMESTAMPTZ,
    inv_doc_id     BIGINT REFERENCES inv_doc(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_table_orders_table_status ON table_orders (table_id, status);
CREATE INDEX IF NOT EXISTS idx_table_orders_status ON table_orders (status);
CREATE INDEX IF NOT EXISTS idx_table_orders_created_at ON table_orders (created_at DESC);

CREATE TABLE IF NOT EXISTS table_order_items (
    id             BIGSERIAL PRIMARY KEY,
    order_id       BIGINT NOT NULL REFERENCES table_orders(id) ON DELETE CASCADE,
    product_id     VARCHAR(36) NOT NULL REFERENCES materials(id),
    product_code   VARCHAR(50),
    product_name   VARCHAR(255) NOT NULL,
    unit           VARCHAR(50),
    qty            NUMERIC(18,3) NOT NULL DEFAULT 1 CHECK (qty > 0),
    price          NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    amount         NUMERIC(20,2) GENERATED ALWAYS AS (qty * price) STORED,
    note           VARCHAR(255),
    status         VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | sent | served | cancelled
    round          INT NOT NULL DEFAULT 1,
    cancel_reason  VARCHAR(255),
    created_by     VARCHAR(100),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_table_order_items_order ON table_order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_table_order_items_status ON table_order_items (status);

