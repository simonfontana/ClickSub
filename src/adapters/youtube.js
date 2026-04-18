// YouTube adapter — observes subtitle DOM inside caption windows and reports text.
// YouTube uses a single .caption-window containing .caption-visual-line elements for
// its rolling two-line auto-generated subtitles.  For auto-generated subtitles, words
// appear incrementally (word-by-word); the MutationObserver fires on each addition,
// so our overlay mirrors the progressive reveal.

// eslint-disable-next-line no-unused-vars
function createYouTubeAdapter() {
    // CSS rule to visually hide YouTube's native subtitles while keeping them in the DOM
    // so the MutationObserver can still read their text content.
    const hideStyle = document.createElement('style');
    hideStyle.textContent = '.caption-window { visibility: hidden !important; }';

    let observer = null;
    let captionContainer = null;

    function getVideoElement() {
        return document.querySelector('video');
    }

    function extractCues() {
        // YouTube uses a single .caption-window with multiple .caption-visual-line
        // elements for its rolling two-line auto-generated subtitles.  Each visual
        // line contains one or more .ytp-caption-segment spans (word groups).
        // We join the visual lines within a window with \n so the overlay renders
        // them as stacked rows — matching YouTube's own layout.
        const windows = document.querySelectorAll('.caption-window');
        const lines = [];
        for (const win of windows) {
            const visualLines = win.querySelectorAll('.caption-visual-line');
            if (visualLines.length > 0) {
                const texts = [];
                for (const vl of visualLines) {
                    const text = vl.textContent.trim();
                    if (text) texts.push(text);
                }
                if (texts.length > 0) lines.push(texts.join('\n'));
            } else {
                // Fallback for manual subtitles that may not use visual lines
                const segments = win.querySelectorAll('.ytp-caption-segment');
                if (segments.length === 0) continue;
                const text = Array.from(segments).map(s => s.textContent).join('');
                if (text.trim()) lines.push(text);
            }
        }
        return lines;
    }

    return {
        startObserving(onCues) {
            document.head.appendChild(hideStyle);

            function onMutation() {
                onCues(extractCues());
            }

            // The caption container may not exist yet (video not started, subtitles not enabled).
            // Poll until we find it, then set up a MutationObserver.
            const timer = setInterval(() => {
                // YouTube's caption windows live inside a container that is a sibling of the video.
                // Look for any .caption-window and observe its parent.
                const win = document.querySelector('.caption-window');
                const container = win?.parentElement;
                if (!container || container === captionContainer) return;

                captionContainer = container;
                if (observer) observer.disconnect();
                observer = new MutationObserver(onMutation);
                observer.observe(container, { childList: true, subtree: true, characterData: true });
                // Report current state immediately
                onMutation();
            }, SUBTITLE_POLL_INTERVAL_MS);

            return function stop() {
                clearInterval(timer);
                if (observer) { observer.disconnect(); observer = null; }
                hideStyle.remove();
                captionContainer = null;
            };
        },

        getOverlayAnchor() {
            // Use .html5-video-player (the full player container) rather than
            // .html5-video-container (the video-only wrapper).  The video container
            // creates a low stacking context, so an overlay inside it is trapped
            // behind YouTube's caption/controls layers that are siblings of the
            // container.  Anchoring to the player puts our overlay in the same
            // stacking context as YouTube's own overlays.
            return document.querySelector('.html5-video-player')
                || getVideoElement()?.parentElement
                || null;
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
