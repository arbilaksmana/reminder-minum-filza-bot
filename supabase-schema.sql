-- Jalankan di Supabase SQL Editor

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tg_id TEXT UNIQUE NOT NULL,
  name TEXT DEFAULT 'User',
  timezone TEXT DEFAULT 'Asia/Jakarta',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tg_id TEXT NOT NULL,
  challenge_code TEXT NOT NULL,
  gesture TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  deadline_minutes INT DEFAULT 20,
  reminder_count INT DEFAULT 0,
  next_reminder_at TIMESTAMPTZ,
  photo_url TEXT,
  ai_validation JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ
);

-- Photo hashes for duplicate detection
CREATE TABLE IF NOT EXISTS photo_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sha256 TEXT UNIQUE NOT NULL,
  drive_file_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_tg_id_status ON events(tg_id, status);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_users_tg_id ON users(tg_id);

-- Enable Row Level Security (optional, for production)
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE photo_hashes ENABLE ROW LEVEL SECURITY;
