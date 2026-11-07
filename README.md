# Circuit Lab BD

Offline bilingual (English / বাংলা) DC circuit lab for students in Bangladesh.
Build a series loop from real parts, watch conventional current flow around an
animated schematic, read live voltage / current / power for every part, solve
Ohm's law for any two values, and test yourself with an 8-question quiz.

Live demo: https://fahad3235.github.io/circuit-lab-bd/

## Features

- **Circuit builder** — add a battery (0.5–48 V), resistors (0.1 Ω–10 kΩ, with
  power ratings), a bulb, a switch, and two-resistor parallel blocks to one
  closed loop (max 8 parts, max 2 batteries). Edit values inline with range
  validation; remove parts with one tap.
- **Animated schematic** — SVG loop with component glyphs placed around the
  perimeter; current dots flow clockwise and speed up with current; the bulb
  glows in proportion to its power; an open switch visibly breaks the loop.
- **Live readings** — total voltage, total resistance, current (A / mA / µA),
  and a per-part table of voltage drop, current, and power, including branch
  currents for parallel blocks. Warnings for short circuits, open switches,
  missing batteries, and overloaded parts.
- **Ohm's law calculator** — enter any two of V, I, R, P and the other two are
  solved (all six pairings, exact algebra, no approximations).
- **6 sample circuits** — simple loop, two in series, parallel pair,
  series + parallel combo, open-switch demo, and a short-circuit demo.
- **8-question quiz** — hand-checked Ohm's law questions with explanations;
  best score is saved on the device.
- **Bilingual** — full English / বাংলা UI toggle, persisted, with Bengali
  digits. Circuit and language persist in localStorage. 100% offline, zero
  network requests, responsive down to 390 px.

## Stack

- Vanilla HTML + CSS + JavaScript, no dependencies, no build step.
- `js/logic.js` — pure circuit math (series / parallel resistance, current,
  voltage drops, power, overload + short-circuit detection, Ohm's solver).
- `js/data.js` — i18n strings, 6 presets, 8 quiz questions.
- `js/app.js` — DOM rendering, SVG schematic, state + localStorage.

## Run locally

Open `index.html` in any modern browser, or serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Tests

```sh
node tests/logic.test.js   # 24 unit tests (circuit math, solver, validation)
node smoke/smoke.mjs       # 37 headless-Chrome checks (raw CDP, file://)
```

Both suites are green: 24/24 unit, 37/37 smoke, 0 console errors, 0 page
exceptions (verified 2026-11-07).

## Source encoding note

All shipped source files are pure ASCII: Bengali text in `js/data.js` and
`js/app.js` is stored as `\uXXXX` escapes and rendered by the browser, so
file pushes can never corrupt it (see run #25, bangla-calendar-bd, 2026-10-11).

## Limitations

- Series-loop model only: one loop, components in the order added. There is
  no general nodal analysis and no multi-loop / mesh support.
- Idealised parts: wires have zero resistance, batteries have no internal
  resistance, and bulb resistance is treated as fixed (real bulbs vary with
  temperature).
- The short-circuit demo reports the condition and shows no current value
  rather than an infinite one — by design, since a real short would damage
  parts.
- Educational simulation of low-voltage DC circuits only. It is not a design
  tool for mains electricity — never build mains circuits without a qualified
  electrician.

## Status

Factory run #260 (2026-11-07, 10:00 slot). Complete and verified locally.
