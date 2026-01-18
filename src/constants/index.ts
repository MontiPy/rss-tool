/**
 * Centralized constants for the RSS Tolerance Calculator
 * 
 * All magic numbers and configuration values should be defined here
 * to ensure consistency and make maintenance easier.
 */

// ============================================================================
// Float Factors
// ============================================================================

export const FLOAT_FACTORS = {
  /** Fixed dimension - no float adjustment */
  FIXED: 1.0,
  /** Square root of 2 - for certain geometric relationships */
  SQRT2: Math.sqrt(2), // ≈ 1.414
  /** Square root of 3 - standard float factor for uniform distributions */
  SQRT3: Math.sqrt(3), // ≈ 1.732
} as const;

// ============================================================================
// Unit Conversion
// ============================================================================

/** Conversion factors to millimeters (base unit) */
export const UNIT_TO_MM: Record<string, number> = {
  mm: 1,
  inches: 25.4,
  μm: 0.001,
  mils: 0.0254,
} as const;

// ============================================================================
// Chart Configuration
// ============================================================================

export const CHART_CONFIG = {
  /** Number of bins for final stack histogram */
  HISTOGRAM_BINS: 50,
  /** Number of bins for individual item histograms */
  ITEM_HISTOGRAM_BINS: 30,
  /** Number of points for distribution curves */
  DISTRIBUTION_POINTS: 500,
  /** Number of standard deviations to display */
  SIGMA_DISPLAY_RANGE: 4,
  /** Number of standard deviations for results (99.7% confidence) */
  RESULT_SIGMA: 3,
} as const;

// ============================================================================
// Validation
// ============================================================================

export const VALIDATION = {
  /** Minimum tolerance value (cannot be negative) */
  MIN_TOLERANCE: 0,
  /** Maximum Monte Carlo iterations */
  MAX_ITERATIONS: 1_000_000,
  /** Minimum Monte Carlo iterations */
  MIN_ITERATIONS: 1_000,
  /** Default Monte Carlo iterations */
  DEFAULT_ITERATIONS: 50_000,
  /** Default contribution threshold for warnings (%) */
  DEFAULT_CONTRIBUTION_THRESHOLD: 40,
  /** Default sensitivity analysis increment */
  DEFAULT_SENSITIVITY_INCREMENT: 0.1,
} as const;

// ============================================================================
// Specification Limits
// ============================================================================

export const SPEC_STATUS = {
  /** Threshold for warning status (%) */
  WARNING_THRESHOLD: 90,
  /** Threshold for fail status (%) */
  FAIL_THRESHOLD: 100,
} as const;

export type SpecStatusType = 'pass' | 'warning' | 'fail';

/**
 * Determine specification status based on utilization percentage
 */
export function getSpecStatus(utilization: number): SpecStatusType {
  if (utilization > SPEC_STATUS.FAIL_THRESHOLD) return 'fail';
  if (utilization > SPEC_STATUS.WARNING_THRESHOLD) return 'warning';
  return 'pass';
}

// ============================================================================
// UI Configuration
// ============================================================================

export const UI_CONFIG = {
  /** Decimal places for display */
  DISPLAY_DECIMALS: 4,
  /** Decimal places for compact display */
  COMPACT_DECIMALS: 3,
  /** Auto-save delay in milliseconds */
  AUTO_SAVE_DELAY: 5000,
  /** Recovery window in milliseconds (24 hours) */
  RECOVERY_WINDOW: 24 * 60 * 60 * 1000,
  /** Maximum undo history size */
  MAX_UNDO_HISTORY: 50,
} as const;

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

export const KEYBOARD_SHORTCUTS = {
  SAVE: 'ctrl+s',
  OPEN: 'ctrl+o',
  NEW_ITEM: 'ctrl+n',
  DUPLICATE: 'ctrl+d',
  DELETE: 'delete',
  UNDO: 'ctrl+z',
  REDO: 'ctrl+shift+z',
  HELP: 'f1',
  ESCAPE: 'escape',
} as const;

// ============================================================================
// Colors
// ============================================================================

export const COLORS = {
  // Status colors
  SUCCESS: '#4caf50',
  WARNING: '#ff9800',
  ERROR: '#f44336',
  INFO: '#2196f3',
  
  // Chart colors
  CHART_PRIMARY: '#1976d2',
  CHART_SECONDARY: '#888888',
  CHART_USL_LSL: '#d62728',
  CHART_MEAN: '#2ca02c',
  CHART_ACCEPTANCE: '#4caf50',
  
  // Node colors
  NODE_FIXED: '#1976d2',
  NODE_FLOATING: '#ff9800',
  NODE_RESULT: '#4caf50',
} as const;

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULTS = {
  /** Default unit */
  UNIT: 'mm' as const,
  /** Default tolerance mode */
  TOLERANCE_MODE: 'symmetric' as const,
  /** Default calculation mode */
  CALCULATION_MODE: 'rss' as const,
  /** Default tolerance plus value for new items */
  TOLERANCE_PLUS: 0.5,
  /** Default tolerance minus value for new items */
  TOLERANCE_MINUS: 0.5,
  /** Default nominal value for new items */
  NOMINAL: 0,
  /** Default float factor */
  FLOAT_FACTOR: FLOAT_FACTORS.FIXED,
} as const;

// ============================================================================
// Local Storage Keys
// ============================================================================

export const STORAGE_KEYS = {
  AUTO_SAVE: 'rss-calculator-autosave',
  THEME_PREFERENCE: 'rss-calculator-theme',
  RECENT_FILES: 'rss-calculator-recent',
} as const;
