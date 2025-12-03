# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev      # Start development server at http://localhost:5173
npm run build    # TypeScript check + production build (outputs to dist/)
npm run preview  # Preview production build locally
```

**Note:** Requires Node.js 18+. If using Node 18, Vite 5.x is compatible. Newer Vite versions may require Node 20+.

## Architecture Overview

This is a React + TypeScript web application for calculating Root Sum Square (RSS) tolerance stacks with Material-UI components.

### State Management Pattern

**Centralized state in `App.tsx`** - No external state library (Redux, Zustand). Simple React hooks with callback pattern:

```
App.tsx (root state: ProjectData)
  ├── FileControls (save/load JSON files)
  ├── Tabs navigation (activeTab state)
  └── DirectionTab[] (one per direction)
      └── Grid Layout (side-by-side)
          ├── ToleranceTable (editable items, left 65%)
          └── ResultsDisplay (read-only RSS results, right 35%)
```

**Data Flow:**
1. User edits tolerance in `ToleranceTable`
2. Callback chain: `handleItemChange` → `onItemsChange` → `handleDirectionChange` → `setProjectData`
3. State update propagates down to child components
4. `DirectionTab` useEffect detects change → triggers `calculateRSS()`
5. `ResultsDisplay` shows updated RSS result in real-time (side-by-side layout)

### UI Layout Pattern

**Side-by-Side Design:** `DirectionTab` uses MUI Grid to display input table and results horizontally:
- Input table on left (7/12 width on medium+ screens, full width on mobile)
- Results display on right (5/12 width on medium+ screens, full width on mobile)
- Eliminates vertical scrolling between input and results
- Real-time feedback: see RSS calculations while editing tolerances

### Key Type Hierarchy

```typescript
ProjectData {
  toleranceMode: 'symmetric' | 'asymmetric'  // Global setting
  unit?: ToleranceUnit                       // 'mm' | 'inches' | 'μm' | 'mils' (default: mm)
  directions: Direction[]                    // Array of stacks
  metadata?: ProjectMetadata                 // Optional project metadata
  analysisSettings?: AnalysisSettings        // Analysis configuration
}

ProjectMetadata {
  projectName?: string        // Shown in app bar title
  description?: string        // Project purpose/description
  author?: string            // Creator name
  createdDate?: string       // ISO date string (auto-set)
  modifiedDate?: string      // ISO date string (auto-updated)
  drawingNumber?: string     // Related drawing reference
  revision?: string          // Version/revision number
}

AnalysisSettings {
  calculationMode: 'rss' | 'worstCase' | 'monteCarlo'  // Calculation method
  showMultiUnit: boolean                 // Display results in multiple units
  secondaryUnit?: ToleranceUnit          // Unit for multi-unit display
  contributionThreshold: number          // Percentage threshold for high-impact warnings (default: 40)
  sensitivityIncrement: number           // Increment for sensitivity analysis slider (default: 0.1)
  enableMonteCarlo: boolean              // Enable Monte Carlo mode (advanced feature, default: false)
  monteCarloSettings?: MonteCarloSettings  // Monte Carlo configuration
}

Direction {
  id: string
  name: string               // "B-Direction", "H-Direction", etc.
  description?: string       // Optional description (e.g., "Envelope height from base to top")
  targetNominal?: number     // User-defined target dimension for the stack (any value allowed)
  usl?: number              // Upper Specification Limit (any value allowed)
  lsl?: number              // Lower Specification Limit (any value allowed)
  items: ToleranceItem[]     // Tolerance stack items
}

ToleranceItem {
  id: string
  name: string
  nominal: number            // Nominal dimension value (default: 0, any value allowed)
  tolerancePlus: number      // Always stored separately, validated >= 0
  toleranceMinus: number     // Even in symmetric mode, validated >= 0
  floatFactor: number        // Float multiplier: 1.0 (fixed) or √3 ≈ 1.732 (floating)
  notes?: string             // Optional notes or comments
  source?: string            // Optional source reference (drawing #, part #, spec)
}
```

**Important:**
- `nominal` field represents the nominal dimension value for each item (can be any number: negative, zero, or positive). Defaults to 0 for new items. Backward compatible: old JSON files without nominal default to 0 during import.
- `targetNominal` is a user-defined target dimension at the Direction level, representing the desired/design specification for the stack. Optional field.
- `tolerancePlus` and `toleranceMinus` are ALWAYS stored separately, even in symmetric mode. This allows mode switching without data loss. The `ToleranceTable` component enforces `tolerancePlus === toleranceMinus` in symmetric mode via UI logic.
- **Validation:** Tolerances are validated to be >= 0 across all input methods (manual entry, CSV import, JSON loading, sensitivity analysis). Nominal values have no validation constraints.
- `floatFactor` replaced the old boolean `isFloat` to support custom float values (backward compatibility maintained in JSON import)
- All metadata fields are optional for backward compatibility with older JSON files
- Unit selection affects display throughout the app (results, labels)

## RSS Calculation Logic

Located in `src/utils/rssCalculator.ts`:

```typescript
FLOAT_FACTORS = {
  FIXED: 1.0,
  SQRT3: Math.sqrt(3)  // ≈ 1.732050808
}

// Calculation modes
calculationMode: 'rss' | 'worstCase'

