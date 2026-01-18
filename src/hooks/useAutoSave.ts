/**
 * Custom hook for auto-saving project data to localStorage
 * 
 * Features:
 * - Debounced auto-save (saves after inactivity)
 * - Draft recovery on app load
 * - Configurable save interval
 * - Clear recovery data after successful load
 * 
 * Example usage:
 * ```tsx
 * const { recoveryData, clearRecovery, lastSaved } = useAutoSave(projectData);
 * 
 * // Show recovery dialog if data exists
 * if (recoveryData) {
 *   return <RecoveryDialog onRecover={loadProject} onDiscard={clearRecovery} />;
 * }
 * ```
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { ProjectData } from '../types';

const DEFAULT_STORAGE_KEY = 'rss-calculator-autosave';
const DEFAULT_SAVE_DELAY = 5000; // 5 seconds
const RECOVERY_WINDOW = 24 * 60 * 60 * 1000; // 24 hours

interface AutoSaveData {
  data: ProjectData;
  timestamp: number;
  version: string;
}

interface UseAutoSaveOptions {
  /** localStorage key for storing data */
  storageKey?: string;
  /** Delay in ms before auto-saving after changes (default: 5000) */
  saveDelay?: number;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
  /** Callback when save occurs */
  onSave?: () => void;
  /** Callback when save fails */
  onError?: (error: Error) => void;
}

interface UseAutoSaveReturn {
  /** Recovered project data from previous session (null if none) */
  recoveryData: ProjectData | null;
  /** Timestamp of recovered data */
  recoveryTimestamp: number | null;
  /** Clear the recovery data from localStorage */
  clearRecovery: () => void;
  /** Manually trigger a save */
  saveNow: () => void;
  /** Last successful save timestamp */
  lastSaved: number | null;
  /** Whether a save is currently pending */
  isPending: boolean;
}

export function useAutoSave(
  projectData: ProjectData,
  options: UseAutoSaveOptions = {}
): UseAutoSaveReturn {
  const {
    storageKey = DEFAULT_STORAGE_KEY,
    saveDelay = DEFAULT_SAVE_DELAY,
    enabled = true,
    onSave,
    onError,
  } = options;

  const [recoveryData, setRecoveryData] = useState<ProjectData | null>(null);
  const [recoveryTimestamp, setRecoveryTimestamp] = useState<number | null>(null);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [isPending, setIsPending] = useState(false);
  
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef(true);

  // Check for recovery data on mount
  useEffect(() => {
    if (!initialLoadRef.current) return;
    initialLoadRef.current = false;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const { data, timestamp }: AutoSaveData = JSON.parse(saved);
        
        // Only offer recovery if within recovery window
        if (Date.now() - timestamp < RECOVERY_WINDOW) {
          setRecoveryData(data);
          setRecoveryTimestamp(timestamp);
        } else {
          // Data is too old, clear it
          localStorage.removeItem(storageKey);
        }
      }
    } catch (error) {
      console.warn('Failed to load auto-save data:', error);
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  // Save function
  const save = useCallback(() => {
    if (!enabled) return;

    try {
      const saveData: AutoSaveData = {
        data: projectData,
        timestamp: Date.now(),
        version: '1.0',
      };
      
      localStorage.setItem(storageKey, JSON.stringify(saveData));
      setLastSaved(Date.now());
      setIsPending(false);
      onSave?.();
    } catch (error) {
      console.error('Auto-save failed:', error);
      setIsPending(false);
      onError?.(error as Error);
    }
  }, [projectData, storageKey, enabled, onSave, onError]);

  // Debounced auto-save on data changes
  useEffect(() => {
    if (!enabled || initialLoadRef.current) return;

    // Clear any pending save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsPending(true);

    // Schedule new save
    timeoutRef.current = setTimeout(() => {
      save();
    }, saveDelay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [projectData, saveDelay, enabled, save]);

  // Clear recovery data
  const clearRecovery = useCallback(() => {
    setRecoveryData(null);
    setRecoveryTimestamp(null);
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  // Manual save
  const saveNow = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    save();
  }, [save]);

  return {
    recoveryData,
    recoveryTimestamp,
    clearRecovery,
    saveNow,
    lastSaved,
    isPending,
  };
}

export default useAutoSave;
