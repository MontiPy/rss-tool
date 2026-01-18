# Proposed Improvements for RSS Tolerance Stack Calculator

This document outlines recommended improvements for the codebase, organized by priority and category.

## Table of Contents

1. [Performance Optimizations](#performance-optimizations)
2. [Code Architecture](#code-architecture)
3. [UX/UI Enhancements](#uxui-enhancements)
4. [Feature Additions](#feature-additions)
5. [Testing & Quality](#testing--quality)
6. [Accessibility](#accessibility)
7. [Technical Debt](#technical-debt)

---

## Performance Optimizations

### P1 - High Priority

#### 1.1 Code Splitting for Heavy Dependencies
**Problem:** The bundle is over 1MB due to React Flow (~200KB) and Recharts being loaded upfront.

**Solution:**
```typescript
// Lazy load diagram and chart components
const DiagramBuilderDialog = React.lazy(() => import('./components/DiagramBuilderDialog'));
const ResultsDisplay = React.lazy(() => import('./components/ResultsDisplay'));

// Usage with Suspense
<Suspense fallback={<CircularProgress />}>
  <DiagramBuilderDialog {...props} />
</Suspense>
```

**Impact:** ~40% reduction in initial bundle size, faster first paint.

---

#### 1.2 Web Worker for Monte Carlo Simulation
**Problem:** Monte Carlo simulation (50k+ iterations) blocks the main thread, causing UI jank.

**Solution:** Move calculation to a Web Worker.

```typescript
// src/workers/monteCarlo.worker.ts
self.onmessage = (e: MessageEvent) => {
  const { items, settings, usl, lsl } = e.data;
  const result = runMonteCarloSimulation(items, settings, usl, lsl);
  self.postMessage(result);
};

// Usage in DirectionTab
const worker = new Worker(new URL('../workers/monteCarlo.worker.ts', import.meta.url));
worker.postMessage({ items, settings, usl, lsl });
worker.onmessage = (e) => setRssResult(e.data);
```

**Impact:** Keeps UI responsive during heavy calculations.

---

#### 1.3 Memoization of Expensive Calculations
**Problem:** `calculateSensitivity()` in `ResultsDisplay.tsx` recalculates on every render.

**Solution:**
```typescript
// Use useMemo for expensive calculations
const sensitivities = useMemo(() => {
  return adjustedItems.map(item => ({
    itemId: item.id,
    sensitivity: calculateSensitivity(item)
  }));
}, [adjustedItems, directionId, directionName, calculationMode, increment]);
```

---

### P2 - Medium Priority

#### 1.4 Virtualization for Large Tolerance Stacks
**Problem:** Rendering 50+ tolerance items causes performance issues.

**Solution:** Use `react-window` or MUI's virtualized table.

```typescript
import { FixedSizeList } from 'react-window';

const ToleranceTable = ({ items }) => (
  <FixedSizeList
    height={400}
    itemCount={items.length}
    itemSize={56}
    width="100%"
  >
    {({ index, style }) => (
      <ToleranceRow item={items[index]} style={style} />
    )}
  </FixedSizeList>
);
```

---

#### 1.5 Debounce Input Changes
**Problem:** Every keystroke triggers state updates and recalculations.

**Solution:**
```typescript
const debouncedItemChange = useMemo(
  () => debounce((id, field, value) => {
    handleItemChange(id, field, value);
  }, 300),
  [handleItemChange]
);
```

---

## Code Architecture

### P1 - High Priority

#### 2.1 Extract Custom Hooks
**Problem:** `App.tsx` has too many responsibilities.

**Solution:** Extract logic into custom hooks.

```typescript
// src/hooks/useProjectData.ts
export function useProjectData(initialData?: ProjectData) {
  const [projectData, setProjectData] = useState<ProjectData>(initialData || defaultProject);
  
  const updateDirection = useCallback((id: string, updates: Partial<Direction>) => {
    setProjectData(prev => ({
      ...prev,
      directions: prev.directions.map(dir => 
        dir.id === id ? { ...dir, ...updates } : dir
      )
    }));
  }, []);
  
  const addDirection = useCallback(() => { /* ... */ }, []);
  const deleteDirection = useCallback((id: string) => { /* ... */ }, []);
  
  return { projectData, setProjectData, updateDirection, addDirection, deleteDirection };
}

// src/hooks/useCalculation.ts
export function useCalculation(items: ToleranceItem[], mode: CalculationMode) {
  const [result, setResult] = useState<RSSResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  
  useEffect(() => {
    // Calculation logic
  }, [items, mode]);
  
  return { result, isCalculating };
}
```

---

#### 2.2 Use useReducer for Complex State
**Problem:** ProjectData state updates are scattered across multiple handlers.

**Solution:**
```typescript
// src/reducers/projectReducer.ts
type ProjectAction = 
  | { type: 'SET_TOLERANCE_MODE'; mode: ToleranceMode }
  | { type: 'UPDATE_DIRECTION'; id: string; updates: Partial<Direction> }
  | { type: 'ADD_DIRECTION' }
  | { type: 'DELETE_DIRECTION'; id: string }
  | { type: 'UPDATE_ITEMS'; directionId: string; items: ToleranceItem[] }
  | { type: 'LOAD_PROJECT'; data: ProjectData };

function projectReducer(state: ProjectData, action: ProjectAction): ProjectData {
  switch (action.type) {
    case 'SET_TOLERANCE_MODE':
      return { ...state, toleranceMode: action.mode };
    case 'UPDATE_DIRECTION':
      return {
        ...state,
        directions: state.directions.map(dir =>
          dir.id === action.id ? { ...dir, ...action.updates } : dir
        )
      };
    // ... other cases
  }
}

// Usage in App.tsx
const [projectData, dispatch] = useReducer(projectReducer, defaultProject);
```

---

#### 2.3 Create Calculation Service Layer
**Problem:** Calculation logic mixed with component state management.

**Solution:**
```typescript
// src/services/calculationService.ts
export class CalculationService {
  private worker: Worker | null = null;
  
  async calculateRSS(items: ToleranceItem[], mode: CalculationMode): Promise<RSSResult> {
    if (mode === 'monteCarlo' && this.shouldUseWorker()) {
      return this.calculateWithWorker(items);
    }
    return calculateTolerance(items, mode);
  }
  
  private shouldUseWorker(): boolean {
    return typeof Worker !== 'undefined';
  }
}
```

---

### P2 - Medium Priority

#### 2.4 Type Safety Improvements
**Problem:** Some type assertions (`as any`) and loose typing.

**Solution:**
```typescript
// Enable strict mode in tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}

// Fix edge styling type
interface EdgeStyle {
  stroke: string;
  strokeWidth: number;
}

const edgeStyle: EdgeStyle = edge.style as EdgeStyle;
```

---

#### 2.5 Constants Centralization
**Problem:** Magic numbers and strings scattered throughout codebase.

**Solution:**
```typescript
// src/constants/index.ts
export const CHART_CONFIG = {
  HISTOGRAM_BINS: 50,
  ITEM_HISTOGRAM_BINS: 30,
  DISTRIBUTION_POINTS: 500,
  SIGMA_DISPLAY_RANGE: 4,
} as const;

export const VALIDATION = {
  MIN_TOLERANCE: 0,
  MAX_ITERATIONS: 1_000_000,
  MIN_ITERATIONS: 1_000,
  DEFAULT_CONTRIBUTION_THRESHOLD: 40,
} as const;

export const SPEC_STATUS_THRESHOLDS = {
  WARNING: 90,
  FAIL: 100,
} as const;
```

---

## UX/UI Enhancements

### P1 - High Priority

#### 3.1 Undo/Redo Functionality
**Problem:** No way to undo accidental deletions or changes.

**Solution:**
```typescript
// src/hooks/useUndoRedo.ts
export function useUndoRedo<T>(initialState: T) {
  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState<T>(initialState);
  const [future, setFuture] = useState<T[]>([]);
  
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;
  
  const undo = useCallback(() => {
    if (!canUndo) return;
    const previous = past[past.length - 1];
    setPast(past.slice(0, -1));
    setFuture([present, ...future]);
    setPresent(previous);
  }, [past, present, future, canUndo]);
  
  const redo = useCallback(() => {
    if (!canRedo) return;
    const next = future[0];
    setFuture(future.slice(1));
    setPast([...past, present]);
    setPresent(next);
  }, [past, present, future, canRedo]);
  
  return { present, setPresent, undo, redo, canUndo, canRedo };
}
```

**Keyboard shortcuts:** `Ctrl+Z` for undo, `Ctrl+Shift+Z` for redo.

---

#### 3.2 Auto-Save with Draft Recovery
**Problem:** Users lose work if browser crashes or closes accidentally.

**Solution:**
```typescript
// src/hooks/useAutoSave.ts
export function useAutoSave(projectData: ProjectData, key: string = 'rss-autosave') {
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem(key, JSON.stringify({
        data: projectData,
        timestamp: Date.now()
      }));
    }, 5000); // Auto-save every 5 seconds of inactivity
    
    return () => clearTimeout(timeoutId);
  }, [projectData, key]);
}

// On app load, check for recovery
export function useAutoSaveRecovery(key: string = 'rss-autosave') {
  const [recoveryData, setRecoveryData] = useState<ProjectData | null>(null);
  
  useEffect(() => {
    const saved = localStorage.getItem(key);
    if (saved) {
      const { data, timestamp } = JSON.parse(saved);
      // Show recovery dialog if saved within last 24 hours
      if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
        setRecoveryData(data);
      }
    }
  }, [key]);
  
  return { recoveryData, clearRecovery: () => localStorage.removeItem(key) };
}
```

---

#### 3.3 Keyboard Shortcuts
**Problem:** Power users need keyboard shortcuts for efficiency.

**Solution:**
```typescript
// src/hooks/useKeyboardShortcuts.ts
const SHORTCUTS = {
  'ctrl+s': 'save',
  'ctrl+o': 'open',
  'ctrl+n': 'new-item',
  'ctrl+d': 'duplicate-item',
  'delete': 'delete-item',
  'ctrl+z': 'undo',
  'ctrl+shift+z': 'redo',
} as const;

export function useKeyboardShortcuts(handlers: Record<string, () => void>) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = [
        e.ctrlKey && 'ctrl',
        e.shiftKey && 'shift',
        e.key.toLowerCase()
      ].filter(Boolean).join('+');
      
      if (SHORTCUTS[key] && handlers[SHORTCUTS[key]]) {
        e.preventDefault();
        handlers[SHORTCUTS[key]]();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
```

---

### P2 - Medium Priority

#### 3.4 Drag-and-Drop Reordering
**Problem:** No way to reorder tolerance items except adding new ones.

**Solution:** Use `@dnd-kit/sortable` or similar library.

```typescript
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

const ToleranceTable = ({ items, onReorder }) => (
  <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
    <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
      {items.map(item => <SortableRow key={item.id} item={item} />)}
    </SortableContext>
  </DndContext>
);
```

---

#### 3.5 Dark Mode Support
**Problem:** No dark mode option.

**Solution:**
```typescript
// src/theme/index.ts
export const lightTheme = createTheme({
  palette: { mode: 'light' },
  // ...
});

export const darkTheme = createTheme({
  palette: { mode: 'dark' },
  // ...
});

// In App.tsx
const [isDarkMode, setIsDarkMode] = useState(() => 
  window.matchMedia('(prefers-color-scheme: dark)').matches
);

<ThemeProvider theme={isDarkMode ? darkTheme : lightTheme}>
```

---

#### 3.6 Improved Error Handling with Error Boundaries
**Problem:** Errors in child components crash the entire app.

**Solution:**
```typescript
// src/components/ErrorBoundary.tsx
class ErrorBoundary extends Component<Props, State> {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Component error:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="error">Something went wrong</Typography>
          <Button onClick={() => this.setState({ hasError: false })}>
            Try Again
          </Button>
        </Paper>
      );
    }
    return this.props.children;
  }
}
```

---

## Feature Additions

### P1 - High Priority

#### 4.1 Export to PDF Report
**Problem:** Cannot generate shareable reports.

**Solution:** Use `jspdf` + `html2canvas` or `@react-pdf/renderer`.

```typescript
// src/utils/pdfExport.ts
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function exportToPDF(projectData: ProjectData, elementId: string) {
  const element = document.getElementById(elementId);
  const canvas = await html2canvas(element);
  
  const pdf = new jsPDF('p', 'mm', 'a4');
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, 190, 0);
  
  // Add metadata
  pdf.setProperties({
    title: projectData.metadata?.projectName || 'RSS Tolerance Analysis',
    author: projectData.metadata?.author,
  });
  
  pdf.save(`${projectData.metadata?.projectName || 'tolerance-analysis'}.pdf`);
}
```

---

#### 4.2 Compare Stacks Side-by-Side
**Problem:** Cannot easily compare two tolerance stacks.

**Solution:**
```typescript
// src/components/StackComparisonDialog.tsx
const StackComparisonDialog = ({ directions }) => {
  const [leftStack, setLeftStack] = useState<string | null>(null);
  const [rightStack, setRightStack] = useState<string | null>(null);
  
  return (
    <Grid container spacing={2}>
      <Grid item xs={6}>
        <Select value={leftStack} onChange={...}>
          {directions.map(d => <MenuItem value={d.id}>{d.name}</MenuItem>)}
        </Select>
        {leftStack && <CompactResultsDisplay direction={directions.find(d => d.id === leftStack)} />}
      </Grid>
      <Grid item xs={6}>
        {/* Same for right stack */}
      </Grid>
    </Grid>
  );
};
```

---

#### 4.3 Tolerance Item Templates Library
**Problem:** Users repeatedly enter same tolerance items.

**Solution:**
```typescript
// src/components/TemplateLibrary.tsx
interface ToleranceTemplate {
  id: string;
  name: string;
  category: string; // "Sheet Metal", "Injection Molding", etc.
  item: Omit<ToleranceItem, 'id'>;
}

const defaultTemplates: ToleranceTemplate[] = [
  {
    id: 'sheet-metal-bend',
    name: 'Sheet Metal Bend (14ga)',
    category: 'Sheet Metal',
    item: { name: 'Bend Tolerance', nominal: 0, tolerancePlus: 0.5, toleranceMinus: 0.5, floatFactor: 1 }
  },
  // ... more templates
];
```

---

### P2 - Medium Priority

#### 4.4 Version History / Snapshots
**Problem:** Cannot track changes over time.

**Solution:**
```typescript
// Store snapshots in localStorage or IndexedDB
interface Snapshot {
  id: string;
  label: string;
  timestamp: string;
  data: ProjectData;
}

// In App.tsx
const [snapshots, setSnapshots] = useState<Snapshot[]>([]);

const createSnapshot = (label: string) => {
  setSnapshots([...snapshots, {
    id: `snap-${Date.now()}`,
    label,
    timestamp: new Date().toISOString(),
    data: JSON.parse(JSON.stringify(projectData))
  }]);
};
```

---

#### 4.5 Excel Export with Formulas
**Problem:** CSV export doesn't include formulas.

**Solution:** Use `xlsx` library.

```typescript
import * as XLSX from 'xlsx';

export function exportToExcel(projectData: ProjectData) {
  const wb = XLSX.utils.book_new();
  
  projectData.directions.forEach(direction => {
    const wsData = direction.items.map((item, i) => ({
      'Item Name': item.name,
      'Nominal': item.nominal,
      'Tolerance (+)': item.tolerancePlus,
      'Float Factor': item.floatFactor,
      'Contribution': { f: `C${i+2}*D${i+2}` }, // Excel formula
    }));
    
    const ws = XLSX.utils.json_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, direction.name);
  });
  
  XLSX.writeFile(wb, 'tolerance-analysis.xlsx');
}
```

---

#### 4.6 Batch Edit Multiple Items
**Problem:** Tedious to update multiple items at once.

**Solution:**
```typescript
// src/components/BatchEditDialog.tsx
const BatchEditDialog = ({ selectedItems, onUpdate }) => {
  const [field, setField] = useState<keyof ToleranceItem>('floatFactor');
  const [value, setValue] = useState<number>(1.0);
  
  const handleApply = () => {
    onUpdate(selectedItems.map(id => ({ id, [field]: value })));
  };
  
  return (
    <Dialog>
      <DialogContent>
        <Select value={field} onChange={...}>
          <MenuItem value="floatFactor">Float Factor</MenuItem>
          <MenuItem value="tolerancePlus">Tolerance (+)</MenuItem>
        </Select>
        <TextField value={value} onChange={...} type="number" />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleApply}>Apply to {selectedItems.length} items</Button>
      </DialogActions>
    </Dialog>
  );
};
```

---

## Testing & Quality

### P1 - High Priority

#### 5.1 Unit Tests for Calculations
**Problem:** No tests for critical calculation logic.

**Solution:**
```typescript
// src/utils/__tests__/rssCalculator.test.ts
import { calculateTolerance, FLOAT_FACTORS } from '../rssCalculator';

describe('calculateTolerance', () => {
  const testItems = [
    { id: '1', name: 'Item 1', nominal: 0, tolerancePlus: 0.5, toleranceMinus: 0.5, floatFactor: 1 },
    { id: '2', name: 'Item 2', nominal: 0, tolerancePlus: 0.3, toleranceMinus: 0.3, floatFactor: FLOAT_FACTORS.SQRT3 },
  ];
  
  test('RSS calculation is correct', () => {
    const result = calculateTolerance(testItems, 'dir-1', 'Test', 'rss');
    // RSS = sqrt(0.5² + (0.3 * √3)²) = sqrt(0.25 + 0.27) = sqrt(0.52) ≈ 0.721
    expect(result.totalPlus).toBeCloseTo(0.721, 2);
  });
  
  test('Worst-case calculation is correct', () => {
    const result = calculateTolerance(testItems, 'dir-1', 'Test', 'worstCase');
    // WC = 0.5 + (0.3 * √3) ≈ 1.02
    expect(result.totalPlus).toBeCloseTo(1.02, 2);
  });
});
```

---

#### 5.2 Component Testing
**Solution:**
```typescript
// src/components/__tests__/ToleranceTable.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import ToleranceTable from '../ToleranceTable';

describe('ToleranceTable', () => {
  const mockItems = [/* ... */];
  const mockOnItemsChange = jest.fn();
  
  test('adds new item when Add Row clicked', () => {
    render(<ToleranceTable items={mockItems} onItemsChange={mockOnItemsChange} />);
    
    fireEvent.click(screen.getByText('Add Row'));
    
    expect(mockOnItemsChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: expect.stringContaining('Item') })])
    );
  });
  
  test('validates tolerance cannot be negative', () => {
    render(<ToleranceTable items={mockItems} onItemsChange={mockOnItemsChange} />);
    
    const input = screen.getAllByRole('spinbutton')[0];
    fireEvent.change(input, { target: { value: '-1' } });
    
    expect(mockOnItemsChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ tolerancePlus: 0 })])
    );
  });
});
```

---

#### 5.3 Add ESLint and Prettier
**Solution:**
```json
// .eslintrc.json
{
  "extends": [
    "react-app",
    "react-app/jest",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "no-unused-vars": "warn",
    "@typescript-eslint/explicit-function-return-type": "off",
    "react-hooks/exhaustive-deps": "warn"
  }
}

// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

---

### P2 - Medium Priority

#### 5.4 E2E Tests with Playwright
**Solution:**
```typescript
// e2e/tolerance-stack.spec.ts
import { test, expect } from '@playwright/test';

test('complete workflow', async ({ page }) => {
  await page.goto('/');
  
  // Add tolerance item
  await page.click('text=Add Row');
  await page.fill('[aria-label="Item name"]', 'Test Part');
  await page.fill('[aria-label="Tolerance plus"]', '0.5');
  
  // Verify RSS calculation
  await expect(page.locator('[data-testid="rss-result"]')).toContainText('0.5000');
  
  // Save project
  await page.click('text=Save');
  // ... verify download
});
```

---

## Accessibility

### P1 - High Priority

#### 6.1 ARIA Labels and Roles
**Problem:** Screen readers cannot navigate the app properly.

**Solution:**
```tsx
// Add aria-labels to interactive elements
<TextField
  aria-label="Tolerance plus value for item"
  inputProps={{ 'aria-describedby': 'tolerance-help' }}
/>
<span id="tolerance-help" className="sr-only">
  Enter the positive tolerance value in {unit}
</span>

// Add role="tabpanel" to direction tabs
<Box role="tabpanel" aria-labelledby={`tab-${direction.id}`}>
```

---

#### 6.2 Keyboard Navigation
**Problem:** Some interactive elements not keyboard accessible.

**Solution:**
```tsx
// Ensure all clickable elements are focusable
<Box
  role="button"
  tabIndex={0}
  onKeyDown={(e) => e.key === 'Enter' && onClick()}
  onClick={onClick}
>
```

---

## Technical Debt

### P1 - High Priority

#### 7.1 Remove Deprecated Props
**Problem:** `isFloat` boolean still supported for backward compatibility.

**Solution:** Add migration utility and phase out in next major version.

```typescript
// Log deprecation warning
if (item.isFloat !== undefined) {
  console.warn('isFloat is deprecated, please use floatFactor instead');
}
```

---

#### 7.2 Fix Type Warnings
**Problem:** Several `as any` type assertions.

**Solution:**
```typescript
// In fileHandlers.ts line 149
const floatFactor = item.isFloat ? Math.sqrt(3) : 1.0;
// Should be:
const floatFactor = item.floatFactor ?? (item.isFloat ? Math.sqrt(3) : 1.0);

// In DiagramBuilderDialog.tsx edge styling
interface EdgeStyleWithStroke extends React.CSSProperties {
  stroke?: string;
  strokeWidth?: number;
}
```

---

#### 7.3 Consolidate Duplicate Code
**Problem:** Chart rendering code duplicated between RSS and Monte Carlo displays.

**Solution:**
```typescript
// src/components/DistributionChart.tsx
interface DistributionChartProps {
  data: { x: number; pdf?: number; frequency?: number }[];
  xDomain: [number, number];
  usl?: number;
  lsl?: number;
  mean?: number;
  unit: string;
  showHistogram?: boolean;
}

const DistributionChart: React.FC<DistributionChartProps> = ({
  data, xDomain, usl, lsl, mean, unit, showHistogram
}) => (
  <ResponsiveContainer width="100%" height={300}>
    <ComposedChart data={data}>
      {/* Shared chart configuration */}
    </ComposedChart>
  </ResponsiveContainer>
);
```

---

### P2 - Medium Priority

#### 7.4 Add Proper Logging
**Solution:**
```typescript
// src/utils/logger.ts
const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

class Logger {
  private level = process.env.NODE_ENV === 'production' ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG;
  
  debug(msg: string, ...args: unknown[]) {
    if (this.level <= LOG_LEVELS.DEBUG) console.debug(`[DEBUG] ${msg}`, ...args);
  }
  // ... other methods
}

export const logger = new Logger();
```

---

#### 7.5 Add Request ID for Debugging
**Problem:** Hard to trace calculation issues.

**Solution:**
```typescript
// Add calculation ID to results for debugging
const result: RSSResult = {
  ...calculatedResult,
  _meta: {
    calculationId: `calc-${Date.now()}`,
    timestamp: new Date().toISOString(),
    mode: calculationMode,
    itemCount: items.length,
  }
};
```

---

## Implementation Roadmap

### Phase 1 (2-3 weeks)
- [ ] Code splitting for React Flow and Recharts
- [ ] Web Worker for Monte Carlo
- [ ] Add ESLint/Prettier
- [ ] Unit tests for calculators
- [ ] Auto-save functionality

### Phase 2 (2-3 weeks)
- [ ] Extract custom hooks
- [ ] Undo/Redo functionality
- [ ] Keyboard shortcuts
- [ ] PDF export
- [ ] Component tests

### Phase 3 (3-4 weeks)
- [ ] Dark mode
- [ ] Drag-and-drop reordering
- [ ] Template library
- [ ] Excel export
- [ ] E2E tests

### Phase 4 (Ongoing)
- [ ] Version history
- [ ] Stack comparison
- [ ] Batch editing
- [ ] Accessibility improvements
- [ ] Cloud sync (as per TODO in CLAUDE.md)

---

## Notes

- All changes should maintain backward compatibility with existing JSON files
- Performance improvements should be measured with Lighthouse/WebVitals
- Consider feature flags for gradual rollout of new features
- Document breaking changes in CHANGELOG.md
