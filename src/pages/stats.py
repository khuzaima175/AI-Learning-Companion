"""
Statistics page – shows learning metrics and recent quiz session history.
"""

import streamlit as st

from src.database import DatabaseManager


def render(db: DatabaseManager):
    st.header("📈 Learning Statistics")
    st.markdown("Track your progress and review history to stay on top of your goals.")

    stats = db.get_quiz_stats()
    db_info = db.get_database_info()

    # --- Metric cards ---
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("📚 Total Questions", stats["total_questions"])
    col2.metric("⏰ Due for Review", stats["due_questions"])
    col3.metric("🎯 Overall Accuracy", f"{stats['accuracy']:.1f}%")
    col4.metric("🎥 Total Videos", db_info["videos"])

    st.divider()

    # --- Recent sessions ---
    st.subheader("📊 Recent Quiz Sessions")
    sessions = db.get_recent_sessions(10)
    if not sessions:
        st.info("No quiz sessions recorded yet. Take a quiz to start tracking your progress!")
        return

    rows = []
    for date, answered, correct in sessions:
        accuracy = (correct / answered * 100) if answered > 0 else 0.0
        rows.append(
            {
                "Date": str(date),
                "Answered": answered,
                "Correct": correct,
                "Accuracy": f"{accuracy:.1f}%",
            }
        )

    st.table(rows)

    st.divider()

    # --- Database info ---
    with st.expander("🗄️ Database Info"):
        st.write(f"**Path:** `{db_info['path']}`")
        st.write(f"**Size:** {db_info['size_kb']} KB")
        st.write(f"**Courses:** {db_info['courses']}")
        st.write(f"**Videos:** {db_info['videos']}")
        st.write(f"**Quiz Questions:** {db_info['questions']}")
