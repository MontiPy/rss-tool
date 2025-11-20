import React, { useEffect, useState } from 'react';
import { Box, Grid, TextField, Button } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { Direction, ToleranceMode, ToleranceUnit, RSSResult, CalculationMode, AnalysisSettings, ToleranceItem } from '../types';
import ToleranceTable from './ToleranceTable';
import ResultsDisplay from './ResultsDisplay';
import CSVImportDialog from './CSVImportDialog';
import { calculateTolerance } from '../utils/rssCalculator';

interface DirectionTabProps {
  direction: Direction;
  toleranceMode: ToleranceMode;
  unit: ToleranceUnit;
  calculationMode: CalculationMode;
  analysisSettings?: AnalysisSettings;
  onDirectionChange: (direction: Direction) => void;
}

const DirectionTab: React.FC<DirectionTabProps> = ({
  direction,
  toleranceMode,
  unit,
  calculationMode,
  analysisSettings,
  onDirectionChange,
}) => {
  const [rssResult, setRssResult] = useState<RSSResult | null>(null);
  const [csvImportOpen, setCsvImportOpen] = useState(false);

  // Recalculate whenever items or calculation mode changes
  useEffect(() => {
    if (direction.items.length > 0) {
      const result = calculateTolerance(direction.items, direction.id, direction.name, calculationMode);
      setRssResult(result);
    } else {
      setRssResult(null);
    }
  }, [direction, calculationMode]);

  const handleItemsChange = (items: typeof direction.items) => {
    onDirectionChange({
      ...direction,
      items,
    });
  };

  const handleDescriptionChange = (description: string) => {
    onDirectionChange({
      ...direction,
      description,
    });
  };

  const handleTargetBudgetChange = (targetBudget: string) => {
    const value = parseFloat(targetBudget);
    onDirectionChange({
      ...direction,
      targetBudget: isNaN(value) ? undefined : value,
    });
  };

  const handleCSVImport = (importedItems: ToleranceItem[]) => {
    // Append imported items to existing items
    onDirectionChange({
      ...direction,
      items: [...direction.items, ...importedItems],
    });
  };

  return (
    <Box sx={{ py: 1 }}>
      <Box sx={{ mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <TextField
              label="Tolerance Stack Description"
              value={direction.description || ''}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              fullWidth
              size="small"
              placeholder="e.g., Envelope height from base to top"
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label={`Target Budget (${unit})`}
              value={direction.targetBudget !== undefined ? direction.targetBudget : ''}
              onChange={(e) => handleTargetBudgetChange(e.target.value)}
              fullWidth
              size="small"
              type="number"
              placeholder="Optional"
              variant="outlined"
              inputProps={{ step: 0.01, min: 0 }}
              helperText="Optional tolerance target"
            />
          </Grid>
        </Grid>
      </Box>
      <Box sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<CloudUploadIcon />}
          onClick={() => setCsvImportOpen(true)}
          size="small"
        >
          Import from CSV
        </Button>
      </Box>
      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <ToleranceTable
            items={direction.items}
            toleranceMode={toleranceMode}
            onItemsChange={handleItemsChange}
          />
        </Grid>
        <Grid item xs={12} md={5}>
          <ResultsDisplay
            result={rssResult}
            directionName={direction.name}
            directionId={direction.id}
            items={direction.items}
            unit={unit}
            targetBudget={direction.targetBudget}
            calculationMode={calculationMode}
            analysisSettings={analysisSettings}
          />
        </Grid>
      </Grid>

      <CSVImportDialog
        open={csvImportOpen}
        onClose={() => setCsvImportOpen(false)}
        onImport={handleCSVImport}
        isSymmetricMode={toleranceMode === 'symmetric'}
      />
    </Box>
  );
};

export default DirectionTab;
