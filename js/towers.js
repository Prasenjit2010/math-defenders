/* Math Defenders — towers.js
   Shared drawing helpers (MD.gfx), the 12 tower chassis, the 108 path
   evolutions (12 chassis x 3 paths x 3 tiers), stat resolution and the
   procedural canvas art for every tower. No DOM access here. */
(function (MD) {
  'use strict';

  /* ===================== Drawing helpers ===================== */
  const INK = '#1E293B';
  const TAU = Math.PI * 2;
  const PAL = {
    ink: INK, wood: '#B07A45', woodD: '#7A4E26', woodL: '#D4A373', brass: '#D4A72C', brassD: '#8A6A12', brassL: '#F5D77A',
    copper: '#B87333', copperD: '#7C4A1E', iron: '#64748B', ironD: '#334155', paper: '#F4EBDD', kraft: '#D9BC8C', felt: '#3F7D4E', red: '#DC2626'
  };

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = n >> 8 & 255, b = n & 255;
    const f = c => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
    return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
  }
  function ink(ctx, w) { ctx.strokeStyle = INK; ctx.lineWidth = w || 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }
  function shadow(ctx, x, y, rx, ry, a) { ctx.fillStyle = 'rgba(30,41,59,' + (a || 0.22) + ')'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); }
  function circle(ctx, x, y, r, fill, lw) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = fill; ctx.fill(); if (lw !== 0) { ink(ctx, lw || 3); ctx.stroke(); } }
  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function box(ctx, x, y, w, h, r, fill, lw) { rrect(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); if (lw !== 0) { ink(ctx, lw || 3); ctx.stroke(); } }
  function poly(ctx, pts, fill, lw) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    if (lw !== 0) { ink(ctx, lw || 3); ctx.stroke(); }
  }
  function gear(ctx, x, y, r, teeth, rot, fill, lw) {
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const a = rot + i * Math.PI / teeth, rr = i % 2 ? r * 0.78 : r;
      const a1 = a - Math.PI / teeth * 0.35, a2 = a + Math.PI / teeth * 0.35;
      ctx.lineTo(x + Math.cos(a1) * rr, y + Math.sin(a1) * rr);
      ctx.lineTo(x + Math.cos(a2) * rr, y + Math.sin(a2) * rr);
    }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ink(ctx, lw || 2.5); ctx.stroke();
    circle(ctx, x, y, r * 0.3, shade(fill, -0.3), 2);
  }
  function rivet(ctx, x, y, r) { circle(ctx, x, y, r || 2, PAL.brassL, 1.2); }
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  MD.gfx = { INK, TAU, PAL, shade, ink, shadow, circle, rrect, box, poly, gear, rivet, rng };

  /* ===================== Chassis ===================== */
  /* kind decides how the tower attacks (engine.js implements each kind).
     pierce = armor ignored. detect = can target camo enemies. */
  const CHASSIS = [
    { id: 'dart', name: 'Clockwork Dart Turret', short: 'Dart', cost: 50, color: '#EA580C', kind: 'projectile',
      blurb: 'Rapid single-target darts.', range: 150, damage: 12, rate: 0.5, projSpeed: 720, pierce: 0, shots: 1 },
    { id: 'cryo', name: 'Cryo Frost Emitter', short: 'Cryo', cost: 85, color: '#7DD3FC', kind: 'pulse',
      blurb: 'Icy pulse slows everything nearby.', range: 115, damage: 4, rate: 1.5, slow: 0.4, slowTime: 1.6, pierce: 99 },
    { id: 'mortar', name: 'Alchemist Mortar', short: 'Mortar', cost: 120, color: '#65A30D', kind: 'shell',
      blurb: 'Lobs exploding flasks at packed groups. Cracks armor.', range: 230, damage: 44, rate: 2.1, splash: 70, flight: 0.85, pierce: 6, shots: 1 },
    { id: 'tesla', name: 'Tesla Arc Spire', short: 'Tesla', cost: 150, color: '#FACC15', kind: 'chain',
      blurb: 'Chain lightning. Sees camo and melts shields.', range: 140, damage: 22, rate: 1.1, chains: 4, chainRange: 95, pierce: 99, detect: true, shieldBonus: 2 },
    { id: 'laser', name: 'Prism Laser Beacon', short: 'Laser', cost: 140, color: '#F43F5E', kind: 'beam',
      blurb: 'Steady beam that heats up the longer it holds.', range: 160, damage: 16, rate: 0.1, ramp: 0.9, maxHeat: 4, pierce: 2, beams: 1 },
    { id: 'gravity', name: 'Gravity Well Generator', short: 'Gravity', cost: 130, color: '#F97316', kind: 'pull',
      blurb: 'Drags enemies backward along the path.', range: 120, damage: 6, rate: 2.4, pull: 55, pierce: 99 },
    { id: 'saw', name: 'Sawblade Launcher', short: 'Saw', cost: 100, color: '#94A3B8', kind: 'bounce',
      blurb: 'Blades ricochet between enemies.', range: 150, damage: 16, rate: 1.0, bounces: 3, bounceRange: 120, projSpeed: 520, pierce: 1, shots: 1 },
    { id: 'glue', name: 'Honey Glue Catapult', short: 'Glue', cost: 90, color: '#F59E0B', kind: 'puddle',
      blurb: 'Leaves sticky puddles that slow and sting.', range: 170, damage: 4, rate: 2.6, slow: 0.45, puddleR: 48, puddleTime: 4, pierce: 99, shots: 1 },
    { id: 'rail', name: 'Sniper Railgun', short: 'Railgun', cost: 200, color: '#2563EB', kind: 'rail',
      blurb: 'Hits anywhere on the board. Ignores armor, can crit.', range: 9999, damage: 85, rate: 2.6, pierce: 99, crit: 0.15, critMult: 3, shots: 1 },
    { id: 'tornado', name: 'Tornado Fan', short: 'Tornado', cost: 110, color: '#CBD5E1', kind: 'gust',
      blurb: 'Blows light enemies back toward the start.', range: 130, damage: 5, rate: 2.0, knock: 70, weight: 1, pierce: 99 },
    { id: 'beacon', name: 'Beacon Boost Tower', short: 'Beacon', cost: 160, color: '#FDE047', kind: 'aura',
      blurb: 'Boosts nearby towers and reveals camo to them.', range: 130, buffDmg: 0.15, buffRate: 0.1, detectAura: true },
    { id: 'siphon', name: 'Mana Siphon', short: 'Siphon', cost: 120, color: '#14B8A6', kind: 'income',
      blurb: 'Makes bonus energy every wave.', range: 0, perWave: 30, perSec: 0.4, perAnswer: 0 }
  ];

  /* ===================== 108 evolutions =====================
     Path A = Heavy Damage, Path B = Crowd Control / Utility, Path C = Speed / Multi-Shot. */
  const NAMES = {
    dart:    { A: ['Brass Bolter', 'Heavy Repeater', 'Cannonade Colossus'], B: ['Barbed Darter', 'Spyglass Darter', 'Stunlock Sentinel'], C: ['Twin-Spring Turret', 'Gatling Gearwork', 'Hailstorm Engine'] },
    cryo:    { A: ['Icicle Lancer', 'Glacier Hammer', 'Avalanche Core'], B: ['Deep Chill Emitter', 'Flash Freezer', 'Absolute Zero Spire'], C: ['Frost Ticker', 'Sleet Spinner', 'Blizzard Engine'] },
    mortar:  { A: ['Big Flask Mortar', 'Brimstone Bombard', "Philosopher's Payload"], B: ['Ember Tincture', 'Molten Mixture', 'Napalm Cauldron'], C: ['Double Distiller', 'Bubbling Barrage', 'Thousand-Flask Volley'] },
    tesla:   { A: ['High-Voltage Spire', 'Thunder Column', 'Zeus Dynamo'], B: ['Static Snare', 'Arc Web', 'Storm Lattice'], C: ['Rapid Relay', 'Spark Cascade', 'Lightning Loom'] },
    laser:   { A: ['Focused Prism', 'Solar Lance', 'Sunspear Array'], B: ['Searing Lens', 'Shred Ray', 'Piercing Spectrum'], C: ['Split Prism', 'Rainbow Fan', 'Kaleidoscope Cannon'] },
    gravity: { A: ['Dense Core', 'Crusher Well', 'Event Horizon'], B: ['Undertow Coil', 'Riptide Engine', 'Rewind Singularity'], C: ['Pulse Gyro', 'Quick Orbit', 'Spiral Accelerator'] },
    saw:     { A: ['Serrated Disc', 'Ripper Wheel', 'Buzzsaw Behemoth'], B: ['Jagged Edge', 'Ricochet Rack', 'Boomerang Mill'], C: ['Twin Blades', 'Blade Carousel', 'Sawstorm'] },
    glue:    { A: ['Hot Honey', 'Scalding Syrup', 'Molasses Meteor'], B: ['Sticky Patch', 'Tar Trap', 'Amber Prison'], C: ['Quick Lob', 'Drizzle Drum', 'Syrup Monsoon'] },
    rail:    { A: ['Long Rifle', 'Siege Rail', 'Doomsday Accelerator'], B: ['Spotter Scope', 'Armor Breaker', 'Paralyzer Rail'], C: ['Bolt-Action Rail', 'Semi-Auto Rail', 'Coil Storm'] },
    tornado: { A: ['Gale Blower', 'Cyclone Cannon', 'Typhoon Turbine'], B: ['Gust Snare', 'Downdraft', 'Hurricane Wall'], C: ['Whirligig', 'Twin Fan', 'Vortex Engine'] },
    beacon:  { A: ['War Drum Beacon', 'Battle Standard', 'Grand Commander'], B: ['Watchtower Lamp', 'Lighthouse Eye', 'All-Seeing Beacon'], C: ['Tempo Bell', 'Overclock Chime', 'Clockwork Conductor'] },
    siphon:  { A: ['Coin Funnel', 'Gilded Siphon', 'Midas Engine'], B: ["Scholar's Hourglass", 'Wisdom Well', 'Grand Library'], C: ['Trickle Tap', 'Steady Spring', 'Mana Geyser'] }
  };

  const PATHS = {
    A: { id: 'A', name: 'Heavy Damage', color: '#DC2626' },
    B: { id: 'B', name: 'Crowd Control', color: '#2563EB' },
    C: { id: 'C', name: 'Speed & Multi-Shot', color: '#D4A72C' }
  };
  const TIER_COST = [1, 3, 50];
  const SELL_RATE = 0.7;

  // Generic path scaling, tier index 0..2
  const A_DMG = [1.8, 4.5, 50], A_PIERCE = [2, 5, 12], A_RANGE = [1, 1.1, 1.18];
  const C_RATE = [0.7, 0.42, 0.15], C_SHOTS = [1, 1, 3];

  /* Path B effects are unique per chassis. Each returns changes for tier t (1..3). */
  const B_FX = {
    dart:    t => ({ hitSlow: [0.25, 0.35, 0.5][t - 1], hitSlowTime: 1.2, detect: t >= 2, stunChance: t >= 3 ? 0.15 : 0, stunTime: 0.5 }),
    cryo:    t => ({ slow: [0.55, 0.6, 0.7][t - 1], freezeChance: [0, 0.15, 0.3][t - 1], freezeTime: 0.9, rangeMul: t >= 3 ? 1.3 : 1.1, shatter: t >= 3 }),
    mortar:  t => ({ burn: [8, 18, 40][t - 1], burnTime: 3, stunChance: t >= 2 ? 0.25 : 0, stunTime: 0.35, napalm: t >= 3 }),
    tesla:   t => ({ stunChance: [0.1, 0.15, 0.22][t - 1], stunTime: 0.45, chainsAdd: [0, 2, 4][t - 1], shieldBonus: t >= 3 ? 4 : 2 }),
    laser:   t => ({ burn: [6, 12, 24][t - 1], burnTime: 2, shred: t >= 2 ? [0, 1.5, 3][t - 1] : 0, lineBeam: t >= 3 }),
    gravity: t => ({ pullAdd: [40, 80, 140][t - 1], hitSlow: t >= 2 ? 0.35 : 0, hitSlowTime: 1.5, crush: t >= 3 }),
    saw:     t => ({ bleed: [6, 12, 24][t - 1], bleedTime: 3, bouncesAdd: [0, 3, 6][t - 1], hitSlow: t >= 3 ? 0.3 : 0, hitSlowTime: 1 }),
    glue:    t => ({ slow: [0.6, 0.65, 0.78][t - 1], puddleTimeAdd: [2, 3, 4][t - 1], puddleRMul: [1, 1.4, 1.7][t - 1], stickChance: t >= 2 ? 0.2 : 0, dmgMul: t >= 3 ? 3 : 1 }),
    rail:    t => ({ detect: true, critAdd: [0.15, 0.2, 0.35][t - 1], shatterArmor: t >= 2, stunChance: t >= 3 ? 1 : 0, stunTime: 0.9 }),
    tornado: t => ({ knockAdd: [50, 100, 160][t - 1], weight: [1, 2, 3][t - 1], hitSlow: t >= 3 ? 0.4 : 0, hitSlowTime: 1.5 }),
    beacon:  t => ({ rangeMul: [1.15, 1.3, 1.5][t - 1], revealAll: t >= 3, slowAura: [0, 0.1, 0.2][t - 1] }),
    siphon:  t => ({ perAnswerAdd: [4, 10, 40][t - 1], perWaveAdd: [0, 20, 60][t - 1] })
  };

  function cost(ch, path, tier) {
    if (!tier) return ch.cost;
    return Math.round(ch.cost * TIER_COST[tier - 1] / 5) * 5;
  }

  /* Full stats for a chassis at a path + tier (tier 0 = base chassis). */
  function stats(chId, path, tier) {
    const ch = byId[chId];
    const s = Object.assign({}, ch);
    s.chassis = ch.id; s.path = tier ? path : null; s.tier = tier || 0;
    s.name = tier ? NAMES[ch.id][path][tier - 1] : ch.name;
    s.detect = !!ch.detect;
    s.spent = ch.cost;
    for (let t = 1; t <= (tier || 0); t++) s.spent += cost(ch, path, t);
    if (!tier) return s;
    const i = tier - 1;
    if (path === 'A') {
      if (ch.kind === 'aura') { s.buffDmg = ch.buffDmg * [1.7, 2.4, 3.4][i]; }
      else if (ch.kind === 'income') { s.perWave = Math.round(ch.perWave * [1.6, 3, 25][i]); }
      else {
        s.damage = ch.damage * A_DMG[i];
        s.pierce = (ch.pierce || 0) + A_PIERCE[i];
        if (ch.range < 9000) s.range = Math.round(ch.range * A_RANGE[i]);
        if (ch.kind === 'shell' || ch.kind === 'puddle') s.splash = ch.splash ? Math.round(ch.splash * [1.1, 1.25, 1.45][i]) : undefined;
        if (ch.kind === 'pull') s.pull = ch.pull + [10, 20, 40][i];
        if (ch.kind === 'gust') s.knock = ch.knock + [10, 20, 40][i];
      }
    } else if (path === 'C') {
      if (ch.kind === 'aura') { s.buffRate = ch.buffRate * [2, 3, 4.5][i]; }
      else if (ch.kind === 'income') { s.perSec = ch.perSec * [3, 8, 30][i]; }
      else {
        s.rate = ch.rate * C_RATE[i];
        let extra = 0; for (let k = 0; k <= i; k++) extra += C_SHOTS[k];
        if (ch.shots) s.shots = ch.shots + extra;
        if (ch.kind === 'chain') s.chains = ch.chains + extra;
        if (ch.kind === 'beam') { s.beams = 1 + extra; s.rate = ch.rate; s.ramp = ch.ramp * [1.3, 1.7, 2.3][i]; s.damage = ch.damage * [1.1, 1.8, 12][i]; }
      }
    } else {
      const fx = B_FX[ch.id](tier);
      Object.assign(s, fx);
      if (fx.rangeMul && ch.range) s.range = Math.round(ch.range * fx.rangeMul);
      if (fx.chainsAdd) s.chains = ch.chains + fx.chainsAdd;
      if (fx.pullAdd) s.pull = ch.pull + fx.pullAdd;
      if (fx.bouncesAdd) s.bounces = ch.bounces + fx.bouncesAdd;
      if (fx.knockAdd) s.knock = ch.knock + fx.knockAdd;
      if (fx.puddleTimeAdd) s.puddleTime = ch.puddleTime + fx.puddleTimeAdd;
      if (fx.puddleRMul) s.puddleR = Math.round(ch.puddleR * fx.puddleRMul);
      if (fx.dmgMul) s.damage = ch.damage * fx.dmgMul;
      if (fx.critAdd) s.crit = ch.crit + fx.critAdd;
      if (fx.perAnswerAdd) s.perAnswer = fx.perAnswerAdd;
      if (fx.perWaveAdd) s.perWave = ch.perWave + fx.perWaveAdd;
      s.damage = (s.damage || 0) * [1.3, 2.4, 20][i];
    }
    return s;
  }

  /* Short, kid-readable stat rows for menus and the Almanac. */
  function describe(s) {
    const rows = [];
    const k = s.kind;
    if (k === 'aura') {
      rows.push(['Boost range', s.range], ['Damage boost', '+' + Math.round(s.buffDmg * 100) + '%'], ['Speed boost', '+' + Math.round(s.buffRate * 100) + '%']);
      if (s.slowAura) rows.push(['Slows enemies', Math.round(s.slowAura * 100) + '%']);
      rows.push(['Reveals camo', s.revealAll ? 'Whole board' : 'Nearby towers']);
      return rows;
    }
    if (k === 'income') {
      rows.push(['Energy per wave', s.perWave], ['Energy per sec', s.perSec.toFixed(1)]);
      if (s.perAnswer) rows.push(['Bonus per answer', '+' + s.perAnswer]);
      return rows;
    }
    rows.push(['Range', s.range > 9000 ? 'Whole board' : s.range]);
    rows.push([k === 'beam' ? 'Damage/sec' : 'Damage', Math.round(s.damage)]);
    if (k !== 'beam') rows.push(['Attacks/sec', (1 / s.rate).toFixed(1)]);
    if (s.shots > 1) rows.push(['Shots', s.shots]);
    if (s.beams > 1) rows.push(['Beams', s.beams]);
    if (s.chains) rows.push(['Chains', s.chains]);
    if (s.bounces) rows.push(['Bounces', s.bounces]);
    if (s.splash) rows.push(['Blast', s.splash]);
    if (s.pierce && s.pierce < 99) rows.push(['Armor pierce', s.pierce]);
    if (s.pierce >= 99 && (k === 'rail' || k === 'chain')) rows.push(['Armor pierce', 'Full']);
    if (s.slow) rows.push(['Slow', Math.round(s.slow * 100) + '%']);
    if (s.hitSlow) rows.push(['Slow on hit', Math.round(s.hitSlow * 100) + '%']);
    if (s.freezeChance) rows.push(['Freeze chance', Math.round(s.freezeChance * 100) + '%']);
    if (s.stunChance) rows.push(['Stun chance', Math.round(s.stunChance * 100) + '%']);
    if (s.burn) rows.push(['Burn/sec', s.burn]);
    if (s.bleed) rows.push(['Bleed/sec', s.bleed]);
    if (s.crit) rows.push(['Crit chance', Math.round(s.crit * 100) + '%']);
    if (s.pull) rows.push(['Pull back', s.pull]);
    if (s.knock) rows.push(['Knock back', s.knock]);
    if (s.puddleTime) rows.push(['Puddle time', s.puddleTime + 's']);
    if (s.detect) rows.push(['Sees camo', 'Yes']);
    return rows;
  }

  const byId = {};
  CHASSIS.forEach(c => { byId[c.id] = c; });

  /* Every one of the 108 evolutions, in Almanac order. */
  const EVOLUTIONS = [];
  CHASSIS.forEach(c => ['A', 'B', 'C'].forEach(p => [1, 2, 3].forEach(t => EVOLUTIONS.push({ chassis: c.id, path: p, tier: t, name: NAMES[c.id][p][t - 1] }))));

  /* ===================== Tower art ===================== */
  const g = MD.gfx;

  function plinth(ctx, x, y, s) {
    shadow(ctx, x, y + 9, 31, 11);
    // wooden drum
    ctx.beginPath();
    ctx.moveTo(x - 25, y - 7); ctx.lineTo(x - 25, y + 4);
    ctx.ellipse(x, y + 4, 25, 10, 0, Math.PI, 0, true);
    ctx.lineTo(x + 25, y - 7); ctx.closePath();
    ctx.fillStyle = PAL.woodD; ctx.fill(); ink(ctx, 3); ctx.stroke();
    ctx.strokeStyle = 'rgba(30,41,59,0.3)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x - 14, y + 1); ctx.quadraticCurveTo(x - 12, y + 7, x - 15, y + 12); ctx.moveTo(x + 9, y + 1); ctx.quadraticCurveTo(x + 12, y + 7, x + 10, y + 13); ctx.stroke();
    // brass top ring
    ctx.beginPath(); ctx.ellipse(x, y - 7, 25, 10, 0, 0, TAU); ctx.fillStyle = PAL.brass; ctx.fill(); ink(ctx, 3); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y - 7, 19, 7, 0, 0, TAU); ctx.fillStyle = PAL.wood; ctx.fill(); ink(ctx, 2); ctx.stroke();
    rivet(ctx, x - 22, y - 6); rivet(ctx, x + 22, y - 6); rivet(ctx, x, y + 2.5);
    // tier pips in path color
    if (s.tier) {
      const col = PATHS[s.path].color;
      for (let i = 0; i < 3; i++) {
        const px = x - 12 + i * 12, py = y + 9;
        poly(ctx, [[px, py - 4], [px + 4, py], [px, py + 4], [px - 4, py]], i < s.tier ? col : '#E7DCC6', 1.8);
      }
    }
  }

  /* Path attachments drawn around/over each chassis. */
  function attachUnder(ctx, x, y, s, t) {
    if (!s.tier) return;
    if (s.path === 'A') {
      // brass armor plates bolted to the plinth
      box(ctx, x - 30, y - 10, 9, 16, 2, PAL.brass, 2.5); rivet(ctx, x - 25.5, y - 5, 1.6); rivet(ctx, x - 25.5, y + 1, 1.6);
      box(ctx, x + 21, y - 10, 9, 16, 2, PAL.brass, 2.5); rivet(ctx, x + 25.5, y - 5, 1.6); rivet(ctx, x + 25.5, y + 1, 1.6);
    } else if (s.path === 'B') {
      gear(ctx, x - 26, y - 2, 9, 7, t * 0.8, PAL.copper, 2);
      if (s.tier >= 2) gear(ctx, x + 26, y - 2, 9, 7, -t * 0.8, PAL.copper, 2);
    } else if (s.path === 'C') {
      // spinning flywheel on the side
      ctx.save(); ctx.translate(x + 27, y - 4);
      circle(ctx, 0, 0, 9, PAL.iron, 2.5);
      ctx.rotate(t * 8);
      ctx.strokeStyle = PAL.brassL; ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(7, 0); ctx.stroke(); }
      ctx.restore();
      if (s.tier >= 2) {
        ctx.save(); ctx.translate(x - 27, y - 4); circle(ctx, 0, 0, 9, PAL.iron, 2.5); ctx.rotate(-t * 8);
        ctx.strokeStyle = PAL.brassL; ctx.lineWidth = 2.5;
        for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(7, 0); ctx.stroke(); }
        ctx.restore();
      }
    }
  }

  function attachOver(ctx, x, y, s, t, topY) {
    if (!s.tier) return;
    const col = byId[s.chassis].color;
    if (s.path === 'A') {
      if (s.tier >= 2) {
        // spiked crown
        const cy = topY - 4;
        for (let i = -2; i <= 2; i++) poly(ctx, [[x + i * 7 - 4, cy], [x + i * 7, cy - 9 - (i === 0 ? 4 : 0)], [x + i * 7 + 4, cy]], PAL.brass, 2);
      }
      if (s.tier >= 3) {
        const p = 0.5 + 0.5 * Math.sin(t * 5);
        ctx.fillStyle = 'rgba(239,68,68,' + (0.18 + p * 0.2) + ')';
        ctx.beginPath(); ctx.arc(x, y - 18, 34, 0, TAU); ctx.fill();
      }
    } else if (s.path === 'B') {
      if (s.tier >= 2) {
        // antenna with chassis-colored gem
        ink(ctx, 3); ctx.beginPath(); ctx.moveTo(x + 14, y - 10); ctx.lineTo(x + 20, topY - 6); ctx.stroke();
        const gy = topY - 10 + Math.sin(t * 3) * 1.5;
        poly(ctx, [[x + 20, gy - 7], [x + 26, gy], [x + 20, gy + 7], [x + 14, gy]], col, 2.5);
      }
      if (s.tier >= 3) {
        for (let i = 0; i < 3; i++) {
          const a = t * 1.6 + i * TAU / 3;
          circle(ctx, x + Math.cos(a) * 30, y - 16 + Math.sin(a) * 11, 4.5, col, 2);
        }
      }
    } else if (s.path === 'C') {
      if (s.tier >= 3) {
        // turbine blades on a mast behind the top
        ctx.save(); ctx.translate(x - 18, topY - 2); ctx.rotate(t * 12);
        for (let i = 0; i < 4; i++) { ctx.rotate(TAU / 4); poly(ctx, [[0, 0], [10, -3], [11, 3]], PAL.brassL, 1.6); }
        ctx.restore();
        circle(ctx, x - 18, topY - 2, 2.5, INK, 0);
      }
    }
  }

  /* ---- 12 chassis tops. Each returns the y of its highest point. ---- */
  const TOPS = {
    dart(ctx, x, y, s, tw, t) {
      const a = tw.angle, rc = tw.recoil || 0, heavy = s.path === 'A' ? s.tier : 0;
      const barrels = s.path === 'C' ? Math.min(3, 1 + s.tier) : 1;
      ctx.save(); ctx.translate(x, y - 6);
      // wind-up key on the back
      ctx.save(); ctx.rotate(a + Math.PI); ctx.translate(16, 0); ctx.rotate(t * 3);
      box(ctx, -2, -2, 8, 4, 1, PAL.brass, 2); circle(ctx, 9, -4, 4, PAL.brass, 2); circle(ctx, 9, 4, 4, PAL.brass, 2);
      ctx.restore();
      ctx.rotate(a);
      const len = 24 + heavy * 3 - rc * 6, w = 8 + heavy * 2;
      for (let b = 0; b < barrels; b++) {
        const off = (b - (barrels - 1) / 2) * (w + 1);
        box(ctx, 2, off - w / 2, len, w, 3, PAL.ironD, 2.5);
        box(ctx, len - 4, off - w / 2 - 2, 7, w + 4, 2, PAL.brass, 2);
      }
      ctx.restore();
      circle(ctx, x, y - 6, 14, PAL.brass, 3);
      circle(ctx, x - 4, y - 10, 4.5, PAL.brassL, 0);
      circle(ctx, x, y - 6, 5, s.color, 2);
      return y - 22;
    },
    cryo(ctx, x, y, s, tw, t) {
      const glow = tw.recoil || 0;
      if (glow > 0) { ctx.fillStyle = 'rgba(186,230,253,' + glow * 0.5 + ')'; ctx.beginPath(); ctx.arc(x, y - 24, 30 + glow * 8, 0, TAU); ctx.fill(); }
      // copper base cup and glass tube
      box(ctx, x - 13, y - 20, 26, 12, 4, PAL.copper, 3);
      box(ctx, x - 10, y - 50, 20, 32, 10, 'rgba(224,242,254,0.85)', 3);
      // crystal inside
      poly(ctx, [[x, y - 46], [x + 6, y - 34], [x, y - 22], [x - 6, y - 34]], s.color, 2);
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 6, y - 44); ctx.lineTo(x - 6, y - 28); ctx.stroke();
      // copper bands
      box(ctx, x - 12, y - 40, 24, 4, 2, PAL.copper, 2); box(ctx, x - 12, y - 28, 24, 4, 2, PAL.copper, 2);
      // snowflake cap
      ctx.save(); ctx.translate(x, y - 58); ctx.rotate(t * 0.8);
      for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI / 3); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.stroke(); ctx.strokeStyle = '#FFF'; ctx.lineWidth = 2.5; ctx.stroke(); }
      ctx.restore();
      return y - 64;
    },
    mortar(ctx, x, y, s, tw, t) {
      const rc = tw.recoil || 0, dir = Math.cos(tw.angle) >= 0 ? 1 : -1, big = s.path === 'A' ? s.tier * 2 : 0;
      ctx.save(); ctx.translate(x, y - 12); ctx.rotate(dir * 0.45);
      // flask-shaped barrel
      ctx.beginPath(); ctx.arc(0, 0, 13 + big, 0, TAU); ctx.fillStyle = 'rgba(220,252,231,0.9)'; ctx.fill(); ink(ctx, 3); ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 11.5 + big, 0, TAU); ctx.clip();
      ctx.fillStyle = s.color; ctx.fillRect(-20, -2 + Math.sin(t * 4) * 1.5, 40, 30); ctx.restore();
      box(ctx, -5, -30 + rc * 6 - big, 10, 20, 2, 'rgba(220,252,231,0.9)', 3);
      box(ctx, -7, -34 + rc * 6 - big, 14, 6, 2, PAL.brass, 2.5);
      circle(ctx, -3, 2 + Math.sin(t * 6) * 3, 2, '#ECFCCB', 0); circle(ctx, 4, 5 + Math.cos(t * 5) * 3, 1.5, '#ECFCCB', 0);
      ctx.restore();
      box(ctx, x - 18, y - 12, 36, 9, 3, PAL.brass, 2.5);
      return y - 44 - big;
    },
    tesla(ctx, x, y, s, tw, t) {
      const rc = tw.recoil || 0, h = 38 + (s.tier >= 3 ? 8 : 0);
      box(ctx, x - 7, y - h, 14, h, 4, PAL.woodD, 3);
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(x, y - 8 - i * (h - 12) / 4, 13 - i * 1.5, 4.5, 0, 0, TAU); ctx.fillStyle = PAL.copper; ctx.fill(); ink(ctx, 2.5); ctx.stroke(); }
      const oy = y - h - 9, pulse = 0.5 + 0.5 * Math.sin(t * 7) + rc;
      ctx.fillStyle = 'rgba(254,240,138,' + Math.min(0.6, 0.15 + pulse * 0.2) + ')'; ctx.beginPath(); ctx.arc(x, oy, 16 + rc * 6, 0, TAU); ctx.fill();
      circle(ctx, x, oy, 9, s.color, 3); circle(ctx, x - 3, oy - 3, 3, '#FFF', 0);
      return oy - 10;
    },
    laser(ctx, x, y, s, tw, t) {
      // brass tripod and rotating prism
      ink(ctx, 3); ctx.beginPath(); ctx.moveTo(x - 14, y - 6); ctx.lineTo(x, y - 30); ctx.lineTo(x + 14, y - 6); ctx.moveTo(x, y - 30); ctx.lineTo(x, y - 6); ctx.stroke();
      ctx.strokeStyle = PAL.brass; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.translate(x, y - 38); ctx.rotate(tw.angle + Math.PI / 2);
      poly(ctx, [[0, -14], [12, 8], [-12, 8]], 'rgba(255,228,230,0.9)', 3);
      poly(ctx, [[0, -14], [12, 8], [2, 8]], s.color, 0);
      ink(ctx, 3); ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(12, 8); ctx.lineTo(-12, 8); ctx.closePath(); ctx.stroke();
      circle(ctx, 0, -14, 4, PAL.brass, 2);
      ctx.restore();
      const heat = (tw.heat || 0) / 4;
      if (heat > 0.05) { ctx.fillStyle = 'rgba(244,63,94,' + heat * 0.35 + ')'; ctx.beginPath(); ctx.arc(x, y - 38, 20, 0, TAU); ctx.fill(); }
      return y - 56;
    },
    gravity(ctx, x, y, s, tw, t) {
      const cy = y - 30;
      box(ctx, x - 4, y - 18, 8, 14, 2, PAL.brassD, 2.5);
      // gyroscope rings
      for (let i = 0; i < 2; i++) {
        ctx.save(); ctx.translate(x, cy); ctx.rotate(t * (i ? -1.4 : 1.1) + i);
        ctx.beginPath(); ctx.ellipse(0, 0, 21, 8, 0, 0, TAU); ink(ctx, 5); ctx.stroke();
        ctx.strokeStyle = i ? PAL.copper : PAL.brass; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.restore();
      }
      circle(ctx, x, cy, 11, '#1E293B', 3);
      ctx.strokeStyle = s.color; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, cy, 6, t * 3, t * 3 + 4); ctx.stroke();
      return cy - 22;
    },
    saw(ctx, x, y, s, tw, t) {
      const a = tw.angle;
      ctx.save(); ctx.translate(x, y - 10); ctx.rotate(a);
      box(ctx, -6, -9, 30, 18, 4, PAL.ironD, 3);
      ctx.restore();
      const n = s.path === 'C' ? Math.min(3, 1 + s.tier) : 1;
      for (let i = 0; i < n; i++) {
        const ox = (i - (n - 1) / 2) * 12;
        g.gear(ctx, x + ox, y - 26 - i % 2 * 4, 14 + (s.path === 'A' ? s.tier * 2 : 0), 10, t * 10 + i, '#CBD5E1', 2.5);
      }
      return y - 44;
    },
    glue(ctx, x, y, s, tw, t) {
      const dir = Math.cos(tw.angle) >= 0 ? 1 : -1, rc = tw.recoil || 0;
      box(ctx, x - 16, y - 16, 32, 9, 3, PAL.woodD, 2.5);
      // catapult arm
      ctx.save(); ctx.translate(x, y - 14); ctx.rotate(-dir * (0.5 + rc * 0.9));
      box(ctx, -3, -36, 6, 38, 2, PAL.wood, 2.5);
      // honey pot cup
      ctx.beginPath(); ctx.arc(0, -36, 9, 0, Math.PI); ctx.fillStyle = PAL.woodL; ctx.fill(); ink(ctx, 2.5); ctx.stroke();
      if (rc < 0.3) { ctx.beginPath(); ctx.ellipse(0, -37, 7, 4, 0, 0, TAU); ctx.fillStyle = s.color; ctx.fill(); ink(ctx, 2); ctx.stroke(); }
      ctx.restore();
      circle(ctx, x, y - 14, 4, PAL.brass, 2);
      return y - 52;
    },
    rail(ctx, x, y, s, tw, t) {
      const a = tw.angle, rc = tw.recoil || 0, len = 40 + (s.path === 'A' ? s.tier * 5 : 0) - rc * 8;
      ctx.save(); ctx.translate(x, y - 12); ctx.rotate(a);
      box(ctx, -12, -6, 20, 12, 3, PAL.ironD, 3);
      box(ctx, 4, -8, len, 5, 2, '#93C5FD', 2.5);
      box(ctx, 4, 3, len, 5, 2, '#93C5FD', 2.5);
      for (let i = 0; i < 3; i++) box(ctx, 10 + i * (len - 12) / 3, -9, 4, 18, 1, PAL.brass, 1.8);
      // scope
      box(ctx, -6, -16, 18, 6, 3, INK, 0); circle(ctx, 12, -13, 3, '#BFDBFE', 1.8);
      ctx.restore();
      return y - 30;
    },
    tornado(ctx, x, y, s, tw, t) {
      const cy = y - 30;
      box(ctx, x - 4, y - 18, 8, 12, 2, PAL.brassD, 2.5);
      circle(ctx, x, cy, 19, 'rgba(241,245,249,0.9)', 3);
      ctx.save(); ctx.translate(x, cy); ctx.rotate(t * 14 * (s.path === 'C' ? 1.6 : 1));
      for (let i = 0; i < 4; i++) { ctx.rotate(TAU / 4); poly(ctx, [[0, 0], [15, -5], [15, 4]], '#94A3B8', 1.8); }
      ctx.restore();
      // brass cage wires
      ink(ctx, 2); ctx.beginPath(); ctx.moveTo(x - 19, cy); ctx.lineTo(x + 19, cy); ctx.moveTo(x, cy - 19); ctx.lineTo(x, cy + 19); ctx.stroke();
      ctx.strokeStyle = PAL.brass; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, cy, 19, 0, TAU); ctx.stroke();
      circle(ctx, x, cy, 4, PAL.brass, 2);
      return cy - 22;
    },
    beacon(ctx, x, y, s, tw, t) {
      // lighthouse stack
      poly(ctx, [[x - 12, y - 8], [x - 8, y - 42], [x + 8, y - 42], [x + 12, y - 8]], '#F8FAFC', 3);
      ctx.fillStyle = PAL.red; ctx.fillRect(x - 10.5, y - 26, 21, 7);
      ink(ctx, 2); ctx.strokeRect(x - 10.5, y - 26, 21, 7);
      box(ctx, x - 11, y - 56, 22, 14, 4, 'rgba(254,249,195,0.95)', 3);
      poly(ctx, [[x - 13, y - 56], [x, y - 66], [x + 13, y - 56]], PAL.brass, 3);
      // rotating lamp beam
      const a = t * 2.5, bx = Math.cos(a) * 26;
      ctx.fillStyle = 'rgba(253,224,71,0.35)';
      ctx.beginPath(); ctx.moveTo(x, y - 49); ctx.lineTo(x + bx, y - 58); ctx.lineTo(x + bx, y - 40); ctx.closePath(); ctx.fill();
      circle(ctx, x, y - 49, 4, s.color, 2);
      return y - 68;
    },
    siphon(ctx, x, y, s, tw, t) {
      // hourglass with mana sand
      box(ctx, x - 14, y - 14, 28, 5, 2, PAL.brass, 2.5);
      box(ctx, x - 14, y - 52, 28, 5, 2, PAL.brass, 2.5);
      poly(ctx, [[x - 11, y - 47], [x + 11, y - 47], [x + 2, y - 31], [x + 11, y - 14], [x - 11, y - 14], [x - 2, y - 31]], 'rgba(204,251,241,0.85)', 3);
      const f = (t * 0.25) % 1;
      poly(ctx, [[x - 8 + f * 6, y - 44 + f * 10], [x + 8 - f * 6, y - 44 + f * 10], [x, y - 33]], s.color, 0);
      poly(ctx, [[x - 9, y - 16], [x + 9, y - 16], [x, y - 20 - f * 9]], s.color, 0);
      ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 32); ctx.lineTo(x, y - 18); ctx.stroke();
      ink(ctx, 2); ctx.beginPath(); ctx.moveTo(x - 13, y - 47); ctx.lineTo(x - 13, y - 14); ctx.moveTo(x + 13, y - 47); ctx.lineTo(x + 13, y - 14); ctx.stroke();
      // sparkles drifting in
      for (let i = 0; i < 3; i++) { const k = (t * 0.6 + i / 3) % 1, a = i * 2.1; circle(ctx, x + Math.cos(a) * 28 * (1 - k), y - 32 + Math.sin(a) * 16 * (1 - k), 2.2, s.color, 1.2); }
      return y - 56;
    }
  };

  /* tw: { x, y, chassis, path, tier, angle, recoil, pop, heat } */
  function drawTower(ctx, tw, t) {
    const s = tw.stats || stats(tw.chassis, tw.path, tw.tier);
    const x = tw.x, y = tw.y;
    const pop = tw.pop || 0, sq = 1 + Math.sin(pop * 18) * pop * 0.5;
    ctx.save();
    ctx.translate(x, y + 8); ctx.scale(1 / sq, sq); ctx.translate(-x, -y - 8);
    attachUnder(ctx, x, y, s, t);
    plinth(ctx, x, y - 2, s);
    const top = TOPS[s.chassis](ctx, x, y - 10, s, tw, t);
    attachOver(ctx, x, y - 10, s, t, top);
    ctx.restore();
  }

  function drawIcon(canvas, chassis, path, tier, t) {
    const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const sc = Math.min(w, h) / 92;
    ctx.save(); ctx.scale(sc, sc);
    drawTower(ctx, { x: 46, y: 70, chassis, path, tier, angle: -0.5, recoil: 0, pop: 0, heat: 0 }, t || 0.7);
    ctx.restore();
  }

  MD.Towers = { CHASSIS, PATHS, NAMES, EVOLUTIONS, SELL_RATE, byId, cost, stats, describe, drawTower, drawIcon };
})(globalThis.MD = globalThis.MD || {});
