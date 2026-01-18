import { useState } from 'react';
import {
  ProjectData,
  Direction,
  ToleranceMode,
  CalculationMode,
  ProjectMetadata,
  ToleranceUnit,
  AnalysisSettings,
} from '../types';

const DEFAULT_PROJECT_DATA: ProjectData = {
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
};

export const useProjectData = () => {
  const [projectData, setProjectData] = useState<ProjectData>(DEFAULT_PROJECT_DATA);

  const updateToleranceMode = (mode: ToleranceMode) => {
    setProjectData((prev) => ({ ...prev, toleranceMode: mode }));
  };

  const updateCalculationMode = (mode: CalculationMode) => {
    setProjectData((prev) => ({
      ...prev,
      analysisSettings: {
        ...prev.analysisSettings!,
        calculationMode: mode,
      },
    }));
  };

  const updateDirection = (updatedDirection: Direction) => {
    setProjectData((prev) => ({
      ...prev,
      directions: prev.directions.map((dir) =>
        dir.id === updatedDirection.id ? updatedDirection : dir
      ),
    }));
  };

  const addDirection = () => {
    const newDirection: Direction = {
      id: `dir-${Date.now()}`,
      name: `Stack ${projectData.directions.length + 1}`,
      items: [],
    };
    setProjectData((prev) => ({
      ...prev,
      directions: [...prev.directions, newDirection],
    }));
    return projectData.directions.length;
  };

  const deleteDirection = (directionId: string) => {
    if (projectData.directions.length <= 1) {
      throw new Error('Cannot delete the last direction');
    }
    setProjectData((prev) => ({
      ...prev,
      directions: prev.directions.filter((dir) => dir.id !== directionId),
    }));
  };

  const duplicateDirection = (directionId: string) => {
    const direction = projectData.directions.find((dir) => dir.id === directionId);
    if (!direction) return;

    const duplicatedDirection: Direction = {
      ...direction,
      id: `dir-${Date.now()}`,
      name: `${direction.name} (Copy)`,
      items: direction.items.map((item) => ({
        ...item,
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      })),
    };

    setProjectData((prev) => ({
      ...prev,
      directions: [...prev.directions, duplicatedDirection],
    }));

    return projectData.directions.length;
  };

  const renameDirection = (directionId: string, newName: string) => {
    setProjectData((prev) => ({
      ...prev,
      directions: prev.directions.map((dir) =>
        dir.id === directionId ? { ...dir, name: newName.trim() } : dir
      ),
    }));
  };

  const loadProject = (data: ProjectData) => {
    setProjectData(data);
  };

  const updateMetadata = (
    metadata: ProjectMetadata,
    unit: ToleranceUnit,
    analysisSettings: AnalysisSettings
  ) => {
    setProjectData((prev) => ({
      ...prev,
      metadata,
      unit,
      analysisSettings,
    }));
  };

  return {
    projectData,
    updateToleranceMode,
    updateCalculationMode,
    updateDirection,
    addDirection,
    deleteDirection,
    duplicateDirection,
    renameDirection,
    loadProject,
    updateMetadata,
  };
};
