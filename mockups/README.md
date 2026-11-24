# Larkspur Clinical: eight visual directions

Eight static mockups of the same chart Summary screen (same patient, same content) so the look can be compared like for like. Each is one self-contained HTML file (inline CSS, no scripts, Google Fonts via `<link>`) rendered at 1440 × 900, 2× pixel density. All artwork, palettes and names are original; only general layout conventions (system bar, workspace tabs, left patient sidebar, chart tabs across the top) are shared.

Overview of all eight: `00-contact-sheet.png`

## 01 · Ward Standard

Classic clinical workstation: light neutral chrome, compact rows, and colour reserved almost entirely for status.

- **Files:** `01-ward-standard.png`, `01-ward-standard.html`
- **Typefaces:** Source Sans 3 (400/600/700), tabular figures
- **Palette:** Chrome grey #D5D9DE · canvas #E4E7EA · surface #FFFFFF · ink #1A1F24 · accent petrol #0D5C63 · critical #B3261E · warning #8A5A00 · ok #1E6B3A · low #2D50A8
- **Summary layout:** vitals, work due and care team on top; results and medication grid below. Panels keep their natural compact height, and the dashed area marks the screen space left over at this density

## 02 · Casebook

Warm paper and ink: off-white stock, serif headings and ruled sections, so a long shift reads like a well-kept case file.

- **Files:** `02-casebook.png`, `02-casebook.html`
- **Typefaces:** Newsreader (headings, patient name) with Public Sans (data and labels)
- **Palette:** Paper #EFE9DC · page #FAF6EC · ink #2A2520 · rule #CFC5B0 · accent ink-blue #2B3F6C · critical #A4281F · warning #86560A · ok #2F6B3D · low violet #5B3A8C
- **Summary layout:** work due, vitals and results on top; care team and a wide medication grid below

## 03 · Night Watch

High-contrast dark for night shifts and the ICU: near-black surfaces, large legible numerals and solid status blocks that read across the room.

- **Files:** `03-night-watch.png`, `03-night-watch.html`
- **Typefaces:** Atkinson Hyperlegible (400/700)
- **Palette:** Canvas #07090B · surface #11151A · line #2C353F · ink #F3F6F8 · accent periwinkle #A9B8FF · critical #FF7A70 · warning #FFC145 · ok #6FDC8C · low #7FD0FF
- **Summary layout:** vitals strip across the top; work due, results and care team in the middle; full-width medication grid below

## 04 · Bedside Soft

Soft, modern, consumer-grade: roomy cards, rounded shapes and friendly type that feel approachable to new staff and students.

- **Files:** `04-bedside-soft.png`, `04-bedside-soft.html`
- **Typefaces:** Plus Jakarta Sans (400/500/600/700)
- **Palette:** Canvas lavender-grey #F2F3FB · cards #FFFFFF · ink #1F2340 · accent indigo #4F55D6 · critical #C8324A · warning #9A5B00 · ok #1D7A54 · low #2B6CB8
- **Summary layout:** vitals, work due and care team on top; results and medication grid below

## 05 · Spectrum

Colour-coded by activity: every chart tab owns a hue that follows its data into the Summary panels, so you always know where a number lives.

- **Files:** `05-spectrum.png`, `05-spectrum.html`
- **Typefaces:** Figtree (400/500/600/700)
- **Palette:** Chrome charcoal #20242B · canvas #F3F4F6 · activity hues: Summary slate #4A5568, Chart review violet #6D4FC9, Results teal #0A7C93, Flowsheets magenta #B3347F, Medications blue #2460C4, Orders olive #66740F, Notes umber #8A5A3C, History sage #3D7A6A, Discharge rose #C0496B, Coding steel #5D6B8A · critical #C02A1F · warning #8F5A00 · ok #1B7340
- **Summary layout:** results and medication grid on top; work due, vitals and care team below

## 06 · Teletype

Dense, data-first monospace: everything on a strict character grid with inverse-video headers and letter codes, built for keyboard-driven speed.

- **Files:** `06-teletype.png`, `06-teletype.html`
- **Typefaces:** JetBrains Mono (400/500/700)
- **Palette:** Paper grey-green #E9EBE4 · surface #F6F7F1 · ink #151814 (also the inverse-video accent) · critical #B00020 · warning #8A4B00 · ok #1B6B2F · low #1D4FA3
- **Summary layout:** vitals, work due and care team on top; results and medication grid below. Panels keep their natural compact height, and the dashed area marks the screen space left over at this density

## 07 · Flagship

Bold institutional: a strong mulberry brand bar, heavy uppercase headings and square edges that say "this is the hospital's system".

- **Files:** `07-flagship.png`, `07-flagship.html`
- **Typefaces:** Archivo (400/600/700/800) with Archivo Narrow (labels)
- **Palette:** Brand mulberry #5B1647 · deep brand #3A0D2D · canvas #F1EFF0 · surface #FFFFFF · ink #17121A · critical #C9301C · warning #8F5A00 · ok #17703E · low #1F58B5
- **Summary layout:** vitals tiles, results and work due on top; care team and a wide medication grid below

## 08 · Hairline

Quiet monochrome: white space, hairline rules and one cobalt accent, so the only colour on screen is selection and clinical status.

- **Files:** `08-hairline.png`, `08-hairline.html`
- **Typefaces:** Inter (400/500/600), tabular figures
- **Palette:** White #FFFFFF · ink #111111 · greys #555555 / #707070 · hairline #D9D9D9 · single accent cobalt #1D3FD0 · status marks only: critical #C22121, warning #A15C00, ok #1A7340, low #6B3FA0
- **Summary layout:** vitals, work due and care team on top; results and medication grid below

## Status colours

Every direction keeps three separable status roles plus a low-value flag: critical (allergy, high results, critical result chip), warning (doses due), ok (doses given, infusion running), low (results below range). Each status also has a non-colour cue (H / L letters, tick / exclamation / ring / pause glyphs, or G / D / S / H codes in Teletype).

## Rebuilding

```
node build.js    # regenerates the eight HTML files from base.css + themes.js
node render.js   # screenshots them, checks for clipped or overflowing elements, rebuilds the contact sheet
```

`build.js` holds the shared content, `base.css` the shared structure, `themes.js` the tokens and overrides for each direction.
