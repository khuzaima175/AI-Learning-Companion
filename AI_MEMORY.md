# 🤖 AI Context & Memory Log

*This file acts as a persistent memory bank for any AI assistant working on this project. By reading this file, the AI immediately understands the current state of the app, what was recently changed, and what the major next goals are.*

## 🏗️ Current Tech Stack
- **Backend**: Python / FastAPI
- **Database**: SQLite (Local `learning.db`) — managed in `src/database.py`
- **AI Engine**: Google Gemini API via `google.generativeai` — managed in `src/api_processor.py`
- **Frontend**: Vanilla JavaScript (ES6+), pure CSS, no frameworks. 
- **Design System**: "Neon Sunset" (Dark theme, glassmorphism, teal/amber accent gradients).

---

## 🔄 Latest Changes (April 2026)

### Feature: Practice Quiz Generator
- **What**: Added an inline "Generate More Questions" UI to the Practice Quiz page.
- **Files Touched**: `static/js/pages/quiz.js`, `app.py`, `src/database.py`, `src/api_processor.py`.
- **Fixes**: 
  - Stopped `add_quiz_questions` from wiping old questions (removed a destructive `DELETE` clause).
  - Implemented client-side and database-level duplicate prevention for questions.
  - Strengthened Gemini prompt to prevent questions *about* the video; enforced subject-matter focus.

### Feature: UI Enhancements
- Added question badges (e.g., `10 Qs`) to the Browse Content video list.
- Improved AI summary rendering in `browse.js` and `style.css` (split raw text into readable `<p>` blocks).

---

## 🎯 Next Immediate Objectives
1. **Cloud Migration**: Migrate architecture to **Supabase (PostgreSQL)** to replace local SQLite.
2. **Hosting**: Prepare FastAPI and static files for deployment on **Vercel**.
3. **User Retention**: Implement a notification/reminder system (PWA Push Notifications or Telegram Bot) to keep the user engaged in daily studying.
