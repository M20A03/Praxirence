"""
Praxirence Audio Preprocessing Script
Resamples all audio to 16kHz mono, trims silence (basic energy-based VAD),
and normalizes volume for Whisper ASR fine-tuning.
"""

import os
import json
import wave
import struct
import math
import logging
import argparse
from typing import List, Tuple

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("praxirence.preprocess_audio")

RAW_METADATA = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "metadata.json")
PROCESSED_AUDIO_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "processed", "audio")
PROCESSED_METADATA = os.path.join(os.path.dirname(__file__), "..", "data", "processed", "metadata.json")


def read_wav(file_path: str) -> Tuple[List[float], int]:
    """Reads a WAV file and returns normalized floating point samples (-1.0 to 1.0) and sample rate"""
    with wave.open(file_path, "r") as wf:
        num_channels = wf.getnchannels()
        sample_width = wf.getsampwidth()
        framerate = wf.getframerate()
        num_frames = wf.getnframes()
        raw_bytes = wf.readframes(num_frames)

    # 16-bit PCM assumed
    if sample_width == 2:
        total_samples = num_frames * num_channels
        integers = struct.unpack(f"<{total_samples}h", raw_bytes)
        # Convert to mono if multi-channel
        if num_channels > 1:
            mono_samples = []
            for i in range(0, total_samples, num_channels):
                avg = sum(integers[i:i + num_channels]) / num_channels
                mono_samples.append(avg / 32768.0)
            return mono_samples, framerate
        else:
            return [s / 32768.0 for s in integers], framerate
    else:
        # Fallback raw conversion
        return [0.0] * num_frames, framerate


def write_wav(file_path: str, samples: List[float], sample_rate: int = 16000):
    """Writes floating point samples (-1.0 to 1.0) as 16-bit mono WAV"""
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with wave.open(file_path, "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        packed = bytearray()
        for s in samples:
            # Clamp between -1.0 and 1.0
            clamped = max(-1.0, min(1.0, s))
            int_val = int(clamped * 32767.0)
            packed.extend(struct.pack("<h", int_val))
        wf.writeframes(packed)


def resample_linear(samples: List[float], orig_sr: int, target_sr: int = 16000) -> List[float]:
    """Linear interpolation resampling to target sample rate"""
    if orig_sr == target_sr:
        return samples
    if len(samples) == 0:
        return []

    duration = len(samples) / float(orig_sr)
    target_len = int(duration * target_sr)
    resampled = []
    ratio = float(len(samples) - 1) / max(1, target_len - 1)

    for i in range(target_len):
        src_pos = i * ratio
        idx_low = int(math.floor(src_pos))
        idx_high = min(idx_low + 1, len(samples) - 1)
        weight = src_pos - idx_low
        val = (1.0 - weight) * samples[idx_low] + weight * samples[idx_high]
        resampled.append(val)

    return resampled


def trim_silence_vad(samples: List[float], threshold: float = 0.015, frame_size: int = 320) -> List[float]:
    """Basic energy-based Voice Activity Detection (VAD) silence trimming"""
    if len(samples) < frame_size * 2:
        return samples

    # Calculate frame energies
    start_idx = 0
    end_idx = len(samples)

    # Trim leading silence
    for i in range(0, len(samples) - frame_size, frame_size):
        frame = samples[i:i + frame_size]
        energy = sum(abs(x) for x in frame) / frame_size
        if energy > threshold:
            start_idx = max(0, i - frame_size)
            break

    # Trim trailing silence
    for i in range(len(samples) - frame_size, frame_size, -frame_size):
        frame = samples[i:i + frame_size]
        energy = sum(abs(x) for x in frame) / frame_size
        if energy > threshold:
            end_idx = min(len(samples), i + 2 * frame_size)
            break

    if start_idx < end_idx:
        return samples[start_idx:end_idx]
    return samples


def normalize_volume(samples: List[float], target_peak: float = 0.95) -> List[float]:
    """Peak amplitude normalization to avoid digital distortion"""
    if not samples:
        return samples
    max_amp = max(abs(s) for s in samples)
    if max_amp < 1e-6:
        return samples
    scale = target_peak / max_amp
    return [s * scale for s in samples]


def preprocess_single_audio(input_path: str, output_path: str, target_sr: int = 16000):
    samples, sr = read_wav(input_path)
    resampled = resample_linear(samples, sr, target_sr)
    trimmed = trim_silence_vad(resampled)
    normalized = normalize_volume(trimmed)
    write_wav(output_path, normalized, target_sr)


def main():
    parser = argparse.ArgumentParser(description="Preprocess audio files for Whisper ASR")
    parser.add_argument("--raw_metadata", type=str, default=RAW_METADATA)
    parser.add_argument("--output_dir", type=str, default=PROCESSED_AUDIO_DIR)
    parser.add_argument("--output_metadata", type=str, default=PROCESSED_METADATA)
    args = parser.parse_args()

    if not os.path.exists(args.raw_metadata):
        logger.error(f"Raw metadata not found at: {args.raw_metadata}. Run data_fetch.py first.")
        return

    with open(args.raw_metadata, "r") as f:
        items = json.load(f)

    os.makedirs(args.output_dir, exist_ok=True)
    processed_manifest = []

    for item in items:
        raw_audio = item["audio_path"]
        base_name = os.path.basename(raw_audio)
        out_audio = os.path.join(args.output_dir, base_name)

        if os.path.exists(raw_audio):
            preprocess_single_audio(raw_audio, out_audio, target_sr=16000)
            logger.info(f"Preprocessed audio: {base_name} -> 16kHz Mono VAD Normalized")

            processed_item = dict(item)
            processed_item["processed_audio_path"] = out_audio
            processed_item["sample_rate"] = 16000
            processed_manifest.append(processed_item)

    os.makedirs(os.path.dirname(args.output_metadata), exist_ok=True)
    with open(args.output_metadata, "w") as f:
        json.dump(processed_manifest, f, indent=2)

    logger.info(f"Audio preprocessing complete! Saved {len(processed_manifest)} processed files to {args.output_metadata}")


if __name__ == "__main__":
    main()
