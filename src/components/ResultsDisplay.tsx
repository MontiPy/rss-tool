import React, { lazy, Suspense, useState } from 'react';
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
import {
  evaluateSpecLimit,
  formatWithMultiUnit,
  generateRSSDistribution,
  generateTicks,
} from '../utils/rssCalculator';
import { MONOSPACE_FONT } from '../theme';
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

const SensitivityAnalysisDialog = lazy(() => import('./SensitivityAnalysisDialog'));

const STATUS_COLOR = { pass: 'success', warning: 'warning', fail: 'error' } as const;

/** PPM with useful precision for very small defect rates */
const formatPPM = (ppm: number) =>
  ppm === 0 ? '0' : ppm < 1 ? ppm.toPrecision(2) : Math.round(ppm).toLocaleString();

const formatIndex = (value: number | undefined) =>
  value === undefined ? '—' : Number.isFinite(value) ? value.toFixed(2) : value > 0 ? '∞' : '−∞';

interface ResultsDisplayProps {
  result: RSSResult | null;
  directionName: string;
  directionId: string;
  items: ToleranceItem[];
  unit: ToleranceUnit;
  center: number; // Stack center: target nominal if set, otherwise Σ item nominals
  stackNominal: number; // Σ item nominals
  targetNominal?: number; // User-defined target nominal
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
  center,
  stackNominal,
  targetNominal,
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
  const calculateXAxisDomain = (stdDev: number, usl: number | undefined, lsl: number | undefined, mean: number) => {
    // Manual mode - use user-specified values
    if (!autoRange && manualMin !== '' && manualMax !== '') {
      const min = parseFloat(manualMin);
      const max = parseFloat(manualMax);
      if (!isNaN(min) && !isNaN(max) && max > min) {
        return { min, max };
      }
    }

    // Auto mode - cover μ ± 4σ and both spec limits, plus 10% padding
    const spread = 4 * stdDev || Math.max(Math.abs(mean) * 0.01, 1e-3);
    let min = mean - spread;
    let max = mean + spread;
    if (lsl !== undefined) min = Math.min(min, lsl);
    if (usl !== undefined) max = Math.max(max, usl);
    const pad = (max - min) * 0.1;
    return { min: min - pad, max: max + pad };
  };

  const getTicks = (min: number, max: number) => generateTicks(min, max, autoTicks ? undefined : tickIncrement);

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

  // Specification limit status, measured from the distribution center
  const statusCenter = result.monteCarloResult ? result.monteCarloResult.percentiles.mean : center;
  const hasUSL = usl !== undefined;
  const hasLSL = lsl !== undefined;
  const hasLimits = hasUSL || hasLSL;
  const uslStatus = hasUSL ? evaluateSpecLimit('upper', usl!, statusCenter, totalPlus) : null;
  const lslStatus = hasLSL ? evaluateSpecLimit('lower', lsl!, statusCenter, totalMinus) : null;
  const mcDomain = result.monteCarloResult
    ? calculateXAxisDomain(
        result.monteCarloResult.percentiles.stdDev,
        usl,
        lsl,
        result.monteCarloResult.percentiles.mean
      )
    : null;
  const formatUtilization = (u: number) => (Number.isFinite(u) ? `${u.toFixed(1)}%` : 'center outside');

  const showTargetMismatch =
    targetNominal !== undefined && items.some((i) => i.nominal) && Math.abs(stackNominal - targetNominal) > 1e-9;

  // Contributions sorted by size (percentages are computed by the calculator)
  const contributionsWithPercent = [...itemContributions].sort((a, b) => b.percentPlus - a.percentPlus);
  const percentLabel = calculationMode === 'worstCase' ? '% of Total' : '% of Variance';

  // Find the maximum percentage for scaling the bars
  const maxPercent = Math.max(...contributionsWithPercent.map((c) => c.percentPlus)) || 1;

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

