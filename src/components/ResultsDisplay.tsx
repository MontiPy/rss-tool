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
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  TextField,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import WarningIcon from '@mui/icons-material/Warning';
import TuneIcon from '@mui/icons-material/Tune';
import SettingsIcon from '@mui/icons-material/Settings';
import RefreshIcon from '@mui/icons-material/Refresh';
import { RSSResult, ToleranceUnit, CalculationMode, AnalysisSettings, ToleranceItem } from '../types';
import { formatWithMultiUnit, generateRSSDistribution } from '../utils/rssCalculator';
import SensitivityAnalysisDialog from './SensitivityAnalysisDialog';
import { MONOSPACE_FONT } from '../App';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Line,
  Area,
} from 'recharts';

interface ResultsDisplayProps {
  result: RSSResult | null;
  directionName: string;
  directionId: string;
  items: ToleranceItem[];
  unit: ToleranceUnit;
  targetNominal?: number; // Target nominal dimension (defaults to 0)
  usl?: number; // Upper Specification Limit
  lsl?: number; // Lower Specification Limit
  calculationMode: CalculationMode;
  analysisSettings?: AnalysisSettings;
  isCalculating?: boolean;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  result,
  directionName,
  directionId,
  items,
  unit,
  targetNominal = 0,
  usl,
  lsl,
  calculationMode,
  analysisSettings,
  isCalculating = false,
}) => {
  const [showContributions, setShowContributions] = useState(false);
  const [showStatistical, setShowStatistical] = useState(false);
  const [sensitivityOpen, setSensitivityOpen] = useState(false);
  const [showItemHistograms, setShowItemHistograms] = useState(false);
  const [showDistribution, setShowDistribution] = useState(false);
  const [chartSettingsOpen, setChartSettingsOpen] = useState(false);
  const [autoRange, setAutoRange] = useState(true); // Auto range toggle
  const [manualMin, setManualMin] = useState<string>(''); // Manual min value
  const [manualMax, setManualMax] = useState<string>(''); // Manual max value
  const [autoTicks, setAutoTicks] = useState(true); // Auto tick increment
  const [tickIncrement, setTickIncrement] = useState<number>(0.1); // Manual tick increment

  const showMultiUnit = analysisSettings?.showMultiUnit || false;
  const secondaryUnit = analysisSettings?.secondaryUnit || 'inches';

  // Calculate x-axis domain based on user settings
  const calculateXAxisDomain = (stdDev: number, usl?: number, lsl?: number, targetNominal: number = 0) => {
    // Manual mode - use user-specified values
    if (!autoRange && manualMin !== '' && manualMax !== '') {
      const min = parseFloat(manualMin);
      const max = parseFloat(manualMax);
      if (!isNaN(min) && !isNaN(max)) {
        return { min, max };
      }
    }

    // Auto mode - use spec-limit formula centered on target nominal: targetNominal±6σ, LSL-10% / USL+10%
    const sigmaRange = 6 * stdDev;
    let min = targetNominal - sigmaRange;
    let max = targetNominal + sigmaRange;

    if (lsl !== undefined) {
      // Extend LSL downward by 10%
      const lslExtended = lsl < 0 ? lsl * 1.1 : lsl * 0.9;
      min = Math.min(min, lslExtended);
    }

    if (usl !== undefined) {
      // Extend USL upward by 10%
      const uslExtended = usl > 0 ? usl * 1.1 : usl * 0.9;
      max = Math.max(max, uslExtended);
    }

    return { min, max };
  };

  // Calculate optimal tick increment based on range
  const calculateTickIncrement = (min: number, max: number): number => {
    const range = max - min;
    const targetTicks = 8; // Aim for ~8 ticks across the range

    // Calculate ideal increment
    const rawIncrement = range / targetTicks;

    // Round to nearest "nice" increment (0.1, 0.25, 0.5, 1.0, 2.5, 5.0, etc.)
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawIncrement)));
    const normalized = rawIncrement / magnitude;

    let niceIncrement;
    if (normalized < 1.5) {
      niceIncrement = 1.0;
    } else if (normalized < 3) {
      niceIncrement = 2.5;
    } else if (normalized < 7) {
      niceIncrement = 5.0;
    } else {
      niceIncrement = 10.0;
    }

    const finalIncrement = niceIncrement * magnitude;

    // Prefer common increments for small ranges
    if (finalIncrement <= 0.1) return 0.1;
    if (finalIncrement <= 0.25) return 0.25;
    if (finalIncrement <= 0.5) return 0.5;
    if (finalIncrement <= 1.0) return 1.0;

    return finalIncrement;
  };

  // Get tick increment (auto or manual)
  const getTickIncrement = (min: number, max: number): number => {
    if (autoTicks) {
      return calculateTickIncrement(min, max);
    }
    return tickIncrement;
  };

  // Reset zoom to auto range
  const handleResetZoom = () => {
    setAutoRange(true);
    setManualMin('');
    setManualMax('');
    setAutoTicks(true);
  };

  // Show loading indicator for Monte Carlo
  if (isCalculating) {
    return (
      <Paper elevation={0} variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          <strong>{directionName}</strong>
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 3 }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">
            Running Monte Carlo simulation...
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ({analysisSettings?.monteCarloSettings?.iterations?.toLocaleString() || '50,000'} iterations)
          </Typography>
        </Box>
      </Paper>
    );
  }

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

  // Specification limit comparison logic
  const hasUSL = usl !== undefined;
  const hasLSL = lsl !== undefined;
  const hasLimits = hasUSL || hasLSL;

  let specStatus: 'pass' | 'warning' | 'fail' = 'pass';
  let uslUtilization = 0;
  let lslUtilization = 0;
  let exceedsUSL = false;
  let exceedsLSL = false;

  if (hasUSL) {
    const uslMagnitude = Math.abs(usl!);
    uslUtilization = (totalPlus / uslMagnitude) * 100;
    exceedsUSL = totalPlus > uslMagnitude;
    if (uslUtilization > 100) {
      specStatus = 'fail';
    } else if (uslUtilization > 90) {
      specStatus = 'warning';
    }
  }

  if (hasLSL) {
    const lslMagnitude = Math.abs(lsl!);
    lslUtilization = (totalMinus / lslMagnitude) * 100;
    exceedsLSL = totalMinus > lslMagnitude;
    if (lslUtilization > 100) {
      specStatus = 'fail';
    } else if (lslUtilization > 90 && specStatus === 'pass') {
      specStatus = 'warning';
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
            {calculationMode === 'monteCarlo'
              ? 'Monte Carlo (±3σ, 99.7% confidence)'
              : calculationMode === 'rss'
              ? 'RSS (Statistical)'
              : 'Worst-Case (Arithmetic)'}
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

        {hasLimits && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Specification Limits:
            </Typography>
            {hasUSL && (
              <Box sx={{ mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  USL: +{usl!.toFixed(4)} {unit}
                </Typography>
                <Chip
                  size="small"
                  label={`${uslUtilization.toFixed(1)}% of USL`}
                  color={exceedsUSL ? 'error' : uslUtilization > 90 ? 'warning' : 'success'}
                  icon={exceedsUSL || uslUtilization > 90 ? <WarningIcon /> : undefined}
                  sx={{ mr: 0.5 }}
                />
                {exceedsUSL && (
                  <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                    Exceeds USL by {(totalPlus - usl!).toFixed(4)} {unit}
                  </Typography>
                )}
              </Box>
            )}
            {hasLSL && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  LSL: {lsl!.toFixed(4)} {unit}
                </Typography>
                <Chip
                  size="small"
                  label={`${lslUtilization.toFixed(1)}% of LSL`}
                  color={exceedsLSL ? 'error' : lslUtilization > 90 ? 'warning' : 'success'}
                  icon={exceedsLSL || lslUtilization > 90 ? <WarningIcon /> : undefined}
                />
                {exceedsLSL && (
                  <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                    Exceeds LSL by {(totalMinus - Math.abs(lsl!)).toFixed(4)} {unit}
                  </Typography>
                )}
              </Box>
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

      {/* RSS Distribution Visualization */}
      {calculationMode === 'rss' && result && (
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
            onClick={() => setShowDistribution(!showDistribution)}
          >
            <Typography variant="caption" sx={{ flexGrow: 1 }}>
              <strong>Distribution Visualization</strong>
            </Typography>
            <IconButton
              size="small"
              sx={{
                transform: showDistribution ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s',
              }}
            >
              <ExpandMoreIcon fontSize="small" />
            </IconButton>
          </Box>

          <Collapse in={showDistribution}>
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontStyle: 'italic' }}>
                Theoretical normal distribution (RSS = ±3σ)
              </Typography>

              {(() => {
                // Calculate x-axis domain
                const tempStdDev = totalPlus / 3;
                const domain = calculateXAxisDomain(tempStdDev, usl, lsl, targetNominal);

                // Generate RSS distribution curve with custom range, centered on target nominal
                const rssData = generateRSSDistribution(totalPlus, targetNominal, usl, lsl, 500, domain.min, domain.max);

                return (
                  <>
                    {/* Risk Analysis */}
                    {rssData.riskAnalysis && (
                      <Paper elevation={0} variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: 'warning.light' }}>
                        <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 1 }}>
                          Risk Analysis (Theoretical)
                        </Typography>
                        {rssData.riskAnalysis.usl !== undefined && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Chip
                              size="small"
                              label={`${(rssData.riskAnalysis.probabilityExceedingUSL * 100).toFixed(2)}%`}
                              color={rssData.riskAnalysis.probabilityExceedingUSL > 0.05 ? 'error' : 'success'}
                              sx={{ fontFamily: MONOSPACE_FONT }}
                            />
                            <Typography variant="caption">
                              probability of exceeding USL
                            </Typography>
                          </Box>
                        )}
                        {rssData.riskAnalysis.lsl !== undefined && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Chip
                              size="small"
                              label={`${(rssData.riskAnalysis.probabilityExceedingLSL * 100).toFixed(2)}%`}
                              color={rssData.riskAnalysis.probabilityExceedingLSL > 0.05 ? 'error' : 'success'}
                              sx={{ fontFamily: MONOSPACE_FONT }}
                            />
                            <Typography variant="caption">
                              probability of exceeding LSL
                            </Typography>
                          </Box>
                        )}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Chip
                            size="small"
                            label={`${(rssData.riskAnalysis.probabilityOutOfSpec * 100).toFixed(2)}%`}
                            color={rssData.riskAnalysis.probabilityOutOfSpec > 0.05 ? 'error' : 'success'}
                            sx={{ fontFamily: MONOSPACE_FONT }}
                          />
                          <Typography variant="caption">
                            total probability out of spec
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          Expected defect rate: {rssData.riskAnalysis.expectedDefectRate.toFixed(0)} PPM
                        </Typography>
                      </Paper>
                    )}

                    {/* Normal Distribution Curve */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                        Normal Distribution (μ = 0, σ = {rssData.stdDev.toFixed(4)} {unit})
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => setChartSettingsOpen(true)}
                        sx={{ p: 0.5 }}
                      >
                        <SettingsIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <Paper elevation={0} variant="outlined" sx={{ p: 2, mb: 2 }}>
                      <ResponsiveContainer width="100%" height={300}>
                        <ComposedChart
                          data={rssData.curveData}
                          margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                        >
                          <defs>
                            {/* Gradient for acceptance region (green) */}
                            <linearGradient id="acceptanceRegion" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#4caf50" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#4caf50" stopOpacity={0.1} />
                            </linearGradient>
                            {/* Pattern for rejection regions (red hatched) */}
                            <pattern id="rejectionPattern" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                              <rect width="2" height="8" fill="rgba(211, 47, 47, 0.3)" />
                            </pattern>
                          </defs>

                          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                          <XAxis
                            dataKey="x"
                            type="number"
                            domain={[rssData.minX, rssData.maxX]}
                            ticks={(() => {
                              const increment = getTickIncrement(rssData.minX, rssData.maxX);
                              const ticks = [];
                              const start = Math.ceil(rssData.minX / increment) * increment;
                              for (let i = start; i <= rssData.maxX; i += increment) {
                                ticks.push(Number(i.toFixed(10))); // Avoid floating point errors
                              }
                              return ticks;
                            })()}
                            tickFormatter={(value) => value.toFixed(3)}
                            label={{ value: `Tolerance (${unit})`, position: 'insideBottom', offset: 0 }}
                            tick={{ fontSize: 10 }}
                          />
                          <YAxis tick={false} />
                          <RechartsTooltip
                            formatter={(value: number) => [(value * 100).toFixed(4) + '%', 'Density']}
                            labelFormatter={(value) => `x = ${Number(value).toFixed(4)}`}
                          />

                          {/* Shaded acceptance region (between LSL and USL) */}
                          {hasLimits && (
                            <Area
                              type="monotone"
                              dataKey={(data: any) => {
                                const x = data.x;
                                const withinLimits =
                                  (lsl === undefined || x >= lsl) &&
                                  (usl === undefined || x <= usl);
                                return withinLimits ? data.pdf : 0;
                              }}
                              fill="url(#acceptanceRegion)"
                              stroke="none"
                              isAnimationActive={false}
                            />
                          )}

                          {/* Normal distribution curve */}
                          <Line
                            type="monotone"
                            dataKey="pdf"
                            stroke="#1976d2"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                          />

                          {/* Reference lines */}
                          {hasUSL && (
                            <ReferenceLine
                              x={usl}
                              stroke="#d62728"
                              strokeDasharray="4 4"
                              strokeWidth={1.5}
                              label={{ value: 'USL', position: 'top', fill: '#d62728', fontSize: 11, fontWeight: 'bold' }}
                            />
                          )}
                          {hasLSL && (
                            <ReferenceLine
                              x={lsl}
                              stroke="#d62728"
                              strokeDasharray="4 4"
                              strokeWidth={1.5}
                              label={{ value: 'LSL', position: 'top', fill: '#d62728', fontSize: 11, fontWeight: 'bold' }}
                            />
                          )}
                          <ReferenceLine
                            x={0}
                            stroke="#2ca02c"
                            strokeDasharray="2 2"
                            strokeWidth={1.5}
                            label={{ value: 'μ', position: 'top', fill: '#2ca02c', fontSize: 11 }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                        Assuming RSS total = ±3σ (99.7% confidence interval)
                      </Typography>
                    </Paper>
                  </>
                );
              })()}
            </Box>
          </Collapse>
        </>
      )}

      {/* Monte Carlo Results */}
      {result.monteCarloResult && calculationMode === 'monteCarlo' && (
        <Box sx={{ mt: 2 }}>

              {/* Percentile Summary Table */}
              <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 1 }}>
                Distribution Statistics
              </Typography>
          <Paper elevation={0} variant="outlined" sx={{ p: 1, mb: 2 }}>
            <Grid container spacing={1}>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">5th Percentile</Typography>
                <Typography variant="body2" sx={{ fontFamily: MONOSPACE_FONT }}>
                  {formatValue(result.monteCarloResult.percentiles.p5)}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">Median (50th)</Typography>
                <Typography variant="body2" sx={{ fontFamily: MONOSPACE_FONT }}>
                  {formatValue(result.monteCarloResult.percentiles.p50)}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">95th Percentile</Typography>
                <Typography variant="body2" sx={{ fontFamily: MONOSPACE_FONT, fontWeight: 'bold' }}>
                  {formatValue(result.monteCarloResult.percentiles.p95)}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">99th Percentile</Typography>
                <Typography variant="body2" sx={{ fontFamily: MONOSPACE_FONT }}>
                  {formatValue(result.monteCarloResult.percentiles.p99)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Mean</Typography>
                <Typography variant="body2" sx={{ fontFamily: MONOSPACE_FONT }}>
                  {formatValue(result.monteCarloResult.percentiles.mean)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Std Deviation</Typography>
                <Typography variant="body2" sx={{ fontFamily: MONOSPACE_FONT }}>
                  {formatValue(result.monteCarloResult.percentiles.stdDev)}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* Risk Analysis (if limits exist) */}
          {result.monteCarloResult.riskAnalysis && (
            <Paper elevation={0} variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: 'warning.light' }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 1 }}>
                Risk Analysis
              </Typography>
              {result.monteCarloResult.riskAnalysis.usl !== undefined && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Chip
                    size="small"
                    label={`${(result.monteCarloResult.riskAnalysis.probabilityExceedingUSL * 100).toFixed(2)}%`}
                    color={result.monteCarloResult.riskAnalysis.probabilityExceedingUSL > 0.05 ? 'error' : 'success'}
                    sx={{ fontFamily: MONOSPACE_FONT }}
                  />
                  <Typography variant="caption">
                    probability of exceeding USL
                  </Typography>
                </Box>
              )}
              {result.monteCarloResult.riskAnalysis.lsl !== undefined && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Chip
                    size="small"
                    label={`${(result.monteCarloResult.riskAnalysis.probabilityExceedingLSL * 100).toFixed(2)}%`}
                    color={result.monteCarloResult.riskAnalysis.probabilityExceedingLSL > 0.05 ? 'error' : 'success'}
                    sx={{ fontFamily: MONOSPACE_FONT }}
                  />
                  <Typography variant="caption">
                    probability of exceeding LSL
                  </Typography>
                </Box>
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Chip
                  size="small"
                  label={`${(result.monteCarloResult.riskAnalysis.probabilityOutOfSpec * 100).toFixed(2)}%`}
                  color={result.monteCarloResult.riskAnalysis.probabilityOutOfSpec > 0.05 ? 'error' : 'success'}
                  sx={{ fontFamily: MONOSPACE_FONT }}
                />
                <Typography variant="caption">
                  total probability out of spec
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Expected defect rate: {result.monteCarloResult.riskAnalysis.expectedDefectRate.toFixed(0)} PPM
              </Typography>
            </Paper>
          )}

          {/* Final Stack Histogram */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
              Final Tolerance Stack Distribution
            </Typography>
            <IconButton
              size="small"
              onClick={() => setChartSettingsOpen(true)}
              sx={{ p: 0.5 }}
            >
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Box>
          <Paper elevation={0} variant="outlined" sx={{ p: 2, mb: 2 }}>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={(() => {
                // Calculate viewport domain based on user settings
                const std = result.monteCarloResult.percentiles.stdDev;
                const viewportDomain = calculateXAxisDomain(std, usl, lsl);

                // Generate histogram bins (filtered to viewport) - show actual distribution shape
                const histogramData = result.monteCarloResult.histogram
                  .filter(bin => bin.binCenter >= viewportDomain.min && bin.binCenter <= viewportDomain.max)
                  .map(bin => ({
                    x: bin.binCenter,
                    frequency: bin.frequency,
                    count: bin.count,
                  }));

                return histogramData;
              })()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis
                  dataKey="x"
                  type="number"
                  domain={[(() => {
                    const std = result.monteCarloResult.percentiles.stdDev;
                    const domain = calculateXAxisDomain(std, usl, lsl);
                    return domain.min;
                  })(), (() => {
                    const std = result.monteCarloResult.percentiles.stdDev;
                    const domain = calculateXAxisDomain(std, usl, lsl);
                    return domain.max;
                  })()]}
                  ticks={(() => {
                    const std = result.monteCarloResult.percentiles.stdDev;
                    const domain = calculateXAxisDomain(std, usl, lsl);
                    const increment = getTickIncrement(domain.min, domain.max);
                    const ticks = [];
                    const start = Math.ceil(domain.min / increment) * increment;
                    for (let i = start; i <= domain.max; i += increment) {
                      ticks.push(Number(i.toFixed(10))); // Avoid floating point errors
                    }
                    return ticks;
                  })()}
                  tickFormatter={(value) => value.toFixed(3)}
                  label={{ value: `Tolerance (${unit})`, position: 'insideBottom', offset: 0 }}
                  tick={{ fontSize: 10 }}
                />
                <YAxis tick={false} />
                <RechartsTooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'frequency') return [(value * 100).toFixed(2) + '%', 'Frequency'];
                    if (name === 'pdf') return [(value * 100).toFixed(2) + '%', 'PDF'];
                    return [value, name];
                  }}
                  labelFormatter={(value) => `x = ${Number(value).toFixed(4)}`}
                />
                <Bar dataKey="frequency" fill="rgba(150, 150, 150, 0.5)" />
                <Line
                  type="monotone"
                  dataKey="pdf"
                  stroke="#1976d2"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                {hasUSL && (
                  <ReferenceLine
                    x={usl}
                    stroke="#d62728"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{ value: 'USL', position: 'top', fill: '#d62728', fontSize: 11, fontWeight: 'bold' }}
                  />
                )}
                {hasLSL && (
                  <ReferenceLine
                    x={lsl}
                    stroke="#d62728"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{ value: 'LSL', position: 'top', fill: '#d62728', fontSize: 11, fontWeight: 'bold' }}
                  />
                )}
                <ReferenceLine
                  x={result.monteCarloResult.percentiles.mean}
                  stroke="#2ca02c"
                  strokeDasharray="2 2"
                  strokeWidth={1.5}
                  label={{ value: 'μ', position: 'top', fill: '#2ca02c', fontSize: 11 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
              {result.monteCarloResult.iterations.toLocaleString()} simulation iterations
            </Typography>
          </Paper>

          {/* Individual Item Histograms (Collapsible) */}
          {items.length > 1 && (
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
                onClick={() => setShowItemHistograms(!showItemHistograms)}
              >
                <Typography variant="caption" sx={{ flexGrow: 1 }}>
                  <strong>Individual Item Distributions</strong>
                </Typography>
                <IconButton
                  size="small"
                  sx={{
                    transform: showItemHistograms ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s',
                  }}
                >
                  <ExpandMoreIcon fontSize="small" />
                </IconButton>
              </Box>

              <Collapse in={showItemHistograms}>
                <Box sx={{ mt: 1 }}>
                  {items.map(item => {
                    const itemHistogram = result.monteCarloResult!.itemHistograms.get(item.id);
                    if (!itemHistogram) return null;

                    // Find item's contribution data (has mean and stdDev)
                    const itemContrib = result.monteCarloResult!.itemContributions.find(ic => ic.itemId === item.id);
                    if (!itemContrib) return null;

                    return (
                      <Paper key={item.id} elevation={0} variant="outlined" sx={{ p: 2, mb: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 1, display: 'block' }}>
                          {item.name}
                        </Typography>
                        <ResponsiveContainer width="100%" height={200}>
                          <ComposedChart data={(() => {
                            // Show actual distribution shape without curve assumption
                            const histData = itemHistogram.map(bin => ({
                              x: bin.binCenter,
                              frequency: bin.frequency,
                              count: bin.count,
                            }));
                            return histData;
                          })()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                            <XAxis
                              dataKey="x"
                              type="number"
                              domain={['dataMin', 'dataMax']}
                              ticks={(() => {
                                const itemHistogram = result.monteCarloResult!.itemHistograms.get(item.id);
                                if (!itemHistogram) return undefined;
                                const minX = Math.min(...itemHistogram.map((b) => b.binStart));
                                const maxX = Math.max(...itemHistogram.map((b) => b.binEnd));
                                const increment = getTickIncrement(minX, maxX);
                                const ticks = [];
                                const start = Math.ceil(minX / increment) * increment;
                                for (let i = start; i <= maxX; i += increment) {
                                  ticks.push(Number(i.toFixed(10)));
                                }
                                return ticks;
                              })()}
                              tickFormatter={(value) => value.toFixed(3)}
                              tick={{ fontSize: 10 }}
                            />
                            <YAxis tick={false} />
                            <RechartsTooltip
                              formatter={(value: number, name: string) => {
                                if (name === 'frequency') return [(value * 100).toFixed(2) + '%', 'Frequency'];
                                return [value, name];
                              }}
                              labelFormatter={(value) => `x = ${Number(value).toFixed(4)}`}
                            />
                            <Bar dataKey="frequency" fill="rgba(150, 150, 150, 0.5)" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </Paper>
                    );
                  })}
                </Box>
              </Collapse>
            </>
          )}
        </Box>
      )}

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

      {/* Chart Settings Dialog */}
      <Dialog
        open={chartSettingsOpen}
        onClose={() => setChartSettingsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Chart Display
            <Tooltip title="Auto uses max(μ±6σ, LSL-10% / USL+10%)">
              <HelpOutlineIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            </Tooltip>
          </Box>
        </DialogTitle>
        <DialogContent>
          {/* Viewport Range Section */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                Viewport Range
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ mr: 1 }}>
                  Auto Range
                </Typography>
                <Switch
                  checked={autoRange}
                  onChange={(e) => setAutoRange(e.target.checked)}
                  size="small"
                />
              </Box>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Min"
                  value={manualMin}
                  onChange={(e) => setManualMin(e.target.value)}
                  disabled={autoRange}
                  fullWidth
                  size="small"
                  type="number"
                  inputProps={{ step: 0.01 }}
                  placeholder={autoRange ? 'Auto' : 'Enter min'}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Max"
                  value={manualMax}
                  onChange={(e) => setManualMax(e.target.value)}
                  disabled={autoRange}
                  fullWidth
                  size="small"
                  type="number"
                  inputProps={{ step: 0.01 }}
                  placeholder={autoRange ? 'Auto' : 'Enter max'}
                />
              </Grid>
            </Grid>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Auto uses max(μ±6σ, LSL-10% / USL+10%)
            </Typography>

            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleResetZoom}
              fullWidth
              sx={{ mt: 2 }}
              size="small"
            >
              Reset Zoom
            </Button>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Tick Increment Section */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                X-Axis Tick Increment
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ mr: 1 }}>
                  Auto
                </Typography>
                <Switch
                  checked={autoTicks}
                  onChange={(e) => setAutoTicks(e.target.checked)}
                  size="small"
                />
              </Box>
            </Box>

            <TextField
              label="Tick Increment"
              value={tickIncrement}
              onChange={(e) => setTickIncrement(parseFloat(e.target.value) || 0.1)}
              disabled={autoTicks}
              fullWidth
              size="small"
              type="number"
              inputProps={{ step: 0.01, min: 0.01 }}
              placeholder={autoTicks ? 'Auto' : 'e.g., 0.1, 0.25, 0.5, 1.0'}
              helperText={autoTicks ? 'Auto selects from: 0.1, 0.25, 0.5, 1.0, 2.5, 5.0...' : 'Custom increment value'}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChartSettingsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default ResultsDisplay;
