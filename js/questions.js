/* Math Defenders — questions.js
   18 curriculum categories (K through grade 6), multiple-choice distractors,
   and session-only mastery tracking that re-queues missed problem types
   until the student gets one right. Nothing is saved anywhere. */
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
     `like` is a previous problem of the same category, used for re-queued practice. */
  const CATS = [
    { id: 'bonds10', grade: 'K–1', name: 'Number Bonds to 10', gen(like) {
      const total = 10, a = like && like.a !== undefined && Math.random() < 0.5 ? like.a : R(0, 10);
      return { sub: 'bond', a, text: a + ' + ? = ' + total, answer: String(total - a), wrong: nums(total - a).filter(n => n >= 0 && n <= 10).map(String), key: 'bond ' + a + '+?=10' };
    } },
    { id: 'compare', grade: 'K–1', name: 'Comparing Numbers', gen() {
      const big = Math.random() < 0.5, a = big ? R(10, 99) : R(0, 20);
      let b = Math.random() < 0.2 ? a : (big ? R(10, 99) : R(0, 20));
      if (b !== a && Math.random() < 0.4 && big) b = parseInt(String(a).split('').reverse().join(''), 10) || a + 1;
      const ans = a < b ? '<' : a > b ? '>' : '=';
      return { sub: big ? 'two-digit' : 'small', text: a + '  ?  ' + b, answer: ans, wrong: ['<', '>', '='].filter(s => s !== ans), key: a + ' vs ' + b, fixed: ['<', '>', '='] };
    } },
    { id: 'missing', grade: 'K–1', name: 'Missing Addends', gen(like) {
      const sum = like ? like.sum : R(5, 20), a = R(0, sum);
      return { sub: 'missing', sum, text: '? + ' + a + ' = ' + sum, answer: String(sum - a), wrong: nums(sum - a).filter(n => n >= 0).map(String), key: '?+' + a + '=' + sum };
    } },
    { id: 'addsub20', grade: 'K–1', name: 'Add & Subtract within 20', gen(like) {
      const sub = like ? like.sub : pick(['add', 'sub']);
      if (sub === 'add') { const a = R(1, 12), b = R(1, 20 - a); return { sub, text: a + ' + ' + b + ' = ?', answer: String(a + b), wrong: nums(a + b).map(String), key: a + ' + ' + b }; }
      const a = R(5, 20), b = R(1, a); return { sub, text: a + ' ' + MINUS + ' ' + b + ' = ?', answer: String(a - b), wrong: nums(a - b).filter(n => n >= 0).map(String), key: a + ' − ' + b };
    } },
    { id: 'regroup', grade: '2–3', name: '2-Digit Regrouping', gen(like) {
      const sub = like ? like.sub : pick(['add', 'sub']);
      if (sub === 'add') {
        let a = R(15, 79), b = R(12, 89 - (a % 10 === 0 ? 0 : 0));
        if ((a % 10) + (b % 10) < 10) b = b - (b % 10) + (9 - (a % 10)) + R(1, Math.min(9, a % 10 || 1));
        if (a + b > 180) b = 99 - a;
        return { sub, text: a + ' + ' + b + ' = ?', answer: String(a + b), wrong: [a + b - 10, a + b + 10, a + b - 1, a + b + 1].map(String), key: a + ' + ' + b };
      }
      let a = R(41, 98), b = R(12, a - 10);
      if ((a % 10) >= (b % 10)) b = Math.min(a - 1, b - (b % 10) + Math.min(9, (a % 10) + R(1, 4)));
      return { sub, text: a + ' ' + MINUS + ' ' + b + ' = ?', answer: String(a - b), wrong: [a - b + 10, a - b - 10, a - b + 1, a - b - 1].filter(n => n >= 0).map(String), key: a + ' − ' + b };
    } },
    { id: 'place', grade: '2–3', name: 'Place Value', gen(like) {
      const sub = like ? like.sub : pick(['digit', 'value', 'build']);
      const places = ['ones', 'tens', 'hundreds', 'thousands'];
      if (sub === 'build') {
        const h = R(1, 9), t = R(0, 9), o = R(0, 9), n = h * 100 + t * 10 + o;
        return { sub, text: h + (h === 1 ? ' hundred + ' : ' hundreds + ') + t + (t === 1 ? ' ten + ' : ' tens + ') + o + (o === 1 ? ' one' : ' ones'), answer: String(n), wrong: [h * 100 + o * 10 + t, h * 10 + t * 100 + o, n + 10, n + 100].filter(v => v !== n).map(String), key: 'build ' + n };
      }
      const n = R(1000, 9999), digits = String(n).split('').reverse(), p = R(0, 3);
      if (sub === 'digit') {
        const d = +digits[p];
        return { sub, text: 'In ' + n.toLocaleString('en-US') + ', which digit is in the ' + places[p] + ' place?', answer: String(d), wrong: digits.map(Number).filter(v => v !== d).map(String).concat([String((d + 1) % 10)]), key: places[p] + ' digit' };
      }
      let q = R(0, 3); while (+digits[q] === 0) q = (q + 1) % 4;
      const v = +digits[q] * Math.pow(10, q);
      return { sub, text: 'What is the value of the ' + digits[q] + ' in ' + n.toLocaleString('en-US') + '?', answer: String(v), wrong: [v * 10, v / 10, +digits[q]].filter(x => x !== v && x >= 1 && Number.isInteger(x)).map(String).concat([String(v * 100)]), key: 'value in ' + places[q] };
    } },
    { id: 'arrays', grade: '2–3', name: 'Multiplication & Fact Families', gen(like) {
      const a = like && Math.random() < 0.6 ? like.a : R(2, 12), b = like && Math.random() < 0.6 ? like.b : R(2, 12), p = a * b;
      const sub = like ? like.sub : pick(['times', 'array', 'family', 'missing']);
      const wrong = [a * (b + 1), a * (b - 1), (a + 1) * b, p + 1, p - 1, p + 10].map(String);
      if (sub === 'array') return { sub, a, b, text: a + ' rows of ' + b + ' = ?', answer: String(p), wrong, key: a + ' × ' + b };
      if (sub === 'family') return { sub, a, b, text: 'If ' + a + ' × ' + b + ' = ' + p + ', then ' + p + ' ÷ ' + b + ' = ?', answer: String(a), wrong: [a + 1, a - 1, b, a + 2].filter(n => n > 0 && n !== a).map(String), key: p + ' ÷ ' + b };
      if (sub === 'missing') return { sub, a, b, text: a + ' × ? = ' + p, answer: String(b), wrong: [b + 1, b - 1, b + 2, a].filter(n => n > 0 && n !== b).map(String), key: a + ' × ' + b };
      return { sub, a, b, text: a + ' × ' + b + ' = ?', answer: String(p), wrong, key: a + ' × ' + b };
    } },
    { id: 'divrem', grade: '2–3', name: 'Division with Remainders', gen(like) {
      const d = like && Math.random() < 0.5 ? like.d : R(2, 9), q = R(2, 11), r = R(1, d - 1), n = d * q + r;
      const fmt = (a, b) => b ? a + ' R' + b : String(a);
      return { sub: 'rem', d, text: n + ' ÷ ' + d + ' = ?', answer: fmt(q, r), wrong: [fmt(q, (r + 1) % d), fmt(q + 1, r), fmt(q - 1, r), fmt(q, r - 1)].filter(s => s !== fmt(q, r)), key: n + ' ÷ ' + d };
    } },
    { id: 'rounding', grade: '2–3', name: 'Rounding to 10 & 100', gen(like) {
      const sub = like ? like.sub : pick(['ten', 'hundred']);
      if (sub === 'ten') { const n = R(11, 999), up = Math.round(n / 10) * 10; return { sub, text: 'Round ' + n + ' to the nearest 10', answer: String(up), wrong: [up - 10, up + 10, Math.round(n / 100) * 100, n].filter(v => v !== up).map(String), key: 'round ' + n + ' to 10' }; }
      const n = R(110, 9999), up = Math.round(n / 100) * 100; return { sub, text: 'Round ' + n.toLocaleString('en-US') + ' to the nearest 100', answer: String(up), wrong: [up - 100, up + 100, Math.round(n / 10) * 10, Math.round(n / 1000) * 1000].filter(v => v !== up && v >= 0).map(String), key: 'round ' + n + ' to 100' };
    } },
    { id: 'equivfrac', grade: '4–5', name: 'Equivalent Fractions', gen(like) {
      const d = R(2, 6), n = R(1, d - 1), k = R(2, 5);
      const sub = like ? like.sub : pick(['missing', 'which']);
      if (sub === 'missing') return { sub, text: n + '/' + d + ' = ?/' + (d * k), answer: String(n * k), wrong: [n * k + 1, n * k - 1, n + k, d * k - n * k].filter(v => v > 0 && v !== n * k).map(String), key: n + '/' + d + ' = ?/' + d * k };
      const ans = (n * k) + '/' + (d * k);
      return { sub, text: 'Which fraction equals ' + n + '/' + d + '?', answer: ans, wrong: [(n + k) + '/' + (d + k), (n * k) + '/' + (d * k + 1), (n * k + 1) + '/' + (d * k), (n + 1) + '/' + d].filter(s => s !== ans), key: 'equal to ' + n + '/' + d };
    } },
    { id: 'fracadd', grade: '4–5', name: 'Fraction Addition', gen(like) {
      const sub = like ? like.sub : pick(['same', 'unlike']);
      if (sub === 'same') {
        const d = R(3, 12), a = R(1, d - 2), b = R(1, d - a - 1);
        return { sub, text: a + '/' + d + ' + ' + b + '/' + d + ' = ?', answer: frac(a + b, d), wrong: [(a + b) + '/' + (d + d), frac(a + b + 1, d), frac(Math.abs(a - b) || 1, d), (a + b) + '/' + (d + 1)].filter(s => s !== frac(a + b, d)), key: a + '/' + d + ' + ' + b + '/' + d };
      }
      const d1 = pick([2, 3, 4]), d2 = d1 * pick([2, 3]), a = R(1, d1 - 1), b = R(1, d2 - 1);
      const n = a * (d2 / d1) + b, ans = frac(n, d2);
      return { sub, text: a + '/' + d1 + ' + ' + b + '/' + d2 + ' = ?', answer: ans, wrong: [(a + b) + '/' + (d1 + d2), frac(n + 1, d2), frac(a + b, d2), frac(n, d2 * 2)].filter(s => s !== ans), key: a + '/' + d1 + ' + ' + b + '/' + d2 };
    } },
    { id: 'money', grade: '4–5', name: 'Decimals & Money', gen(like) {
      const sub = like ? like.sub : pick(['add', 'change', 'decimal']);
      if (sub === 'add') { const a = R(10, 500) * 5, b = R(10, 400) * 5; return { sub, text: money(a) + ' + ' + money(b) + ' = ?', answer: money(a + b), wrong: [money(a + b + 100), money(a + b - 10), money(a + b + 10), money(a + b - 100)], key: 'money add' }; }
      if (sub === 'change') { const paid = pick([500, 1000, 2000]), cost = R(20, paid / 5 - 1) * 5, c = paid - cost; return { sub, text: 'Pay ' + money(paid) + ' for ' + money(cost) + '. Change?', answer: money(c), wrong: [money(c + 100), money(c - 10), money(c + 10), money(Math.abs(c - 100))].filter(s => s !== money(c)), key: 'making change' }; }
      const a = R(1, 9) / 10, b = R(1, 99) / 100, s = Math.round((a + b) * 100) / 100;
      const f = v => (Math.round(v * 100) / 100).toString();
      return { sub, text: f(a) + ' + ' + f(b) + ' = ?', answer: f(s), wrong: [f(s + 0.1), f(s - 0.01 > 0 ? s - 0.01 : s + 0.02), f((Math.round(a * 10) + Math.round(b * 100)) / 100), f(s + 1)].filter(v => v !== f(s)), key: 'decimal add' };
    } },
    { id: 'pemdas', grade: '4–5', name: 'Order of Operations', gen(like) {
      const sub = like ? like.sub : pick(['mul', 'paren', 'two']);
      if (sub === 'mul') { const a = R(2, 12), b = R(2, 9), c = R(2, 9); return { sub, text: a + ' + ' + b + ' × ' + c + ' = ?', answer: String(a + b * c), wrong: [(a + b) * c, a + b + c, a * b + c, a + b * c + 1].filter(v => v !== a + b * c).map(String), key: 'a + b × c' }; }
      if (sub === 'paren') { const a = R(2, 9), b = R(2, 9), c = R(2, 6); return { sub, text: '(' + a + ' + ' + b + ') × ' + c + ' = ?', answer: String((a + b) * c), wrong: [a + b * c, (a + b) * c + c, a * c + b, (a + b) * (c + 1)].filter(v => v !== (a + b) * c).map(String), key: '(a + b) × c' }; }
      const a = R(2, 6), b = R(2, 6), c = R(2, 5), d = R(1, 9), v = a * b - c + d;
      return { sub, text: a + ' × ' + b + ' ' + MINUS + ' ' + c + ' + ' + d + ' = ?', answer: String(v), wrong: [a * (b - c) + d, a * b - (c + d), v + 2, v - 2].filter(x => x !== v && x >= 0).map(String), key: 'a × b − c + d' };
    } },
    { id: 'area', grade: '4–5', name: 'Area & Perimeter', gen(like) {
      const sub = like ? like.sub : pick(['area', 'perim', 'side']);
      const w = R(2, 12), h = R(2, 12);
      if (sub === 'area') return { sub, text: 'Rectangle ' + w + ' by ' + h + '. Area?', answer: String(w * h), wrong: [2 * (w + h), w * h + w, w + h, w * h - h].filter(v => v !== w * h).map(String), key: 'area ' + w + '×' + h };
      if (sub === 'perim') return { sub, text: 'Rectangle ' + w + ' by ' + h + '. Perimeter?', answer: String(2 * (w + h)), wrong: [w * h, w + h, 2 * w + h, 2 * (w + h) + 2].filter(v => v !== 2 * (w + h)).map(String), key: 'perimeter ' + w + '×' + h };
      return { sub, text: 'Area is ' + (w * h) + ', one side is ' + w + '. Other side?', answer: String(h), wrong: [h + 1, h - 1, w * h - w, h + 2].filter(v => v > 0 && v !== h).map(String), key: 'missing side' };
    } },
    { id: 'factors', grade: '4–5', name: 'Factors & Multiples', gen(like) {
      const sub = like ? like.sub : pick(['factor', 'multiple', 'gcf']);
      if (sub === 'factor') {
        const n = pick([12, 16, 18, 20, 24, 28, 30, 36, 40, 42, 45, 48]);
        const fs = []; for (let i = 2; i < n; i++) if (n % i === 0) fs.push(i);
        const f = pick(fs), non = []; for (let i = 2; i < 13; i++) if (n % i) non.push(i);
        return { sub, text: 'Which is a factor of ' + n + '?', answer: String(f), wrong: shuffle(non).slice(0, 3).map(String), key: 'factors of ' + n };
      }
      if (sub === 'multiple') { const k = R(3, 9), m = k * R(3, 9); return { sub, text: 'Next multiple of ' + k + ' after ' + m + '?', answer: String(m + k), wrong: [m + 1, m + k + 1, m + 2 * k, m + k - 1].map(String), key: 'multiples of ' + k }; }
      const g = pick([2, 3, 4, 5, 6]), a = g * pick([2, 3, 5]), b = g * pick([3, 4, 7]);
      const ans = gcd(a, b);
      return { sub, text: 'Greatest common factor of ' + a + ' and ' + b + '?', answer: String(ans), wrong: [ans * 2, ans === 1 ? 2 : 1, Math.min(a, b), ans + 1].filter(v => v !== ans).map(String), key: 'GCF ' + a + ',' + b };
    } },
    { id: 'ratios', grade: '6', name: 'Ratios & Rates', gen(like) {
      const sub = like ? like.sub : pick(['equiv', 'rate']);
      if (sub === 'equiv') { const a = R(1, 9), b = R(2, 9), k = R(2, 6); return { sub, text: a + ' : ' + b + ' = ' + (a * k) + ' : ?', answer: String(b * k), wrong: [b + k, b * k + a, b * (k + 1), a * k + 1].filter(v => v !== b * k).map(String), key: a + ':' + b }; }
      const each = R(2, 9), n = R(3, 9);
      return { sub, text: n + ' tickets cost $' + (each * n) + '. Cost of 1?', answer: '$' + each, wrong: ['$' + (each + 1), '$' + (each * n - n), '$' + (each - 1 || 10), '$' + n].filter(s => s !== '$' + each), key: 'unit rate' };
    } },
    { id: 'integers', grade: '6', name: 'Negative Numbers', gen(like) {
      const sub = like ? like.sub : pick(['add', 'sub']);
      const a = R(-12, 12), b = R(1, 12);
      if (sub === 'add') { const v = a + (Math.random() < 0.5 ? -b : b); const bb = v - a; return { sub, text: neg(a) + ' + ' + (bb < 0 ? '(' + neg(bb) + ')' : bb) + ' = ?', answer: neg(v), wrong: [neg(-v), neg(v + 1), neg(v - 2), neg(a - bb)].filter(s => s !== neg(v)), key: 'integer add' }; }
      const v = a - b; return { sub, text: neg(a) + ' ' + MINUS + ' ' + b + ' = ?', answer: neg(v), wrong: [neg(a + b), neg(-v), neg(v + 1), neg(v - 1)].filter(s => s !== neg(v)), key: 'integer subtract' };
    } },
    { id: 'percent', grade: '6', name: 'Percent of a Number', gen(like) {
      const p = like && Math.random() < 0.5 ? like.p : pick([10, 20, 25, 50, 75]);
      const base = p === 25 || p === 75 ? R(1, 12) * 4 : p === 50 ? R(2, 40) * 2 : R(1, 20) * 10;
      const v = base * p / 100;
      return { sub: 'p' + p, p, text: p + '% of ' + base + ' = ?', answer: String(v), wrong: [base - v, v * 2, v + 1, base / 10].filter(x => x !== v && Number.isInteger(x) && x > 0).map(String).concat([String(v + 5)]), key: p + '% of a number' };
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
      shuffle(raw.wrong.slice()).forEach(w => { if (wrong.length < 2 && w !== undefined && w !== '' && w !== 'NaN' && !seen.has(w)) { seen.add(w); wrong.push(w); } });
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
