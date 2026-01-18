# Codebase Improvements & Suggestions

This document outlines suggested improvements for the RSS Tolerance Stack Calculator codebase, covering architecture, code quality, UI/UX, and future features.

## 1. Code Structure & Architecture

### Custom Hooks for State Logic
The `App.tsx` file currently handles significant logic for state management, including:
- Project data updates
- Tab management (add, delete, rename, duplicate)
- Global settings

**Suggestion**: Extract this logic into custom hooks, such as:
- `useProjectData`: To handle `projectData` state and CRUD operations.
- `useTabs`: To handle tab selection and manipulation.

This will make `App.tsx` cleaner and more focused on layout and composition.

### Context API
While the current prop drilling isn't excessive, as the application grows (especially with the planned Cloud/Auth features), passing `projectData` and handlers down multiple levels will become cumbersome.

**Suggestion**: Implement a `ProjectContext` to provide project state and dispatch functions to any component that needs them, simplifying the component tree.

## 2. Code Quality & Maintenance

### Linting & Formatting
The project currently relies on `tsc` for type checking but lacks dedicated linting and formatting tools.

**Suggestion**:
- **ESLint**: Install and configure ESLint with `eslint-plugin-react` and `eslint-plugin-react-hooks` to catch potential bugs and enforce best practices.
- **Prettier**: Set up Prettier for consistent code formatting.
- **Husky**: Add pre-commit hooks to ensure code quality before committing.

### Testing
There are currently no automated tests in the codebase.

**Suggestion**:
- **Unit Tests**: Add Vitest to test utility functions, especially core logic in:
  - `src/utils/rssCalculator.ts` (Critical for accuracy)
  - `src/utils/monteCarloCalculator.ts`
- **Component Tests**: Use React Testing Library to test key components like `ToleranceTable` and `ResultsDisplay`.

## 3. UI/UX Improvements

### Accessibility (a11y)
- **Labels**: Ensure all form inputs, especially dynamic ones like the tab rename input, have proper `aria-label` or `label` attributes.
- **Color Contrast**: Verify that the Green/Yellow/Red status colors in `ResultsDisplay` meet WCAG contrast guidelines.

### Undo/Redo Functionality
For a data-entry heavy application like this, the ability to undo accidental changes (like deleting a row or direction) is highly valuable.

**Suggestion**: Implement a history stack hook (e.g., `useHistory`) to track state changes and allow undo/redo operations.

### PDF Reporting
Users often need to share results with stakeholders who don't use the tool.

**Suggestion**: Add a "Generate PDF Report" feature that creates a professional-looking document with the stack table, calculation results, and diagrams.

## 4. Performance

### Virtualization
If users create tolerance stacks with hundreds of items, the `ToleranceTable` might become sluggish.

**Suggestion**: Consider using `react-window` or `react-virtualized` for the table if performance issues arise with large datasets.

### Memoization
Ensure expensive calculations (like Monte Carlo simulations) and complex component renders are properly memoized using `useMemo` and `React.memo` to prevent unnecessary re-renders.

## 5. Future Roadmap Preparation

### Cloud Integration (Firebase)
The `CLAUDE.md` mentions a future "Phase 8" for user profiles.

**Steps to prepare**:
- Define the data schema for Firestore (already outlined in `CLAUDE.md`).
- abstract the "save/load" logic in `FileControls.tsx` into an interface (e.g., `StorageProvider`) so that switching from Local File to Cloud Storage is seamless.

## 6. Specific Code Refactorings

- **`src/App.tsx`**: Move the `createTheme` definition to a separate `src/theme.ts` file.
- **`src/components/ToleranceTable.tsx`**: The `handleItemChange` function maps over the entire array for every keystroke. For very large lists, consider optimizing state updates.
- **`src/utils/rssCalculator.ts`**: Add comprehensive JSDoc comments to explain the mathematical formulas used, aiding future maintainers.
