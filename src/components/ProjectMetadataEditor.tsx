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
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { ProjectMetadata, ToleranceUnit, AnalysisSettings } from '../types';

interface ProjectMetadataEditorProps {
  open: boolean;
  metadata: ProjectMetadata;
  unit: ToleranceUnit;
  analysisSettings: AnalysisSettings;
  onClose: () => void;
  onSave: (metadata: ProjectMetadata, unit: ToleranceUnit, analysisSettings: AnalysisSettings) => void;
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

  // Sync local state when props change (e.g., after loading a file)
  useEffect(() => {
    if (open) {
      setEditedMetadata(metadata);
      setSelectedUnit(unit);
      setEditedSettings(analysisSettings);
    }
  }, [open, metadata, unit, analysisSettings]);

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
    onSave(finalMetadata, selectedUnit, editedSettings);
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
            <TextField
              label="Sensitivity Analysis Increment"
              value={editedSettings.sensitivityIncrement || 0.1}
              onChange={(e) =>
                setEditedSettings({
                  ...editedSettings,
                  sensitivityIncrement: parseFloat(e.target.value) || 0.1,
                })
              }
              fullWidth
              type="number"
              inputProps={{ step: 0.01, min: 0.001 }}
              helperText="Increment step for sensitivity sliders"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Contribution Threshold (%)"
              value={editedSettings.contributionThreshold || 40}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 40;
                setEditedSettings({
                  ...editedSettings,
                  contributionThreshold: Math.max(0, Math.min(100, value)),
                });
              }}
              fullWidth
              type="number"
              inputProps={{ step: 1, min: 0, max: 100 }}
              helperText="Percentage threshold for high-impact item warnings (default: 40%)"
            />
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
