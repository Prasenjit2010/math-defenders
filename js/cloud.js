/* Math Defenders — cloud.js
   Optional class saving through Supabase. Students are a nickname inside a class
   code: no emails, no accounts. If js/config.js has no project URL, or the
   network fails, the game keeps working session-only. Uses plain fetch, no SDK. */
(function (MD) {
  'use strict';
  const CFG = MD.CLOUD_CONFIG || {};
  const URL_ = String(CFG.url || '').replace(/\/+$/, '');
  const KEY = String(CFG.key || '');
  const enabled = () => !!(URL_ && KEY && window.fetch);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function rpc(fn, args, opts) {
    opts = opts || {};
    if (!enabled()) throw new Error('offline');
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      let ctrl = null, timer = 0;
      try {
        if (window.AbortController && !opts.keepalive) { ctrl = new AbortController(); timer = setTimeout(() => ctrl.abort(), 9000); }
        const res = await fetch(URL_ + '/rest/v1/rpc/' + fn, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + KEY },
          body: JSON.stringify(args || {}),
          keepalive: !!opts.keepalive,
          signal: ctrl ? ctrl.signal : undefined
        });
        clearTimeout(timer);
        const text = await res.text();
        let body = null; try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
        if (res.ok) return body;
        const msg = body && body.message ? body.message : 'Server error ' + res.status;
        // Busy or briefly down: wait a random moment and try again, so thousands of
        // students don't all retry at the same instant.
        if ((res.status === 429 || res.status >= 500) && attempt < 2 && !opts.keepalive) { lastErr = new Error(msg); await sleep(600 + Math.random() * 1800 * (attempt + 1)); continue; }
        const err = new Error(msg); err.server = true; throw err;
      } catch (e) {
        clearTimeout(timer);
        if (e.server || opts.keepalive || attempt >= 2) throw e;
        lastErr = e; await sleep(600 + Math.random() * 1800 * (attempt + 1));
      }
    }
    throw lastErr || new Error('offline');
  }

  const cleanCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

  MD.Cloud = {
    enabled,
    cleanCode,
    validCode: c => /^[A-HJ-NP-Z2-9]{6}$/.test(cleanCode(c)),
    createClass: pin => rpc('md_create_class', { p_pin: pin }),
    join: (code, nick) => rpc('md_join', { p_code: cleanCode(code), p_nickname: nick }),
    save: (p, keepalive) => rpc('md_save', p, { keepalive }),
    report: (code, pin) => rpc('md_report', { p_code: cleanCode(code), p_pin: pin }),
    removePlayer: (code, pin, id) => rpc('md_remove_player', { p_code: cleanCode(code), p_pin: pin, p_id: id })
  };
})(globalThis.MD = globalThis.MD || {});
