-- Force-deleting a project used to orphan its history and state rows:
-- code_histories and tab_states have no foreign key to tabs, so they
-- survived every hard delete. Purge the leftovers from past deletes.
-- tabs.id is TEXT while the tab_id columns are INTEGER, hence the CAST.

DELETE FROM code_histories
WHERE tab_id NOT IN (SELECT CAST(id AS INTEGER) FROM tabs);

DELETE FROM tab_states
WHERE tab_id NOT IN (SELECT CAST(id AS INTEGER) FROM tabs);

DELETE FROM connections
WHERE tab_id IS NOT NULL
  AND tab_id NOT IN (SELECT CAST(id AS INTEGER) FROM tabs);
