/**
 * Custom hook for managing project data state
 * 
 * This hook extracts project state management logic from App.tsx,
 * providing a cleaner separation of concerns and making the state
 * management logic reusable and testable.
 * 
 * Example usage:
 * ```tsx
 * const {
 *   projectData,
 *   updateToleranceMode,
 *   updateCalculationMode,
 *   addDirection,
 *   deleteDirection,
 *   duplicateDirection,
 *   updateDirection,
 *   loadProject,
 *   updateMetadata,
 * } = useProjectData(initialData);
 * ```
 */

import { useState, useCallback } from 'react';
import {
  ProjectData,
  Direction,
  ToleranceMode,
  CalculationMode,
  ToleranceUnit,
  ProjectMetadata,
  AnalysisSettings,
  ToleranceItem,
} from '../types';

const createDefaultProject = (): ProjectData => ({
  toleranceMode: 'symmetric',
  unit: 'mm',
  directions: [
    {
      id: 'dir-1',
      name: 'Stack 1',
      items: [],
    },
  ],
  metadata: {
    createdDate: new Date().toISOString(),
    modifiedDate: new Date().toISOString(),
  },
  analysisSettings: {
    calculationMode: 'rss',
    showMultiUnit: false,
    contributionThreshold: 40,
    sensitivityIncrement: 0.1,
    enableMonteCarlo: false,
    monteCarloSettings: {
      iterations: 50000,
      useAdvancedDistributions: false,
    },
  },
});

export interface UseProjectDataReturn {
  projectData: ProjectData;
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData>>;

  // Tolerance Mode
  updateToleranceMode: (mode: ToleranceMode) => void;

  // Calculation Mode
  updateCalculationMode: (mode: CalculationMode) => void;

  // Direction operations
  addDirection: () => number; // Returns index of new direction
  deleteDirection: (directionId: string) => void;
  duplicateDirection: (directionId: string) => number; // Returns index of duplicated direction
  updateDirection: (updatedDirection: Direction) => void;
  renameDirection: (directionId: string, newName: string) => void;

  // Items operations
  updateDirectionItems: (directionId: string, items: ToleranceItem[]) => void;
  addItem: (directionId: string, item: ToleranceItem) => void;
  deleteItem: (directionId: string, itemId: string) => void;
  updateItem: (directionId: string, itemId: string, updates: Partial<ToleranceItem>) => void;

  // Project operations
  loadProject: (data: ProjectData) => void;
  updateMetadata: (metadata: ProjectMetadata, unit: ToleranceUnit, analysisSettings: AnalysisSettings) => void;
  resetProject: () => void;
}

export function useProjectData(initialData?: ProjectData): UseProjectDataReturn {
  const [projectData, setProjectData] = useState<ProjectData>(
    initialData || createDefaultProject()
  );

  // Tolerance Mode
  const updateToleranceMode = useCallback((mode: ToleranceMode) => {
    setProjectData((prev) => ({
      ...prev,
      toleranceMode: mode,
    }));
  }, []);

  // Calculation Mode
  const updateCalculationMode = useCallback((mode: CalculationMode) => {
    setProjectData((prev) => ({
      ...prev,
      analysisSettings: {
        ...prev.analysisSettings!,
        calculationMode: mode,
      },
    }));
  }, []);

  // Direction operations
  const addDirection = useCallback((): number => {
    let newIndex = 0;
    setProjectData((prev) => {
      const newDirection: Direction = {
        id: `dir-${Date.now()}`,
        name: `Stack ${prev.directions.length + 1}`,
        items: [],
      };
      newIndex = prev.directions.length;
      return {
        ...prev,
        directions: [...prev.directions, newDirection],
      };
    });
    return newIndex;
  }, []);

  const deleteDirection = useCallback((directionId: string) => {
    setProjectData((prev) => {
      if (prev.directions.length <= 1) {
        console.warn('Cannot delete the last direction');
        return prev;
      }
      return {
        ...prev,
        directions: prev.directions.filter((dir) => dir.id !== directionId),
      };
    });
  }, []);

  const duplicateDirection = useCallback((directionId: string): number => {
    let newIndex = 0;
    setProjectData((prev) => {
      const direction = prev.directions.find((dir) => dir.id === directionId);
      if (!direction) return prev;

      const duplicatedDirection: Direction = {
        ...direction,
        id: `dir-${Date.now()}`,
        name: `${direction.name} (Copy)`,
        items: direction.items.map((item) => ({
          ...item,
          id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        })),
      };

      newIndex = prev.directions.length;
      return {
        ...prev,
        directions: [...prev.directions, duplicatedDirection],
      };
    });
    return newIndex;
  }, []);

  const updateDirection = useCallback((updatedDirection: Direction) => {
    setProjectData((prev) => ({
      ...prev,
      directions: prev.directions.map((dir) =>
        dir.id === updatedDirection.id ? updatedDirection : dir
      ),
    }));
  }, []);

  const renameDirection = useCallback((directionId: string, newName: string) => {
    if (!newName.trim()) return;
    setProjectData((prev) => ({
      ...prev,
      directions: prev.directions.map((dir) =>
        dir.id === directionId ? { ...dir, name: newName.trim() } : dir
      ),
    }));
  }, []);

  // Items operations
  const updateDirectionItems = useCallback((directionId: string, items: ToleranceItem[]) => {
    setProjectData((prev) => ({
      ...prev,
      directions: prev.directions.map((dir) =>
        dir.id === directionId ? { ...dir, items } : dir
      ),
    }));
  }, []);

  const addItem = useCallback((directionId: string, item: ToleranceItem) => {
    setProjectData((prev) => ({
      ...prev,
      directions: prev.directions.map((dir) =>
        dir.id === directionId ? { ...dir, items: [...dir.items, item] } : dir
      ),
    }));
  }, []);

  const deleteItem = useCallback((directionId: string, itemId: string) => {
    setProjectData((prev) => ({
      ...prev,
      directions: prev.directions.map((dir) =>
        dir.id === directionId
          ? { ...dir, items: dir.items.filter((item) => item.id !== itemId) }
          : dir
      ),
    }));
  }, []);

  const updateItem = useCallback(
    (directionId: string, itemId: string, updates: Partial<ToleranceItem>) => {
      setProjectData((prev) => ({
        ...prev,
        directions: prev.directions.map((dir) =>
          dir.id === directionId
            ? {
                ...dir,
                items: dir.items.map((item) =>
                  item.id === itemId ? { ...item, ...updates } : item
                ),
              }
            : dir
        ),
      }));
    },
    []
  );

  // Project operations
  const loadProject = useCallback((data: ProjectData) => {
    setProjectData(data);
  }, []);

  const updateMetadata = useCallback(
    (metadata: ProjectMetadata, unit: ToleranceUnit, analysisSettings: AnalysisSettings) => {
      setProjectData((prev) => ({
        ...prev,
        metadata,
        unit,
        analysisSettings,
      }));
    },
    []
  );

  const resetProject = useCallback(() => {
    setProjectData(createDefaultProject());
  }, []);

  return {
    projectData,
    setProjectData,
    updateToleranceMode,
    updateCalculationMode,
    addDirection,
    deleteDirection,
    duplicateDirection,
    updateDirection,
    renameDirection,
    updateDirectionItems,
    addItem,
    deleteItem,
    updateItem,
    loadProject,
    updateMetadata,
    resetProject,
  };
}

export default useProjectData;
