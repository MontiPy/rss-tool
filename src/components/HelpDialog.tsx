import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Typography,
  Box,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Paper,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

const HelpDialog: React.FC<HelpDialogProps> = ({ open, onClose }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        RSS Tolerance Stack Calculator - Help
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* RSS Calculation */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">RSS (Root Sum Square) Calculation</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="body2">
                  RSS is a statistical method for calculating tolerance stack-up that assumes tolerances
                  are normally distributed and independent. It provides a more realistic estimate than
                  worst-case analysis.
                </Typography>

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Formula:
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', fontFamily: 'monospace' }}>
                    RSS = √(Σ((tolerance × float_factor)²))
                  </Paper>
                </Box>

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Step-by-step:
                  </Typography>
                  <ol style={{ margin: 0, paddingLeft: 20 }}>
                    <li>
                      <Typography variant="body2">
                        For each tolerance item, multiply the tolerance by its float factor
                      </Typography>
                    </li>
                    <li>
                      <Typography variant="body2">
                        Square each result
                      </Typography>
                    </li>
                    <li>
                      <Typography variant="body2">
                        Sum all the squared values
                      </Typography>
                    </li>
                    <li>
                      <Typography variant="body2">
                        Take the square root of the sum
                      </Typography>
                    </li>
                  </ol>
                </Box>

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Example:
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell><strong>Item</strong></TableCell>
                          <TableCell><strong>Tolerance</strong></TableCell>
                          <TableCell><strong>Float Factor</strong></TableCell>
                          <TableCell><strong>Contribution</strong></TableCell>
                          <TableCell><strong>Squared</strong></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Item 1</TableCell>
                          <TableCell>0.5 mm</TableCell>
                          <TableCell>1.0</TableCell>
                          <TableCell>0.5</TableCell>
                          <TableCell>0.25</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Item 2</TableCell>
                          <TableCell>0.3 mm</TableCell>
                          <TableCell>√3 ≈ 1.732</TableCell>
                          <TableCell>0.520</TableCell>
                          <TableCell>0.270</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Item 3</TableCell>
                          <TableCell>0.4 mm</TableCell>
                          <TableCell>1.0</TableCell>
                          <TableCell>0.4</TableCell>
                          <TableCell>0.16</TableCell>
                        </TableRow>
                        <TableRow sx={{ bgcolor: 'action.hover' }}>
                          <TableCell colSpan={4}><strong>Sum of squares</strong></TableCell>
                          <TableCell><strong>0.680</strong></TableCell>
                        </TableRow>
                        <TableRow sx={{ bgcolor: 'primary.light' }}>
                          <TableCell colSpan={4}><strong>RSS = √(0.680)</strong></TableCell>
                          <TableCell><strong>0.825 mm</strong></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Worst-Case Calculation */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Worst-Case Calculation</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="body2">
                  Worst-case (arithmetic sum) assumes all tolerances stack up in the same direction
                  simultaneously, representing the absolute maximum deviation.
                </Typography>

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Formula:
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', fontFamily: 'monospace' }}>
                    Worst-Case = Σ(tolerance × float_factor)
                  </Paper>
                </Box>

                <Typography variant="body2">
                  Using the same example above, worst-case = 0.5 + 0.520 + 0.4 = <strong>1.420 mm</strong>
                </Typography>

                <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                  RSS saves: 0.595 mm (41.9%) compared to worst-case
                </Typography>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Float Factors */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Float Factors</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="body2">
                  Float factors account for tolerances that can "shift" or "float" during assembly,
                  such as clearance holes or adjustable features.
                </Typography>

                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell><strong>Float Factor</strong></TableCell>
                        <TableCell><strong>Value</strong></TableCell>
                        <TableCell><strong>When to Use</strong></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Fixed (1.0)</TableCell>
                        <TableCell>1.0</TableCell>
                        <TableCell>Fixed dimensions with no ability to shift (default)</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>√3 Float</TableCell>
                        <TableCell>≈ 1.732</TableCell>
                        <TableCell>
                          Floating tolerances (clearance holes, adjustable features).
                          Assumes uniform distribution instead of normal distribution.
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>

                <Typography variant="body2">
                  <strong>Example:</strong> A clearance hole with ±0.5 mm tolerance that can be adjusted
                  during assembly would use the √3 factor, contributing 0.866 mm instead of 0.5 mm to the RSS calculation.
                </Typography>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Sensitivity Analysis */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Sensitivity Analysis</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="body2">
                  Sensitivity analysis helps identify which tolerances have the greatest impact on
                  the total RSS, allowing you to optimize your design.
                </Typography>

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    How It's Calculated:
                  </Typography>
                  <ol style={{ margin: 0, paddingLeft: 20 }}>
                    <li>
                      <Typography variant="body2">
                        Take the current tolerance stack configuration
                      </Typography>
                    </li>
                    <li>
                      <Typography variant="body2">
                        For the item being analyzed, temporarily add one increment (default 0.1 mm) to its tolerance
                      </Typography>
                    </li>
                    <li>
                      <Typography variant="body2">
                        Recalculate the total RSS with this modified item
                      </Typography>
                    </li>
                    <li>
                      <Typography variant="body2">
                        The difference between the new RSS and original RSS is the sensitivity
                      </Typography>
                    </li>
                  </ol>
                </Box>

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Example:
                  </Typography>
                  <Typography variant="body2">
                    Original RSS total: 2.236 mm<br />
                    Item 1 tolerance: 1.0 mm<br />
                    Increment: 0.1 mm
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    1. Change Item 1 tolerance to 1.1 mm (1.0 + 0.1)<br />
                    2. Recalculate RSS: 2.250 mm<br />
                    3. Sensitivity = 2.250 - 2.236 = <strong>0.014 mm</strong>
                  </Typography>
                </Box>

                <Box sx={{ bgcolor: 'info.light', p: 2, borderRadius: 1 }}>
                  <Typography variant="body2">
                    <strong>Interpretation:</strong> "A 0.100 mm change in this tolerance causes a 0.014 mm change in total RSS"
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    • <strong>High sensitivity</strong> → Tighten this tolerance to reduce RSS<br />
                    • <strong>Low sensitivity</strong> → Loosening this tolerance has minimal impact
                  </Typography>
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Budget Comparison */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Tolerance Budget</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="body2">
                  Set a target tolerance budget to track how your design compares to requirements.
                </Typography>

                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell><strong>Status</strong></TableCell>
                        <TableCell><strong>Condition</strong></TableCell>
                        <TableCell><strong>Color</strong></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Pass</TableCell>
                        <TableCell>&lt; 90% of budget</TableCell>
                        <TableCell sx={{ color: 'success.main' }}>Green</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Warning</TableCell>
                        <TableCell>90-100% of budget</TableCell>
                        <TableCell sx={{ color: 'warning.main' }}>Yellow</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Fail</TableCell>
                        <TableCell>&gt; 100% of budget</TableCell>
                        <TableCell sx={{ color: 'error.main' }}>Red</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>

                <Typography variant="body2">
                  Enter your target budget in the "Target Budget" field for each tolerance stack.
                </Typography>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Symmetric vs Asymmetric */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Symmetric vs. Asymmetric Tolerances</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="body2">
                  <strong>Symmetric (±):</strong> Tolerance is the same in both directions
                  <br />
                  Example: 10.0 ± 0.5 mm (9.5 to 10.5 mm)
                </Typography>

                <Typography variant="body2">
                  <strong>Asymmetric (+/-):</strong> Tolerance can be different in positive and negative directions
                  <br />
                  Example: 10.0 +0.3/-0.5 mm (9.5 to 10.3 mm)
                </Typography>

                <Typography variant="body2">
                  Switch between modes using the "Tolerance Mode" radio buttons at the top of the page.
                </Typography>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* File Operations */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">File Operations</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="body2">
                  <strong>Save:</strong> Exports your project as a JSON file for later use
                </Typography>

                <Typography variant="body2">
                  <strong>Load:</strong> Imports a previously saved JSON project file
                </Typography>

                <Typography variant="body2">
                  <strong>Export CSV:</strong> Exports tolerance data and results to a CSV file for use in Excel or other spreadsheet applications
                </Typography>

                <Typography variant="body2">
                  <strong>Import from CSV:</strong> Import tolerance items from a CSV file with column mapping support.
                  Available in each tolerance stack tab.
                </Typography>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Tips & Best Practices */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Tips & Best Practices</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2">
                  • Use <strong>RSS</strong> for statistical analysis (more realistic)
                </Typography>
                <Typography variant="body2">
                  • Use <strong>Worst-Case</strong> for critical safety applications
                </Typography>
                <Typography variant="body2">
                  • Set target budgets early in your design process
                </Typography>
                <Typography variant="body2">
                  • Use sensitivity analysis to identify which tolerances to tighten first
                </Typography>
                <Typography variant="body2">
                  • Add notes and source references to tolerance items for traceability
                </Typography>
                <Typography variant="body2">
                  • Create multiple tolerance stacks (tabs) for different directions or assemblies
                </Typography>
                <Typography variant="body2">
                  • Use the duplicate feature to create variations of existing stacks
                </Typography>
                <Typography variant="body2">
                  • Enable multi-unit display in settings to see results in multiple units simultaneously
                </Typography>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default HelpDialog;
