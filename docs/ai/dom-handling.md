# DOM Handling — Adapter/Overlay Architecture

## Capture-and-Replace Pattern

All sites use the same pattern: a per-site **adapter** observes the site's native subtitle elements, extracts their text, hides the originals, and feeds the text to a shared **overlay** that renders it in our own DOM. All feature code (click handling, highlighting, tooltips, translation) operates exclusively on the overlay's `.subtranslate-cue` elements.

This architectural separation means site-specific DOM concerns (selectors, rendering paths, event interception) live only in the adapter. Features never touch the site's DOM.

## How Pausing Works (Simplified)

Because the overlay is our own DOM, the pre/post-pause complexity from the original architecture is gone:

1. User clicks a word in the overlay
2. Caret position and word are extracted synchronously from our overlay elements
3. The overlay is **frozen** (stops accepting cue updates from the adapter)
4. The word is highlighted immediately in the frozen overlay
5. Video is paused (if pause-on-translate is enabled)
6. Translation is fetched and tooltip is displayed

No `waitForSubtitleSettle()` is needed — our overlay doesn't re-render on pause. No `segmentsForCaption()` is needed — there's only one rendering path (the overlay). No pre-capture of `subtitleRect` is needed — the overlay element persists and can be queried at any time.

On `cleanup()` (tooltip dismissed, video resumed), the overlay is **unfrozen** and re-renders with the latest cues the adapter sent while frozen.

## Staleness Protection (Still Applies)

- **`currentTranslationId`**: Monotonically increasing counter that detects stale async responses. Each click bumps the ID; when a translation response arrives, it's discarded if the ID no longer matches.
- **Global text offset**: `getGlobalTextOffset()` converts a (node, charStart) pair into a character position. Since the overlay is frozen during translation, the segments don't change — but the offset is still used to disambiguate when the same word appears multiple times.

## Adapter Hiding Strategy

Each adapter hides the site's original subtitles while keeping them observable:

- **YouTube**: CSS `visibility: hidden` on `.caption-window` — elements stay in DOM, MutationObserver still fires
- **SVT Play/svt.se (Chrome TextTrack)**: `track.mode = 'hidden'` — cues remain active (cuechange fires) but native rendering is suppressed
- **SVT Play/svt.se (Firefox)**: CSS `visibility: hidden` on native `.vtt-cue-teletext` elements
- **svt.se (React/portrait)**: CSS `visibility: hidden` on the specific rendering path's elements; aside-panel duplicate hidden with `display: none` for paths 1-3
