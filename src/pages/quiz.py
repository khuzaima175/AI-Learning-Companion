"""
Practice Quiz page – answer quiz questions from selected scope.
Uses st.session_state for stateful question-by-question navigation.
"""

import json
import random
import re

import streamlit as st

from src.database import DatabaseManager


def _sanitize(text: str) -> str:
    return re.sub(r"^[A-Da-d][\)\.]\s*|^[1-4][\)\.]\s*", "", text).strip()


def render(db: DatabaseManager):
    st.header("🧠 Practice Quiz")

    # ------------------------------------------------------------------ #
    # If a quiz is not in progress, show configuration screen
    # ------------------------------------------------------------------ #
    if "quiz_active" not in st.session_state or not st.session_state.quiz_active:
        _quiz_setup(db)
    else:
        _quiz_run(db)


def _quiz_setup(db: DatabaseManager):
    st.markdown("Test your knowledge. Configure your quiz below and click **Start Quiz**.")

    courses = db.get_all_courses()
    if not courses:
        st.info("No content yet. Add a video first!")
        return

    col1, col2 = st.columns(2)
    with col1:
        quiz_type = st.selectbox(
            "Quiz Scope",
            options=["All Questions", "By Course", "By Video"],
            key="qz_type",
        )
    with col2:
        num_q = st.slider("Number of questions", 5, 50, 10, step=5, key="qz_num")

    course_id = video_id = None

    if quiz_type in ("By Course", "By Video"):
        course_map = {name: cid for cid, name in courses}
        sel_course = st.selectbox("Select Course", list(course_map.keys()), key="qz_course")
        course_id = course_map[sel_course]

    if quiz_type == "By Video" and course_id is not None:
        videos = db.get_videos_for_course(course_id)
        if videos:
            video_map = {title: vid for vid, title in videos}
            sel_video = st.selectbox("Select Video", list(video_map.keys()), key="qz_video")
            video_id = video_map[sel_video]

    if st.button("🚀 Start Quiz", type="primary", use_container_width=True):
        if quiz_type == "By Course" and course_id:
            questions = db.get_questions_by_course(course_id, num_q)
        elif quiz_type == "By Video" and video_id:
            questions = db.get_questions_by_video(video_id, num_q)
        else:
            questions = db.get_all_questions(num_q)

        if not questions:
            st.warning("No questions found for the selected criteria. Generate quizzes in Browse Content first!")
            return

        # Shuffle and prepare
        random.shuffle(questions)
        prepared = []
        for qid, question, options_json, answer in questions:
            opts_raw = json.loads(options_json)
            opts = [_sanitize(o) for o in opts_raw]
            random.shuffle(opts)
            prepared.append(
                {"id": qid, "question": question, "options": opts, "answer": _sanitize(answer)}
            )

        st.session_state.quiz_active = True
        st.session_state.quiz_questions = prepared
        st.session_state.quiz_index = 0
        st.session_state.quiz_score = 0
        st.session_state.quiz_answered = False
        st.session_state.quiz_session_id = db.create_quiz_session()
        st.rerun()


def _quiz_run(db: DatabaseManager):
    questions = st.session_state.quiz_questions
    idx = st.session_state.quiz_index
    total = len(questions)

    # ---- Finished ----
    if idx >= total:
        _quiz_results(db)
        return

    q = questions[idx]
    score = st.session_state.quiz_score

    # Progress bar
    st.progress((idx) / total, text=f"Question {idx + 1} of {total}  |  Score: {score}/{idx}")

    st.markdown(f"### {q['question']}")

    if not st.session_state.quiz_answered:
        for opt in q["options"]:
            if st.button(opt, key=f"opt_{idx}_{opt}", use_container_width=True):
                st.session_state.quiz_answered = True
                is_correct = opt == q["answer"]
                st.session_state.last_correct = is_correct
                st.session_state.last_answer = opt
                if is_correct:
                    st.session_state.quiz_score += 1
                db.update_quiz_session(st.session_state.quiz_session_id, is_correct)
                st.rerun()
    else:
        # Show result
        for opt in q["options"]:
            if opt == q["answer"]:
                st.success(f"✅ {opt}")
            elif opt == st.session_state.last_answer and not st.session_state.last_correct:
                st.error(f"❌ {opt}")
            else:
                st.button(opt, disabled=True, key=f"dis_{idx}_{opt}", use_container_width=True)

        if st.session_state.last_correct:
            st.success("**Correct!** Well done.")
        else:
            st.error(f"**Incorrect.** The correct answer was: **{q['answer']}**")

        if st.button("Next Question ➡️", type="primary", key=f"next_{idx}"):
            st.session_state.quiz_index += 1
            st.session_state.quiz_answered = False
            st.rerun()


def _quiz_results(db: DatabaseManager):
    score = st.session_state.quiz_score
    total = len(st.session_state.quiz_questions)
    pct = (score / total * 100) if total else 0

    if pct >= 90:
        msg, icon = "🏆 Outstanding performance!", "success"
    elif pct >= 70:
        msg, icon = "👍 Great job! Solid understanding.", "success"
    else:
        msg, icon = "📚 Keep studying – practice makes perfect!", "warning"

    st.markdown(f"## Quiz Complete!")
    col1, col2, col3 = st.columns(3)
    col1.metric("Score", f"{score}/{total}")
    col2.metric("Accuracy", f"{pct:.1f}%")
    col3.metric("Status", "✅ Done")

    if icon == "success":
        st.success(msg)
    else:
        st.warning(msg)

    if st.button("🔄 Take Another Quiz", type="primary"):
        for key in ("quiz_active", "quiz_questions", "quiz_index", "quiz_score",
                    "quiz_answered", "quiz_session_id"):
            st.session_state.pop(key, None)
        st.rerun()
