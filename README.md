Synapse: AI-Powered Personal Learning Companion
![alt text](https://img.shields.io/badge/build-passing-brightgreen)

![alt text](https://img.shields.io/badge/License-MIT-yellow.svg)

![alt text](https://img.shields.io/badge/python-3.9+-blue.svg)
An intelligent application designed to transform passive video content into a dynamic and effective learning experience. Synapse leverages the power of Large Language Models to help you master any subject by creating summaries, quizzes, and a personalized review schedule.
🌟 Key Features
🧠 AI-Powered Analysis: Automatically processes YouTube video transcripts to generate detailed summaries, identify key concepts, and extract actionable bullet points.
💡 Intelligent Quiz Generation: Creates custom, multiple-choice quizzes based on the video's core content to test and reinforce your understanding.
🚀 Spaced Repetition System (SRS): An integrated SRS schedules quiz questions for review at optimal intervals, scientifically proven to enhance long-term memory retention.
🤖 AI Tutor: Engage in a conversation with an AI tutor that can answer your specific questions about the video content, providing clarifications and deeper insights.
🗂️ Content Management: Organize your learning materials by course, manage your videos, and track your progress through a user-friendly interface.
🛠️ Technology Stack
This project is currently a fully-functional prototype built within the Google Colab environment, with a planned migration to a scalable web application.
Current (Google Colab Prototype)
Backend: Python
AI Integration: Google Gemini API
Database: SQLite for persistent storage
Frontend/UI: ipywidgets for a rich, interactive notebook experience
Environment: Google Colab / Jupyter
Planned (Web Application)
Backend: Python (Flask or FastAPI)
AI Integration: Google Gemini API
Database: PostgreSQL with SQLAlchemy (ORM)
Frontend: React or Vue.js
Asynchronous Tasks: Celery with Redis for handling AI processing in the background
Deployment: Docker, Heroku/AWS/Render
🚀 Getting Started
Follow these instructions to get a local copy up and running for development and testing purposes.
Prerequisites
Python 3.9+
Git
A Google Gemini API Key
Installation
Clone the repository:
code
Sh
git clone https://github.com/your-username/synapse-learning-companion.git
cd synapse-learning-companion
Create and activate a virtual environment:
On macOS/Linux:
code
Sh
python3 -m venv venv
source venv/bin/activate
On Windows:
code
Sh
python -m venv venv
.\venv\Scripts\activate
Install the required dependencies:
code
Sh
pip install -r requirements.txt
Set up your environment variables:
Create a file named .env in the root directory of the project.
Add your Gemini API key to this file. Do not commit this file to Git.
.env file:
code
Code
GEMINI_API_KEY="YOUR_API_KEY_HERE"
Running the Application
For the Google Colab Version:
Upload the .ipynb file to Google Colab.
Ensure you have your Gemini API key ready to be added when prompted or stored as a Colab Secret.
Run all the cells in the notebook. The interactive application will be displayed in the output cells.
For the Future Web Application:
(Instructions for running the Flask/FastAPI server will be added here.)
code
Sh
# Example for Flask
flask run
🗺️ Future Roadmap
This project is actively evolving. The next major step is to migrate from the Colab prototype to a full-featured, scalable web application.

Phase 1: Backend & Database Migration

Set up a Flask/FastAPI server with API endpoints.

Migrate the database schema to PostgreSQL using SQLAlchemy.

Implement robust user authentication.

Phase 2: AI Integration & Background Processing

Set up Celery and Redis to handle API calls asynchronously.

Refine AI prompts for higher accuracy and better performance.

Phase 3: Frontend Development

Design and build a modern user interface using React or Vue.js.

Create a responsive dashboard for managing courses and tracking stats.

Phase 4: Deployment & Scaling

Dockerize the application for consistent environments.

Deploy the application to a cloud provider.
🤝 Contributing
Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are greatly appreciated.
If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Fork the Project
Create your Feature Branch (git checkout -b feature/AmazingFeature)
Commit your Changes (git commit -m 'Add some AmazingFeature')
Push to the Branch (git push origin feature/AmazingFeature)
Open a Pull Request
📜 License
Distributed under the MIT License. See LICENSE for more information.
