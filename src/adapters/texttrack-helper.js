// Shared TextTrack observation helper for sites that render subtitles via
// the browser's native TextTrack API (SVT Play Chrome, svt.se Chrome).
// Observes cuechange events and reports subtitle text to the adapter's onCues callback.

// eslint-disable-next-line no-unused-vars
function observeTextTrack(video, onCues) {
    let currentTrack = null;
    let changeHandler = null;

    function reportCues() {
        if (!currentTrack) { onCues([]); return; }
        const active = currentTrack.activeCues;
        if (!active || active.length === 0) { onCues([]); return; }
        const lines = [];
        for (let i = 0; i < active.length; i++) {
            // Strip VTT formatting tags (e.g. <v>, <c>) and keep raw text.
            // Newlines within a cue are preserved so the overlay can render multi-line cues.
            lines.push(active[i].text.replace(/<[^>]*>/g, ''));
        }
        onCues(lines);
    }

    function setup(track) {
        if (currentTrack === track) return;
        if (currentTrack) currentTrack.removeEventListener('cuechange', reportCues);
        currentTrack = track;
        track.mode = 'hidden'; // keep cues active but suppress native rendering
        track.addEventListener('cuechange', reportCues);
        reportCues();
    }

    function detachTrack() {
        if (currentTrack) {
            currentTrack.removeEventListener('cuechange', reportCues);
            currentTrack = null;
        }
        onCues([]);
    }

    // Full teardown — removes all listeners including the change watcher.
    // Called by the adapter's stop() when the extension is cleaning up.
    function teardown() {
        detachTrack();
        if (changeHandler) {
            video.textTracks.removeEventListener('change', changeHandler);
            changeHandler = null;
        }
    }

    // Try to find and attach to an active ('showing') text track.
    // Returns true if a track was found.
    function tryAttach() {
        for (let i = 0; i < video.textTracks.length; i++) {
            if (video.textTracks[i].mode === 'showing') {
                setup(video.textTracks[i]);
                return true;
            }
        }
        return false;
    }

    // Watch for track switches (user enables/disables subtitles or changes language).
    function watchChanges() {
        if (changeHandler) return; // already watching
        changeHandler = () => {
            if (currentTrack && currentTrack.mode === 'disabled') {
                detachTrack();
                return;
            }
            // A track was switched to 'showing' — find and set it up
            tryAttach();
        };
        video.textTracks.addEventListener('change', changeHandler);
    }

    return { tryAttach, watchChanges, teardown };
}
