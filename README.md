# chime-support

Customer support chat, KYC verification, and admin workspace for Chime Support.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`. Chat photos and files are stored in the Supabase `chat-attachments` bucket.