// RSS Mode (Statistical)
For each item:
  contribution = tolerance × item.floatFactor   // Applied BEFORE squaring
  sumOfSquares += contribution²
RSS = √(sumOfSquares)

// Worst-Case Mode (Arithmetic Sum)
For each item:
  contribution = tolerance × item.floatFactor
WC = Σ(contribution)  // Simple sum of all contributions
```

**Critical:**
- Float factor is multiplied into contribution BEFORE squaring (for RSS), not after calculation
- This follows standard statistical tolerance stack analysis for floating dimensions
- `floatFactor` is stored as a number (1.0 or √3), not a boolean, allowing future custom values
- Default new items use `floatFactor: 1.0` (fixed)

### Calculation Trigger

Calculations run automatically via `useEffect` in `DirectionTab.tsx`:

```typescript
useEffect(() => {
  if (direction.items.length > 0) {
    // Calculate based on mode
    const result = calculateTolerance(direction.items, direction.id, direction.name, calculationMode);

    // Add statistical analysis if USL exists (RSS mode only)
    if (calculationMode === 'rss' && direction.usl) {
      result.statistical = calculateStatisticalAnalysis(...);
    }

    setRssResult(result);
  }
}, [direction, calculationMode]);
```

**Key Points:**
- **RSS mode:** Runs RSS calculation (deterministic) + generates theoretical distribution on demand in ResultsDisplay
- **Monte Carlo mode:** Runs Monte Carlo simulation (probabilistic)
- **Worst-Case mode:** Runs worst-case arithmetic sum
- **Lazy Calculation:** Only the active tab's direction calculates. Inactive tabs don't recalculate until user switches to them (performance optimization).
- **Distribution visualization in RSS mode** is generated in the UI component using `generateRSSDistribution()` - not computed during calculation

## File I/O

**Format:** Plain JSON serialization of `ProjectData` (no compression, no versioning)

```typescript
// Export
exportToJSON(projectData, 'rss-calculation-YYYY-MM-DD.json')

// Import (with basic validation)
importFromJSON(file)  // Validates toleranceMode & directions exist
```

**Example file structure (with all Phase 2 features):**
```json
{
  "toleranceMode": "symmetric",
  "unit": "mm",
  "metadata": {
    "projectName": "Envelope Assembly Analysis",
    "description": "RSS tolerance analysis for envelope assembly",
    "author": "John Doe",
    "createdDate": "2025-01-15T10:30:00.000Z",
    "modifiedDate": "2025-01-15T14:45:00.000Z",
    "drawingNumber": "DWG-12345",
    "revision": "Rev A"
  },
  "analysisSettings": {
    "calculationMode": "rss",
    "showMultiUnit": true,
    "secondaryUnit": "inches",
    "contributionThreshold": 40,
    "sensitivityIncrement": 0.1
  },
  "directions": [
    {
      "id": "dir-1",
      "name": "B-Direction",
      "description": "Envelope width from left to right edge",
      "usl": 2.5,
      "lsl": -2.5,
      "items": [
        {
          "id": "item-1",
          "name": "Letter Profile",
          "tolerancePlus": 0.5,
          "toleranceMinus": 0.5,
          "floatFactor": 1.0,
          "source": "DWG-12345 Sheet 2",
          "notes": "Based on profile extrusion tolerance"
        },
        {
          "id": "item-2",
          "name": "Clearance Hole",
          "tolerancePlus": 0.3,
          "toleranceMinus": 0.3,
          "floatFactor": 1.732050808,
          "source": "DWG-12345 Sheet 3",
          "notes": "Floating feature, using √3 factor"
        }
      ]
    }
  ]
}
```

**Backward Compatibility:** The `importFromJSON` function automatically adds default values for missing metadata fields when loading older files, ensuring compatibility. Legacy `isFloat: boolean` fields are automatically migrated to `floatFactor: number`. Legacy `targetBudget` fields are automatically converted to symmetric `usl` and `lsl` values (usl = targetBudget, lsl = -targetBudget).

## Phase 2 Features

### Specification Limits & Status Indicators

**USL/LSL Setting:**
- Each Direction can have optional specification limits:
  - `usl` (Upper Specification Limit): any value allowed (positive or negative)
  - `lsl` (Lower Specification Limit): any value allowed (positive or negative)
- Set via two TextFields in DirectionTab (top-right of description area)
- Can be asymmetric (e.g., USL = 5.0, LSL = -3.0) or symmetric (e.g., USL = 2.5, LSL = -2.5)
- Both USL and LSL are stored as entered (no automatic sign conversion)
- Typically USL > LSL (e.g., USL = +10, LSL = -10)
- When set, ResultsDisplay shows color-coded status for each limit

**Specification Status Logic:**
```typescript
uslUtilization = (totalPlus / |usl|) × 100
lslUtilization = (totalMinus / |lsl|) × 100

