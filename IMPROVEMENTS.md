# Improvements Exploration

This document records improvement ideas discovered during code review.
No changes are implemented yet.

## High-impact correctness
- Monte Carlo simulation ignores asymmetric minus tolerances because it always
  samples with tolerancePlus; consider sampling based on the sign or using a
  distribution that accounts for tolerancePlus and toleranceMinus separately.
- CSV export relies on deprecated isFloat and does not use floatFactor, which
  can misreport float settings and contribution values in exported files.
- JSON import drops valid 0 values for USL/LSL due to truthy checks; consider
  preserving 0 by using nullish checks instead of ||.
- RSS distribution visualization does not guard against rssTotal = 0, which
  yields stdDev = 0 and can produce divide-by-zero in PDF/CDF calculations.
- Monte Carlo histogram binning does not guard against max == min, which yields
  binWidth = 0 and invalid bin indexing.

## Reliability and UX
- Monte Carlo computation uses setTimeout without cleanup; rapid edits can race
  and set state after a newer run or after unmount. Consider cancellation or
  effect cleanup with a run token.
- Contribution bars divide by maxPercent even when all contributions are zero,
  which can yield NaN and invalid progress values; consider safe fallbacks.
- Statistical analysis only runs when USL > 0 and ignores LSL; consider using
  both USL/LSL (or min distance to spec) and supporting negative limits.
- Float factor UI only toggles between 1.0 and sqrt(3); any custom floatFactor
  is not visible/editable. Consider displaying and editing numeric values.
- Image uploads store base64 directly in project data; consider file size/type
  validation or optional external storage to prevent large JSON payloads.

## Maintainability and performance
- ResultsDisplay performs non-trivial calculations in render (ticks, domains,
  contributions). Consider memoizing derived values or extracting helpers to
  avoid recalculations on every render.
- CSV parsing is a custom implementation that does not handle all edge cases
  (embedded newlines, separator variants). Consider a well-tested CSV parser.
