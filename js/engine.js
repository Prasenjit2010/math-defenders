/* Math Defenders — engine.js
   Maps, the game simulation (all 12 tower attack kinds, enemy statuses,
   camo, shields, armor, regeneration) and the board renderer.
   The Engine class has no DOM access, so it runs headless in Node. */
(function (MD) {
  'use strict';
  const T = MD.Towers, W = MD.Waves;
  const G = MD.gfx;
  const { INK, TAU, PAL } = G;

  const VIEW = { w: 1280, h: 720 };
  const MAX_ENEMIES = 240, MAX_FX = 160, MAX_POPUPS = 40, MAX_PUDDLES = 30, MAX_SHOTS = 320;

  /* ===================== Maps ===================== */
  const MAPS = [
    { id: 'meadow', name: 'Felt Meadow', tag: 'Gentle bends across green paper', stars: 1,
      theme: { ground: '#8DBF6E', ground2: '#76AD58', fleck: '#5E9444', felt: '#8B5E3C', feltD: '#6B4429', stitch: '#F4EBDD', deco: 'meadow' },
      path: [[-40, 150], [280, 150], [280, 450], [560, 450], [560, 190], [860, 190], [860, 520], [1150, 520]], castle: [1196, 506] },
    { id: 'canyon', name: 'Cardboard Canyon', tag: 'Long switchbacks through kraft hills', stars: 2,
      theme: { ground: '#DDB989', ground2: '#CFA772', fleck: '#B88A52', felt: '#9F3A2F', feltD: '#7A2A22', stitch: '#FDE68A', deco: 'canyon' },
      path: [[-40, 600], [220, 600], [220, 140], [480, 140], [480, 580], [760, 580], [760, 140], [1040, 140], [1040, 420], [1150, 420]], castle: [1196, 406] },
    { id: 'spiral', name: 'Clocktower Spiral', tag: 'A winding climb to the clock', stars: 3,
      theme: { ground: '#B7C7D3', ground2: '#A3B6C4', fleck: '#8197A8', felt: '#3B4A6B', feltD: '#283450', stitch: '#F5D77A', deco: 'spiral' },
      path: [[-40, 360], [200, 360], [200, 100], [1080, 100], [1080, 620], [400, 620], [400, 330], [820, 330], [820, 452]], castle: [820, 498] }
  ];

  function distToPath(path, x, y) {
    let best = 1e9;
    for (let i = 0; i < path.length - 1; i++) {
      const ax = path[i][0], ay = path[i][1], bx = path[i + 1][0], by = path[i + 1][1];
      const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L));
      const qx = ax + dx * t - x, qy = ay + dy * t - y;
      best = Math.min(best, Math.sqrt(qx * qx + qy * qy));
    }
    return best;
  }

  /* Build pads automatically: spots near the path, spread out, best coverage first. */
  function makePads(map) {
    const cands = [];
    for (let x = 48; x <= 1232; x += 16) for (let y = 50; y <= 680; y += 16) {
      const d = distToPath(map.path, x, y);
      if (d < 66 || d > 120) continue;
      if (Math.hypot(x - map.castle[0], y - map.castle[1]) < 100) continue;
      let cov = 0;
      for (let i = 0; i < map.path.length - 1; i++) {
        const a = map.path[i], b = map.path[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let s = 0; s <= len; s += 20) { const px = a[0] + (b[0] - a[0]) * s / len, py = a[1] + (b[1] - a[1]) * s / len; if (px > -20 && Math.hypot(px - x, py - y) < 150) cov++; }
      }
      cands.push({ x, y, cov });
    }
    cands.sort((a, b) => b.cov - a.cov || a.x - b.x || a.y - b.y);
    const pads = [];
    for (const c of cands) {
      if (pads.length >= 18) break;
      if (pads.every(p => Math.hypot(p[0] - c.x, p[1] - c.y) >= 84)) pads.push([c.x, c.y]);
    }
    pads.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return pads;
  }
  MAPS.forEach(m => { m.pads = makePads(m); });
  const mapById = id => MAPS.find(m => m.id === id) || MAPS[0];

  /* ===================== Engine ===================== */
  class Engine {
    constructor(opts) {
      this.map = mapById(opts.mapId);
      const ms = W.MILESTONES.find(m => m.wave === (opts.startWave || 1)) || W.MILESTONES[0];
      this.startWave = ms.wave;
      this.wave = ms.wave - 1;
      this.wavesCleared = ms.wave - 1;
      this.energy = ms.energy;
      this.hearts = 20; this.maxHearts = 20;
      this.totalWaves = W.TOTAL;
      this.buildPath();
      this.queue = []; this.waveLeft = {}; this.waveSpawning = {};
      this.nextWaveTimer = null; this.waveGap = 12;
      this.enemies = []; this.towers = []; this.shots = []; this.fx = []; this.popups = []; this.puddles = [];
      this.time = 0; this.state = 'ready'; this.events = [];
      this.stats = { kills: 0, leaks: 0, built: 0, energyFromMath: 0, energyFromBounty: 0, energyFromSiphon: 0 };
      this.uid = 1; this.buffsDirty = true; this.revealAll = false;
    }

    buildPath() {
      const p = this.map.path, segs = []; let total = 0;
      for (let i = 0; i < p.length - 1; i++) {
        const dx = p[i + 1][0] - p[i][0], dy = p[i + 1][1] - p[i][1], len = Math.hypot(dx, dy);
        segs.push({ x: p[i][0], y: p[i][1], dx: dx / len, dy: dy / len, len, start: total });
        total += len;
      }
      this.segs = segs; this.pathLen = total;
    }

    pointAt(d) {
      const segs = this.segs;
      if (d <= 0) { const s = segs[0]; return { x: s.x + s.dx * d, y: s.y + s.dy * d, a: Math.atan2(s.dy, s.dx) }; }
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        if (d <= s.start + s.len || i === segs.length - 1) { const t = d - s.start; return { x: s.x + s.dx * t, y: s.y + s.dy * t, a: Math.atan2(s.dy, s.dx) }; }
      }
    }

    emit(type, data) { if (this.events.length < 300) this.events.push({ type, data }); }

    /* ---------- Waves ---------- */
    canCallWave() {
      if (this.state === 'won' || this.state === 'lost' || this.wave >= this.totalWaves) return false;
      return this.state === 'ready' || !this.waveSpawning[this.wave];
    }
    earlyBonus() {
      if (this.state === 'ready' || this.nextWaveTimer === null) return 0;
      return Math.round((5 + this.nextWaveTimer * 1.5) * W.bountyMult(this.wave));
    }
    callWave() {
      if (!this.canCallWave()) return false;
      const bonus = this.earlyBonus();
      if (bonus > 0) { this.energy += bonus; this.addPopup(this.map.castle[0], this.map.castle[1] - 80, '+' + bonus + ' early', '#FACC15', 1.4); }
      this.state = 'playing'; this.nextWaveTimer = null;
      const n = ++this.wave; let count = 0;
      W.makeWave(n).forEach(gr => {
        for (let i = 0; i < gr.count; i++) { this.queue.push({ t: this.time + gr.at + i * gr.gap, type: gr.type, wave: n, fast: gr.fast || 1 }); count++; }
      });
      this.queue.sort((a, b) => a.t - b.t);
      this.waveLeft[n] = count; this.waveSpawning[n] = count;
      this.emit(n % 10 === 0 || (n >= 75 && n % 5 === 0) ? 'bosswave' : 'wave', n);
      return true;
    }

    spawn(item) {
      const def = W.ENEMIES[item.type];
      const hp = def.hp * W.hpMult(item.wave) * (this.map.id === 'meadow' ? 0.8 : this.map.id === 'spiral' ? 1.12 : 1);
      const regen = def.regen || (def.boss && item.wave >= 50 ? 0.005 : 0);
      const shield = def.shield ? def.shield * W.hpMult(item.wave) : 0;
      this.enemies.push({
        id: this.uid++, type: item.type, def, wave: item.wave, hp, maxHp: hp, shield, maxShield: shield,
        armor: def.armor + (item.wave >= 75 ? 2 : 0), speed: def.speed * item.fast, fast: item.fast > 1, radius: def.radius,
        resist: def.resist || 0, regen, camo: !!def.camo, revealed: !def.camo,
        dist: -def.radius - 10 - Math.random() * 6, lane: (Math.random() - 0.5) * 14,
        slow: 0, slowT: 0, stunT: 0, freezeT: 0, burnT: 0, burnDps: 0, bleedT: 0, bleedDps: 0, glueT: 0, vulnT: 0, shatterT: 0,
        hitT: 0, x: -60, y: -60, a: 0, alive: true, wob: Math.random() * 6.28
      });
      this.waveSpawning[item.wave]--;
    }

    enemyGone(e) {
      e.alive = false;
      this.waveLeft[e.wave]--;
      if (this.waveLeft[e.wave] <= 0 && this.waveSpawning[e.wave] <= 0 && this.hearts > 0) {
        if (e.wave > this.wavesCleared) this.wavesCleared = e.wave;
        let bonus = W.clearBonus(e.wave);
        let siphon = 0;
        this.towers.forEach(t => { if (t.stats.kind === 'income') siphon += t.stats.perWave; });
        this.energy += bonus + siphon; this.stats.energyFromSiphon += siphon;
        this.emit('waveclear', { wave: e.wave, bonus: bonus + siphon });
      }
    }

    /* ---------- Towers ---------- */
    towerAt(pad) { return this.towers.find(t => t.pad === pad) || null; }

    build(pad, chassis) {
      const ch = T.byId[chassis];
      if (!ch || this.towerAt(pad) || this.energy < ch.cost || this.state === 'won' || this.state === 'lost') return false;
      const p = this.map.pads[pad];
      this.energy -= ch.cost;
      this.towers.push({ id: this.uid++, chassis, path: null, tier: 0, stats: T.stats(chassis, null, 0), pad, x: p[0], y: p[1],
        cd: 0.2, angle: -Math.PI / 2, recoil: 0, pop: 0.35, heat: 0, beam: [], buffDmg: 1, buffRate: 1, buffDetect: false });
      this.stats.built++; this.buffsDirty = true;
      this.emit('build', chassis);
      return true;
    }

    upgradeOptions(t) {
      if (t.tier >= 3) return [];
      const paths = t.path ? [t.path] : ['A', 'B', 'C'];
      return paths.map(p => ({ path: p, tier: t.tier + 1, name: T.NAMES[t.chassis][p][t.tier], cost: T.cost(T.byId[t.chassis], p, t.tier + 1) }));
    }

    upgrade(t, path) {
      if (t.tier >= 3 || (t.path && t.path !== path)) return false;
      const c = T.cost(T.byId[t.chassis], path, t.tier + 1);
      if (this.energy < c) return false;
      this.energy -= c;
      t.path = path; t.tier++; t.stats = T.stats(t.chassis, path, t.tier); t.pop = 0.4; t.heat = 0;
      this.buffsDirty = true;
      this.emit('upgrade', t.stats.name);
      return true;
    }

    sellValue(t) { return Math.floor(t.stats.spent * T.SELL_RATE); }
    sell(t) {
      const i = this.towers.indexOf(t); if (i < 0) return false;
      const v = this.sellValue(t); this.energy += v; this.towers.splice(i, 1);
      this.addPopup(t.x, t.y - 30, '+' + v, '#FACC15', 1); this.buffsDirty = true;
      this.emit('sell'); return true;
    }

    addMathEnergy(amount) {
      let bonus = 0;
      this.towers.forEach(t => { if (t.stats.kind === 'income' && t.stats.perAnswer) bonus += t.stats.perAnswer; });
      this.energy += amount + bonus; this.stats.energyFromMath += amount; this.stats.energyFromSiphon += bonus;
      return amount + bonus;
    }

    /* Beacon auras: recomputed only when towers change. */
    refreshBuffs() {
      this.buffsDirty = false; this.revealAll = false;
      const beacons = this.towers.filter(t => t.stats.kind === 'aura');
      beacons.forEach(b => { if (b.stats.revealAll) this.revealAll = true; });
      this.towers.forEach(t => {
        let dm = 0, rm = 0, det = false;
        beacons.forEach(b => {
          if (b === t) return;
          if (Math.hypot(b.x - t.x, b.y - t.y) <= b.stats.range) { dm += b.stats.buffDmg; rm += b.stats.buffRate; det = true; }
        });
        t.buffDmg = 1 + Math.min(1.5, dm); t.buffRate = 1 + Math.min(1.2, rm); t.buffDetect = det;
      });
    }

    canSee(t, e) { return !e.camo || this.revealAll || t.stats.detect || t.buffDetect; }

    targets(t, range) {
      const out = [], r2 = range * range;
      for (const e of this.enemies) {
        if (!e.alive || e.dist < 0) continue;
        const dx = e.x - t.x, dy = e.y - t.y;
        if (dx * dx + dy * dy <= r2 && this.canSee(t, e)) out.push(e);
      }
      return out;
    }
    allInRange(x, y, r) {
      const out = [], r2 = r * r;
      for (const e of this.enemies) { if (!e.alive || e.dist < 0) continue; const dx = e.x - x, dy = e.y - y; if (dx * dx + dy * dy <= r2) out.push(e); }
      return out;
    }

    /* ---------- Damage & statuses ---------- */
    damage(e, raw, pierce, s, color) {
      if (!e.alive || raw <= 0) return 0;
      let amt = raw;
      if (e.shield > 0) {
        const mult = (s && s.shieldBonus) || 1, hit = amt * mult, take = Math.min(e.shield, hit);
        e.shield -= take; amt = (hit - take) / mult;
        if (e.shield <= 0) this.addFx({ kind: 'pop', x: e.x, y: e.y, r: e.radius + 6, color: '#93C5FD', t: 0, life: 0.35 });
        if (amt <= 0) { e.hitT = 0.1; return 0; }
      }
      let eff = Math.max(1, amt - Math.max(0, e.armor - (pierce || 0)));
      if (e.vulnT > 0 || e.shatterT > 0) eff *= 1.5;
      e.hp -= eff; e.hitT = 0.16;
      if (e.def.boss || eff >= 12 || Math.random() < 0.25) this.addPopup(e.x + (Math.random() - 0.5) * 16, e.y - e.radius - 6, String(Math.round(eff)), color || '#FFFFFF', 0.7);
      if (e.hp <= 0) this.kill(e);
      return eff;
    }
    trueDamage(e, amt) {
      if (!e.alive || amt <= 0) return;
      e.hp -= amt; if (e.hp <= 0) this.kill(e);
    }
    kill(e) {
      if (!e.alive) return;
      const b = Math.round(e.def.bounty * W.bountyMult(e.wave));
      this.energy += b; this.stats.energyFromBounty += b; this.stats.kills++;
      this.addFx({ kind: 'pop', x: e.x, y: e.y, r: e.radius, color: e.def.color, t: 0, life: 0.35 });
      if (e.def.boss) this.emit('bosskill', e.def.name);
      this.enemyGone(e);
    }
    slow(e, amt, time) { amt *= 1 - e.resist; if (amt <= 0.02) return; if (amt >= e.slow) e.slow = amt; e.slowT = Math.max(e.slowT, time); }
    stun(e, time) { time *= 1 - e.resist; if (time > 0.05) e.stunT = Math.max(e.stunT, time); }
    freeze(e, time, shatter) { time *= 1 - e.resist; if (time > 0.05) { e.freezeT = Math.max(e.freezeT, time); if (shatter) e.shatterT = time + 1; } }
    push(e, d) { d *= 1 - e.resist; if (d > 0) e.dist = Math.max(-5, e.dist - d); }
    burn(e, dps, time) { e.burnDps = Math.max(e.burnDps, dps); e.burnT = Math.max(e.burnT, time); }
    bleed(e, dps, time) { e.bleedDps = Math.max(e.bleedDps, dps); e.bleedT = Math.max(e.bleedT, time); }

    /* Shared on-hit effects for direct hits. */
    hit(e, t, dmg, color) {
      const s = t.stats;
      if (s.crit && Math.random() < s.crit) { dmg *= s.critMult || 3; this.addPopup(e.x, e.y - e.radius - 18, 'CRIT', '#FDE047', 0.8); }
      if (s.shatterArmor && !e.shattered) { e.armor = Math.floor(e.armor / 2); e.shattered = true; }
      this.damage(e, dmg, s.pierce, s, color);
      if (!e.alive) return;
      if (s.hitSlow) this.slow(e, s.hitSlow, s.hitSlowTime || 1);
      if (s.stunChance && Math.random() < s.stunChance) this.stun(e, s.stunTime || 0.4);
      if (s.burn) this.burn(e, s.burn * t.buffDmg, s.burnTime || 2);
      if (s.bleed) this.bleed(e, s.bleed * t.buffDmg, s.bleedTime || 2);
    }

    addPopup(x, y, text, color, life) { if (this.popups.length >= MAX_POPUPS) this.popups.shift(); this.popups.push({ x, y, text, color, t: 0, life: life || 0.8 }); }
    addFx(f) { if (this.fx.length >= MAX_FX) this.fx.shift(); this.fx.push(f); }

    /* ---------- Tower behaviour ---------- */
    updateTower(t, dt) {
      const s = t.stats, kind = s.kind;
      t.recoil = Math.max(0, t.recoil - dt * 5); t.pop = Math.max(0, t.pop - dt);
      if (kind === 'income') { const g = s.perSec * dt; this.energy += g; this.stats.energyFromSiphon += g; return; }
      if (kind === 'aura') {
        if (s.slowAura) for (const e of this.allInRange(t.x, t.y, s.range)) this.slow(e, s.slowAura, 0.25);
        return;
      }
      const dmg = s.damage * t.buffDmg;
      if (kind === 'beam') return this.updateBeam(t, dt, dmg);

      t.cd -= dt;
      let list = kind === 'rail' ? this.enemies.filter(e => e.alive && e.dist >= 0 && this.canSee(t, e)) : this.targets(t, s.range);
      if (!list.length) return;
      let target;
      if (kind === 'rail') target = list.reduce((a, b) => (b.hp + b.shield > a.hp + a.shield ? b : a));
      else target = list.reduce((a, b) => (b.dist > a.dist ? b : a));
      if (kind !== 'pulse' && kind !== 'pull' && kind !== 'gust') {
        const want = Math.atan2(target.y - t.y, target.x - t.x), diff = Math.atan2(Math.sin(want - t.angle), Math.cos(want - t.angle));
        t.angle += diff * Math.min(1, dt * 14);
      }
      if (t.cd > 0) return;
      t.cd = s.rate / t.buffRate; t.recoil = 1;
      const sorted = (s.shots > 1) ? list.slice().sort((a, b) => b.dist - a.dist) : null;
      const nth = i => sorted ? sorted[i % sorted.length] : target;

      switch (kind) {
        case 'projectile':
          for (let i = 0; i < s.shots; i++) {
            const tg = nth(i), side = s.shots > 1 ? (i - (s.shots - 1) / 2) * 6 : 0;
            const nx = -Math.sin(t.angle), ny = Math.cos(t.angle);
            this.addShot({ kind: 'dart', x: t.x + Math.cos(t.angle) * 26 + nx * side, y: t.y - 16 + Math.sin(t.angle) * 26 + ny * side, target: tg, speed: s.projSpeed, dmg, tower: t, trail: [], path: s.path, tier: s.tier });
          }
          this.emit('shoot', 'dart'); break;
        case 'pulse': {
          for (const e of this.allInRange(t.x, t.y, s.range)) {
            this.damage(e, dmg, s.pierce, s, '#BAE6FD');
            if (!e.alive) continue;
            this.slow(e, s.slow, s.slowTime);
            if (s.freezeChance && Math.random() < s.freezeChance) this.freeze(e, s.freezeTime, s.shatter);
          }
          this.addFx({ kind: 'ring', x: t.x, y: t.y, r: s.range, t: 0, life: 0.45, color: '186,230,253' });
          this.emit('shoot', 'cryo'); break;
        }
        case 'shell':
          for (let i = 0; i < s.shots; i++) {
            const tg = nth(i), lead = tg.speed * (1 - tg.slow) * s.flight, p = this.pointAt(Math.min(this.pathLen, tg.dist + lead));
            this.addShot({ kind: 'shell', sx: t.x, sy: t.y - 26, tx: p.x + (Math.random() - 0.5) * (i ? 30 : 0), ty: p.y, t: 0, flight: s.flight + i * 0.08, dmg, tower: t, x: t.x, y: t.y });
          }
          this.emit('shoot', 'mortar'); break;
        case 'chain': {
          const hit = [target]; let cur = target;
          while (hit.length < s.chains) {
            let best = null, bd = s.chainRange * s.chainRange;
            for (const c of this.enemies) {
              if (!c.alive || c.dist < 0 || hit.indexOf(c) >= 0 || !this.canSee(t, c)) continue;
              const d2 = (c.x - cur.x) ** 2 + (c.y - cur.y) ** 2;
              if (d2 < bd) { bd = d2; best = c; }
            }
            if (!best) break;
            hit.push(best); cur = best;
          }
          const pts = [[t.x, t.y - 58]]; hit.forEach(h => pts.push([h.x, h.y]));
          this.addFx({ kind: 'bolt', pts, t: 0, life: 0.18, seed: Math.random() * 100 });
          hit.forEach((h, i) => this.hit(h, t, dmg * (i === 0 ? 1 : 0.85), '#FEF08A'));
          this.emit('shoot', 'tesla'); break;
        }
        case 'pull': {
          for (const e of this.allInRange(t.x, t.y, s.range)) {
            if (e.def.boss && e.type === 'dread') continue;
            this.damage(e, dmg, s.pierce, s, '#FDBA74'); if (!e.alive) continue;
            this.push(e, s.pull);
            if (s.hitSlow) this.slow(e, s.hitSlow, s.hitSlowTime);
            if (s.crush) e.vulnT = 2;
          }
          this.addFx({ kind: 'implode', x: t.x, y: t.y - 30, r: s.range, t: 0, life: 0.5 });
          this.emit('shoot', 'gravity'); break;
        }
        case 'bounce':
          for (let i = 0; i < s.shots; i++) this.addShot({ kind: 'saw', x: t.x, y: t.y - 30, target: nth(i), speed: s.projSpeed, dmg, tower: t, left: s.bounces, hit: [], spin: 0 });
          this.emit('shoot', 'saw'); break;
        case 'puddle':
          for (let i = 0; i < s.shots; i++) {
            const tg = nth(i), p = this.pointAt(Math.min(this.pathLen, tg.dist + tg.speed * (1 - tg.slow) * 0.8));
            this.addShot({ kind: 'glob', sx: t.x, sy: t.y - 40, tx: p.x, ty: p.y, t: 0, flight: 0.8, tower: t, x: t.x, y: t.y });
          }
          this.emit('shoot', 'glue'); break;
        case 'rail':
          for (let i = 0; i < s.shots; i++) {
            const tg = i === 0 ? target : list[Math.floor(Math.random() * list.length)];
            this.addFx({ kind: 'rail', x1: t.x, y1: t.y - 22, x2: tg.x, y2: tg.y, t: 0, life: 0.22 });
            this.hit(tg, t, dmg, '#BFDBFE');
          }
          this.emit('shoot', 'rail'); break;
        case 'gust': {
          for (const e of this.allInRange(t.x, t.y, s.range)) {
            this.damage(e, dmg, s.pierce, s, '#F1F5F9'); if (!e.alive) continue;
            if (e.def.weight <= s.weight) this.push(e, s.knock);
            if (s.hitSlow) this.slow(e, s.hitSlow, s.hitSlowTime);
          }
          this.addFx({ kind: 'gust', x: t.x, y: t.y - 30, r: s.range, t: 0, life: 0.5 });
          this.emit('shoot', 'tornado'); break;
        }
      }
    }

    updateBeam(t, dt, dps) {
      const s = t.stats, list = this.targets(t, s.range).sort((a, b) => b.dist - a.dist);
      const keep = t.beam.filter(b => b.e.alive && list.indexOf(b.e) >= 0);
      while (keep.length < s.beams && list.length > keep.length) {
        const next = list.find(e => !keep.some(b => b.e === e)); if (!next) break;
        keep.push({ e: next, heat: 0 });
      }
      t.beam = keep;
      if (!keep.length) { t.heat = Math.max(0, t.heat - dt * 2); return; }
      const first = keep[0].e;
      t.angle = Math.atan2(first.y - t.y, first.x - t.x);
      let maxHeat = 0;
      for (const b of keep) {
        b.heat = Math.min(s.maxHeat - 1, b.heat + s.ramp * dt);
        maxHeat = Math.max(maxHeat, b.heat);
        const amt = dps * (1 + b.heat) * dt;
        if (s.lineBeam) {
          const ang = Math.atan2(b.e.y - (t.y - 38), b.e.x - t.x), ca = Math.cos(ang), sa = Math.sin(ang);
          for (const e of this.enemies) {
            if (!e.alive || e.dist < 0) continue;
            const rx = e.x - t.x, ry = e.y - (t.y - 38), along = rx * ca + ry * sa, off = Math.abs(-rx * sa + ry * ca);
            if (along > 0 && along < s.range + 40 && off < 14 + e.radius) this.beamTick(e, t, amt);
          }
        } else this.beamTick(b.e, t, amt);
      }
      t.heat = maxHeat;
    }
    beamTick(e, t, amt) {
      const s = t.stats;
      if (e.shield > 0) { const take = Math.min(e.shield, amt); e.shield -= take; amt -= take; if (amt <= 0) return; }
      const armorCut = Math.max(0, e.armor - s.pierce) * 0.08 * amt;   // armor softens beams a little
      this.trueDamage(e, Math.max(amt * 0.25, amt - armorCut) * (e.vulnT > 0 ? 1.5 : 1));
      if (!e.alive) return;
      e.hitT = Math.max(e.hitT, 0.05);
      if (s.burn) this.burn(e, s.burn * t.buffDmg, s.burnTime);
      if (s.shred) e.armor = Math.max(0, e.armor - s.shred * (amt / Math.max(1, s.damage)) * 0.6);
    }

    addShot(sh) { if (this.shots.length < MAX_SHOTS) this.shots.push(sh); }

    updateShots(dt) {
      for (let i = this.shots.length - 1; i >= 0; i--) {
        const s = this.shots[i]; let done = false;
        if (s.kind === 'dart' || s.kind === 'saw') {
          const tg = s.target, dx = tg.x - s.x, dy = tg.y - s.y, d = Math.hypot(dx, dy), step = s.speed * dt;
          if (s.trail) { s.trail.push([s.x, s.y]); if (s.trail.length > 5) s.trail.shift(); }
          s.a = Math.atan2(dy, dx); if (s.kind === 'saw') s.spin += dt * 20;
          if (!tg.alive) {
            if (s.kind === 'saw' && s.left > 0) { const n = this.nextBounce(s, s.x, s.y); if (n) { s.target = n; continue; } }
            done = true;
          } else if (d <= step + tg.radius * 0.5) {
            this.hit(tg, s.tower, s.dmg, '#FFFFFF');
            this.addFx({ kind: 'spark', x: tg.x, y: tg.y, t: 0, life: 0.15 });
            if (s.kind === 'saw' && s.left > 0) {
              s.hit.push(tg); s.left--; s.dmg *= 0.92;
              const n = this.nextBounce(s, tg.x, tg.y);
              if (n) s.target = n; else done = true;
            } else done = true;
          } else { s.x += dx / d * step; s.y += dy / d * step; }
        } else {
          s.t += dt;
          const k = Math.min(1, s.t / s.flight);
          s.x = s.sx + (s.tx - s.sx) * k; s.y = s.sy + (s.ty - s.sy) * k - Math.sin(k * Math.PI) * (90 + s.flight * 60); s.k = k;
          if (k >= 1) {
            const st = s.tower.stats;
            if (s.kind === 'shell') {
              const r = st.splash, r2 = r * r;
              for (const e of this.enemies) {
                if (!e.alive) continue;
                const d2 = (e.x - s.tx) ** 2 + (e.y - s.ty) ** 2;
                if (d2 <= r2) {
                  this.damage(e, s.dmg * (d2 < r2 * 0.25 ? 1 : 0.7), st.pierce, st, '#FDE68A');
                  if (e.alive && st.burn) this.burn(e, st.burn * s.tower.buffDmg, st.burnTime);
                  if (e.alive && st.stunChance && Math.random() < st.stunChance) this.stun(e, st.stunTime);
                }
              }
              this.addFx({ kind: 'boom', x: s.tx, y: s.ty, r, t: 0, life: 0.5, big: st.tier >= 2 && st.path === 'A' });
              if (st.napalm) this.addPuddle({ x: s.tx, y: s.ty, r: r * 0.7, life: 3, t: 0, dps: st.burn * 0.6 * s.tower.buffDmg, slow: 0, fire: true });
              this.emit('boom');
            } else {
              this.addPuddle({ x: s.tx, y: s.ty, r: st.puddleR, life: st.puddleTime, t: 0, dps: st.damage * s.tower.buffDmg, slow: st.slow, stick: st.stickChance || 0 });
              this.addFx({ kind: 'splat', x: s.tx, y: s.ty, r: st.puddleR, t: 0, life: 0.3 });
            }
            done = true;
          }
        }
        if (done) this.shots.splice(i, 1);
      }
    }
    nextBounce(s, x, y) {
      const st = s.tower.stats; let best = null, bd = st.bounceRange * st.bounceRange;
      for (const e of this.enemies) {
        if (!e.alive || e.dist < 0 || s.hit.indexOf(e) >= 0 || !this.canSee(s.tower, e)) continue;
        const d2 = (e.x - x) ** 2 + (e.y - y) ** 2;
        if (d2 < bd) { bd = d2; best = e; }
      }
      return best;
    }
    addPuddle(p) { if (this.puddles.length >= MAX_PUDDLES) this.puddles.shift(); this.puddles.push(p); }

    /* ---------- Main step ---------- */
    update(dt) {
      if (this.state === 'won' || this.state === 'lost') { this.updateFx(dt); return; }
      this.time += dt;
      if (this.buffsDirty) this.refreshBuffs();

      while (this.queue.length && this.queue[0].t <= this.time && this.enemies.length < MAX_ENEMIES) this.spawn(this.queue.shift());
      if (this.queue.length && this.queue[0].t <= this.time) this.queue.forEach(q => { if (q.t <= this.time) q.t = this.time + 0.2; });

      if (this.state === 'playing' && this.wave < this.totalWaves && !this.waveSpawning[this.wave]) {
        if (this.nextWaveTimer === null) this.nextWaveTimer = this.waveGap;
        // The automatic countdown waits until the board is mostly clear; players can still call early.
        if (this.enemies.length <= 15 || this.nextWaveTimer > 5) this.nextWaveTimer -= dt;
        if (this.nextWaveTimer <= 0) { this.nextWaveTimer = null; this.callWave(); }
      }

      // puddles
      for (let i = this.puddles.length - 1; i >= 0; i--) {
        const p = this.puddles[i]; p.t += dt;
        if (p.t >= p.life) { this.puddles.splice(i, 1); continue; }
        for (const e of this.allInRange(p.x, p.y, p.r)) {
          if (p.slow) { this.slow(e, p.slow, 0.3); e.glueT = 0.3; }
          if (p.stick && !e.stuckBy && Math.random() < p.stick) { this.stun(e, 0.6); }
          e.stuckBy = p.stick ? true : e.stuckBy;
          this.trueDamage(e, p.dps * dt);
          if (p.fire) this.burn(e, p.dps, 1);
        }
      }

      // enemies
      for (const e of this.enemies) {
        if (!e.alive) continue;
        e.hitT = Math.max(0, e.hitT - dt);
        if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slow = 0; }
        if (e.stunT > 0) e.stunT -= dt;
        if (e.freezeT > 0) e.freezeT -= dt;
        if (e.shatterT > 0) e.shatterT -= dt;
        if (e.vulnT > 0) e.vulnT -= dt;
        if (e.glueT > 0) e.glueT -= dt; else e.stuckBy = false;
        if (e.burnT > 0) { e.burnT -= dt; this.trueDamage(e, e.burnDps * dt); if (!e.alive) continue; }
        if (e.bleedT > 0) { e.bleedT -= dt; this.trueDamage(e, e.bleedDps * dt); if (!e.alive) continue; }
        if (e.regen && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.regen * dt);
        const held = e.stunT > 0 || e.freezeT > 0;
        if (!held) { e.wob += dt * (e.speed / 12); e.dist += e.speed * (1 - e.slow) * dt; }
        const p = this.pointAt(e.dist), nx = -Math.sin(p.a), ny = Math.cos(p.a);
        e.x = p.x + nx * e.lane; e.y = p.y + ny * e.lane; e.a = p.a;
        if (e.dist >= this.pathLen) {
          this.hearts = Math.max(0, this.hearts - e.def.leak);
          this.stats.leaks++; this.emit('leak', e.def.leak); this.enemyGone(e);
        }
      }

      // camo visibility for drawing
      for (const e of this.enemies) {
        if (!e.camo) continue;
        e.revealed = this.revealAll || this.towers.some(t => (t.stats.detect || t.buffDetect) && Math.hypot(t.x - e.x, t.y - e.y) <= (t.stats.range || 0) + 20);
      }

      for (const t of this.towers) this.updateTower(t, dt);
      this.updateShots(dt);

      let w = 0;
      for (const e of this.enemies) if (e.alive) this.enemies[w++] = e;
      this.enemies.length = w;

      this.updateFx(dt);

      if (this.hearts <= 0) { this.state = 'lost'; this.emit('lost'); }
      else if (this.wave >= this.totalWaves && !this.queue.length && !this.enemies.length) {
        this.wavesCleared = this.totalWaves; this.state = 'won'; this.emit('won');
      }
    }

    updateFx(dt) {
      for (let i = this.fx.length - 1; i >= 0; i--) { this.fx[i].t += dt; if (this.fx[i].t >= this.fx[i].life) this.fx.splice(i, 1); }
      for (let i = this.popups.length - 1; i >= 0; i--) { const p = this.popups[i]; p.t += dt; p.y -= dt * 34; if (p.t >= p.life) this.popups.splice(i, 1); }
    }
  }

  /* ===================== Board renderer ===================== */
  const bgCache = {};

  function offset(path, d) {
    const out = [];
    for (let i = 0; i < path.length; i++) {
      const p = path[i], a = path[i - 1] || null, b = path[i + 1] || null;
      let nx = 0, ny = 0;
      if (a) { const dx = p[0] - a[0], dy = p[1] - a[1], L = Math.hypot(dx, dy); nx += -dy / L; ny += dx / L; }
      if (b) { const dx = b[0] - p[0], dy = b[1] - p[1], L = Math.hypot(dx, dy); nx += -dy / L; ny += dx / L; }
      const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
      const k = a && b ? 1 / Math.max(0.5, Math.sqrt((1 + ((p[0] - a[0]) * (b[0] - p[0]) + (p[1] - a[1]) * (b[1] - p[1])) / (Math.hypot(p[0] - a[0], p[1] - a[1]) * Math.hypot(b[0] - p[0], b[1] - p[1]))) / 2)) : 1;
      out.push([p[0] + nx * d * k, p[1] + ny * d * k]);
    }
    return out;
  }
  function strokePath(ctx, pts, w, col, dash) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
  }

  function renderBackground(map, doc) {
    if (bgCache[map.id]) return bgCache[map.id];
    const c = (doc || document).createElement('canvas'); c.width = VIEW.w; c.height = VIEW.h;
    const ctx = c.getContext('2d'), th = map.theme, r = G.rng(map.id.length * 7919 + 31);
    ctx.fillStyle = th.ground; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    // paper-craft patches with torn edges
    for (let i = 0; i < 14; i++) {
      const cx = r() * VIEW.w, cy = r() * VIEW.h, rad = 70 + r() * 110, n = 14;
      ctx.beginPath();
      for (let k = 0; k <= n; k++) { const a = k / n * TAU, rr = rad * (0.8 + r() * 0.3); ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.6); }
      ctx.closePath(); ctx.fillStyle = th.ground2; ctx.fill();
      ctx.strokeStyle = 'rgba(30,41,59,0.18)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // paper fibres
    ctx.strokeStyle = th.fleck; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.5;
    for (let i = 0; i < 420; i++) { const x = r() * VIEW.w, y = r() * VIEW.h, a = r() * 3, l = 3 + r() * 6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
    ctx.globalAlpha = 1;

    // felt path with stitching
    ctx.save(); ctx.translate(0, 5); strokePath(ctx, map.path, 70, 'rgba(30,41,59,0.2)'); ctx.restore();
    strokePath(ctx, map.path, 70, INK);
    strokePath(ctx, map.path, 64, th.feltD);
    strokePath(ctx, map.path, 56, th.felt);
    // felt fuzz
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    for (let i = 0; i < map.path.length - 1; i++) {
      const a = map.path[i], b = map.path[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
      for (let s = 0; s < len; s += 3) { const o = (r() - 0.5) * 50, x = a[0] + (b[0] - a[0]) * s / len + nx * o, y = a[1] + (b[1] - a[1]) * s / len + ny * o; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + r() * 3, y + r() * 3); ctx.stroke(); }
    }
    strokePath(ctx, offset(map.path, 21), 2.6, th.stitch, [9, 7]);
    strokePath(ctx, offset(map.path, -21), 2.6, th.stitch, [9, 7]);

    // decorations
    const placed = [];
    const free = (x, y, rad) => {
      if (distToPath(map.path, x, y) < 48 + rad) return false;
      if (map.pads.some(p => Math.hypot(p[0] - x, p[1] - y) < 42 + rad)) return false;
      if (Math.hypot(map.castle[0] - x, map.castle[1] - y) < 95 + rad) return false;
      return placed.every(p => Math.hypot(p[0] - x, p[1] - y) >= p[2] + rad);
    };
    const items = [];
    for (let i = 0; i < 500 && items.length < 30; i++) {
      const x = 22 + r() * (VIEW.w - 44), y = 24 + r() * (VIEW.h - 36), big = r() < 0.55, rad = big ? 24 : 14;
      if (!free(x, y, rad)) continue;
      placed.push([x, y, rad]); items.push({ x, y, big, v: r() });
    }
    items.sort((a, b) => a.y - b.y).forEach(it => deco(ctx, th.deco, it));
    bgCache[map.id] = c;
    return c;
  }

  function deco(ctx, kind, it) {
    const { x, y } = it;
    if (it.big && it.v < 0.55 && kind !== 'canyon') {
      // folded paper tree: two-tone cone
      G.shadow(ctx, x + 3, y + 16, 18, 6);
      G.box(ctx, x - 3, y + 6, 6, 10, 1, PAL.woodD, 2);
      const col = kind === 'spiral' ? '#4E7A63' : '#3F8F4F';
      G.poly(ctx, [[x, y - 30], [x - 16, y + 8], [x, y + 8]], col, 0);
      G.poly(ctx, [[x, y - 30], [x + 16, y + 8], [x, y + 8]], G.shade(col, -0.22), 0);
      G.ink(ctx, 2.5); ctx.beginPath(); ctx.moveTo(x, y - 30); ctx.lineTo(x - 16, y + 8); ctx.lineTo(x + 16, y + 8); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y - 30); ctx.lineTo(x, y + 8); ctx.strokeStyle = 'rgba(30,41,59,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
      if (kind === 'spiral') G.poly(ctx, [[x, y - 30], [x - 6, y - 18], [x + 6, y - 18]], '#FFFFFF', 1.5);
    } else if (it.big && it.v < 0.75) {
      // cardboard rock / box
      G.shadow(ctx, x + 3, y + 12, 22, 6);
      G.poly(ctx, [[x - 20, y + 10], [x - 16, y - 10], [x + 2, y - 16], [x + 18, y - 8], [x + 20, y + 10]], '#C9A06A', 2.5);
      G.poly(ctx, [[x - 16, y - 10], [x + 2, y - 16], [x + 18, y - 8], [x + 2, y - 3]], '#E2C08F', 0);
      ctx.strokeStyle = 'rgba(30,41,59,0.3)'; ctx.lineWidth = 1.2;
      for (let k = -14; k <= 14; k += 5) { ctx.beginPath(); ctx.moveTo(x + k, y - 1); ctx.lineTo(x + k + 2, y + 9); ctx.stroke(); }
    } else if (it.big) {
      // wooden die
      G.shadow(ctx, x + 3, y + 13, 17, 5);
      G.box(ctx, x - 14, y - 14, 28, 28, 6, '#F8F1E4', 2.5);
      const pips = Math.floor(it.v * 10) % 6 + 1, spots = { 1: [[0, 0]], 2: [[-6, -6], [6, 6]], 3: [[-6, -6], [0, 0], [6, 6]], 4: [[-6, -6], [6, -6], [-6, 6], [6, 6]], 5: [[-6, -6], [6, -6], [0, 0], [-6, 6], [6, 6]], 6: [[-6, -7], [6, -7], [-6, 0], [6, 0], [-6, 7], [6, 7]] };
      spots[pips].forEach(p => G.circle(ctx, x + p[0], y + p[1], 2.4, INK, 0));
    } else if (it.v < 0.35) {
      // thread spool
      G.shadow(ctx, x + 2, y + 9, 11, 4);
      G.box(ctx, x - 9, y - 9, 18, 4, 2, PAL.woodL, 1.8); G.box(ctx, x - 9, y + 5, 18, 4, 2, PAL.woodL, 1.8);
      G.box(ctx, x - 7, y - 5, 14, 10, 1, it.v < 0.18 ? '#DC2626' : '#2563EB', 1.8);
    } else if (it.v < 0.7) {
      G.shadow(ctx, x + 2, y + 6, 12, 4);
      G.gear(ctx, x, y, 10, 8, it.v * 9, PAL.brass, 2);
    } else {
      // board-game pawn
      G.shadow(ctx, x + 2, y + 9, 10, 4);
      const col = ['#DC2626', '#2563EB', '#16A34A', '#F59E0B'][Math.floor(it.v * 40) % 4];
      G.poly(ctx, [[x - 8, y + 8], [x - 4, y - 2], [x + 4, y - 2], [x + 8, y + 8]], col, 2);
      G.circle(ctx, x, y - 6, 5, col, 2);
    }
  }

  function drawPad(ctx, x, y, state, t) {
    G.shadow(ctx, x, y + 7, 33, 12, 0.2);
    const hex = k => { const pts = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; pts.push([x + Math.cos(a) * 32 * k, y + Math.sin(a) * 22 * k]); } return pts; };
    G.poly(ctx, hex(1), PAL.woodD, 3);
    ctx.save(); ctx.translate(0, -3); G.poly(ctx, hex(0.94), PAL.wood, 0); ctx.restore();
    ctx.strokeStyle = 'rgba(30,41,59,0.25)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(x - 22, y - 8); ctx.quadraticCurveTo(x, y - 4, x + 22, y - 9); ctx.moveTo(x - 24, y + 3); ctx.quadraticCurveTo(x, y + 6, x + 20, y + 2); ctx.stroke();
    [[-20, -12], [20, -12], [-20, 8], [20, 8]].forEach(p => G.rivet(ctx, x + p[0], y + p[1] - 2, 2.2));
    if (state) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 6);
      ctx.strokeStyle = state === 'selected' ? PAL.brassL : 'rgba(245,215,122,' + (0.55 + pulse * 0.45) + ')';
      ctx.lineWidth = 4; G.poly(ctx, hex(1.12), 'rgba(0,0,0,0)', 0); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(30,41,59,0.45)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 6, y - 3); ctx.lineTo(x + 6, y - 3); ctx.moveTo(x, y - 9); ctx.lineTo(x, y + 3); ctx.stroke();
  }

  function drawCastle(ctx, x, y, t, hurt) {
    ctx.save();
    if (hurt > 0) ctx.translate(Math.sin(t * 80) * hurt * 6, 0);
    G.shadow(ctx, x, y + 36, 62, 13);
    // cardboard keep
    G.box(ctx, x - 44, y - 20, 88, 56, 3, '#C9A06A', 3);
    ctx.strokeStyle = 'rgba(30,41,59,0.25)'; ctx.lineWidth = 1.3;
    for (let k = -40; k <= 40; k += 6) { ctx.beginPath(); ctx.moveTo(x + k, y - 18); ctx.lineTo(x + k, y + 34); ctx.stroke(); }
    for (let i = 0; i < 6; i++) G.box(ctx, x - 44 + i * 15.6, y - 28, 10, 10, 1, '#C9A06A', 2.5);
    // clock tower
    G.box(ctx, x - 22, y - 74, 44, 56, 3, '#E2C08F', 3);
    G.poly(ctx, [[x - 27, y - 74], [x, y - 100], [x + 27, y - 74]], PAL.red, 3);
    G.circle(ctx, x, y - 50, 16, PAL.paper, 3);
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12; ctx.fillStyle = INK; ctx.fillRect(x + Math.cos(a) * 12.5 - 1, y - 50 + Math.sin(a) * 12.5 - 1, 2, 2); }
    G.ink(ctx, 3); ctx.beginPath(); ctx.moveTo(x, y - 50); ctx.lineTo(x + Math.cos(t * 0.5 - 1.57) * 8, y - 50 + Math.sin(t * 0.5 - 1.57) * 8); ctx.stroke();
    G.ink(ctx, 2); ctx.beginPath(); ctx.moveTo(x, y - 50); ctx.lineTo(x + Math.cos(t * 3 - 1.57) * 12, y - 50 + Math.sin(t * 3 - 1.57) * 12); ctx.stroke();
    G.circle(ctx, x, y - 50, 2.5, PAL.brass, 1.5);
    G.gear(ctx, x + 30, y - 40, 11, 9, t, PAL.brass, 2.5);
    // door
    ctx.beginPath(); ctx.moveTo(x - 12, y + 36); ctx.lineTo(x - 12, y + 10); ctx.arc(x, y + 10, 12, Math.PI, 0); ctx.lineTo(x + 12, y + 36); ctx.closePath();
    ctx.fillStyle = PAL.woodD; ctx.fill(); G.ink(ctx, 3); ctx.stroke();
    // pennant
    G.ink(ctx, 3); ctx.beginPath(); ctx.moveTo(x, y - 100); ctx.lineTo(x, y - 124); ctx.stroke();
    const w = Math.sin(t * 5) * 3;
    G.poly(ctx, [[x, y - 124], [x + 20, y - 119 + w], [x, y - 112]], PAL.brass, 2.5);
    if (hurt > 0) { ctx.globalAlpha = hurt * 0.45; ctx.fillStyle = '#EF4444'; ctx.beginPath(); ctx.arc(x, y - 20, 70, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.restore();
  }

  function drawShots(ctx, shots, t) {
    for (const s of shots) {
      if (s.kind === 'dart') {
        const col = s.path === 'A' ? '#EF4444' : s.path === 'B' ? '#60A5FA' : '#F5D77A';
        if (s.trail.length) { ctx.strokeStyle = col; ctx.globalAlpha = 0.5; ctx.lineWidth = s.path === 'A' ? 5 : s.path === 'C' ? 2.5 : 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s.trail[0][0], s.trail[0][1]); s.trail.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(s.x, s.y); ctx.stroke(); ctx.globalAlpha = 1; }
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a || 0);
        const L = s.path === 'A' ? 9 : 7; G.poly(ctx, [[L, 0], [-5, -3.5], [-5, 3.5]], PAL.brassL, 1.8);
        ctx.restore();
      } else if (s.kind === 'saw') {
        G.gear(ctx, s.x, s.y, 8, 8, s.spin, '#E2E8F0', 1.8);
      } else if (s.kind === 'shell' || s.kind === 'glob') {
        const k = s.k || 0, gx = s.sx + (s.tx - s.sx) * k, gy = s.sy + 22 + (s.ty - s.sy - 22) * k;
        G.shadow(ctx, gx, gy, 7 + k * 4, 3 + k * 2, 0.25);
        if (s.kind === 'shell') { G.circle(ctx, s.x, s.y, 7, 'rgba(220,252,231,0.95)', 2.2); ctx.fillStyle = '#65A30D'; ctx.beginPath(); ctx.arc(s.x, s.y + 1, 5, 0, Math.PI); ctx.fill(); G.box(ctx, s.x - 2, s.y - 11, 4, 5, 1, PAL.brass, 1.5); }
        else G.circle(ctx, s.x, s.y, 7, '#F59E0B', 2.2);
      }
    }
  }

  function drawFx(ctx, fx) {
    for (const f of fx) {
      const k = f.t / f.life;
      if (f.kind === 'ring') {
        ctx.strokeStyle = 'rgba(' + f.color + ',' + (1 - k) + ')'; ctx.lineWidth = 8 * (1 - k) + 2;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * k, f.r * k * 0.62, 0, 0, TAU); ctx.stroke();
      } else if (f.kind === 'implode') {
        ctx.strokeStyle = 'rgba(249,115,22,' + (1 - k) * 0.8 + ')'; ctx.lineWidth = 3;
        for (let i = 0; i < 2; i++) { const rr = f.r * (1 - ((k + i * 0.4) % 1)); ctx.beginPath(); ctx.ellipse(f.x, f.y + 30, rr, rr * 0.6, 0, 0, TAU); ctx.stroke(); }
      } else if (f.kind === 'gust') {
        ctx.strokeStyle = 'rgba(241,245,249,' + (1 - k) + ')'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + k * 3, rr = f.r * (0.3 + k * 0.7); ctx.beginPath(); ctx.arc(f.x, f.y + 30, rr, a, a + 0.6); ctx.stroke(); }
      } else if (f.kind === 'boom') {
        const rr = f.r * (0.4 + k * 0.7);
        ctx.globalAlpha = 1 - k;
        G.circle(ctx, f.x, f.y, rr, f.big ? '#FB923C' : '#BEF264', 3);
        G.circle(ctx, f.x, f.y, rr * 0.6, '#FDE047', 0); G.circle(ctx, f.x, f.y, rr * 0.28, '#FFFFFF', 0);
        ctx.globalAlpha = 1;
        for (let j = 0; j < 5; j++) { const a = j * 1.26 + f.x, d = rr * (0.8 + k * 0.6); G.circle(ctx, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * 0.7 - k * 10, 3 * (1 - k) + 1, 'rgba(220,252,231,0.9)', 1); }
      } else if (f.kind === 'bolt') {
        const r2 = G.rng(Math.floor(f.seed + f.t * 60));
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass ? '#FFFFFF' : '#FACC15'; ctx.lineWidth = pass ? 2 : 6; ctx.lineJoin = 'round'; ctx.globalAlpha = 1 - k * 0.6;
          ctx.beginPath(); ctx.moveTo(f.pts[0][0], f.pts[0][1]);
          for (let q = 1; q < f.pts.length; q++) {
            const [ax, ay] = f.pts[q - 1], [bx, by] = f.pts[q];
            for (let s = 1; s <= 3; s++) ctx.lineTo(ax + (bx - ax) * s / 4 + (r2() - 0.5) * 16, ay + (by - ay) * s / 4 + (r2() - 0.5) * 16);
            ctx.lineTo(bx, by);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (f.kind === 'rail') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#1D4ED8'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
        ctx.strokeStyle = '#DBEAFE'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (f.kind === 'pop') {
        for (let m = 0; m < 7; m++) { const a = m * 0.9 + f.x * 0.1, d = f.r * (0.6 + k * 1.6); G.circle(ctx, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d - k * 12, (1 - k) * 5 + 1, m % 2 ? f.color : '#FFFFFF', 1.5); }
      } else if (f.kind === 'spark') {
        G.circle(ctx, f.x, f.y, 6 * (1 - k) + 1, '#FDE68A', 0);
      } else if (f.kind === 'splat') {
        ctx.globalAlpha = 1 - k; G.circle(ctx, f.x, f.y, f.r * (0.5 + k * 0.6), 'rgba(245,158,11,0.5)', 2); ctx.globalAlpha = 1;
      }
    }
  }

  function drawPuddles(ctx, puddles, t) {
    for (const p of puddles) {
      const fade = Math.min(1, (p.life - p.t) / 0.6);
      ctx.globalAlpha = 0.75 * fade;
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) { const a = i / 12 * TAU, rr = p.r * (0.86 + 0.14 * Math.sin(a * 3 + p.x)); ctx.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr * 0.62); }
      ctx.closePath(); ctx.fillStyle = p.fire ? '#F97316' : '#F59E0B'; ctx.fill(); G.ink(ctx, 2); ctx.stroke();
      ctx.fillStyle = p.fire ? '#FDE047' : '#FCD34D';
      ctx.beginPath(); ctx.ellipse(p.x - p.r * 0.2, p.y - p.r * 0.1, p.r * 0.3, p.r * 0.12, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawBeams(ctx, towers, t) {
    for (const tw of towers) {
      if (tw.stats.kind !== 'beam' || !tw.beam.length) continue;
      for (const b of tw.beam) {
        if (!b.e.alive) continue;
        const heat = b.heat / (tw.stats.maxHeat - 1), sx = tw.x, sy = tw.y - 48;
        let ex = b.e.x, ey = b.e.y;
        if (tw.stats.lineBeam) { const a = Math.atan2(ey - sy, ex - sx); ex = sx + Math.cos(a) * (tw.stats.range + 40); ey = sy + Math.sin(a) * (tw.stats.range + 40); }
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(244,63,94,' + (0.35 + heat * 0.4) + ')'; ctx.lineWidth = 6 + heat * 8 + Math.sin(t * 40) * 1.5;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = heat > 0.6 ? '#FFFFFF' : '#FECDD3'; ctx.lineWidth = 2 + heat * 2; ctx.stroke();
        G.circle(ctx, b.e.x, b.e.y, 4 + heat * 5, 'rgba(255,255,255,0.8)', 0);
      }
    }
  }

  function drawPopups(ctx, popups) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of popups) {
      const k = p.t / p.life, sc = k < 0.15 ? 0.7 + k * 2 : 1;
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.font = '900 ' + Math.round(16 * sc) + 'px Rockwell, "Roboto Slab", Georgia, serif';
      ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawScene(ctx, g, ui) {
    const t = ui.time, map = g.map;
    ctx.drawImage(renderBackground(map), 0, 0);
    drawPuddles(ctx, g.puddles, t);
    if (ui.showArrow) {
      const s0 = map.path[0], s1 = map.path[1], ang = Math.atan2(s1[1] - s0[1], s1[0] - s0[0]);
      ctx.save(); ctx.translate(Math.max(26, s0[0] + 50) + Math.sin(t * 4) * 5, s0[1]); ctx.rotate(ang);
      G.poly(ctx, [[14, 0], [-4, -13], [-4, -5], [-14, -5], [-14, 5], [-4, 5], [-4, 13]], PAL.brassL, 3);
      ctx.restore();
    }
    map.pads.forEach((p, i) => { if (!g.towerAt(i)) drawPad(ctx, p[0], p[1], ui.selectedPad === i ? 'selected' : ui.hoverPad === i ? 'hover' : '', t); });
    // beacon aura rings under everything
    g.towers.forEach(tw => { if (tw.stats.kind === 'aura') { ctx.strokeStyle = 'rgba(253,224,71,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.ellipse(tw.x, tw.y, tw.stats.range, tw.stats.range * 0.62, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]); } });

    const list = [];
    g.towers.forEach(o => list.push({ y: o.y, k: 't', o }));
    g.enemies.forEach(o => list.push({ y: o.y, k: 'e', o }));
    list.push({ y: map.castle[1] + 20, k: 'c' });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.k === 't') {
        if (ui.selectedPad === it.o.pad) { ctx.strokeStyle = PAL.brassL; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(it.o.x, it.o.y + 6, 36, 16, 0, 0, TAU); ctx.stroke(); }
        T.drawTower(ctx, it.o, t);
      } else if (it.k === 'e') W.drawEnemy(ctx, it.o, t);
      else drawCastle(ctx, map.castle[0], map.castle[1], t, ui.castleHurt);
    }
    if (ui.rangeFor) {
      const r = ui.rangeFor;
      ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.5; ctx.setLineDash([8, 6]);
      ctx.beginPath(); if (r.r > 2000) ctx.rect(4, 4, VIEW.w - 8, VIEW.h - 8); else ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    }
    drawBeams(ctx, g.towers, t);
    drawShots(ctx, g.shots, t);
    drawFx(ctx, g.fx);
    drawPopups(ctx, g.popups);
  }

  function drawMapPreview(canvas, map) {
    const ctx = canvas.getContext('2d');
    ctx.drawImage(renderBackground(map), 0, 0, canvas.width, canvas.height);
    const sc = canvas.width / VIEW.w;
    ctx.save(); ctx.scale(sc, sc);
    map.pads.forEach(p => drawPad(ctx, p[0], p[1], '', 0));
    drawCastle(ctx, map.castle[0], map.castle[1], 0.3, 0);
    ctx.restore();
  }

  MD.VIEW = VIEW;
  MD.Engine = Engine;
  MD.Board = { MAPS, mapById, distToPath, drawScene, drawMapPreview, drawCastle, renderBackground };
})(globalThis.MD = globalThis.MD || {});
