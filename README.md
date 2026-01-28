# Reminder Minum Bot 💧

Bot Telegram pengingat minum dengan validasi AI (Gemini).

## Tech Stack
- **Node.js** + Vercel Serverless
- **Supabase** (PostgreSQL)
- **Google Drive** (foto storage)
- **Gemini AI** (validasi foto)

## Setup

### 1. Supabase
Buka Supabase SQL Editor dan jalankan:

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tg_id TEXT UNIQUE NOT NULL,
  name TEXT DEFAULT 'User',
  timezone TEXT DEFAULT 'Asia/Jakarta',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Events table
CREATE TABLE events (
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
CREATE TABLE photo_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sha256 TEXT UNIQUE NOT NULL,
  drive_file_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster queries
CREATE INDEX idx_events_tg_id_status ON events(tg_id, status);
CREATE INDEX idx_events_status ON events(status);
```

### 2. Environment Variables

Copy `.env.example` ke `.env` dan isi:

```env
TELEGRAM_BOT_TOKEN=xxx
ADMIN_CHAT_ID=xxx
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=xxx
GOOGLE_CLIENT_EMAIL=xxx
GOOGLE_PRIVATE_KEY="-----BEGIN..."
GOOGLE_DRIVE_FOLDER_ID=xxx
GEMINI_API_KEY=xxx
```

### 3. Install & Deploy

```bash
npm install
npx vercel --prod
```

### 4. Set Webhook

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=<VERCEL_URL>/api/webhook
```

## Commands

- `/start` - Daftar user baru
- `/test` - Manual test reminder

## Cron Jobs

| Schedule | Endpoint | Description |
|----------|----------|-------------|
| 08:00, 14:00, 20:00 WIB | `/api/cron/schedule` | Kirim reminder |
| Every 5 min | `/api/cron/spam` | Follow-up & expire |
