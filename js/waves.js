/* Math Defenders — waves.js
   Enemy roster, the 100-wave campaign, milestone starts, and enemy art. */
(function (MD) {
  'use strict';
  const { INK, TAU, PAL, shade, ink, shadow, circle, box, poly, gear, rivet } = MD.gfx;

  /* weight: 1 light, 2 medium, 3 heavy, 9 boss (Tornado path B pushes heavier weights).
     resist: fraction of slow/stun/push ignored. regen: fraction of max HP per second. */
  const ENEMIES = {
    scout:    { name: 'Paper Scout', hp: 30, speed: 100, armor: 0, radius: 13, bounty: 2, leak: 1, weight: 1, color: '#F4EBDD', blurb: 'Fast folded-paper flyer.' },
    shield:   { name: 'Wooden Shieldbearer', hp: 90, speed: 48, armor: 3, radius: 17, bounty: 4, leak: 1, weight: 2, color: '#B07A45', blurb: 'Plank shield blocks weak hits.' },
    swarm:    { name: 'Clockwork Swarm', hp: 14, speed: 78, armor: 0, radius: 9, bounty: 1, leak: 1, weight: 1, color: '#D4A72C', blurb: 'Tiny wind-up beetles in big groups.' },
    ironclad: { name: 'Iron Ironclad', hp: 300, speed: 34, armor: 14, radius: 22, bounty: 10, leak: 3, weight: 3, color: '#64748B', blurb: 'Heavy armor. Use Railgun or Mortar.' },
    phantom:  { name: 'Camo Moth', hp: 60, speed: 88, armor: 0, radius: 13, bounty: 4, leak: 1, weight: 1, color: '#E7E5E4', camo: true, blurb: 'Camo. Needs Tesla or a Beacon to be seen.' },
    warden:   { name: 'Shield Warden', hp: 110, shield: 160, speed: 50, armor: 2, radius: 17, bounty: 6, leak: 2, weight: 2, color: '#A16207', blurb: 'Energy bubble. Tesla breaks it fast.' },
    elite:    { name: 'Brass Knight', hp: 420, speed: 55, armor: 6, radius: 19, bounty: 12, leak: 3, weight: 3, color: '#D4A72C', resist: 1, blurb: 'Immune to slow, stun and push.' },
    boss:     { name: 'Gearlord', hp: 2400, speed: 26, armor: 6, radius: 36, bounty: 80, leak: 10, weight: 9, color: '#8A6A12', resist: 0.5, boss: true, blurb: 'Boss every 10 waves. Regenerates from wave 50.' },
    dread:    { name: 'Mega-Dreadnought', hp: 5500, speed: 20, armor: 12, radius: 46, bounty: 250, leak: 15, weight: 9, color: '#475569', resist: 0.75, regen: 0.005, boss: true, blurb: 'Late-game titan. Regenerates.' }
  };

  const TOTAL = 100;
  const MILESTONES = [
    { wave: 1, energy: 25, label: 'Wave 1' },
    { wave: 25, energy: 5500, label: 'Wave 25' },
    { wave: 50, energy: 45000, label: 'Wave 50' },
    { wave: 75, energy: 140000, label: 'Wave 75' }
  ];

  const ERAS = [
    { from: 1, to: 24, name: 'Foundations' },
    { from: 25, to: 49, name: 'First Major Spike' },
    { from: 50, to: 74, name: 'Tactical Mastery' },
    { from: 75, to: 100, name: 'Nightmare Gauntlet' }
  ];
  const eraFor = n => ERAS.find(e => n >= e.from && n <= e.to) || ERAS[3];

  function hpMult(n) {
    // Growth eases after wave 60 so a perfect board can push deep; wave 100 stays brutal.
    const k = n <= 60 ? n - 1 : 59 + (n - 60) * 0.6;
    return (1 + 0.1 * k + 0.004 * k * k) * Math.pow(1.017, k) * (n >= 25 ? 1.3 : 1);
  }

  /* Energy economy scales with the wave so late towers stay affordable. */
  const answerEnergy = n => Math.round(25 * (1 + (n - 1) * 0.05));
  const bountyMult = n => 1 + n * 0.004;
  const clearBonus = n => 10 + Math.round(n * 1.5);

  /* A wave is a list of groups: { type, count, gap, at, fast } */
  function makeWave(n) {
    const g = [];
    const gapMul = Math.max(0.35, 1 - n * 0.0065);
    const add = (type, count, gap, at, extra) => { count = Math.round(count); if (count > 0) g.push(Object.assign({ type, count, gap: gap * gapMul, at }, extra || {})); };

    if (n === 1) { add('scout', 5, 2.4, 0); return g; }
    if (n === 2) { add('scout', 8, 1.8, 0); return g; }
    if (n === 3) { add('scout', 6, 1.6, 0); add('shield', 2, 3, 8); return g; }
    if (n === 4) { add('scout', 6, 1.4, 0); add('swarm', 10, 0.35, 6); return g; }

    // Foundations core, always present
    add('scout', 4 + n * 0.5, 1.1, 0);
    add('shield', Math.min(14, n / 3), 2.2, 3);
    add('swarm', Math.min(40, 6 + n * 1.2), 0.25, 6, n >= 75 ? { fast: 1.6 } : null);

    if (n >= 25) {
      add('ironclad', Math.min(12, 1 + (n - 25) / 4), 3, 8);
      add('phantom', Math.min(18, 3 + (n - 25) / 2.5), 0.9, 4);
      add('warden', Math.min(12, 1 + (n - 25) / 3.5), 2.4, 10);
    }
    if (n >= 50) {
      add('elite', Math.min(9, 1 + (n - 50) / 3), 2.2, 12);
      add('swarm', Math.min(50, 20 + (n - 50)), 0.15, 16, n >= 75 ? { fast: 1.6 } : null);
    }
    if (n >= 75) {
      add('scout', Math.min(40, 10 + (n - 75)), 0.3, 18, { fast: 1.5 });
      add('elite', Math.min(5, (n - 70) / 5), 1.8, 22);
    }
    if (n % 10 === 0) add('boss', n >= 60 ? 2 : 1, 8, 14);
    if (n >= 75 && n % 5 === 0) add('dread', n === 100 ? 3 : n >= 90 ? 2 : 1, 10, 20);
    return g;
  }

  function waveSize(n) { return makeWave(n).reduce((s, gr) => s + gr.count, 0); }

  /* ===================== Enemy art ===================== */
  function hpBar(ctx, x, y, w, h, f, shieldF, boss) {
    box(ctx, x - w / 2 - 2, y - 2, w + 4, h + 4, 3, INK, 0);
    ctx.fillStyle = '#334155'; ctx.fillRect(x - w / 2, y, w, h);
    ctx.fillStyle = f > 0.5 ? '#4ADE80' : f > 0.25 ? '#FACC15' : '#EF4444';
    ctx.fillRect(x - w / 2, y, Math.max(0, w * f), h);
    if (shieldF > 0) { ctx.fillStyle = '#93C5FD'; ctx.fillRect(x - w / 2, y, w * shieldF, Math.max(2, h / 2)); }
    if (boss) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x - w / 2, y, Math.max(0, w * f), 3); }
  }

  const DRAW = {
    scout(ctx, e) {
      const r = e.radius;
      ctx.save(); ctx.rotate(e.a);
      ctx.strokeStyle = 'rgba(30,41,59,0.3)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-r - 4, -4); ctx.lineTo(-r - 14, -4); ctx.moveTo(-r - 2, 5); ctx.lineTo(-r - 15, 5); ctx.stroke();
      poly(ctx, [[r + 6, 0], [-r, -r], [-r * 0.4, 0]], '#FFFFFF', 2.5);
      poly(ctx, [[r + 6, 0], [-r * 0.4, 0], [-r, r]], PAL.paper, 2.5);
      ctx.strokeStyle = '#D6CBB8'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(r + 4, 0); ctx.lineTo(-r * 0.4, 0); ctx.stroke();
      ctx.fillStyle = e.fast ? '#DC2626' : '#2563EB'; ctx.fillRect(-r * 0.7, -2, 5, 4);
      ctx.restore();
    },
    shield(ctx, e, face) {
      const r = e.radius, st = Math.sin(e.wob * 2) * 3;
      box(ctx, -7 + st, r * 0.5, 5, 8, 2, PAL.woodD, 2); box(ctx, 2 - st, r * 0.5, 5, 8, 2, PAL.woodD, 2);
      box(ctx, -9, -r * 0.4, 18, r * 1.1, 6, PAL.wood, 3);
      circle(ctx, 0, -r * 0.7, 8, PAL.woodL, 3);
      circle(ctx, face * 3, -r * 0.75, 1.8, INK, 0);
      // plank shield in front
      box(ctx, face * 7 - 4, -r * 0.55, 9, r * 1.2, 2, '#9A6B3F', 3);
      ctx.strokeStyle = 'rgba(30,41,59,0.45)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(face * 7 - 4, -r * 0.1); ctx.lineTo(face * 7 + 5, -r * 0.1); ctx.moveTo(face * 7 - 4, r * 0.3); ctx.lineTo(face * 7 + 5, r * 0.3); ctx.stroke();
      rivet(ctx, face * 7 + 0.5, -r * 0.35, 1.6);
    },
    swarm(ctx, e, face, t) {
      const r = e.radius;
      for (let i = -1; i <= 1; i++) { const l = Math.sin(e.wob * 3 + i) * 2; ink(ctx, 1.5); ctx.beginPath(); ctx.moveTo(i * 4, 2); ctx.lineTo(i * 5 + l, r + 1); ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(0, 0, r + 1, r * 0.8, 0, 0, TAU); ctx.fillStyle = e.fast ? '#EA580C' : PAL.brass; ctx.fill(); ink(ctx, 2.2); ctx.stroke();
      ctx.strokeStyle = PAL.brassD; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -r * 0.8); ctx.lineTo(0, r * 0.8); ctx.stroke();
      // wind-up key
      ctx.save(); ctx.translate(-face * (r + 2), -2); ctx.rotate(t * 8);
      box(ctx, -1, -4, 2, 8, 1, PAL.brassL, 1.2); ctx.restore();
      circle(ctx, face * (r - 2), -2, 1.6, INK, 0);
    },
    ironclad(ctx, e, face, t) {
      const r = e.radius;
      box(ctx, -r - 2, r * 0.2, r * 2 + 4, 12, 6, '#334155', 3);
      const roll = (e.dist * 0.5) % 8;
      for (let i = -2; i <= 2; i++) circle(ctx, i * 9 + (roll - 4) * 0.15, r * 0.2 + 6, 3.2, '#94A3B8', 1.8);
      box(ctx, -r, -r * 0.65, r * 2, r * 0.9, 5, '#94A3B8', 3);
      for (let i = -2; i <= 2; i++) rivet(ctx, i * 7, -r * 0.45, 1.6);
      box(ctx, -8, -r * 0.65 - 10, 16, 11, 3, '#64748B', 2.5);
      // chimney + puffs
      box(ctx, -face * 12 - 3, -r * 0.65 - 16, 6, 12, 1, INK, 0);
      const p = (t * 1.5 + e.id * 0.3) % 1;
      ctx.globalAlpha = 1 - p; circle(ctx, -face * (12 + p * 6), -r - 18 - p * 14, 3 + p * 4, '#E2E8F0', 1.5); ctx.globalAlpha = 1;
      box(ctx, face > 0 ? 6 : -22, -r * 0.65 - 7, 16, 4, 2, INK, 0);
    },
    phantom(ctx, e, face, t) {
      const r = e.radius, flap = Math.sin(t * 16 + e.id) * 0.5 + 0.5;
      ctx.globalAlpha = e.revealed ? 1 : 0.5;
      if (!e.revealed) ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.ellipse(-6, -2, 9, 4 + flap * 7, -0.6, 0, TAU); ctx.ellipse(6, -2, 9, 4 + flap * 7, 0.6, 0, TAU);
      ctx.fillStyle = '#E7E5E4'; ctx.fill(); ink(ctx, 2); ctx.stroke();
      ctx.setLineDash([]);
      box(ctx, -3, -8, 6, 16, 3, '#A8A29E', 2);
      ink(ctx, 1.5); ctx.beginPath(); ctx.moveTo(-2, -8); ctx.lineTo(-5, -14); ctx.moveTo(2, -8); ctx.lineTo(5, -14); ctx.stroke();
      ctx.globalAlpha = 1;
    },
    warden(ctx, e, face, t) {
      const r = e.radius;
      DRAW.shield(ctx, e, face);
      if (e.shield > 0) {
        const f = e.shield / e.maxShield;
        ctx.fillStyle = 'rgba(147,197,253,' + (0.18 + f * 0.2) + ')';
        ctx.beginPath(); ctx.arc(0, -2, r + 9, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(37,99,235,' + (0.4 + f * 0.5) + ')'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, -2, r + 5, 3.6 + t, 4.4 + t); ctx.stroke();
      }
    },
    elite(ctx, e, face, t) {
      const r = e.radius, st = Math.sin(e.wob * 2) * 3;
      box(ctx, -8 + st, r * 0.5, 6, 9, 2, PAL.brassD, 2); box(ctx, 2 - st, r * 0.5, 6, 9, 2, PAL.brassD, 2);
      box(ctx, -11, -r * 0.4, 22, r * 1.15, 6, PAL.brass, 3);
      ctx.strokeStyle = PAL.brassD; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-11, r * 0.1); ctx.lineTo(11, r * 0.1); ctx.stroke();
      // helmet + plume
      box(ctx, -9, -r - 4, 18, 15, 6, PAL.brassL, 3);
      ctx.fillStyle = INK; ctx.fillRect(face > 0 ? -1 : -7, -r + 2, 8, 3);
      poly(ctx, [[-2, -r - 4], [-face * 12, -r - 14], [-face * 4, -r - 2]], '#DC2626', 2);
      // immunity ring
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.arc(0, -2, r + 6, t, t + TAU); ctx.stroke(); ctx.setLineDash([]);
    },
    boss(ctx, e, face, t) {
      const r = e.radius;
      gear(ctx, 0, -2, r, 12, t * 0.6, PAL.brass, 4);
      circle(ctx, 0, -2, r * 0.62, '#FDE68A', 3);
      // face
      const blink = Math.sin(t * 2 + e.id) > 0.97;
      box(ctx, -r * 0.42 + face * 3, -r * 0.3, r * 0.3, blink ? 3 : r * 0.22, 3, INK, 0);
      box(ctx, r * 0.12 + face * 3, -r * 0.3, r * 0.3, blink ? 3 : r * 0.22, 3, INK, 0);
      ink(ctx, 3); ctx.beginPath(); ctx.moveTo(-r * 0.3, r * 0.2); ctx.lineTo(-r * 0.1, r * 0.12); ctx.lineTo(r * 0.1, r * 0.2); ctx.lineTo(r * 0.3, r * 0.12); ctx.stroke();
      if (e.regen) { ctx.strokeStyle = 'rgba(74,222,128,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -2, r + 6, -t * 2, -t * 2 + 1.5); ctx.stroke(); }
    },
    dread(ctx, e, face, t) {
      const r = e.radius;
      // hull
      ctx.beginPath();
      ctx.moveTo(-r * 1.15, -r * 0.1); ctx.lineTo(r * 1.15, -r * 0.1); ctx.lineTo(r * 0.85, r * 0.6); ctx.lineTo(-r * 0.85, r * 0.6); ctx.closePath();
      ctx.fillStyle = '#64748B'; ctx.fill(); ink(ctx, 4); ctx.stroke();
      ctx.fillStyle = '#DC2626'; ctx.fillRect(-r * 0.95, r * 0.3, r * 1.9, 6); ink(ctx, 2); ctx.strokeRect(-r * 0.95, r * 0.3, r * 1.9, 6);
      for (let i = -4; i <= 4; i++) rivet(ctx, i * r * 0.22, r * 0.12, 2);
      // deck + stacks
      box(ctx, -r * 0.6, -r * 0.55, r * 1.2, r * 0.48, 5, '#94A3B8', 3);
      for (let i = 0; i < 2; i++) {
        const sx = -r * 0.3 + i * r * 0.45;
        box(ctx, sx - 6, -r * 0.95, 12, r * 0.45, 2, INK, 0);
        const p = (t * 1.2 + i * 0.5) % 1;
        ctx.globalAlpha = 1 - p; circle(ctx, sx - face * p * 10, -r - p * 20, 5 + p * 6, '#CBD5E1', 2); ctx.globalAlpha = 1;
      }
      gear(ctx, face * r * 0.75, -r * 0.35, 12, 8, t * 2, PAL.brass, 2.5);
      box(ctx, face > 0 ? r * 0.1 : -r * 0.9, -r * 0.42, r * 0.8, 6, 3, INK, 0);
      if (e.regen) { ctx.strokeStyle = 'rgba(74,222,128,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r + 10, t * 2, t * 2 + 1.2); ctx.stroke(); }
    }
  };

  function drawEnemy(ctx, e, t) {
    const x = e.x, y = e.y, d = e.def;
    const sq = e.hitT / 0.16, sx = 1 + sq * 0.22, sy = 1 - sq * 0.18;
    const bob = (e.stunT > 0 || e.freezeT > 0) ? 0 : Math.sin(e.wob) * (d.boss ? 1.5 : 2);
    const face = Math.cos(e.a) < -0.1 ? -1 : 1;
    shadow(ctx, x, y + e.radius * 0.75, e.radius * 0.95, e.radius * 0.34);
    ctx.save();
    ctx.translate(x, y + e.radius * 0.7); ctx.scale(sx, sy); ctx.translate(0, -e.radius * 0.7 + bob);
    DRAW[e.type](ctx, e, face, t);
    if (e.hitT > 0.08) { ctx.globalAlpha = 0.45; ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.restore();

    // status overlays
    if (e.freezeT > 0) {
      ctx.fillStyle = 'rgba(186,230,253,0.6)'; box(ctx, x - e.radius - 3, y - e.radius - 3, e.radius * 2 + 6, e.radius * 2 + 6, 5, 'rgba(186,230,253,0.55)', 2);
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - e.radius + 2, y - e.radius + 6); ctx.lineTo(x - e.radius + 8, y - e.radius); ctx.stroke();
    } else if (e.slow > 0) {
      ctx.fillStyle = 'rgba(186,230,253,0.4)'; ctx.beginPath(); ctx.arc(x, y, e.radius + 3, 0, TAU); ctx.fill();
    }
    if (e.glueT > 0) { for (let i = 0; i < 3; i++) circle(ctx, x - 8 + i * 8, y + e.radius * 0.7, 3.5, '#F59E0B', 1.5); }
    if (e.stunT > 0) {
      for (let i = 0; i < 3; i++) {
        const a = t * 6 + i * 2.1, sx2 = x + Math.cos(a) * (e.radius * 0.8), sy2 = y - e.radius - 6 + Math.sin(a) * 3;
        poly(ctx, [[sx2, sy2 - 4], [sx2 + 1.5, sy2 - 1], [sx2 + 4, sy2], [sx2 + 1.5, sy2 + 1], [sx2, sy2 + 4], [sx2 - 1.5, sy2 + 1], [sx2 - 4, sy2], [sx2 - 1.5, sy2 - 1]], '#FDE047', 1.2);
      }
    }
    if (e.burnT > 0) {
      const f = Math.sin(t * 20 + e.id) * 2;
      poly(ctx, [[x - 5, y - e.radius * 0.2], [x, y - e.radius * 0.2 - 12 - f], [x + 5, y - e.radius * 0.2]], '#F97316', 1.5);
      poly(ctx, [[x - 2.5, y - e.radius * 0.2], [x, y - e.radius * 0.2 - 6 - f], [x + 2.5, y - e.radius * 0.2]], '#FDE047', 0);
    }
    if (e.bleedT > 0) circle(ctx, x + e.radius * 0.6, y + 2 + ((t * 30) % 8), 2, '#DC2626', 1);

    const showBar = d.boss || e.hp < e.maxHp || (e.maxShield && e.shield < e.maxShield);
    if (showBar) {
      const w = d.boss ? (e.type === 'dread' ? 110 : 80) : Math.max(24, e.radius * 2);
      hpBar(ctx, x, y - e.radius - (d.boss ? 24 : 11) + bob, w, d.boss ? 9 : 5, Math.max(0, e.hp / e.maxHp), e.maxShield ? e.shield / e.maxShield : 0, d.boss);
    }
  }

  function drawEnemyIcon(canvas, type, t) {
    const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const d = ENEMIES[type], sc = Math.min(w, h) / (d.radius * 2 + 34);
    ctx.save(); ctx.translate(w / 2, h / 2 + 4 * sc); ctx.scale(sc, sc);
    drawEnemy(ctx, { x: 0, y: 0, def: d, type, radius: d.radius, a: 0, wob: 0, hitT: 0, hp: 1, maxHp: 1, shield: d.shield || 0, maxShield: d.shield || 0, id: 1, revealed: true, dist: 0, regen: d.regen }, t || 0.5);
    ctx.restore();
  }

  MD.Waves = { ENEMIES, TOTAL, MILESTONES, ERAS, eraFor, hpMult, makeWave, waveSize, answerEnergy, bountyMult, clearBonus, drawEnemy, drawEnemyIcon };
})(globalThis.MD = globalThis.MD || {});
