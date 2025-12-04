/**
 * Tolerance mode: symmetric (±0.5) or asymmetric (+0.5/-0.3)
 */
export type ToleranceMode = 'symmetric' | 'asymmetric';

/**
 * Calculation mode: RSS (statistical), Worst-Case (arithmetic), or Monte Carlo (probabilistic)
 */
export type CalculationMode = 'rss' | 'worstCase' | 'monteCarlo';

/**
 * Distribution type for Monte Carlo simulation
 */
export type DistributionType = 'normal' | 'uniform' | 'triangular';

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
  nominal: number; // Nominal dimension value (default: 0)
  // For symmetric: tolerancePlus = toleranceMinus
  // For asymmetric: different values
  tolerancePlus: number;
  toleranceMinus: number;
  floatFactor: number; // Multiplier for tolerance (1.0 = fixed, √2 ≈ 1.414, √3 ≈ 1.732)
  isFloat?: boolean; // DEPRECATED: Backward compatibility, use floatFactor instead
  notes?: string; // Optional notes or description for this item
  source?: string; // Optional source reference (drawing number, spec, part number)
  distributionType?: DistributionType; // Distribution for Monte Carlo (used in advanced mode)
}

/**
 * Position for diagram nodes
 */
export interface DiagramPosition {
  x: number;
  y: number;
}

/**
 * Node in diagram representing a tolerance item
 */
export interface DiagramNode {
  id: string;              // Matches ToleranceItem.id (1:1 relationship)
  position: DiagramPosition;
  width?: number;          // Optional size overrides
  height?: number;
}

/**
 * Connector between two nodes in diagram
 */
export interface DiagramConnector {
  id: string;                    // Unique connector ID
  sourceNodeId: string;          // Source node ID
  targetNodeId: string;          // Target node ID
  sourceHandleId?: string;       // Source handle ID (top/bottom/left/right)
  targetHandleId?: string;       // Target handle ID (top/bottom/left/right)
  label?: string;                // User-defined label (generic meaning)
  animated?: boolean;            // Animated flow effect
  style?: {
    strokeColor?: string;
    strokeWidth?: number;
  };
}

/**
 * Data for Result Node in diagram
 */
export interface ResultNodeData {
  targetNominal?: number;       // User-defined target dimension (defaults to 0)
  calculatedNominal: number;    // Sum of all item nominals
  rssTotal: number;             // Total RSS tolerance (plus direction)
  unit: ToleranceUnit;          // Display unit
  directionId: string;          // Parent direction ID
  directionName: string;        // Parent direction name
}

/**
 * Complete diagram data for a direction
 */
export interface DiagramData {
  nodes: DiagramNode[];          // Node positions (tolerance items only)
  connectors: DiagramConnector[];// Connections
  resultNodePosition?: DiagramPosition;  // Result node position (optional, stored separately)
  viewport?: {                   // Saved zoom/pan state
    x: number;
    y: number;
    zoom: number;
  };
}

/**
 * A single direction/tolerance stack
 */
export interface Direction {
  id: string;
  name: string;
  description?: string; // Optional description of what this direction represents
  items: ToleranceItem[];
  usl?: number; // Upper Specification Limit (any value allowed)
  lsl?: number; // Lower Specification Limit (any value allowed)
  targetNominal?: number; // User-defined target dimension for the stack
  targetBudget?: number; // DEPRECATED: Backward compatibility only, use usl/lsl instead
  diagram?: DiagramData; // Optional diagram visualization data
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
 * Monte Carlo simulation settings
 */
export interface MonteCarloSettings {
  iterations: number; // Number of simulation runs (default: 50000)
  useAdvancedDistributions: boolean; // Allow per-item distribution selection
  seed?: number; // Optional random seed for reproducibility
}

/**
 * Histogram bin for visualization
 */
export interface HistogramBin {
  binStart: number;
  binEnd: number;
  binCenter: number;
  count: number;
  frequency: number; // Normalized (0-1)
}

/**
 * Percentile statistics
 */
export interface PercentileData {
  p5: number;
  p50: number; // median
  p95: number;
  p99: number;
  mean: number;
  stdDev: number;
}

/**
 * Monte Carlo simulation result
 */
export interface MonteCarloResult {
  directionId: string;
  directionName: string;
  iterations: number;
  samples: number[]; // Array of RSS results from each iteration
  percentiles: PercentileData;
  histogram: HistogramBin[]; // Final stack distribution (50 bins)
  itemHistograms: Map<string, HistogramBin[]>; // Individual item distributions (30 bins each)
  itemContributions: {
    itemId: string;
    itemName: string;
    mean: number;
    stdDev: number;
    percentContribution: number;
  }[];
  riskAnalysis?: {
    usl?: number; // Upper Specification Limit
    lsl?: number; // Lower Specification Limit
    probabilityExceedingUSL: number; // 0-1 probability of exceeding USL
    probabilityExceedingLSL: number; // 0-1 probability of exceeding LSL
    probabilityOutOfSpec: number; // 0-1 total probability of being out of spec (either side)
    expectedDefectRate: number; // Parts per million (PPM)
  };
}

/**
 * Analysis settings for calculations
 */
export interface AnalysisSettings {
  calculationMode: CalculationMode; // RSS, Worst-Case, or Monte Carlo
  showMultiUnit: boolean; // Display results in multiple units
  secondaryUnit?: ToleranceUnit; // Secondary unit for multi-unit display
  contributionThreshold: number; // Alert threshold for high-impact items (default: 40%)
  sensitivityIncrement: number; // Increment for sensitivity analysis slider (default: 0.1)
  enableMonteCarlo: boolean; // Enable Monte Carlo simulation mode (advanced feature, default: false)
  monteCarloSettings?: MonteCarloSettings; // Monte Carlo simulation configuration
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
  // Monte Carlo simulation result (present when calculationMode = 'monteCarlo')
  monteCarloResult?: MonteCarloResult;
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
