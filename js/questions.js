/* Math Defenders — questions.js
   18 curriculum categories (K through grade 6), each with several kinds of
   question, multiple-choice distractors, and session mastery tracking that
   re-queues missed problem types until the student gets one right. */
(function (MD) {
  'use strict';

  const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a);
  const MINUS = '−';
  const neg = n => n < 0 ? MINUS + Math.abs(n) : String(n);
  const money = c => '$' + (c / 100).toFixed(2);
  const frac = (n, d) => { const k = gcd(n, d); n /= k; d /= k; return d === 1 ? String(n) : n + '/' + d; };

  /* Distractor helpers: return arrays of wrong-answer candidates (strings). */
  function nums(ans, spread) {
    const out = [];
    const deltas = spread === 'big' ? [10, -10, 1, -1, 2, 100] : spread === 'mult' ? [1, -1, 2, -2, 10] : [1, -1, 2, -2, 3, -3];
    deltas.forEach(d => out.push(ans + d));
    return out;
  }

  /* Each generator returns { sub, text, answer, wrong: [...], key, prompt? }.
     `like` is a previous problem of the same category, used for re-queued practice:
     it repeats the same kind of question (same `sub`) with new numbers. */
  const fv = s => { s = String(s).replace(MINUS, '-'); if (s.indexOf('/') >= 0) { const p = s.split('/'); return +p[0] / +p[1]; } return +s; };
  const notSameValue = ans => w => Math.abs(fv(w) - fv(ans)) > 1e-9;   // drop wrong answers equal in value (e.g. 2/4 vs 1/2)
  const isPrime = n => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
  const lcm = (a, b) => a / gcd(a, b) * b;
  const NAMES = ['Sam', 'Ava', 'Leo', 'Mia', 'Kai', 'Zoe', 'Eli', 'Ivy', 'Max', 'Ana'];

  const CATS = [
    { id: 'bonds10', grade: 'K–1', name: 'Number Bonds to 10', gen(like) {
      const sub = like && like.sub ? like.sub : pick(['bond', 'bond', 'take', 'pair']);
      if (sub === 'take') { const a = R(0, 10); return { sub, text: '10 ' + MINUS + ' ' + a + ' = ?', answer: String(10 - a), wrong: nums(10 - a).filter(n => n >= 0 && n <= 10).map(String), key: '10 − ' + a }; }
      if (sub === 'pair') {
        const a = R(1, 9), ans = a + ' + ' + (10 - a);
        const wrong = [a + ' + ' + (9 - a), a + ' + ' + (11 - a), (a + 1) + ' + ' + (10 - a), (a === 1 ? 2 : a - 1) + ' + ' + (10 - a)].filter(s => s !== ans);
        return { sub, text: 'Which pair makes 10?', answer: ans, wrong, key: 'pair ' + a + '+' + (10 - a) };
      }
      const a = like && like.a !== undefined && Math.random() < 0.5 ? like.a : R(0, 10);
      return { sub: 'bond', a, text: a + ' + ? = 10', answer: String(10 - a), wrong: nums(10 - a).filter(n => n >= 0 && n <= 10).map(String), key: 'bond ' + a + '+?=10' };
    } },
    { id: 'compare', grade: 'K–1', name: 'Comparing Numbers', gen(like) {
      const sub = like && like.sub ? (like.sub === 'two-digit' || like.sub === 'small' ? 'sign' : like.sub) : pick(['sign', 'sign', 'greatest', 'least']);
      if (sub === 'greatest' || sub === 'least') {
        const set = new Set(); while (set.size < 3) set.add(R(1, 99));
        const ns = [...set], ans = sub === 'greatest' ? Math.max(...ns) : Math.min(...ns);
        return { sub, text: 'Which number is ' + (sub === 'greatest' ? 'greatest' : 'least') + '?', answer: String(ans), wrong: ns.filter(n => n !== ans).map(String), key: sub + ' of three' };
      }
      const big = Math.random() < 0.5, a = big ? R(10, 99) : R(0, 20);
      let b = Math.random() < 0.2 ? a : (big ? R(10, 99) : R(0, 20));
      if (b !== a && Math.random() < 0.4 && big) b = parseInt(String(a).split('').reverse().join(''), 10) || a + 1;
      const ans = a < b ? '<' : a > b ? '>' : '=';
      return { sub: 'sign', text: a + '  ?  ' + b, answer: ans, wrong: ['<', '>', '='].filter(s => s !== ans), key: a + ' vs ' + b, fixed: ['<', '>', '='] };
    } },
    { id: 'missing', grade: 'K–1', name: 'Missing Addends', gen(like) {
      const sub = like && like.sub ? like.sub : pick(['missing', 'missing', 'after', 'minus']);
      if (sub === 'after') { const sum = R(5, 20), a = R(0, sum); return { sub, text: a + ' + ? = ' + sum, answer: String(sum - a), wrong: nums(sum - a).filter(n => n >= 0).map(String), key: a + '+?=' + sum }; }
      if (sub === 'minus') { const a = R(5, 20), b = R(0, a); return { sub, text: a + ' ' + MINUS + ' ? = ' + (a - b), answer: String(b), wrong: nums(b).filter(n => n >= 0 && n <= a).map(String), key: a + '−?=' + (a - b) }; }
      const sum = like && like.sum ? like.sum : R(5, 20), a = R(0, sum);
      return { sub: 'missing', sum, text: '? + ' + a + ' = ' + sum, answer: String(sum - a), wrong: nums(sum - a).filter(n => n >= 0).map(String), key: '?+' + a + '=' + sum };
    } },
    { id: 'addsub20', grade: 'K–1', name: 'Add & Subtract within 20', gen(like) {
      const sub = like && like.sub ? like.sub : pick(['add', 'sub', 'three', 'story']);
      if (sub === 'add') { const a = R(1, 12), b = R(1, 20 - a); return { sub, text: a + ' + ' + b + ' = ?', answer: String(a + b), wrong: nums(a + b).filter(n => n >= 0).map(String), key: a + ' + ' + b }; }
      if (sub === 'three') { const a = R(1, 8), b = R(1, 8), c = R(1, 20 - a - b > 8 ? 8 : Math.max(1, 20 - a - b)); const s = a + b + c; return { sub, text: a + ' + ' + b + ' + ' + c + ' = ?', answer: String(s), wrong: nums(s).map(String), key: a + '+' + b + '+' + c }; }
      if (sub === 'story') {
        const who = pick(NAMES);
        if (Math.random() < 0.5) { const a = R(2, 12), b = R(1, 20 - a); return { sub, text: who + ' has ' + a + ' shells and finds ' + b + ' more. How many now?', answer: String(a + b), wrong: nums(a + b).concat([Math.abs(a - b)]).filter(n => n >= 0).map(String), key: 'story add' }; }
        const a = R(6, 20), b = R(1, a - 1); return { sub, text: who + ' has ' + a + ' stickers and gives away ' + b + '. How many left?', answer: String(a - b), wrong: nums(a - b).concat([a + b]).filter(n => n >= 0).map(String), key: 'story subtract' };
      }
      const a = R(5, 20), b = R(1, a); return { sub: 'sub', text: a + ' ' + MINUS + ' ' + b + ' = ?', answer: String(a - b), wrong: nums(a - b).filter(n => n >= 0).map(String), key: a + ' − ' + b };
    } },
    { id: 'regroup', grade: '2–3', name: 'Add & Subtract with Regrouping', gen(like) {
      const sub = like && like.sub ? like.sub : pick(['add', 'sub', 'add3', 'sub3']);
      if (sub === 'add') {
        let a = R(15, 79), b = R(12, 89);
        if ((a % 10) + (b % 10) < 10) b = b - (b % 10) + (9 - (a % 10)) + R(1, Math.min(9, a % 10 || 1));
        if (a + b > 180) b = 99 - a;
        return { sub, text: a + ' + ' + b + ' = ?', answer: String(a + b), wrong: [a + b - 10, a + b + 10, a + b - 1, a + b + 1].map(String), key: a + ' + ' + b };
      }
      if (sub === 'add3') {
        let a = R(115, 589), b = R(108, 399);
        if ((a % 10) + (b % 10) < 10) b += 10 - ((a % 10) + (b % 10)) + R(0, 2);
        return { sub, text: a + ' + ' + b + ' = ?', answer: String(a + b), wrong: [a + b - 10, a + b + 10, a + b - 100, a + b + 100].map(String), key: '3-digit add' };
      }
      if (sub === 'sub3') {
        const a = R(402, 950); let b = R(118, a - 100);
        if ((a % 10) >= (b % 10)) b = Math.min(a - 11, b - (b % 10) + Math.min(9, (a % 10) + R(1, 4)));
        return { sub, text: a + ' ' + MINUS + ' ' + b + ' = ?', answer: String(a - b), wrong: [a - b + 10, a - b - 10, a - b + 100, a - b - 100].filter(n => n >= 0).map(String), key: '3-digit subtract' };
      }
      let a = R(41, 98), b = R(12, a - 10);
      if ((a % 10) >= (b % 10)) b = Math.min(a - 1, b - (b % 10) + Math.min(9, (a % 10) + R(1, 4)));
      return { sub: 'sub', text: a + ' ' + MINUS + ' ' + b + ' = ?', answer: String(a - b), wrong: [a - b + 10, a - b - 10, a - b + 1, a - b - 1].filter(n => n >= 0).map(String), key: a + ' − ' + b };
    } },
    { id: 'place', grade: '2–3', name: 'Place Value', gen(like) {
      const sub = like && like.sub ? like.sub : pick(['digit', 'value', 'build', 'expanded', 'more']);
      const places = ['ones', 'tens', 'hundreds', 'thousands'];
      if (sub === 'build') {
        const h = R(1, 9), t = R(0, 9), o = R(0, 9), n = h * 100 + t * 10 + o;
        return { sub, text: h + (h === 1 ? ' hundred + ' : ' hundreds + ') + t + (t === 1 ? ' ten + ' : ' tens + ') + o + (o === 1 ? ' one' : ' ones'), answer: String(n), wrong: [h * 100 + o * 10 + t, h * 10 + t * 100 + o, n + 10, n + 100].filter(v => v !== n).map(String), key: 'build ' + n };
      }
      if (sub === 'expanded') {
        const th = R(1, 9), h = R(0, 9), o = R(1, 9), n = th * 1000 + h * 100 + o;
        const parts = [th * 1000].concat(h ? [h * 100] : []).concat([o]).map(v => v.toLocaleString('en-US'));
        return { sub, text: 'Which number is ' + parts.join(' + ') + '?', answer: n.toLocaleString('en-US'), wrong: [th * 1000 + h * 10 + o * 100, th * 100 + h * 10 + o, th * 1000 + h * 100 + o * 10, th * 10000 + h * 100 + o].filter(v => v !== n).map(v => v.toLocaleString('en-US')), key: 'expanded form' };
      }
      if (sub === 'more') {
        const step = pick([10, 100, 1000]), n = R(1000, 8899), less = Math.random() < 0.4, v = less ? n - step : n + step;
        const others = [10, 100, 1000].filter(s => s !== step);
        return { sub, text: 'What is ' + step.toLocaleString('en-US') + (less ? ' less than ' : ' more than ') + n.toLocaleString('en-US') + '?', answer: v.toLocaleString('en-US'), wrong: [less ? n - others[0] : n + others[0], less ? n - others[1] : n + others[1], less ? n + step : n - step].map(x => x.toLocaleString('en-US')), key: step + (less ? ' less' : ' more') };
      }
      const n = R(1000, 9999), digits = String(n).split('').reverse(), p = R(0, 3);
      if (sub === 'digit') {
        const d = +digits[p];
        return { sub, text: 'In ' + n.toLocaleString('en-US') + ', which digit is in the ' + places[p] + ' place?', answer: String(d), wrong: digits.map(Number).filter(v => v !== d).map(String).concat([String((d + 1) % 10)]), key: places[p] + ' digit' };
      }
      // Only ask about a digit that appears once, so "the 2 in 8,223" can't mean two places.
      let m = n, md = digits, single = [];
      for (let tries = 0; tries < 50; tries++) {
        single = [0, 1, 2, 3].filter(i => md[i] !== '0' && md.filter(x => x === md[i]).length === 1);
        if (single.length) break;
        m = R(1000, 9999); md = String(m).split('').reverse();
      }
      if (!single.length) { m = 4729; md = ['9', '2', '7', '4']; single = [0, 1, 2, 3]; }
      const q = pick(single), v = +md[q] * Math.pow(10, q);
      const c = x => x.toLocaleString('en-US');
      return { sub: 'value', text: 'What is the value of the ' + md[q] + ' in ' + m.toLocaleString('en-US') + '?', answer: c(v), wrong: [v * 10, v / 10, v / 100, +md[q]].filter(x => x !== v && x >= 1 && x <= 90000 && Number.isInteger(x)).map(c), key: 'value in ' + places[q] };
    } },
    { id: 'arrays', grade: '2–3', name: 'Multiplication & Fact Families', gen(like) {
      const a = like && like.a && Math.random() < 0.6 ? like.a : R(2, 12), b = like && like.b && Math.random() < 0.6 ? like.b : R(2, 12), p = a * b;
      const sub = like && like.sub ? like.sub : pick(['times', 'array', 'family', 'missing', 'groups', 'divide']);
      const wrong = [a * (b + 1), a * (b - 1), (a + 1) * b, p + 1, p - 1, p + 10].filter(v => v !== p).map(String);
      if (sub === 'array') return { sub, a, b, text: a + ' rows of ' + b + ' = ?', answer: String(p), wrong, key: a + ' × ' + b };
      if (sub === 'family') return { sub, a, b, text: 'If ' + a + ' × ' + b + ' = ' + p + ', then ' + p + ' ÷ ' + b + ' = ?', answer: String(a), wrong: [a + 1, a - 1, b, a + 2].filter(n => n > 0 && n !== a).map(String), key: p + ' ÷ ' + b };
      if (sub === 'missing') return { sub, a, b, text: a + ' × ? = ' + p, answer: String(b), wrong: [b + 1, b - 1, b + 2, a].filter(n => n > 0 && n !== b).map(String), key: a + ' × ' + b };
      if (sub === 'groups') { const thing = pick(['bags with ' + b + ' marbles each', 'boxes with ' + b + ' crayons each', 'teams with ' + b + ' players each']); return { sub, a, b, text: a + ' ' + thing + '. How many in all?', answer: String(p), wrong: wrong.concat([String(a + b)]), key: a + ' × ' + b }; }
      if (sub === 'divide') return { sub, a, b, text: p + ' ÷ ' + a + ' = ?', answer: String(b), wrong: [b + 1, b - 1, b + 2, a].filter(n => n > 0 && n !== b).map(String), key: p + ' ÷ ' + a };
      return { sub: 'times', a, b, text: a + ' × ' + b + ' = ?', answer: String(p), wrong, key: a + ' × ' + b };
    } },
    { id: 'divrem', grade: '2–3', name: 'Division with Remainders', gen(like) {
      const sub = like && like.sub ? like.sub : pick(['rem', 'rem', 'left', 'exact']);
      const d = like && like.d && Math.random() < 0.5 ? like.d : R(2, 9), q = R(2, 11), r = R(1, d - 1), n = d * q + r;
      const fmt = (a, b) => b ? a + ' R' + b : String(a);
      if (sub === 'left') {
        const what = pick(['cookies', 'stickers', 'pencils', 'cards']);
        return { sub, d, text: n + ' ' + what + ' shared by ' + d + ' kids. How many left over?', answer: String(r), wrong: [q, r + 1, d - r === r ? r + 2 : d - r, d].filter(v => v !== r && v >= 0).map(String), key: 'left over ÷ ' + d };
      }
      if (sub === 'exact') { const m = d * q; return { sub, d, text: m + ' ÷ ' + d + ' = ?', answer: String(q), wrong: [fmt(q, 1), String(q + 1), String(q - 1), fmt(q - 1, d - 1 || 1)].filter(s => s !== String(q)), key: m + ' ÷ ' + d }; }
      return { sub: 'rem', d, text: n + ' ÷ ' + d + ' = ?', answer: fmt(q, r), wrong: [fmt(q, (r + 1) % d), fmt(q + 1, r), fmt(q - 1, r), fmt(q, r - 1)].filter(s => s !== fmt(q, r)), key: n + ' ÷ ' + d };
    } },
    { id: 'rounding', grade: '2–3', name: 'Rounding to 10, 100 & 1,000', gen(like) {
      const sub = like && like.sub ? like.sub : pick(['ten', 'hundred', 'thousand']);
      if (sub === 'ten') { const n = R(11, 999), up = Math.round(n / 10) * 10; return { sub, text: 'Round ' + n + ' to the nearest 10', answer: String(up), wrong: [up - 10, up + 10, Math.round(n / 100) * 100, n].filter(v => v !== up).map(String), key: 'round ' + n + ' to 10' }; }
      if (sub === 'thousand') { const n = R(1100, 9899), up = Math.round(n / 1000) * 1000; return { sub, text: 'Round ' + n.toLocaleString('en-US') + ' to the nearest 1,000', answer: up.toLocaleString('en-US'), wrong: [up - 1000, up + 1000, Math.round(n / 100) * 100, Math.round(n / 10) * 10].filter(v => v !== up && v > 0).map(v => v.toLocaleString('en-US')), key: 'round to 1000' }; }
      const n = R(110, 9999), up = Math.round(n / 100) * 100, c = x => x.toLocaleString('en-US'); return { sub: 'hundred', text: 'Round ' + c(n) + ' to the nearest 100', answer: c(up), wrong: [up - 100, up + 100, Math.round(n / 10) * 10, Math.round(n / 1000) * 1000].filter(v => v !== up && v > 0).map(c), key: 'round ' + n + ' to 100' };
    } },
    { id: 'equivfrac', grade: '4–5', name: 'Equivalent Fractions', gen(like) {
      const sub = like && like.sub ? like.sub : pick(['missing', 'which', 'simplify', 'bigger']);
      if (sub === 'simplify') {
        const d = R(2, 9), n = R(1, d - 1), k = R(2, 5), s = frac(n, d);
        return { sub, text: 'Simplify ' + (n * k) + '/' + (d * k), answer: s, wrong: [(n * k) + '/' + d, n + '/' + (d * k), (n + 1) + '/' + d, n + '/' + (d + 1), (d - n) + '/' + d].filter(notSameValue(s)), key: 'simplify ' + (n * k) + '/' + (d * k) };
      }
      if (sub === 'bigger') {
        let a, b, c, e; do { b = R(2, 9); a = R(1, b - 1); e = R(2, 9); c = R(1, e - 1); } while (a * e === c * b || (a === c && b === e));
        const ans = a * e > c * b ? a + '/' + b : c + '/' + e, other = ans === a + '/' + b ? c + '/' + e : a + '/' + b;
        return { sub, text: 'Which is greater: ' + a + '/' + b + ' or ' + c + '/' + e + '?', answer: ans, wrong: [other, 'Equal'], key: 'compare fractions' };
      }
      const d = R(2, 6), n = R(1, d - 1), k = R(2, 5);
      if (sub === 'missing') return { sub, text: n + '/' + d + ' = ?/' + (d * k), answer: String(n * k), wrong: [n * k + 1, n * k - 1, n + k, d * k - n * k].filter(v => v > 0 && v !== n * k).map(String), key: n + '/' + d + ' = ?/' + d * k };
      const ans = (n * k) + '/' + (d * k);
      return { sub: 'which', text: 'Which fraction equals ' + n + '/' + d + '?', answer: ans, wrong: [(n + k) + '/' + (d + k), (n * k) + '/' + (d * k + 1), (n * k + 1) + '/' + (d * k), (n + 1) + '/' + d].filter(s => s !== ans).filter(notSameValue(ans)), key: 'equal to ' + n + '/' + d };
    } },
    { id: 'fracadd', grade: '4–5', name: 'Fraction Addition', gen(like) {
      const sub = like && like.sub ? like.sub : pick(['same', 'unlike', 'minus', 'fromone']);
      if (sub === 'minus') {
        const d = R(3, 12), a = R(2, d - 1), b = R(1, a - 1), ans = frac(a - b, d);
        return { sub, text: a + '/' + d + ' ' + MINUS + ' ' + b + '/' + d + ' = ?', answer: ans, wrong: [frac(a + b, d), frac(a - b + 1, d), (a - b) + '/' + (d * 2), frac(a, d)].filter(notSameValue(ans)), key: a + '/' + d + ' − ' + b + '/' + d };
      }
      if (sub === 'fromone') {
        const d = R(3, 10), a = R(1, d - 1), ans = frac(d - a, d);
        return { sub, text: '1 ' + MINUS + ' ' + a + '/' + d + ' = ?', answer: ans, wrong: [frac(a, d), frac(d - a + 1, d), (d - a) + '/' + (d + 1), frac(Math.max(1, d - a - 1), d)].filter(notSameValue(ans)), key: '1 − ' + a + '/' + d };
      }
      if (sub === 'same') {
        const d = R(3, 12), a = R(1, d - 2), b = R(1, d - a - 1), ans = frac(a + b, d);
        return { sub, text: a + '/' + d + ' + ' + b + '/' + d + ' = ?', answer: ans, wrong: [(a + b) + '/' + (d + d), frac(a + b + 1, d), frac(Math.abs(a - b) || 1, d), (a + b) + '/' + (d + 1)].filter(notSameValue(ans)), key: a + '/' + d + ' + ' + b + '/' + d };
      }
      const d1 = pick([2, 3, 4]), d2 = d1 * pick([2, 3]), a = R(1, d1 - 1), b = R(1, d2 - 1);
      const n = a * (d2 / d1) + b, ans = frac(n, d2);
      return { sub: 'unlike', text: a + '/' + d1 + ' + ' + b + '/' + d2 + ' = ?', answer: ans, wrong: [(a + b) + '/' + (d1 + d2), frac(n + 1, d2), frac(a + b, d2), frac(n, d2 * 2)].filter(notSameValue(ans)), key: a + '/' + d1 + ' + ' + b + '/' + d2 };
    } },
    { id: 'money', grade: '4–5', name: 'Decimals & Money', gen(like) {
      const sub = like && like.sub ? like.sub : pick(['add', 'change', 'decimal', 'each', 'decsub']);
      if (sub === 'add') { const a = R(10, 500) * 5, b = R(10, 400) * 5; return { sub, text: money(a) + ' + ' + money(b) + ' = ?', answer: money(a + b), wrong: [money(a + b + 100), money(a + b - 10), money(a + b + 10), money(a + b - 100)], key: 'money add' }; }
      if (sub === 'change') { const paid = pick([500, 1000, 2000]), cost = R(20, paid / 5 - 1) * 5, c = paid - cost; return { sub, text: 'Pay ' + money(paid) + ' for ' + money(cost) + '. Change?', answer: money(c), wrong: [c + 100, c - 10, c + 10, Math.abs(c - 100)].filter(v => v > 0 && v !== c).map(money), key: 'making change' }; }
      if (sub === 'each') { const n = R(2, 6), each = R(5, 60) * 5, t = n * each, thing = pick(['notebooks', 'apples', 'markers', 'tickets']); return { sub, text: n + ' ' + thing + ' cost ' + money(each) + ' each. Total?', answer: money(t), wrong: [money(t + each), money(t - each), money(each + n * 100), money(t + 100)].filter(s => s !== money(t)), key: 'cost of several' }; }
      const f = h => (h / 100).toString();     // hundredths (integer) -> "0.74"
      if (sub === 'decsub') { const a = R(2, 9) * 10, b = R(1, a - 1); return { sub, text: f(a) + ' ' + MINUS + ' ' + f(b) + ' = ?', answer: f(a - b), wrong: [f(a - b + 10), f(a - b + 1), f(Math.abs(a / 10 - b)), f(a + b)].filter(v => v !== f(a - b) && +v > 0), key: 'decimal subtract' }; }
      const a = R(1, 9) * 10, b = R(1, 99), s = a + b;
      return { sub: 'decimal', text: f(a) + ' + ' + f(b) + ' = ?', answer: f(s), wrong: [f(s + 10), f(s > 1 ? s - 1 : s + 2), f(a / 10 + b), f(s + 100)].filter(v => v !== f(s)), key: 'decimal add' };
    } },
    { id: 'pemdas', grade: '4–5', name: 'Order of Operations', gen(like) {
      const sub = like && like.sub ? like.sub : pick(['mul', 'paren', 'two', 'div', 'parensub']);
      if (sub === 'mul') { const a = R(2, 12), b = R(2, 9), c = R(2, 9); return { sub, text: a + ' + ' + b + ' × ' + c + ' = ?', answer: String(a + b * c), wrong: [(a + b) * c, a + b + c, a * b + c, a + b * c + 1].filter(v => v !== a + b * c).map(String), key: 'a + b × c' }; }
      if (sub === 'paren') { const a = R(2, 9), b = R(2, 9), c = R(2, 6); return { sub, text: '(' + a + ' + ' + b + ') × ' + c + ' = ?', answer: String((a + b) * c), wrong: [a + b * c, (a + b) * c + c, a * c + b, (a + b) * (c + 1)].filter(v => v !== (a + b) * c).map(String), key: '(a + b) × c' }; }
      if (sub === 'div') { const c = R(2, 6), b = c * R(2, 9), a = R(2, 15), v = a + b / c; return { sub, text: a + ' + ' + b + ' ÷ ' + c + ' = ?', answer: String(v), wrong: [(a + b) / c, v + 1, v - 1, a + b - c].filter(x => x !== v && Number.isInteger(x) && x > 0).map(String), key: 'a + b ÷ c' }; }
      if (sub === 'parensub') { const b = R(2, 8), a = b + R(1, 8), c = R(2, 6), v = (a - b) * c; return { sub, text: '(' + a + ' ' + MINUS + ' ' + b + ') × ' + c + ' = ?', answer: String(v), wrong: [a - b * c, v + c, a * c - b, v - 1].filter(x => x !== v && x > 0).map(String), key: '(a − b) × c' }; }
      const a = R(2, 6), b = R(2, 6), c = R(2, 5), d = R(1, 9), v = a * b - c + d;
      return { sub: 'two', text: a + ' × ' + b + ' ' + MINUS + ' ' + c + ' + ' + d + ' = ?', answer: String(v), wrong: [a * (b - c) + d, a * b - (c + d), v + 2, v - 2].filter(x => x !== v && x >= 0).map(String), key: 'a × b − c + d' };
    } },
    { id: 'area', grade: '4–5', name: 'Area & Perimeter', gen(like) {
      const sub = like && like.sub ? like.sub : pick(['area', 'perim', 'side', 'square', 'pside']);
      const w = R(2, 12), h = R(2, 12);
      if (sub === 'area') return { sub, text: 'Rectangle ' + w + ' by ' + h + '. Area?', answer: String(w * h), wrong: [2 * (w + h), w * h + w, w + h, w * h - h].filter(v => v !== w * h).map(String), key: 'area ' + w + '×' + h };
      if (sub === 'perim') return { sub, text: 'Rectangle ' + w + ' by ' + h + '. Perimeter?', answer: String(2 * (w + h)), wrong: [w * h, w + h, 2 * w + h, 2 * (w + h) + 2].filter(v => v !== 2 * (w + h)).map(String), key: 'perimeter ' + w + '×' + h };
      if (sub === 'square') { const s = R(2, 12), area = Math.random() < 0.5; const v = area ? s * s : 4 * s; return { sub, text: 'Square with sides of ' + s + '. ' + (area ? 'Area?' : 'Perimeter?'), answer: String(v), wrong: [area ? 4 * s : s * s, area ? s * 2 : s + 4, v + s, v - 1].filter(x => x !== v && x > 0).map(String), key: 'square ' + (area ? 'area' : 'perimeter') }; }
      if (sub === 'pside') { const P = 2 * (w + h); return { sub, text: 'Rectangle perimeter is ' + P + ', one side is ' + w + '. Other side?', answer: String(h), wrong: [P - w, P / 2, h + 1, P - 2 * w].filter(v => v !== h && v > 0).map(String), key: 'side from perimeter' }; }
      return { sub: 'side', text: 'Area is ' + (w * h) + ', one side is ' + w + '. Other side?', answer: String(h), wrong: [h + 1, h - 1, w * h - w, h + 2].filter(v => v > 0 && v !== h).map(String), key: 'missing side' };
    } },
    { id: 'factors', grade: '4–5', name: 'Factors & Multiples', gen(like) {
      const sub = like && like.sub ? like.sub : pick(['factor', 'multiple', 'gcf', 'prime', 'lcm']);
      if (sub === 'factor') {
        const n = pick([12, 16, 18, 20, 24, 28, 30, 36, 40, 42, 45, 48]);
        const fs = []; for (let i = 2; i < n; i++) if (n % i === 0) fs.push(i);
        const f = pick(fs), non = []; for (let i = 2; i < 13; i++) if (n % i) non.push(i);
        return { sub, text: 'Which is a factor of ' + n + '?', answer: String(f), wrong: shuffle(non).slice(0, 3).map(String), key: 'factors of ' + n };
      }
      if (sub === 'prime') {
        const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47], comps = [4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 22, 25, 27, 33, 35, 39, 49, 51];
        return { sub, text: 'Which number is prime?', answer: String(pick(primes)), wrong: shuffle(comps.slice()).slice(0, 3).map(String), key: 'prime numbers' };
      }
      if (sub === 'lcm') {
        const pairs = [[2, 3], [3, 4], [4, 6], [2, 5], [3, 5], [4, 5], [6, 8], [3, 6], [4, 10], [6, 9], [5, 6], [2, 7]], [a, b] = pick(pairs), ans = lcm(a, b);
        return { sub, text: 'Least common multiple of ' + a + ' and ' + b + '?', answer: String(ans), wrong: [a * b === ans ? ans * 2 : a * b, gcd(a, b) === 1 ? ans + a : gcd(a, b), ans + b, Math.max(a, b)].filter(v => v !== ans).map(String), key: 'LCM ' + a + ',' + b };
      }
      if (sub === 'multiple') { const k = R(3, 9), m = k * R(3, 9); return { sub, text: 'Next multiple of ' + k + ' after ' + m + '?', answer: String(m + k), wrong: [m + 1, m + k + 1, m + 2 * k, m + k - 1].map(String), key: 'multiples of ' + k }; }
      const g = pick([2, 3, 4, 5, 6]), a = g * pick([2, 3, 5]), b = g * pick([3, 4, 7]);
      const ans = gcd(a, b);
      return { sub: 'gcf', text: 'Greatest common factor of ' + a + ' and ' + b + '?', answer: String(ans), wrong: [ans * 2, ans === 1 ? 2 : 1, Math.min(a, b), ans + 1].filter(v => v !== ans).map(String), key: 'GCF ' + a + ',' + b };
    } },
    { id: 'ratios', grade: '6', name: 'Ratios & Rates', gen(like) {
      const sub = like && like.sub ? like.sub : pick(['equiv', 'rate', 'speed', 'part']);
      if (sub === 'equiv') { const a = R(1, 9), b = R(2, 9), k = R(2, 6); return { sub, text: a + ' : ' + b + ' = ' + (a * k) + ' : ?', answer: String(b * k), wrong: [b + k, b * k + a, b * (k + 1), a * k + 1].filter(v => v !== b * k).map(String), key: a + ':' + b }; }
      if (sub === 'speed') { const mph = R(3, 12) * 5, hrs = R(2, 6), mi = mph * hrs; return { sub, text: 'A car goes ' + mi + ' miles in ' + hrs + ' hours. Miles per hour?', answer: String(mph), wrong: [mph + 5, mph - 5, mi - hrs, mph * 2].filter(v => v !== mph && v > 0).map(String), key: 'speed' }; }
      if (sub === 'part') { const a = R(1, 5), b = a + R(1, 4), k = R(2, 6); return { sub, text: 'Red to blue is ' + a + ' : ' + b + '. There are ' + (a * k) + ' red. How many blue?', answer: String(b * k), wrong: [a * k + b, b + k, a * k, b * k + k].filter(v => v !== b * k).map(String), key: 'ratio parts' }; }
      const each = R(2, 9), n = R(3, 9);
      return { sub: 'rate', text: n + ' tickets cost $' + (each * n) + '. Cost of 1?', answer: '$' + each, wrong: ['$' + (each + 1), '$' + (each * n - n), '$' + (each - 1 || 10), '$' + n].filter(s => s !== '$' + each), key: 'unit rate' };
    } },
    { id: 'integers', grade: '6', name: 'Negative Numbers', gen(like) {
      const sub = like && like.sub ? like.sub : pick(['add', 'sub', 'mul', 'greater']);
      const a = R(-12, 12), b = R(1, 12);
      if (sub === 'add') { const v = a + (Math.random() < 0.5 ? -b : b); const bb = v - a; return { sub, text: neg(a) + ' + ' + (bb < 0 ? '(' + neg(bb) + ')' : bb) + ' = ?', answer: neg(v), wrong: [neg(-v), neg(v + 1), neg(v - 2), neg(a - bb)].filter(s => s !== neg(v)), key: 'integer add' }; }
      if (sub === 'mul') { const x = R(2, 9) * (Math.random() < 0.5 ? -1 : 1), y = R(2, 9) * (x > 0 ? -1 : (Math.random() < 0.5 ? -1 : 1)), v = x * y; return { sub, text: (x < 0 ? '(' + neg(x) + ')' : x) + ' × ' + (y < 0 ? '(' + neg(y) + ')' : y) + ' = ?', answer: neg(v), wrong: [neg(-v), neg(x + y), neg(v + (v > 0 ? 1 : -1))].filter(s => s !== neg(v)), key: 'integer multiply' }; }
      if (sub === 'greater') { let x = R(-15, 5), y = R(-15, 5); while (y === x) y = R(-15, 5); const ans = Math.max(x, y); return { sub, text: 'Which is greater: ' + neg(x) + ' or ' + neg(y) + '?', answer: neg(ans), wrong: [neg(Math.min(x, y)), 'Equal'], key: 'compare integers' }; }
      const v = a - b; return { sub: 'sub', text: neg(a) + ' ' + MINUS + ' ' + b + ' = ?', answer: neg(v), wrong: [neg(a + b), neg(-v), neg(v + 1), neg(v - 1)].filter(s => s !== neg(v)), key: 'integer subtract' };
    } },
    { id: 'percent', grade: '6', name: 'Percent of a Number', gen(like) {
      const mode = like && like.mode ? like.mode : pick(['of', 'of', 'what', 'off']);
      if (mode === 'what') {
        const p = pick([10, 20, 25, 50, 75]), whole = p === 25 || p === 75 ? R(2, 20) * 4 : p === 50 ? R(2, 40) * 2 : R(1, 15) * 10, part = whole * p / 100;
        return { sub: 'what', mode, text: part + ' is what percent of ' + whole + '?', answer: p + '%', wrong: [100 - p, p === 50 ? 20 : p * 2 > 100 ? p / 2 : p * 2, p + 5, part].filter(v => v !== p && v > 0 && v <= 100).map(v => v + '%'), key: 'what percent' };
      }
      if (mode === 'off') {
        const p = pick([10, 20, 25, 50]), price = (p === 25 ? R(2, 20) * 4 : R(1, 10) * 10), save = price * p / 100, sale = price - save;
        return { sub: 'off', mode, text: 'A $' + price + ' toy is ' + p + '% off. Sale price?', answer: '$' + sale, wrong: [save, price - p, sale + save / 2, price + save].filter(v => v > 0 && v !== sale && Number.isInteger(v)).map(v => '$' + v), key: 'percent off' };
      }
      const p = like && like.p ? like.p : pick([10, 20, 25, 50, 75]);   // practice repeats the same percent
      const base = p === 25 || p === 75 ? R(1, 12) * 4 : p === 50 ? R(2, 40) * 2 : R(1, 20) * 10;
      const v = base * p / 100;
      return { sub: 'p' + p, mode: 'of', p, text: p + '% of ' + base + ' = ?', answer: String(v), wrong: [base - v, v * 2, v + 1, base / 10].filter(x => x !== v && Number.isInteger(x) && x > 0).map(String).concat([String(v + 5)]), key: p + '% of a number' };
    } }
  ];


  const BANDS = [
    { id: 'k1', name: 'Grades K–1', grade: 'K–1' },
    { id: 'g23', name: 'Grades 2–3', grade: '2–3' },
    { id: 'g45', name: 'Grades 4–5', grade: '4–5' },
    { id: 'g6', name: 'Grade 6', grade: '6' }
  ];
  const byId = {}; CATS.forEach(c => { byId[c.id] = c; });

  /* Turn generator output into a 3-choice problem. */
  function finalize(cat, raw) {
    let choices;
    if (raw.fixed) choices = raw.fixed.slice();
    else {
      const seen = new Set([raw.answer]), wrong = [];
      const isNeg = v => /^\$?[-−]\$?\d/.test(String(v));
      const allowNeg = cat.id === 'integers' || isNeg(raw.answer);   // negative choices only in the negative-numbers topic
      shuffle(raw.wrong.slice()).forEach(w => { if (wrong.length < 2 && w !== undefined && w !== '' && w !== 'NaN' && !seen.has(w) && (allowNeg || !isNeg(w))) { seen.add(w); wrong.push(w); } });
      let k = 1;
      while (wrong.length < 2) {
        const base = parseFloat(String(raw.answer).replace(/[^\d.\-]/g, '')) || 0;
        const c = String(base + k * 3 + wrong.length);
        if (!seen.has(c)) { seen.add(c); wrong.push(c); }
        k++;
      }
      choices = shuffle([raw.answer].concat(wrong));
    }
    return { cat: cat.id, catName: cat.name, grade: cat.grade, sub: raw.sub, key: raw.key, text: raw.text, answer: raw.answer, choices, raw };
  }

  /* ---------------- Session mastery ---------------- */
  function Session() {
    this.topic = 'band:k1';          // 'band:<id>' or 'cat:<id>'
    this.answered = 0; this.correct = 0;
    this.streak = 0; this.bestStreak = 0;
    this.byCat = {};                 // cat -> { a, c }
    this.facts = {};                 // key -> { a, c, cat, text, answer }
    this.requeue = [];               // { cat, sub, like, due, misses }
    this.history = [];               // last 12 keys to avoid repeats
  }

  Session.prototype.pool = function () {
    if (this.topic.indexOf('cat:') === 0) return [byId[this.topic.slice(4)]];
    const band = BANDS.find(b => b.id === this.topic.slice(5)) || BANDS[0];
    return CATS.filter(c => c.grade === band.grade);
  };

  Session.prototype.next = function () {
    // Due re-queued practice first, but only if it belongs to the current topic.
    const pool = this.pool();
    this.requeue.forEach(r => { r.due--; });
    const due = this.requeue.find(r => r.due <= 0 && pool.indexOf(byId[r.cat]) >= 0);
    let p, tries = 0;
    if (due) {
      p = finalize(byId[due.cat], byId[due.cat].gen(Object.assign({ sub: due.sub }, due.like)));
      p.practice = true;
      due.due = 3;
    } else {
      do { const cat = pick(pool); p = finalize(cat, cat.gen()); tries++; }
      while (tries < 6 && this.history.indexOf(p.text) >= 0);
    }
    this.history.push(p.text); if (this.history.length > 12) this.history.shift();
    return p;
  };

  Session.prototype.record = function (p, ok) {
    this.answered++;
    const c = this.byCat[p.cat] || (this.byCat[p.cat] = { a: 0, c: 0 });
    c.a++;
    const f = this.facts[p.key] || (this.facts[p.key] = { a: 0, c: 0, cat: p.cat, text: p.text, answer: p.answer });
    f.a++; f.text = p.text; f.answer = p.answer;
    const rq = this.requeue.findIndex(r => r.cat === p.cat && r.sub === p.sub);
    if (ok) {
      this.correct++; c.c++; f.c++;
      this.streak++; this.bestStreak = Math.max(this.bestStreak, this.streak);
      if (rq >= 0 && p.practice) this.requeue.splice(rq, 1);   // mastered: stop re-queuing
    } else {
      this.streak = 0;
      if (rq >= 0) { this.requeue[rq].misses++; this.requeue[rq].due = 2; this.requeue[rq].like = p.raw; }
      else this.requeue.push({ cat: p.cat, sub: p.sub, like: p.raw, due: 2 + Math.floor(Math.random() * 2), misses: 1 });
      if (this.requeue.length > 8) this.requeue.shift();
    }
  };

  Session.prototype.accuracy = function () { return this.answered ? this.correct / this.answered : null; };

  Session.prototype.weakest = function (n) {
    return Object.keys(this.facts).map(k => Object.assign({ key: k }, this.facts[k]))
      .filter(f => f.c < f.a)
      .sort((x, y) => (x.c / x.a) - (y.c / y.a) || y.a - x.a)
      .slice(0, n || 5);
  };

  MD.Questions = { CATS, BANDS, byId, Session, finalize };
})(globalThis.MD = globalThis.MD || {});
