#!/usr/bin/env python3
"""Compare Windows speech pronunciations for Chinese polyphone candidates."""
from __future__ import annotations

import argparse
import csv
import os
import subprocess
import sys
import tempfile
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

import numpy as np

FRAME_SIZE = 512
FRAME_HOP = FRAME_SIZE // 2
FREQUENCY_BINS = 128
TIME_FRAMES = 400
SILENCE_THRESHOLD = 300
DECISION_MARGIN = 0.02
DEFAULT_VOICE = "Microsoft Hanhan Desktop"


@dataclass(frozen=True)
class Case:
    word: str
    alternatives: Tuple[str, ...]
    sentence: Optional[str]


def trim_silence(audio: np.ndarray, threshold: int = SILENCE_THRESHOLD) -> np.ndarray:
    """Crop samples before the first and after the last value above threshold."""
    samples = np.asarray(audio)
    active = np.flatnonzero(np.abs(samples) > threshold)
    if active.size == 0:
        return samples[:0].copy()
    return samples[active[0] : active[-1] + 1].copy()


def read_wav(path: os.PathLike[str] | str) -> Tuple[np.ndarray, int]:
    """Read uncompressed PCM WAV as mono float samples and its sample rate."""
    with wave.open(str(path), "rb") as source:
        if source.getcomptype() != "NONE":
            raise ValueError(f"不支援壓縮 WAV：{path}")
        channels = source.getnchannels()
        width = source.getsampwidth()
        sample_rate = source.getframerate()
        raw = source.readframes(source.getnframes())

    if width == 1:
        samples = np.frombuffer(raw, dtype=np.uint8).astype(np.float64) - 128.0
    elif width == 2:
        samples = np.frombuffer(raw, dtype="<i2").astype(np.float64)
    elif width == 3:
        packed = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3).astype(np.int32)
        samples = (packed[:, 0] | (packed[:, 1] << 8) | (packed[:, 2] << 16)).astype(np.int32)
        samples[(samples & 0x800000) != 0] -= 1 << 24
        samples = samples.astype(np.float64)
    elif width == 4:
        samples = np.frombuffer(raw, dtype="<i4").astype(np.float64)
    else:
        raise ValueError(f"不支援每個樣本 {width} bytes 的 WAV：{path}")

    if channels < 1 or samples.size % channels:
        raise ValueError(f"WAV 聲道資料無效：{path}")
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)
    return samples, sample_rate


def spectral_envelope(audio: np.ndarray) -> np.ndarray:
    """Create the time-normalized, log-magnitude spectral vector."""
    samples = trim_silence(np.asarray(audio, dtype=np.float64))
    if samples.size == 0:
        return np.zeros(TIME_FRAMES * FREQUENCY_BINS, dtype=np.float64)
    if samples.size < FRAME_SIZE:
        samples = np.pad(samples, (0, FRAME_SIZE - samples.size))

    starts = np.arange(0, samples.size - FRAME_SIZE + 1, FRAME_HOP)
    frames = np.stack([samples[start : start + FRAME_SIZE] for start in starts])
    spectrum = np.abs(np.fft.rfft(frames * np.hanning(FRAME_SIZE), axis=1))
    envelope = np.log1p(spectrum[:, :FREQUENCY_BINS])
    positions = np.linspace(0, envelope.shape[0] - 1, TIME_FRAMES)
    lower = np.floor(positions).astype(np.int64)
    upper = np.ceil(positions).astype(np.int64)
    weight = (positions - lower)[:, None]
    normalized = envelope[lower] * (1.0 - weight) + envelope[upper] * weight
    vector = normalized.reshape(-1)
    return vector - vector.mean()


def spectral_similarity(first: np.ndarray, second: np.ndarray) -> float:
    """Return cosine similarity of the two spectral envelopes."""
    left, right = spectral_envelope(first), spectral_envelope(second)
    denominator = float(np.linalg.norm(left) * np.linalg.norm(right))
    return 0.0 if denominator == 0.0 else float(np.dot(left, right) / denominator)


def wav_similarity(first_path: os.PathLike[str] | str, second_path: os.PathLike[str] | str) -> float:
    first, first_rate = read_wav(first_path)
    second, second_rate = read_wav(second_path)
    if first_rate != second_rate:
        raise ValueError(f"WAV 取樣率不同：{first_rate} Hz 與 {second_rate} Hz")
    return spectral_similarity(first, second)


