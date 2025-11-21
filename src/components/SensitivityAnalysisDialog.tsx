import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Slider,
  Paper,
  Grid,
  Chip,
  IconButton,
  Alert,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RestoreIcon from '@mui/icons-material/Restore';
import { ToleranceItem, ToleranceUnit, CalculationMode, AnalysisSettings } from '../types';
import { calculateTolerance } from '../utils/rssCalculator';

interface SensitivityAnalysisDialogProps {
  open: boolean;
  onClose: () => void;
  items: ToleranceItem[];
  unit: ToleranceUnit;
  calculationMode: CalculationMode;
  originalTotal: number;
  directionId: string;
  directionName: string;
  analysisSettings?: AnalysisSettings;
}

interface AdjustedItem extends ToleranceItem {
  originalTolerancePlus: number;
  originalToleranceMinus: number;
  adjustmentValue: number; // Absolute adjustment value (not percentage)
}

const SensitivityAnalysisDialog: React.FC<SensitivityAnalysisDialogProps> = ({
  open,
  onClose,
  items,
  unit,
  calculationMode,
  originalTotal,
  directionId,
  directionName,
  analysisSettings,
}) => {
  const [adjustedItems, setAdjustedItems] = useState<AdjustedItem[]>([]);
  const [currentTotal, setCurrentTotal] = useState(originalTotal);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const increment = analysisSettings?.sensitivityIncrement || 0.1;

  // Initialize adjusted items when dialog opens
  useEffect(() => {
    if (open) {
      const initialized = items.map((item) => ({
        ...item,
        originalTolerancePlus: item.tolerancePlus,
        originalToleranceMinus: item.toleranceMinus,
        adjustmentValue: 0,
      }));
      setAdjustedItems(initialized);
      setSelectedItemId(items[0]?.id || null);
      setCurrentTotal(originalTotal);
    }
  }, [open, items, originalTotal]);

  // Recalculate RSS when adjustments change
  useEffect(() => {
    if (adjustedItems.length > 0) {
      const result = calculateTolerance(adjustedItems, directionId, directionName, calculationMode);
      setCurrentTotal(result.totalPlus);
    }
  }, [adjustedItems, directionId, directionName, calculationMode]);

  const handleAdjustment = (itemId: string, adjustmentValue: number) => {
    setAdjustedItems(
      adjustedItems.map((item) => {
        if (item.id === itemId) {
          // Ensure tolerances never go below 0
          const newTolerancePlus = Math.max(0, item.originalTolerancePlus + adjustmentValue);
          const newToleranceMinus = Math.max(0, item.originalToleranceMinus + adjustmentValue);

          // Limit adjustment if it would cause negative tolerance
          const maxNegativeAdjustment = Math.max(-item.originalTolerancePlus, -item.originalToleranceMinus);
          const clampedAdjustment = Math.max(maxNegativeAdjustment, adjustmentValue);

          return {
            ...item,
            tolerancePlus: newTolerancePlus,
            toleranceMinus: newToleranceMinus,
            adjustmentValue: clampedAdjustment,
          };
        }
        return item;
      })
    );
  };

  const handleResetItem = (itemId: string) => {
    handleAdjustment(itemId, 0);
  };

  const handleResetAll = () => {
    setAdjustedItems(
      adjustedItems.map((item) => ({
        ...item,
        tolerancePlus: item.originalTolerancePlus,
        toleranceMinus: item.originalToleranceMinus,
        adjustmentValue: 0,
      }))
    );
  };

  const totalChange = currentTotal - originalTotal;
  const totalChangePercent = originalTotal > 0.0001 ? (totalChange / originalTotal) * 100 : null;

  // Calculate sensitivity (how much RSS changes per increment)
  const calculateSensitivity = (item: AdjustedItem): number => {
    // Create a copy with one increment increase
    const testItems = adjustedItems.map((i) => {
      if (i.id === item.id) {
        return {
          ...i,
          tolerancePlus: i.originalTolerancePlus + increment,
          toleranceMinus: i.originalToleranceMinus + increment,
        };
      }
      return i;
    });

    const result = calculateTolerance(testItems, directionId, directionName, calculationMode);
    const change = result.totalPlus - originalTotal;
    return change; // Sensitivity per increment
  };

  const selectedItem = adjustedItems.find((item) => item.id === selectedItemId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Sensitivity Analysis
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>
          Adjust tolerance values to see their impact on the total RSS. This helps identify optimization opportunities.
        </Alert>

        <Grid container spacing={2}>
          {/* Summary Panel */}
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" gutterBottom>
                Current Total
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Chip
                  label={`${currentTotal.toFixed(4)} ${unit}`}
                  color={totalChange < 0 ? 'success' : totalChange > 0 ? 'error' : 'default'}
                  sx={{ fontWeight: 'bold', fontSize: '1rem' }}
                />
                <Typography variant="body2" color="text.secondary">
                  Original: {originalTotal.toFixed(4)} {unit}
                </Typography>
                {Math.abs(totalChange) > 0.0001 && (
                  <>
                    <Typography
                      variant="body2"
                      sx={{
                        color: totalChange < 0 ? 'success.main' : 'error.main',
                        fontWeight: 'bold',
                      }}
                    >
                      {totalChange > 0 ? '+' : ''}
                      {totalChange.toFixed(4)} {unit}
                      {totalChangePercent !== null && (
                        <> ({totalChangePercent > 0 ? '+' : ''}{totalChangePercent.toFixed(1)}%)</>
                      )}
                    </Typography>
                    <Button
                      size="small"
                      startIcon={<RestoreIcon />}
                      onClick={handleResetAll}
                      variant="outlined"
                    >
                      Reset All
                    </Button>
                  </>
                )}
              </Box>
            </Paper>
          </Grid>

          {/* Item Selection List */}
          <Grid item xs={12} md={5}>
            <Typography variant="subtitle2" gutterBottom>
              Select Item to Adjust
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {adjustedItems.map((item) => {
                const sensitivity = calculateSensitivity(item);
                const isSelected = selectedItemId === item.id;
                const hasAdjustment = Math.abs(item.adjustmentValue) > 0.001;

                return (
                  <Paper
                    key={item.id}
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      cursor: 'pointer',
                      bgcolor: isSelected ? 'action.selected' : 'background.paper',
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      borderWidth: isSelected ? 2 : 1,
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                    onClick={() => setSelectedItemId(item.id)}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: isSelected ? 'bold' : 'normal' }}>
                          {item.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ±{item.originalTolerancePlus.toFixed(3)} {unit}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          • Sensitivity: {sensitivity.toFixed(4)}
                        </Typography>
                      </Box>
                      {hasAdjustment && (
                        <Chip
                          label={`${item.adjustmentValue > 0 ? '+' : ''}${item.adjustmentValue.toFixed(3)} ${unit}`}
                          size="small"
                          color={item.adjustmentValue < 0 ? 'success' : 'warning'}
                        />
                      )}
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          </Grid>

          {/* Adjustment Panel */}
          <Grid item xs={12} md={7}>
            {selectedItem && (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle2">
                    Adjust: {selectedItem.name}
                  </Typography>
                  {Math.abs(selectedItem.adjustmentValue) > 0.001 && (
                    <Button
                      size="small"
                      startIcon={<RestoreIcon />}
                      onClick={() => handleResetItem(selectedItem.id)}
                    >
                      Reset
                    </Button>
                  )}
                </Box>

                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">
                        Original Tolerance
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        ±{selectedItem.originalTolerancePlus.toFixed(4)} {unit}
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">
                        Adjusted Tolerance
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        ±{selectedItem.tolerancePlus.toFixed(4)} {unit}
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">
                        Adjustment Value
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                          {selectedItem.adjustmentValue > 0 ? '+' : ''}{selectedItem.adjustmentValue.toFixed(3)} {unit}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  <Divider sx={{ my: 2 }} />

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block' }}>
                      Direct Input
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Typography variant="body2">Adjust by:</Typography>
                      <input
                        type="number"
                        value={selectedItem.adjustmentValue.toFixed(3)}
                        onChange={(e) => handleAdjustment(selectedItem.id, parseFloat(e.target.value) || 0)}
                        step={increment}
                        min={-selectedItem.originalTolerancePlus}
                        title={`Minimum: ${(-selectedItem.originalTolerancePlus).toFixed(3)} (cannot go below 0 tolerance)`}
                        style={{
                          padding: '8px',
                          fontSize: '14px',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          width: '120px',
                        }}
                      />
                      <Typography variant="body2">{unit}</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      Range: {(-selectedItem.originalTolerancePlus).toFixed(3)} to unlimited (tolerance cannot go below 0)
                    </Typography>
                  </Box>

                  <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block' }}>
                    Or use slider (min: {(-selectedItem.originalTolerancePlus).toFixed(3)}, max: +5 {unit})
                  </Typography>
                  <Slider
                    value={selectedItem.adjustmentValue}
                    onChange={(_, value) => handleAdjustment(selectedItem.id, value as number)}
                    min={Math.max(-5, -selectedItem.originalTolerancePlus)}
                    max={5}
                    step={increment}
                    marks={[
                      { value: Math.max(-5, -selectedItem.originalTolerancePlus), label: Math.max(-5, -selectedItem.originalTolerancePlus).toFixed(1) },
                      { value: 0, label: '0' },
                      { value: 5, label: '+5' },
                    ]}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value > 0 ? '+' : ''}${value.toFixed(3)}`}
                    sx={{ mt: 4, mb: 2 }}
                  />

                  {selectedItem.tolerancePlus === 0 && (
                    <Alert severity="error" sx={{ mb: 1 }}>
                      <Typography variant="caption">
                        <strong>Warning:</strong> Tolerance is at minimum (0 {unit}). Cannot reduce further.
                      </Typography>
                    </Alert>
                  )}

                  <Alert severity={selectedItem.adjustmentValue < 0 ? 'success' : selectedItem.adjustmentValue > 0 ? 'warning' : 'info'}>
                    {selectedItem.adjustmentValue === 0 && (
                      <Typography variant="caption">
                        Use the slider to adjust this tolerance and see the impact on the total RSS.
                      </Typography>
                    )}
                    {selectedItem.adjustmentValue < 0 && selectedItem.tolerancePlus > 0 && (
                      <Typography variant="caption">
                        <strong>Tightening tolerance</strong> by {Math.abs(selectedItem.adjustmentValue).toFixed(3)} {unit} reduces the total RSS.
                      </Typography>
                    )}
                    {selectedItem.adjustmentValue > 0 && (
                      <Typography variant="caption">
                        <strong>Loosening tolerance</strong> by {selectedItem.adjustmentValue.toFixed(3)} {unit} increases the total RSS.
                      </Typography>
                    )}
                  </Alert>

                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block' }}>
                      Sensitivity Analysis
                    </Typography>
                    <Typography variant="body2">
                      A {increment.toFixed(3)} {unit} change in this tolerance causes a <strong>{calculateSensitivity(selectedItem).toFixed(4)} {unit}</strong> change in total RSS.
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Higher sensitivity = greater impact on total tolerance stack
                    </Typography>
                  </Box>
                </Paper>
              </Box>
            )}
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default SensitivityAnalysisDialog;
