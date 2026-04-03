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

    # ------------------------------------------------------------------
    # Transcript helpers
    # ------------------------------------------------------------------

    def get_youtube_transcript(self, url: str):
        """Fetch transcript using youtube-transcript-api v1.0+."""
        try:
            from youtube_transcript_api import YouTubeTranscriptApi
            from youtube_transcript_api._errors import (
                NoTranscriptFound,
                TranscriptsDisabled,
                VideoUnavailable,
            )

            m = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11}).*", url)
            if not m:
                return None, "Invalid YouTube URL format"
            video_id = m.group(1)

            try:
                # v1.0+ uses an instance-based API with .fetch()
                ytt_api = YouTubeTranscriptApi()
                fetched = ytt_api.fetch(video_id, languages=["en", "en-US", "en-GB"])
                # FetchedTranscript is iterable; each item has a .text attribute
                text = " ".join(
                    item.text if hasattr(item, "text") else item["text"]
                    for item in fetched
                )
                return text, video_id

            except (NoTranscriptFound, TranscriptsDisabled, VideoUnavailable) as e:
                return None, str(e)

            except Exception:
                # Fallback 1: Supadata API (cloud-friendly, works on Vercel)
                text, err = self._get_transcript_supadata(video_id)
                if text:
                    return text, video_id

                # Fallback 2: yt-dlp (last resort)
                text, err2 = self._get_transcript_ytdlp(video_id)
                if text:
                    return text, video_id

                return None, f"All transcript methods failed. Supadata: {err} | yt-dlp: {err2}"

        except ImportError:
            return None, "youtube-transcript-api is not installed."
        except Exception as e:
            return None, f"General error: {e}"

    def _get_transcript_supadata(self, video_id: str):
        """Fetch transcript via Supadata API - works on cloud IPs."""
        try:
            import os
            try:
                import requests as req_lib
                use_requests = True
            except ImportError:
                use_requests = False
            import urllib.request

            api_key = os.environ.get("SUPADATA_API_KEY", "sd_83eff41ba2f6336f8eaff268e2c80a5a")
            if not api_key:
                return None, "SUPADATA_API_KEY not set in environment"

            url = f"https://api.supadata.ai/v1/youtube/transcript?videoId={video_id}&lang=en"

            headers = {
                "x-api-key": api_key,
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Origin": "https://supadata.ai",
                "Referer": "https://supadata.ai/",
            }

            if use_requests:
                resp = req_lib.get(url, headers=headers, timeout=20)
                if resp.status_code != 200:
                    return None, f"Supadata HTTP {resp.status_code}: {resp.text[:300]}"
                data = resp.json()
            else:
                request = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(request, timeout=20) as r:
                    data = json.loads(r.read().decode("utf-8"))

            # Handle both response shapes Supadata may return
            chunks = data.get("content") or data.get("transcript") or data.get("segments") or []
            if not chunks:
                if isinstance(data.get("text"), str):
                    return data["text"], None
                return None, f"Supadata empty response. Keys: {list(data.keys())}"

            text = " ".join(
                item.get("text") or item.get("content") or ""
                for item in chunks
                if isinstance(item, dict)
            )
            return text.strip() or None, None

        except Exception as e:
            return None, f"Supadata error: {e}"

    def _get_transcript_ytdlp(self, video_id: str):
        """Fallback method using yt-dlp to bypass cloud IP blocks."""
        try:
            import yt_dlp
            import urllib.request
        except ImportError:
            return None, "yt-dlp is not installed"

        ydl_opts = {
            'skip_download': True,
            'quiet': True,
            'nocheckcertificate': True,
            'extractor_args': {
                'youtube': {
                    'player_client': ['ios', 'android']
                }
            }
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)

                subs = info.get('subtitles', {})
                auto = info.get('automatic_captions', {})

                # Prioritize manual english, then auto english
                target_subs = subs.get('en') or subs.get('en-US') or subs.get('en-GB')
                if not target_subs:
                    target_subs = auto.get('en') or auto.get('en-US') or auto.get('en-GB')

                if not target_subs:
                    return None, "No english subtitles or automatic captions found."

                json3_url = next((s['url'] for s in target_subs if s.get('ext') == 'json3'), None)
                if not json3_url:
                    return None, "No usable subtitle format found by yt-dlp."

                req = urllib.request.Request(json3_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = json.loads(resp.read().decode('utf-8'))
                    events = data.get('events', [])
                    text_lines = []
                    for ev in events:
                        segs = ev.get('segs', [])
                        line = "".join([s.get('utf8', '') for s in segs if 'utf8' in s])
                        if line.strip() and line.strip() != '\n':
                            text_lines.append(line.replace('\n', ' ').strip())

                    return " ".join(text_lines), None
        except Exception as e:
            return None, str(e)

    def get_manual_transcript(self, text: str, video_id: str):
        return text, video_id

    # ------------------------------------------------------------------
    # Gemini helpers
    # ------------------------------------------------------------------

    def _call_gemini_with_retry(self, prompt: str, max_retries: int = 2):
        """
        Try each model in the fallback chain.
        Falls back to the next model on quota / rate-limit errors (429, 503,
        ResourceExhausted, etc.). Hard errors surface immediately after retries.
        """
        client = self._get_client()
        if not client:
            return None, "No API key configured. Please add your Gemini API key in the sidebar."

        model_chain = config.get_model_chain()
        last_error = "Unknown error"

        for model_id in model_chain:
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
                    # Empty response — retry same model
                    last_error = f"[{model_id}] returned empty response"
                    continue
                except Exception as e:
                    err_str = str(e).lower()
                    # Quota / rate-limit → fall back to next model immediately
                    if any(kw in err_str for kw in ("429", "quota", "rate", "resource exhausted", "503", "unavailable")):
                        last_error = f"[{model_id}] quota/rate-limit: {e}"
                        break  # break retry loop → try next model
                    # Other error → retry same model
                    last_error = f"[{model_id}] error: {e}"
                    if attempt < max_retries - 1:
                        continue
                    # Exhausted retries for this model → try next
                    break

        return None, f"All models failed. Last error: {last_error}"

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
        processed = self._process_long_transcript(transcript, target_length=500_000)
        prompt = f"""You are an expert educator and curriculum designer analyzing a lecture on "{title}".

Your goal is to extract content that will help a student deeply understand and retain this material.

Return a single valid JSON object with these exact keys:

"summary": A detailed summary in 4-6 paragraphs. Each paragraph should cover a distinct theme or section of the content. Write it as if explaining to an intelligent student who has never seen this material. Use clear cause-and-effect language.

"key_concepts": An array of exactly 16 objects, each with:
  - "concept": the term or idea (concise)
  - "definition": a clear, precise explanation in 2-3 sentences. Include WHY it matters or HOW it connects to other concepts. Avoid vague definitions.

"bullet_points": An array of exactly 20 takeaways. Each must:
  - Start with an action verb (Understand, Apply, Recognize, Distinguish, Calculate, etc.)
  - State a specific insight, not a vague generality
  - Be something a student could actually USE in an exam or real situation
  - BAD example: "Machine learning is important"
  - GOOD example: "Distinguish supervised from unsupervised learning by asking: does the training data have labeled outputs?"

Important: Return ONLY valid JSON. No markdown, no explanation outside the JSON.

Transcript: {processed}"""
        return self._call_gemini_and_parse_json(prompt)

    def generate_quiz_questions_with_difficulty(
        self, transcript: str, title: str, num_questions: int = 5,
        allowed_difficulties: list = None
    ):
        if allowed_difficulties is None:
            allowed_difficulties = ["easy", "medium", "hard"]
        processed = self._process_long_transcript(transcript, target_length=500_000)
        diff_str = ", ".join(allowed_difficulties)

        prompt = f"""You are an expert educator and exam writer specializing in "{title}".

Your mission: create quiz questions that don't just test memory — they build genuine understanding and expose common misconceptions.

QUESTION DESIGN RULES:
1. Test CONCEPTS, REASONING, and APPLICATION — not trivia or surface recall.
2. NEVER reference the video/lecture (no "According to the video...", "The speaker said...").
3. Each question must target a DIFFERENT concept — no overlap between questions.
4. Use a MIX of question styles:
   - Conceptual: "What is the key difference between X and Y?"
   - Application: "A system does Z. Which approach best explains this?"
   - Cause & Effect: "Why does X happen when Y occurs?"
   - Misconception trap: Design one wrong answer that a student who half-understands would pick.
   - Scenario-based: Give a real-world mini-scenario, ask what applies.
5. WRONG OPTIONS must be:
   - Plausible to someone who half-understands the topic
   - Based on real common misconceptions, NOT random nonsense
   - Similar in length and grammatical form to the correct answer
6. The CORRECT answer must be unambiguously right — not just "most correct".
7. Difficulty guidelines:
   - easy: Tests direct definitions or single facts a student should know cold.
   - medium: Requires connecting two concepts or applying a rule to a situation.
   - hard: Requires multi-step reasoning, distinguishing between closely related ideas, or handling an edge case.
8. Distribute difficulties evenly across: {diff_str}.

Return a single valid JSON object with key "quiz_questions" containing EXACTLY {num_questions} objects.
Each object MUST have:
- "question": string — clear, specific, no video references
- "options": array of exactly 4 strings — no A/B/C/D prefixes, similar length
- "answer": string — must EXACTLY match one option
- "difficulty": one of [{diff_str}]
- "explanation": string — 1-2 sentences explaining WHY the answer is correct and why the main distractor is wrong. This helps the student learn from mistakes.

Return ONLY valid JSON. No markdown, no text outside the JSON object.

Educational Content:
{processed}"""
        return self._call_gemini_and_parse_json(prompt)

    def ask_video_question(self, question: str, transcript: str, title: str):
        truncated = transcript[:500_000]
        if len(transcript) > 500_000:
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