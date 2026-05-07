#!/usr/bin/env python3
import json
import math
import os
import subprocess
import tempfile
import wave
from array import array

SONGS = [
    ("晴天", 92, "src/music/jay-chou-qing-tian.mp3"),
    ("稻香", 86, "src/music/jay-chou-dao-xiang.mp3"),
    ("江南", 78, "src/music/jj-lin-jiang-nan.mp3"),
    ("修炼爱情", 70, "src/music/jj-lin-xiu-lian-ai-qing.mp3"),
    ("光年之外", 88, "src/music/gem-guang-nian-zhi-wai.mp3"),
    ("泡沫", 82, "src/music/gem-pao-mo.mp3"),
    ("带我去找夜生活", 122, "src/music/accusefive-night-life.mp3"),
    ("披星戴月的想你", 94, "src/music/accusefive-missing-you.mp3"),
    ("Love Story", 120, "src/music/taylor-swift-love-story.mp3"),
    ("Shake It Off", 160, "src/music/taylor-swift-shake-it-off.mp3"),
]


def convert_to_wav(mp3_path, wav_path):
    subprocess.run(
        ["afconvert", "-f", "WAVE", "-d", "LEI16@22050", "-c", "1", mp3_path, wav_path],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def read_mono(path):
    with wave.open(path, "rb") as wav:
        rate = wav.getframerate()
        frames = wav.getnframes()
        data = array("h")
        data.frombytes(wav.readframes(frames))
        if os.sys.byteorder != "little":
            data.byteswap()
        return rate, data


def envelope(rate, data, hop=512):
    env = []
    for start in range(0, len(data) - hop, hop):
        chunk = data[start : start + hop]
        env.append(sum(abs(x) for x in chunk) / hop)
    if not env:
        return []
    smooth = []
    radius = 4
    for i in range(len(env)):
        a = max(0, i - radius)
        b = min(len(env), i + radius + 1)
        smooth.append(sum(env[a:b]) / (b - a))
    onset = [max(0.0, env[i] - smooth[i]) for i in range(len(env))]
    return onset


def estimate_offset(onset, rate, bpm, hop=512, search_seconds=12):
    beat = 60.0 / bpm
    step = hop / rate
    max_i = min(len(onset), int(search_seconds / step))
    if max_i <= 0:
        return 0.0, 0.0

    # Ignore very beginning encoder silence / fade-in noise.
    start_offset = int(0.15 / step)
    candidates = []
    for i in range(start_offset, max_i):
        if onset[i] <= 0:
            continue
        left = onset[max(0, i - 2) : i]
        right = onset[i + 1 : min(len(onset), i + 3)]
        if all(onset[i] >= v for v in left + right):
            candidates.append((onset[i], i * step))
    candidates.sort(reverse=True)
    candidates = candidates[:80]

    best_offset = 0.0
    best_score = -1.0
    for _, candidate_time in candidates:
        offset = candidate_time % beat
        score = 0.0
        count = 0
        t = offset
        while t < min(search_seconds, len(onset) * step):
            idx = int(t / step)
            window = onset[max(0, idx - 2) : min(len(onset), idx + 3)]
            score += max(window) if window else 0
            count += 1
            t += beat
        if count:
            score /= count
        if score > best_score:
            best_score = score
            best_offset = offset
    return round(best_offset, 3), round(best_score, 2)


def main():
    results = []
    with tempfile.TemporaryDirectory() as tmp:
        for title, bpm, path in SONGS:
            wav_path = os.path.join(tmp, f"{title}.wav")
            convert_to_wav(path, wav_path)
            rate, data = read_mono(wav_path)
            env = envelope(rate, data)
            offset, score = estimate_offset(env, rate, bpm)
            duration = len(data) / rate
            results.append({
                "title": title,
                "bpm": bpm,
                "firstBeatOffset": offset,
                "analysisScore": score,
                "duration": round(duration, 1),
            })
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
