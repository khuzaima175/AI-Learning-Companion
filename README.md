# 🎓 AI Learning Companion

A personal AI-powered learning tool that helps you master any subject through YouTube video analysis, spaced repetition quizzes, and an AI tutor — all running locally on your desktop.

## Features

- 📚 **Add YouTube Videos** — Automatically extracts transcripts and generates AI summaries, key concepts, and bullet points
- 📖 **Browse Content** — Review summaries, key concepts, notes, and chat with an AI tutor about any video
- 🧠 **Practice Quiz** — AI-generated multiple-choice quizzes from your content
- 🔁 **Daily Review** — Spaced Repetition System (SRS) to strengthen memory over time
- 📈 **Statistics** — Track your progress and quiz accuracy
- 🗂️ **Manage Content** — Delete courses and videos

## Tech Stack

- **UI:** Streamlit (local desktop)
- **AI:** Google Gemini 2.5 Flash
- **Database:** SQLite (stored locally in `%APPDATA%\AILearningCompanion\`)
- **Transcripts:** youtube-transcript-api

## Setup

### 1. Clone the repo
```bash
git clone https://github.com/khuzaima175/AI-Learning-Companion.git
cd AI-Learning-Companion
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the app
```bash
streamlit run app.py
```

### 4. Enter your Gemini API Key
On first launch, enter your [Gemini API key](https://aistudio.google.com/) in the sidebar. It will be saved locally.

## Data Storage

All data is stored **locally on your machine** — nothing is sent to external servers except Gemini API calls:
- Database: `%APPDATA%\AILearningCompanion\learning.db`
- Config/API key: `%APPDATA%\AILearningCompanion\config.json`
