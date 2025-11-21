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
  calculationMode: 'rss' | 'worstCase'  // Calculation method
  showMultiUnit: boolean                 // Display results in multiple units
  secondaryUnit?: ToleranceUnit          // Unit for multi-unit display
  contributionThreshold: number          // Percentage threshold for high-impact warnings (default: 40)
  sensitivityIncrement: number           // Increment for sensitivity analysis slider (default: 0.1)
}

Direction {
  id: string
  name: string               // "B-Direction", "H-Direction", etc.
  description?: string       // Optional description (e.g., "Envelope height from base to top")
  targetBudget?: number      // Optional tolerance budget target (triggers color-coded status)
  items: ToleranceItem[]     // Tolerance stack items
}

ToleranceItem {
  id: string
  name: string
  tolerancePlus: number      // Always stored separately, validated >= 0
  toleranceMinus: number     // Even in symmetric mode, validated >= 0
  floatFactor: number        // Float multiplier: 1.0 (fixed) or √3 ≈ 1.732 (floating)
  notes?: string             // Optional notes or comments
  source?: string            // Optional source reference (drawing #, part #, spec)
}
```

**Important:**
- `tolerancePlus` and `toleranceMinus` are ALWAYS stored separately, even in symmetric mode. This allows mode switching without data loss. The `ToleranceTable` component enforces `tolerancePlus === toleranceMinus` in symmetric mode via UI logic.
- **Validation:** Tolerances are validated to be >= 0 across all input methods (manual entry, CSV import, JSON loading, sensitivity analysis)
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

RSS recalculates automatically via `useEffect` in `DirectionTab.tsx`:

```typescript
useEffect(() => {
  if (direction.items.length > 0) {
    const result = calculateRSS(direction.items, direction.id, direction.name);
    setRssResult(result);
  }
}, [direction]);  // Watches entire direction object
```

**Lazy Calculation:** Only the active tab's direction calculates RSS. Inactive tabs don't recalculate until user switches to them (performance optimization).

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
      "targetBudget": 2.5,
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

**Backward Compatibility:** The `importFromJSON` function automatically adds default values for missing metadata fields when loading older files, ensuring compatibility. Legacy `isFloat: boolean` fields are automatically migrated to `floatFactor: number`.

## Phase 2 Features

### Budget Comparison & Status Indicators

**Target Budget Setting:**
- Each Direction can have an optional `targetBudget` field
- Set via TextField in DirectionTab (top-right of description area)
- When set, ResultsDisplay shows color-coded budget status

**Budget Status Logic:**
```typescript
budgetUtilization = (totalRSS / targetBudget) × 100

Status Colors:
- Green (Pass):    < 90% of budget
- Yellow (Warning): 90-100% of budget
- Red (Fail):      > 100% of budget
```

**Visual Indicators:**
- Chip showing percentage utilization with status color
- Warning icon for yellow/red status
- Text showing amount over budget when failing

### Calculation Mode Toggle

**Global Setting (App.tsx):**
- Radio buttons in control panel: "RSS (Statistical)" | "Worst-Case"
- Affects all directions simultaneously
- Stored in `analysisSettings.calculationMode`

**Results Display:**
- Shows current mode in results header
- RSS mode: also displays worst-case comparison with savings calculation
- Worst-case mode: shows only arithmetic sum result

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
5. **Tolerance Budget** - Status indicators (green/yellow/red)
6. **Symmetric vs Asymmetric** - Mode differences
7. **File Operations** - Save, Load, Export CSV, Import CSV
8. **Tips & Best Practices** - Usage recommendations

**Implementation:** HelpDialog.tsx with comprehensive documentation for user reference

### Negative Tolerance Validation

**Validation Points:**
- **ToleranceTable:** Input fields clamp to min: 0, show error state if negative
- **CSV Import:** `Math.max(0, parsedValue)` before creating items
- **JSON Import:** Validates and clamps all tolerance values during load
- **DirectionTab:** Target budget validated >= 0
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
- **5 columns** (not 6): Item | Tolerance(±) | Tolerance(-) | Float (×√3) | Actions
- "Float?" checkbox and "Float Factor" combined into single column
- Shows inline factor value: `(1.732)` when checked, `(1.0)` when unchecked
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
| `DirectionTab.tsx` | Grid container, description, target budget, RSS calculation | `rssResult`, `csvImportOpen` (local) | Side-by-side layout, CSV import button, target budget field |
| `ToleranceTable.tsx` | Editable 5-column table, add/remove/duplicate items, notes dialog | `notesDialogOpen`, `editingItem`, `editNotes`, `editSource` | Notes icon (blue when data), duplicate icon, validation min:0 |
| `ResultsDisplay.tsx` | RSS/worst-case display, budget status, contributions, sensitivity | `showContributions`, `sensitivityOpen` (local) | Multi-unit support, budget chips (green/yellow/red), sensitivity button |
| `FileControls.tsx` | Save/load JSON, export/import CSV | `snackbar` (local) | Compact buttons with success/error feedback |
| `CSVImportDialog.tsx` | 3-step CSV import with column mapping | `activeStep`, `csvData`, `columnMapping`, `previewItems` | Stepper UI, drag-drop upload, column mapping dropdowns, preview table |
| `SensitivityAnalysisDialog.tsx` | Interactive tolerance adjustment analysis | `adjustedItems`, `selectedItemId`, `currentTotal` | Dual input (slider + direct), dynamic limits, real-time RSS update, sensitivity metric |
| `HelpDialog.tsx` | Comprehensive help documentation | None (stateless) | Expandable accordions, formulas, examples, best practices |

### Hot Module Replacement (HMR)
Vite provides automatic HMR. Changes to `.tsx` files reload instantly without full page refresh. State is preserved during HMR when possible.

## Common Edits

**Adding a new tolerance item field:**
1. Update `ToleranceItem` interface in `src/types/index.ts`
2. Modify `ToleranceTable.tsx` to add UI column (table has 5 columns currently)
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
  tolerancePlus: 0.5,        // Non-zero default for meaningful calculations
  toleranceMinus: 0.5,
  floatFactor: 1.0,          // FLOAT_FACTORS.FIXED
}
```

**New Analysis Settings (App.tsx:43-49, fileHandlers.ts:41-47):**
```typescript
{
  calculationMode: 'rss',
  showMultiUnit: false,
  contributionThreshold: 40,  // Percentage for high-impact warnings
  sensitivityIncrement: 0.1,  // Slider step size
}
```

**Budget Status Thresholds (ResultsDisplay.tsx:79-90):**
```typescript
< 90% of budget  → Green (pass)
90-100% of budget → Yellow (warning)
> 100% of budget  → Red (fail)
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
