"""Synthesizes the 34.5s ambient electronic bed for the launch video."""
import numpy as np, wave

SR = 44100
DUR = 34.5
N = int(SR * DUR)
t = np.arange(N) / SR
L = np.zeros(N); R = np.zeros(N)

BPM = 96
BEAT = 60 / BPM          # 0.625 s
BAR = 4 * BEAT           # 2.5 s

def hz(midi): return 440.0 * 2 ** ((midi - 69) / 12)

# A minor 9 flavored progression, one chord per bar, looping.
CHORDS = [
    [57, 60, 64, 67, 71],   # Am9  (A C E G B)
    [53, 57, 60, 64, 67],   # Fmaj9
    [48, 55, 60, 64, 67],   # Cmaj9-ish
    [55, 59, 62, 67, 69],   # Gadd9
]

def env(seg_t, a, r, total):
    e = np.minimum(seg_t / a, 1.0)
    tail = np.clip((total - seg_t) / r, 0, 1)
    return np.clip(np.minimum(e, tail), 0, 1)

# ---------- pads (whole track) ----------
bar_i = 0
pos = 0.0
while pos < DUR:
    chord = CHORDS[bar_i % 4]
    seg_len = min(BAR * 1.06, DUR - pos)  # slight overlap for smooth joins
    i0 = int(pos * SR); i1 = min(int((pos + seg_len) * SR), N)
    seg_t = np.arange(i1 - i0) / SR
    e = env(seg_t, 0.9, 1.2, seg_len)
    seg = np.zeros(i1 - i0)
    for m in chord:
        f = hz(m)
        for k, g in ((1, 1.0), (2, 0.28), (3, 0.10)):
            seg += g * np.sin(2 * np.pi * f * k * seg_t + (m * 1.7 + k))
    seg *= e / len(chord)
    det = np.sin(2 * np.pi * 0.4 * seg_t + bar_i) * 0.5 + 0.5   # slow stereo motion
    L[i0:i1] += seg * (0.55 + 0.2 * det) * 0.16
    R[i0:i1] += seg * (0.75 - 0.2 * det) * 0.16
    bar_i += 1
    pos += BAR

# ---------- bass (from 4.2s, scene 2 onward) ----------
pos = BAR * 2  # 5.0s-ish, near scene 2 start
while pos < 31.0:
    bar = int(pos / BAR)
    root = CHORDS[bar % 4][0] - 24
    for off in (0.0, 2.5 * BEAT):
        st = pos + off
        if st >= 31.0: break
        i0 = int(st * SR); dur = 0.5; i1 = min(i0 + int(dur * SR), N)
        seg_t = np.arange(i1 - i0) / SR
        f = hz(root)
        seg = np.sin(2 * np.pi * f * seg_t) * np.exp(-seg_t * 5.5)
        seg += 0.35 * np.sin(2 * np.pi * f * 2 * seg_t) * np.exp(-seg_t * 8)
        L[i0:i1] += seg * 0.22; R[i0:i1] += seg * 0.22
    pos += BAR

# ---------- kick (four on floor, 7.5s → 30s) ----------
pos = BAR * 3
while pos < 30.0:
    i0 = int(pos * SR); i1 = min(i0 + int(0.16 * SR), N)
    seg_t = np.arange(i1 - i0) / SR
    f = 95 * np.exp(-seg_t * 26) + 44
    seg = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-seg_t * 17)
    L[i0:i1] += seg * 0.5; R[i0:i1] += seg * 0.5
    pos += BEAT

# ---------- hats (offbeats, 10s → 29.5s) ----------
rng = np.random.default_rng(7)
pos = BAR * 4 + BEAT / 2
while pos < 29.5:
    i0 = int(pos * SR); i1 = min(i0 + int(0.06 * SR), N)
    seg_t = np.arange(i1 - i0) / SR
    noise = rng.standard_normal(i1 - i0)
    noise = np.diff(noise, prepend=0)          # crude high-pass
    seg = noise * np.exp(-seg_t * 55)
    L[i0:i1] += seg * 0.045; R[i0:i1] += seg * 0.055
    pos += BEAT

# ---------- arp (16ths, calendar + gantt scenes 14 → 30.5) ----------
pos = 14.0 - (14.0 % BEAT)
step = BEAT / 2
k = 0
while pos < 30.5:
    bar = int(pos / BAR)
    chord = CHORDS[bar % 4]
    m = chord[k % len(chord)] + 12
    i0 = int(pos * SR); i1 = min(i0 + int(0.22 * SR), N)
    seg_t = np.arange(i1 - i0) / SR
    f = hz(m)
    tri = 2 / np.pi * np.arcsin(np.sin(2 * np.pi * f * seg_t))
    seg = tri * np.exp(-seg_t * 11) * 0.075
    pan = 0.5 + 0.4 * np.sin(k * 0.9)
    L[i0:i1] += seg * (1 - pan); R[i0:i1] += seg * pan
    k += 1
    pos += step

# ---------- master ----------
mix = np.stack([L, R])
mix = np.tanh(mix * 1.4) * 0.85
fade_in = np.clip(t / 0.8, 0, 1)
fade_out = np.clip((DUR - t) / 2.2, 0, 1)
mix *= fade_in * fade_out
mix = (mix * 32767 * 0.92).astype(np.int16)

with wave.open("music.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(mix.T.astype("<i2").tobytes())
print("wrote music.wav")
