import { useState } from 'react';
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
  ThemeProvider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import { ToleranceMode, CalculationMode, ProjectData } from './types';
import DirectionTab from './components/DirectionTab';
import FileControls from './components/FileControls';
import ProjectMetadataEditor from './components/ProjectMetadataEditor';
import HelpDialog from './components/HelpDialog';
import { theme, MONOSPACE_FONT } from './theme';
import { useProjectData } from './hooks/useProjectData';

// Re-export for compatibility if used elsewhere
export { MONOSPACE_FONT };

function App() {
  const {
    projectData,
    updateToleranceMode,
    updateCalculationMode,
    updateDirection,
    addDirection,
    deleteDirection,
    duplicateDirection,
    renameDirection,
    loadProject,
    updateMetadata,
  } = useProjectData();

  const [activeTab, setActiveTab] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState('');

  const handleAddDirection = () => {
    const newIndex = addDirection();
    setActiveTab(newIndex);
  };

  const handleDeleteDirection = (directionId: string) => {
    try {
      deleteDirection(directionId);
      // Adjust active tab if necessary
      if (activeTab >= projectData.directions.length - 1) {
        setActiveTab(Math.max(0, activeTab - 1));
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Cannot delete direction');
    }
  };

  const handleDuplicateDirection = (directionId: string) => {
    const newIndex = duplicateDirection(directionId);
    if (newIndex !== undefined) {
      setActiveTab(newIndex);
    }
  };

  const handleStartRenaming = (directionId: string, currentName: string) => {
    setEditingTabId(directionId);
    setEditingTabName(currentName);
  };

  const handleSaveRename = () => {
    if (editingTabId && editingTabName.trim()) {
      renameDirection(editingTabId, editingTabName);
    }
    setEditingTabId(null);
    setEditingTabName('');
  };

  const handleCancelRename = () => {
    setEditingTabId(null);
    setEditingTabName('');
  };

  const handleLoadProject = (data: ProjectData) => {
    loadProject(data);
    setActiveTab(0);
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
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <FormControl component="fieldset">
                  <FormLabel component="legend">Tolerance Mode</FormLabel>
                  <RadioGroup
                    row
                    value={projectData.toleranceMode}
                    onChange={(e) => updateToleranceMode(e.target.value as ToleranceMode)}
                  >
                    <FormControlLabel value="symmetric" control={<Radio />} label="Symmetric (±)" />
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
                    onChange={(e) => updateCalculationMode(e.target.value as CalculationMode)}
                  >
                    <FormControlLabel value="rss" control={<Radio />} label="RSS (Statistical)" />
                    <FormControlLabel value="worstCase" control={<Radio />} label="Worst-Case" />
                    {projectData.analysisSettings?.enableMonteCarlo && (
                      <FormControlLabel
                        value="monteCarlo"
                        control={<Radio />}
                        label="Monte Carlo"
                      />
                    )}
                  </RadioGroup>
                </FormControl>
              </Box>

              <FileControls projectData={projectData} onLoad={handleLoadProject} />
            </Box>
          </Paper>

          {/* Direction Tabs */}
          <Paper elevation={2}>
            <Box
              sx={{
                borderBottom: 1,
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Tabs
                value={activeTab}
                onChange={(_, newValue) => setActiveTab(newValue)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ flexGrow: 1 }}
              >
                {projectData.directions.map((direction, index) => (
                  <Tab
                    key={direction.id}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {editingTabId === direction.id ? (
                        <input
                          type="text"
                          aria-label="Rename stack"
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
                          <span style={{ cursor: 'pointer' }}>{direction.name}</span>
                        )}
                        {activeTab === index && editingTabId !== direction.id && (
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartRenaming(direction.id, direction.name);
                            }}
                            title="Rename stack"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
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
                <Box key={direction.id} role="tabpanel" hidden={activeTab !== index}>
                  {activeTab === index && (
                    <DirectionTab
                      direction={direction}
                      toleranceMode={projectData.toleranceMode}
                      unit={projectData.unit || 'mm'}
                      calculationMode={projectData.analysisSettings?.calculationMode || 'rss'}
                      analysisSettings={projectData.analysisSettings}
                      onDirectionChange={updateDirection}
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
          analysisSettings={
            projectData.analysisSettings || {
              calculationMode: 'rss',
              showMultiUnit: false,
              contributionThreshold: 40,
              sensitivityIncrement: 0.1,
              enableMonteCarlo: false,
              monteCarloSettings: {
                iterations: 50000,
                useAdvancedDistributions: false,
              },
            }
          }
          onClose={() => setSettingsOpen(false)}
          onSave={updateMetadata}
        />

        {/* Help Dialog */}
        <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      </Box>
    </ThemeProvider>
  );
}

export default App;
