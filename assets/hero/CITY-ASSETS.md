# City hero assets

Updated 2026-09-10 for aubcompany.com using the night-city reference supplied by the site owner.

The source is the supplied 1672 x 941 image, retained in city-source.png. Its dark foreground glass, blue facade lighting, warm windows, river view, and sunset skyline are preserved. No new image-generation request was made for this revision.

The film is a 2.5D forward camera move derived from estimated depth, regularized into facade bands to preserve vertical lines. The vanishing point is set toward the river, right of centre. The last two seconds dissolve into the next loop. This is an animation of the supplied image; it is not an actual drone recording. No API keys or runtime generation calls are needed by the website.

- city-flight.mp4: 1920 x 1080, 30 fps, 10 seconds, H.264, silent, fast start. Upscaled from the supplied source. Default desktop background.
- city-flight-mobile.mp4: 960 x 540, 30 fps, 10 seconds. Default small-screen background.
- city-flight.gif: 960 x 540, 12 fps, 10 seconds, infinite loop. Downloadable GIF; the website uses MP4 for color fidelity and download size.
- city-poster.webp and city-poster-mobile.webp: still first-frame fallbacks.
- city-hero.css and city-hero.js: hero composition and accessible playback. Reduced motion and data saving suppress automatic video downloads. Visitors can explicitly start or pause the clip. Playback pauses offscreen and in hidden tabs.

The revision query v=night-20260910 makes returning browsers request the matching styles, playback script, posters, and videos together.

Depth estimation source: https://huggingface.co/onnx-community/depth-anything-v2-small (Apache-2.0). Estimation ran locally during asset preparation; no model is shipped to visitors. Cached depth is keyed by the source image hash.
