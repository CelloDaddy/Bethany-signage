# Bethany Signage

Digital signage management system for Bethany Baptist Church.

## URLs

- `/manage` — CMS for staff to upload and schedule content
- `/player?screen=lobby` — Full-screen player for Lobby Slides TV
- `/player?screen=reception` — Full-screen player for Reception Slides TV

## First-time setup

### 1. Create a Neon database

1. Go to [neon.tech](https://neon.tech) and create a free account
2. Create a new project called `bethany-signage`
3. Copy the **Connection string** (looks like `postgresql://user:pass@host/db`)

### 2. Create a Vercel Blob store

1. In your Vercel dashboard, go to **Storage** → **Create** → **Blob**
2. Name it `bethany-media`
3. Connect it to this project — Vercel will auto-add `BLOB_READ_WRITE_TOKEN`

### 3. Set environment variables in Vercel

In your Vercel project → Settings → Environment Variables, add:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Your Neon connection string |
| `ADMIN_PASSWORD` | A password for CMS access (e.g. `bethany2026`) |
| `NEXT_PUBLIC_ADMIN_PASSWORD` | Same password as above |

`BLOB_READ_WRITE_TOKEN` is added automatically when you connect the Blob store.

### 4. Initialize the database

After deploying, visit:
```
https://your-app.vercel.app/api/setup?pw=YOUR_ADMIN_PASSWORD
```

This creates all tables and seeds the default screens and verse pool.

### 5. Point your TVs

On each display computer, open a browser and navigate to the player URL full-screen:
- Lobby TV: `https://your-app.vercel.app/player?screen=lobby`
- Reception TV: `https://your-app.vercel.app/player?screen=reception`

Use your browser's full-screen mode (F11 or kiosk mode) to hide the browser chrome.

## Development

```bash
npm install
cp .env.local.example .env.local
# Fill in DATABASE_URL and ADMIN_PASSWORD
npm run dev
```
