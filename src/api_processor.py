"""
ApiProcessor – handles YouTube transcript fetching and Gemini AI calls.
Ported from main.py; Colab dependencies removed. Uses config.get_client().
"""

import json
import re

from src import config


class ApiProcessor:
    def _get_client(self):
        return config.get_client()

    def _get_model_id(self):
        return config.get_model_id()

    # ------------------------------------------------------------------
    # Transcript helpers
    # ------------------------------------------------------------------

    def get_youtube_transcript(self, url: str):
        try:
            from youtube_transcript_api import YouTubeTranscriptApi

            m = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11}).*", url)
            if not m:
                return None, "Invalid YouTube URL format"
            video_id = m.group(1)
            try:
                if hasattr(YouTubeTranscriptApi, "get_transcript"):
                    transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
                elif hasattr(YouTubeTranscriptApi, "list_transcripts"):
                    transcripts = YouTubeTranscriptApi.list_transcripts(video_id)
                    transcript = transcripts.find_transcript(["en", "en-US", "en-GB"])
                    transcript_list = transcript.fetch()
                else:
                    api_instance = YouTubeTranscriptApi()
                    transcript_list = api_instance.get_transcript(video_id)
                text = " ".join(item["text"] for item in transcript_list)
                return text, video_id
            except Exception as e:
                return None, f"Transcript failed for {video_id}: {e}"
        except Exception as e:
            return None, f"General error: {e}"

    def get_manual_transcript(self, text: str, video_id: str):
        return text, video_id

    # ------------------------------------------------------------------
    # Gemini helpers
    # ------------------------------------------------------------------

    def _call_gemini_with_retry(self, prompt: str, max_retries: int = 3):
        client = self._get_client()
        if not client:
            return None, "No API key configured. Please add your Gemini API key in the sidebar."
        model_id = self._get_model_id()

        for attempt in range(max_retries):
            try:
                response = client.models.generate_content(
                    model=model_id,
                    contents=[{"parts": [{"text": prompt}]}],
                )
                if not response or not hasattr(response, "text"):
                    response = client.models.generate_content(model=model_id, contents=prompt)
                if response and hasattr(response, "text") and response.text:
                    return response.text, None
                if attempt < max_retries - 1:
                    continue
                return None, "Gemini returned an empty response"
            except Exception as e:
                if attempt < max_retries - 1:
                    continue
                return None, f"Gemini API error after {max_retries} attempts: {e}"
        return None, "Failed after retries"

    def _parse_json_response(self, response_text: str):
        if not response_text:
            return None, "Empty response"
        clean = response_text.replace("```json", "").replace("```", "").strip()

        try:
            return json.loads(clean), None
        except json.JSONDecodeError:
            pass

        for pattern in [r"\{.*\}", r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}"]:
            m = re.search(pattern, clean, re.DOTALL)
            if m:
                try:
                    return json.loads(m.group(0)), None
                except json.JSONDecodeError:
                    continue

        if clean.count("{") > clean.count("}"):
            fixed = clean + "}" * (clean.count("{") - clean.count("}"))
            try:
                return json.loads(fixed), None
            except json.JSONDecodeError:
                pass

        sm = re.search(r'"summary":\s*"([^"]*(?:\\.[^"]*)*)"', clean)
        if sm:
            return {"summary": sm.group(1), "key_concepts": [], "bullet_points": []}, \
                   "Partial data extracted"

        return None, f"Failed to parse JSON. Preview: {clean[:200]}"

    def _call_gemini_and_parse_json(self, prompt: str):
        max_len = 50_000
        if len(prompt) > max_len:
            trunc = prompt.rfind(".", 0, max_len)
            prompt = prompt[: trunc if trunc != -1 else max_len] + "\n\n[Content truncated]"

        text, err = self._call_gemini_with_retry(prompt)
        if err:
            return None, err
        return self._parse_json_response(text)

    # ------------------------------------------------------------------
    # Transcript processing
    # ------------------------------------------------------------------

    def _process_long_transcript(self, transcript: str, target_length: int = 80_000) -> str:
        if len(transcript) <= target_length:
            return transcript
        key = self._extract_key_sections(transcript, target_length)
        return key if key else self._smart_truncate(transcript, target_length)

    def _extract_key_sections(self, transcript: str, target_length: int):
        try:
            sentences = transcript.replace("\n", " ").split(". ")
            if len(sentences) < 10:
                return None

            kw = [
                "definition", "explain", "theory", "principle", "concept", "example", "because",
                "therefore", "however", "mechanism", "process", "function", "structure",
                "equation", "formula", "calculation", "data", "result", "experiment",
                "algorithm", "method", "technique", "system", "design", "implement",
                "important", "key", "main", "primary", "fundamental", "essential",
            ]

            scored = []
            for i, s in enumerate(sentences):
                s = s.strip()
                if len(s) < 20:
                    continue
                sl = s.lower()
                score = sum(1 for k in kw if k in sl)
                if any(p in sl for p in ("is defined as", "refers to", "means that", "is the")):
                    score += 3
                if any(p in sl for p in ("for example", "such as", "like", "including")):
                    score += 2
                scored.append((score, s, i))

            scored.sort(key=lambda x: x[0], reverse=True)
            selected, total = [], 0
            for score, s, idx in scored:
                sw = s + ". "
                if total + len(sw) <= target_length:
                    selected.append((sw, idx))
                    total += len(sw)
                if total >= target_length * 0.9:
                    break

            if not selected:
                return None
            selected.sort(key=lambda x: x[1])
            return "[Key sections]\n\n" + "".join(s for s, _ in selected)
        except Exception:
            return None

    def _smart_truncate(self, transcript: str, target_length: int) -> str:
        part = target_length // 3
        beginning = transcript[:part]
        mid_s = len(transcript) // 2 - part // 2
        middle = transcript[mid_s: mid_s + part]
        end = transcript[-part:]
        return f"[Sampled: beginning / middle / end]\n\nBEGINNING:\n{beginning}\n\nMIDDLE:\n{middle}\n\nEND:\n{end}"

    # ------------------------------------------------------------------
    # Public API methods
    # ------------------------------------------------------------------

    def generate_summary_and_concepts(self, transcript: str, title: str):
        processed = self._process_long_transcript(transcript, target_length=30_000)
        prompt = f"""Analyze the video transcript for "{title}" and extract the most important educational content.

Return a single, valid JSON object with these keys:
- "summary": A detailed summary (3-4 paragraphs).
- "key_concepts": An array of exactly 10 objects, each with "concept" and "definition".
- "bullet_points": An array of exactly 12 specific, actionable takeaways.

Important: Return ONLY valid JSON.

Transcript: {processed}"""
        return self._call_gemini_and_parse_json(prompt)

    def generate_quiz_questions_with_difficulty(
        self, transcript: str, title: str, num_questions: int = 5,
        allowed_difficulties: list = None
    ):
        if allowed_difficulties is None:
            allowed_difficulties = ["easy", "medium", "hard"]
        processed = self._process_long_transcript(transcript, target_length=25_000)
        diff_str = ", ".join(allowed_difficulties)

        prompt = f"""You are an educational expert creating a quiz for "{title}".

Generate questions EXCLUSIVELY about the CORE EDUCATIONAL CONTENT of this video.

Return a single, valid JSON object with key "quiz_questions" containing {num_questions} questions.
Each question must have: "question", "options" (4 choices), "answer", "difficulty".
ONLY use these difficulty levels: {diff_str}
No prefix labels on options (just the choice text).
Answer must exactly match one of the options.

Return ONLY valid JSON.

Video Content: {processed}"""
        return self._call_gemini_and_parse_json(prompt)

    def ask_video_question(self, question: str, transcript: str, title: str):
        truncated = transcript[:50_000]
        if len(transcript) > 50_000:
            truncated += "... [transcript truncated]"

        prompt = f"""You are an expert AI tutor for the video "{title}".

1. First try to answer using the transcript.
2. If the answer isn't in the transcript, acknowledge that and give a helpful general answer.
3. If completely off-topic, say so politely.

Video Title: "{title}"
Transcript: {truncated}

Student's Question: {question}

Your Answer:"""
        text, err = self._call_gemini_with_retry(prompt)
        if err:
            return None, err
        return text, None
