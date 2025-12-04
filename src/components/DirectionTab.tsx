import React, { useEffect, useState } from 'react';
import { Box, Grid, TextField, Button } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { Direction, ToleranceMode, ToleranceUnit, RSSResult, CalculationMode, AnalysisSettings, ToleranceItem } from '../types';
import ToleranceTable from './ToleranceTable';
import ResultsDisplay from './ResultsDisplay';
import CSVImportDialog from './CSVImportDialog';
import DiagramBuilderDialog from './DiagramBuilderDialog';
import { calculateTolerance, calculateStatisticalAnalysis } from '../utils/rssCalculator';
import { runMonteCarloSimulation } from '../utils/monteCarloCalculator';

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
  const [diagramOpen, setDiagramOpen] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  // Recalculate whenever items or calculation mode changes
  useEffect(() => {
    if (direction.items.length > 0) {
      // Monte Carlo mode
      if (calculationMode === 'monteCarlo') {
        const mcSettings = analysisSettings?.monteCarloSettings || {
          iterations: 50000,
          useAdvancedDistributions: false,
        };

        // Show loading indicator
        setIsCalculating(true);

        // Defer calculation to allow UI update
        setTimeout(() => {
          const mcResult = runMonteCarloSimulation(
            direction.items,
            direction.id,
            direction.name,
            mcSettings,
            direction.usl,
            direction.lsl
          );

          // Wrap in RSSResult structure for compatibility
          // For bilateral distribution, use 3σ (99.7% confidence) as representative value
          const threeSigma = 3 * mcResult.percentiles.stdDev;
          const result: RSSResult = {
            directionId: direction.id,
            directionName: direction.name,
            totalPlus: threeSigma,
            totalMinus: threeSigma,
            itemContributions: mcResult.itemContributions.map(ic => ({
              itemId: ic.itemId,
              itemName: ic.itemName,
              contributionPlus: ic.mean,
              contributionMinus: ic.mean,
            })),
            monteCarloResult: mcResult,
          };
          setRssResult(result);
          setIsCalculating(false);
        }, 50); // Small delay to let UI update
      } else {
        // RSS or Worst-Case mode (existing code)
        const result = calculateTolerance(direction.items, direction.id, direction.name, calculationMode);

        // Add statistical analysis if USL exists
        if (direction.usl && direction.usl > 0 && calculationMode === 'rss') {
          const statistical = calculateStatisticalAnalysis(
            result.totalPlus,
            direction.usl
          );
          result.statistical = statistical;
        }

        setRssResult(result);
      }
    } else {
      setRssResult(null);
    }
  }, [direction, calculationMode, analysisSettings]);

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

  const handleUSLChange = (usl: string) => {
    const value = parseFloat(usl);
    onDirectionChange({
      ...direction,
      usl: isNaN(value) || value === 0 ? undefined : value,
    });
  };

  const handleLSLChange = (lsl: string) => {
    const value = parseFloat(lsl);
    onDirectionChange({
      ...direction,
      lsl: isNaN(value) || value === 0 ? undefined : value,
    });
  };

  const handleTargetNominalChange = (targetNominal: string) => {
    const value = parseFloat(targetNominal);
    onDirectionChange({
      ...direction,
      targetNominal: isNaN(value) ? undefined : value,
    });
  };

  const handleCSVImport = (importedItems: ToleranceItem[]) => {
    // Append imported items to existing items
    onDirectionChange({
      ...direction,
      items: [...direction.items, ...importedItems],
    });
  };

  const handleDiagramSave = (updatedDirection: Direction) => {
    onDirectionChange(updatedDirection);
  };

  return (
    <Box sx={{ py: 1 }}>
      <Box sx={{ mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
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
          <Grid item xs={12} sm={4} md={2}>
            <TextField
              label={`Target Nominal (${unit})`}
              value={direction.targetNominal !== undefined ? direction.targetNominal : ''}
              onChange={(e) => handleTargetNominalChange(e.target.value)}
              fullWidth
              size="small"
              type="number"
              placeholder="Target"
              variant="outlined"
              inputProps={{ step: 0.001 }}
              helperText="Target dimension"
            />
          </Grid>
          <Grid item xs={12} sm={4} md={2}>
            <TextField
              label={`USL (${unit})`}
              value={direction.usl !== undefined ? direction.usl : ''}
              onChange={(e) => handleUSLChange(e.target.value)}
              fullWidth
              size="small"
              type="number"
              placeholder="Upper Limit"
              variant="outlined"
              inputProps={{ step: 0.01 }}
              helperText="Upper spec limit"
            />
          </Grid>
          <Grid item xs={12} sm={4} md={2}>
            <TextField
              label={`LSL (${unit})`}
              value={direction.lsl !== undefined ? direction.lsl : ''}
              onChange={(e) => handleLSLChange(e.target.value)}
              fullWidth
              size="small"
              type="number"
              placeholder="Lower Limit"
              variant="outlined"
              inputProps={{ step: 0.01 }}
              helperText="Lower spec limit"
            />
          </Grid>
        </Grid>
      </Box>
      <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
        <Button
          variant="outlined"
          startIcon={<CloudUploadIcon />}
          onClick={() => setCsvImportOpen(true)}
          size="small"
        >
          Import from CSV
        </Button>
        <Button
          variant="outlined"
          startIcon={<AccountTreeIcon />}
          onClick={() => setDiagramOpen(true)}
          size="small"
        >
          Open Stack Diagram
        </Button>
      </Box>
      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <ToleranceTable
            items={direction.items}
            toleranceMode={toleranceMode}
            onItemsChange={handleItemsChange}
            calculationMode={calculationMode}
            useAdvancedDistributions={analysisSettings?.monteCarloSettings?.useAdvancedDistributions}
          />
        </Grid>
        <Grid item xs={12} md={5}>
          <ResultsDisplay
            result={rssResult}
            directionName={direction.name}
            directionId={direction.id}
            items={direction.items}
            unit={unit}
            targetNominal={direction.targetNominal}
            usl={direction.usl}
            lsl={direction.lsl}
            calculationMode={calculationMode}
            analysisSettings={analysisSettings}
            isCalculating={isCalculating}
          />
        </Grid>
      </Grid>

      <CSVImportDialog
        open={csvImportOpen}
        onClose={() => setCsvImportOpen(false)}
        onImport={handleCSVImport}
        isSymmetricMode={toleranceMode === 'symmetric'}
      />

      <DiagramBuilderDialog
        open={diagramOpen}
        onClose={() => setDiagramOpen(false)}
        direction={direction}
        toleranceMode={toleranceMode}
        unit={unit}
        rssResult={rssResult}
        onSave={handleDiagramSave}
      />
    </Box>
  );
};

export default DirectionTab;
