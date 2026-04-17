ALTER TABLE pending_reports
  ADD COLUMN IF NOT EXISTS proof_urls jsonb,
  ADD COLUMN IF NOT EXISTS reporter_email text,
  ADD COLUMN IF NOT EXISTS verification_result jsonb,
  ADD COLUMN IF NOT EXISTS auto_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_signals jsonb,
  ADD COLUMN IF NOT EXISTS how_contacted text,
  ADD COLUMN IF NOT EXISTS role_offered text,
  ADD COLUMN IF NOT EXISTS recruiter_phone text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS cin text;
