// Circuit Lab BD - UI. Depends on js/logic.js (window.CIRCUIT_LOGIC)
// and js/data.js (window.CIRCUIT_DATA). Plain DOM, no libraries.
(function () {
  'use strict';
  var L = window.CIRCUIT_LOGIC;
  var D = window.CIRCUIT_DATA;
  var KEY = 'circuit-lab-bd-v1';
  var BN_DIGITS = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea', '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];

  var state = {
    lang: 'en',
    components: [],
    quizIdx: 0,
    quizScore: 0,
    quizAnswered: false,
    quizDone: false,
    quizBest: 0,
  };
  var nextId = 1;

  function $(id) { return document.getElementById(id); }
  function t(key) { return D.i18n[state.lang][key] || D.i18n.en[key] || key; }
  function digits(s) {
    s = String(s);
    if (state.lang !== 'bn') return s;
    return s.replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; });
  }
  function num(x, dec) { return digits(L.fmtNum(x, dec)); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        lang: state.lang,
        components: state.components,
        quizBest: state.quizBest,
      }));
    } catch (e) { /* storage unavailable: app still works */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return false;
      var saved = JSON.parse(raw);
      if (saved && Array.isArray(saved.components)) {
        state.components = saved.components;
        state.lang = saved.lang === 'bn' ? 'bn' : 'en';
        state.quizBest = typeof saved.quizBest === 'number' ? saved.quizBest : 0;
        state.components.forEach(function (c) { if (c.id >= nextId) nextId = c.id + 1; });
        return true;
      }
    } catch (e) { /* corrupted storage: fall through to default */ }
    return false;
  }

  function cloneParts(parts) {
    return parts.map(function (p) {
      var c = { id: nextId++, kind: p.kind };
      if (p.v !== undefined) c.v = p.v;
      if (p.r !== undefined) c.r = p.r;
      if (p.r1 !== undefined) c.r1 = p.r1;
      if (p.r2 !== undefined) c.r2 = p.r2;
      if (p.rating !== undefined) c.rating = p.rating;
      if (p.closed !== undefined) c.closed = p.closed;
      return c;
    });
  }
  function loadPreset(id) {
    var preset = null;
    D.presets.forEach(function (p) { if (p.id === id) preset = p; });
    if (!preset) return;
    state.components = cloneParts(preset.parts);
    save();
    renderAll();
  }
  function defaultCircuit() {
    state.components = cloneParts(D.presets[0].parts);
  }

  function addComponent(kind) {
    if (state.components.length >= L.MAX_COMPONENTS) return;
    var batteries = state.components.filter(function (c) { return c.kind === 'battery'; }).length;
    if (kind === 'battery' && batteries >= 2) return;
    var c = { id: nextId++, kind: kind };
    if (kind === 'battery') c.v = 9;
    if (kind === 'resistor') { c.r = 100; c.rating = 0.5; }
    if (kind === 'bulb') { c.r = 30; c.rating = 3; }
    if (kind === 'switch') c.closed = true;
    if (kind === 'parallel') { c.r1 = 100; c.r2 = 100; }
    state.components.push(c);
    save();
    renderAll();
  }

  // ---------- schematic ----------
  var W = 360, H = 220, X0 = 40, Y0 = 40, X1 = 320, Y1 = 180;
  var PERIM = 2 * ((X1 - X0) + (Y1 - Y0));

  function perimeterPoint(arc) {
    var top = X1 - X0, right = Y1 - Y0, bottom = X1 - X0, left = Y1 - Y0;
    if (arc < top) return { x: X0 + arc, y: Y0, a: 0 };
    arc -= top;
    if (arc < right) return { x: X1, y: Y0 + arc, a: 90 };
    arc -= right;
    if (arc < bottom) return { x: X1 - arc, y: Y1, a: 180 };
    arc -= bottom;
    return { x: X0, y: Y1 - arc, a: 270 };
  }

  function zigzag(y, x0, x1) {
    var w = (x1 - x0) / 6;
    var pts = [[x0, y], [x0 + w, y], [x0 + w * 1.5, y - 7], [x0 + w * 2.5, y + 7],
      [x0 + w * 3.5, y - 7], [x0 + w * 4.5, y + 7], [x0 + w * 5, y], [x1, y]];
    return pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
  }

  function glyph(c, brightness) {
    var s = '';
    if (c.kind === 'resistor') {
      s = '<polyline points="' + zigzag(0, -18, 18) + '" fill="none" stroke="#e2e8f0" stroke-width="2"/>';
    } else if (c.kind === 'bulb') {
      var op = 0.15 + 0.85 * brightness;
      s = '<circle cx="0" cy="0" r="16" fill="#fde68a" opacity="' + (0.55 * brightness).toFixed(2) + '"/>' +
        '<circle cx="0" cy="0" r="11" fill="#fef3c7" fill-opacity="' + op.toFixed(2) + '" stroke="#e2e8f0" stroke-width="2"/>' +
        '<path d="M-5,-4 L-2,4 L2,-4 L5,4" fill="none" stroke="#92400e" stroke-width="1.6"/>';
    } else if (c.kind === 'battery') {
      s = '<line x1="-5" y1="-13" x2="-5" y2="13" stroke="#e2e8f0" stroke-width="2"/>' +
        '<line x1="6" y1="-7" x2="6" y2="7" stroke="#e2e8f0" stroke-width="5"/>' +
        '<text x="-5" y="-18" fill="#e2e8f0" font-size="11" text-anchor="middle">+</text>';
    } else if (c.kind === 'switch') {
      var lever = c.closed
        ? '<line x1="-8" y1="0" x2="8" y2="0" stroke="#e2e8f0" stroke-width="2"/>'
        : '<line x1="-8" y1="0" x2="7" y2="-11" stroke="#e2e8f0" stroke-width="2"/>';
      s = '<circle cx="-8" cy="0" r="2.4" fill="#e2e8f0"/><circle cx="8" cy="0" r="2.4" fill="#e2e8f0"/>' + lever;
    } else if (c.kind === 'parallel') {
      s = '<line x1="-14" y1="-9" x2="-14" y2="9" stroke="#e2e8f0" stroke-width="2"/>' +
        '<line x1="14" y1="-9" x2="14" y2="9" stroke="#e2e8f0" stroke-width="2"/>' +
        '<polyline points="' + zigzag(-9, -14, 14) + '" fill="none" stroke="#e2e8f0" stroke-width="2"/>' +
        '<polyline points="' + zigzag(9, -14, 14) + '" fill="none" stroke="#e2e8f0" stroke-width="2"/>';
    }
    return s;
  }

  function renderSchematic(analysis) {
    var svg = $('schematic-svg');
    if (!svg) return;
    var n = state.components.length;
    var parts = [];
    parts.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#0f172a" rx="10"/>');
    parts.push('<path d="M' + X0 + ',' + Y0 + ' H' + X1 + ' V' + Y1 + ' H' + X0 + ' Z" fill="none" stroke="#64748b" stroke-width="2"/>');
    if (analysis.flowing && analysis.current) {
      var dur = Math.min(4, Math.max(0.5, 0.6 / analysis.current)).toFixed(2);
      for (var d = 0; d < 6; d++) {
        parts.push('<circle r="3.5" fill="#fbbf24">' +
          '<animateMotion dur="' + dur + 's" begin="' + (-d * dur / 6).toFixed(2) + 's" repeatCount="indefinite" ' +
          'path="M' + X0 + ',' + Y0 + ' H' + X1 + ' V' + Y1 + ' H' + X0 + ' Z"/></circle>');
      }
    }
    state.components.forEach(function (c, i) {
      var arc = ((i + 0.5) / Math.max(n, 1)) * PERIM;
      var pt = perimeterPoint(arc);
      var brightness = c.kind === 'bulb' ? analysis.bulbBrightness : 0;
      var bgH = c.kind === 'parallel' ? 22 : 17;
      parts.push('<g transform="translate(' + pt.x.toFixed(1) + ',' + pt.y.toFixed(1) + ') rotate(' + pt.a + ')">' +
        '<rect x="-21" y="' + (-bgH) + '" width="42" height="' + (bgH * 2) + '" fill="#0f172a"/>' +
        glyph(c, brightness) + '</g>');
    });
    if (n === 0) {
      parts.push('<text x="180" y="112" fill="#94a3b8" font-size="14" text-anchor="middle">' + esc(t('emptyCircuit')) + '</text>');
    }
    svg.innerHTML = parts.join('');
  }

  // ---------- builder ----------
  function ratingOptions(kind, selected) {
    var ratings = kind === 'bulb' ? [0.5, 1, 3, 5, 10] : [0.25, 0.5, 1, 2, 5];
    return ratings.map(function (r) {
      return '<option value="' + r + '"' + (r === selected ? ' selected' : '') + '>' + digits(r) + ' W</option>';
    }).join('');
  }

  function renderBuilder() {
    var box = $('parts');
    if (state.components.length === 0) {
      box.innerHTML = '<p class="empty">' + esc(t('emptyCircuit')) + '</p>';
      return;
    }
    box.innerHTML = state.components.map(function (c) {
      var fields = '';
      if (c.kind === 'battery') {
        fields = '<label>' + esc(t('volts')) + ' <input type="number" min="0.5" max="48" step="0.5" value="' + c.v + '" data-id="' + c.id + '" data-field="v"></label>';
      } else if (c.kind === 'resistor') {
        fields = '<label>' + esc(t('ohms')) + ' <input type="number" min="0.1" max="10000" step="1" value="' + c.r + '" data-id="' + c.id + '" data-field="r"></label>' +
          '<label>' + esc(t('rating')) + ' <select data-id="' + c.id + '" data-field="rating">' + ratingOptions('resistor', c.rating) + '</select></label>';
      } else if (c.kind === 'bulb') {
        fields = '<label>' + esc(t('ohms')) + ' <input type="number" min="1" max="500" step="1" value="' + c.r + '" data-id="' + c.id + '" data-field="r"></label>' +
          '<label>' + esc(t('rating')) + ' <select data-id="' + c.id + '" data-field="rating">' + ratingOptions('bulb', c.rating) + '</select></label>';
      } else if (c.kind === 'switch') {
        fields = '<label class="check"><input type="checkbox" data-id="' + c.id + '" data-field="closed"' + (c.closed ? ' checked' : '') + '> ' + esc(t('closed')) + '</label>';
      } else if (c.kind === 'parallel') {
        fields = '<label>' + esc(t('ohms1')) + ' <input type="number" min="0.1" max="10000" step="1" value="' + c.r1 + '" data-id="' + c.id + '" data-field="r1"></label>' +
          '<label>' + esc(t('ohms2')) + ' <input type="number" min="0.1" max="10000" step="1" value="' + c.r2 + '" data-id="' + c.id + '" data-field="r2"></label>';
      }
      return '<div class="part-row" data-kind="' + c.kind + '">' +
        '<span class="part-name">' + esc(t(c.kind)) + '</span>' +
        '<span class="part-fields">' + fields + '</span>' +
        '<button class="icon-btn" data-remove="' + c.id + '" aria-label="' + esc(t('remove')) + '">\u00d7</button></div>';
    }).join('');
    box.querySelectorAll('input[type="number"]').forEach(function (input) {
      input.addEventListener('change', function () {
        var id = +input.getAttribute('data-id');
        var field = input.getAttribute('data-field');
        var c = state.components.filter(function (x) { return x.id === id; })[0];
        if (!c) return;
        var lim = field === 'v' ? [0.5, 48] : field === 'r' ? (c.kind === 'bulb' ? [1, 500] : [0.1, 10000]) : [0.1, 10000];
        var parsed = L.parseNum(input.value, lim[0], lim[1]);
        if (!parsed.ok) { input.classList.add('invalid'); return; }
        input.classList.remove('invalid');
        c[field] = parsed.value;
        save();
        renderAll();
      });
    });
    box.querySelectorAll('select').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var id = +sel.getAttribute('data-id');
        var c = state.components.filter(function (x) { return x.id === id; })[0];
        if (!c) return;
        c.rating = Number(sel.value);
        save();
        renderAll();
      });
    });
    box.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var id = +cb.getAttribute('data-id');
        var c = state.components.filter(function (x) { return x.id === id; })[0];
        if (!c) return;
        c.closed = cb.checked;
        save();
        renderAll();
      });
    });
    box.querySelectorAll('[data-remove]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = +btn.getAttribute('data-remove');
        state.components = state.components.filter(function (x) { return x.id !== id; });
        save();
        renderAll();
      });
    });
  }

  // ---------- readings ----------
  function partLabel(row) {
    var base = t(row.kind);
    return base;
  }

  function renderReadings(analysis) {
    var box = $('readings-box');
    var warnHtml = '';
    if (analysis.errors.indexOf('empty') !== -1) {
      box.innerHTML = '<p class="empty">' + esc(t('emptyCircuit')) + '</p>';
      return;
    }
    if (analysis.errors.indexOf('no-battery') !== -1) {
      warnHtml += '<p class="warn">' + esc(t('noBattery')) + '</p>';
    }
    if (analysis.errors.indexOf('open-switch') !== -1) {
      warnHtml += '<p class="warn">' + esc(t('openSwitch')) + '</p>';
    }
    if (analysis.shortCircuit) {
      warnHtml += '<p class="warn strong">' + esc(t('shortCircuit')) + '</p>';
    }
    if (analysis.warnings.indexOf('overload') !== -1) {
      warnHtml += '<p class="warn">' + esc(t('overload')) + '</p>';
    }
    var status = analysis.flowing ? t('flowing') : t('notFlowing');
    var bulbLine = '';
    if (analysis.hasBulb) {
      bulbLine = '<div class="stat"><span>' + esc(t('bulb')) + '</span><b>' +
        (analysis.bulbBrightness > 0 ? esc(t('bulbOn')) + ' (' + digits(Math.round(analysis.bulbBrightness * 100)) + '%)' : esc(t('bulbOff'))) + '</b></div>';
    }
    var rowsHtml = analysis.rows.map(function (row) {
      var vCell = row.voltage === null ? '\u2014' : num(row.voltage) + ' V';
      var iCell = row.current === null ? (analysis.shortCircuit ? esc(t('shortWarn')) : '\u2014') : digits(L.fmtCurrent(row.current));
      var pCell = num(row.power, 2) + ' W';
      var warn = row.overloaded ? ' <span class="tag-over">' + esc(t('overloadWarn')) + '</span>' : '';
      var sub = '';
      if (row.branches) {
        sub = row.branches.map(function (b, bi) {
          return '<tr class="sub"><td>' + esc(t('branch')) + ' ' + digits(bi + 1) + ' (' + num(b.r, 0) + ' \u03a9)</td><td>' + num(row.voltage) + ' V</td><td>' +
            digits(L.fmtCurrent(b.current)) + '</td><td>' + num(b.power, 2) + ' W</td></tr>';
        }).join('');
      }
      return '<tr><td>' + esc(partLabel(row)) + warn + '</td><td>' + vCell + '</td><td>' + iCell + '</td><td>' + pCell + '</td></tr>' + sub;
    }).join('');
    box.innerHTML =
      '<div class="stats">' +
      '<div class="stat"><span>' + esc(t('totalVoltage')) + '</span><b>' + num(analysis.voltage) + ' V</b></div>' +
      '<div class="stat"><span>' + esc(t('totalResistance')) + '</span><b>' + digits(L.fmtResistance(analysis.resistance)) + '</b></div>' +
      '<div class="stat"><span>' + esc(t('current')) + '</span><b>' + (analysis.current === null ? '\u2014' : digits(L.fmtCurrent(analysis.current))) + '</b></div>' +
      '<div class="stat"><span>' + esc(t('flowing')) + '</span><b>' + esc(status) + '</b></div>' +
      bulbLine +
      '</div>' +
      '<table class="read-table"><thead><tr><th>' + esc(t('part')) + '</th><th>' + esc(t('voltageDrop')) + '</th><th>' + esc(t('current')) + '</th><th>' + esc(t('power')) + '</th></tr></thead>' +
      '<tbody>' + rowsHtml + '</tbody></table>' +
      warnHtml;
  }

  // ---------- Ohm's calculator ----------
  function renderOhms() { /* static labels only; results live in #ohms-result */ }

  function solveOhmsUI() {
    var out = $('ohms-result');
    var known = {};
    ['v', 'i', 'r', 'p'].forEach(function (k) {
      var val = $(('ohms-' + k)).value.trim();
      if (val !== '') known[k] = val;
    });
    var res = L.solveOhms(known);
    if (res.error) {
      out.innerHTML = '<p class="warn">' + esc(t(res.error === 'need-two' ? 'needTwo' : 'notPositive')) + '</p>';
      return;
    }
    out.innerHTML = '<p class="ohms-answer">V = <b>' + num(res.v) + ' V</b> &nbsp;\u00b7&nbsp; I = <b>' + num(res.i, 3) + ' A</b> &nbsp;\u00b7&nbsp; R = <b>' + num(res.r) + ' \u03a9</b> &nbsp;\u00b7&nbsp; P = <b>' + num(res.p) + ' W</b></p>';
  }

  // ---------- presets ----------
  function renderPresets() {
    var box = $('preset-list');
    box.innerHTML = D.presets.map(function (p) {
      return '<button class="preset-btn" data-preset="' + p.id + '">' + esc(t('preset' + cap(p.id))) + '</button>';
    }).join('');
    box.querySelectorAll('[data-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () { loadPreset(btn.getAttribute('data-preset')); });
    });
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ---------- quiz ----------
  function renderQuiz() {
    var box = $('quiz-box');
    if (state.quizDone) {
      if (state.quizScore > state.quizBest) { state.quizBest = state.quizScore; save(); }
      box.innerHTML = '<p class="quiz-score">' + esc(t('score')) + ': <b>' + digits(state.quizScore) + ' / ' + digits(D.quiz.length) + '</b> &nbsp;\u00b7&nbsp; ' +
        esc(t('best')) + ': <b>' + digits(state.quizBest) + '</b></p>' +
        '<button class="btn" id="quiz-restart">' + esc(t('restartQuiz')) + '</button>';
      $('quiz-restart').addEventListener('click', function () {
        state.quizIdx = 0; state.quizScore = 0; state.quizAnswered = false; state.quizDone = false;
        renderQuiz();
      });
      return;
    }
    var q = D.quiz[state.quizIdx];
    var lang = state.lang;
    var opts = q.options.map(function (opt, i) {
      return '<button class="quiz-opt" data-opt="' + i + '">' + esc(opt) + '</button>';
    }).join('');
    box.innerHTML = '<p class="quiz-progress">' + esc(t('question')) + ' ' + digits(state.quizIdx + 1) + ' ' + esc(t('of')) + ' ' + digits(D.quiz.length) +
      ' &nbsp;\u00b7&nbsp; ' + esc(t('score')) + ': ' + digits(state.quizScore) + ' &nbsp;\u00b7&nbsp; ' + esc(t('best')) + ': ' + digits(state.quizBest) + '</p>' +
      '<p class="quiz-q">' + esc(q[lang].q) + '</p>' +
      '<div class="quiz-opts">' + opts + '</div>' +
      '<p class="quiz-feedback" id="quiz-feedback"></p>' +
      (state.quizAnswered ? '<button class="btn" id="quiz-next">' + esc(state.quizIdx === D.quiz.length - 1 ? 'showScore' : 'next') + '</button>' : '');
    box.querySelectorAll('[data-opt]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.quizAnswered) return;
        state.quizAnswered = true;
        var chosen = +btn.getAttribute('data-opt');
        var correct = chosen === q.answer;
        if (correct) state.quizScore += 1;
        box.querySelectorAll('[data-opt]').forEach(function (b) {
          var idx = +b.getAttribute('data-opt');
          if (idx === q.answer) b.classList.add('correct');
          else if (idx === chosen) b.classList.add('wrong');
          b.disabled = true;
        });
        $('quiz-feedback').textContent = (correct ? t('correct') + ' ' : t('wrong')) + q[lang].why;
        renderQuizNext();
      });
    });
    var nextBtn = $('quiz-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        if (state.quizIdx === D.quiz.length - 1) { state.quizDone = true; }
        else { state.quizIdx += 1; state.quizAnswered = false; }
        renderQuiz();
      });
    }
  }
  function renderQuizNext() {
    // Re-render to show the Next button after answering (keeps feedback + marks).
    var box = $('quiz-box');
    var q = D.quiz[state.quizIdx];
    var feedback = $('quiz-feedback');
    var feedbackText = feedback ? feedback.textContent : '';
    var btn = document.createElement('button');
    btn.className = 'btn';
    btn.id = 'quiz-next';
    btn.textContent = t(state.quizIdx === D.quiz.length - 1 ? 'showScore' : 'next');
    btn.addEventListener('click', function () {
      if (state.quizIdx === D.quiz.length - 1) { state.quizDone = true; }
      else { state.quizIdx += 1; state.quizAnswered = false; }
      renderQuiz();
    });
    box.appendChild(btn);
    var fb = $('quiz-feedback');
    if (fb && feedbackText) fb.textContent = feedbackText;
    void q;
  }

  // ---------- i18n / static labels ----------
  var LABEL_IDS = ['builder', 'builderHint', 'schematic', 'schematicHint', 'readings',
    'ohms', 'ohmsHint', 'presets', 'quiz', 'quizHint', 'disclaimer', 'resetCircuit',
    'solve', 'clear', 'addBattery', 'addResistor', 'addBulb', 'addSwitch', 'addParallel'];
  function renderLabels() {
    document.documentElement.lang = state.lang;
    $('app-title').textContent = t('title');
    $('app-subtitle').textContent = t('subtitle');
    $('lang-toggle').textContent = state.lang === 'en' ? '\u09ac\u09be\u0982\u09b2\u09be' : 'English';
    LABEL_IDS.forEach(function (key) {
      var el = $(key);
      if (el) el.textContent = t(key);
    });
    $('ohms-v-label').textContent = t('voltage') + ' (V)';
    $('ohms-i-label').textContent = t('current') + ' (A)';
    $('ohms-r-label').textContent = t('resistance') + ' (\u03a9)';
    $('ohms-p-label').textContent = t('power') + ' (W)';
    $('saved-label').textContent = t('saved');
  }

  function renderAll() {
    renderLabels();
    renderBuilder();
    var analysis = L.analyse(state.components);
    renderSchematic(analysis);
    renderReadings(analysis);
    renderPresets();
    renderQuiz();
  }

  function init() {
    if (!load()) defaultCircuit();
    $('lang-toggle').addEventListener('click', function () {
      state.lang = state.lang === 'en' ? 'bn' : 'en';
      save();
      renderAll();
    });
    $('add-battery').addEventListener('click', function () { addComponent('battery'); });
    $('add-resistor').addEventListener('click', function () { addComponent('resistor'); });
    $('add-bulb').addEventListener('click', function () { addComponent('bulb'); });
    $('add-switch').addEventListener('click', function () { addComponent('switch'); });
    $('add-parallel').addEventListener('click', function () { addComponent('parallel'); });
    $('reset-circuit').addEventListener('click', function () { loadPreset('simple'); });
    $('ohms-solve').addEventListener('click', solveOhmsUI);
    $('ohms-clear').addEventListener('click', function () {
      ['v', 'i', 'r', 'p'].forEach(function (k) { $('ohms-' + k).value = ''; });
      $('ohms-result').innerHTML = '';
    });
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
