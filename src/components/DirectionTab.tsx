import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Box, Grid, TextField, Button, Alert } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import {
  Direction,
  ToleranceMode,
  ToleranceUnit,
  RSSResult,
  CalculationMode,
  AnalysisSettings,
  ToleranceItem,
  MonteCarloResult,
} from '../types';
import ToleranceTable from './ToleranceTable';
import ResultsDisplay from './ResultsDisplay';
import NumericField from './NumericField';
import { calculateTolerance, calculateCapability, getStackCenter, getStackNominal } from '../utils/rssCalculator';
import { startMonteCarlo } from '../utils/monteCarloRunner';
import { DEFAULT_ANALYSIS_SETTINGS } from '../utils/projectDefaults';

const CSVImportDialog = lazy(() => import('./CSVImportDialog'));
const DiagramBuilderDialog = lazy(() => import('./DiagramBuilderDialog'));

/** Wait this long after the last edit before starting a new simulation */
const MONTE_CARLO_DEBOUNCE_MS = 300;

interface DirectionTabProps {
  direction: Direction;
  toleranceMode: ToleranceMode;
  unit: ToleranceUnit;
  calculationMode: CalculationMode;
  analysisSettings?: AnalysisSettings;
  onDirectionChange: (direction: Direction) => void;
}

/** Wrap a Monte Carlo result in the common result structure (±3σ as the representative total) */
function monteCarloToResult(mc: MonteCarloResult): RSSResult {
  const threeSigma = 3 * mc.percentiles.stdDev;
  return {
    directionId: mc.directionId,
    directionName: mc.directionName,
    totalPlus: threeSigma,
    totalMinus: threeSigma,
    itemContributions: mc.itemContributions.map((ic) => ({
      itemId: ic.itemId,
      itemName: ic.itemName,
      contributionPlus: 3 * ic.stdDev,
      contributionMinus: 3 * ic.stdDev,
      percentPlus: ic.percentContribution,
      percentMinus: ic.percentContribution,
    })),
    monteCarloResult: mc,
  };
}

