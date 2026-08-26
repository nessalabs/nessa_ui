# Components launch video

Generates the Nessa UI agent-surfaces launch video with the "hyperframes"
technique: `frames.html` lays the whole 34.5-second timeline out as CSS
animations on one clock, `render.mjs` scrubs that clock frame by frame
through the page's `__seek(t)` hook, screenshots each frame with headless
Chromium, and stitches the stills into an MP4 with ffmpeg. Because every
frame is seeked rather than recorded live, the output is deterministic —
no dropped frames, no timing jitter.

Three full-screen app scenes showcase the agent-side components — the
chat composer, the event calendar, and the Gantt chart — framed by an
intro and outro. The page is plain HTML/CSS styled directly from the
Nessa UI dark-theme tokens in `packages/react/src/theme.css` (colors,
radius, motion easing, the thinking-gradient accents) and set in
Geist / Geist Mono.

`music.py` synthesizes the ambient electronic bed (96 BPM pads, bass,
kick, hats, and an arp that enters with the calendar scene) as a WAV
with NumPy — no samples, fully generated.

## Render

```bash
# 1. Fonts: copy the Geist variable woff2 files next to frames.html
mkdir -p tools/launch-video/fonts
cp node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2 \
   node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2 \
   tools/launch-video/fonts/

# 2. Render (needs playwright-core resolvable, Chromium, H.264 ffmpeg)
node tools/launch-video/render.mjs --out ./launch-video-out \
  --chromium /path/to/chromium --ffmpeg /path/to/ffmpeg

# 3. Music: synthesize the bed and mux it in (needs numpy + AAC ffmpeg)
python3 tools/launch-video/music.py     # writes music.wav
ffmpeg -i launch-video-out/nessa-ui-components-launch.mp4 -i music.wav \
  -c:v copy -c:a aac -b:a 192k -shortest \
  launch-video-out/nessa-ui-agent-surfaces-launch.mp4
```

Output: `launch-video-out/nessa-ui-agent-surfaces-launch.mp4`
(1920x1080, 30 fps, 34.5 s, AAC stereo).
