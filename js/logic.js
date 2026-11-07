// Circuit Lab BD - pure circuit math. No DOM. Works in Node (module.exports)
// and in the browser (window.CIRCUIT_LOGIC).
(function (root) {
  var LIMITS = {
    battery: { v: [0.5, 48] },
    resistor: { r: [0.1, 10000], rating: [0.25, 0.5, 1, 2, 5] },
    bulb: { r: [1, 500], rating: [0.5, 1, 3, 5, 10] },
    parallel: { r: [0.1, 10000] },
  };
  var MAX_COMPONENTS = 8;

  function isFiniteNumber(x) {
    return typeof x === 'number' && isFinite(x);
  }

  // Parse a user-entered number. Returns {ok, value} or {ok:false, error}.
  function parseNum(raw, min, max) {
    if (raw === null || raw === undefined || String(raw).trim() === '') {
      return { ok: false, error: 'empty' };
    }
    var v = Number(raw);
    if (!isFiniteNumber(v)) return { ok: false, error: 'not-a-number' };
    if (v < min) return { ok: false, error: 'too-small' };
    if (v > max) return { ok: false, error: 'too-large' };
    return { ok: true, value: v };
  }

  function componentResistance(c) {
    if (c.kind === 'resistor' || c.kind === 'bulb') return c.r;
    if (c.kind === 'parallel') return (c.r1 * c.r2) / (c.r1 + c.r2);
    return 0; // battery, switch, wire
  }

  function validateCircuit(components) {
    var errors = [];
    if (!Array.isArray(components) || components.length === 0) {
      errors.push('empty');
      return errors;
    }
    if (components.length > MAX_COMPONENTS) errors.push('too-many');
    var batteries = 0;
    var hasSwitch = false;
    var openSwitch = false;
    components.forEach(function (c) {
      if (c.kind === 'battery') {
        batteries += 1;
        if (!isFiniteNumber(c.v) || c.v < LIMITS.battery.v[0] || c.v > LIMITS.battery.v[1]) {
          errors.push('bad-battery');
        }
      } else if (c.kind === 'resistor' || c.kind === 'bulb') {
        var lim = LIMITS[c.kind];
        if (!isFiniteNumber(c.r) || c.r < lim.r[0] || c.r > lim.r[1]) errors.push('bad-resistance');
        if (LIMITS.resistor.rating.indexOf(c.rating) === -1 && LIMITS.bulb.rating.indexOf(c.rating) === -1) {
          errors.push('bad-rating');
        }
      } else if (c.kind === 'parallel') {
        if (!isFiniteNumber(c.r1) || c.r1 < 0.1 || c.r1 > 10000 ||
            !isFiniteNumber(c.r2) || c.r2 < 0.1 || c.r2 > 10000) {
          errors.push('bad-resistance');
        }
      } else if (c.kind === 'switch') {
        hasSwitch = true;
        if (!c.closed) openSwitch = true;
      } else {
        errors.push('bad-kind');
      }
    });
    if (batteries === 0) errors.push('no-battery');
    if (hasSwitch && openSwitch) errors.push('open-switch');
    return errors;
  }

  // Full analysis of a series loop. Returns a plain object; never throws on
  // bad input (validation errors are reported instead).
  function analyse(components) {
    var errors = validateCircuit(components);
    var result = {
      errors: errors,
      voltage: 0,
      resistance: 0,
      current: 0,
      rows: [],
      warnings: [],
      bulbBrightness: 0,
      hasBulb: false,
      flowing: false,
      shortCircuit: false,
    };
    if (errors.indexOf('empty') !== -1 || errors.indexOf('bad-kind') !== -1 ||
        errors.indexOf('bad-battery') !== -1 || errors.indexOf('bad-resistance') !== -1 ||
        errors.indexOf('bad-rating') !== -1 || errors.indexOf('too-many') !== -1) {
      return result;
    }
    var voltage = 0;
    var resistance = 0;
    components.forEach(function (c) {
      if (c.kind === 'battery') voltage += c.v;
      resistance += componentResistance(c);
    });
    result.voltage = voltage;
    result.resistance = resistance;
    var openSwitch = errors.indexOf('open-switch') !== -1;
    var noBattery = errors.indexOf('no-battery') !== -1;
    if (!noBattery && resistance <= 0.1 && voltage > 0) {
      result.shortCircuit = true;
      result.warnings.push('short-circuit');
      result.current = null;
    } else if (!noBattery && !openSwitch && resistance > 0) {
      result.current = voltage / resistance;
      result.flowing = result.current > 0;
    }
    var I = result.current;
    components.forEach(function (c, idx) {
      if (c.kind === 'battery') {
        result.rows.push({
          idx: idx, kind: 'battery', label: 'battery',
          voltage: c.v, current: I === null ? null : I,
          power: (I === null || I === 0) ? 0 : c.v * I, rating: null, overloaded: false,
        });
      } else if (c.kind === 'resistor' || c.kind === 'bulb') {
        var vDrop = (I === null || I === 0) ? 0 : I * c.r;
        var p = (I === null || I === 0) ? 0 : I * I * c.r;
        var overloaded = p > c.rating;
        if (overloaded) result.warnings.push('overload');
        if (c.kind === 'bulb') {
          result.hasBulb = true;
          result.bulbBrightness = Math.min(1, p / c.rating);
        }
        result.rows.push({
          idx: idx, kind: c.kind, label: c.kind,
          voltage: vDrop, current: I === null ? null : I,
          power: p, rating: c.rating, overloaded: overloaded,
        });
      } else if (c.kind === 'parallel') {
        var rEq = componentResistance(c);
        var vBlock = (I === null || I === 0) ? 0 : I * rEq;
        var i1 = (vBlock === 0) ? 0 : vBlock / c.r1;
        var i2 = (vBlock === 0) ? 0 : vBlock / c.r2;
        var p1 = vBlock * i1;
        var p2 = vBlock * i2;
        result.rows.push({
          idx: idx, kind: 'parallel', label: 'parallel',
          voltage: vBlock, current: I === null ? null : I,
          power: p1 + p2, rating: null, overloaded: false,
          branches: [
            { r: c.r1, current: i1, power: p1 },
            { r: c.r2, current: i2, power: p2 },
          ],
        });
      } else if (c.kind === 'switch') {
        result.rows.push({
          idx: idx, kind: 'switch', label: 'switch',
          voltage: 0, current: I === null ? null : I,
          power: 0, rating: null, overloaded: false, closed: !!c.closed,
        });
      }
    });
    return result;
  }

  // Ohm's law solver: exactly two of v (volts), i (amps), r (ohms), p (watts)
  // must be given, all > 0. Returns {v,i,r,p} or {error}.
  function solveOhms(known) {
    var keys = ['v', 'i', 'r', 'p'].filter(function (k) {
      return known[k] !== undefined && known[k] !== null && known[k] !== '';
    });
    if (keys.length !== 2) return { error: 'need-two' };
    var vals = {};
    for (var j = 0; j < keys.length; j++) {
      var n = Number(known[keys[j]]);
      if (!isFiniteNumber(n) || n <= 0) return { error: 'not-positive' };
      vals[keys[j]] = n;
    }
    var v = vals.v, i = vals.i, r = vals.r, p = vals.p;
    if (v !== undefined && i !== undefined) { r = v / i; p = v * i; }
    else if (v !== undefined && r !== undefined) { i = v / r; p = (v * v) / r; }
    else if (v !== undefined && p !== undefined) { i = p / v; r = (v * v) / p; }
    else if (i !== undefined && r !== undefined) { v = i * r; p = i * i * r; }
    else if (i !== undefined && p !== undefined) { v = p / i; r = p / (i * i); }
    else if (r !== undefined && p !== undefined) { v = Math.sqrt(p * r); i = Math.sqrt(p / r); }
    return { v: v, i: i, r: r, p: p };
  }

  // Format helpers (ASCII-safe, locale-free so tests are deterministic).
  function fmtNum(x, decimals) {
    if (x === null || x === undefined || !isFinite(x)) return '\u2014';
    return x.toFixed(decimals === undefined ? 2 : decimals);
  }
  function fmtCurrent(a) {
    if (a === null || a === undefined) return '\u2014';
    if (a === 0) return '0 A';
    if (a < 0.001) return fmtNum(a * 1000000, 1) + ' \u00b5A';
    if (a < 1) return fmtNum(a * 1000, 1) + ' mA';
    return fmtNum(a, 2) + ' A';
  }
  function fmtResistance(r) {
    if (r === null || r === undefined) return '\u2014';
    if (r >= 1000) return fmtNum(r / 1000, 2) + ' k\u03a9';
    return fmtNum(r, 1) + ' \u03a9';
  }

  var api = {
    LIMITS: LIMITS, MAX_COMPONENTS: MAX_COMPONENTS,
    parseNum: parseNum, componentResistance: componentResistance,
    validateCircuit: validateCircuit, analyse: analyse,
    solveOhms: solveOhms, fmtNum: fmtNum,
    fmtCurrent: fmtCurrent, fmtResistance: fmtResistance,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CIRCUIT_LOGIC = api;
})(typeof window !== 'undefined' ? window : globalThis);
