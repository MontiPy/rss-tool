import React, { useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Collapse,
  Tooltip,
  LinearProgress,
  Button,
  Grid,
  Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import WarningIcon from '@mui/icons-material/Warning';
import TuneIcon from '@mui/icons-material/Tune';
import { RSSResult, ToleranceUnit, CalculationMode, AnalysisSettings, ToleranceItem } from '../types';
import { formatWithMultiUnit } from '../utils/rssCalculator';
import SensitivityAnalysisDialog from './SensitivityAnalysisDialog';
import { MONOSPACE_FONT } from '../App';

interface ResultsDisplayProps {
  result: RSSResult | null;
  directionName: string;
  directionId: string;
  items: ToleranceItem[];
  unit: ToleranceUnit;
  targetBudget?: number;
  calculationMode: CalculationMode;
  analysisSettings?: AnalysisSettings;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  result,
  directionName,
  directionId,
  items,
  unit,
  targetBudget,
  calculationMode,
  analysisSettings,
}) => {
  const [showContributions, setShowContributions] = useState(false);
  const [showStatistical, setShowStatistical] = useState(false);
  const [sensitivityOpen, setSensitivityOpen] = useState(false);

  const showMultiUnit = analysisSettings?.showMultiUnit || false;
  const secondaryUnit = analysisSettings?.secondaryUnit || 'inches';

  if (!result) {
    return (
      <Paper elevation={0} variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          <strong>{directionName}</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Add tolerance items to see results
        </Typography>
      </Paper>
    );
  }

  const { totalPlus, totalMinus, worstCasePlus, worstCaseMinus, itemContributions } = result;
  const isSymmetric = totalPlus === totalMinus;

  // Format value with multiple units if enabled
  const formatValue = (value: number) => {
    if (showMultiUnit && secondaryUnit) {
      return formatWithMultiUnit(value, unit, secondaryUnit);
    }
    return `${value.toFixed(4)} ${unit}`;
  };

  // Budget comparison logic
  const hasBudget = targetBudget !== undefined && targetBudget > 0;
  let budgetStatus: 'pass' | 'warning' | 'fail' = 'pass';
  let budgetUtilization = 0;

  if (hasBudget) {
    budgetUtilization = (totalPlus / targetBudget!) * 100;
    if (budgetUtilization > 100) {
      budgetStatus = 'fail';
    } else if (budgetUtilization > 90) {
      budgetStatus = 'warning';
    }
  }

  // Calculate percentage contributions and sort by size
  // Sum of all contributions (not RSS total) for percentage calculation
  const sumOfContributionsPlus = itemContributions.reduce((sum, c) => sum + c.contributionPlus, 0);
  const sumOfContributionsMinus = itemContributions.reduce((sum, c) => sum + c.contributionMinus, 0);

  const contributionsWithPercent = itemContributions.map((contribution) => {
    const percentPlus = sumOfContributionsPlus > 0 ? (contribution.contributionPlus / sumOfContributionsPlus) * 100 : 0;
    const percentMinus = sumOfContributionsMinus > 0 ? (contribution.contributionMinus / sumOfContributionsMinus) * 100 : 0;
    return {
      ...contribution,
      percentPlus,
      percentMinus,
    };
  }).sort((a, b) => b.percentPlus - a.percentPlus); // Sort by largest contribution first

  // Find the maximum percentage for scaling the bars
  const maxPercent = Math.max(...contributionsWithPercent.map((c) => c.percentPlus));

  return (
    <Paper elevation={0} variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle1">
          <strong>{directionName}</strong>
        </Typography>
        <Tooltip title="RSS = √(Σ((tolerance × float_factor)²)). Float factor = √3 ≈ 1.732 when checked, otherwise 1.0">
          <IconButton size="small">
            <HelpOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Box sx={{ mb: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            {calculationMode === 'rss' ? 'RSS (Statistical)' : 'Worst-Case (Arithmetic)'}
          </Typography>
          <Chip
            label={
              isSymmetric
                ? `±${formatValue(totalPlus)}`
                : `+${formatValue(totalPlus)} / -${formatValue(totalMinus)}`
            }
            color="primary"
            sx={{ fontWeight: 'bold', fontFamily: MONOSPACE_FONT }}
          />
        </Box>

        {/* Show comparison if we have both values calculated */}
        {worstCasePlus !== undefined && worstCaseMinus !== undefined && calculationMode === 'rss' && (
          <Box sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Worst-Case: ±{formatValue(worstCasePlus)}
            </Typography>
            <Typography variant="caption" color="success.main" sx={{ fontWeight: 'bold' }}>
              RSS saves: {formatValue(worstCasePlus - totalPlus)} ({((worstCasePlus - totalPlus) / worstCasePlus * 100).toFixed(1)}%)
            </Typography>
          </Box>
        )}

        {hasBudget && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Target: ±{targetBudget.toFixed(4)} {unit}
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <Chip
                size="small"
                label={`${budgetUtilization.toFixed(1)}% of budget`}
                color={budgetStatus === 'fail' ? 'error' : budgetStatus === 'warning' ? 'warning' : 'success'}
                icon={budgetStatus === 'fail' || budgetStatus === 'warning' ? <WarningIcon /> : undefined}
              />
            </Box>
            {budgetStatus === 'fail' && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                Exceeds target budget by {(totalPlus - targetBudget).toFixed(4)} {unit}
              </Typography>
            )}
          </Box>
        )}

        {/* Sensitivity Analysis Button */}
        {items.length > 1 && (
          <Box sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<TuneIcon />}
              onClick={() => setSensitivityOpen(true)}
              fullWidth
            >
              Sensitivity Analysis
            </Button>
          </Box>
        )}
      </Box>

      {/* Statistical Analysis Section */}
      {result.statistical && calculationMode === 'rss' && (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
              borderRadius: 1,
              px: 1,
              py: 0.5,
              mt: 2,
            }}
            onClick={() => setShowStatistical(!showStatistical)}
          >
            <Typography variant="caption" sx={{ flexGrow: 1 }}>
              <strong>Process Capability Analysis</strong>
            </Typography>
            <IconButton
              size="small"
              sx={{
                transform: showStatistical ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s',
              }}
            >
              <ExpandMoreIcon fontSize="small" />
            </IconButton>
          </Box>

          <Collapse in={showStatistical}>
            <Box sx={{ mt: 1, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block' }}>
                    Current 3σ RSS
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontFamily: MONOSPACE_FONT }}>
                    ±{formatValue(result.statistical.current3Sigma)}
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block' }}>
                    Current Process Capability (Cpk)
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={`Cpk = ${result.statistical.currentCpk.toFixed(2)}`}
                      color={
                        result.statistical.currentCpk >= 1.66
                          ? 'success'
                          : result.statistical.currentCpk >= 1.33
                          ? 'success'
                          : result.statistical.currentCpk >= 1.0
                          ? 'warning'
                          : 'error'
                      }
                      size="small"
                      icon={result.statistical.currentCpk < 1.33 ? <WarningIcon /> : undefined}
                      sx={{ fontFamily: MONOSPACE_FONT }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {result.statistical.currentCpk >= 1.66
                        ? 'Highly capable (≥1.66)'
                        : result.statistical.currentCpk >= 1.33
                        ? 'Capable (≥1.33)'
                        : result.statistical.currentCpk >= 1.0
                        ? 'Marginally capable (≥1.0)'
                        : 'Incapable (<1.0)'}
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block' }}>
                    Estimated Yield
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={`${result.statistical.currentYield.toFixed(2)}%`}
                      color={
                        result.statistical.currentYield >= 99.73
                          ? 'success'
                          : result.statistical.currentYield >= 95
                          ? 'warning'
                          : 'error'
                      }
                      size="small"
                      sx={{ fontFamily: MONOSPACE_FONT }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      of parts meet target specification
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 1 }}>
                    Capability Targets
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block' }}>
                    Required 3σ for Cpk = 1.33 (Capable Process)
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontFamily: MONOSPACE_FONT }}>
                    ±{formatValue(result.statistical.required3SigmaFor1_33Cpk)}
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block' }}>
                    Required 3σ for Cpk = 1.66 (Highly Capable Process)
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontFamily: MONOSPACE_FONT }}>
                    ±{formatValue(result.statistical.required3SigmaFor1_66Cpk)}
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    Note: Analysis assumes input tolerances are 3σ values and normal distribution
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </>
      )}

      {itemContributions.length > 1 && (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
              borderRadius: 1,
              px: 1,
              py: 0.5
            }}
            onClick={() => setShowContributions(!showContributions)}
          >
            <Typography variant="caption" sx={{ flexGrow: 1 }}>
              <strong>Individual Contributions</strong>
            </Typography>
            <IconButton
              size="small"
              sx={{
                transform: showContributions ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s',
              }}
            >
              <ExpandMoreIcon fontSize="small" />
            </IconButton>
          </Box>

          <Collapse in={showContributions}>
            <TableContainer sx={{ mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Item</strong></TableCell>
                    <TableCell align="right">
                      <strong>{isSymmetric ? 'Value' : 'Value (+)'}</strong>
                    </TableCell>
                    {!isSymmetric && (
                      <TableCell align="right"><strong>Value (-)</strong></TableCell>
                    )}
                    <TableCell align="right"><strong>% of Total</strong></TableCell>
                    <TableCell sx={{ width: '30%' }}><strong>Impact</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {contributionsWithPercent.map((contribution) => {
                    const threshold = analysisSettings?.contributionThreshold || 40;
                    const isHighImpact = contribution.percentPlus > threshold;
                    return (
                      <TableRow key={contribution.itemId}>
                        <TableCell sx={{ py: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {isHighImpact && (
                              <Tooltip title={`High impact item (>${threshold}% of total)`}>
                                <WarningIcon fontSize="small" color="warning" />
                              </Tooltip>
                            )}
                            {contribution.itemName}
                          </Box>
                        </TableCell>
                        <TableCell align="right" sx={{ py: 0.5 }}>
                          {contribution.contributionPlus.toFixed(3)}
                        </TableCell>
                        {!isSymmetric && (
                          <TableCell align="right" sx={{ py: 0.5 }}>
                            {contribution.contributionMinus.toFixed(3)}
                          </TableCell>
                        )}
                        <TableCell align="right" sx={{ py: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: isHighImpact ? 'bold' : 'normal' }}>
                            {contribution.percentPlus.toFixed(1)}%
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                            <LinearProgress
                              variant="determinate"
                              value={(contribution.percentPlus / maxPercent) * 100}
                              sx={{
                                width: '100%',
                                height: 8,
                                borderRadius: 1,
                                bgcolor: 'action.hover',
                                '& .MuiLinearProgress-bar': {
                                  bgcolor: isHighImpact ? 'warning.main' : 'primary.main',
                                },
                              }}
                            />
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Collapse>
        </>
      )}

      <SensitivityAnalysisDialog
        open={sensitivityOpen}
        onClose={() => setSensitivityOpen(false)}
        items={items}
        unit={unit}
        calculationMode={calculationMode}
        originalTotal={totalPlus}
        directionId={directionId}
        directionName={directionName}
        analysisSettings={analysisSettings}
      />
    </Paper>
  );
};

export default ResultsDisplay;
