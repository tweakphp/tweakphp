-- Vapor connections are per-project by design: their id IS the tab id. Rows
-- created after 007 (the renderer vapor store never set tab_id) missed the
-- ownership backfill: restore it so they show their owner project, appear in
-- the project's connection list, and cascade-delete with the project.

UPDATE connections
SET tab_id = CAST(id AS INTEGER)
WHERE type = 'vapor'
  AND tab_id IS NULL
  AND CAST(id AS INTEGER) IN (SELECT CAST(id AS INTEGER) FROM tabs);
