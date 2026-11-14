-- Relax foreign key on table_order_items.product_id to allow custom items / mock data
ALTER TABLE table_order_items DROP CONSTRAINT IF EXISTS table_order_items_product_id_fkey;

