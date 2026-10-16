import tempfile
import unittest
import wave
from pathlib import Path

import numpy as np
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from tts_polyphone import classify_scores, decide, read_wav, spectral_similarity, trim_silence


def write_sine_wav(path: Path, frequency: float, noise_seed: int = 0) -> None:
    sample_rate = 16000
    time = np.arange(sample_rate) / sample_rate
    samples = 7000.0 * np.sin(2.0 * np.pi * frequency * time)
    if noise_seed:
        samples += np.random.default_rng(noise_seed).normal(0.0, 60.0, size=samples.size)
    pcm = np.clip(samples, -32768, 32767).astype("<i2")
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(sample_rate)
        output.writeframes(pcm.tobytes())


class SpectralSimilarityTests(unittest.TestCase):
    def test_similarity_ranks_matching_frequency_above_different_frequency(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            clean_path = Path(directory) / "220.wav"
            noisy_path = Path(directory) / "220-noisy.wav"
            different_path = Path(directory) / "440.wav"
            write_sine_wav(clean_path, 220.0)
            write_sine_wav(noisy_path, 220.0, noise_seed=7)
            write_sine_wav(different_path, 440.0)
            clean, _ = read_wav(clean_path)
            noisy, _ = read_wav(noisy_path)
            different, _ = read_wav(different_path)
            matching = spectral_similarity(clean, noisy)
            nonmatching = spectral_similarity(clean, different)
            self.assertGreater(matching, nonmatching)

    def test_silence_trim_keeps_only_active_region(self) -> None:
        samples = np.array([0, 100, -100, 400, -500, 301, 0, 0])
        np.testing.assert_array_equal(trim_silence(samples), [400, -500, 301])
        self.assertEqual(trim_silence(np.zeros(10, dtype=np.int16)).size, 0)


class DecisionTests(unittest.TestCase):
    def test_margin_of_at_least_point_zero_two_is_clear(self) -> None:
        best, clear = classify_scores([0.90, 0.88])
        self.assertEqual(best, 0)
        self.assertTrue(clear)
        self.assertFalse(classify_scores([0.90, 0.881])[1])

    def test_sentence_fallback_resolves_close_word_scores(self) -> None:
        word_scores = [0.901, 0.900]
        initial = decide(word_scores, sentence_available=True)
        self.assertTrue(initial[3])
        result = decide(word_scores, [0.93, 0.88], sentence_available=True)
        self.assertEqual(result[0], 0)
        self.assertEqual(result[1], "整句判定")
        self.assertEqual(list(result[2]), [0.93, 0.88])

    def test_close_sentence_scores_remain_uncertain(self) -> None:
        result = decide([0.90, 0.899], [0.90, 0.89], sentence_available=True)
        self.assertEqual(result[1], "拿不準")

    def test_close_word_scores_without_sentence_remain_uncertain(self) -> None:
        result = decide([0.90, 0.899], sentence_available=False)
        self.assertEqual(result[1], "拿不準")


if __name__ == "__main__":
    unittest.main()