Status Colors (checked independently for USL and LSL):
- Green (Pass):    < 90% of limit magnitude
- Yellow (Warning): 90-100% of limit magnitude
- Red (Fail):      > 100% of limit magnitude
```

**Visual Indicators:**
- Separate chips for USL and LSL showing percentage utilization with status color
- Warning icon for yellow/red status
- Text showing amount over limit when failing (for each limit independently)

### Calculation Mode Toggle

**Global Setting (App.tsx):**
- Radio buttons in control panel: "RSS (Statistical)" | "Worst-Case" | "Monte Carlo"
- Affects all directions simultaneously
- Stored in `analysisSettings.calculationMode`

**Results Display:**
- Shows current mode in results header
- **RSS mode:**
  - Displays RSS total (primary result - deterministic)
  - Shows worst-case comparison with savings calculation
  - **NEW:** Includes collapsible "Distribution Visualization" section
  - Shows theoretical normal distribution curve assuming RSS = ±3σ
  - Displays shaded acceptance region (green) between USL and LSL
  - Calculates theoretical probabilities of exceeding specification limits using normal CDF
  - Provides risk analysis with expected defect rate (PPM)
- Worst-case mode: shows only arithmetic sum result
- Monte Carlo mode: displays ±3σ with full probabilistic distribution analysis (always expanded)

### RSS Distribution Visualization (NEW)

**Purpose:** Theoretical visualization of RSS results as a normal distribution

**Key Features:**
- **Assumes RSS = ±3σ** (99.7% confidence interval)
- Generates smooth normal curve with mean μ = 0, standard deviation σ = RSS/3
- **Shaded regions:**
  - Green acceptance region between LSL and USL
  - Shows visually how much of the distribution falls within spec
- **Theoretical risk analysis:**
  - Probability of exceeding USL (using normal CDF)
  - Probability of exceeding LSL (using normal CDF)
  - Total probability out of spec
  - Expected defect rate in PPM
- **Collapsible section** - keeps UI clean, expand when needed

**Implementation:**
- Function: `generateRSSDistribution()` in `rssCalculator.ts`
- Uses `normalCDF()` for probability calculations
- Uses `normalPdf()` for curve generation
- Renders using Recharts `ComposedChart` with Area (shaded regions) + Line (curve)

### Monte Carlo Simulation

**Usage:** Advanced calculation method using probabilistic simulation (Monte Carlo mode only)

**Enabling Monte Carlo (Advanced Feature):**
- Monte Carlo is disabled by default
- Enable in Settings (⚙️) → Advanced Features → "Enable Monte Carlo Simulation"
- Once enabled, "Monte Carlo" option appears in Calculation Mode radio buttons
- Stored in `analysisSettings.enableMonteCarlo` (default: false)

**Configuration (ProjectMetadataEditor):**
- Iteration count: 10k / 50k (default) / 100k / Custom (1k-1M)
- Advanced mode toggle: Per-item distribution selection
- Stored in `analysisSettings.monteCarloSettings`

**Distribution Logic:**
- **Auto mode** (default): Normal distribution for fixed items (floatFactor=1.0), Uniform for floating items (floatFactor≈√3)
  - Float factor settings from RSS/Worst-Case modes are used to determine distribution type
  - Fixed (floatFactor=1.0) → Normal distribution
  - Floating (floatFactor≈√3) → Uniform distribution
- **Advanced mode**: User selects Normal/Uniform/Triangular per item via dropdown in ToleranceTable
  - When `useAdvancedDistributions` is enabled, Distribution column replaces Float column
  - Each item can have a different distribution type
  - Float checkbox is hidden in Monte Carlo mode (distribution selection replaces it)

**Visualization:**
- Final stack histogram (50 bins) - **bilateral distribution** centered at 0, showing actual distribution shape
- LSL (Lower Spec Limit) and USL (Upper Spec Limit) reference lines at specified limits (if set)
- Mean (μ) reference line with green dashed marker
- Percentile table (5th, 50th, 95th, 99th, mean, stdDev)
- Risk analysis: probability of exceeding USL and/or LSL independently, plus total out-of-spec probability
- Individual item histograms (30 bins each, bilateral, collapsible section) showing actual distribution shapes

**Calculation:**
- Runs N iterations (default: 50,000)
- Each iteration samples from item distributions, calculates **linear sum** (not RSS)
- Deviations add algebraically: total = Σ(sampled_deviation × float_factor)
- Results in **bilateral distribution** (can be positive or negative)
- Main result shows ±3σ range (99.7% confidence interval)
- Assumes tolerances represent ±3σ values (σ = tolerance/3 for normal)

**Key Implementation Files:**
- `src/utils/monteCarloCalculator.ts` - Core simulation engine
- `src/components/ResultsDisplay.tsx` - Histogram visualizations using Recharts ComposedChart (Bar component)
- `src/types/index.ts` - MonteCarloResult, HistogramBin, PercentileData types

**Histogram Display:**
- Renders actual distribution shape using Recharts `ComposedChart` with `Bar` component
- Styling: Semi-transparent gray bars (rgba(150,150,150,0.5))
- Reference lines: Red LSL/USL (#d62728, dashed 4 4), Green mean (#2ca02c, dashed 2 2)
- No curve overlay - shows true distribution from simulation data (may be normal, uniform, triangular, or multimodal)

### Multi-Unit Display

**Configuration (ProjectMetadataEditor):**
- Checkbox: "Show results in multiple units"
- Dropdown: Select secondary unit (mm, inches, μm, mils)
- Stored in `analysisSettings.showMultiUnit` and `analysisSettings.secondaryUnit`

**Display Format:**
```typescript
formatWithMultiUnit(value, primaryUnit, secondaryUnit)
// Example: "2.5000 mm (0.0984 inches)"
```

**Conversion Factors:**
```typescript
mm:     1.0        (base unit)
inches: 25.4       (1 inch = 25.4 mm)
μm:     0.001      (1000 μm = 1 mm)
mils:   0.0254     (1 mil = 0.001 inch = 0.0254 mm)
```

### CSV Import with Column Mapping

**Access:** "Import from CSV" button in each DirectionTab

**3-Step Process:**
1. **Upload CSV** - Drag & drop or file select
2. **Map Columns** - Match CSV columns to fields:
   - Item Name (required)
   - Nominal (optional, defaults to 0 if not mapped)
   - Tolerance (+) (required)
   - Tolerance (-) (optional, uses + if not mapped in symmetric mode)
   - Float Factor (optional, accepts: "Yes"/"No", "1"/"0", "true"/"false", "√3", numeric values)
   - Notes (optional)
   - Source (optional)
3. **Preview & Import** - Review parsed items before adding to stack

**Features:**
- Appends to existing items (doesn't replace)
- Auto-detects common CSV formats
- Validates all tolerances >= 0
- Supports both symmetric and asymmetric modes

### Sensitivity Analysis

**Access:** "Sensitivity Analysis" button in ResultsDisplay (shows when 2+ items)

**Purpose:** Interactive tool to see how tolerance adjustments affect total RSS

**Features:**
- Select any item from the list
- Shows original tolerance, adjusted tolerance, and adjustment value
- **Two adjustment methods:**
  1. **Slider:** Quick adjustments within range (min: -originalTolerance, max: +5)
  2. **Direct Input:** Type any value (validated to prevent negative tolerances)
- **Real-time updates:** RSS recalculates as you adjust
- **Sensitivity metric:** Shows how much RSS changes per increment
- **Reset functionality:** Reset individual items or reset all

**Validation:**
- Cannot reduce tolerance below 0
- Slider dynamically limits minimum based on original tolerance
- Direct input field has min attribute
- Visual warning alert when tolerance reaches 0
- Adjustment value is clamped if it would cause negative tolerance

**Configuration:**
- `sensitivityIncrement` in AnalysisSettings (default: 0.1)
- Configurable in ProjectMetadataEditor
- Affects slider step size

### Help Documentation

**Access:** "?" icon in app bar (top-right, next to Settings)

**Sections (Expandable Accordions):**
1. **RSS Calculation** - Formula, step-by-step, example table
2. **Worst-Case Calculation** - Formula, comparison with RSS
3. **Float Factors** - When to use 1.0 vs √3
4. **Sensitivity Analysis** - Detailed explanation with examples
5. **Specification Limits (USL/LSL)** - Status indicators (green/yellow/red) for upper and lower limits
6. **Symmetric vs Asymmetric** - Mode differences
7. **File Operations** - Save, Load, Export CSV, Import CSV
8. **Tips & Best Practices** - Usage recommendations

**Implementation:** HelpDialog.tsx with comprehensive documentation for user reference

### Negative Tolerance Validation

**Validation Points:**
- **ToleranceTable:** Input fields clamp to min: 0, show error state if negative
- **CSV Import:** `Math.max(0, parsedValue)` before creating items
- **JSON Import:** Validates and clamps all tolerance values during load
- **DirectionTab:** USL and LSL accept any value (positive or negative), no validation constraints
- **SensitivityAnalysisDialog:**
  - Adjustment calculations prevent negative results
  - Slider range dynamically limited
  - Direct input field has min attribute
  - Visual warnings when at limit

**User Feedback:**
- Red border and "Must be ≥ 0" helper text on invalid input
- Error alert in sensitivity analysis when tolerance reaches 0
- Tooltips explaining validation rules

## Project Metadata & Traceability

### Accessing Project Settings
- Click the ⚙️ **Settings icon** in the app bar (top-right)
- Opens `ProjectMetadataEditor` dialog
- Edit project name (updates app bar title)
- Select units (mm, inches, μm, mils)
- Add author, drawing number, revision
- Created/Modified dates are auto-managed

### Direction Descriptions
- Each direction tab includes an editable **Description** field (top of DirectionTab)
- Use to document what the direction represents
- Example: "Envelope height from base to top seal"

### Item Notes & Source References
- Click the 📝 **Notes icon** in the Actions column (ToleranceTable)
- Icon turns **blue** when notes/source are present
- Opens dialog with:
  - **Source Reference**: Drawing number, part number, specification
  - **Notes**: Additional comments or justifications
- Supports traceability and documentation requirements

## Important Implementation Details

### ID Generation
Uses timestamp-based IDs: `Date.now()`. Simple, session-scoped uniqueness. Not cryptographically secure but acceptable for this use case.

### Symmetric vs Asymmetric Mode
- **Symmetric mode:** UI shows single tolerance input (±), enforces `tolerancePlus === toleranceMinus` on change
- **Asymmetric mode:** UI shows separate + and - inputs
- **Data model:** Always stores both values separately (enables mode switching without recalculating)

### Material-UI Dependency
Heavy reliance on MUI for professional UI components (Tables, Tabs, Chips, TextField, etc.). Emotion CSS-in-JS required by MUI. This adds bundle size but provides accessible, professional-looking components suitable for engineering tools.

### UI Condensing Patterns

**Table Optimization:**
- **6 columns** (RSS/Worst-Case modes): Item | Nominal | Tolerance(±) | Tolerance(-) | Float (×√3) | Actions
- **6 columns** (Monte Carlo mode with advanced distributions): Item | Nominal | Tolerance(±) | Tolerance(-) | Distribution | Actions
- **Float column**: Shows ONLY in RSS/Worst-Case modes (not in Monte Carlo)
  - "Float?" checkbox and "Float Factor" combined into single column
  - Shows inline factor value: `(1.732)` when checked, `(1.0)` when unchecked
  - Float factor √3 in deterministic modes corresponds to Uniform distribution in Monte Carlo
- **Distribution column**: Shows ONLY in Monte Carlo mode when `useAdvancedDistributions` is enabled
  - Dropdown with options: Normal, Uniform, Triangular
  - Replaces the Float checkbox in Monte Carlo mode
- `size="small"` for compact cells
- `elevation={0}` with `variant="outlined"` for flatter appearance

**Spacing Standards:**
- Container: `mt:2, mb:2` (not mt:4, mb:4)
- Paper padding: `p:2` (not p:3)
- Gaps: `gap:2` or `gap:1` (not gap:3)
- Button spacing: `mt:1` (not mt:2)

**Results Display:**
- Formula moved to help icon tooltip (not always visible box)
- Collapsible "Individual Contributions" section (collapsed by default, only shows if 2+ items)
- Compact Chip (default size, not "large")
- 3 decimal places (not 4) for cleaner display

**Button Labels:**
- Compact text: "Save"/"Load" (not "Save Project"/"Load Project"), "Add Row" (not "Add Item")
- All buttons use `size="small"`

### Component Responsibilities

| Component | Responsibility | State | Key Features |
|-----------|---------------|-------|--------------|
| `App.tsx` | Root state holder, tab management, direction CRUD, global settings | `projectData`, `activeTab`, `settingsOpen`, `helpOpen` | App bar with project name, Settings & Help icons, calculation mode toggle |
| `ProjectMetadataEditor.tsx` | Edit project metadata, units, and analysis settings | `editedMetadata`, `selectedUnit`, `editedSettings` | Dialog with auto-dates, multi-unit config, sensitivity increment |
| `DirectionTab.tsx` | Grid container, description, target nominal, USL/LSL inputs, RSS calculation | `rssResult`, `csvImportOpen`, `diagramOpen` (local) | Side-by-side layout, CSV import button, diagram button, target nominal, USL and LSL fields |
| `ToleranceTable.tsx` | Editable 6-column table, add/remove/duplicate items, notes dialog, mode-specific columns | `notesDialogOpen`, `editingItem`, `editNotes`, `editSource` | Nominal column, Float column (RSS/Worst-Case only), Distribution column (Monte Carlo with useAdvancedDistributions only), notes icon (blue when data), duplicate icon, validation min:0 for tolerances |
| `ResultsDisplay.tsx` | RSS/worst-case display, spec limit status, contributions, sensitivity | `showContributions`, `sensitivityOpen` (local) | Multi-unit support, USL/LSL chips (green/yellow/red), sensitivity button |
| `FileControls.tsx` | Save/load JSON, export/import CSV | `snackbar` (local) | Compact buttons with success/error feedback |
| `CSVImportDialog.tsx` | 3-step CSV import with column mapping | `activeStep`, `csvData`, `columnMapping`, `previewItems` | Stepper UI, drag-drop upload, column mapping dropdowns, preview table |
| `SensitivityAnalysisDialog.tsx` | Interactive tolerance adjustment analysis | `adjustedItems`, `selectedItemId`, `currentTotal` | Dual input (slider + direct), dynamic limits, real-time RSS update, sensitivity metric |
| `HelpDialog.tsx` | Comprehensive help documentation | None (stateless) | Expandable accordions, formulas, examples, best practices |
| `DiagramBuilderDialog.tsx` | Visual diagram editor for tolerance stacks | `nodes`, `edges`, `hasChanges` (local) | React Flow integration, manual positioning, selectable/deletable connectors, save/load diagram |
| `DiagramCanvas.tsx` | React Flow wrapper with configuration | None (stateless) | Background grid, zoom/pan controls, minimap, custom node types, edge selection enabled |
| `ToleranceItemNode.tsx` | Custom node displaying tolerance item | `expanded` (local) | Color-coded by float factor, collapsible metadata, connection handles |
| `ResultNode.tsx` | Display stack summary results in diagram | None (stateless) | Green-themed node, shows target nominal/variance/RSS total, left handle only, non-deletable |

## Diagram Builder

**Purpose:** Visual editor for tolerance stacks using React Flow library.

### Architecture
- **Library:** React Flow v11.11.4 (MIT license, ~200KB bundle size)
- **Storage:** Optional `diagram` field in Direction interface
- **Synchronization:** Bidirectional sync with ToleranceTable via App.tsx state

### Components
| Component | Purpose | File |
|-----------|---------|------|
| `DiagramBuilderDialog` | Main modal container, orchestrates diagram state | src/components/DiagramBuilderDialog.tsx |
| `DiagramCanvas` | React Flow wrapper with grid, controls, minimap | src/components/DiagramCanvas.tsx |
| `ToleranceItemNode` | Custom node displaying tolerance data | src/components/ToleranceItemNode.tsx |
| `ResultNode` | Summary node showing stack results | src/components/ResultNode.tsx |

### Data Model

**Direction Interface Updated:**
```typescript
export interface Direction {
  id: string;
  name: string;
  description?: string;
  items: ToleranceItem[];
  usl?: number;
  lsl?: number;
  diagram?: DiagramData;  // NEW: Optional diagram visualization
}
```

**DiagramData Structure:**
```typescript
export interface DiagramData {
  nodes: DiagramNode[];           // Node positions (tolerance items only)
  connectors: DiagramConnector[]; // Connections between nodes
  resultNodePosition?: DiagramPosition;  // Result node position (optional, stored separately)
  viewport?: {                    // Saved zoom/pan state
    x: number;
    y: number;
    zoom: number;
  };
}

