ALTER TABLE papers ADD COLUMN display_name TEXT;

CREATE SEQUENCE paper_id_seq;
SELECT setval('paper_id_seq', COALESCE((
    SELECT MAX(substring(id FROM 3)::bigint) FROM papers WHERE id ~ '^P-[0-9]+$'
), 0) + 1, false);
