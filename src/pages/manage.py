"""
Manage Content page – delete courses and videos.
"""

import streamlit as st

from src.database import DatabaseManager


def render(db: DatabaseManager):
    st.header("🗂️ Manage Content")
    st.markdown("Delete courses or individual videos along with all their associated quiz questions.")

    tab_courses, tab_videos = st.tabs(["📚 Manage Courses", "🎥 Manage Videos"])

    # ------------------------------------------------------------------ #
    # TAB 1 – Courses
    # ------------------------------------------------------------------ #
    with tab_courses:
        courses = db.get_all_courses()
        if not courses:
            st.info("No courses found. Add some content first!")
        else:
            for course_id, course_name in courses:
                video_count, question_count = db.get_course_stats(course_id)
                with st.container(border=True):
                    col_info, col_btn = st.columns([4, 1])
                    with col_info:
                        st.markdown(f"**📚 {course_name}**")
                        st.caption(f"🎥 {video_count} video(s) · ❓ {question_count} question(s)")

                    with col_btn:
                        key = f"del_course_{course_id}"
                        if st.button("🗑️ Delete", key=key, type="secondary"):
                            st.session_state[f"confirm_course_{course_id}"] = True

                    if st.session_state.get(f"confirm_course_{course_id}"):
                        st.warning(
                            f"⚠️ This will permanently delete **{course_name}** "
                            f"and all its {video_count} video(s) and {question_count} question(s)."
                        )
                        c1, c2, _ = st.columns([1, 1, 3])
                        if c1.button("✅ Confirm", key=f"confirm_yes_course_{course_id}", type="primary"):
                            ok, msg = db.delete_course(course_id)
                            if ok:
                                st.success(msg)
                                del st.session_state[f"confirm_course_{course_id}"]
                                st.rerun()
                            else:
                                st.error(msg)
                        if c2.button("❌ Cancel", key=f"confirm_no_course_{course_id}"):
                            del st.session_state[f"confirm_course_{course_id}"]
                            st.rerun()

    # ------------------------------------------------------------------ #
    # TAB 2 – Videos
    # ------------------------------------------------------------------ #
    with tab_videos:
        courses = db.get_all_courses()
        if not courses:
            st.info("No courses found. Add some content first!")
            return

        course_options = {name: cid for cid, name in courses}
        selected_course_name = st.selectbox(
            "Select Course", options=list(course_options.keys()), key="manage_course_select"
        )
        course_id = course_options[selected_course_name]
        videos = db.get_videos_for_course(course_id)

        if not videos:
            st.info("No videos in this course.")
        else:
            for video_id, video_title in videos:
                question_count = db.get_video_stats(video_id)
                with st.container(border=True):
                    col_info, col_btn = st.columns([4, 1])
                    with col_info:
                        st.markdown(f"**🎥 {video_title}**")
                        st.caption(f"❓ {question_count} question(s)")
                    with col_btn:
                        if st.button("🗑️ Delete", key=f"del_video_{video_id}", type="secondary"):
                            st.session_state[f"confirm_video_{video_id}"] = True

                    if st.session_state.get(f"confirm_video_{video_id}"):
                        st.warning(
                            f"⚠️ This will permanently delete **{video_title}** "
                            f"and its {question_count} question(s)."
                        )
                        c1, c2, _ = st.columns([1, 1, 3])
                        if c1.button("✅ Confirm", key=f"confirm_yes_video_{video_id}", type="primary"):
                            ok, msg = db.delete_video(video_id)
                            if ok:
                                st.success(msg)
                                del st.session_state[f"confirm_video_{video_id}"]
                                st.rerun()
                            else:
                                st.error(msg)
                        if c2.button("❌ Cancel", key=f"confirm_no_video_{video_id}"):
                            del st.session_state[f"confirm_video_{video_id}"]
                            st.rerun()
