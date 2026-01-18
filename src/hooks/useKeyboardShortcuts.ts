/**
 * Custom hook for handling keyboard shortcuts
 * 
 * Provides a declarative way to define keyboard shortcuts with support for:
 * - Modifier keys (Ctrl, Shift, Alt, Meta)
 * - Prevention of default browser behavior
 * - Conditional enabling/disabling
 * - Context-aware shortcuts (e.g., disabled when typing in input)
 * 
 * Example usage:
 * ```tsx
 * useKeyboardShortcuts({
 *   'ctrl+s': { handler: handleSave, description: 'Save project' },
 *   'ctrl+z': { handler: handleUndo, description: 'Undo' },
 *   'ctrl+shift+z': { handler: handleRedo, description: 'Redo' },
 *   'delete': { handler: handleDelete, description: 'Delete selected' },
 * }, { enabled: !isEditing });
 * ```
 */

import { useEffect, useCallback, useMemo } from 'react';

interface ShortcutConfig {
  /** Handler function to call when shortcut is triggered */
  handler: () => void;
  /** Description of what the shortcut does (for help display) */
  description?: string;
  /** Whether to prevent default browser behavior (default: true) */
  preventDefault?: boolean;
  /** Whether this shortcut is currently enabled (default: true) */
  enabled?: boolean;
}

type ShortcutMap = Record<string, ShortcutConfig | (() => void)>;

interface UseKeyboardShortcutsOptions {
  /** Whether all shortcuts are enabled (default: true) */
  enabled?: boolean;
  /** Element to attach listeners to (default: window) */
  target?: HTMLElement | Window;
  /** Whether to ignore shortcuts when focused on input elements (default: true) */
  ignoreInputElements?: boolean;
}

interface ShortcutInfo {
  keys: string;
  description: string;
}

interface UseKeyboardShortcutsReturn {
  /** List of all registered shortcuts with descriptions */
  shortcuts: ShortcutInfo[];
}

/**
 * Normalizes a keyboard shortcut string to a consistent format
 * Example: "Ctrl+S" -> "ctrl+s"
 */
function normalizeShortcut(shortcut: string): string {
  return shortcut
    .toLowerCase()
    .split('+')
    .sort((a, b) => {
      // Sort modifiers first in consistent order: ctrl, alt, shift, meta, then key
      const order = ['ctrl', 'alt', 'shift', 'meta'];
      const aIndex = order.indexOf(a);
      const bIndex = order.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return 0;
    })
    .join('+');
}

/**
 * Converts a KeyboardEvent to a shortcut string
 */
function eventToShortcut(event: KeyboardEvent): string {
  const parts: string[] = [];
  
  if (event.ctrlKey || event.metaKey) parts.push('ctrl');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  
  // Normalize key name
  let key = event.key.toLowerCase();
  if (key === ' ') key = 'space';
  if (key === 'escape') key = 'esc';
  if (key === 'arrowup') key = 'up';
  if (key === 'arrowdown') key = 'down';
  if (key === 'arrowleft') key = 'left';
  if (key === 'arrowright') key = 'right';
  
  // Don't add modifier keys as the main key
  if (!['control', 'alt', 'shift', 'meta'].includes(key)) {
    parts.push(key);
  }
  
  return parts.join('+');
}

/**
 * Checks if the currently focused element is an input element
 */
function isInputElement(element: Element | null): boolean {
  if (!element) return false;
  
  const tagName = element.tagName.toLowerCase();
  if (['input', 'textarea', 'select'].includes(tagName)) {
    return true;
  }
  
  // Check for contenteditable
  if (element.getAttribute('contenteditable') === 'true') {
    return true;
  }
  
  return false;
}

export function useKeyboardShortcuts(
  shortcuts: ShortcutMap,
  options: UseKeyboardShortcutsOptions = {}
): UseKeyboardShortcutsReturn {
  const {
    enabled = true,
    target = typeof window !== 'undefined' ? window : undefined,
    ignoreInputElements = true,
  } = options;

  // Normalize shortcuts map
  const normalizedShortcuts = useMemo(() => {
    const normalized = new Map<string, ShortcutConfig>();
    
    Object.entries(shortcuts).forEach(([key, config]) => {
      const normalizedKey = normalizeShortcut(key);
      const normalizedConfig: ShortcutConfig = typeof config === 'function'
        ? { handler: config }
        : config;
      normalized.set(normalizedKey, normalizedConfig);
    });
    
    return normalized;
  }, [shortcuts]);

  // Get list of shortcuts for documentation
  const shortcutList = useMemo((): ShortcutInfo[] => {
    return Array.from(normalizedShortcuts.entries()).map(([keys, config]) => ({
      keys: keys.split('+').map(k => k.charAt(0).toUpperCase() + k.slice(1)).join('+'),
      description: config.description || 'No description',
    }));
  }, [normalizedShortcuts]);

  // Event handler
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;
      
      // Ignore if focused on input element
      if (ignoreInputElements && isInputElement(document.activeElement)) {
        // But still allow some shortcuts like Ctrl+S
        const shortcut = eventToShortcut(event);
        const config = normalizedShortcuts.get(shortcut);
        if (!config || !shortcut.includes('ctrl')) {
          return;
        }
      }
      
      const shortcut = eventToShortcut(event);
      const config = normalizedShortcuts.get(shortcut);
      
      if (config && (config.enabled !== false)) {
        if (config.preventDefault !== false) {
          event.preventDefault();
        }
        config.handler();
      }
    },
    [enabled, ignoreInputElements, normalizedShortcuts]
  );

  // Attach event listeners
  useEffect(() => {
    if (!target || !enabled) return;
    
    target.addEventListener('keydown', handleKeyDown as EventListener);
    
    return () => {
      target.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [target, enabled, handleKeyDown]);

  return { shortcuts: shortcutList };
}

/**
 * Common shortcuts that can be imported and spread into shortcut maps
 */
export const COMMON_SHORTCUTS = {
  SAVE: 'ctrl+s',
  OPEN: 'ctrl+o',
  NEW: 'ctrl+n',
  UNDO: 'ctrl+z',
  REDO: 'ctrl+shift+z',
  DELETE: 'delete',
  ESCAPE: 'esc',
  DUPLICATE: 'ctrl+d',
  SELECT_ALL: 'ctrl+a',
  HELP: 'f1',
} as const;

export default useKeyboardShortcuts;
