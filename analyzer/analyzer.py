#!/usr/bin/env python3
"""
analyzer.py — Offline beat detection using Essentia.

Usage:
    python analyzer.py input.mp3 -o beats.json
    python analyzer.py input.mp3 --bpm-only

Output JSON format:
    {
        "bpm": 120.0,
        "beats": [0.5, 1.0, 1.5, ...],
        "confidence": 0.95,
        "duration": 180.0
    }
"""

import json
import argparse
import sys

try:
    import essentia.standard as es
except ImportError:
    print("Essentia not found. Install with: pip install essentia", file=sys.stderr)
    sys.exit(1)


def analyze(audio_path: str) -> dict:
    loader = es.MonoLoader(filename=audio_path)
    audio = loader()

    rhythm = es.RhythmExtractor2013(method="degara")
    bpm, beats, confidence, estimates, unused = rhythm(audio)

    result = {
        "bpm": round(float(bpm), 2),
        "beats": [round(float(t), 4) for t in beats],
        "confidence": round(float(confidence), 4),
        "duration": float(len(audio)) / loader.paramValue("sampleRate"),
    }
    return result


def main():
    parser = argparse.ArgumentParser(description="Extract beat times from audio using Essentia")
    parser.add_argument("input", help="Path to input audio file (mp3, wav, flac, etc.)")
    parser.add_argument("-o", "--output", help="Output JSON file path")
    parser.add_argument("--bpm-only", action="store_true", help="Only print BPM value")
    args = parser.parse_args()

    result = analyze(args.input)

    if args.bpm_only:
        print(result["bpm"])
        return

    output = json.dumps(result, ensure_ascii=False, indent=2)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"Beat data written to {args.output}")
    else:
        print(output)


if __name__ == "__main__":
    main()
