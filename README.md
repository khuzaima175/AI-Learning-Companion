# 🎓 AI Learning Companion 2.0

![Version](https://img.shields.io/badge/version-2.0.0-blueviolet)
![License](https://img.shields.io/badge/license-MIT-green)
![Python](https://img.shields.io/badge/python-3.10%2B-blue)

Transform any YouTube video into a structured learning experience. **AI Learning Companion** is a professional-grade personal tutor that uses advanced AI to analyze educational content, generate smart summaries, and handle your long-term retention via Spaced Repetition (SRS).

> [!IMPORTANT]
> This application has been upgraded to a high-performance **FastAPI** backend with a modern, glassmorphic "Neon Sunset" UI.

---

## 🔥 Key Features

### 📺 Intelligent Video Analysis
- **Auto-Transcription:** Uses `youtube-transcript-api` (v1.0+) to reliably extract video speech.
- **AI Processing:** Automatically generates detailed summaries, 10+ core concepts, and 12+ actionable bullet points.
- **Manual Entry:** Support for custom text content or manual transcript pasting.

### 🧠 Smart Model Fallback (Reliability First)
The app features an automated cascading fallback system for Gemini API calls. If the primary model hits a quota or rate limit, it automatically tries the next best option:
1. **`gemini-3.1-flash-lite-preview`** (Primary - Speed & Efficiency)
2. **`gemini-2.5-flash`** (Fallback 1 - Stable)
3. **`gemini-2.0-flash`** (Fallback 2 - Resilience)

### 🔁 Spaced Repetition System (SRS)
- **Daily Reviews:** A dedicated review tab based on the SM-2 algorithm concept.
- **Dynamic Quiz Generation:** AI generates custom multiple-choice questions from your saved videos.
- **Progress Tracking:** Interactive charts and stats to monitor your learning curve.

### 💬 Expert AI Tutor
- Chat directly with your content. Ask specific questions about the video transcript and get expert answers based on the context of what you're learning.

---

## 🛠️ Tech Stack

- **Backend:** [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **Frontend:** Vanilla JavaScript & CSS (Modern "Neon Sunset" Design System)
- **Database:** [SQLite](https://www.sqlite.org/) (Local storage)
- **AI Engine:** Google [Gemini GenAI](https://aistudio.google.com/)
- **Server:** [Uvicorn](https://www.uvicorn.org/)

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.10 or higher
- A Google Gemini API Key ([Get one here](https://aistudio.google.com/))

### 2. Installation
```powershell
# Clone the repository
git clone https://github.com/khuzaima175/AI-Learning-Companion.git
cd AI-Learning-Companion

# Install dependencies
pip install -r requirements.txt
```

### 3. Run the Application
```powershell
uvicorn app:app --reload
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser.

---

## 📂 Data & Privacy

All your data stays **local**. This app is designed for privacy-conscious learners:
- **Database:** Saved in `%APPDATA%\AILearningCompanion\learning.db`
- **Configuration:** API keys and settings are stored in `%APPDATA%\AILearningCompanion\config.json`
- **Network:** The only external requests made are to YouTube (for transcripts) and Google Gemini (for AI processing).

---

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---
*Created with ❤️ for lifelong learners.*
