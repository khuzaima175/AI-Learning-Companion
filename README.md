# 🎓 AI Learning Companion 2.0

![Version](https://img.shields.io/badge/version-2.1.0-blueviolet)
![License](https://img.shields.io/badge/license-MIT-green)
![Python](https://img.shields.io/badge/python-3.10%2B-blue)
![Database](https://img.shields.io/badge/database-PostgreSQL_(Supabase)-emerald)

Transform any YouTube video into a structured learning experience. **AI Learning Companion** is a professional-grade personal tutor that uses advanced AI to analyze educational content, generate smart summaries, and handle your long-term retention via an Anki-style Spaced Repetition System (SRS).

> [!IMPORTANT]
> This application has been upgraded to a high-performance **FastAPI** backend with a modern, glassmorphic "Neon Sunset" Vanilla JS UI. It is fully decoupled and cloud-ready for **Vercel** serverless hosting.

---

## 🏗️ Tech Stack

- **Backend:** [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **Frontend:** Vanilla JavaScript (ES6) & Pure CSS ("Neon Sunset" Design System)
- **Database:** [Supabase](https://supabase.com/) (PostgreSQL cloud persistence)
- **AI Engine:** Google [Gemini API](https://aistudio.google.com/) (`3.5-flash` / `2.5-flash` / `2.0-flash`)
- **Deployment:** Vercel (Serverless Functions via `api/index.py`)

---

## 🔥 Key Features

### 📺 Intelligent Video Analysis (Anti-Scrape Tech)
- Extracts YouTube transcripts using a **3-Layer Fallback System**:
  1. Native `youtube-transcript-api`
  2. Cloud-proxy via `Supadata API`
  3. Mobile-spoofing via `yt-dlp` to bypass Vercel server blocks.
- **Manual Transcript Input:** Supports pasting custom transcripts directly to analyze off-platform lectures, private videos, or custom notes.
- Automatically generates detailed summaries, 10+ core concepts, and 12+ actionable bullet points.

### 💬 Interactive AI Study Companion
- **Context-Aware AI Chat:** Ask specific questions about any video in your catalog. The AI acts as an expert tutor, utilizing the full video transcript to answer, explain, or elaborate on complex topics.
- **Persistent Personal Notes:** Capture thoughts, study reflections, and custom definitions directly within the browser dashboard in a dedicated notes tab, persisted securely to Supabase.

### 🧠 Smart Model Fallback (Reliability First)
Features an automated cascading fallback system for Gemini API calls. If the primary model hits a rate limit (HTTP 429), the code instantly catches the exception and routes to the next best option via a `for/continue/break` loop chain to ensure zero downtime.

### 🔁 Spaced Repetition System (SRS)
- **Mathematical Retention:** Implements the SM-2 algorithm concept. Questions are mathematically scheduled `[1, 3, 7, 14, 30, 90, 180]` days in advance based on your performance (`Hard`, `Good`, `Easy`). 
- **Dynamic Quizzes:** AI generates custom multiple-choice questions matching stringent grammatical and conceptual constraints. Corrected visual timer and accurate results summary.
- **Daily Review Cap:** Limits daily reviews to a configurable threshold (default 25 cards) to prevent study fatigue and keep sessions manageable.
- **Race-Condition Safe:** Uses **Atomic RPC calls** directly inside Supabase to securely track session scores without Python read-then-write concurrency bugs.

### 📩 Escalating Smart Email Reminders
- Integrated with **Resend** and **Vercel Cron Jobs** to send up to 6 automated daily email nudges (`Morning`, `Midday`, `Afternoon`, `Evening`, `Night`, `Final Call`).
- **Urgency Engine:** Emails escalate in tone and visual design (urgency colors) as midnight approaches if you have pending cards.
- **Serverless:** Requires no server—fully managed by Vercel serverless cron pointing to a single `api/notify.py` route.

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.10+
- Google Gemini API Key
- Supabase Project URL & Service Key
- (Optional) Supadata API Key for cloud deployments

### 2. Installation
```powershell
# Clone the repository
git clone https://github.com/khuzaima175/AI-Learning-Companion.git
cd AI-Learning-Companion

# Install dependencies
pip install -r requirements.txt
```

### 3. Environment Variables
Create a `.env` file in the root directory:
```env
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
SUPADATA_API_KEY=your_supadata_key_for_vercel_bypass 
RESEND_API_KEY=your_resend_api_key
CRON_SECRET=your_vercel_cron_secret
NOTIFY_EMAIL=email_to_send_reminders_to
NOTIFY_USER_ID=your_supabase_user_id
NOTIFY_FROM_EMAIL=your_verified_resend_domain_email
```
*(Note: The Gemini API key can be set in the `.env` or handled directly inside the app's UI settings).*

### 4. Run the Application locally
```powershell
uvicorn app:app --reload
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser.

---

## 📂 File Structure Overview

```text
/
├── app.py                  # FastAPI traffic cop & endpoint router
├── requirements.txt        
├── vercel.json             # Vercel deployment & cron job configs
├── /api
│   ├── index.py            # Mangum wrapper for Serverless AWS/Vercel functions 
│   └── notify.py           # Unified cron handler for daily email notifications
├── /src
│   ├── api_processor.py    # Complex transcript & AI fallback logic
│   ├── database.py         # Supabase PostgreSQL client & SRS logic
│   └── email_service.py    # Resend-powered rich HTML email templates
└── /static                 # The "Neon Sunset" design system
    ├── index.html
    ├── /css
    └── /js/pages           # Component-based pure JS (add_video, quiz, stats, etc.)
```

---

## 🤝 Contributing & Future Roadmap
Contributions are welcome. Our next major objectives include turning the frontend into a **Progressive Web App (PWA)** for native offline support and expanding analytics to provide deeper insights into learning retention curves.

---
*Created with ❤️ for lifelong learners.*
