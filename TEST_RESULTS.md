# Circuit Lab BD — Test Results (run #260, 2026-11-07, 10:00 slot)

## Unit tests — 24/24 PASS

Command: `node tests/logic.test.js`

- Data integrity: 6 presets (unique ids), 8 quiz questions (4 options, answer
  in range, EN + BN text), i18n key parity EN/BN (>40 keys), all presets valid
  (switch preset intentionally reports `open-switch`).
- Simple loop 9 V + 100 Ω + 30 Ω bulb: R = 130 Ω, I = 9/130 A, voltage drops
  sum to 9 V, power sums to V×I, bulb brightness = P/rating.
- Series preset 12 V / 320 Ω = 0.0375 A, drops 3.75 V + 8.25 V.
- Parallel preset: R_eq = 50 Ω, I = 0.18 A, branches 0.09 A each, 1.62 W total.
- Combo preset: 100 + 110 + 30 = 240 Ω, I = 0.05 A, block drop 5.5 V.
- Open-switch preset: current 0, `open-switch` error, bulb dark.
- Short preset (battery + closed switch): `shortCircuit`, current null.
- No battery / empty circuit: errors reported, current 0.
- Overload: 9 V across 10 Ω 0.25 W resistor → 8.1 W, overload warning.
- Two batteries add voltages (18 V, 0.18 A).
- Parallel resistance math: 100‖100 = 50, 220‖220 = 110, 100‖200 = 66.67.
- Ohm's solver: all six pairings verified (V+I, V+R, V+P, I+R, I+P, R+P);
  rejects one value, three values, zero/negative/non-numeric input.
- parseNum: accepts in-range, rejects empty / NaN / out-of-range.
- Formatters: 0 A, 500.0 µA, 69.2 mA, 2.50 A; 130.0 Ω, 2.20 kΩ.

Two test-side fixes during the run (both in the test file, 0 app bugs):
- Voltage-drop sum now excludes the battery row (its voltage is the source).
- V+P case corrected to V=9, P=18 → I=2, R=4.5 (was miscomputed as I=2, R=18).

## Headless-Chrome smoke tests — 37/37 PASS

Command: `node smoke/smoke.mjs` (raw CDP, headless_shell-1187, file://)

- Default render: title, 3 part rows, schematic wire + glyphs, 6 animated
  current dots, total R 130.0 Ω, current 69.2 mA, 6 presets, 4 quiz options,
  footer mains disclaimer.
- Builder: add resistor → 4 rows, current 39.1 mA (230 Ω); remove → 3 rows,
  back to 69.2 mA.
- Parallel preset: 50.0 Ω, 180.0 mA, 2 branch rows.
- Open-switch preset: 0 A, 0 dots, warning shown.
- Short preset: "Short circuit!" warning shown.
- Ohm's calculator: V=12, I=3 → R 4.00, P 36.00; one value → "exactly two" error.
- Quiz: Q1 correct (3 A) → "Correct!", option marked, score 1, advances to
  Q2; wrong answer on Q2 → "Not quite".
- Language: toggle → Bengali title, html lang=bn, current in Bengali digits
  (৬৯.২ mA); persists across reload with circuit intact; toggles back.
- Mobile: no horizontal overflow at 390 px.
- Zero console errors, zero page exceptions.

Re-run after the ASCII-escaping step (Bengali → \uXXXX in js/*.js):
24/24 unit, 37/37 smoke, still 0 console errors.
