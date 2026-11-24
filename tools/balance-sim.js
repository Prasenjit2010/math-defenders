/* Headless balance test for Math Defenders.
   Usage: node tools/balance-sim.js <mapId> <startWave> <secsPerAnswer> <accuracy> [runs]
   A simulated student answers problems and follows a sensible build plan. */
const path = require('path');
for (const f of ['towers', 'questions', 'waves', 'engine']) require(path.join(__dirname, '..', 'js', f + '.js'));
const MD = globalThis.MD, W = MD.Waves, T = MD.Towers;
const [mapId = 'meadow', startWave = '1', spa = '4', acc = '0.8', runs = '3'] = process.argv.slice(2);

const PLAN = ['dart', 'dart', 'mortar', 'cryo', 'tesla', 'siphon', 'beacon', 'rail', 'laser', 'mortar', 'tesla', 'saw', 'rail', 'glue', 'beacon', 'laser', 'gravity', 'rail'];
const PATH = { dart: 'C', cryo: 'B', mortar: 'A', tesla: 'B', laser: 'A', gravity: 'B', saw: 'C', glue: 'B', rail: 'A', tornado: 'B', beacon: 'A', siphon: 'A' };

function run() {
  const g = new MD.Engine({ mapId, startWave: +startWave });
  const dt = 1 / 30;
  const pads = g.map.pads.map((p, i) => { let cov = 0; for (let d = 0; d < g.pathLen; d += 10) { const q = g.pointAt(d); if (Math.hypot(q.x - p[0], q.y - p[1]) < 150) cov++; } return { i, cov }; }).sort((a, b) => b.cov - a.cov);
  let ansT = 0, jam = 0, fast = 0, steps = 0;
  const maxSteps = 30 * 60 * 120;
  while (g.state !== 'won' && g.state !== 'lost' && steps++ < maxSteps) {
    if (jam > 0) jam -= dt; else if ((ansT += dt) >= +spa) {
      ansT = 0;
      if (Math.random() < +acc) { fast = +spa <= 6 ? fast + 1 : 0; g.addMathEnergy(Math.round(W.answerEnergy(Math.max(1, g.wave)) * (1 + 0.2 * Math.min(5, fast)))); }
      else { fast = 0; jam = 1.2; }
    }
    if (steps % 15 === 0) {
      const n = g.towers.length;
      if (n < PLAN.length && n < pads.length) { const c = PLAN[n]; if (g.energy >= T.byId[c].cost) g.build(pads[n].i, c); }
      else {
        let best = null;
        for (const t of g.towers) { const o = g.upgradeOptions(t).find(x => x.path === PATH[t.chassis]); if (o && (!best || o.cost < best.o.cost)) best = { t, o }; }
        if (best && g.energy >= best.o.cost) g.upgrade(best.t, best.o.path);
      }
      if (n < PLAN.length) {
        // upgrade early towers too, once the next build is far away
        const next = PLAN[n]; const need = T.byId[next].cost;
        if (g.energy > need * 3) { const t = g.towers.find(t => g.upgradeOptions(t).some(o => o.path === PATH[t.chassis] && o.cost < g.energy - need)); if (t) g.upgrade(t, PATH[t.chassis]); }
      }
    }
    if (g.state === 'ready' && g.towers.length) {
      // Practice starts: spend the starting energy before sending the first wave.
      const canSpend = g.towers.length < Math.min(PLAN.length, pads.length) ? g.energy >= T.byId[PLAN[g.towers.length]].cost
        : g.towers.some(t => g.upgradeOptions(t).some(o => o.path === PATH[t.chassis] && o.cost <= g.energy));
      if (+startWave === 1 || !canSpend) g.callWave();
    }
    g.update(dt);
  }
  return { reached: g.wave, cleared: g.wavesCleared, state: g.state, mins: Math.round(g.time / 60), tiers: g.towers.reduce((s, t) => s + t.tier, 0) };
}
const res = []; for (let i = 0; i < +runs; i++) res.push(run());
const avg = k => (res.reduce((s, r) => s + r[k], 0) / res.length).toFixed(1);
console.log(`${mapId} from ${startWave} answer every ${spa}s @ ${Math.round(acc * 100)}%: cleared ${res.map(r => r.cleared).join(',')} (avg ${avg('cleared')}), wins ${res.filter(r => r.state === 'won').length}/${res.length}, tiers ${avg('tiers')}/54, ~${avg('mins')} min`);
