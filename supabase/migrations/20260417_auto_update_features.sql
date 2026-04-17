ALTER TABLE IF EXISTS pending_reports
ADD COLUMN IF NOT EXISTS report_count integer NOT NULL DEFAULT 1;

ALTER TABLE IF EXISTS pending_reports
ADD COLUMN IF NOT EXISTS reporter_fingerprint text;

ALTER TABLE IF EXISTS cases
ADD COLUMN IF NOT EXISTS reddit_mentions_json jsonb;
