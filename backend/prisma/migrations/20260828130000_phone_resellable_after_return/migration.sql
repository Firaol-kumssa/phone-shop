-- A returned phone re-enters stock and can be sold again, so a phone may
-- appear on multiple sale lines over its lifetime.
DROP INDEX "sale_items_phone_id_key";
CREATE INDEX "sale_items_phone_id_idx" ON "sale_items"("phone_id");
