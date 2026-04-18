# Supported Sites

All sites use the adapter/overlay pattern: the adapter observes the site's native subtitles, hides them, and feeds text to the shared overlay. See [adding-new-site.md](adding-new-site.md) for how to add a new site.

## YouTube (`www.youtube.com`)
- **Adapter**: `src/adapters/youtube.js` — `createYouTubeAdapter()`
- **Observation**: MutationObserver on `.caption-window` container; extracts text from `.ytp-caption-segment` elements
- **Hiding**: CSS `visibility: hidden` on `.caption-window` (elements stay in DOM for observation)
- **Overlay anchor**: `.html5-video-container` or `video.parentElement`
- **Word-by-word**: YouTube auto-generated subtitles reveal words incrementally. Each new word triggers a MutationObserver callback, and the overlay mirrors the progressive text update.

## SVT Play (`www.svtplay.se`)
- **Adapter**: `src/adapters/svtplay.js` — `createSvtPlayAdapter()`
- **Two rendering paths**:
  1. **Firefox**: Browser renders `.vtt-cue-teletext` DOM elements natively -> MutationObserver, hidden via CSS
  2. **Chrome**: Browser renders via TextTrack `::cue` (no DOM) -> `observeTextTrack` helper, `track.mode = 'hidden'`
- **Overlay anchor**: `video.parentElement`
- Each `.vtt-cue-teletext` element contains one `<span>` per subtitle line. `joinSubtitleParts()` handles hyphenated words split across lines.

## svt.se (`www.svt.se`)
- **Adapter**: `src/adapters/svtse.js` — `createSvtSeAdapter()`
- **Four rendering paths** (checked in priority order):
  1. **Firefox TextTrack DOM** (`.vtt-cue-teletext`) — browser renders native DOM elements
  2. **Chrome TextTrack** — `observeTextTrack` helper, `track.mode = 'hidden'`
  3. **React DOM** (`[data-rt="subtitles-container"] div:has(> span)`) — some videos render subtitles as React DOM elements
  4. **Portrait/vertical clip** (`[class*="VideoPlayerSubtitles__text"]`) — some videos render via a `VideoPlayerSubtitles__root` overlay
- **Aside-panel duplicate**: For landscape videos, the player renders a `VideoPlayerSubtitles__container` React component in the page aside — hidden by the adapter for paths 1-3. The portrait path (4) does NOT hide it because the `VideoPlayerSubtitles__root` IS the primary renderer.
- **Overlay anchor**: `video.parentElement`
- `data-rt="subtitles-container"` is a stable `data-*` attribute. CSS class names use CSS Modules with unstable hash suffixes — always use `[class*="VideoPlayerSubtitles__"]` prefix selectors.
