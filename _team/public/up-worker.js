/* Team: sends a file's encrypted pieces off the page's own thread (JP 2026-11-27: "runs in the background first, then just shows up").
   The page hands over the file, the team key (a CryptoKey can be passed to a worker; it stays non-extractable) and the ids; this
   worker reads each 1 MB piece, locks it (AES-GCM, AAD fid|n|epoch – the same as app.js) and sends it to /api/fchunk.
   Reading, locking and turning the bytes into text used to run on the page and made it stutter while files were uploading. */
var TE = new TextEncoder();
function b64(buf) { var u = new Uint8Array(buf), s = ''; for (var i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
self.onmessage = async function (e) {
  var m = e.data || {}, id = m.id;
  try {
    var n = Math.max(1, Math.ceil(m.file.size / m.chunk));
    for (var i = 0; i < n; i++) {
      var part = new Uint8Array(await m.file.slice(i * m.chunk, (i + 1) * m.chunk).arrayBuffer()), iv = crypto.getRandomValues(new Uint8Array(12));
      var ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: TE.encode(m.fid + '|' + i + '|' + m.epoch) }, m.key, part);
      var body = { fid: m.fid, n: i, iv: b64(iv), ct: b64(ct) }; if (m.g) body.g = m.g;
      var r;
      try { r = await fetch('/api/fchunk', { method: 'PUT', headers: { 'x-team': '1', 'x-tid': m.tid, 'content-type': 'application/json' }, credentials: 'same-origin', cache: 'no-store', body: JSON.stringify(body) }); }
      catch (x) { self.postMessage({ id: id, offline: true }); return; }
      if (!r.ok) { var j = {}; try { j = await r.json(); } catch (x) {} self.postMessage({ id: id, status: r.status, error: j.error || ('HTTP ' + r.status), data: j }); return; }
    }
    self.postMessage({ id: id, ok: true, n: n });
  } catch (x) { self.postMessage({ id: id, fail: String((x && x.message) || x) }); }
};
