import { saveAs } from 'file-saver';
import { ProjectData } from '../types';
import { calculateRSS } from './rssCalculator';

/**
 * Export project data to JSON file
 */
export function exportToJSON(data: ProjectData, filename: string = 'rss-calculation.json'): void {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  saveAs(blob, filename);
}

/**
 * Import project data from JSON file
 * Returns a promise that resolves with the parsed data
 * Includes backward compatibility for files created before metadata fields were added
 */
export function importFromJSON(file: File): Promise<ProjectData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const jsonString = event.target?.result as string;
        const data = JSON.parse(jsonString) as ProjectData;

        // Basic validation
        if (!data.toleranceMode || !data.directions) {
          throw new Error('Invalid project data format');
        }

        // Backward compatibility: add default values for new fields if missing
        const enhancedData: ProjectData = {
          ...data,
          unit: data.unit || 'mm', // Default to mm if not specified
          metadata: data.metadata || {
            createdDate: new Date().toISOString(),
            modifiedDate: new Date().toISOString(),
          },
          analysisSettings: {
            calculationMode: data.analysisSettings?.calculationMode || 'rss',
            showMultiUnit: data.analysisSettings?.showMultiUnit || false,
            contributionThreshold: data.analysisSettings?.contributionThreshold || 40,
            sensitivityIncrement: data.analysisSettings?.sensitivityIncrement || 0.1,
            secondaryUnit: data.analysisSettings?.secondaryUnit,
          },
          directions: data.directions.map((dir) => ({
            ...dir,
            description: dir.description || undefined, // Optional field
            targetBudget: dir.targetBudget || undefined, // Optional field
            items: dir.items.map((item) => ({
              ...item,
              // Ensure tolerances are non-negative
              tolerancePlus: Math.max(0, item.tolerancePlus || 0),
              toleranceMinus: Math.max(0, item.toleranceMinus || 0),
              // Migrate isFloat (boolean) to floatFactor (number)
              floatFactor: item.floatFactor !== undefined
                ? item.floatFactor
                : (item.isFloat ? Math.sqrt(3) : 1.0),
              notes: item.notes || undefined, // Optional field
              source: item.source || undefined, // Optional field
            })),
          })),
        };

        resolve(enhancedData);
      } catch (error) {
        reject(new Error('Failed to parse JSON file: ' + (error as Error).message));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Export project data to CSV file
 * Creates a comprehensive CSV with all tolerance stacks and their RSS results
 */
export function exportToCSV(data: ProjectData, filename: string = 'rss-calculation.csv'): void {
  const unit = data.unit || 'mm';
  let csvContent = '';

  // Add project metadata header
  if (data.metadata) {
    csvContent += `Project Name:,${data.metadata.projectName || 'N/A'}\n`;
    csvContent += `Description:,${data.metadata.description || 'N/A'}\n`;
    csvContent += `Author:,${data.metadata.author || 'N/A'}\n`;
    csvContent += `Drawing Number:,${data.metadata.drawingNumber || 'N/A'}\n`;
    csvContent += `Revision:,${data.metadata.revision || 'N/A'}\n`;
    csvContent += `Created:,${data.metadata.createdDate ? new Date(data.metadata.createdDate).toLocaleString() : 'N/A'}\n`;
    csvContent += `Modified:,${data.metadata.modifiedDate ? new Date(data.metadata.modifiedDate).toLocaleString() : 'N/A'}\n`;
    csvContent += `Units:,${unit}\n`;
    csvContent += `Tolerance Mode:,${data.toleranceMode === 'symmetric' ? 'Symmetric (±)' : 'Asymmetric (+/-)'}\n`;
    csvContent += '\n';
  }

  // Process each tolerance stack
  data.directions.forEach((direction, dirIndex) => {
    if (dirIndex > 0) csvContent += '\n';

    // Stack header
    csvContent += `Tolerance Stack:,${direction.name}\n`;
    if (direction.description) {
      csvContent += `Description:,${direction.description}\n`;
    }
    csvContent += '\n';

    // Items table header
    if (data.toleranceMode === 'symmetric') {
      csvContent += 'Item Name,Tolerance (±),Float (√3),Contribution,Source,Notes\n';
    } else {
      csvContent += 'Item Name,Tolerance (+),Tolerance (-),Float (√3),Contribution (+),Contribution (-),Source,Notes\n';
    }

    // Calculate RSS for this stack
    const rssResult = direction.items.length > 0
      ? calculateRSS(direction.items, direction.id, direction.name)
      : null;

    // Items data
    direction.items.forEach((item) => {
      const floatFactor = item.isFloat ? Math.sqrt(3) : 1.0;
      const escapeCsv = (str: string | undefined) => {
        if (!str) return '';
        // Escape double quotes and wrap in quotes if contains comma or newline
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      if (data.toleranceMode === 'symmetric') {
        const contribution = item.tolerancePlus * floatFactor;
        csvContent += `${escapeCsv(item.name)},`;
        csvContent += `${item.tolerancePlus},`;
        csvContent += `${item.isFloat ? 'Yes' : 'No'},`;
        csvContent += `${contribution.toFixed(4)},`;
        csvContent += `${escapeCsv(item.source)},`;
        csvContent += `${escapeCsv(item.notes)}\n`;
      } else {
        const contributionPlus = item.tolerancePlus * floatFactor;
        const contributionMinus = item.toleranceMinus * floatFactor;
        csvContent += `${escapeCsv(item.name)},`;
        csvContent += `${item.tolerancePlus},`;
        csvContent += `${item.toleranceMinus},`;
        csvContent += `${item.isFloat ? 'Yes' : 'No'},`;
        csvContent += `${contributionPlus.toFixed(4)},`;
        csvContent += `${contributionMinus.toFixed(4)},`;
        csvContent += `${escapeCsv(item.source)},`;
        csvContent += `${escapeCsv(item.notes)}\n`;
      }
    });

    // RSS results
    if (rssResult) {
      csvContent += '\n';
      csvContent += `RSS Result (±):,${rssResult.totalPlus.toFixed(4)} ${unit}\n`;
      if (data.toleranceMode === 'asymmetric') {
        csvContent += `RSS Result (+):,${rssResult.totalPlus.toFixed(4)} ${unit}\n`;
        csvContent += `RSS Result (-):,${rssResult.totalMinus.toFixed(4)} ${unit}\n`;
      }
    }
  });

  // Create and download CSV
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, filename);
}
