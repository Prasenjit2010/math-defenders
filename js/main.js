/* Math Defenders — main.js
   Screens, HUD, math bar, build/upgrade menus, Tower Almanac, Teacher view,
   session rating, sound and the main loop. Session-only: no storage of any kind. */
(function (MD) {
  'use strict';
  const T = MD.Towers, Q = MD.Questions, W = MD.Waves, B = MD.Board;
  const $ = id => document.getElementById(id);
  const JAM_MS = 1200;

  const RANKS = [
    { name: 'Rookie', min: 0, color: '#A8A29E', dark: '#57534E' },
    { name: 'Bronze', min: 1050, color: '#D97706', dark: '#92400E' },
    { name: 'Silver', min: 1150, color: '#CBD5E1', dark: '#64748B' },
    { name: 'Gold', min: 1300, color: '#FACC15', dark: '#A16207' },
    { name: 'Platinum', min: 1500, color: '#5EEAD4', dark: '#0F766E' },
    { name: 'Diamond', min: 1750, color: '#93C5FD', dark: '#1D4ED8' },
    { name: 'Legend', min: 2050, color: '#F87171', dark: '#991B1B' }
  ];
  const rankIndex = elo => { let i = 0; RANKS.forEach((r, k) => { if (elo >= r.min) i = k; }); return i; };

  /* All state lives here, in memory, for this tab only. */
  const S = {
    nick: '', band: 'k1', mapId: 'meadow', startWave: 1,
    game: null, session: new Q.Session(), paused: false, speed: 1, ended: false,
    ui: { hoverPad: -1, selectedPad: -1, rangeFor: null, castleHurt: 0, time: 0, showArrow: true },
    problem: null, shownAt: 0, pausedAt: 0, jamUntil: 0, locked: false, fast: 0,
    elo: 1000, milestoneShown: false, muted: false, teacherPaused: false,
    teacher: { pin: null, classCode: null },   // memory only: forgotten when the tab closes
    scale: 1, hud: {}, icons: {}, errors: 0, alm: { chassis: 'dart', path: 'A', tier: 1, tab: 'towers' }
  };

  /* ================= Sound (synthesized, optional) ================= */
  const Sound = (() => {
    let ac = null; const last = {};
    const ctx = () => { if (!ac) { try { const A = window.AudioContext || window.webkitAudioContext; if (A) ac = new A(); } catch (e) { ac = null; } } return ac; };
    function tone(f, d, type, v, slide) {
      const a = ctx(); if (!a || S.muted) return;
      try {
        if (a.state === 'suspended') a.resume();
        const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
        o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
        g.gain.setValueAtTime(v || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + 0.02);
      } catch (e) { /* sound is optional */ }
    }
    const lim = (n, gap, fn) => { const now = Date.now(); if (last[n] && now - last[n] < gap) return; last[n] = now; fn(); };
    const map = {
      correct: () => { tone(660, 0.08, 'square', 0.045); setTimeout(() => tone(990, 0.12, 'square', 0.045), 70); },
      wrong: () => tone(150, 0.25, 'sawtooth', 0.05, 0.6),
      build: () => tone(220, 0.12, 'triangle', 0.09, 1.8),
      upgrade: () => [440, 660, 880].forEach((f, i) => setTimeout(() => tone(f, 0.09, 'square', 0.045), i * 60)),
      sell: () => tone(500, 0.12, 'triangle', 0.06, 0.6),
      click: () => tone(700, 0.03, 'square', 0.03),
      dart: () => lim('dart', 70, () => tone(900, 0.04, 'square', 0.012, 0.7)),
      cryo: () => lim('cryo', 160, () => tone(1400, 0.2, 'sine', 0.03, 0.5)),
      mortar: () => lim('mortar', 120, () => tone(130, 0.15, 'triangle', 0.07, 0.6)),
      boom: () => lim('boom', 110, () => tone(80, 0.28, 'sawtooth', 0.05, 0.4)),
      tesla: () => lim('tesla', 120, () => tone(1800, 0.08, 'sawtooth', 0.02, 0.4)),
      gravity: () => lim('grav', 200, () => tone(90, 0.3, 'sine', 0.06, 1.6)),
      saw: () => lim('saw', 120, () => tone(1200, 0.06, 'sawtooth', 0.015, 1.2)),
      glue: () => lim('glue', 150, () => tone(260, 0.1, 'triangle', 0.04, 0.5)),
      rail: () => lim('rail', 100, () => tone(2400, 0.12, 'sawtooth', 0.03, 0.2)),
      tornado: () => lim('torn', 200, () => tone(300, 0.25, 'triangle', 0.03, 1.4)),
      leak: () => tone(200, 0.3, 'square', 0.06, 0.5),
      wave: () => { tone(392, 0.12, 'square', 0.045); setTimeout(() => tone(523, 0.18, 'square', 0.045), 110); },
      boss: () => tone(110, 0.5, 'sawtooth', 0.07, 1.5),
      won: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'square', 0.05), i * 130)),
      lost: () => [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.07), i * 200)),
      rank: () => [523, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.14, 'square', 0.045), i * 90))
    };
    return { play: n => { if (map[n]) map[n](); }, unlock: () => { const a = ctx(); if (a && a.state === 'suspended') { try { a.resume(); } catch (e) { } } } };
  })();

  /* ================= Helpers ================= */
  function show(name) { ['start', 'game'].forEach(n => $('screen-' + n).classList.toggle('active', n === name)); }
  function anyModal() { return !!document.querySelector('.modal:not([hidden])'); }
  function openModal(id) { $(id).hidden = false; const m = $(id), f = m.querySelector('.btn-felt:not(:disabled)') || m.querySelector('button:not(:disabled)'); if (f) setTimeout(() => { try { f.focus(); } catch (e) { } }, 30); }
  function closeModal(id) { $(id).hidden = true; }
  let toastT = 0;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Math.floor(n).toLocaleString('en-US');
  function bump(id, cls) { const e = $(id); cls = cls || 'bump'; e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); }

  function renderSeg(el, opts, current, onPick) {
    el.innerHTML = '';
    opts.forEach(o => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'seg' + (o.id === current ? ' on' : '');
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(o.id === current));
      b.textContent = o.label;
      b.addEventListener('click', () => {
        [...el.children].forEach(c => { c.classList.remove('on'); c.setAttribute('aria-checked', 'false'); });
        b.classList.add('on'); b.setAttribute('aria-checked', 'true'); onPick(o.id);
      });
      el.appendChild(b);
    });
  }

  function badgeSVG(idx) {
    const r = RANKS[idx]; let pips = '';
    for (let i = 0; i < idx; i++) {
      const row = i < 3 ? 0 : 1, col = i < 3 ? i : i - 3, n = idx <= 3 ? idx : (row ? idx - 3 : 3);
      const cx = 32 + (col - (n - 1) / 2) * 11, cy = 50 + row * 9;
      pips += '<rect x="' + (cx - 3.5) + '" y="' + (cy - 3.5) + '" width="7" height="7" transform="rotate(45 ' + cx + ' ' + cy + ')" fill="#fff" stroke="#1E293B" stroke-width="2"/>';
    }
    return '<svg viewBox="0 0 64 72" role="img" aria-label="' + r.name + ' rank"><path d="M32 4 7 13v19c0 17 10 29 25 36 15-7 25-19 25-36V13z" fill="' + r.dark + '" stroke="#1E293B" stroke-width="4" stroke-linejoin="round"/><path d="M32 10 13 17v15c0 13 8 23 19 29 11-6 19-16 19-29V17z" fill="' + r.color + '"/><path d="M32 17l3.6 7.4 8.1 1.1-5.9 5.6 1.5 8-7.3-3.9-7.3 3.9 1.5-8-5.9-5.6 8.1-1.1z" fill="#fff" stroke="#1E293B" stroke-width="2.4" stroke-linejoin="round"/>' + pips + '</svg>';
  }

  function icon(chassis, path, tier, size) {
    const key = chassis + (path || '') + (tier || 0) + ':' + size;
    if (!S.icons[key]) { const c = document.createElement('canvas'); c.width = size; c.height = size; T.drawIcon(c, chassis, path, tier); S.icons[key] = c; }
    const out = document.createElement('canvas'); out.width = size; out.height = size; out.getContext('2d').drawImage(S.icons[key], 0, 0);
    return out;
  }

  /* ================= Session rating ================= */
  function addElo(d, why) {
    const before = rankIndex(S.elo);
    S.elo = Math.max(0, Math.round(S.elo + d));
    const after = rankIndex(S.elo);
    if (after > before) { banner('Rank up: ' + RANKS[after].name + '!', 'good'); Sound.play('rank'); }
  }

  /* ================= Start screen ================= */
  function setupStart() {
    renderBand();
    const picks = $('map-picks'); picks.innerHTML = '';
    B.MAPS.forEach(m => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'map-pick' + (m.id === S.mapId ? ' on' : ''); b.setAttribute('role', 'radio');
      const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180; B.drawMapPreview(cv, m);
      b.appendChild(cv); b.insertAdjacentHTML('beforeend', '<span>' + m.name + '</span>');
      b.title = m.tag;
      b.addEventListener('click', () => { S.mapId = m.id; [...picks.children].forEach(c => c.classList.remove('on')); b.classList.add('on'); });
      picks.appendChild(b);
    });
    const msNote = w => { const m = W.MILESTONES.find(x => x.wave === w); $('ms-note').textContent = w === 1 ? 'The full campaign from the first wave.' : 'Practice mode: starts at wave ' + w + ' (' + W.eraFor(w).name + ') with ' + fmt(m.energy) + ' energy.'; };
    renderSeg($('ms-seg'), W.MILESTONES.map(m => ({ id: m.wave, label: m.label })), S.startWave, v => { S.startWave = v; msNote(v); });
    msNote(S.startWave);
    drawStartArt();
  }

  function renderBand() {
    const cat = S.session.topic.indexOf('cat:') === 0 ? Q.byId[S.session.topic.slice(4)] : null;
    renderSeg($('band-seg'), Q.BANDS.map(b => ({ id: b.id, label: b.name.replace('Grades ', '').replace('Grade ', 'Gr ') })), cat ? null : S.band, v => {
      S.band = v; S.session.topic = 'band:' + v; $('band-note').hidden = true;
    });
    $('band-note').hidden = !cat;
    if (cat) $('band-note').textContent = 'Teacher set the topic: ' + cat.name + ' (' + (cat.grade === '6' ? 'Grade 6' : 'Grades ' + cat.grade) + ').';
  }

  function drawStartArt() {
    const c = $('start-art'), ctx = c.getContext('2d'), G = MD.gfx;
    ctx.clearRect(0, 0, c.width, c.height);
    // felt strip on a paper sheet
    ctx.save(); ctx.translate(20, 40);
    G.box(ctx, 0, 0, 600, 230, 14, '#8DBF6E', 4);
    ctx.lineCap = 'round';
    const path = [[-10, 170], [200, 170], [200, 80], [420, 80], [420, 160], [560, 160]];
    const stroke = (w, col, dash) => { ctx.beginPath(); ctx.moveTo(path[0][0], path[0][1]); path.forEach(p => ctx.lineTo(p[0], p[1])); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]); };
    ctx.save(); ctx.beginPath(); ctx.rect(2, 2, 596, 226); ctx.clip();
    stroke(60, '#1E293B'); stroke(54, '#6B4429'); stroke(46, '#8B5E3C'); stroke(2.5, 'rgba(244,235,221,.0)');
    ctx.restore();
    const towers = [['dart', 'C', 3, 120, 108], ['tesla', 'B', 2, 310, 160], ['mortar', 'A', 3, 300, 40], ['beacon', null, 0, 500, 92]];
    const enemies = [['scout', 60, 170, 0], ['shield', 140, 170, 0], ['swarm', 200, 125, -1.57], ['ironclad', 320, 80, 0]];
    const items = [];
    towers.forEach(t => items.push({ y: t[4], draw: () => T.drawTower(ctx, { x: t[3], y: t[4], chassis: t[0], path: t[1], tier: t[2], angle: -0.3, recoil: 0, pop: 0, heat: 0 }, 0.8) }));
    enemies.forEach(e => { const d = W.ENEMIES[e[0]]; items.push({ y: e[2], draw: () => W.drawEnemy(ctx, { x: e[1], y: e[2], def: d, type: e[0], radius: d.radius, a: e[3], wob: 1, hitT: 0, hp: 1, maxHp: 1, shield: 0, maxShield: 0, id: 3, revealed: true, dist: 0 }, 0.6) }); });
    items.push({ y: 170, draw: () => { ctx.save(); ctx.translate(560, 150); ctx.scale(0.75, 0.75); B.drawCastle(ctx, 0, 0, 0.5, 0); ctx.restore(); } });
    items.sort((a, b) => a.y - b.y).forEach(i => i.draw());
    ctx.restore();
  }

  /* ================= Game start / end ================= */
  function startGame(startWave) {
    if (startWave) S.startWave = startWave;
    S.game = new MD.Engine({ mapId: S.mapId, startWave: S.startWave });
    S.paused = false; S.speed = 1; S.ended = false; S.locked = false; S.jamUntil = 0; S.fast = 0;
    S.ui.selectedPad = -1; S.ui.hoverPad = -1; S.ui.rangeFor = null; S.ui.castleHurt = 0; S.ui.showArrow = true;
    S.hud = {};
    if (S.startWave > 20) S.milestoneShown = true;
    $('btn-speed').textContent = '1× Speed';
    $('intro').hidden = S.startWave > 1;
    $('mb-jam').hidden = true;
    closeMenus(); show('game'); fit(); nextProblem();
    toast(S.startWave > 1 ? 'Practice from wave ' + S.startWave + '. Build up, then send the wave.' : 'Good luck, ' + S.nick + '!');
  }

  function setPaused(v) {
    if (!S.game || S.ended || v === S.paused) return;
    S.paused = v;
    if (v) { S.pausedAt = performance.now(); closeMenus(); }
    else { const gap = performance.now() - S.pausedAt; S.shownAt += gap; if (S.jamUntil) S.jamUntil += gap; }
  }
  function openPause() { if (!S.game || S.ended) return; setPaused(true); renderPauseMs(); openModal('modal-pause'); }
  function resume() { closeModal('modal-pause'); setPaused(false); }
  function renderPauseMs() {
    renderSeg($('pause-ms'), W.MILESTONES.map(m => ({ id: m.wave, label: m.label })), null, v => { closeModal('modal-pause'); startGame(v); });
  }

  function showResults(won) {
    if (S.ended) return;
    S.ended = true;
    const g = S.game, ss = S.session, acc = ss.accuracy();
    $('res-title').textContent = won ? 'Victory!' : 'Clocktower fallen';
    $('res-title').classList.toggle('win', won);
    $('res-sub').textContent = won ? S.nick + ' held all 100 waves. Incredible.' : S.nick + ' reached wave ' + g.wave + ' (' + W.eraFor(Math.max(1, g.wave)).name + ').';
    $('res-grid').innerHTML = [['Waves cleared', g.wavesCleared + '/100'], ['Math accuracy', acc === null ? '—' : Math.round(acc * 100) + '%'], ['Problems solved', ss.correct], ['Best streak', ss.bestStreak]]
      .map(r => '<div class="stat-tile"><span class="eyebrow">' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
    const ri = rankIndex(S.elo);
    $('res-badge').innerHTML = badgeSVG(ri); $('res-elo').textContent = S.elo; $('res-rank').textContent = RANKS[ri].name + ' rank';
    const weak = ss.weakest(3);
    $('res-facts').innerHTML = weak.length ? 'Practice these: ' + weak.map(w => '<b>' + esc(w.text.replace(' = ?', '')) + ' = ' + esc(w.answer) + '</b>').join(' · ') : '';
    openModal('modal-results');
  }

  function backToStart() {
    ['modal-pause', 'modal-results', 'modal-milestone', 'modal-teacher'].forEach(closeModal);
    S.game = null; S.paused = false; setTeacherBtn(false);
    show('start');
  }

  /* ================= Math bar ================= */
  function fastLimit(p) { return p.text.length > 26 ? 11 : p.text.length > 16 ? 8 : 6; }
  function nextProblem() {
    S.problem = S.session.next();
    S.shownAt = performance.now(); S.locked = false;
    const p = S.problem, eq = $('mb-eq');
    eq.textContent = p.text;
    eq.classList.toggle('long', p.text.length > 18 && p.text.length <= 34);
    eq.classList.toggle('xlong', p.text.length > 34);
    eq.classList.remove('pop'); void eq.offsetWidth; eq.classList.add('pop');
    $('mb-topic').textContent = p.catName + ' · ' + (p.grade === '6' ? 'Grade 6' : 'Grades ' + p.grade);
    $('mb-practice').hidden = !p.practice;
    [...$('mb-answers').children].forEach((b, i) => {
      b.classList.remove('right', 'wrong'); b.disabled = false;
      b.querySelector('span').textContent = p.choices[i];
      b.setAttribute('aria-label', 'Answer ' + p.choices[i] + ', key ' + (i + 1));
    });
    updateStreak();
  }
  const multiplier = () => 1 + 0.2 * Math.min(5, S.fast);
  function updateStreak() {
    const m = multiplier(), el = $('mb-mult');
    el.textContent = '×' + m.toFixed(1); el.classList.toggle('hot', m >= 1.6);
    $('mb-streak').textContent = S.fast + ' fast in a row';
  }

  function answer(i) {
    if (!S.game || S.ended || S.paused || S.locked || anyModal() || performance.now() < S.jamUntil) return;
    Sound.unlock();
    const p = S.problem, ok = p.choices[i] === p.answer, btn = $('mb-answers').children[i];
    const secs = (performance.now() - S.shownAt) / 1000, fast = secs <= fastLimit(p);
    S.locked = true;
    S.session.record(p, ok);
    if (ok) {
      const base = Math.round(W.answerEnergy(Math.max(1, S.game.wave)) * multiplier());
      const total = S.game.addMathEnergy(base);
      S.fast = fast ? S.fast + 1 : 0;
      addElo(fast ? 2 : 1);
      btn.classList.add('right'); Sound.play('correct');
      flyText(btn, '+' + total); bump('pill-energy');
      setTimeout(nextProblem, 260);
    } else {
      S.fast = 0; addElo(-2);
      btn.classList.add('wrong'); Sound.play('wrong');
      S.jamUntil = performance.now() + JAM_MS;
      [...$('mb-answers').children].forEach(b => { b.disabled = true; });
      $('mb-jam').hidden = false;
      $('mb-jam').textContent = 'Jammed!  ' + p.text.replace(' = ?', '').replace('?', '_') + '  →  ' + p.answer;
    }
    updateStreak();
    if (!$('modal-teacher').hidden) renderTeacher();
  }
  function flyText(el, text) {
    const r = el.getBoundingClientRect(), f = document.createElement('div');
    f.className = 'fly'; f.textContent = text; f.style.left = (r.left + r.width / 2 - 20) + 'px'; f.style.top = (r.top - 10) + 'px';
    document.body.appendChild(f); setTimeout(() => f.remove(), 820);
  }

  /* ================= Build & tower menus ================= */
  function closeMenus() {
    $('build-menu').hidden = true; $('tower-menu').hidden = true;
    S.ui.selectedPad = -1; S.ui.rangeFor = null;
    if (S.game && S.game.state === 'ready' && S.startWave === 1) $('intro').hidden = false;
  }
  function place(menu, pad) {
    const st = $('stage'), c = $('game'), p = S.game.map.pads[pad];
    $('intro').hidden = true; menu.hidden = false;
    const px = c.offsetLeft + 4 + p[0] * S.scale, py = c.offsetTop + 4 + p[1] * S.scale;
    const w = menu.offsetWidth, h = menu.offsetHeight;
    let x = px - w / 2, y = py - h - 44 * S.scale;
    if (y < 6) y = py + 36 * S.scale;
    x = Math.max(6, Math.min(st.clientWidth - w - 6, x)); y = Math.max(6, Math.min(st.clientHeight - h - 6, y));
    menu.style.left = x + 'px'; menu.style.top = y + 'px';
  }

  function openBuild(pad) {
    closeMenus(); S.ui.selectedPad = pad;
    const m = $('build-menu'), g = S.game, p = g.map.pads[pad];
    m.innerHTML = '';
    T.CHASSIS.forEach(ch => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'menu-opt'; b.dataset.cost = ch.cost; b.title = ch.name + ': ' + ch.blurb;
      b.appendChild(icon(ch.id, null, 0, 112));
      b.insertAdjacentHTML('beforeend', '<span class="mo-name">' + ch.short + '</span><span class="mo-cost"><svg class="ico"><use href="#i-bolt"/></svg>' + ch.cost + '</span>');
      const tip = () => { $('bm-tip').textContent = ch.name + ': ' + ch.blurb; S.ui.rangeFor = ch.range ? { x: p[0], y: p[1], r: ch.range } : null; };
      b.addEventListener('mouseenter', tip); b.addEventListener('focus', tip);
      b.addEventListener('mouseleave', () => { S.ui.rangeFor = null; });
      b.addEventListener('click', ev => {
        ev.stopPropagation();
        if (g.energy < ch.cost) { toast('Need ' + Math.ceil(ch.cost - g.energy) + ' more energy. Solve a problem!'); return; }
        if (g.build(pad, ch.id)) closeMenus();
      });
      m.appendChild(b);
    });
    m.insertAdjacentHTML('beforeend', '<div class="bm-tip" id="bm-tip">Pick a tower. Hover to see what it does.</div>');
    refreshLocks(); place(m, pad);
  }

  function statHTML(s) { return T.describe(s).map(r => '<span>' + r[0] + ' <b>' + r[1] + '</b></span>').join(''); }

  function openTower(t) {
    closeMenus(); S.ui.selectedPad = t.pad;
    const g = S.game, s = t.stats, m = $('tower-menu');
    S.ui.rangeFor = s.range ? { x: t.x, y: t.y, r: s.range } : null;
    m.innerHTML = '';
    const head = document.createElement('div'); head.className = 'tm-head';
    head.appendChild(icon(t.chassis, t.path, t.tier, 108));
    head.insertAdjacentHTML('beforeend', '<div><div class="tm-sub">' + (t.tier ? 'Path ' + t.path + ' · ' + T.PATHS[t.path].name + ' · Tier ' + t.tier + '/3' : 'Base chassis · pick a path') + '</div><div class="tm-title">' + esc(s.name) + '</div></div>');
    m.appendChild(head);
    m.insertAdjacentHTML('beforeend', '<div class="stat-rows">' + statHTML(s) + '</div>');
    const opts = g.upgradeOptions(t);
    opts.forEach(o => {
      const P = T.PATHS[o.path], b = document.createElement('button');
      b.type = 'button'; b.className = 'path-opt'; b.dataset.cost = o.cost;
      b.innerHTML = '<span class="po-letter" style="background:' + P.color + '">' + o.path + '</span>';
      b.appendChild(icon(t.chassis, o.path, o.tier, 88));
      b.insertAdjacentHTML('beforeend', '<span><span class="po-name">' + esc(o.name) + '</span><br><span class="po-path">' + P.name + ' · Tier ' + o.tier + '</span></span><span class="po-cost"><svg class="ico"><use href="#i-bolt"/></svg>' + fmt(o.cost) + '</span>');
      const next = T.stats(t.chassis, o.path, o.tier);
      b.title = T.describe(next).map(r => r[0] + ': ' + r[1]).join(' · ');
      b.addEventListener('mouseenter', () => { if (next.range) S.ui.rangeFor = { x: t.x, y: t.y, r: next.range }; });
      b.addEventListener('mouseleave', () => { S.ui.rangeFor = s.range ? { x: t.x, y: t.y, r: s.range } : null; });
      b.addEventListener('click', ev => {
        ev.stopPropagation();
        if (g.energy < o.cost) { toast('Need ' + fmt(o.cost - g.energy) + ' more energy'); return; }
        if (g.upgrade(t, o.path)) { toast(o.name + ' ready!'); openTower(t); }
      });
      m.appendChild(b);
    });
    if (!opts.length) m.insertAdjacentHTML('beforeend', '<div class="note">Fully evolved. Find all 108 in the Almanac.</div>');
    const sb = document.createElement('button');
    sb.type = 'button'; sb.className = 'btn btn-paper btn-sm';
    sb.innerHTML = 'Sell for <svg class="ico"><use href="#i-bolt"/></svg>' + fmt(g.sellValue(t));
    sb.addEventListener('click', ev => { ev.stopPropagation(); g.sell(t); closeMenus(); });
    m.appendChild(sb);
    refreshLocks(); place(m, t.pad);
  }

  function refreshLocks() {
    if (!S.game) return;
    const e = S.game.energy;
    if (!$('build-menu').hidden) [...$('build-menu').querySelectorAll('.menu-opt')].forEach(b => b.classList.toggle('locked', e < +b.dataset.cost));
    if (!$('tower-menu').hidden) [...$('tower-menu').querySelectorAll('.path-opt')].forEach(b => b.classList.toggle('locked', e < +b.dataset.cost));
  }

  /* ================= Canvas input ================= */
  function toLogical(ev) { const r = $('game').getBoundingClientRect(); return { x: (ev.clientX - r.left - 4) / (r.width - 8) * MD.VIEW.w, y: (ev.clientY - r.top - 4) / (r.height - 8) * MD.VIEW.h }; }
  function padAt(pt) {
    const pads = S.game.map.pads;
    for (let i = 0; i < pads.length; i++) {
      const dx = pt.x - pads[i][0], dy = pt.y - pads[i][1];
      if (S.game.towerAt(i)) { if (Math.abs(dx) < 34 && dy > -78 && dy < 28) return i; }
      else if ((dx * dx) / (36 * 36) + (dy * dy) / (28 * 28) <= 1) return i;
    }
    return -1;
  }
  function onCanvasClick(ev) {
    if (!S.game || S.ended || S.paused) return;
    Sound.unlock();
    const i = padAt(toLogical(ev));
    if (i < 0 || i === S.ui.selectedPad) { closeMenus(); return; }
    Sound.play('click');
    const t = S.game.towerAt(i);
    if (t) openTower(t); else openBuild(i);
  }

  /* ================= HUD ================= */
  function setText(id, v) { if (S.hud[id] !== v) { S.hud[id] = v; $(id).textContent = v; } }
  function updateHUD() {
    const g = S.game; if (!g) return;
    setText('hud-wave', String(g.wave));
    setText('hud-era', W.eraFor(Math.max(1, g.wave + (g.state === 'ready' ? 1 : 0))).name);
    setText('hud-hearts', String(g.hearts));
    setText('hud-energy', fmt(g.energy));
    setText('hud-elo', String(S.elo));
    const ri = rankIndex(S.elo);
    if (S.hud.rank !== ri) { S.hud.rank = ri; $('hud-badge').innerHTML = badgeSVG(ri); $('pill-elo').title = 'Session rating · ' + RANKS[ri].name; }
    const wb = $('btn-wave'), can = g.canCallWave();
    let label;
    if (g.state === 'ready') label = 'Start Wave ' + (g.wave + 1);
    else if (g.wave >= g.totalWaves) label = 'Final wave';
    else if (!can) label = 'Wave ' + g.wave + ' incoming';
    else { const b = g.earlyBonus(); label = 'Next wave' + (b ? ' +' + fmt(b) : '') + (g.nextWaveTimer !== null ? ' · ' + Math.ceil(g.nextWaveTimer) + 's' : ''); }
    setText('btn-wave', label);
    if (S.hud.can !== can) { S.hud.can = can; wb.disabled = !can; }
    wb.classList.toggle('ready', g.state === 'ready' && g.towers.length > 0);
    const ef = Math.floor(g.energy);
    if (S.hud.lock !== ef) { S.hud.lock = ef; refreshLocks(); }

    const now = performance.now();
    if (now >= S.jamUntil && !$('mb-jam').hidden) { $('mb-jam').hidden = true; nextProblem(); }
    const lim = S.problem ? fastLimit(S.problem) : 6;
    const left = S.paused ? 1 : Math.max(0, 1 - (now - S.shownAt) / 1000 / lim);
    const f = $('mb-timer-fill');
    f.style.transform = 'scaleX(' + left.toFixed(3) + ')';
    f.style.background = left > 0.4 ? '#3F7D4E' : left > 0 ? '#D4A72C' : '#CBD5E1';
  }

  function banner(text, cls) { const b = $('banner'); b.className = 'banner'; void b.offsetWidth; b.textContent = text; b.className = 'banner show' + (cls ? ' ' + cls : ''); }

  function drainEvents() {
    const g = S.game;
    for (const e of g.events) {
      switch (e.type) {
        case 'wave': banner('Wave ' + e.data); Sound.play('wave'); $('intro').hidden = true; S.ui.showArrow = false;
          if (e.data === 25 || e.data === 50 || e.data === 75) setTimeout(() => banner(W.eraFor(e.data).name, 'boss'), 1900);
          break;
        case 'bosswave': banner(e.data >= 75 && e.data % 10 ? 'Mega-Dreadnought!' : 'Boss wave ' + e.data + '!', 'boss'); Sound.play('boss'); $('intro').hidden = true; S.ui.showArrow = false; break;
        case 'waveclear': {
          const n = e.data.wave, acc = S.session.accuracy();
          addElo(Math.round((3 + n * 0.12) * (acc !== null && acc >= 0.85 ? 1.5 : 1)));
          if (n === 20 && !S.milestoneShown) { S.milestoneShown = true; setTimeout(showMilestone, 900); }
          break;
        }
        case 'leak': S.ui.castleHurt = 1; bump('pill-hearts', 'hurt'); Sound.play('leak'); addElo(-e.data); break;
        case 'build': Sound.play('build'); break;
        case 'upgrade': Sound.play('upgrade'); break;
        case 'sell': Sound.play('sell'); break;
        case 'shoot': Sound.play(e.data); break;
        case 'boom': Sound.play('boom'); break;
        case 'bosskill': banner(e.data + ' down!', 'good'); addElo(10); break;
        case 'won': Sound.play('won'); banner('Victory!', 'good'); setTimeout(() => showResults(true), 1400); break;
        case 'lost': Sound.play('lost'); setTimeout(() => showResults(false), 1200); break;
      }
    }
    g.events.length = 0;
  }

  /* ================= Milestone ================= */
  function showMilestone() {
    if (!S.game || S.ended) return;
    setPaused(true);
    const ss = S.session, acc = ss.accuracy();
    $('ms-text').textContent = 'Your clockwork defense held for 20 waves, ' + S.nick + '. Waves 25 and up bring armor, camo and shields.';
    $('ms-stats').innerHTML = [['Waves cleared', '20'], ['Math accuracy', acc === null ? '—' : Math.round(acc * 100) + '%'], ['Problems solved', ss.correct], ['Session rating', S.elo + ' · ' + RANKS[rankIndex(S.elo)].name], ['Towers built', S.game.stats.built], ['Best streak', ss.bestStreak]]
      .map(r => '<div class="stat-tile"><span class="eyebrow">' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
    $('acc-name').value = S.nick;
    $('acc-class').value = S.teacher.classCode;
    openModal('modal-milestone');
    Sound.play('won');
  }

  /* ================= Teacher view ================= */
  function setTeacherBtn(on) {
    $('btn-teacher').setAttribute('aria-pressed', String(on));
    $('mode-student').classList.toggle('on', !on); $('mode-student').setAttribute('aria-pressed', String(!on));
    $('mode-teacher').classList.toggle('on', on); $('mode-teacher').setAttribute('aria-pressed', String(on));
  }
  /* Teacher PIN: set on first use this session, asked every time Teacher Mode opens. */
  let pinStep = 'enter', pinFirst = '';
  function makeCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = '';
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
  function requestTeacher() {
    if (!$('modal-teacher').hidden || !$('modal-pin').hidden) return;
    S.teacherPaused = !!S.game && !S.ended && !S.paused && $('screen-game').classList.contains('active');
    if (S.game) { setPaused(true); closeMenus(); }
    setTeacherBtn(true);
    pinStep = S.teacher.pin ? 'enter' : 'create'; pinFirst = '';
    $('pin-title').textContent = pinStep === 'create' ? 'Create a teacher PIN' : 'Teacher PIN';
    $('pin-text').textContent = pinStep === 'create'
      ? 'Choose a 4–6 digit PIN. It keeps students out of Teacher Mode until this tab closes.'
      : 'Enter your PIN to open Teacher Mode.';
    $('pin-input').value = ''; $('pin-error').textContent = '';
    openModal('modal-pin');
    setTimeout(() => { try { $('pin-input').focus(); } catch (e) { } }, 40);
  }
  function cancelPin() {
    closeModal('modal-pin'); setTeacherBtn(false);
    if (S.teacherPaused) setPaused(false);
    S.teacherPaused = false;
  }
  function submitPin(e) {
    e.preventDefault();
    const v = $('pin-input').value.trim();
    if (!/^\d{4,6}$/.test(v)) { $('pin-error').textContent = 'Use 4 to 6 digits.'; return; }
    if (pinStep === 'create') {
      if (!pinFirst) { pinFirst = v; $('pin-input').value = ''; $('pin-text').textContent = 'Type the same PIN again to confirm.'; $('pin-error').textContent = ''; return; }
      if (v !== pinFirst) { pinFirst = ''; $('pin-input').value = ''; $('pin-text').textContent = 'Choose a 4–6 digit PIN.'; $('pin-error').textContent = 'The PINs did not match. Try again.'; return; }
      S.teacher.pin = v;
      toast('Teacher PIN set for this session');
    } else if (v !== S.teacher.pin) { $('pin-error').textContent = 'That PIN is not right.'; $('pin-input').value = ''; return; }
    closeModal('modal-pin');
    openTeacher();
  }

  function exportCSV() {
    const ss = S.session, acc = ss.accuracy(), g = S.game;
    const topic = ss.topic.indexOf('cat:') === 0 ? Q.byId[ss.topic.slice(4)].name : 'Mixed ' + (Q.BANDS.find(b => 'band:' + b.id === ss.topic) || Q.BANDS[0]).name;
    const rows = [
      ['Math Defenders session report'],
      ['Student', S.nick || '(not started)'], ['Class code', S.teacher.classCode], ['Date', new Date().toLocaleString('en-US')],
      ['Map', g ? g.map.name : ''], ['Wave reached', g ? g.wave : 0], ['Waves cleared', g ? g.wavesCleared : 0],
      ['Session rating', S.elo], ['Rank', RANKS[rankIndex(S.elo)].name], ['Active topic', topic],
      ['Problems answered', ss.answered], ['Problems correct', ss.correct], ['Math accuracy %', acc === null ? '' : Math.round(acc * 100)],
      ['Current streak', ss.streak], ['Best streak', ss.bestStreak],
      [], ['Topic', 'Grade', 'Answered', 'Correct', 'Accuracy %']
    ];
    Q.CATS.filter(c => ss.byCat[c.id]).forEach(c => { const st = ss.byCat[c.id]; rows.push([c.name, c.grade, st.a, st.c, Math.round(st.c / st.a * 100)]); });
    rows.push([], ['Weakest math facts', 'Correct answer', 'Right', 'Tries']);
    ss.weakest(20).forEach(w => rows.push([w.text.replace(' = ?', ''), w.answer, w.c, w.a]));
    const csv = rows.map(r => r.map(v => { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\r\n');
    try {
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'math-defenders-' + (S.nick || 'session').replace(/[^\w-]+/g, '-').toLowerCase() + '-' + (d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))(new Date()) + '.csv';
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      toast('Report downloaded');
    } catch (err) { toast('This browser could not create the file'); }
  }

  function openTeacher() {
    setTeacherBtn(true);
    $('t-code').textContent = S.teacher.classCode;
    const sel = $('t-topic'); sel.innerHTML = '';
    const og = document.createElement('optgroup'); og.label = 'Mixed by grade';
    Q.BANDS.forEach(b => { const o = new Option('Mixed: ' + b.name, 'band:' + b.id); og.appendChild(o); });
    sel.appendChild(og);
    Q.BANDS.forEach(b => {
      const g = document.createElement('optgroup'); g.label = b.name;
      Q.CATS.filter(c => c.grade === b.grade).forEach(c => g.appendChild(new Option(c.name, 'cat:' + c.id)));
      sel.appendChild(g);
    });
    sel.value = S.session.topic;
    renderTeacher();
    openModal('modal-teacher');
  }
  function closeTeacher() {
    closeModal('modal-teacher'); setTeacherBtn(false); closeModal('modal-pin');
    if (S.teacherPaused) setPaused(false);
    S.teacherPaused = false;
    if (!S.game) renderBand();
  }
  function renderTeacher() {
    const ss = S.session, acc = ss.accuracy(), ri = rankIndex(S.elo);
    const inGame = !!S.game && $('screen-game').classList.contains('active');
    $('t-title').textContent = inGame ? (S.nick || 'Student') + ' · Wave ' + S.game.wave : (ss.answered ? 'This session so far' : 'Before the game starts');
    $('t-note').textContent = inGame ? 'The game is paused while this view is open. Everything here disappears when the tab closes.'
      : 'Pick the math topic before your student starts. Live stats appear here once they answer. Nothing is saved after the tab closes.';
    $('t-close').textContent = inGame ? 'Back to game' : 'Back to start';
    $('t-tiles').innerHTML =
      '<div class="t-tile"><span class="eyebrow">Live accuracy</span><b>' + (acc === null ? '—' : Math.round(acc * 100) + '%') + '</b></div>' +
      '<div class="t-tile"><span class="eyebrow">Current streak</span><b>' + ss.streak + '</b></div>' +
      '<div class="t-tile"><span class="eyebrow">Problems answered</span><b>' + ss.answered + ' <span class="note">(' + ss.correct + ' right)</span></b></div>' +
      '<div class="t-tile"><span class="eyebrow">Best streak</span><b>' + ss.bestStreak + '</b></div>' +
      '<div class="t-tile" style="grid-column:1/-1"><span class="eyebrow">Session rating</span><div class="rank"><span class="badge-md">' + badgeSVG(ri) + '</span><b>' + S.elo + ' · ' + RANKS[ri].name + '</b></div></div>';
    const rows = Q.CATS.filter(c => ss.byCat[c.id]).map(c => {
      const st = ss.byCat[c.id], a = st.c / st.a, col = a >= 0.85 ? '#3F7D4E' : a >= 0.65 ? '#D4A72C' : '#DC2626';
      return '<tr><td>' + c.name + '</td><td>' + c.grade + '</td><td class="num">' + st.a + '</td><td class="num">' + Math.round(a * 100) + '%<span class="acc-bar"><i style="width:' + Math.round(a * 100) + '%;background:' + col + '"></i></span></td></tr>';
    });
    $('t-cats').innerHTML = rows.length ? rows.join('') : '<tr><td colspan="4" class="empty">No answers yet this session.</td></tr>';
    const weak = ss.weakest(8);
    $('t-weak').innerHTML = weak.length ? weak.map(w => '<span class="chip" title="' + w.c + ' of ' + w.a + ' right">' + esc(w.text.replace(' = ?', '')) + ' = ' + esc(w.answer) + ' · ' + w.c + '/' + w.a + '</span>').join('') : '<span class="empty">Nothing missed yet.</span>';
    $('t-queue').innerHTML = ss.requeue.length ? ss.requeue.map(r => '<span class="chip blue">' + Q.byId[r.cat].name + ' · missed ' + r.misses + '×</span>').join('') : '<span class="empty">No re-practice needed right now.</span>';
  }

  /* ================= Almanac ================= */
  const FIRST_WAVE = { scout: 1, shield: 3, swarm: 4, boss: 10, ironclad: 25, phantom: 25, warden: 25, elite: 50, dread: 75 };
  function openAlmanac() {
    if (S.game && !S.ended) { S.almPaused = !S.paused; setPaused(true); closeMenus(); }
    renderAlmTab(); openModal('modal-almanac');
  }
  function closeAlmanac() { closeModal('modal-almanac'); if (S.almPaused) setPaused(false); S.almPaused = false; }
  function renderAlmTab() {
    const towers = S.alm.tab === 'towers';
    $('alm-towers').hidden = !towers; $('alm-enemies').hidden = towers;
    $('alm-tab-towers').classList.toggle('on', towers); $('alm-tab-towers').setAttribute('aria-selected', String(towers));
    $('alm-tab-enemies').classList.toggle('on', !towers); $('alm-tab-enemies').setAttribute('aria-selected', String(!towers));
    if (towers) renderAlmanac(); else renderEnemies();
  }
  function renderAlmanac() {
    const list = $('alm-list');
    if (!list.children.length) {
      T.CHASSIS.forEach(ch => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'alm-item'; b.dataset.id = ch.id; b.setAttribute('role', 'option');
        b.appendChild(icon(ch.id, null, 0, 80)); b.insertAdjacentHTML('beforeend', '<span>' + ch.name + '</span>');
        b.addEventListener('click', () => { S.alm.chassis = ch.id; S.alm.path = 'A'; S.alm.tier = 1; renderAlmanac(); });
        list.appendChild(b);
      });
    }
    [...list.children].forEach(b => { const on = b.dataset.id === S.alm.chassis; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    const ch = T.byId[S.alm.chassis], idx = T.CHASSIS.indexOf(ch);
    T.drawIcon($('alm-base'), ch.id, null, 0);
    $('alm-count').textContent = 'Chassis ' + (idx + 1) + ' of 12 · base cost ' + ch.cost;
    $('alm-name').textContent = ch.name; $('alm-blurb').textContent = ch.blurb;
    $('alm-base-stats').innerHTML = statHTML(T.stats(ch.id, null, 0));
    const grid = $('alm-grid'); grid.innerHTML = '';
    ['A', 'B', 'C'].forEach(p => {
      const P = T.PATHS[p];
      grid.insertAdjacentHTML('beforeend', '<div class="alm-path" style="background:' + P.color + '"><b>' + p + '</b>' + P.name + '</div>');
      [1, 2, 3].forEach(t => {
        const b = document.createElement('button'); b.type = 'button';
        b.className = 'evo' + (S.alm.path === p && S.alm.tier === t ? ' on' : '');
        b.appendChild(icon(ch.id, p, t, 152));
        b.insertAdjacentHTML('beforeend', '<span class="ev-name">' + esc(T.NAMES[ch.id][p][t - 1]) + '</span><span class="ev-tier">Tier ' + t + ' · ' + fmt(T.cost(ch, p, t)) + '</span>');
        b.addEventListener('click', () => { S.alm.path = p; S.alm.tier = t; renderAlmanac(); });
        grid.appendChild(b);
      });
    });
    const s = T.stats(ch.id, S.alm.path, S.alm.tier), det = $('alm-detail');
    det.innerHTML = '';
    det.appendChild(icon(ch.id, S.alm.path, S.alm.tier, 300));
    det.insertAdjacentHTML('beforeend', '<div class="eyebrow" style="color:' + T.PATHS[S.alm.path].color + '">Path ' + S.alm.path + ' · ' + T.PATHS[S.alm.path].name + ' · Tier ' + S.alm.tier + '</div><h3>' + esc(s.name) + '</h3><div class="note">Upgrade cost ' + fmt(T.cost(ch, S.alm.path, S.alm.tier)) + ' · total ' + fmt(s.spent) + '</div><div class="stat-rows">' + statHTML(s) + '</div><div class="note">Evolution ' + (idx * 9 + ['A', 'B', 'C'].indexOf(S.alm.path) * 3 + S.alm.tier) + ' of 108</div>');
  }
  function renderEnemies() {
    const g = $('alm-enemies'); if (g.children.length) return;
    Object.keys(W.ENEMIES).forEach(k => {
      const d = W.ENEMIES[k], card = document.createElement('div'); card.className = 'enemy-card';
      const cv = document.createElement('canvas'); cv.width = 144; cv.height = 144; W.drawEnemyIcon(cv, k);
      card.appendChild(cv);
      card.insertAdjacentHTML('beforeend', '<div><span class="from">From wave ' + FIRST_WAVE[k] + '</span><b>' + d.name + '</b><span class="note">' + d.blurb + '</span></div>');
      g.appendChild(card);
    });
  }

  /* ================= Sizing & loop ================= */
  function fit() {
    const st = $('stage'), c = $('game');
    if (!st.clientWidth) return;
    const aw = st.clientWidth - 12 - 8, ah = st.clientHeight - 12 - 8;
    const sc = Math.max(0.2, Math.min(aw / MD.VIEW.w, ah / MD.VIEW.h));
    const w = Math.floor(MD.VIEW.w * sc), h = Math.floor(MD.VIEW.h * sc), dpr = Math.min(2, window.devicePixelRatio || 1);
    c.style.width = (w + 8) + 'px'; c.style.height = (h + 8) + 'px';
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    S.scale = sc;
    if (!$('build-menu').hidden || !$('tower-menu').hidden) closeMenus();
  }

  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    if (!S.game || !$('screen-game').classList.contains('active')) return;
    try {
      const g = S.game;
      if (!S.paused) {
        for (let k = 0; k < S.speed; k++) g.update(dt);
        S.ui.time += dt; S.ui.castleHurt = Math.max(0, S.ui.castleHurt - dt * 2.5);
      }
      drainEvents();
      const c = $('game'), ctx = c.getContext('2d'), s = c.width / MD.VIEW.w;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      B.drawScene(ctx, g, S.ui);
      updateHUD();
    } catch (err) {
      if (S.errors++ < 5 && window.console) console.error('Math Defenders frame error:', err);
    }
  }

  /* ================= Wiring ================= */
  function wire() {
    $('start-form').addEventListener('submit', e => {
      e.preventDefault();
      const n = $('nick').value.trim();
      if (!n) { $('nick').focus(); toast('Type a nickname to start'); return; }
      S.nick = n.slice(0, 18);
      if (S.session.topic.indexOf('band:') === 0) S.session.topic = 'band:' + S.band;
      Sound.unlock(); startGame();
    });
    $('btn-almanac-start').addEventListener('click', openAlmanac);
    $('btn-almanac').addEventListener('click', openAlmanac);
    $('alm-close').addEventListener('click', closeAlmanac);
    $('alm-tab-towers').addEventListener('click', () => { S.alm.tab = 'towers'; renderAlmTab(); });
    $('alm-tab-enemies').addEventListener('click', () => { S.alm.tab = 'enemies'; renderAlmTab(); });

    $('game').addEventListener('click', onCanvasClick);
    $('game').addEventListener('mousemove', ev => { if (!S.game) return; const i = padAt(toLogical(ev)); S.ui.hoverPad = i; $('game').style.cursor = i >= 0 ? 'pointer' : 'default'; });
    $('game').addEventListener('mouseleave', () => { S.ui.hoverPad = -1; });
    $('stage').addEventListener('click', e => { if (e.target === $('stage')) closeMenus(); });
    $('btn-wave').addEventListener('click', () => { if (S.game && !S.paused && S.game.callWave()) closeMenus(); });
    $('btn-speed').addEventListener('click', () => { S.speed = S.speed === 3 ? 1 : S.speed + 1; $('btn-speed').textContent = S.speed + '× Speed'; });
    $('btn-pause').addEventListener('click', openPause);
    $('pause-resume').addEventListener('click', resume);
    $('pause-restart').addEventListener('click', () => { closeModal('modal-pause'); startGame(); });
    $('pause-quit').addEventListener('click', backToStart);
    $('btn-sound').addEventListener('click', () => {
      S.muted = !S.muted;
      $('btn-sound').innerHTML = '<svg class="ico"><use href="#i-' + (S.muted ? 'mute' : 'sound') + '"/></svg><span>' + (S.muted ? 'Sound off' : 'Sound on') + '</span>';
      Sound.play('click');
    });
    $('btn-teacher').addEventListener('click', () => { if ($('modal-teacher').hidden) requestTeacher(); else closeTeacher(); });
    $('pin-form').addEventListener('submit', submitPin);
    $('pin-cancel').addEventListener('click', cancelPin);
    $('t-csv').addEventListener('click', exportCSV);
    $('t-newcode').addEventListener('click', () => { S.teacher.classCode = makeCode(); $('t-code').textContent = S.teacher.classCode; toast('New class code: ' + S.teacher.classCode); });
    $('t-copycode').addEventListener('click', () => {
      const code = S.teacher.classCode;
      const done = () => toast('Copied ' + code);
      try { navigator.clipboard.writeText(code).then(done, () => toast('Class code: ' + code)); } catch (err) { toast('Class code: ' + code); }
    });
    $('t-close').addEventListener('click', closeTeacher);
    $('mode-teacher').addEventListener('click', () => { if ($('modal-teacher').hidden) requestTeacher(); });
    $('mode-student').addEventListener('click', () => { if (!$('modal-teacher').hidden) closeTeacher(); else if (!$('modal-pin').hidden) cancelPin(); });
    $('t-topic').addEventListener('change', e => {
      S.session.topic = e.target.value;
      if (e.target.value.indexOf('band:') === 0) S.band = e.target.value.slice(5);
      if (S.game && !S.locked && performance.now() >= S.jamUntil) nextProblem();
      renderTeacher();
      toast('Topic set: ' + e.target.selectedOptions[0].textContent);
    });
    $('ms-continue').addEventListener('click', () => { closeModal('modal-milestone'); setPaused(false); });
    $('res-start').addEventListener('click', backToStart);
    $('res-again').addEventListener('click', () => { closeModal('modal-results'); startGame(); });
    [...$('mb-answers').children].forEach(b => b.addEventListener('click', () => answer(+b.dataset.i)));

    document.addEventListener('keydown', e => {
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === 'Escape') {
        if (!$('modal-almanac').hidden) return closeAlmanac();
        if (!$('modal-pin').hidden) return cancelPin();
        if (!$('modal-teacher').hidden) return closeTeacher();
        if (!$('modal-pause').hidden) return resume();
      }
      const inGame = $('screen-game').classList.contains('active') && S.game;
      if (!inGame) return;
      if (e.key === '1' || e.key === '2' || e.key === '3') { e.preventDefault(); answer(+e.key - 1); }
      else if (e.key === 'Escape') { if (!$('build-menu').hidden || !$('tower-menu').hidden) closeMenus(); else if (!anyModal()) openPause(); }
      else if ((e.key === 'f' || e.key === 'F') && !anyModal()) $('btn-speed').click();
      else if ((e.key === 'p' || e.key === 'P') && !anyModal()) openPause();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && S.game && !S.ended && S.game.state === 'playing' && !anyModal()) openPause(); });
    if (window.ResizeObserver) new ResizeObserver(() => { if (S.game) fit(); }).observe($('stage'));
    else window.addEventListener('resize', () => { if (S.game) fit(); });
  }

  function boot() {
    S.teacher.classCode = makeCode();
    wire(); setupStart();
    requestAnimationFrame(frame);
    MD.debug = S;   // handy in the console; still memory-only
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(globalThis.MD = globalThis.MD || {});