def classify_scores(scores: Sequence[float], threshold: float = DECISION_MARGIN) -> Tuple[int, bool]:
    if len(scores) < 2:
        raise ValueError("至少需要兩個候選分數")
    ranked = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
    margin = float(scores[ranked[0]]) - float(scores[ranked[1]])
    return ranked[0], margin + 1e-12 >= threshold


def decide(
    word_scores: Sequence[float],
    sentence_scores: Optional[Sequence[float]] = None,
    sentence_available: bool = False,
) -> Tuple[int, str, Sequence[float], bool]:
    """Return winner, status, reported scores, and whether fallback is pending."""
    best, clear = classify_scores(word_scores)
    if clear:
        return best, "清楚", word_scores, False
    if not sentence_available:
        return best, "拿不準", word_scores, False
    if sentence_scores is None:
        return best, "拿不準", word_scores, True
    sentence_best, sentence_clear = classify_scores(sentence_scores)
    if sentence_clear:
        return sentence_best, "整句判定", sentence_scores, False
    return sentence_best, "拿不準", sentence_scores, False


def read_cases(path: os.PathLike[str] | str) -> List[Case]:
    cases: List[Case] = []
    with open(path, "r", encoding="utf-8-sig", newline="") as source:
        for line_number, row in enumerate(csv.reader(source, delimiter="\t"), start=1):
            if not row or (len(row) == 1 and not row[0]):
                continue
            if len(row) != 3:
                raise ValueError(f"cases 第 {line_number} 列必須有三欄：詞、替代寫法、整句")
            word, alternatives_text, sentence_text = row
            word = word.strip()
            alternatives = tuple(item.strip() for item in alternatives_text.split("|"))
            sentence = sentence_text.strip() or None
            if not word:
                raise ValueError(f"cases 第 {line_number} 列的詞不可空白")
            if len(alternatives) < 2 or any(not item for item in alternatives):
                raise ValueError(f"cases 第 {line_number} 列至少需要兩個不空白的替代寫法")
            if len(set(alternatives)) != len(alternatives) or word in alternatives:
                raise ValueError(f"cases 第 {line_number} 列的替代寫法不可重複或等於原詞")
            if sentence is not None and word not in sentence:
                raise ValueError(f"cases 第 {line_number} 列的整句必須包含原詞")
            if any("\n" in item or "\r" in item for item in (word, *alternatives, sentence_text)):
                raise ValueError(f"cases 第 {line_number} 列含有不支援的換行")
            cases.append(Case(word, alternatives, sentence))
    if not cases:
        raise ValueError("cases 檔沒有可處理的資料列")
    return cases


def ordered_unique(texts: Sequence[str]) -> List[str]:
    result = []
    seen = set()
    for text in texts:
        if text not in seen:
            seen.add(text)
            result.append(text)
    return result


def synthesize_texts(
    texts: Sequence[str], out_dir: os.PathLike[str] | str, voice: str = DEFAULT_VOICE
) -> List[Path]:
    """Call the Windows speech engine, kept separate for importable analysis code."""
    utterances = list(texts)
    if not utterances:
        return []
    script = Path(__file__).resolve().with_name("tts_wav.ps1")
    if not script.is_file():
        raise FileNotFoundError(f"找不到語音合成腳本：{script}")
    output_dir = Path(out_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    input_path: Optional[Path] = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", newline="\n", suffix=".txt", delete=False
        ) as temporary_input:
            input_path = Path(temporary_input.name)
            for text in utterances:
                if "\n" in text or "\r" in text:
                    raise ValueError("朗讀文字不可含有換行")
                temporary_input.write(text + "\n")

        command = [
            "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
            str(script), "-InputFile", str(input_path), "-OutDir", str(output_dir),
            "-Voice", voice,
        ]
        completed = subprocess.run(
            command, check=False, capture_output=True, text=True,
            encoding="utf-8", errors="replace",
        )
        if completed.returncode != 0:
            detail = "\n".join(
                part.strip() for part in (completed.stdout, completed.stderr)
                if part and part.strip()
            )
            message = f"語音合成失敗，exit code {completed.returncode}"
            raise RuntimeError(message + (f"：\n{detail}" if detail else ""))

        paths = [output_dir / f"w{i:04d}.wav" for i in range(len(utterances))]
        missing = [str(path) for path in paths if not path.is_file()]
        if missing:
            raise RuntimeError("語音合成未產生預期 WAV：" + ", ".join(missing))
        return paths
    finally:
        if input_path is not None:
            input_path.unlink(missing_ok=True)


