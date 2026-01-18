/**
 * Custom React Hooks
 * 
 * This module exports reusable hooks that encapsulate common patterns
 * used throughout the RSS Tolerance Calculator application.
 * 
 * Usage:
 * ```tsx
 * import { useProjectData, useAutoSave, useKeyboardShortcuts, useUndoRedo } from './hooks';
 * ```
 */

export { useProjectData } from './useProjectData';
export type { UseProjectDataReturn } from './useProjectData';

export { useAutoSave } from './useAutoSave';

export { useKeyboardShortcuts, COMMON_SHORTCUTS } from './useKeyboardShortcuts';

export { useUndoRedo } from './useUndoRedo';
