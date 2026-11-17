'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const video = $('video'), canvas = $('preview'), ctx = canvas.getContext('2d');
  const el = Object.fromEntries(['video-file','drop-zone','file-info','file-name','file-meta','change-file','play','seek','playhead-text','start','end','set-start','set-end','range-hint','caption','caption-count','preview-frame','empty-preview','preview-status','format-status','export','progress-wrap','progress-text','progress','cancel-export','download','message'].map(id => [id, $(id)]));
  let sourceUrl = null, downloadUrl = null, ready = false, exporting = false, recorder = null, stream = null, timer = null, canceled = false, selectedName = '', selectedRatio = '9:16';
  const MAX = 500 * 1024 * 1024;
  const sizes = {'9:16':[720,1280], '1:1':[720,720], '16:9':[1280,720]};
  // Export remains disabled until the experimental MediaRecorder path has been verified end-to-end.
  const supportsWebM = () => false;
  const say = (message, error = false) => { el.message.textContent = message; el.message.classList.toggle('error', error); };
  const format = t => { t = Math.max(0, Math.floor(t || 0)); return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`; };
  function clearDownload() { if (downloadUrl) URL.revokeObjectURL(downloadUrl); downloadUrl = null; el.download.hidden = true; el.download.removeAttribute('href'); }
  function validRange() {
    if (!ready) return false;
    const a = Number(el.start.value), b = Number(el.end.value), duration = video.duration;
    if (el.start.value === '' || el.end.value === '' || !Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b > duration + 0.0001 || b <= a) { el['range-hint'].textContent = 'Enter a valid range within the video; end must be after start.'; el['range-hint'].classList.add('error'); return false; }
    if (b - a > 120.0001) { el['range-hint'].textContent = 'Clips can be at most 120 seconds.'; el['range-hint'].classList.add('error'); return false; }
    el['range-hint'].textContent = `${(b-a).toFixed(2)} seconds selected. Export timing is approximate.`;
    el['range-hint'].classList.remove('error'); return true;
  }
  function updateControls() {
    const valid = validRange();
    for (const id of ['play','seek','start','end','set-start','set-end','change-file']) el[id].disabled = !ready || exporting;
    $('video-file').disabled = exporting;
    $('caption').disabled = exporting;
    document.querySelectorAll('.ratio').forEach(b => b.disabled = exporting);
    el.export.disabled = !ready || exporting || !valid || !supportsWebM();
  }
  function draw() {
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#09070e'; ctx.fillRect(0,0,w,h);
    if (ready && video.readyState >= 2 && video.videoWidth && video.videoHeight) {
      const scale = Math.max(w/video.videoWidth, h/video.videoHeight);
      const sw = w/scale, sh = h/scale;
      ctx.drawImage(video, (video.videoWidth-sw)/2, (video.videoHeight-sh)/2, sw, sh, 0, 0, w, h);
      const text = el.caption.value.trim();
      if (text) {
        const fs = Math.round(w * (selectedRatio === '16:9' ? .038 : .055));
        ctx.font = `700 ${fs}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        const maxWidth = w*.84, lines = [];
        for (const para of text.split('\n')) {
          let line = '';
          for (const word of para.split(/\s+/)) {
            const candidate = line ? line + ' ' + word : word;
            if (line && ctx.measureText(candidate).width > maxWidth) { lines.push(line); line = word; } else line = candidate;
          }
          lines.push(line);
        }
        const lineHeight = fs * 1.23, maxLines = Math.max(1,Math.floor(h*.32 / lineHeight));
        const visible = lines.slice(0,maxLines);
        if (lines.length > maxLines) visible[visible.length-1] += '…';
        const y0 = h*.79 - (visible.length-1)*lineHeight/2;
        ctx.lineWidth = fs*.18; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.fillStyle = '#fff';
        visible.forEach((line,i) => { ctx.strokeText(line,w/2,y0+i*lineHeight,maxWidth); ctx.fillText(line,w/2,y0+i*lineHeight,maxWidth); });
      }
    }
  }
  function resize() { [canvas.width,canvas.height] = sizes[selectedRatio]; el['preview-frame'].dataset.ratio = selectedRatio; el['format-status'].textContent = `${selectedRatio} · centered crop`; draw(); }
  function refreshTime() { el.seek.value = video.currentTime || 0; el['playhead-text'].textContent = `${format(video.currentTime)} / ${format(video.duration)}`; draw(); }
  function animation() { if (!video.paused && !video.ended) { refreshTime(); requestAnimationFrame(animation); } }
  function reset() {
    video.pause(); ready = false; video.removeAttribute('src'); video.load(); if (sourceUrl) URL.revokeObjectURL(sourceUrl); sourceUrl = null; clearDownload();
    el['drop-zone'].hidden = false; el['file-info'].hidden = true; el['empty-preview'].hidden = false; el['preview-status'].textContent = 'Waiting for video'; el.seek.value = 0; el.seek.max = 0; el['playhead-text'].textContent = '00:00 / 00:00'; el['range-hint'].textContent = 'Choose a video to set the clip range.'; el['range-hint'].classList.remove('error'); updateControls(); draw();
  }
  function loadFile(file) {
    if (!file || exporting) return;
    if (file.size > MAX) { say('Please choose a video no larger than 500 MiB.', true); return; }
    if (!file.type.startsWith('video/') && file.type !== '') { say('Please choose a video file.', true); return; }
    reset(); say('Loading video…'); selectedName = file.name; sourceUrl = URL.createObjectURL(file); video.src = sourceUrl; video.load();
  }
  el['video-file'].addEventListener('change', e => { loadFile(e.target.files[0]); e.target.value = ''; });
  el['change-file'].addEventListener('click', () => el['video-file'].click());
  for (const name of ['dragenter','dragover']) el['drop-zone'].addEventListener(name, e => { e.preventDefault(); el['drop-zone'].classList.add('drag'); });
  for (const name of ['dragleave','drop']) el['drop-zone'].addEventListener(name, e => { e.preventDefault(); el['drop-zone'].classList.remove('drag'); });
  el['drop-zone'].addEventListener('drop', e => loadFile(e.dataTransfer.files[0]));
  video.addEventListener('loadedmetadata', () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0 || !video.videoWidth) { reset(); say('This video has no usable duration or video track.',true); return; }
    ready = true; el['drop-zone'].hidden = true; el['file-info'].hidden = false; el['empty-preview'].hidden = true; el['file-name'].textContent = selectedName; el['file-meta'].textContent = `${format(video.duration)} · ${video.videoWidth} × ${video.videoHeight}`; el['preview-status'].textContent = 'Ready to edit'; el.seek.max = video.duration; el.start.max = video.duration; el.end.max = video.duration; el.start.value = '0'; el.end.value = (Math.floor(Math.min(video.duration,120)*100)/100).toFixed(2); updateControls(); refreshTime(); say('Video ready. Your file stays in this browser. Export is disabled until recording is verified.');
  });
  video.addEventListener('loadeddata', draw); video.addEventListener('seeked', refreshTime); video.addEventListener('timeupdate', refreshTime);
  video.addEventListener('error', () => { if (sourceUrl) { reset(); say('This video could not be opened. Try a format your browser supports.',true); } });
  video.addEventListener('play', () => { el.play.textContent = '❚❚'; el.play.setAttribute('aria-label','Pause video'); animation(); });
  video.addEventListener('pause', () => { el.play.textContent = '▶'; el.play.setAttribute('aria-label','Play video'); refreshTime(); });
  el.play.addEventListener('click', async () => { if (video.paused) { try { await video.play(); } catch { say('Playback was blocked by your browser.',true); } } else video.pause(); });
  el.seek.addEventListener('input', () => { video.currentTime = Number(el.seek.value); });
  for (const id of ['start','end']) el[id].addEventListener('input', () => { clearDownload(); updateControls(); });
  el['set-start'].addEventListener('click', () => { el.start.value = video.currentTime.toFixed(2); clearDownload(); updateControls(); });
  el['set-end'].addEventListener('click', () => { el.end.value = video.currentTime.toFixed(2); clearDownload(); updateControls(); });
  el.caption.addEventListener('input', () => { el['caption-count'].textContent = `${el.caption.value.length} / 160`; clearDownload(); draw(); });
  document.querySelectorAll('.ratio').forEach(button => button.addEventListener('click', () => { selectedRatio = button.dataset.ratio; document.querySelectorAll('.ratio').forEach(b => { const active = b === button; b.classList.toggle('active',active); b.setAttribute('aria-pressed',String(active)); }); clearDownload(); resize(); }));
  function seekTo(time) { return new Promise((resolve,reject) => { if (Math.abs(video.currentTime-time) < .005 && video.readyState >= 2) return resolve(); const timeout = setTimeout(() => { video.removeEventListener('seeked',done); reject(new Error('Seeking timed out.')); },10000); function done() { clearTimeout(timeout); resolve(); } video.addEventListener('seeked',done,{once:true}); video.currentTime = time; }); }
  function finish(cancel) { canceled = cancel; clearInterval(timer); timer = null; if (recorder && recorder.state !== 'inactive') recorder.stop(); }
  el['cancel-export'].addEventListener('click', () => finish(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden && exporting) { say('Export canceled because the tab was hidden. Keep it open during export.',true); finish(true); } });
  el.export.addEventListener('click', async () => {
    if (!ready || exporting || !validRange() || !supportsWebM()) return;
    clearDownload(); exporting = true; canceled = false; updateControls(); el['progress-wrap'].hidden = false; el.progress.value = 0; el['progress-text'].textContent = 'Preparing export…'; say('Preparing your clip. Keep this tab open.');
    const start = Number(el.start.value), end = Number(el.end.value), duration = end-start; let chunks = [], hasAudio = false, lastTime = 0, lastAdvance = Date.now(), failed = '';
    try {
      video.pause(); await seekTo(start); if (canceled) throw new Error('Export canceled.'); draw();
      stream = canvas.captureStream(30);
      // A captured video stream may supply an audio track in Chromium; otherwise export remains silent.
      const capture = video.captureStream || video.mozCaptureStream;
      if (capture) { try { const source = capture.call(video); source.getAudioTracks().forEach(track => stream.addTrack(track)); hasAudio = source.getAudioTracks().length > 0; } catch (_) {} }
      const mime = ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(x => MediaRecorder.isTypeSupported(x));
      recorder = new MediaRecorder(stream, {mimeType:mime, videoBitsPerSecond:4000000});
      recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      recorder.onerror = () => { failed = 'Recording failed in this browser.'; finish(true); };
      recorder.onstop = () => {
        video.pause(); if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; recorder = null; exporting = false; el['progress-wrap'].hidden = true; updateControls();
        if (failed) { say(failed,true); return; }
        if (canceled) { if (!document.hidden) say('Export canceled.'); return; }
        const blob = new Blob(chunks, {type:'video/webm'}); if (!blob.size) { say('The browser produced an empty recording.',true); return; }
        downloadUrl = URL.createObjectURL(blob); el.download.href = downloadUrl; el.download.download = (selectedName.replace(/\.[^.]+$/, '') || 'clipforge') + '-clip.webm'; el.download.hidden = false; say(hasAudio ? 'Your WebM is ready. An audio track was captured if your source contained audio.' : 'Your WebM is ready without audio: this browser did not provide an audio track.');
      };
      recorder.start(250); await video.play();
      if (canceled) { finish(true); return; }
      lastTime = video.currentTime;
      timer = setInterval(() => { const t = video.currentTime; el.progress.value = Math.max(0,Math.min(1,(t-start)/duration)); el['progress-text'].textContent = `Exporting ${Math.round(el.progress.value*100)}%`; if (t > lastTime + .02) { lastTime = t; lastAdvance = Date.now(); } if (t >= end || video.ended) finish(false); else if (Date.now()-lastAdvance > 15000) { failed = 'Playback stalled during export. Please try again.'; finish(true); } },40);
    } catch (err) {
      if (recorder && recorder.state !== 'inactive') { failed = canceled ? '' : (err.message || 'Export could not start.'); finish(true); }
      else { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; exporting = false; el['progress-wrap'].hidden = true; updateControls(); say(canceled ? 'Export canceled.' : (err.message || 'Export could not start.'), !canceled); }
    }
  });
  resize(); updateControls();
})();