def render_results(cases: Sequence[Case], voice: str, wav_dir: Optional[str]) -> str:
    word_texts = ordered_unique([text for case in cases for text in (case.word, *case.alternatives)])
    if wav_dir:
        base_dir = Path(wav_dir).expanduser().resolve()
        base_dir.mkdir(parents=True, exist_ok=True)
        temporary_context = None
    else:
        temporary_context = tempfile.TemporaryDirectory(prefix="tts-polyphone-")
        base_dir = Path(temporary_context.name)
    word_dir, sentence_dir = base_dir / "words", base_dir / "sentences"

    try:
        word_paths = synthesize_texts(word_texts, word_dir, voice)
        word_path_by_text = dict(zip(word_texts, word_paths))
        feature_cache: Dict[str, np.ndarray] = {}

        def feature(path: Path) -> np.ndarray:
            key = str(path)
            if key not in feature_cache:
                audio, _rate = read_wav(path)
                feature_cache[key] = spectral_envelope(audio)
            return feature_cache[key]

        def compare(first: Path, second: Path) -> float:
            left, right = feature(first), feature(second)
            denominator = float(np.linalg.norm(left) * np.linalg.norm(right))
            return 0.0 if denominator == 0.0 else float(np.dot(left, right) / denominator)

        word_scores = [
            [compare(word_path_by_text[case.word], word_path_by_text[alt]) for alt in case.alternatives]
            for case in cases
        ]
        needs_sentence = [
            decide(scores, sentence_available=case.sentence is not None)[3]
            for case, scores in zip(cases, word_scores)
        ]

        sentence_path_by_text: Dict[str, Path] = {}
        if any(needs_sentence):
            sentence_texts = []
            for case, needs in zip(cases, needs_sentence):
                if needs and case.sentence is not None:
                    sentence_texts.append(case.sentence)
                    sentence_texts.extend(case.sentence.replace(case.word, alt) for alt in case.alternatives)
            sentence_texts = ordered_unique(sentence_texts)
            paths = synthesize_texts(sentence_texts, sentence_dir, voice)
            sentence_path_by_text = dict(zip(sentence_texts, paths))

        rows = []
        for case, scores, needs in zip(cases, word_scores, needs_sentence):
            sentence_scores = None
            if needs and case.sentence is not None:
                original = sentence_path_by_text[case.sentence]
                sentence_scores = [
                    compare(original, sentence_path_by_text[case.sentence.replace(case.word, alt)])
                    for alt in case.alternatives
                ]
            best, status, reported_scores, _pending = decide(
                scores, sentence_scores, sentence_available=case.sentence is not None
            )
            rows.append("\t".join([
                case.word, case.alternatives[best],
                *(f"{score:.6f}" for score in reported_scores), status,
            ]))
        return "\n".join(rows) + "\n"
    finally:
        if temporary_context is not None:
            temporary_context.cleanup()


def main(argv: Optional[Sequence[str]] = None) -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="以 Windows 語音合成波形比對多音字候選讀音。")
    parser.add_argument("--cases", required=True, help="UTF-8 TSV 檔")
    parser.add_argument("--out", help="另存結果 TSV")
    parser.add_argument("--wav-dir", help="保留 WAV 的暫存資料夾")
    parser.add_argument("--voice", default=DEFAULT_VOICE, help="Windows 語音名稱")
    args = parser.parse_args(argv)
    try:
        output = render_results(read_cases(args.cases), args.voice, args.wav_dir)
    except (OSError, ValueError, RuntimeError, wave.Error) as error:
        parser.exit(1, f"錯誤：{error}\n")
    print(output, end="")
    if args.out:
        output_path = Path(args.out)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(output, encoding="utf-8", newline="\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
