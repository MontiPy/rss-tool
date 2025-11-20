# RSS Tolerance Stack Calculator

A professional web application for calculating **Root Sum Square (RSS)** tolerance stacks with support for float factors and multiple directions.

## Features

- **Multi-direction support**: Calculate tolerance stacks for multiple directions (B-Direction, H-Direction, etc.)
- **Float factor**: Automatically multiply tolerances by √3 (≈1.7321) when marked as "float"
- **Symmetric & Asymmetric modes**: Support both ±tolerances and separate +/- values
- **Save/Load projects**: Export and import calculations as JSON files
- **Live calculations**: Results update automatically as you enter data
- **Professional UI**: Clean Material-UI interface with tables and tabs

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` folder.

## How to Use

### Basic Workflow

1. **Choose Tolerance Mode**:
   - **Symmetric**: Single value applies to both + and - (e.g., ±0.5)
   - **Asymmetric**: Different + and - values (e.g., +0.5/-0.3)

2. **Add Tolerance Items**:
   - Click "Add Item" to create a new tolerance entry
   - Enter item name and tolerance value(s)
   - Check "Float?" if the item should use the √3 multiplier

3. **View Results**:
   - RSS total is calculated automatically
   - Individual contributions are shown in the results table

4. **Multiple Directions**:
   - Use tabs to switch between directions
   - Click "Add Direction" to create new directions
   - Double-click direction name to rename

5. **Save/Load**:
   - Click "Save Project" to export as JSON
   - Click "Load Project" to import a saved file

### RSS Formula

The calculator uses the Root Sum Square formula:

```
RSS = √(Σ((tolerance × float_factor)²))
```

Where:
- `float_factor = √3 ≈ 1.7321` if "Float?" is checked
- `float_factor = 1.0` otherwise

### Example Calculation

Based on the included `example-calculation.json`:

**B-Direction:**
| Item | Tolerance | Float? | Float Factor | Contribution |
|------|-----------|--------|--------------|--------------|
| Letter Profile | ±0.5 | No | 1.0 | 0.5 |
| Foam Edge | ±1.5 | No | 1.0 | 1.5 |
| Plasman Nest | ±0.5 | Yes | 1.7321 | 0.8660 |

**Result:** RSS = √(0.5² + 1.5² + 0.866²) = **±1.8028 mm**

**H-Direction:**
| Item | Tolerance | Float? | Float Factor | Contribution |
|------|-----------|--------|--------------|--------------|
| Letter Profile | ±0.5 | No | 1.0 | 0.5 |
| Foam Edge | ±0.5 | No | 1.0 | 0.5 |
| Plasman Nest | ±0.5 | Yes | 1.7321 | 0.8660 |

**Result:** RSS = √(0.5² + 0.5² + 0.866²) = **±1.1180 mm**

## Project Structure

```
rss-tool/
├── src/
│   ├── components/
│   │   ├── DirectionTab.tsx      # Single direction calculator
│   │   ├── ToleranceTable.tsx    # Table of tolerance items
│   │   ├── ResultsDisplay.tsx    # RSS calculation results
│   │   └── FileControls.tsx      # Save/Load buttons
│   ├── utils/
│   │   ├── rssCalculator.ts      # RSS calculation logic
│   │   └── fileHandlers.ts       # JSON import/export
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces
│   ├── App.tsx                   # Main application
│   └── main.tsx                  # Entry point
├── example-calculation.json      # Example calculation file
└── README.md                     # This file
```

## Technologies Used

- **React 18** with **TypeScript**
- **Vite** - Fast build tool
- **Material-UI (MUI)** - Professional UI components
- **file-saver** - File download functionality

## License

This project is open source and available for use.

## Tips

- **Rename directions**: Double-click on a direction tab name to rename it
- **Delete directions**: Click the X icon on a direction tab (must have at least 1 direction)
- **Delete items**: Click the red delete icon in the table row
- **Load example**: Load the included `example-calculation.json` to see a working example
- **Switch modes anytime**: You can change between symmetric and asymmetric modes at any time

## Troubleshooting

If you encounter issues:

1. Ensure Node.js 18+ is installed: `node --version`
2. Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
3. Clear browser cache and reload
4. Check the browser console for errors (F12)
