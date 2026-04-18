// SVT Play adapter — observes subtitles on www.svtplay.se.
// Two rendering paths:
//   Firefox: browser renders .vtt-cue-teletext DOM elements natively → MutationObserver
//   Chrome:  browser renders via TextTrack ::cue (no DOM) → observeTextTrack helper

// eslint-disable-next-line no-unused-vars
function createSvtPlayAdapter() {
    // CSS rule to visually hide SVT Play's native Firefox subtitle elements
    // while keeping them in the DOM for the MutationObserver to read.
    const hideStyle = document.createElement('style');

    let observer = null;
    let textTrackHelper = null;

    function getVideoElement() {
        return document.querySelector('video');
    }

    // Check whether Firefox-rendered .vtt-cue-teletext elements exist in the DOM
    // (excluding any that live inside our own overlay).
    function hasNativeCueElements() {
        return !!document.querySelector('.vtt-cue-teletext:not(.subtranslate-subtitle-overlay .vtt-cue-teletext)');
    }

    function extractFirefoxCues() {
        // Native .vtt-cue-teletext elements (Firefox path). Each contains one <span> per line.
        const cues = document.querySelectorAll('.vtt-cue-teletext:not(.subtranslate-subtitle-overlay .vtt-cue-teletext)');
        const lines = [];
        for (const cue of cues) {
            const text = cue.textContent.trim();
            if (text) lines.push(text);
        }
        return lines;
    }

    return {
        startObserving(onCues) {
            let stopped = false;

            // Poll until we detect which rendering path is active.
            const timer = setInterval(() => {
                if (stopped) return;

                // Path 1: Firefox native DOM elements
                if (hasNativeCueElements()) {
                    clearInterval(timer);
                    hideStyle.textContent = '.vtt-cue-teletext:not(.subtranslate-subtitle-overlay .vtt-cue-teletext) { visibility: hidden !important; } div:has(> .vtt-cue-teletext:not(.subtranslate-subtitle-overlay .vtt-cue-teletext)) { visibility: hidden !important; }';
                    document.head.appendChild(hideStyle);

                    // Observe the parent container of the cue elements for mutations.
                    const cueEl = document.querySelector('.vtt-cue-teletext:not(.subtranslate-subtitle-overlay .vtt-cue-teletext)');
                    const container = cueEl?.parentElement?.parentElement || cueEl?.parentElement;
                    if (container) {
                        observer = new MutationObserver(() => onCues(extractFirefoxCues()));
                        observer.observe(container, { childList: true, subtree: true, characterData: true });
                    }
                    onCues(extractFirefoxCues());
                    return;
                }

                // Path 2: Chrome TextTrack (no DOM elements — use shared helper)
                const video = getVideoElement();
                if (!video) return;

                textTrackHelper = observeTextTrack(video, onCues);
                if (textTrackHelper.tryAttach()) {
                    clearInterval(timer);
                    textTrackHelper.watchChanges();
                    return;
                }

                // Also start watching for future track additions
                textTrackHelper.watchChanges();
            }, SUBTITLE_POLL_INTERVAL_MS);

            return function stop() {
                stopped = true;
                clearInterval(timer);
                if (observer) { observer.disconnect(); observer = null; }
                if (textTrackHelper) { textTrackHelper.teardown(); textTrackHelper = null; }
                hideStyle.remove();
            };
        },

        getOverlayAnchor() {
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
