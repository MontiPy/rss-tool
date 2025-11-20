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

Direction {
  id: string
  name: string               // "B-Direction", "H-Direction", etc.
  description?: string       // Optional description (e.g., "Envelope height from base to top")
  items: ToleranceItem[]     // Tolerance stack items
}

ToleranceItem {
  id: string
  name: string
  tolerancePlus: number      // Always stored separately
  toleranceMinus: number     // Even in symmetric mode
  isFloat: boolean           // Apply √3 multiplier?
  notes?: string             // Optional notes or comments
  source?: string            // Optional source reference (drawing #, part #, spec)
}
```

**Important:**
- `tolerancePlus` and `toleranceMinus` are ALWAYS stored separately, even in symmetric mode. This allows mode switching without data loss. The `ToleranceTable` component enforces `tolerancePlus === toleranceMinus` in symmetric mode via UI logic.
- All metadata fields are optional for backward compatibility with older JSON files
- Unit selection affects display throughout the app (results, labels)

## RSS Calculation Logic

Located in `src/utils/rssCalculator.ts`:

```typescript
FLOAT_FACTOR = √3 ≈ 1.732050808

For each item:
  floatFactor = item.isFloat ? √3 : 1.0
  contribution = tolerance × floatFactor   // Applied BEFORE squaring
  sumOfSquares += contribution²

RSS = √(sumOfSquares)
```

**Critical:** Float factor is multiplied into contribution BEFORE squaring, not after RSS calculation. This follows standard statistical tolerance stack analysis for floating dimensions.

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

**Example file structure (with metadata):**
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
  "directions": [
    {
      "id": "dir-1",
      "name": "B-Direction",
      "description": "Envelope width from left to right edge",
      "items": [
        {
          "id": "item-1",
          "name": "Letter Profile",
          "tolerancePlus": 0.5,
          "toleranceMinus": 0.5,
          "isFloat": false,
          "source": "DWG-12345 Sheet 2",
          "notes": "Based on profile extrusion tolerance"
        }
      ]
    }
  ]
}
```

**Backward Compatibility:** The `importFromJSON` function automatically adds default values for missing metadata fields when loading older files, ensuring compatibility.

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
| `App.tsx` | Root state holder, tab management, direction CRUD, settings | `projectData`, `activeTab`, `settingsOpen` | Shows project name in app bar, Settings icon |
| `ProjectMetadataEditor.tsx` | Edit project metadata and units | `editedMetadata`, `selectedUnit` (local) | Dialog with auto-sync on open, auto-dates |
| `DirectionTab.tsx` | Grid container, direction description, RSS calculation | `rssResult` (local) | Side-by-side layout (Grid 7/5 split), description field |
| `ToleranceTable.tsx` | Editable 5-column table, add/remove items, notes dialog | `notesDialogOpen`, `editingItem`, `editNotes`, `editSource` | Notes icon (blue when has data), dialog for source/notes |
| `ResultsDisplay.tsx` | Compact RSS output with units, collapsible contributions | `showContributions` (local) | Shows unit from props, help tooltip, elevation:0 |
| `FileControls.tsx` | Save/load with compact buttons | `snackbar` (local) | Small buttons: "Save"/"Load" |

### Hot Module Replacement (HMR)
Vite provides automatic HMR. Changes to `.tsx` files reload instantly without full page refresh. State is preserved during HMR when possible.

## Common Edits

**Adding a new tolerance item field:**
1. Update `ToleranceItem` interface in `src/types/index.ts`
2. Modify `ToleranceTable.tsx` to add UI column (table has 5 columns currently)
3. Update `handleItemChange` to handle new field
4. Update `rssCalculator.ts` if field affects calculation
5. Consider impact on `ResultsDisplay.tsx` contributions table

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
