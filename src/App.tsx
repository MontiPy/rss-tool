import { useState, useCallback, useMemo, lazy, Suspense } from 'react';
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
  CircularProgress,
  Snackbar,
  Alert,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import { ProjectData, Direction, ToleranceMode, ProjectMetadata, ToleranceUnit, CalculationMode, AnalysisSettings } from './types';
import DirectionTab from './components/DirectionTab';
import FileControls from './components/FileControls';
import ErrorBoundary from './components/ErrorBoundary';
import RecoveryDialog from './components/RecoveryDialog';

// Lazy load heavy dialogs
const ProjectMetadataEditor = lazy(() => import('./components/ProjectMetadataEditor'));
const HelpDialog = lazy(() => import('./components/HelpDialog'));

// Custom hooks
import { useUndoRedo, useAutoSave, useKeyboardShortcuts, COMMON_SHORTCUTS } from './hooks';
import { useThemeMode } from './hooks/useTheme';

// Theme
import { lightTheme, darkTheme, MONOSPACE_FONT } from './theme';

// Re-export for backward compatibility
export { MONOSPACE_FONT };

const createDefaultProject = (): ProjectData => ({
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
    enableMonteCarlo: false,
    monteCarloSettings: {
      iterations: 50000,
      useAdvancedDistributions: false,
    },
  },
});

