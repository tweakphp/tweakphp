-- The execution connection is decided per project (tabs.connection_id):
-- drop the legacy global active marker. Also drop the vestigial tabs.active
-- flag (the current tab lives in the renderer, not in the database).

ALTER TABLE connections DROP COLUMN is_active;
ALTER TABLE tabs DROP COLUMN active;
