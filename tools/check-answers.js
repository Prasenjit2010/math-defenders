// Independent solver: reads each question's text and choices, works out the answer itself
// (never using the game's answer logic) and confirms exactly one choice is correct.
// Usage: node tools/check-answers.js
// Independent solver: reads only the question text and choices, never the game's answer logic.
const file = process.argv[2] || require('path').join(__dirname, '..', 'js', 'questions.js');
globalThis.MD = {}; require(file); const Q = MD.Questions;
const clean = s => String(s).replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
const val = s => { s = clean(s).replace(/[$,%\s]/g, ''); if (/^-?\d+\/\d+$/.test(s)) { const [a, b] = s.split('/'); return +a / +b; } return /^-?[\d.]+$/.test(s) ? +s : NaN; };
const num = s => +clean(s).replace(/[$,%]/g, '');
const eq = (a, b) => Math.abs(a - b) < 1e-9;
const gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a);
const prime = n => n > 1 && [...Array(Math.max(0, Math.floor(Math.sqrt(n)) - 1))].every((_, i) => n % (i + 2) !== 0);
const lowest = s => { const m = String(s).match(/^(\d+)\/(\d+)$/); return !m || gcd(+m[1], +m[2]) === 1; };
const divAns = (n, d) => { const q = Math.floor(n / d), r = n % d; return r ? q + ' R' + r : String(q); };
function judge(text, choices) {
  const t = clean(text); let m;
  const byVal = v => c => eq(val(c), v);
  if (t === 'Which pair makes 10?') return c => eq(Function('return ' + clean(c))(), 10);
  if ((m = t.match(/^Which number is (greatest|least)\?$/))) { const vs = choices.map(Number); const target = m[1] === 'greatest' ? Math.max(...vs) : Math.min(...vs); return c => +c === target; }
  if (t === 'Which number is prime?') return c => prime(+c);
  if ((m = t.match(/^(-?\d+)\s+\?\s+(-?\d+)$/))) { const a = +m[1], b = +m[2]; return c => c === (a < b ? '<' : a > b ? '>' : '='); }
  if ((m = t.match(/^In ([\d,]+), which digit is in the (ones|tens|hundreds|thousands) place\?$/))) { const d = m[1].replace(/,/g, '').split('').reverse(); return c => +c === +d[['ones', 'tens', 'hundreds', 'thousands'].indexOf(m[2])]; }
  if ((m = t.match(/^What is the value of the (\d) in ([\d,]+)\?$/))) { const d = m[2].replace(/,/g, '').split('').reverse(); const vs = d.map((x, i) => x === m[1] ? +x * 10 ** i : null).filter(x => x !== null); return c => vs.includes(num(c)); }
  if ((m = t.match(/^(\d+) hundreds? \+ (\d+) tens? \+ (\d+) ones?$/))) return c => num(c) === m[1] * 100 + m[2] * 10 + +m[3];
  if ((m = t.match(/^Which number is ([\d,+ ]+)\?$/))) { const v = m[1].split('+').reduce((s, x) => s + num(x), 0); return c => num(c) === v; }
  if ((m = t.match(/^What is ([\d,]+) (more|less) than ([\d,]+)\?$/))) { const v = m[2] === 'more' ? num(m[3]) + num(m[1]) : num(m[3]) - num(m[1]); return c => num(c) === v; }
  if ((m = t.match(/^Round ([\d,]+) to the nearest ([\d,]+)$/))) { const n = num(m[1]), u = num(m[2]); const v = Math.floor(n / u + 0.5) * u; return c => num(c) === v; }
  if ((m = t.match(/^(\d+) rows of (\d+) = \?$/))) return c => num(c) === m[1] * m[2];
  if ((m = t.match(/^(\d+) \w+ with (\d+) \w+ each\. How many in all\?$/))) return c => num(c) === m[1] * m[2];
  if ((m = t.match(/^If .* then (\d+) \/ (\d+) = \?$/))) return c => c === divAns(+m[1], +m[2]);
  if ((m = t.match(/^(\d+) \/ (\d+) = \?$/))) return c => c === divAns(+m[1], +m[2]);
  if ((m = t.match(/^(\d+) \w+ shared by (\d+) kids\. How many left over\?$/))) return c => num(c) === m[1] % m[2];
  if ((m = t.match(/^Simplify (\d+)\/(\d+)$/))) return c => eq(val(c), m[1] / m[2]) && lowest(c);
  if ((m = t.match(/^Which fraction equals (\d+)\/(\d+)\?$/))) return byVal(m[1] / m[2]);
  if ((m = t.match(/^(\d+)\/(\d+) = \?\/(\d+)$/))) return c => eq(num(c) / m[3], m[1] / m[2]);
  if ((m = t.match(/^Which is greater: (\S+) or (\S+)\?$/))) { const a = val(m[1]), b = val(m[2]); return c => eq(a, b) ? c === 'Equal' : c !== 'Equal' && eq(val(c), Math.max(a, b)); }
  if ((m = t.match(/^Pay \$([\d.]+) for \$([\d.]+)\. Change\?$/))) return byVal(Math.round((m[1] - m[2]) * 100) / 100);
  if ((m = t.match(/^(\d+) \w+ cost \$([\d.]+) each\. Total\?$/))) return byVal(Math.round(m[1] * m[2] * 100) / 100);
  if ((m = t.match(/^(\d+) tickets cost \$(\d+)\. Cost of 1\?$/))) return byVal(m[2] / m[1]);
  if ((m = t.match(/^Rectangle (\d+) by (\d+)\. Area\?$/))) return c => num(c) === m[1] * m[2];
  if ((m = t.match(/^Rectangle (\d+) by (\d+)\. Perimeter\?$/))) return c => num(c) === 2 * (+m[1] + +m[2]);
  if ((m = t.match(/^Square with sides of (\d+)\. (Area|Perimeter)\?$/))) return c => num(c) === (m[2] === 'Area' ? m[1] * m[1] : 4 * m[1]);
  if ((m = t.match(/^Area is (\d+), one side is (\d+)\. Other side\?$/))) return byVal(m[1] / m[2]);
  if ((m = t.match(/^Rectangle perimeter is (\d+), one side is (\d+)\. Other side\?$/))) return byVal(m[1] / 2 - m[2]);
  if ((m = t.match(/^Which is a factor of (\d+)\?$/))) return c => +m[1] % +c === 0;
  if ((m = t.match(/^Greatest common factor of (\d+) and (\d+)\?$/))) return c => +c === gcd(+m[1], +m[2]);
  if ((m = t.match(/^Least common multiple of (\d+) and (\d+)\?$/))) return c => +c === m[1] * m[2] / gcd(+m[1], +m[2]);
  if ((m = t.match(/^Next multiple of (\d+) after (\d+)\?$/))) return c => +c === (Math.floor(m[2] / m[1]) + 1) * m[1];
  if ((m = t.match(/^(\d+) : (\d+) = (\d+) : \?$/))) return byVal(m[2] * m[3] / m[1]);
  if ((m = t.match(/^A car goes (\d+) miles in (\d+) hours\. Miles per hour\?$/))) return byVal(m[1] / m[2]);
  if ((m = t.match(/^Red to blue is (\d+) : (\d+)\. There are (\d+) red\. How many blue\?$/))) return byVal(m[3] * m[2] / m[1]);
  if ((m = t.match(/^(\d+)% of (\d+) = \?$/))) return byVal(m[1] * m[2] / 100);
  if ((m = t.match(/^(\d+) is what percent of (\d+)\?$/))) return byVal(m[1] / m[2] * 100);
  if ((m = t.match(/^A \$(\d+) toy is (\d+)% off\. Sale price\?$/))) return byVal(m[1] * (100 - m[2]) / 100);
  if ((m = t.match(/^\w+ has (\d+) shells and finds (\d+) more\. How many now\?$/))) return c => num(c) === +m[1] + +m[2];
  if ((m = t.match(/^\w+ has (\d+) stickers and gives away (\d+)\. How many left\?$/))) return c => num(c) === m[1] - m[2];
  if ((m = t.match(/^(.*) = \?$/))) { const ex = m[1].replace(/\$/g, '').replace(/(\d+)\/(\d+)/g, '($1/$2)'); const v = Function('return ' + ex)(); return byVal(v); }
  if ((m = t.match(/^(.*) = (-?\d+)$/)) && t.includes('?')) { const L = m[1], R = +m[2]; return c => eq(Function('return ' + L.replace('?', '(' + num(c) + ')'))(), R); }
  return null;
}
const unknown = {}, bad = {}, kinds = {};
for (const cat of Q.CATS) for (let i = 0; i < 25000; i++) {
  const p = Q.finalize(cat, cat.gen()); const k = cat.id + '/' + p.sub; kinds[k] = (kinds[k] || 0) + 1;
  const j = judge(p.text, p.choices.map(String)); if (!j) { unknown[k] = p.text; continue; }
  const right = p.choices.filter(c => j(String(c)));
  let why = null;
  if (right.length !== 1) why = right.length + ' correct choices';
  else if (String(right[0]) !== String(p.answer)) why = 'game marks the wrong choice as correct';
  const v = val(p.answer); if (!why && !isNaN(v) && p.choices.filter(c => eq(val(c), v)).length > 1 && !/^Which is greater/.test(p.text)) why = 'two choices have the same value';
  if (why) (bad[k + ' :: ' + why] = bad[k + ' :: ' + why] || []).push(p.text + ' => ' + p.answer + ' [' + p.choices.join(' | ') + '] solver says: ' + right.join(', '));
}
console.log('kinds checked:', Object.keys(kinds).length, ' questions:', Object.values(kinds).reduce((a, b) => a + b, 0));
console.log('UNREADABLE BY SOLVER:', JSON.stringify(unknown));
console.log('PROBLEMS:', Object.keys(bad).length);
for (const [k, v] of Object.entries(bad)) console.log(v.length, k, '\n   e.g.', [...new Set(v)].slice(0, 3).join('\n        '));
