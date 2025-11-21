import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  IconButton,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { ToleranceItem } from '../types';
import { FLOAT_FACTORS } from '../utils/rssCalculator';

interface CSVImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (items: ToleranceItem[]) => void;
  isSymmetricMode: boolean;
}

interface ColumnMapping {
  name: string;
  tolerancePlus: string;
  toleranceMinus: string;
  floatFactor: string;
  notes: string;
  source: string;
}

const CSVImportDialog: React.FC<CSVImportDialogProps> = ({
  open,
  onClose,
  onImport,
  isSymmetricMode,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    name: '',
    tolerancePlus: '',
    toleranceMinus: '',
    floatFactor: '',
    notes: '',
    source: '',
  });
  const [error, setError] = useState<string>('');
  const [previewItems, setPreviewItems] = useState<ToleranceItem[]>([]);

  const steps = ['Upload CSV', 'Map Columns', 'Preview & Import'];

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter((line) => line.trim());

        if (lines.length < 2) {
          setError('CSV file must contain at least a header row and one data row');
          return;
        }

        // Parse CSV (simple parser, handles quoted fields)
        const parsedData = lines.map((line) => {
          const cells: string[] = [];
          let cell = '';
          let insideQuotes = false;

          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
              if (insideQuotes && nextChar === '"') {
                cell += '"';
                i++; // Skip next quote
              } else {
                insideQuotes = !insideQuotes;
              }
            } else if (char === ',' && !insideQuotes) {
              cells.push(cell.trim());
              cell = '';
            } else {
              cell += char;
            }
          }
          cells.push(cell.trim());
          return cells;
        });

        const headerRow = parsedData[0];
        const dataRows = parsedData.slice(1);

        setHeaders(headerRow);
        setCsvData(dataRows);
        setError('');

        // Auto-detect column mappings based on common header names
        const autoMapping: ColumnMapping = {
          name: '',
          tolerancePlus: '',
          toleranceMinus: '',
          floatFactor: '',
          notes: '',
          source: '',
        };

        headerRow.forEach((header, index) => {
          const normalized = header.toLowerCase().trim();

          if (normalized.includes('name') || normalized.includes('item') || normalized.includes('description')) {
            autoMapping.name = index.toString();
          } else if (normalized.includes('tolerance') && (normalized.includes('+') || normalized.includes('plus') || normalized.includes('positive'))) {
            autoMapping.tolerancePlus = index.toString();
          } else if (normalized.includes('tolerance') && (normalized.includes('-') || normalized.includes('minus') || normalized.includes('negative'))) {
            autoMapping.toleranceMinus = index.toString();
          } else if (normalized.includes('tolerance') && !autoMapping.tolerancePlus) {
            // If just "tolerance", use for plus (and minus in symmetric mode)
            autoMapping.tolerancePlus = index.toString();
            if (isSymmetricMode) {
              autoMapping.toleranceMinus = index.toString();
            }
          } else if (normalized.includes('float') || normalized.includes('factor')) {
            autoMapping.floatFactor = index.toString();
          } else if (normalized.includes('note')) {
            autoMapping.notes = index.toString();
          } else if (normalized.includes('source') || normalized.includes('reference') || normalized.includes('dwg')) {
            autoMapping.source = index.toString();
          }
        });

        setColumnMapping(autoMapping);
        setActiveStep(1);
      } catch (err) {
        setError('Failed to parse CSV file: ' + (err as Error).message);
      }
    };

    reader.onerror = () => {
      setError('Failed to read file');
    };

    reader.readAsText(file);

    // Reset file input
    event.target.value = '';
  };

  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    setColumnMapping({
      ...columnMapping,
      [field]: value,
    });
  };

  const validateMapping = (): boolean => {
    if (!columnMapping.name) {
      setError('Item name column is required');
      return false;
    }
    if (!columnMapping.tolerancePlus) {
      setError('Tolerance (+) column is required');
      return false;
    }
    if (!isSymmetricMode && !columnMapping.toleranceMinus) {
      setError('Tolerance (-) column is required in asymmetric mode');
      return false;
    }
    setError('');
    return true;
  };

  const generatePreview = () => {
    if (!validateMapping()) return;

    try {
      const items: ToleranceItem[] = csvData.map((row, index) => {
        const nameIndex = parseInt(columnMapping.name);
        const plusIndex = parseInt(columnMapping.tolerancePlus);
        const minusIndex = columnMapping.toleranceMinus ? parseInt(columnMapping.toleranceMinus) : plusIndex;
        const floatIndex = columnMapping.floatFactor ? parseInt(columnMapping.floatFactor) : -1;
        const notesIndex = columnMapping.notes ? parseInt(columnMapping.notes) : -1;
        const sourceIndex = columnMapping.source ? parseInt(columnMapping.source) : -1;

        const tolerancePlus = Math.max(0, parseFloat(row[plusIndex] || '0') || 0);
        const toleranceMinus = isSymmetricMode
          ? tolerancePlus
          : Math.max(0, parseFloat(row[minusIndex] || '0') || 0);

        // Parse float factor
        let floatFactor = FLOAT_FACTORS.FIXED;
        if (floatIndex >= 0 && row[floatIndex]) {
          const floatValue = row[floatIndex].toLowerCase().trim();
          if (floatValue === 'true' || floatValue === '1' || floatValue === 'yes' || floatValue.includes('√3')) {
            floatFactor = FLOAT_FACTORS.SQRT3;
          } else if (!isNaN(parseFloat(floatValue))) {
            floatFactor = parseFloat(floatValue);
          }
        }

        return {
          id: `item-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
          name: row[nameIndex] || `Item ${index + 1}`,
          tolerancePlus,
          toleranceMinus,
          floatFactor,
          notes: notesIndex >= 0 ? row[notesIndex] : undefined,
          source: sourceIndex >= 0 ? row[sourceIndex] : undefined,
        };
      });

      setPreviewItems(items);
      setActiveStep(2);
      setError('');
    } catch (err) {
      setError('Failed to process data: ' + (err as Error).message);
    }
  };

  const handleImport = () => {
    onImport(previewItems);
    handleClose();
  };

  const handleClose = () => {
    setActiveStep(0);
    setCsvData([]);
    setHeaders([]);
    setColumnMapping({
      name: '',
      tolerancePlus: '',
      toleranceMinus: '',
      floatFactor: '',
      notes: '',
      source: '',
    });
    setError('');
    setPreviewItems([]);
    onClose();
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
    setError('');
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Import Tolerance Items from CSV
        <IconButton
          onClick={handleClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Step 1: Upload CSV */}
        {activeStep === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" gutterBottom>
              Upload a CSV file containing tolerance data
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
              CSV should include columns for item name and tolerance values
            </Typography>
            <Button
              variant="contained"
              component="label"
              startIcon={<CloudUploadIcon />}
              size="large"
            >
              Choose CSV File
              <input
                type="file"
                hidden
                accept=".csv"
                onChange={handleFileUpload}
              />
            </Button>
            {csvData.length > 0 && (
              <Typography variant="body2" sx={{ mt: 2, color: 'success.main' }}>
                ✓ Loaded {csvData.length} rows
              </Typography>
            )}
          </Box>
        )}

        {/* Step 2: Map Columns */}
        {activeStep === 1 && (
          <Box>
            <Typography variant="body2" gutterBottom>
              Map CSV columns to tolerance item fields. Detected headers are auto-mapped when possible.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <FormControl fullWidth required>
                <InputLabel>Item Name</InputLabel>
                <Select
                  value={columnMapping.name}
                  label="Item Name"
                  onChange={(e) => handleMappingChange('name', e.target.value)}
                >
                  <MenuItem value="">
                    <em>-- Select Column --</em>
                  </MenuItem>
                  {headers.map((header, index) => (
                    <MenuItem key={index} value={index.toString()}>
                      {header || `Column ${index + 1}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth required>
                <InputLabel>Tolerance (+)</InputLabel>
                <Select
                  value={columnMapping.tolerancePlus}
                  label="Tolerance (+)"
                  onChange={(e) => handleMappingChange('tolerancePlus', e.target.value)}
                >
                  <MenuItem value="">
                    <em>-- Select Column --</em>
                  </MenuItem>
                  {headers.map((header, index) => (
                    <MenuItem key={index} value={index.toString()}>
                      {header || `Column ${index + 1}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {!isSymmetricMode && (
                <FormControl fullWidth required>
                  <InputLabel>Tolerance (-)</InputLabel>
                  <Select
                    value={columnMapping.toleranceMinus}
                    label="Tolerance (-)"
                    onChange={(e) => handleMappingChange('toleranceMinus', e.target.value)}
                  >
                    <MenuItem value="">
                      <em>-- Select Column --</em>
                    </MenuItem>
                    {headers.map((header, index) => (
                      <MenuItem key={index} value={index.toString()}>
                        {header || `Column ${index + 1}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              <FormControl fullWidth>
                <InputLabel>Float Factor (Optional)</InputLabel>
                <Select
                  value={columnMapping.floatFactor}
                  label="Float Factor (Optional)"
                  onChange={(e) => handleMappingChange('floatFactor', e.target.value)}
                >
                  <MenuItem value="">
                    <em>-- None (defaults to 1.0) --</em>
                  </MenuItem>
                  {headers.map((header, index) => (
                    <MenuItem key={index} value={index.toString()}>
                      {header || `Column ${index + 1}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Source Reference (Optional)</InputLabel>
                <Select
                  value={columnMapping.source}
                  label="Source Reference (Optional)"
                  onChange={(e) => handleMappingChange('source', e.target.value)}
                >
                  <MenuItem value="">
                    <em>-- None --</em>
                  </MenuItem>
                  {headers.map((header, index) => (
                    <MenuItem key={index} value={index.toString()}>
                      {header || `Column ${index + 1}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Notes (Optional)</InputLabel>
                <Select
                  value={columnMapping.notes}
                  label="Notes (Optional)"
                  onChange={(e) => handleMappingChange('notes', e.target.value)}
                >
                  <MenuItem value="">
                    <em>-- None --</em>
                  </MenuItem>
                  {headers.map((header, index) => (
                    <MenuItem key={index} value={index.toString()}>
                      {header || `Column ${index + 1}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Preview first few rows of CSV */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                CSV Preview (first 5 rows):
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {headers.map((header, index) => (
                        <TableCell key={index}>
                          <strong>{header || `Col ${index + 1}`}</strong>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {csvData.slice(0, 5).map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <TableCell key={cellIndex}>{cell}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Box>
        )}

        {/* Step 3: Preview & Import */}
        {activeStep === 2 && (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              Preview of {previewItems.length} items to be imported. Click "Import" to add these items to the current tolerance stack.
            </Alert>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Item Name</strong></TableCell>
                    <TableCell align="right"><strong>Tolerance (+)</strong></TableCell>
                    {!isSymmetricMode && (
                      <TableCell align="right"><strong>Tolerance (-)</strong></TableCell>
                    )}
                    <TableCell align="center"><strong>Float</strong></TableCell>
                    <TableCell><strong>Source</strong></TableCell>
                    <TableCell><strong>Notes</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell align="right">{item.tolerancePlus.toFixed(4)}</TableCell>
                      {!isSymmetricMode && (
                        <TableCell align="right">{item.toleranceMinus.toFixed(4)}</TableCell>
                      )}
                      <TableCell align="center">
                        {item.floatFactor > 1.5 ? '✓ (√3)' : '—'}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" noWrap>
                          {item.source || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" noWrap>
                          {item.notes || '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        {activeStep > 0 && (
          <Button onClick={handleBack}>Back</Button>
        )}
        {activeStep === 1 && (
          <Button onClick={generatePreview} variant="contained">
            Preview
          </Button>
        )}
        {activeStep === 2 && (
          <Button onClick={handleImport} variant="contained" color="primary">
            Import {previewItems.length} Items
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CSVImportDialog;