        {/* Stack summary */}
        <Box sx={{ mt: 1, p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {result.monteCarloResult ? 'Simulated mean' : targetNominal !== undefined ? 'Target nominal' : 'Σ nominals'}
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: MONOSPACE_FONT }}>
                {statusCenter.toFixed(4)} {unit}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Predicted range
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: MONOSPACE_FONT }}>
                {(statusCenter - totalMinus).toFixed(4)} … {(statusCenter + totalPlus).toFixed(4)}
              </Typography>
            </Grid>
          </Grid>
          {showTargetMismatch && (
            <Typography variant="caption" color="warning.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
              <WarningIcon fontSize="inherit" />
              Σ item nominals ({stackNominal.toFixed(4)}) differs from target by {(stackNominal - targetNominal!).toFixed(4)} {unit}
            </Typography>
          )}
        </Box>

        {hasLimits && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Specification Limits:
            </Typography>
            {[
              { label: 'USL', status: uslStatus, total: totalPlus },
              { label: 'LSL', status: lslStatus, total: totalMinus },
            ].map(({ label, status }) =>
              status ? (
                <Box key={label} sx={{ mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {label}: {status.limit.toFixed(4)} {unit} (margin {status.margin.toFixed(4)})
                  </Typography>
                  <Tooltip title={`Uses ${formatUtilization(status.utilization)} of the margin between the stack center and ${label}`}>
                    <Chip
                      size="small"
                      label={`${formatUtilization(status.utilization)} of ${label} margin`}
                      color={STATUS_COLOR[status.status]}
                      icon={status.status !== 'pass' ? <WarningIcon /> : undefined}
                      sx={{ mr: 0.5 }}
                    />
                  </Tooltip>
                  {status.exceedsBy > 0 && (
                    <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                      Exceeds {label} by {status.exceedsBy.toFixed(4)} {unit}
                    </Typography>
                  )}
                </Box>
              ) : null
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
                const domain = calculateXAxisDomain(totalPlus / 3, usl, lsl, center);

                // Generate RSS distribution curve with custom range, centered on the stack center
                const rssData = generateRSSDistribution(totalPlus, center, usl, lsl, 500, domain.min, domain.max);

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
                          Expected defect rate: {formatPPM(rssData.riskAnalysis.expectedDefectRate)} PPM
                        </Typography>
                      </Paper>
                    )}

                    {/* Normal Distribution Curve */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                        Normal Distribution (μ = {rssData.mean.toFixed(3)}, σ = {rssData.stdDev.toFixed(4)} {unit})
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
                            ticks={getTicks(rssData.minX, rssData.maxX)}
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
                            x={rssData.mean}
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
                Expected defect rate: {formatPPM(result.monteCarloResult.riskAnalysis.expectedDefectRate)} PPM
                {result.monteCarloResult.riskAnalysis.probabilityOutOfSpec === 0 && (
                  <> (no samples out of spec — use RSS mode for a theoretical tail estimate)</>
                )}
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
                const { stdDev: std, mean } = result.monteCarloResult.percentiles;
                const viewportDomain = calculateXAxisDomain(std, usl, lsl, mean);

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
                  domain={[mcDomain!.min, mcDomain!.max]}
                  ticks={getTicks(mcDomain!.min, mcDomain!.max)}
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
              {result.monteCarloResult.iterations.toLocaleString()} simulation iterations · seed {result.monteCarloResult.seed}
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
                              domain={[itemHistogram[0].binStart, itemHistogram[itemHistogram.length - 1].binEnd]}
                              ticks={getTicks(itemHistogram[0].binStart, itemHistogram[itemHistogram.length - 1].binEnd)}
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
                      label={`Cpk = ${formatIndex(result.statistical.currentCpk)}`}
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
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontFamily: MONOSPACE_FONT }}>
                    Cp {formatIndex(result.statistical.cp)} · Cpu {formatIndex(result.statistical.cpu)} · Cpl {formatIndex(result.statistical.cpl)}
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block' }}>
                    Estimated Yield
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={`${result.statistical.currentYield >= 99.99 ? result.statistical.currentYield.toFixed(5) : result.statistical.currentYield.toFixed(2)}%`}
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
                      within spec limits ({formatPPM(result.statistical.ppm)} PPM out)
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
                    Note: assumes input tolerances are 3σ values, a normal stack distribution centered at {center.toFixed(4)} {unit}, and required 3σ values keep the current centering
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
                    <TableCell align="right">
                      <Tooltip title={calculationMode === 'worstCase' ? 'Share of the arithmetic sum' : 'Share of total variance (contribution² / Σ contribution²) — shows where tightening a tolerance helps most'}>
                        <strong>{percentLabel}</strong>
                      </Tooltip>
                    </TableCell>
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

      <Suspense fallback={null}>
      {sensitivityOpen && (
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
      )}
      </Suspense>

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
            <Tooltip title="Auto covers μ ± 4σ and both spec limits, plus 10% padding">
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
              Auto covers μ ± 4σ and both spec limits, plus 10% padding
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
              helperText={autoTicks ? 'Auto picks a 1 / 2.5 / 5 × 10ⁿ step' : 'Custom increment (ignored if it would draw too many ticks)'}
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
