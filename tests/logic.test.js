// Circuit Lab BD - logic unit tests. Plain node assert, no deps.
// Run: node tests/logic.test.js
const assert = require('assert');
const DATA = require('../js/data');
const L = require('../js/logic');

let n = 0;
function check(name, fn) { n += 1; fn(); console.log('ok - ' + name); }
function approx(a, b, eps) { assert.ok(Math.abs(a - b) < (eps || 1e-9), 'expected ' + a + ' \u2248 ' + b); }

// --- data integrity ---
check('6 presets with unique ids', () => {
  assert.strictEqual(DATA.presets.length, 6);
  const ids = DATA.presets.map((p) => p.id);
  assert.strictEqual(new Set(ids).size, 6);
});
check('8 quiz questions, answer index in range, options = 4', () => {
  assert.strictEqual(DATA.quiz.length, 8);
  DATA.quiz.forEach((q, i) => {
    assert.strictEqual(q.options.length, 4, 'q' + i);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4, 'q' + i);
    assert.ok(q.en.q && q.bn.q && q.en.why && q.bn.why, 'q' + i + ' text');
  });
});
check('i18n: every en key exists in bn', () => {
  const enKeys = Object.keys(DATA.i18n.en);
  assert.ok(enKeys.length > 40, 'en keys: ' + enKeys.length);
  enKeys.forEach((k) => assert.ok(typeof DATA.i18n.bn[k] === 'string' && DATA.i18n.bn[k].length > 0, 'missing bn: ' + k));
});
check('presets are valid circuits (no validation errors except intended)', () => {
  DATA.presets.forEach((p) => {
    const errs = L.validateCircuit(p.parts);
    if (p.id === 'switch') assert.deepStrictEqual(errs, ['open-switch']);
    else if (p.id === 'short') assert.deepStrictEqual(errs, []);
    else assert.deepStrictEqual(errs, [], p.id);
  });
});

// --- analyse: simple loop 9V + 100R + 30R bulb ---
check('simple loop: R=130, I=9/130, drops sum to 9V, power sums to V*I', () => {
  const a = L.analyse(DATA.presets[0].parts);
  assert.deepStrictEqual(a.errors, []);
  assert.strictEqual(a.voltage, 9);
  assert.strictEqual(a.resistance, 130);
  approx(a.current, 9 / 130);
  assert.strictEqual(a.flowing, true);
  assert.strictEqual(a.hasBulb, true);
  approx(a.bulbBrightness, (a.current * a.current * 30) / 3);
  const vSum = a.rows.filter((r) => r.kind !== 'battery').reduce((s, r) => s + r.voltage, 0);
  approx(vSum, 9);
  const pSum = a.rows.filter((r) => r.kind !== 'battery').reduce((s, r) => s + r.power, 0);
  approx(pSum, 9 * a.current);
  assert.strictEqual(a.rows[1].voltage, a.current * 100);
});
check('series preset: 12V / 320R = 0.0375A', () => {
  const a = L.analyse(DATA.presets[1].parts);
  assert.strictEqual(a.resistance, 320);
  approx(a.current, 0.0375);
  approx(a.rows[1].voltage, 3.75);
  approx(a.rows[2].voltage, 8.25);
});
check('parallel preset: Req=50, I=0.18A, branches 0.09A each', () => {
  const a = L.analyse(DATA.presets[2].parts);
  assert.strictEqual(a.resistance, 50);
  approx(a.current, 0.18);
  const row = a.rows[1];
  assert.strictEqual(row.kind, 'parallel');
  approx(row.voltage, 9);
  approx(row.branches[0].current, 0.09);
  approx(row.branches[1].current, 0.09);
  approx(row.branches[0].power + row.branches[1].power, 1.62);
});
check('combo preset: 100 + 110 + 30 = 240R, I=0.05A', () => {
  const a = L.analyse(DATA.presets[3].parts);
  assert.strictEqual(a.resistance, 240);
  approx(a.current, 0.05);
  approx(a.rows[2].voltage, 5.5); // parallel block drop
  approx(a.rows[2].branches[0].current, 0.025);
});
check('open-switch preset: current 0, error reported, bulb dark', () => {
  const a = L.analyse(DATA.presets[4].parts);
  assert.deepStrictEqual(a.errors, ['open-switch']);
  assert.strictEqual(a.current, 0);
  assert.strictEqual(a.flowing, false);
  assert.strictEqual(a.bulbBrightness, 0);
});
check('short preset: battery + closed switch only = short circuit, current null', () => {
  const a = L.analyse(DATA.presets[5].parts);
  assert.strictEqual(a.shortCircuit, true);
  assert.strictEqual(a.current, null);
  assert.ok(a.warnings.indexOf('short-circuit') !== -1);
});
check('no battery: error, current 0', () => {
  const a = L.analyse([{ kind: 'resistor', r: 100, rating: 0.5 }]);
  assert.ok(a.errors.indexOf('no-battery') !== -1);
  assert.strictEqual(a.current, 0);
});
check('empty circuit: error', () => {
  const a = L.analyse([]);
  assert.ok(a.errors.indexOf('empty') !== -1);
});
check('overload: 9V across 10R 0.25W resistor warns', () => {
  const a = L.analyse([
    { kind: 'battery', v: 9 },
    { kind: 'resistor', r: 10, rating: 0.25 },
  ]);
  approx(a.current, 0.9);
  approx(a.rows[1].power, 8.1);
  assert.strictEqual(a.rows[1].overloaded, true);
  assert.ok(a.warnings.indexOf('overload') !== -1);
});
check('two batteries add voltages', () => {
  const a = L.analyse([
    { kind: 'battery', v: 9 },
    { kind: 'battery', v: 9 },
    { kind: 'resistor', r: 100, rating: 0.5 },
  ]);
  assert.strictEqual(a.voltage, 18);
  approx(a.current, 0.18);
});
check('parallel resistance math: 100||100=50, 220||220=110', () => {
  approx(L.componentResistance({ kind: 'parallel', r1: 100, r2: 100 }), 50);
  approx(L.componentResistance({ kind: 'parallel', r1: 220, r2: 220 }), 110);
  approx(L.componentResistance({ kind: 'parallel', r1: 100, r2: 200 }), 200 / 3);
});