export interface DiagramNode {
  id: string;              // Matches ToleranceItem.id (1:1 relationship)
  position: { x: number; y: number };
  width?: number;
  height?: number;
}

export interface DiagramConnector {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandleId?: string;  // Source handle ID (top/bottom/left/right)
  targetHandleId?: string;  // Target handle ID (top/bottom/left/right)
  label?: string;          // User-defined label (generic meaning)
  animated?: boolean;
  style?: { strokeColor?: string; strokeWidth?: number };
}
```

### Features

**Node Representation:**
- Each box = one ToleranceItem
- Rounded corners for clean appearance (borderRadius: 2 on container, matching radius on header)
- Color coding: Blue (fixed, floatFactor=1.0), Orange (floating, floatFactor>1.0)
- Displays: item name, nominal, tolerance (±), float factor
- Collapsible metadata: source reference, notes
- Connection handles on all 4 sides (top, right, bottom, left) - **fully functional**
  - Each handle has explicit ID for reliable edge connections
  - Handle positions: top/bottom for vertical flow, left/right for horizontal flow

**Result Node:**
- Automatic summary node displaying stack results
- Always present, cannot be deleted (protected node)
- Positioned on right side of tolerance items (default: 400px offset from rightmost item)
- Green theme (#4caf50 gradient) to distinguish from tolerance items
- Displays:
  - Target Nominal (if set in DirectionTab)
  - Variance (calculated nominal sum - target nominal, color-coded: green if ≥0, red if negative)
  - RSS Total (±tolerance result)
- Two connection handles on left side for incoming edges from tolerance items:
  - left-top handle at 20% from top
  - left-bottom handle at 80% from top
- Position preserved across save/reload (stored in DiagramData.resultNodePosition)
- Auto-regenerates if missing when diagram opens
- Draggable for manual repositioning

**Connectors:**
- Generic relationships (user-defined meaning via labels)
- Drag from handle to handle to create
- **Selectable:** Click on a connector to select it (turns blue and thicker)
- **Deletable:** Select a connector and press Delete or Backspace key to remove
- **Hover effect:** Connectors darken when hovered with pointer cursor
- **Edge type:** Smooth step edges for clean appearance (preserved on save/reload)
- Animated flow effect optional
- Visual feedback: Selected edges are blue (#1976d2, 3px thick)

**Layout:**
- Manual positioning via drag-and-drop
- Auto-position for new diagrams: vertical stack with 150px spacing
- Positions preserved when switching modes or editing items
- Zoom, pan, fit-view controls

**Synchronization:**
- **Single Source of Truth:** App.tsx `ProjectData.directions[].items`
- **Table → Diagram:** Item changes update node data (positions preserved)
- **Diagram → Table:** Not yet implemented (Phase 2: inline editing)
- **Add/Delete:** New items auto-positioned at bottom, deleted items remove nodes and connected edges

**Save/Load:**
- Diagram data saved with Direction in JSON export
- Backward compatible: old files without diagram field still work
- Unsaved changes warning on close

### Usage

1. Click "Open Stack Diagram" button in DirectionTab (next to CSV Import)
2. Dialog opens with existing diagram or auto-positioned nodes
3. Drag nodes to desired positions
4. Create connectors by dragging from node handles
5. **Select connectors:** Click on any connector to select it (turns blue)
6. **Delete connectors:** Select a connector and press Delete or Backspace
7. Click "Save" to persist diagram with Direction
8. Diagram data exports/imports with project JSON

### Implementation Notes

**Node Initialization (`initializeDiagram()`):**
- If `direction.diagram` exists: load saved positions
- If no diagram: auto-position nodes vertically (y = 100 + index * 150)
- Missing nodes (new items): append at bottom

**State Management:**
- Uses React Flow hooks: `useNodesState`, `useEdgesState`
- Dirty flag tracks unsaved changes
- Dialog reinitializes only when opened or direction ID changes

**Edge Selection & Deletion:**
- `deleteKeyCode={['Backspace', 'Delete']}` enables keyboard deletion
- `edgesReconnectable={false}` prevents accidental reconnection
- `multiSelectionKeyCode={null}` disables multi-selection for simplicity
- All edges created with `type: 'smoothstep'` for consistent appearance
- Custom CSS styling for visual feedback (blue when selected, darker on hover)
- Edge type preserved on save/reload (stored in `defaultEdgeOptions`)

**Handle Implementation:**
- Handles extend beyond node boundaries for proper hit detection
- No overflow clipping on parent container to ensure all handles accessible
- Explicit IDs ("top", "bottom", "left", "right") for predictable edge behavior
- Current types: top/left are targets (receive), bottom/right are sources (send)
- All 4 handles functional and clickable with visible hover states
- Handle IDs stored in DiagramConnector (sourceHandleId/targetHandleId) for precise edge restoration
- Connections persist correctly across save/reload with exact handle positions preserved

**Performance:**
- React Flow handles 1000+ nodes efficiently
- Custom nodes use `React.memo` to prevent unnecessary re-renders
- Lazy loading (future enhancement): use `React.lazy()` for dialog

**Bundle Size:**
- React Flow adds ~200KB to bundle (warning expected in build)
- Future optimization: dynamic import for dialog component

### Future Enhancements (Not Yet Implemented)

**Phase 2: Connectors & Editing**
- ✓ Connector selection and deletion (IMPLEMENTED)
- Connector labels (click edge to edit)
- Inline node editing (double-click to edit tolerance values)
- Connector animated flow toggle

**Phase 3: Advanced Sync**
- Full bidirectional editing (diagram edits → table updates)
- Real-time sync when both open

**Phase 4: Utilities**
- DiagramToolbar component (fit view, clear connectors, examples)
- ExampleDiagramViewer with template gallery
- Auto-layout algorithms (hierarchical, force-directed)
- Export diagram as image (PNG/SVG)

### Hot Module Replacement (HMR)
Vite provides automatic HMR. Changes to `.tsx` files reload instantly without full page refresh. State is preserved during HMR when possible.

## Common Edits

**Adding a new tolerance item field:**
1. Update `ToleranceItem` interface in `src/types/index.ts`
2. Modify `ToleranceTable.tsx` to add UI column (table has 6 columns - some are mode-specific)
   - Note: Float column only appears in RSS/Worst-Case modes
   - Note: Distribution column only appears in Monte Carlo mode with advanced distributions
3. Update `handleItemChange` to handle new field
4. Update `rssCalculator.ts` if field affects calculation
5. Consider impact on `ResultsDisplay.tsx` contributions table
6. Update CSV import/export in `CSVImportDialog.tsx` and `fileHandlers.ts`
7. Add validation if field has constraints (see negative tolerance validation example)

**Changing RSS formula:**
1. Edit `calculateRSS()` in `src/utils/rssCalculator.ts`
2. Update formula tooltip in `ResultsDisplay.tsx` (help icon, line ~50)
3. Update README.md formula documentation

**Adding a new direction-level property:**
1. Update `Direction` interface in `src/types/index.ts`
2. Add UI controls in `App.tsx` (near direction tabs)
3. Pass property down to `DirectionTab` via props
4. Update `ProjectData` serialization if needed

**Modifying the side-by-side layout:**
- Adjust Grid column widths in `DirectionTab.tsx` (currently 7/5 split)
- Grid uses `spacing={2}` between columns
- Responsive breakpoint: `xs={12} md={7}` for table, `xs={12} md={5}` for results

**Adding table columns:**
- Maintain `size="small"` for compact appearance
- Use `elevation={0} variant="outlined"` for Paper wrapper
- Follow spacing pattern: inline displays save space (see Float column example)

## Mathematical Symbols

Use actual Unicode characters in JSX, NOT escape sequences:
- `±` not `\u00b1`
- `√` not `\u221A`
- `×` not `\u00d7`
- `Σ` not `\u03A3`
- `²` not `\u00B2`
- `≈` not `\u2248`

Unicode escapes don't render correctly in JSX strings.

## Default Values Reference

**New Tolerance Item (ToleranceTable.tsx:60-69):**
```typescript
{
  id: `item-${Date.now()}`,
  name: `Item ${items.length + 1}`,
  nominal: 0,                // Default nominal value
  tolerancePlus: 0.5,        // Non-zero default for meaningful calculations
  toleranceMinus: 0.5,
  floatFactor: 1.0,          // FLOAT_FACTORS.FIXED
}
```

**New Analysis Settings (App.tsx:58-68, fileHandlers.ts:41-52):**
```typescript
{
  calculationMode: 'rss',
  showMultiUnit: false,
  contributionThreshold: 40,  // Percentage for high-impact warnings
  sensitivityIncrement: 0.1,  // Slider step size
  enableMonteCarlo: false,    // Monte Carlo is an advanced feature, disabled by default
  monteCarloSettings: {
    iterations: 50000,
    useAdvancedDistributions: false,
  },
}
```

**Specification Limit Status Thresholds (ResultsDisplay.tsx):**
```typescript
< 90% of limit   → Green (pass)
90-100% of limit → Yellow (warning)
> 100% of limit  → Red (fail)

