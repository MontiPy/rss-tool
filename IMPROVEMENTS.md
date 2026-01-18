# Improvements Exploration

This document records improvement ideas and their status.

## Implemented
- Monte Carlo sampling now respects asymmetric tolerances and avoids zero-width
  histogram bins for degenerate distributions.
- CSV export now uses floatFactor, and CSV import now uses a tested parser.
- JSON import preserves 0 for USL/LSL, and RSS distribution guards stdDev = 0.
- Contribution bars handle zero totals; statistical analysis considers USL/LSL.
- Float factor is editable as a numeric value; image uploads validate size/type.
- ResultsDisplay now memoizes expensive derived calculations.
