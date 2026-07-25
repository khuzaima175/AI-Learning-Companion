"""
ApiProcessor – handles YouTube transcript fetching and Gemini AI calls.
Ported from main.py; Colab dependencies removed. Uses config.get_client().
"""

import json
import logging
import re

from src import config

logger = logging.getLogger(__name__)


class ApiProcessor:
    def _get_client(self):
        return config.get_client()

    # ------------------------------------------------------------------
    # Transcript helpers
    # ------------------------------------------------------------------

    # Matches the 11-char video ID out of watch?v=, youtu.be/, /shorts/, /live/, /embed/.
    # Anchored with a boundary so "youtube.com/c/SomeChannelName" can't be mistaken
    # for an ID.
    _VIDEO_ID_RE = re.compile(
        r"(?:youtube\.com/(?:watch\?v=|shorts/|live/|embed/)|youtu\.be/)"
        r"([0-9A-Za-z_-]{11})(?:[?&/].*)?$"
    )

    def get_youtube_transcript(self, url: str):
        """Fetch transcript using youtube-transcript-api v1.0+."""
        try:
            from youtube_transcript_api import YouTubeTranscriptApi
            from youtube_transcript_api._errors import (
                NoTranscriptFound,
                TranscriptsDisabled,
                VideoUnavailable,
            )

            m = self._VIDEO_ID_RE.search(url)
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

            except Exception as e:
                # Something unexpected (API shape change, network hiccup, etc.) —
                # log it loudly so a silent bug in the primary path doesn't hide
                # behind the fallbacks, then still try the fallbacks.
                logger.warning("Primary transcript fetch failed for %s: %s", video_id, e)

                text, err = self._get_transcript_supadata(video_id)
                if text:
                    return text, video_id

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

            api_key = os.environ.get("SUPADATA_API_KEY", "")
            if not api_key:
                return None, "SUPADATA_API_KEY not set in environment"

            url = f"https://api.supadata.ai/v1/youtube/transcript?videoId={video_id}&lang=en"

            # Auth is via x-api-key; the browser-style headers below are only to
            # avoid generic bot-blocking and aren't required by Supadata's docs.
            headers = {
                "x-api-key": api_key,
                "Accept": "application/json",
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
                    if response and getattr(response, "text", None):
                        return response.text, None
                    # Empty response — retry same model, don't burn a second
                    # call with a different payload shape; the shape above is
                    # already the documented one.
                    last_error = f"[{model_id}] returned empty response"
                    logger.info(last_error)
                    continue
                except Exception as e:
                    err_str = str(e).lower()
                    if any(kw in err_str for kw in ("429", "quota", "rate", "resource exhausted", "503", "unavailable")):
                        last_error = f"[{model_id}] quota/rate-limit: {e}"
                        logger.warning(last_error)
                        break  # try next model
                    last_error = f"[{model_id}] error: {e}"
                    logger.error(last_error)
                    if attempt < max_retries - 1:
                        continue
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

        logger.error("Failed to parse JSON response. Preview: %s", clean[:200])
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
        """
        Note: both generate_summary_and_concepts and
        generate_quiz_questions_with_difficulty call this with
        target_length=500_000, which is far above almost any lecture
        transcript, so in practice this rarely does anything. It only
        kicks in for genuinely huge transcripts (multi-hour lectures,
        stitched playlists, etc.).
        """
        if len(transcript) <= target_length:
            return transcript
        key = self._extract_key_sections(transcript, target_length)
        return key if key else self._smart_truncate(transcript, target_length)

    def _extract_key_sections(self, transcript: str, target_length: int):
        """
        Keyword-scored sentence selection. This is a heuristic, not real
        summarization — it will miss important content that doesn't happen
        to contain the keyword list, and can overweight sentences that
        coincidentally contain several. It's a fallback for the rare
        oversized-transcript case, not the primary path. If oversized
        transcripts become common, replace this with a proper map-reduce
        LLM summarization (chunk -> summarize each chunk -> summarize the
        summaries) instead of tuning the keyword list further.
        """
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
        prompt = f"""You are an educator creating study material for a lecture titled "{title}".

Base everything strictly on the transcript below. Do not add outside facts, and do not pad with generic statements that would be true of any lecture on this general subject.

Return a single valid JSON object with exactly these keys:

"summary": 4-6 paragraphs, in the order the lecture covers them. For each major idea: state what it is, then the reasoning or evidence the lecture gives for it. Call out anything the lecture treats as surprising, counterintuitive, or easy to get wrong. Write at the level of someone with a general background in the subject, not a beginner and not a specialist — clear, not dumbed down, no filler sentences.

"key_concepts": Exactly 16 objects, each with:
  - "concept": the term or idea, as named in the lecture
  - "definition": 1-3 sentences covering (a) what it is and (b) what makes it matter specifically in this lecture, not in the field generally. Skip anything the lecture only mentions in passing without explaining — pick the 16 concepts that carry the most weight in the argument, not the first 16 that appear.

"bullet_points": Exactly 20 bullet points, ranked roughly by importance. Rules:
  - Every bullet must trace to something specific the lecture actually said, showed, or argued — not a paraphrase of the topic in general.
  - Each bullet should contain a detail a viewer could plausibly have missed, misremembered, or misunderstood on a first watch. If any adult with general knowledge of the topic would already know it without watching, cut it.
  - Be concrete over abstract. Prefer numbers, named examples, specific claims, and stated reasons over vague summary language.
  - Cover a mix: precise definitions worth remembering, non-obvious insights or caveats, comparisons the lecture draws, cause-and-effect claims, and practical implications or applications mentioned.

Return ONLY the JSON object. No markdown fences, no commentary before or after.

Transcript:
{processed}"""
        return self._call_gemini_and_parse_json(prompt)

    def generate_quiz_questions_with_difficulty(
        self, transcript: str, title: str, num_questions: int = 5,
        allowed_difficulties: list = None
    ):
        if allowed_difficulties is None:
            allowed_difficulties = ["easy", "medium", "hard"]
        processed = self._process_long_transcript(transcript, target_length=500_000)
        diff_str = ", ".join(allowed_difficulties)

        prompt = f"""You are writing a comprehension quiz on "{title}" for someone who just finished watching the lecture once, attentively.

The goal is to confirm they followed along and picked up the lecture's actual content — not to trip them up, and not to require them to have memorized every detail perfectly. A well-prepared viewer should be able to get most of these right on a first pass.

Calibrate each difficulty tier like this:

- easy: A direct, clearly-stated fact, definition, or example from the lecture. Someone who paid attention gets this right without hesitation. Not guessable purely from generic knowledge of the topic (it should require having actually watched), but also not a trap — one correct fact stated plainly, three clearly wrong options.

- medium: Requires understanding a concept well enough to recognize it in a slightly different phrasing, or to tell it apart from one similar-sounding but wrong idea from the same lecture. This is normal "did you understand it, not just hear it" territory — not a stretch.

- hard: The most demanding tier, but still fair: connects two related points the lecture made, or asks about a nuance/exception the lecture explicitly called out (e.g. "X is true, except when..."). This should NOT require outside knowledge, multi-step inference the lecture never modeled, or spotting something the lecture only mentioned once in passing.

Distribute questions evenly across: {diff_str}.

Rules:
1. No references to "the video", "the lecture", or "the speaker" in the question text — ask about the content directly.
2. Each question targets a different concept; don't test the same point twice.
3. Wrong options should be plausible mistakes (things a half-attentive viewer might mix up), not absurd or obviously-wrong filler — but they must be unambiguously incorrect, not defensible alternate answers.
4. Exactly one option is correct, and it must be clearly supported by the transcript.
5. Avoid peripheral trivia (exact numbers mentioned once, minor asides) unless the lecture itself emphasized it as important.

Return a single valid JSON object with key "quiz_questions" containing exactly {num_questions} objects.
Each object must have:
- "question": string
- "options": array of exactly 4 strings (no "A)"/"B)" prefixes)
- "answer": string — must exactly match one of the options
- "difficulty": one of [{diff_str}]
- "explanation": 1-2 sentences on why the answer is correct

Return ONLY the JSON object. No markdown fences, no commentary before or after.

Lecture transcript:
{processed}"""
        return self._call_gemini_and_parse_json(prompt)

    def ask_video_question(self, question: str, transcript: str, title: str):
        truncated = transcript[:500_000]
        if len(transcript) > 500_000:
            truncated += "... [transcript truncated]"

        prompt = f"""You are an expert AI tutor for the video "{title}".

1. First try to answer using the transcript.
2. If the answer isn't in the transcript, say so explicitly, then give a helpful general answer.
3. If the question is unrelated to the video's subject, say so politely and briefly.

Video Title: "{title}"
Transcript: {truncated}

Student's Question: {question}

Your Answer:"""
        text, err = self._call_gemini_with_retry(prompt)
        if err:
            return None, err
        return text, None