function App() {
  // Theme
  const { toggle: toggleTheme, isDark } = useThemeMode();
  const theme = isDark ? darkTheme : lightTheme;

  // Project data with undo/redo
  const {
    state: projectData,
    setState: setProjectData,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useUndoRedo<ProjectData>(createDefaultProject(), { maxHistory: 50 });

  // Auto-save
  const {
    recoveryData,
    recoveryTimestamp,
    clearRecovery,
    lastSaved,
    isPending: isAutoSavePending,
  } = useAutoSave(projectData, {
    enabled: true,
    saveDelay: 5000,
  });

  const [activeTab, setActiveTab] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'info' | 'warning' | 'error' }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // Show recovery dialog if data exists
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(!!recoveryData);

  const handleRecovery = useCallback((data: ProjectData) => {
    setProjectData(data);
    clearRecovery();
    setShowRecoveryDialog(false);
    setSnackbar({ open: true, message: 'Project recovered successfully', severity: 'success' });
  }, [setProjectData, clearRecovery]);

  const handleDiscardRecovery = useCallback(() => {
    clearRecovery();
    setShowRecoveryDialog(false);
  }, [clearRecovery]);

  const handleToleranceModeChange = useCallback((mode: ToleranceMode) => {
    setProjectData((prev) => ({
      ...prev,
      toleranceMode: mode,
    }));
  }, [setProjectData]);

  const handleCalculationModeChange = useCallback((mode: CalculationMode) => {
    setProjectData((prev) => ({
      ...prev,
      analysisSettings: {
        ...prev.analysisSettings!,
        calculationMode: mode,
      },
    }));
  }, [setProjectData]);

  const handleDirectionChange = useCallback((updatedDirection: Direction) => {
    setProjectData((prev) => ({
      ...prev,
      directions: prev.directions.map((dir) =>
        dir.id === updatedDirection.id ? updatedDirection : dir
      ),
    }));
  }, [setProjectData]);

  const handleAddDirection = useCallback(() => {
    setProjectData((prev) => {
      const newDirection: Direction = {
        id: `dir-${Date.now()}`,
        name: `Stack ${prev.directions.length + 1}`,
        items: [],
      };
      return {
        ...prev,
        directions: [...prev.directions, newDirection],
      };
    });
    setActiveTab(projectData.directions.length);
  }, [setProjectData, projectData.directions.length]);

  const handleDeleteDirection = useCallback((directionId: string) => {
    if (projectData.directions.length <= 1) {
      setSnackbar({ open: true, message: 'Cannot delete the last direction', severity: 'warning' });
      return;
    }

    setProjectData((prev) => ({
      ...prev,
      directions: prev.directions.filter((dir) => dir.id !== directionId),
    }));

    if (activeTab >= projectData.directions.length - 1) {
      setActiveTab(Math.max(0, activeTab - 1));
    }
  }, [projectData.directions.length, activeTab, setProjectData]);

  const handleDuplicateDirection = useCallback((directionId: string) => {
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

    setProjectData((prev) => ({
      ...prev,
      directions: [...prev.directions, duplicatedDirection],
    }));

    setActiveTab(projectData.directions.length);
  }, [projectData.directions, setProjectData]);

  const handleStartRenaming = useCallback((directionId: string, currentName: string) => {
    setEditingTabId(directionId);
    setEditingTabName(currentName);
  }, []);

  const handleSaveRename = useCallback(() => {
    if (editingTabId && editingTabName.trim()) {
      setProjectData((prev) => ({
        ...prev,
        directions: prev.directions.map((dir) =>
          dir.id === editingTabId ? { ...dir, name: editingTabName.trim() } : dir
        ),
      }));
    }
    setEditingTabId(null);
    setEditingTabName('');
  }, [editingTabId, editingTabName, setProjectData]);

  const handleCancelRename = useCallback(() => {
    setEditingTabId(null);
    setEditingTabName('');
  }, []);

  const handleLoadProject = useCallback((data: ProjectData) => {
    setProjectData(data);
    setActiveTab(0);
    setSnackbar({ open: true, message: 'Project loaded successfully', severity: 'success' });
  }, [setProjectData]);

  const handleSaveMetadata = useCallback((metadata: ProjectMetadata, unit: ToleranceUnit, analysisSettings: AnalysisSettings) => {
    setProjectData((prev) => ({
      ...prev,
      metadata,
      unit,
      analysisSettings,
    }));
  }, [setProjectData]);

  // Keyboard shortcuts
  const shortcutHandlers = useMemo(() => ({
    [COMMON_SHORTCUTS.UNDO]: () => {
      if (canUndo) {
        undo();
        setSnackbar({ open: true, message: 'Undo', severity: 'info' });
      }
    },
    [COMMON_SHORTCUTS.REDO]: () => {
      if (canRedo) {
        redo();
        setSnackbar({ open: true, message: 'Redo', severity: 'info' });
      }
    },
    [COMMON_SHORTCUTS.HELP]: () => setHelpOpen(true),
    [COMMON_SHORTCUTS.NEW]: handleAddDirection,
  }), [canUndo, canRedo, undo, redo, handleAddDirection]);

  useKeyboardShortcuts(shortcutHandlers);

  return (
    <ThemeProvider theme={theme}>
      <ErrorBoundary>
        <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: 'background.default' }}>
          <AppBar position="static">
            <Toolbar>
              <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                {projectData.metadata?.projectName || 'RSS Tolerance Stack Calculator'}
              </Typography>

              {/* Auto-save indicator */}
              {isAutoSavePending && (
                <Tooltip title="Saving...">
                  <CircularProgress size={20} color="inherit" sx={{ mr: 2 }} />
                </Tooltip>
              )}
              {lastSaved && !isAutoSavePending && (
                <Typography variant="caption" sx={{ mr: 2, opacity: 0.7 }}>
                  Saved
                </Typography>
              )}

              {/* Undo/Redo */}
              <Tooltip title="Undo (Ctrl+Z)">
                <span>
                  <IconButton color="inherit" onClick={undo} disabled={!canUndo}>
                    <UndoIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Redo (Ctrl+Shift+Z)">
                <span>
                  <IconButton color="inherit" onClick={redo} disabled={!canRedo}>
                    <RedoIcon />
                  </IconButton>
                </span>
              </Tooltip>

              {/* Keyboard shortcuts */}
              <Tooltip title="Keyboard Shortcuts">
                <IconButton color="inherit" onClick={() => setShowShortcuts(!showShortcuts)}>
                  <KeyboardIcon />
                </IconButton>
              </Tooltip>

              {/* Theme toggle */}
              <Tooltip title={isDark ? 'Light mode' : 'Dark mode'}>
                <IconButton color="inherit" onClick={toggleTheme}>
                  {isDark ? <Brightness7Icon /> : <Brightness4Icon />}
                </IconButton>
              </Tooltip>

              <Tooltip title="Help (F1)">
                <IconButton color="inherit" onClick={() => setHelpOpen(true)}>
                  <HelpOutlineIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Settings">
                <IconButton color="inherit" onClick={() => setSettingsOpen(true)}>
                  <SettingsIcon />
                </IconButton>
              </Tooltip>
            </Toolbar>
          </AppBar>

          <Container maxWidth="xl" sx={{ mt: 2, mb: 2 }}>
            {/* Keyboard Shortcuts Panel */}
            {showShortcuts && (
              <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Keyboard Shortcuts
                </Typography>
                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  <Typography variant="caption"><strong>Ctrl+Z:</strong> Undo</Typography>
                  <Typography variant="caption"><strong>Ctrl+Shift+Z:</strong> Redo</Typography>
                  <Typography variant="caption"><strong>Ctrl+N:</strong> New Stack</Typography>
                  <Typography variant="caption"><strong>F1:</strong> Help</Typography>
                </Box>
              </Paper>
            )}

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
              <Box sx={{ borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
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
                            <span style={{ cursor: 'pointer' }}>
                              {direction.name}
                            </span>
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
                <Tooltip title="Add new stack (Ctrl+N)">
                  <Button
                    startIcon={<AddIcon />}
                    onClick={handleAddDirection}
                    sx={{ m: 1 }}
                    variant="outlined"
                    size="small"
                  >
                    Add Tolerance Stack
                  </Button>
                </Tooltip>
              </Box>

              <Box sx={{ p: 2 }}>
                {projectData.directions.map((direction, index) => (
                  <Box
                    key={direction.id}
                    role="tabpanel"
                    hidden={activeTab !== index}
                    aria-labelledby={`tab-${direction.id}`}
                  >
                    {activeTab === index && (
                      <ErrorBoundary>
                        <DirectionTab
                          direction={direction}
                          toleranceMode={projectData.toleranceMode}
                          unit={projectData.unit || 'mm'}
                          calculationMode={projectData.analysisSettings?.calculationMode || 'rss'}
                          analysisSettings={projectData.analysisSettings}
                          onDirectionChange={handleDirectionChange}
                        />
                      </ErrorBoundary>
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
          <Suspense fallback={<CircularProgress />}>
            {settingsOpen && (
              <ProjectMetadataEditor
                open={settingsOpen}
                metadata={projectData.metadata || {}}
                unit={projectData.unit || 'mm'}
                analysisSettings={projectData.analysisSettings || {
                  calculationMode: 'rss',
                  showMultiUnit: false,
                  contributionThreshold: 40,
                  sensitivityIncrement: 0.1,
                  enableMonteCarlo: false,
                }}
                onClose={() => setSettingsOpen(false)}
                onSave={handleSaveMetadata}
              />
            )}
          </Suspense>

          {/* Help Dialog */}
          <Suspense fallback={<CircularProgress />}>
            {helpOpen && (
              <HelpDialog
                open={helpOpen}
                onClose={() => setHelpOpen(false)}
              />
            )}
          </Suspense>

          {/* Recovery Dialog */}
          <RecoveryDialog
            open={showRecoveryDialog}
            recoveryData={recoveryData}
            recoveryTimestamp={recoveryTimestamp}
            onRecover={handleRecovery}
            onDiscard={handleDiscardRecovery}
          />

          {/* Snackbar for notifications */}
          <Snackbar
            open={snackbar.open}
            autoHideDuration={3000}
            onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert
              onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
              severity={snackbar.severity}
              variant="filled"
              sx={{ width: '100%' }}
            >
              {snackbar.message}
            </Alert>
          </Snackbar>
        </Box>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
