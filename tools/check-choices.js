// Checks every kind of question: 3 distinct choices, the answer listed once, no junk values,
// no negative choices outside the negative-numbers topic, practice repeats keep the same kind.
// Usage: node tools/check-choices.js
const file = process.argv[2] || require('path').join(__dirname, '..', 'js', 'questions.js');
globalThis.MD = {}; require(file); const Q = MD.Questions;
const subs = {}, problems = {}, add = (t, k, p) => { const key = t + ' :: ' + k; (problems[key] = problems[key] || []).push(p.text + ' => ' + p.answer + ' [' + p.choices.join(' | ') + ']'); };
function check(cat, p) {
  const k = cat.id + '/' + p.sub; subs[k] = (subs[k] || 0) + 1;
  const ch = p.choices.map(String), ans = String(p.answer);
  if (ch.filter(c => c === ans).length !== 1) add('answer not exactly once', k, p);
  if (new Set(ch).size !== ch.length) add('duplicate choices', k, p);
  if (ch.length !== 3) add('not 3 choices', k, p);
  const all = ch.join(' ') + ' ' + p.text;
  if (/NaN|undefined|Infinity|null|\[object/.test(all)) add('bad value', k, p);
  if (/\d\.\d{3,}/.test(all)) add('float junk', k, p);
  if (/−0(?![.\d])|\$-|\$−|--|\+ -/.test(all)) add('odd sign', k, p);
  if (/(^|[^\d])-\d/.test(all.replace(/−/g, ''))) add('ascii minus', k, p);
  if (/\/0(?!\d)/.test(all)) add('divide by zero', k, p);
  if (!p.key) add('no key', k, p);
}
for (const cat of Q.CATS) {
  for (let i = 0; i < 20000; i++) {
    const p = Q.finalize(cat, cat.gen()); check(cat, p);
    const again = Q.finalize(cat, cat.gen(Object.assign({ sub: p.sub }, p.raw)));   // practice-round repeat
    if (again.sub !== p.sub) add('practice changed kind (' + p.sub + ' -> ' + again.sub + ')', cat.id + '/' + p.sub, again);
    check(cat, again);
  }
}
console.log('KINDS OF QUESTION:', Object.keys(subs).length);
console.log(Object.keys(subs).sort().join('  '));
console.log('\nPROBLEMS:', Object.keys(problems).length);
for (const [t, v] of Object.entries(problems)) console.log(v.length, t, '\n   e.g.', [...new Set(v)].slice(0, 3).join('\n        '));
