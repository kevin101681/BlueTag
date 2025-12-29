-- BlueTag Database Schema
-- PostgreSQL database for storing construction punch list reports
-- 
-- This schema is auto-initialized by the Netlify Function on first run,
-- but documenting it here for reference and manual setup if needed.

-- Main Reports Table
-- Stores punch list reports with all data in JSONB format
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    last_modified BIGINT,
    data JSONB
);

-- Index for efficient user queries
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);

-- Index for sorting by modification date
CREATE INDEX IF NOT EXISTS idx_reports_last_modified ON reports(last_modified DESC);

-- Optional: Add Row Level Security (RLS) policies for enhanced security
-- Uncomment these lines after creating the table to enable RLS:

-- ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Users can view their own reports"
--   ON reports FOR SELECT
--   USING (user_id = current_setting('app.current_user_id'));

-- CREATE POLICY "Users can insert their own reports"
--   ON reports FOR INSERT
--   WITH CHECK (user_id = current_setting('app.current_user_id'));

-- CREATE POLICY "Users can update their own reports"
--   ON reports FOR UPDATE
--   USING (user_id = current_setting('app.current_user_id'));

-- CREATE POLICY "Users can delete their own reports"
--   ON reports FOR DELETE
--   USING (user_id = current_setting('app.current_user_id'));

-- Notes:
-- 1. user_id is populated from Netlify Identity (user.sub field)
-- 2. data JSONB contains the full Report object with project details, locations, and issues
-- 3. last_modified is a Unix timestamp in milliseconds for easy sorting
-- 4. The Netlify Function automatically creates this table if it doesn't exist
-- 5. RLS policies are optional but recommended for production deployments

-- Example data structure in the JSONB 'data' field:
-- {
--   "id": "uuid-string",
--   "lastModified": 1234567890,
--   "project": {
--     "fields": [...],
--     "signOffImage": "base64-string",
--     "reportPreviewImage": "base64-string"
--   },
--   "locations": [
--     {
--       "id": "uuid-string",
--       "name": "Location Name",
--       "issues": [
--         {
--           "id": "uuid-string",
--           "description": "Issue description",
--           "severity": "High",
--           "photos": [...],
--           "timestamp": 1234567890
--         }
--       ]
--     }
--   ]
-- }


