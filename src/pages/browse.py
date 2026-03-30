"""
Browse Content page – view summaries, key concepts, notes, quizzes, and AI tutor for a video.
"""

import json
import re

import streamlit as st

from src.api_processor import ApiProcessor
from src.database import DatabaseManager


def _sanitize(text: str) -> str:
    return re.sub(r"^[A-Da-d][\)\.]\s*|^[1-4][\)\.]\s*", "", text).strip()


def render(db: DatabaseManager, api: ApiProcessor):
    st.header("📖 Browse Your Content")

    courses = db.get_all_courses()
    if not courses:
        st.info("No content yet. Add a video first in **Add New Video**!")
        return

    # --- Course / Video selectors ---
    course_options = {name: cid for cid, name in courses}
    col1, col2 = st.columns(2)
    with col1:
        selected_course = st.selectbox("📂 Select Course", options=list(course_options.keys()))
    course_id = course_options[selected_course]

    videos = db.get_videos_for_course(course_id)
    if not videos:
        st.info("No videos in this course.")
        return

    video_options = {title: vid for vid, title in videos}
    with col2:
        selected_video_title = st.selectbox("🎥 Select Video", options=list(video_options.keys()))
    video_id = video_options[selected_video_title]

    # --- Load data ---
    details = db.get_video_details(video_id)
    if not details:
        st.error("Could not load video details.")
        return

    title, summary, concepts_json, bullets_json, notes = details
    try:
        concepts = json.loads(concepts_json) if concepts_json else []
    except json.JSONDecodeError:
        concepts = []
    try:
        bullets = json.loads(bullets_json) if bullets_json else []
    except json.JSONDecodeError:
        bullets = []

    st.divider()

    # --- Tabs ---
    tab_summary, tab_concepts, tab_bullets, tab_notes, tab_quiz, tab_chat = st.tabs(
        ["📄 Summary", "🔑 Key Concepts", "📌 Key Points", "📝 My Notes", "❓ Quiz", "🤖 AI Tutor"]
    )

    # ---- Summary ----
    with tab_summary:
        if summary:
            st.markdown(summary)
        else:
            st.info("No summary available.")

    # ---- Key Concepts ----
    with tab_concepts:
        if concepts:
            for i, c in enumerate(concepts, 1):
                with st.expander(f"**{i}. {c.get('concept', '')}**", expanded=False):
                    st.markdown(c.get("definition", ""))
        else:
            st.info("No key concepts available.")

    # ---- Key Points ----
    with tab_bullets:
        if bullets:
            for i, b in enumerate(bullets, 1):
                st.markdown(f"**{i}.** {b}")
        else:
            st.info("No key points available.")

    # ---- Notes ----
    with tab_notes:
        st.markdown("Add your personal notes and insights below.")
        new_notes = st.text_area("Your Notes", value=notes or "", height=250, label_visibility="collapsed")
        if st.button("💾 Save Notes", type="primary"):
            db.update_user_notes(video_id, new_notes)
            st.success("✅ Notes saved!")

    # ---- Quiz ----
    with tab_quiz:
        _quiz_tab(db, api, video_id)

    # ---- AI Tutor ----
    with tab_chat:
        _ai_tutor_tab(db, api, video_id, title)


# ---------------------------------------------------------------------------
# Quiz generation sub-section
# ---------------------------------------------------------------------------

def _quiz_tab(db: DatabaseManager, api: ApiProcessor, video_id: int):
    questions = db.get_questions_by_video(video_id)
    if questions:
        st.success(f"🧠 **{len(questions)} quiz questions available** – take them in the Practice Quiz tab!")

        # Count by difficulty
        diff_counts: dict = {"easy": 0, "medium": 0, "hard": 0}
        for (qid, *_) in questions:
            row = db.execute_query(
                "SELECT difficulty FROM quiz_questions WHERE id = ?", (qid,), fetch="one"
            )
            if row:
                diff_counts[row[0]] = diff_counts.get(row[0], 0) + 1

        col1, col2, col3 = st.columns(3)
        col1.metric("🟢 Easy", diff_counts.get("easy", 0))
        col2.metric("🟡 Medium", diff_counts.get("medium", 0))
        col3.metric("🔴 Hard", diff_counts.get("hard", 0))
    else:
        st.info("No quiz questions yet. Generate some below!")

    st.divider()
    st.subheader("⚙️ Generate New Quiz Questions")
    num_q = st.slider("Number of questions", 3, 20, 5, key=f"num_q_{video_id}")
    diffs = st.multiselect(
        "Difficulty levels",
        options=["easy", "medium", "hard"],
        default=["easy", "medium", "hard"],
        key=f"diff_{video_id}",
    )

    if st.button("🎯 Generate Quiz", type="primary", key=f"gen_quiz_{video_id}"):
        if not diffs:
            st.error("Select at least one difficulty level.")
            return
        info = db.get_video_info_for_quiz(video_id)
        if not info or not info[1]:
            st.error("Transcript not found – cannot generate quiz.")
            return
        v_title, transcript = info
        with st.spinner("🤖 AI is creating your quiz…"):
            quiz_data, error = api.generate_quiz_questions_with_difficulty(
                transcript, v_title, num_q, diffs
            )
        if error:
            st.error(f"❌ {error}")
        else:
            new_questions = quiz_data.get("quiz_questions", [])
            db.add_quiz_questions(video_id, new_questions)
            st.success(f"✅ {len(new_questions)} questions generated and saved!")
            st.rerun()


# ---------------------------------------------------------------------------
# AI Tutor sub-section
# ---------------------------------------------------------------------------

def _ai_tutor_tab(db: DatabaseManager, api: ApiProcessor, video_id: int, title: str):
    st.markdown("Ask me anything about this video!")

    # Initialize chat history per video
    history_key = f"chat_history_{video_id}"
    if history_key not in st.session_state:
        st.session_state[history_key] = []

    # Display existing messages
    for msg in st.session_state[history_key]:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    # New question
    if question := st.chat_input("Ask about concepts, examples, or request clarifications…"):
        st.session_state[history_key].append({"role": "user", "content": question})
        with st.chat_message("user"):
            st.markdown(question)

        info = db.get_video_info_for_quiz(video_id)
        if not info or not info[1]:
            with st.chat_message("assistant"):
                st.error("Video transcript not available.")
            return

        v_title, transcript = info
        with st.chat_message("assistant"):
            with st.spinner("Thinking…"):
                answer, error = api.ask_video_question(question, transcript, v_title)
            if error:
                st.error(f"❌ {error}")
                st.session_state[history_key].append({"role": "assistant", "content": f"Error: {error}"})
            else:
                st.markdown(answer)
                st.session_state[history_key].append({"role": "assistant", "content": answer})
