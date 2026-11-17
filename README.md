# ClipForge AI — preview

A static local-video preview built because the supplied HTML references an `app.js` that was not provided. The hosted frontend is a replacement, not the original application.

Choose a local video, seek, choose a clip range (maximum 120 seconds), preview a centered crop in 9:16, 1:1, or 16:9, and overlay a manual caption. Video stays in the browser. **Export is disabled.** No AI, transcription, automatic reframing, URL import, virality scoring, MP4 generation, publishing, or backend integration is provided. Browser formats and performance vary; physical phones and Safari are untested.

## Supplied backend

`provided/backend/` contains the supplied illustrative Python files, unchanged in behavior. They are not deployed or connected to this site. The backend downloads URLs but returns hard-coded sample metadata; it does not transcribe, score, crop, or export video. It has permissive CORS, no authentication, and accepts arbitrary URLs; do not expose it on a network or run it while browsing untrusted sites. GitHub Pages cannot execute Python.