// --- Ohm's solver: all six pairs ---
check('solveOhms V+I -> R=4, P=36', () => {
  const r = L.solveOhms({ v: 12, i: 3 });
  assert.deepStrictEqual([r.v, r.i, r.r, r.p], [12, 3, 4, 36]);
});
check('solveOhms V+R -> I=3, P=36', () => {
  const r = L.solveOhms({ v: 12, r: 4 });
  approx(r.i, 3); approx(r.p, 36);
});
check('solveOhms V+P -> I=2, R=4.5', () => {
  const r = L.solveOhms({ v: 9, p: 18 });
  approx(r.i, 2); approx(r.r, 4.5);
});
check('solveOhms I+R -> V=20, P=40', () => {
  const r = L.solveOhms({ i: 2, r: 10 });
  approx(r.v, 20); approx(r.p, 40);
});
check('solveOhms I+P -> V=12, R=6', () => {
  const r = L.solveOhms({ i: 2, p: 24 });
  approx(r.v, 12); approx(r.r, 6);
});
check('solveOhms R+P -> V=12, I=3', () => {
  const r = L.solveOhms({ r: 4, p: 36 });
  approx(r.v, 12); approx(r.i, 3);
});
check('solveOhms rejects one value and non-positive values', () => {
  assert.strictEqual(L.solveOhms({ v: 12 }).error, 'need-two');
  assert.strictEqual(L.solveOhms({ v: 12, i: 3, r: 4 }).error, 'need-two');
  assert.strictEqual(L.solveOhms({ v: 0, i: 3 }).error, 'not-positive');
  assert.strictEqual(L.solveOhms({ v: -5, i: 3 }).error, 'not-positive');
  assert.strictEqual(L.solveOhms({ v: 'x', i: 3 }).error, 'not-positive');
});

// --- parseNum + formatters ---
check('parseNum accepts in-range, rejects empty/NaN/out-of-range', () => {
  assert.deepStrictEqual(L.parseNum('9', 0.5, 48), { ok: true, value: 9 });
  assert.strictEqual(L.parseNum('', 0.5, 48).ok, false);
  assert.strictEqual(L.parseNum('abc', 0.5, 48).ok, false);
  assert.strictEqual(L.parseNum('0.1', 0.5, 48).error, 'too-small');
  assert.strictEqual(L.parseNum('100', 0.5, 48).error, 'too-large');
});
check('formatters: current and resistance units', () => {
  assert.strictEqual(L.fmtCurrent(0), '0 A');
  assert.strictEqual(L.fmtCurrent(0.0005), '500.0 \u00b5A');
  assert.strictEqual(L.fmtCurrent(0.0692), '69.2 mA');
  assert.strictEqual(L.fmtCurrent(2.5), '2.50 A');
  assert.strictEqual(L.fmtResistance(130), '130.0 \u03a9');
  assert.strictEqual(L.fmtResistance(2200), '2.20 k\u03a9');
});

console.log('UNIT PASS: ' + n + '/' + n);
