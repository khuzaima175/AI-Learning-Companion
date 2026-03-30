"""
Add New Video page – processes a YouTube URL through Gemini AI and saves results to the DB.
"""

import re
from datetime import datetime

import streamlit as st

from src.api_processor import ApiProcessor
from src.database import DatabaseManager


def render(db: DatabaseManager, api: ApiProcessor):
    st.header("📚 Add New Learning Content")
    st.markdown(
        "Process a YouTube video with AI to extract a summary, key concepts, and auto-generate quiz questions."
    )

    with st.form("add_video_form"):
        url = st.text_input(
            "YouTube URL *",
            placeholder="https://www.youtube.com/watch?v=...",
        )
        col1, col2 = st.columns(2)
        with col1:
            course = st.text_input(
                "Course Name *", placeholder="e.g. Machine Learning, Physics 101"
            )
        with col2:
            title = st.text_input(
                "Video Title *", placeholder="Descriptive title for this video"
            )
        manual_transcript = st.text_area(
            "Manual Transcript (optional)",
            placeholder="Paste transcript here if automatic extraction fails…",
            height=120,
        )
        submitted = st.form_submit_button("🚀 Process Video", type="primary", use_container_width=True)

    if submitted:
        if not url.strip() or not course.strip() or not title.strip():
            st.error("Please fill in YouTube URL, Course Name, and Video Title.")
            return

        log = st.container()
        progress = st.progress(0, text="Starting…")

        with log:
            # Step 1 – transcript
            progress.progress(10, text="⏳ Fetching transcript…")
            transcript, video_id = api.get_youtube_transcript(url.strip())

            if not transcript and manual_transcript.strip():
                st.warning("⚠️ Automatic transcript failed – using manual transcript.")
                m = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11}).*", url.strip())
                video_id = m.group(1) if m else f"manual_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                transcript = manual_transcript.strip()

            if not transcript:
                progress.empty()
                st.error(f"❌ Could not get transcript. Check the URL or paste one manually.\n\n`{video_id}`")
                return

            st.success(f"✅ Transcript obtained (video ID: `{video_id}`)")

            # Step 2 – Gemini analysis
            progress.progress(40, text="🤖 Analysing with Gemini AI…")
            analysis, error = api.generate_summary_and_concepts(transcript, title.strip())
            if analysis is None:
                progress.empty()
                st.error(f"❌ AI analysis failed: {error}")
                return
            if error:
                st.warning(f"⚠️ AI note: {error}")
            st.success("✅ AI analysis complete")


            # Step 3 – Save to DB
            progress.progress(80, text="💾 Saving to database…")
            course_id = db.get_or_create_course(course.strip())
            video_data = {
                "course_id": course_id,
                "title": title.strip(),
                "video_id": video_id,
                "summary": analysis.get("summary", ""),
                "key_concepts": analysis.get("key_concepts", []),
                "bullet_points": analysis.get("bullet_points", []),
                "transcript": transcript,
            }
            db.add_video_data(video_data)
            progress.progress(100, text="Done!")
            st.success("🎉 Video processed and saved successfully!")
            st.info("💡 Tip: Go to **Browse Content** to generate quiz questions for this video.")
            st.balloons()
