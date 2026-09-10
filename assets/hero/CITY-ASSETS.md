# City hero assets

Created 2026-09-10 for aubcompany.com.

The source is a generated architectural scene, not footage of a real office or an actual drone recording. Source image: FluxAPI flux-kontext-max, 1328 × 752. The film is a 2.5D forward camera move derived from estimated depth, regularized into facade bands to preserve vertical lines. The last two seconds dissolve into the next loop. No API keys or runtime generation calls are needed by the website.

- city-flight.mp4: 1920 × 1080, 30 fps, 10 seconds, H.264, silent, fast start. Upscaled from the generated source. Default desktop background.
- city-flight-mobile.mp4: 960 × 540, 30 fps, 10 seconds. Default small-screen background.
- city-flight.gif: 960 × 540, 12 fps, 10 seconds, infinite loop. Downloadable GIF; the website uses MP4 for color fidelity and download size.
- city-poster.webp and city-poster-mobile.webp: still first-frame fallbacks.
- city-hero.css and city-hero.js: hero composition and accessible playback. Reduced motion and data saving suppress automatic video downloads. Visitors can explicitly start or pause the clip. Playback pauses offscreen and in hidden tabs.

Depth estimation source: https://huggingface.co/onnx-community/depth-anything-v2-small (Apache-2.0). Estimation ran locally during asset preparation; no model is shipped to visitors.

## Original generation prompt

Cinematic architectural visualization, wide 16:9 frame. First-person drone perspective flying forward through a spacious canyon between tall contemporary glass office towers in a premium Seoul business district at blue hour. Camera 70 meters above the avenue, level horizon, strong one-point perspective with vanishing point at 64 percent frame width and 45 percent height. Architectural masses along both edges, close dark graphite glass facade on the left, exceptionally detailed elegant blue glass skyscrapers on the right, layered distant skyline gradually fading into cool atmospheric haze. Restrained brushed metal mullions, real glass reflections, subtle warm amber office lights, steel blue sky with a soft pale blue horizon glow. Sophisticated real-estate film aesthetic, photoreal 3D architectural render, realistic scale and physically based lighting, straight verticals and coherent geometry, crisp intricate facades, no neon, no cyberpunk, no floating shapes, no phone, no text, no logos, no interface, no watermarks, no people, no visible drone. Calm dark negative space across left third for website text overlay; luminous architecture concentrated on right. Extremely refined professional advertising agency brand film, cinematic contrast and understated color grading.
