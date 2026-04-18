// svt.se adapter — observes subtitles on www.svt.se.
// Four rendering paths (checked in priority order):
//   1. Firefox TextTrack DOM (.vtt-cue-teletext) — browser renders native DOM elements
//   2. Chrome TextTrack (cuechange) — no DOM; uses shared observeTextTrack helper
//   3. React DOM ([data-rt="subtitles-container"] div:has(> span)) — some videos
//   4. Portrait/vertical clip ([class*="VideoPlayerSubtitles__text"]) — some videos
//
// An aside-panel duplicate (VideoPlayerSubtitles__container) is hidden for paths 1-3.
// The portrait path (4) does NOT hide it — there is no aside duplicate; the
// VideoPlayerSubtitles__root element IS the primary renderer.

// eslint-disable-next-line no-unused-vars
function createSvtSeAdapter() {
    const hideStyle = document.createElement('style');

    let observer = null;
    let textTrackHelper = null;
    let originalSubtitleContainer = null;

    function getVideoElement() {
        return document.querySelector('video');
    }

    // Hide the aside-panel subtitle duplicate (landscape videos, paths 1-3).
    // Idempotent — safe to call repeatedly for lazy discovery.
    function hideAsideDuplicate() {
        if (!originalSubtitleContainer) {
            originalSubtitleContainer = document.querySelector('[class*="VideoPlayerSubtitles__container"]');
        }
        if (originalSubtitleContainer) originalSubtitleContainer.style.display = 'none';
    }

    function restoreAsideDuplicate() {
        if (originalSubtitleContainer) {
            originalSubtitleContainer.style.display = '';
            originalSubtitleContainer = null;
        }
    }

    // --- Path 1: Firefox native .vtt-cue-teletext elements ---

    function hasNativeCueElements() {
        return !!document.querySelector('.vtt-cue-teletext:not(.subtranslate-subtitle-overlay .vtt-cue-teletext)');
    }

    function extractFirefoxCues() {
        const cues = document.querySelectorAll('.vtt-cue-teletext:not(.subtranslate-subtitle-overlay .vtt-cue-teletext)');
        const lines = [];
        for (const cue of cues) {
            const text = cue.textContent.trim();
            if (text) lines.push(text);
        }
        return lines;
    }

    function startFirefoxPath(onCues) {
        hideStyle.textContent = '.vtt-cue-teletext:not(.subtranslate-subtitle-overlay .vtt-cue-teletext) { visibility: hidden !important; } div:has(> .vtt-cue-teletext:not(.subtranslate-subtitle-overlay .vtt-cue-teletext)) { visibility: hidden !important; }';
        document.head.appendChild(hideStyle);
        hideAsideDuplicate();

        const cueEl = document.querySelector('.vtt-cue-teletext:not(.subtranslate-subtitle-overlay .vtt-cue-teletext)');
        const container = cueEl?.parentElement?.parentElement || cueEl?.parentElement;
        if (container) {
            observer = new MutationObserver(() => {
                hideAsideDuplicate();
                onCues(extractFirefoxCues());
            });
            observer.observe(container, { childList: true, subtree: true, characterData: true });
        }
        onCues(extractFirefoxCues());
    }

    // --- Path 2: Chrome TextTrack (shared helper) ---

    function startTextTrackPath(video, onCues) {
        hideAsideDuplicate();
        if (!textTrackHelper) {
            textTrackHelper = observeTextTrack(video, (lines) => {
                hideAsideDuplicate();
                onCues(lines);
            });
            textTrackHelper.watchChanges();
        }
        textTrackHelper.tryAttach();
    }

    // --- Path 3: React DOM subtitles ---

    const REACT_SELECTOR = '[data-rt="subtitles-container"] div:has(> span)';

    function hasReactSubtitles() {
        return !!document.querySelector(REACT_SELECTOR);
    }

    function extractReactCues() {
        const els = document.querySelectorAll(REACT_SELECTOR);
        const lines = [];
        for (const el of els) {
            const text = el.textContent.trim();
            if (text) lines.push(text);
        }
        return lines;
    }

    function startReactPath(onCues) {
        hideStyle.textContent = `${REACT_SELECTOR} { visibility: hidden !important; }`;
        document.head.appendChild(hideStyle);
        hideAsideDuplicate();

        const container = document.querySelector('[data-rt="subtitles-container"]');
        if (container) {
            observer = new MutationObserver(() => {
                hideAsideDuplicate();
                onCues(extractReactCues());
            });
            observer.observe(container, { childList: true, subtree: true, characterData: true });
        }
        onCues(extractReactCues());
    }

    // --- Path 4: Portrait/vertical clip subtitles ---

    const PORTRAIT_SELECTOR = '[class*="VideoPlayerSubtitles__text"]';

    function hasPortraitSubtitles() {
        return !!document.querySelector(PORTRAIT_SELECTOR);
    }

    function extractPortraitCues() {
        const els = document.querySelectorAll(PORTRAIT_SELECTOR);
        const lines = [];
        for (const el of els) {
            const text = el.textContent.trim();
            if (text) lines.push(text);
        }
        return lines;
    }

    function startPortraitPath(onCues) {
        // Do NOT hide the aside-panel — for portrait videos, VideoPlayerSubtitles__root
        // IS the primary renderer (there is no aside duplicate).
        hideStyle.textContent = `${PORTRAIT_SELECTOR} { visibility: hidden !important; }`;
        document.head.appendChild(hideStyle);

        const root = document.querySelector('[class*="VideoPlayerSubtitles__root"]');
        const container = root || document.querySelector(PORTRAIT_SELECTOR)?.parentElement;
        if (container) {
            observer = new MutationObserver(() => onCues(extractPortraitCues()));
            observer.observe(container, { childList: true, subtree: true, characterData: true });
        }
        onCues(extractPortraitCues());
    }

    // --- Adapter interface ---

    return {
        startObserving(onCues) {
            let stopped = false;

            const timer = setInterval(() => {
                if (stopped) return;

                // Path 1: Firefox native DOM
                if (hasNativeCueElements()) {
                    clearInterval(timer);
                    startFirefoxPath(onCues);
                    return;
                }

                // Path 2: Chrome TextTrack
                const video = getVideoElement();
                if (video) {
                    for (let i = 0; i < video.textTracks.length; i++) {
                        if (video.textTracks[i].mode === 'showing') {
                            clearInterval(timer);
                            startTextTrackPath(video, onCues);
                            return;
                        }
                    }
                }

                // Path 3: React DOM subtitles
                if (hasReactSubtitles()) {
                    clearInterval(timer);
                    startReactPath(onCues);
                    return;
                }

                // Path 4: Portrait/vertical clip
                if (hasPortraitSubtitles()) {
                    clearInterval(timer);
                    startPortraitPath(onCues);
                    return;
                }

                // Also start watching for TextTrack changes if video exists
                if (video && !textTrackHelper) {
                    textTrackHelper = observeTextTrack(video, (lines) => {
                        hideAsideDuplicate();
                        onCues(lines);
                    });
                    textTrackHelper.watchChanges();
                }
            }, SUBTITLE_POLL_INTERVAL_MS);

            return function stop() {
                stopped = true;
                clearInterval(timer);
                if (observer) { observer.disconnect(); observer = null; }
                if (textTrackHelper) { textTrackHelper.teardown(); textTrackHelper = null; }
                hideStyle.remove();
                restoreAsideDuplicate();
            };
        },

        getOverlayAnchor() {
            // Portrait/vertical clips (9:16) use a VideoPlayerSubtitles__root overlay
            // that is positioned over the video. Anchoring to it places our subtitle
            // overlay in the same visual area. For landscape videos, video.parentElement
            // works (it's inside the standard player container).
            const portraitRoot = document.querySelector('[class*="VideoPlayerSubtitles__root"]');
            if (portraitRoot) return portraitRoot;
            return getVideoElement()?.parentElement || null;
        },

        pauseVideo() {
            const video = getVideoElement();
            if (video) video.pause();
        },

        resumeVideo() {
            const video = getVideoElement();
            if (video) video.play();
        },

        onResume(callback) {
            const video = getVideoElement();
            if (!video) return () => {};
            const handler = () => { callback(); video.removeEventListener('play', handler); };
            video.addEventListener('play', handler);
            return () => video.removeEventListener('play', handler);
        },
    };
}
