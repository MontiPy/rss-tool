/**
 * Tolerance mode: symmetric (±0.5) or asymmetric (+0.5/-0.3)
 */
export type ToleranceMode = 'symmetric' | 'asymmetric';

/**
 * Calculation mode: RSS (statistical) or Worst-Case (arithmetic)
 */
export type CalculationMode = 'rss' | 'worstCase';

/**
 * Statistical confidence level (sigma)
 */
export type SigmaLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Supported units for tolerance values
 */
export type ToleranceUnit = 'mm' | 'inches' | 'μm' | 'mils';

/**
 * Single tolerance item in a stack
 */
export interface ToleranceItem {
  id: string;
  name: string;
  // For symmetric: tolerancePlus = toleranceMinus
  // For asymmetric: different values
  tolerancePlus: number;
  toleranceMinus: number;
  floatFactor: number; // Multiplier for tolerance (1.0 = fixed, √2 ≈ 1.414, √3 ≈ 1.732)
  isFloat?: boolean; // DEPRECATED: Backward compatibility, use floatFactor instead
  notes?: string; // Optional notes or description for this item
  source?: string; // Optional source reference (drawing number, spec, part number)
}

/**
 * A single direction/tolerance stack
 */
export interface Direction {
  id: string;
  name: string;
  description?: string; // Optional description of what this direction represents
  items: ToleranceItem[];
  targetBudget?: number; // Optional target tolerance budget for comparison
}

/**
 * Project metadata for documentation and traceability
 */
export interface ProjectMetadata {
  projectName?: string; // Name of the tolerance analysis project
  description?: string; // Project description or purpose
  author?: string; // Person who created the analysis
  createdDate?: string; // ISO date string when project was created
  modifiedDate?: string; // ISO date string of last modification
  drawingNumber?: string; // Related drawing or document number
  revision?: string; // Revision or version of the analysis
}

/**
 * Analysis settings for calculations
 */
export interface AnalysisSettings {
  calculationMode: CalculationMode; // RSS or Worst-Case
  showMultiUnit: boolean; // Display results in multiple units
  secondaryUnit?: ToleranceUnit; // Secondary unit for multi-unit display
  contributionThreshold: number; // Alert threshold for high-impact items (default: 40%)
  sensitivityIncrement: number; // Increment for sensitivity analysis slider (default: 0.1)
}

/**
 * Complete project data structure
 */
export interface ProjectData {
  toleranceMode: ToleranceMode;
  unit?: ToleranceUnit; // Unit of measurement (default: mm)
  directions: Direction[];
  metadata?: ProjectMetadata; // Optional project metadata for documentation
  analysisSettings?: AnalysisSettings; // Optional analysis configuration settings
}

/**
 * RSS calculation result for a direction
 */
export interface RSSResult {
  directionId: string;
  directionName: string;
  totalPlus: number;
  totalMinus: number;
  worstCasePlus?: number; // Arithmetic sum for worst-case analysis
  worstCaseMinus?: number; // Arithmetic sum for worst-case analysis
  itemContributions: {
    itemId: string;
    itemName: string;
    contributionPlus: number;
    contributionMinus: number;
  }[];
  // Statistical analysis (optional, only shown if targetBudget exists)
  statistical?: {
    current3Sigma: number; // Current 3σ RSS result
    currentCpk: number; // Current process capability
    currentYield: number; // Estimated yield percentage
    required3SigmaFor1_33Cpk: number; // 3σ needed for Cpk = 1.33
    required3SigmaFor1_66Cpk: number; // 3σ needed for Cpk = 1.66
  };
}

/**
 * Template for reusable tolerance stacks
 */
export interface StackTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string; // e.g., "Sheet Metal", "Injection Molding", "Machining"
  items: Omit<ToleranceItem, 'id'>[]; // Items without IDs (IDs generated on import)
  createdDate: string;
}

/**
 * Project snapshot for version comparison
 */
export interface ProjectSnapshot {
  id: string;
  timestamp: string;
  label: string; // e.g., "Rev A", "Initial Design", "After Review"
  projectData: ProjectData;
}
