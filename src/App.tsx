import React, { useState } from 'react';
import {
  Container,
  AppBar,
  Toolbar,
  Typography,
  Box,
  Tabs,
  Tab,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Paper,
  IconButton,
  createTheme,
  ThemeProvider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { ProjectData, Direction, ToleranceMode, ProjectMetadata, ToleranceUnit, CalculationMode, AnalysisSettings } from './types';
import DirectionTab from './components/DirectionTab';
import FileControls from './components/FileControls';
import ProjectMetadataEditor from './components/ProjectMetadataEditor';
import HelpDialog from './components/HelpDialog';

// Custom theme with Yu Gothic font and increased font size
const theme = createTheme({
  typography: {
    fontFamily: "'Yu Gothic', 'Yu Gothic UI', 'Segoe UI', 'Helvetica Neue', sans-serif",
    fontSize: 13,
  },
});

// Monospace font for numeric values
export const MONOSPACE_FONT = "'Consolas', 'Monaco', 'Courier New', monospace";

function App() {
  const [projectData, setProjectData] = useState<ProjectData>({
    toleranceMode: 'symmetric',
    unit: 'mm',
    directions: [
      {
        id: 'dir-1',
        name: 'Stack 1',
        items: [],
      },
    ],
    metadata: {
      createdDate: new Date().toISOString(),
      modifiedDate: new Date().toISOString(),
    },
    analysisSettings: {
      calculationMode: 'rss',
      showMultiUnit: false,
      contributionThreshold: 40,
      sensitivityIncrement: 0.1,
    },
  });

  const [activeTab, setActiveTab] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState('');

  const handleToleranceModeChange = (mode: ToleranceMode) => {
    setProjectData({
      ...projectData,
      toleranceMode: mode,
    });
  };

  const handleCalculationModeChange = (mode: CalculationMode) => {
    setProjectData({
      ...projectData,
      analysisSettings: {
        ...projectData.analysisSettings!,
        calculationMode: mode,
      },
    });
  };

  const handleDirectionChange = (updatedDirection: Direction) => {
    setProjectData({
      ...projectData,
      directions: projectData.directions.map((dir) =>
        dir.id === updatedDirection.id ? updatedDirection : dir
      ),
    });
  };

  const handleAddDirection = () => {
    const newDirection: Direction = {
      id: `dir-${Date.now()}`,
      name: `Stack ${projectData.directions.length + 1}`,
      items: [],
    };
    setProjectData({
      ...projectData,
      directions: [...projectData.directions, newDirection],
    });
    setActiveTab(projectData.directions.length);
  };

  const handleDeleteDirection = (directionId: string) => {
    if (projectData.directions.length <= 1) {
      alert('Cannot delete the last direction');
      return;
    }

    setProjectData({
      ...projectData,
      directions: projectData.directions.filter((dir) => dir.id !== directionId),
    });

    // Adjust active tab if necessary
    if (activeTab >= projectData.directions.length - 1) {
      setActiveTab(Math.max(0, activeTab - 1));
    }
  };

  const handleDuplicateDirection = (directionId: string) => {
    const direction = projectData.directions.find((dir) => dir.id === directionId);
    if (!direction) return;

    const duplicatedDirection: Direction = {
      ...direction,
      id: `dir-${Date.now()}`,
      name: `${direction.name} (Copy)`,
      items: direction.items.map((item) => ({
        ...item,
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      })),
    };

    setProjectData({
      ...projectData,
      directions: [...projectData.directions, duplicatedDirection],
    });

    // Switch to the new duplicated tab
    setActiveTab(projectData.directions.length);
  };

  const handleStartRenaming = (directionId: string, currentName: string) => {
    setEditingTabId(directionId);
    setEditingTabName(currentName);
  };

  const handleSaveRename = () => {
    if (editingTabId && editingTabName.trim()) {
      setProjectData({
        ...projectData,
        directions: projectData.directions.map((dir) =>
          dir.id === editingTabId ? { ...dir, name: editingTabName.trim() } : dir
        ),
      });
    }
    setEditingTabId(null);
    setEditingTabName('');
  };

  const handleCancelRename = () => {
    setEditingTabId(null);
    setEditingTabName('');
  };

  const handleLoadProject = (data: ProjectData) => {
    setProjectData(data);
    setActiveTab(0);
  };

  const handleSaveMetadata = (metadata: ProjectMetadata, unit: ToleranceUnit, analysisSettings: AnalysisSettings) => {
    setProjectData({
      ...projectData,
      metadata,
      unit,
      analysisSettings,
    });
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {projectData.metadata?.projectName || 'RSS Tolerance Stack Calculator'}
          </Typography>
          <IconButton color="inherit" onClick={() => setHelpOpen(true)} title="Help">
            <HelpOutlineIcon />
          </IconButton>
          <IconButton color="inherit" onClick={() => setSettingsOpen(true)} title="Settings">
            <SettingsIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 2, mb: 2 }}>
        {/* Control Panel */}
        <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <FormControl component="fieldset">
                <FormLabel component="legend">Tolerance Mode</FormLabel>
                <RadioGroup
                  row
                  value={projectData.toleranceMode}
                  onChange={(e) => handleToleranceModeChange(e.target.value as ToleranceMode)}
                >
                  <FormControlLabel
                    value="symmetric"
                    control={<Radio />}
                    label="Symmetric (±)"
                  />
                  <FormControlLabel
                    value="asymmetric"
                    control={<Radio />}
                    label="Asymmetric (+/-)"
                  />
                </RadioGroup>
              </FormControl>

              <FormControl component="fieldset">
                <FormLabel component="legend">Calculation Mode</FormLabel>
                <RadioGroup
                  row
                  value={projectData.analysisSettings?.calculationMode || 'rss'}
                  onChange={(e) => handleCalculationModeChange(e.target.value as CalculationMode)}
                >
                  <FormControlLabel
                    value="rss"
                    control={<Radio />}
                    label="RSS (Statistical)"
                  />
                  <FormControlLabel
                    value="worstCase"
                    control={<Radio />}
                    label="Worst-Case"
                  />
                </RadioGroup>
              </FormControl>
            </Box>

            <FileControls projectData={projectData} onLoad={handleLoadProject} />
          </Box>
        </Paper>

        {/* Direction Tabs */}
        <Paper elevation={2}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
            <Tabs
              value={activeTab}
              onChange={(_, newValue) => setActiveTab(newValue)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ flexGrow: 1 }}
            >
              {projectData.directions.map((direction) => (
                <Tab
                  key={direction.id}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {editingTabId === direction.id ? (
                        <input
                          type="text"
                          value={editingTabName}
                          onChange={(e) => setEditingTabName(e.target.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveRename();
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              handleCancelRename();
                            }
                          }}
                          onBlur={handleSaveRename}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          autoFocus
                          style={{
                            padding: '4px 8px',
                            fontSize: '0.875rem',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            minWidth: '100px',
                            outline: 'none',
                          }}
                        />
                      ) : (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartRenaming(direction.id, direction.name);
                          }}
                          style={{ cursor: 'pointer' }}
                          title="Click to rename"
                        >
                          {direction.name}
                        </span>
                      )}
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateDirection(direction.id);
                        }}
                        title="Duplicate this stack"
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                      {projectData.directions.length > 1 && (
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDirection(direction.id);
                          }}
                          title="Delete this stack"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  }
                />
              ))}
            </Tabs>
            <Button
              startIcon={<AddIcon />}
              onClick={handleAddDirection}
              sx={{ m: 1 }}
              variant="outlined"
              size="small"
            >
              Add Tolerance Stack
            </Button>
          </Box>

          <Box sx={{ p: 2 }}>
            {projectData.directions.map((direction, index) => (
              <Box
                key={direction.id}
                role="tabpanel"
                hidden={activeTab !== index}
              >
                {activeTab === index && (
                  <DirectionTab
                    direction={direction}
                    toleranceMode={projectData.toleranceMode}
                    unit={projectData.unit || 'mm'}
                    calculationMode={projectData.analysisSettings?.calculationMode || 'rss'}
                    analysisSettings={projectData.analysisSettings}
                    onDirectionChange={handleDirectionChange}
                  />
                )}
              </Box>
            ))}
          </Box>
        </Paper>

        {/* Footer */}
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            RSS Tolerance Stack Calculator - Root Sum Square with Float Factor (√3) Support
          </Typography>
        </Box>
      </Container>

      {/* Project Settings Dialog */}
      <ProjectMetadataEditor
        open={settingsOpen}
        metadata={projectData.metadata || {}}
        unit={projectData.unit || 'mm'}
        analysisSettings={projectData.analysisSettings || {
          calculationMode: 'rss',
          sigmaLevel: 3,
          showMultiUnit: false,
          contributionThreshold: 40,
          sensitivityIncrement: 0.1,
        }}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveMetadata}
      />

      {/* Help Dialog */}
      <HelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
      </Box>
    </ThemeProvider>
  );
}

export default App;
