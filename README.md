# 🎓 AI Learning Companion 2.0

![Version](https://img.shields.io/badge/version-2.2.0-blueviolet)
![License](https://img.shields.io/badge/license-MIT-green)
![Python](https://img.shields.io/badge/python-3.10%2B-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688)
![Database](https://img.shields.io/badge/database-PostgreSQL_(Supabase)-emerald)
![Deployment](https://img.shields.io/badge/deployment-Vercel_Serverless-black)

Transform any YouTube video or custom lecture transcript into an interactive, high-retention learning experience. **AI Learning Companion** is a full-stack, cloud-native study system powered by Google Gemini AI, Supabase PostgreSQL, and an Anki-style Spaced Repetition System (SRS).

> [!IMPORTANT]
> **Version 2.2 Upgrade:** Includes Supabase JWT Bearer Auth for multi-user data isolation, advanced Stale-While-Revalidate (SWR) client caching, high-performance database batch querying (N+1 query resolution), automated Resend email reminders, and Vercel serverless cold-start mitigation.

---

## 🏗️ Technical Architecture & Tech Stack

- **Backend Framework:** [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+) with `uvicorn` and `Mangum` serverless handler.
- **Frontend Architecture:** Vanilla JavaScript (ES6+), Modern Pure CSS ("Neon Sunset" Design System with glassmorphic UI, responsive layouts, and CSS skeleton loaders).
- **Authentication & Security:** Supabase Auth (JWT Bearer Token verification) with per-user data isolation.
- **Cloud Database:** [Supabase](https://supabase.com/) (PostgreSQL cloud database with Atomic RPC functions).
- **AI Processing Engine:** Google [Gemini API](https://aistudio.google.com/) (`gemini-2.5-flash` / `gemini-2.0-flash` / `gemini-1.5-flash`) with automatic rate-limit fallback chaining.
- **Anti-Scrape Transcript Pipeline:** 3-Tier fallback system (`youtube-transcript-api` → `Supadata API` → `yt-dlp` mobile-spoofing) + Direct Manual Transcript input.
- **Email & Notifications:** [Resend API](https://resend.com) with 6-stage daily escalating Vercel Cron email reminders.
- **Hosting & Deployment:** Serverless edge deployment on **Vercel** (`api/index.py` & `api/notify.py`).

---

## 🔥 Core Features

### 📺 Intelligent Video Analysis & Anti-Scrape Pipeline
- **3-Layer Transcript Extraction:**
  1. Primary: Native `youtube-transcript-api`
  2. Secondary: Cloud proxy via `Supadata API`
  3. Tertiary: `yt-dlp` with mobile client spoofing to bypass Vercel server blocks.
- **Manual Transcript Mode:** Option to directly paste raw transcripts for off-platform video lectures, private webinars, audio transcripts, or personal study notes.
- **Automated Structuring:** Generates concise summaries, 10+ core concepts, and 12+ actionable takeaways per video.

### 🧠 Practice Quiz & Smart AI Questions
- **On-Demand Quiz Generation:** Inline question generator to expand quiz sets for any video or course.
- **Subject-Matter AI Enforcement:** Prompt-engineered AI generation focusing strictly on core academic concepts rather than meta-questions about the video.
- **Deduplication Engine:** Prevents duplicate question insertion at both the browser and database levels.

### 💬 Interactive Context-Aware Study Assistant
- **Video-Specific AI Tutor:** Ask questions directly about any video in your catalog. The assistant leverages the video's full transcript context to explain complex topics.
- **Persistent Personal Notes:** Dedicated browser notes editor per video saved directly to Supabase.

### 🔁 Anki-Style Spaced Repetition System (SRS)
- **SM-2 Retention Algorithm:** Questions are mathematically scheduled `[1, 3, 7, 14, 30, 90, 180]` days into the future based on user feedback (`Hard`, `Good`, `Easy`).
- **Atomic Session Updates:** Uses Supabase RPC calls (`increment_session`) for race-condition-safe score tracking without read-then-write concurrency bugs.

### 📩 6-Stage Escalating Email Nudges
- **Vercel Cron Integration:** Automated cron execution sending up to 6 email reminders per day (`Morning`, `Midday`, `Afternoon`, `Evening`, `Night`, `Final Call`).
- **Urgency Visual Engine:** Dynamic HTML emails that escalate in visual urgency as midnight approaches if pending SRS cards remain unreviewed.

---

## ⚡ High-Performance Optimizations

1. **Fixing the N+1 Database Bottleneck (`in_` Bulk Queries):**
   - Refactored `/api/courses` single-pass fetching using SQL `IN` bulk queries, reducing round-trips from `1 + 2N + V` queries down to **exactly 3 queries**.
2. **Dual-Layer Stale-While-Revalidate (SWR) Caching:**
   - Client-side data rendering directly from `localStorage` for 0ms instant load times, accompanied by background HTTP revalidation for fresh updates.
3. **Parallel Request Orchestration & Skeleton UI:**
   - Synchronized API loading via `Promise.all()` paired with custom glowing CSS skeleton shapes (`.skel`) to eliminate layout shift and reduce perceived latency.
4. **Waterfall Mitigation via `<link rel="modulepreload">`:**
   - High-priority resource hints mapping ES JavaScript modules in `index.html` to enable browser parallel script downloads before execution.
5. **Vercel Serverless Cold-Start Prevention:**
   - Visibility State listener (`visibilitychange`) triggering an invisible keep-alive ping (`/api/ping`) whenever the tab becomes active, pre-warming serverless Lambda containers before the user clicks.
6. **Multi-Threaded DB Counters:**
   - Backend concurrent querying using Python's `ThreadPoolExecutor` to assemble course, video, and question metrics simultaneously.

---

## 🔒 Authentication & Multi-User Security

- Routes are protected via FastAPI `verify_token` dependency checking Supabase Auth JWT tokens.
- Database records (courses, videos, quiz questions, quiz sessions) are strictly scoped by `user_id` to guarantee full multi-tenant data privacy.

---

## 🚀 Setup & Local Development

### 1. Prerequisites
- Python 3.10+
- Google Gemini API Key
- Supabase Project URL & Keys (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`)
- (Optional) Supadata API Key & Resend API Key

### 2. Installation
```powershell
# Clone the repository
git clone https://github.com/khuzaima175/AI-Learning-Companion.git
cd AI-Learning-Companion

# Install dependencies
pip install -r requirements.txt
```

### 3. Environment Setup (`.env`)
Create a `.env` file in the root directory:
```env
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_public_key
SUPADATA_API_KEY=your_supadata_key
RESEND_API_KEY=your_resend_api_key
CRON_SECRET=your_vercel_cron_secret
NOTIFY_EMAIL=user_email_for_reminders
NOTIFY_USER_ID=your_supabase_user_id
NOTIFY_FROM_EMAIL=your_resend_verified_sender_email
```

### 4. Database Setup
Run the SQL queries in `supabase_schema.sql` within your **Supabase Dashboard → SQL Editor**.

### 5. Running Locally
```powershell
uvicorn app:app --reload
```
Navigate to **`http://localhost:8000`** in your browser.

---

## 📂 Project Structure

```text
AI-Learning-Companion/
├── app.py                  # FastAPI route handlers & app entrypoint
├── requirements.txt        # Python dependencies
├── vercel.json             # Vercel serverless build & cron job configurations
├── supabase_schema.sql     # Supabase database table definitions & indexes
├── optimizations_report.md # Performance engineering guide
├── /api
│   ├── index.py            # Mangum serverless adapter for Vercel/AWS Lambda
│   └── notify.py           # Unified cron route for escalating email reminders
├── /src
│   ├── api_processor.py    # Gemini AI prompts, fallback chains & transcript handlers
│   ├── auth.py             # Supabase Auth JWT token verification dependency
│   ├── config.py           # API key persistence & environment settings
│   ├── database.py         # Supabase PostgreSQL client & SRS logic
│   └── email_service.py    # Resend HTML email builder & reminder dispatchers
└── /static                 # "Neon Sunset" pure JS/CSS frontend
    ├── index.html
    ├── /css
    └── /js
        ├── app.js          # Core routing, SWR cache & keep-alive ping engine
        └── /pages         # Component scripts (browse, dashboard, quiz, stats, etc.)
```

---

## 🤝 Roadmap & Future Enhancements

- [ ] **Progressive Web App (PWA):** Offline flashcard caching & local service worker support.
- [ ] **Advanced Retention Analytics:** Forgetting curve charts and difficulty heatmaps.
- [ ] **Vector Embeddings (RAG):** Semantic vector search across all video transcripts using pgvector in Supabase.

---
*Built with ❤️ for lifelong learners.*
