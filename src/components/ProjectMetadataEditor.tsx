import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Checkbox,
  FormControlLabel,
  Typography,
  Divider,
  Radio,
  RadioGroup,
  FormLabel,
  Switch,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { ProjectMetadata, ToleranceUnit, AnalysisSettings, MonteCarloSettings } from '../types';
import { DEFAULT_ANALYSIS_SETTINGS } from '../utils/projectDefaults';
import NumericField from './NumericField';

const ITERATION_PRESETS: Record<string, number> = { '10k': 10000, '50k': 50000, '100k': 100000 };

interface ProjectMetadataEditorProps {
  open: boolean;
  metadata: ProjectMetadata;
  unit: ToleranceUnit;
  analysisSettings: AnalysisSettings;
  onClose: () => void;
  onSave: (
    metadata: ProjectMetadata,
    unit: ToleranceUnit,
    analysisSettings: AnalysisSettings,
    convertValues: boolean
  ) => void;
}

const ProjectMetadataEditor: React.FC<ProjectMetadataEditorProps> = ({
  open,
  metadata,
  unit,
  analysisSettings,
  onClose,
  onSave,
}) => {
  const [editedMetadata, setEditedMetadata] = useState<ProjectMetadata>(metadata);
  const [selectedUnit, setSelectedUnit] = useState<ToleranceUnit>(unit);
  const [editedSettings, setEditedSettings] = useState<AnalysisSettings>(analysisSettings);
  const [customIterations, setCustomIterations] = useState(false);
  const [convertValues, setConvertValues] = useState(true);

  // Sync local state when props change (e.g., after loading a file)
  useEffect(() => {
    if (open) {
      setEditedMetadata(metadata);
      setSelectedUnit(unit);
      setEditedSettings(analysisSettings);
      setCustomIterations(false);
      setConvertValues(true);
    }
  }, [open, metadata, unit, analysisSettings]);

  const mcSettings: MonteCarloSettings = {
    ...DEFAULT_ANALYSIS_SETTINGS.monteCarloSettings!,
    ...editedSettings.monteCarloSettings,
  };
  const presetKey = Object.keys(ITERATION_PRESETS).find((k) => ITERATION_PRESETS[k] === mcSettings.iterations);
  const iterationPreset = customIterations || !presetKey ? 'custom' : presetKey;

  const updateMonteCarlo = (changes: Partial<MonteCarloSettings>) => {
    setEditedSettings({
      ...editedSettings,
      monteCarloSettings: { ...mcSettings, ...changes },
    });
  };

  const handleFieldChange = (field: keyof ProjectMetadata, value: string) => {
    setEditedMetadata({
      ...editedMetadata,
      [field]: value,
    });
  };

  const handleSave = () => {
    // Update modified date
    const finalMetadata = {
      ...editedMetadata,
      modifiedDate: new Date().toISOString(),
      // Set created date if this is a new project
      createdDate: editedMetadata.createdDate || new Date().toISOString(),
    };
    const finalSettings: AnalysisSettings = {
      ...editedSettings,
      // Monte Carlo mode is hidden when the feature is disabled, so fall back to RSS
      calculationMode:
        !editedSettings.enableMonteCarlo && editedSettings.calculationMode === 'monteCarlo'
          ? 'rss'
          : editedSettings.calculationMode,
    };
    onSave(finalMetadata, selectedUnit, finalSettings, selectedUnit !== unit && convertValues);
    onClose();
  };

  const handleCancel = () => {
    // Reset to original values
    setEditedMetadata(metadata);
    setSelectedUnit(unit);
    setEditedSettings(analysisSettings);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="md" fullWidth>
      <DialogTitle>
        Project Settings
        <IconButton
          onClick={handleCancel}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Project Name"
              value={editedMetadata.projectName || ''}
              onChange={(e) => handleFieldChange('projectName', e.target.value)}
              fullWidth
              placeholder="e.g., Envelope Assembly Tolerance Analysis"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="Description"
              value={editedMetadata.description || ''}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              fullWidth
              multiline
              rows={3}
              placeholder="Brief description of the tolerance analysis project..."
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Author"
              value={editedMetadata.author || ''}
              onChange={(e) => handleFieldChange('author', e.target.value)}
              fullWidth
              placeholder="Your name"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Units</InputLabel>
              <Select
                value={selectedUnit}
                label="Units"
                onChange={(e) => setSelectedUnit(e.target.value as ToleranceUnit)}
              >
                <MenuItem value="mm">Millimeters (mm)</MenuItem>
                <MenuItem value="inches">Inches (in)</MenuItem>
                <MenuItem value="μm">Micrometers (μm)</MenuItem>
                <MenuItem value="mils">Mils (0.001 in)</MenuItem>
              </Select>
            </FormControl>
            {selectedUnit !== unit && (
              <FormControlLabel
                sx={{ mt: 0.5 }}
                control={
                  <Checkbox
                    size="small"
                    checked={convertValues}
                    onChange={(e) => setConvertValues(e.target.checked)}
                  />
                }
                label={
                  <Typography variant="caption">
                    Convert all values from {unit} to {selectedUnit} (otherwise only the label changes)
                  </Typography>
                }
              />
            )}
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Drawing Number"
              value={editedMetadata.drawingNumber || ''}
              onChange={(e) => handleFieldChange('drawingNumber', e.target.value)}
              fullWidth
              placeholder="e.g., DWG-12345"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Revision"
              value={editedMetadata.revision || ''}
              onChange={(e) => handleFieldChange('revision', e.target.value)}
              fullWidth
              placeholder="e.g., Rev A, v1.0"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Tooltip title="Created date is set automatically">
              <TextField
                label="Created Date"
                value={
                  editedMetadata.createdDate
                    ? new Date(editedMetadata.createdDate).toLocaleString()
                    : 'Not set'
                }
                fullWidth
                disabled
              />
            </Tooltip>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Tooltip title="Modified date updates automatically on save">
              <TextField
                label="Last Modified"
                value={
                  editedMetadata.modifiedDate
                    ? new Date(editedMetadata.modifiedDate).toLocaleString()
                    : 'Not set'
                }
                fullWidth
                disabled
              />
            </Tooltip>
          </Grid>

          {/* Display Settings Section */}
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Display Settings
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={editedSettings.showMultiUnit}
                  onChange={(e) =>
                    setEditedSettings({ ...editedSettings, showMultiUnit: e.target.checked })
                  }
                />
              }
              label="Show results in multiple units"
            />
          </Grid>

          {editedSettings.showMultiUnit && (
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Secondary Unit</InputLabel>
                <Select
                  value={editedSettings.secondaryUnit || 'inches'}
                  label="Secondary Unit"
                  onChange={(e) =>
                    setEditedSettings({
                      ...editedSettings,
                      secondaryUnit: e.target.value as ToleranceUnit,
                    })
                  }
                >
                  <MenuItem value="mm">Millimeters (mm)</MenuItem>
                  <MenuItem value="inches">Inches (in)</MenuItem>
                  <MenuItem value="μm">Micrometers (μm)</MenuItem>
                  <MenuItem value="mils">Mils (0.001 in)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          )}

          <Grid item xs={12} sm={6}>
            <NumericField
              label="Sensitivity Analysis Increment"
              value={editedSettings.sensitivityIncrement || 0.1}
              onChange={(value) =>
                setEditedSettings({ ...editedSettings, sensitivityIncrement: value || 0.1 })
              }
              commitOnBlur
              fullWidth
              min={0.0001}
              step={0.01}
              helperText="Increment step for sensitivity sliders"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <NumericField
              label="Contribution Threshold (%)"
              value={editedSettings.contributionThreshold ?? 40}
              onChange={(value) =>
                setEditedSettings({ ...editedSettings, contributionThreshold: value ?? 40 })
              }
              commitOnBlur
              fullWidth
              min={0}
              max={100}
              step={1}
              helperText="Percentage threshold for high-impact item warnings (default: 40%)"
            />
          </Grid>

          {/* Monte Carlo Settings Section */}
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Advanced Features
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={editedSettings.enableMonteCarlo}
                  onChange={(e) =>
                    setEditedSettings({ ...editedSettings, enableMonteCarlo: e.target.checked })
                  }
                />
              }
              label="Enable Monte Carlo Simulation"
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4 }}>
              When enabled, Monte Carlo option will appear in the Calculation Mode selector.
              Monte Carlo is a probabilistic simulation method for tolerance analysis.
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="body2" sx={{ mt: 2, fontWeight: 600 }}>
              Monte Carlo Configuration
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <FormLabel>Default Iterations</FormLabel>
              <RadioGroup
                value={iterationPreset}
                onChange={(e) => {
                  const value = e.target.value;
                  const preset = ITERATION_PRESETS[value];
                  setCustomIterations(value === 'custom');
                  updateMonteCarlo({ iterations: preset ?? mcSettings.iterations });
                }}
              >
                <FormControlLabel value="10k" control={<Radio />} label="10,000 (Fast)" />
                <FormControlLabel value="50k" control={<Radio />} label="50,000 (Balanced)" />
                <FormControlLabel value="100k" control={<Radio />} label="100,000 (Accurate)" />
                <FormControlLabel value="custom" control={<Radio />} label="Custom" />
              </RadioGroup>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            {iterationPreset === 'custom' && (
              <NumericField
                label="Custom Iteration Count"
                fullWidth
                value={mcSettings.iterations}
                onChange={(value) => updateMonteCarlo({ iterations: Math.round(value ?? 50000) })}
                commitOnBlur
                min={1000}
                max={1000000}
                step={1000}
                helperText="Range: 1,000 - 1,000,000"
                sx={{ mb: 2 }}
              />
            )}
            <NumericField
              label="Random Seed (optional)"
              fullWidth
              value={mcSettings.seed}
              onChange={(value) =>
                updateMonteCarlo({ seed: value === undefined ? undefined : Math.round(Math.abs(value)) })
              }
              allowEmpty
              commitOnBlur
              min={0}
              max={4294967295}
              helperText="Set a seed to get identical results on every run; leave blank for a new random run each time"
            />
          </Grid>

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={editedSettings.monteCarloSettings?.useAdvancedDistributions || false}
                  onChange={(e) => updateMonteCarlo({ useAdvancedDistributions: e.target.checked })}
                />
              }
              label="Advanced: Per-item distribution selection"
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4 }}>
              When enabled, you can select Normal/Uniform/Triangular for each tolerance item.
              Default uses Normal for fixed items and Uniform for floating items.
            </Typography>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCancel}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProjectMetadataEditor;
