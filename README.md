# SubTranslate

A browser extension that lets you click words in video subtitles to instantly translate them using the DeepL API. Works on YouTube, SVT Play, and svt.se.

## Features

- **Click a word** in the subtitles to translate it. The video pauses and a tooltip shows the translation.
- **Double-click** to translate the full sentence, where each word is clickable.
- **Click any translated word** in the tooltip to see its reverse translation (back to the source language).
- **Right-click the tooltip** to copy the translation or the original text.
- Handles hyphenated words split across subtitle lines (e.g. "komplett-" / "eringar" is joined into "kompletteringar" for translation).
- **Customize subtitle font size** (8–72px) and highlight color via extension settings for better readability.
- **Advanced options**: choose translation model (high quality vs. fast), adjust how many previous subtitle lines are sent as context to DeepL, and toggle whether the video pauses on translate.
- **API usage tracker** in the popup footer shows characters used vs. limit with a color-coded progress bar.
- Supports 29 languages via the DeepL API, with auto-detect for the source language.

## Supported Sites

| Site | Adapter | How subtitles are observed |
|------|---------|---------------------------|
| YouTube | `src/adapters/youtube.js` | MutationObserver on `.ytp-caption-segment` |
| SVT Play | `src/adapters/svtplay.js` | Firefox: MutationObserver on native DOM; Chrome: TextTrack `cuechange` |
| svt.se | `src/adapters/svtse.js` | Four paths: Firefox TextTrack DOM, Chrome TextTrack, React DOM, portrait overlay |

## Installation

### Prerequisites

You need a DeepL API key (free or paid). Get one at [deepl.com/your-account/keys](https://www.deepl.com/en/your-account/keys). The extension auto-detects which API endpoint to use based on your key (free keys end in `:fx`).

### Chrome

1. Run `task build-dirs` to copy files to `out/chrome-build/`
2. Go to `chrome://extensions/`
3. Enable **Developer Mode**
4. Click **Load unpacked** and select `out/chrome-build/`
5. Re-run `task build-dirs` and reload the extension after source changes

### Firefox

1. Run `task build-dirs` to copy files to `out/firefox-build/`
2. Go to `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on**
4. Select `manifest.json` in `out/firefox-build/`
5. Re-run `task build-dirs` and reload the extension after source changes

### Configuration

1. Click the extension icon in the toolbar
2. Select your source and target languages (saved automatically)
3. Enter your DeepL API key (validated and saved automatically)
4. Optionally, adjust the subtitle font size (8–72px) and highlight color under the **Appearance** tab
5. Optionally, tune the translation model, context history size, and pause-on-translate behaviour under the **Advanced** tab

## Usage

1. Play a video with subtitles enabled
2. **Single-click** a word in the subtitles to translate it
3. **Double-click** the subtitles to translate the full sentence
4. Click any translated word in the tooltip to see its reverse translation (back to the source language)
5. The video resumes when you press play, and the tooltip is automatically dismissed

## Development

### Prerequisites

- **Node.js** (v18+) — for running tests
- **[task](https://taskfile.dev/installation/)** — task runner used for build/dev/release
- **jq** — used by the release task to read manifest versions
- **zip** — used by `task build` to package the extension

### Setup

```
npm install
```

`npm install` only pulls in `jsdom` for the unit tests — the extension itself has no runtime dependencies.

### Tasks

| Task | Description |
|------|-------------|
| `task build-dirs` | Copy extension files to `out/chrome-build/` and `out/firefox-build/` for loading as unpacked extensions. Re-run after source changes. |
| `task build-zips` | Package the build directories into zip archives for store submission. |
| `task build` | Run `build-dirs` and `build-zips` (full build). |
| `task test` | Run unit tests (`node --test test/*.test.js`). |
| `task release -- <major\|minor\|patch>` | Bump version in both manifests and `package.json`, commit, tag, and push. |
| `task clean` | Remove the `out/` directory. |

### Adding a New Site

1. Inspect the live subtitle DOM while a video is playing (the subtitle elements are injected dynamically and won't appear in page source)
2. Create an adapter in `src/adapters/<sitename>.js` — a factory function that observes the site's subtitles, hides the originals, and feeds text to the shared overlay
3. Register the adapter in the `ADAPTERS` map in `src/content.js`
4. Add the hostname pattern to `content_scripts[0].matches` and the adapter JS file to `content_scripts[0].js` in both manifests
5. Test: single-click word translation, double-click sentence translation, right-click context menu, hyphenated words, fullscreen mode

See [docs/ai/adding-new-site.md](docs/ai/adding-new-site.md) for detailed instructions.

## Project Structure

```
manifest.firefox.json  - Firefox manifest (MV2)
manifest.chrome.json   - Chrome manifest (MV3)
src/
  constants.js         - Storage keys and default values
  utils.js             - Shared pure functions (language resolution, highlighting, DOM helpers)
  adapters/            - Per-site subtitle observation and hiding
    texttrack-helper.js  - Shared helper for TextTrack-based sites
    youtube.js           - YouTube adapter (MutationObserver)
    svtplay.js           - SVT Play adapter (DOM or TextTrack)
    svtse.js             - svt.se adapter (four rendering paths)
  subtitle-overlay.js  - Shared overlay renderer (receives cues from adapters)
  content.js           - Injected into video pages; handles clicks, highlighting, tooltips
  content.css          - Overlay layout, highlight styles, pointer-events overrides
  background.js        - Receives translation requests, calls DeepL API
  popup.html           - Settings UI (language selection, API key)
  popup.js             - Settings persistence and API key validation
  icons/               - Extension icons (16, 48, 128px)
assets/
  icon512.png          - 512px source icon
```

## AI Assistance

This project was written with the help of [Claude Code](https://claude.ai/code) (Anthropic).
I am a backend developer without JavaScript experience, so Claude was used to generate and iterate on the extension code throughout development.

## License

See [LICENSE](LICENSE).