const DirectionTab: React.FC<DirectionTabProps> = ({
  direction,
  toleranceMode,
  unit,
  calculationMode,
  analysisSettings,
  onDirectionChange,
}) => {
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [diagramOpen, setDiagramOpen] = useState(false);
  const [monteCarlo, setMonteCarlo] = useState<{ key: string; result: MonteCarloResult } | null>(null);
  const [monteCarloError, setMonteCarloError] = useState<string | null>(null);

  const { items, usl, lsl, targetNominal } = direction;
  const center = getStackCenter(items, targetNominal);
  const stackNominal = getStackNominal(items);
  const mcSettings = analysisSettings?.monteCarloSettings ?? DEFAULT_ANALYSIS_SETTINGS.monteCarloSettings!;

  // Deterministic modes are cheap, so compute them synchronously
  const deterministicResult = useMemo<RSSResult | null>(() => {
    if (items.length === 0 || calculationMode === 'monteCarlo') return null;
    const result = calculateTolerance(items, direction.id, direction.name, calculationMode);
    if (calculationMode === 'rss') {
      result.statistical = calculateCapability(result.totalPlus, center, usl, lsl);
    }
    return result;
  }, [items, direction.id, direction.name, calculationMode, center, usl, lsl]);

  // Only the fields that affect the simulation (not notes, images, ...)
  const monteCarloKey = useMemo(() => {
    if (calculationMode !== 'monteCarlo' || items.length === 0) return null;
    return JSON.stringify({
      items: items.map((i) => [i.id, i.name, i.tolerancePlus, i.toleranceMinus, i.floatFactor, i.distributionType]),
      mcSettings,
      usl,
      lsl,
      center,
    });
  }, [calculationMode, items, mcSettings, usl, lsl, center]);

  // Run Monte Carlo in a worker, debounced and cancelled when inputs change
  useEffect(() => {
    if (!monteCarloKey) return;
    let job: ReturnType<typeof startMonteCarlo> | null = null;
    const handle = setTimeout(() => {
      setMonteCarloError(null);
      job = startMonteCarlo({
        items: items.map(({ imageUrl, notes, source, ...rest }) => rest as ToleranceItem),
        directionId: direction.id,
        directionName: direction.name,
        settings: mcSettings,
        usl,
        lsl,
        center,
      });
      job.promise
        .then((result) => setMonteCarlo({ key: monteCarloKey, result }))
        .catch((error: Error) => setMonteCarloError(error.message));
    }, MONTE_CARLO_DEBOUNCE_MS);

    return () => {
      clearTimeout(handle);
      job?.cancel();
    };
    // monteCarloKey captures every input the simulation depends on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monteCarloKey]);

  const isCalculating = monteCarloKey !== null && monteCarlo?.key !== monteCarloKey && !monteCarloError;

  let result: RSSResult | null = deterministicResult;
  if (calculationMode === 'monteCarlo' && monteCarlo && monteCarloKey) {
    result = monteCarloToResult(monteCarlo.result);
  }

  const update = (changes: Partial<Direction>) => onDirectionChange({ ...direction, ...changes });

  const limitsInverted = usl !== undefined && lsl !== undefined && usl <= lsl;

  return (
    <Box sx={{ py: 1 }}>
      <Box sx={{ mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              label="Tolerance Stack Description"
              value={direction.description || ''}
              onChange={(e) => update({ description: e.target.value })}
              fullWidth
              size="small"
              placeholder="e.g., Envelope height from base to top"
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={4} md={2}>
            <NumericField
              label={`Target Nominal (${unit})`}
              value={targetNominal}
              onChange={(value) => update({ targetNominal: value })}
              allowEmpty
              fullWidth
              size="small"
              placeholder={stackNominal.toString()}
              step={0.001}
              helperText={targetNominal === undefined ? `Blank = Σ nominals (${stackNominal.toFixed(3)})` : 'Target dimension'}
            />
          </Grid>
          <Grid item xs={12} sm={4} md={2}>
            <NumericField
              label={`USL (${unit})`}
              value={usl}
              onChange={(value) => update({ usl: value })}
              allowEmpty
              fullWidth
              size="small"
              placeholder="Upper Limit"
              step={0.01}
              error={limitsInverted}
              helperText="Upper spec limit"
            />
          </Grid>
          <Grid item xs={12} sm={4} md={2}>
            <NumericField
              label={`LSL (${unit})`}
              value={lsl}
              onChange={(value) => update({ lsl: value })}
              allowEmpty
              fullWidth
              size="small"
              placeholder="Lower Limit"
              step={0.01}
              error={limitsInverted}
              helperText="Lower spec limit"
            />
          </Grid>
        </Grid>
        {limitsInverted && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            USL ({usl}) should be greater than LSL ({lsl}).
          </Alert>
        )}
      </Box>
      <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
        <Button variant="outlined" startIcon={<CloudUploadIcon />} onClick={() => setCsvImportOpen(true)} size="small">
          Import from CSV
        </Button>
        <Button variant="outlined" startIcon={<AccountTreeIcon />} onClick={() => setDiagramOpen(true)} size="small">
          Open Stack Diagram
        </Button>
      </Box>
      {monteCarloError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Monte Carlo simulation failed: {monteCarloError}
        </Alert>
      )}
      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <ToleranceTable
            items={items}
            toleranceMode={toleranceMode}
            onItemsChange={(newItems) => update({ items: newItems })}
            calculationMode={calculationMode}
            useAdvancedDistributions={mcSettings.useAdvancedDistributions}
          />
        </Grid>
        <Grid item xs={12} md={5}>
          <ResultsDisplay
            result={result}
            directionName={direction.name}
            directionId={direction.id}
            items={items}
            unit={unit}
            center={center}
            stackNominal={stackNominal}
            targetNominal={targetNominal}
            usl={usl}
            lsl={lsl}
            calculationMode={calculationMode}
            analysisSettings={analysisSettings}
            isCalculating={isCalculating}
          />
        </Grid>
      </Grid>

      <Suspense fallback={null}>
        {csvImportOpen && (
          <CSVImportDialog
            open={csvImportOpen}
            onClose={() => setCsvImportOpen(false)}
            onImport={(importedItems: ToleranceItem[]) => update({ items: [...items, ...importedItems] })}
            isSymmetricMode={toleranceMode === 'symmetric'}
          />
        )}
        {diagramOpen && (
          <DiagramBuilderDialog
            open={diagramOpen}
            onClose={() => setDiagramOpen(false)}
            direction={direction}
            toleranceMode={toleranceMode}
            unit={unit}
            rssResult={result}
            onSave={onDirectionChange}
          />
        )}
      </Suspense>
    </Box>
  );
};

export default DirectionTab;