// Applied independently to both USL and LSL
// uslUtilization = (totalPlus / usl) × 100
// lslUtilization = (totalMinus / |lsl|) × 100
```

**Constants (rssCalculator.ts):**
```typescript
FLOAT_FACTORS = {
  FIXED: 1.0,
  SQRT3: Math.sqrt(3)  // 1.732050808
}

UNIT_TO_MM = {
  mm: 1,
  inches: 25.4,
  μm: 0.001,
  mils: 0.0254
}
```

## TODO: User Profiles & Cloud Templates (Future Feature)

**Status:** Planned (Not Implemented)
**Last Updated:** 2025-01-24

### Overview

Implement user authentication with Microsoft OAuth and cloud storage for saving tolerance templates, stack templates, and projects using Firebase as the backend.

### Architecture Decisions

- **Backend:** Firebase (Backend-as-a-Service)
- **Authentication:** Microsoft OAuth via Firebase Authentication custom provider
- **Database:** Firestore (NoSQL, JSON-native)
- **Features:** Tolerance item templates, stack templates, project templates, sharing with other users

### Implementation Plan

#### Phase 1: Firebase & Azure Setup (Infrastructure)
1. Create Firebase project and install Firebase SDK dependencies (`firebase` v10+)
2. Create Azure AD app registration for Microsoft OAuth (tenant, client ID, redirect URIs)
3. Configure Firebase Authentication with Microsoft as custom OAuth provider
4. Design Firestore database schema for users, projects, templates (3 collections)
5. Set up Firestore security rules for user-scoped data access

#### Phase 2: Authentication Integration (Frontend)
6. Create authentication context (AuthContext.tsx) with login/logout/user state
7. Build login screen with "Sign in with Microsoft" button
8. Add auth state to App.tsx - protect main app behind authentication
9. Create user profile component showing user info and logout button
10. Handle auth redirects and token refresh for seamless session management

#### Phase 3: Cloud Storage Integration
11. Create Firebase service layer (firebaseService.ts) with CRUD operations
12. Update ProjectData to include userId and cloudId fields for syncing
13. Replace local file save/load with cloud save/load using Firestore
14. Add "My Projects" list view showing all user's saved projects
15. Implement auto-save with draft/published states

#### Phase 4: Template System - Item Templates
16. Create ToleranceItemTemplate type and Firestore collection
17. Build ItemTemplateManager component - list, create, edit, delete templates
18. Add "Insert from Template" button in ToleranceTable
19. Implement template search/filter by category and tags

#### Phase 5: Template System - Stack Templates
20. Create StackTemplate type (complete Direction) and collection
21. Build StackTemplateManager component with preview functionality
22. Add "Save as Stack Template" button in DirectionTab
23. Add "Load Stack Template" to replace/append items

#### Phase 6: Template System - Project Templates
24. Create ProjectTemplate type (complete ProjectData) and collection
25. Build ProjectTemplateManager component with thumbnail previews
26. Add "Save as Project Template" in settings menu
27. Add "New from Template" in project list view

#### Phase 7: Sharing Features
28. Add sharing permissions (private/public/shared-with-users) to all template types
29. Create TemplateGallery component showing public templates from all users
30. Implement "Share with specific users" via email lookup
31. Add "Duplicate template" for users to copy shared templates

#### Phase 8: Migration & Polish
32. Build JSON import wizard to migrate existing files to cloud
33. Add offline support with local caching using IndexedDB
34. Update CLAUDE.md with new architecture documentation
35. Add loading states and error handling throughout

### Proposed Database Schema

```
Firestore Collections:
├── users/{userId}
│   ├── displayName: string
│   ├── email: string
│   ├── createdAt: timestamp
│   └── preferences: { defaultUnit, theme, ... }
│
├── projects/{projectId}
│   ├── ownerId: string (userId)
│   ├── projectData: ProjectData (full object)
│   ├── sharing: 'private' | 'public' | 'shared'
│   ├── sharedWith: string[] (userIds)
│   ├── createdAt: timestamp
│   └── modifiedAt: timestamp
│
├── templates/
│   ├── items/{templateId}
│   │   ├── ownerId: string
│   │   ├── name: string
│   │   ├── category: string
│   │   ├── tags: string[]
│   │   ├── item: ToleranceItem
│   │   ├── sharing: 'private' | 'public'
│   │   └── usageCount: number
│   │
│   ├── stacks/{templateId}
│   │   ├── ownerId: string
│   │   ├── name: string
│   │   ├── category: string
│   │   ├── direction: Direction
│   │   ├── sharing: 'private' | 'public'
│   │   └── usageCount: number
│   │
│   └── projects/{templateId}
│       ├── ownerId: string
│       ├── name: string
│       ├── description: string
│       ├── projectData: ProjectData
│       ├── thumbnail?: string (base64)
│       ├── sharing: 'private' | 'public'
│       └── usageCount: number
```

### New Components Required

| Component | Purpose |
|-----------|---------|
| `AuthContext.tsx` | Authentication state provider |
| `LoginScreen.tsx` | Microsoft OAuth sign-in UI |
| `UserProfile.tsx` | User info display and logout |
| `ProjectList.tsx` | Cloud project browser |
| `ItemTemplateManager.tsx` | Manage tolerance item templates |
| `StackTemplateManager.tsx` | Manage stack templates |
| `ProjectTemplateManager.tsx` | Manage project templates |
| `TemplateGallery.tsx` | Browse public/shared templates |

### New Utility Files Required

| File | Purpose |
|------|---------|
| `src/services/firebaseConfig.ts` | Firebase initialization |
| `src/services/firebaseService.ts` | Firestore CRUD operations |
| `src/services/authService.ts` | Authentication helpers |
| `src/types/templates.ts` | Template type definitions |

### Dependencies to Add

```json
{
  "firebase": "^10.x",
  "@azure/msal-browser": "^3.x"  // Optional: enhanced Microsoft auth
}
```

### Azure AD Setup Notes

When implementing, create Azure AD app registration with:
- Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
- Redirect URI: `https://<your-domain>/__/auth/handler` (Firebase Auth handler)
- API permissions: `User.Read` (Microsoft Graph)
- Generate client secret for Firebase configuration
