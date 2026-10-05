import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
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
import { ProjectData, Direction, ToleranceMode, ProjectMetadata, ToleranceUnit, CalculationMode, AnalysisSettings } from './types';
import DirectionTab from './components/DirectionTab';
import FileControls from './components/FileControls';
import { useHistoryState } from './hooks/useHistoryState';
import { exportToCSV, exportToJSON, importFromJSON, parseProjectJSON } from './utils/fileHandlers';
import {
  convertProjectUnits,
  createDefaultProject,
  DEFAULT_ANALYSIS_SETTINGS,
  generateId,
} from './utils/projectDefaults';
import { openReport } from './utils/reportGenerator';

// Dialogs are loaded on demand to keep the initial bundle small
const ProjectMetadataEditor = lazy(() => import('./components/ProjectMetadataEditor'));
const HelpDialog = lazy(() => import('./components/HelpDialog'));

const AUTOSAVE_KEY = 'rss-tool:autosave';
// Set when the autosaved project matches what was last saved to / loaded from a file
const AUTOSAVE_CLEAN_KEY = 'rss-tool:autosave-clean';

interface Notice {
  message: string;
  severity: 'success' | 'error' | 'info';
  undoable?: boolean;
}

function loadAutosave(): { project: ProjectData; clean: boolean } | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    return { project: parseProjectJSON(raw), clean: localStorage.getItem(AUTOSAVE_CLEAN_KEY) === '1' };
  } catch {
    return null;
  }
}

function timestampedName(ext: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return `rss-calculation-${timestamp}.${ext}`;
}

function projectFileName(data: ProjectData, ext: string): string {
  const name = data.metadata?.projectName?.trim().replace(/[^\w.-]+/g, '_');
  return name ? `${name}${data.metadata?.revision ? `_${data.metadata.revision.replace(/[^\w.-]+/g, '_')}` : ''}.${ext}` : timestampedName(ext);
}

function App() {
  const [restored] = useState(() => loadAutosave());
  const history = useHistoryState<ProjectData>(() => restored?.project ?? createDefaultProject());
  const { state: projectData, setState: setProjectData } = history;

  const [activeTab, setActiveTab] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState('');
  const [notice, setNotice] = useState<Notice | null>(
    restored ? { message: 'Restored your previous session', severity: 'info' } : null
  );

  // The project as last saved to / loaded from a file, for the unsaved-changes indicator
  const [savedSnapshot, setSavedSnapshot] = useState<ProjectData | null>(
    restored && !restored.clean ? null : projectData
  );
  const hasUnsavedChanges = savedSnapshot !== projectData && projectData.directions.some((d) => d.items.length > 0);

  // Keep the active tab in range (e.g. after undoing an added stack)
  useEffect(() => {
    if (activeTab > projectData.directions.length - 1) {
      setActiveTab(Math.max(0, projectData.directions.length - 1));
    }
  }, [activeTab, projectData.directions.length]);

  // Autosave to browser storage (debounced)
  useEffect(() => {
    const handle = setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(projectData));
        localStorage.setItem(AUTOSAVE_CLEAN_KEY, savedSnapshot === projectData ? '1' : '0');
      } catch {
        // Quota exceeded (e.g. large images) — autosave is best effort
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [projectData, savedSnapshot]);

  // Warn before leaving with changes that were never written to a file
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  const updateAnalysisSettings = (changes: Partial<AnalysisSettings>) => {
    setProjectData((prev) => ({
      ...prev,
      analysisSettings: { ...DEFAULT_ANALYSIS_SETTINGS, ...prev.analysisSettings, ...changes },
    }));
  };

  const handleToleranceModeChange = (mode: ToleranceMode) => {
    setProjectData((prev) => ({ ...prev, toleranceMode: mode }));
  };

  const handleCalculationModeChange = (mode: CalculationMode) => {
    updateAnalysisSettings({ calculationMode: mode });
  };

  const handleDirectionChange = useCallback(
    (updatedDirection: Direction) => {
      setProjectData(
        (prev) => ({
          ...prev,
          directions: prev.directions.map((dir) => (dir.id === updatedDirection.id ? updatedDirection : dir)),
        }),
        // Merge typing in this stack into one undo step; adding/removing rows changes the key
        `direction:${updatedDirection.id}:${updatedDirection.items.map((i) => i.id).join(',')}`
      );
    },
    [setProjectData]
  );

  const handleAddDirection = () => {
    const newDirection: Direction = {
      id: generateId('dir'),
      name: `Stack ${projectData.directions.length + 1}`,
      items: [],
    };
    setProjectData((prev) => ({ ...prev, directions: [...prev.directions, newDirection] }));
    setActiveTab(projectData.directions.length);
  };

  const handleDeleteDirection = (directionId: string) => {
    if (projectData.directions.length <= 1) return;
    const index = projectData.directions.findIndex((dir) => dir.id === directionId);
    const name = projectData.directions[index]?.name;

    setProjectData((prev) => ({ ...prev, directions: prev.directions.filter((dir) => dir.id !== directionId) }));
    if (activeTab >= index && activeTab > 0) {
      setActiveTab(activeTab - 1);
    }
    setNotice({ message: `Deleted "${name}"`, severity: 'info', undoable: true });
  };

  const handleDuplicateDirection = (directionId: string) => {
    const direction = projectData.directions.find((dir) => dir.id === directionId);
    if (!direction) return;

    // Map old item IDs to new ones so the diagram stays connected
    const idMap = new Map(direction.items.map((item) => [item.id, generateId('item')]));
    const remap = (id: string) => idMap.get(id) ?? id;

    const duplicatedDirection: Direction = {
      ...direction,
      id: generateId('dir'),
      name: `${direction.name} (Copy)`,
      items: direction.items.map((item) => ({ ...item, id: remap(item.id) })),
      diagram: direction.diagram && {
        ...direction.diagram,
        nodes: direction.diagram.nodes.map((n) => ({ ...n, id: remap(n.id) })),
        connectors: direction.diagram.connectors.map((c) => ({
          ...c,
          id: generateId('edge'),
          sourceNodeId: remap(c.sourceNodeId),
          targetNodeId: remap(c.targetNodeId),
        })),
      },
    };

    setProjectData((prev) => ({ ...prev, directions: [...prev.directions, duplicatedDirection] }));
    setActiveTab(projectData.directions.length);
  };

  const handleStartRenaming = (directionId: string, currentName: string) => {
    setEditingTabId(directionId);
    setEditingTabName(currentName);
  };

  const handleSaveRename = () => {
    if (editingTabId && editingTabName.trim()) {
      const id = editingTabId;
      const name = editingTabName.trim();
      setProjectData((prev) => ({
        ...prev,
        directions: prev.directions.map((dir) => (dir.id === id ? { ...dir, name } : dir)),
      }));
    }
    setEditingTabId(null);
    setEditingTabName('');
  };

  const handleCancelRename = () => {
    setEditingTabId(null);
    setEditingTabName('');
  };

  const handleSaveMetadata = (
    metadata: ProjectMetadata,
    unit: ToleranceUnit,
    analysisSettings: AnalysisSettings,
    convertValues: boolean
  ) => {
    setProjectData((prev) => {
      const fromUnit = prev.unit || 'mm';
      const base = convertValues ? convertProjectUnits(prev, fromUnit, unit) : prev;
      return { ...base, metadata, unit, analysisSettings };
    });
  };

  // ----- File operations -----

  const handleNew = () => {
    if (hasUnsavedChanges && !window.confirm('Start a new project? Unsaved changes will be lost.')) return;
    const fresh = createDefaultProject();
    history.reset(fresh);
    setSavedSnapshot(fresh);
    setActiveTab(0);
  };

  const handleSave = useCallback(() => {
    try {
      const now = new Date().toISOString();
      const data: ProjectData = {
        ...projectData,
        metadata: { ...projectData.metadata, createdDate: projectData.metadata?.createdDate || now, modifiedDate: now },
      };
      exportToJSON(data, projectFileName(data, 'json'));
      setSavedSnapshot(projectData);
      setNotice({ message: 'Project saved', severity: 'success' });
    } catch (error) {
      setNotice({ message: 'Failed to save project: ' + (error as Error).message, severity: 'error' });
    }
  }, [projectData]);

  const handleLoadFile = async (file: File) => {
    if (hasUnsavedChanges && !window.confirm('Load a project? Unsaved changes will be lost.')) return;
    try {
      const data = await importFromJSON(file);
      history.reset(data);
      setSavedSnapshot(data);
      setActiveTab(0);
      setNotice({ message: `Loaded "${data.metadata?.projectName || file.name}"`, severity: 'success' });
    } catch (error) {
      setNotice({ message: (error as Error).message, severity: 'error' });
    }
  };

  const handleExportCSV = () => {
    try {
      exportToCSV(projectData, projectFileName(projectData, 'csv'));
      setNotice({ message: 'CSV exported', severity: 'success' });
    } catch (error) {
      setNotice({ message: 'Failed to export CSV: ' + (error as Error).message, severity: 'error' });
    }
  };

  const handleExportReport = () => {
    try {
      openReport(projectData);
    } catch (error) {
      setNotice({ message: 'Failed to create report: ' + (error as Error).message, severity: 'error' });
    }
  };

  // ----- Keyboard shortcuts -----
  const { undo, redo } = history;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      // Dialogs keep their own local edits, so leave undo to the browser there
      const inDialog = !!(e.target as HTMLElement | null)?.closest?.('[role="dialog"]');

      if (key === 's') {
        e.preventDefault();
        handleSave();
      } else if (key === 'o') {
        e.preventDefault();
        document.getElementById('project-file-input')?.click();
      } else if (!inDialog && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur?.();
        undo();
      } else if (!inDialog && ((key === 'z' && e.shiftKey) || key === 'y')) {
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur?.();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave, undo, redo]);

  const analysisSettings = projectData.analysisSettings ?? DEFAULT_ANALYSIS_SETTINGS;

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {projectData.metadata?.projectName || 'RSS Tolerance Stack Calculator'}
            {projectData.metadata?.revision && (
              <Typography component="span" variant="body2" sx={{ ml: 1, opacity: 0.8 }}>
                {projectData.metadata.revision}
              </Typography>
            )}
          </Typography>
          <Tooltip title="Help">
            <IconButton color="inherit" onClick={() => setHelpOpen(true)} aria-label="Help">
              <HelpOutlineIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Project settings">
            <IconButton color="inherit" onClick={() => setSettingsOpen(true)} aria-label="Settings">
              <SettingsIcon />
            </IconButton>
          </Tooltip>
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
                  <FormControlLabel value="symmetric" control={<Radio />} label="Symmetric (±)" />
                  <FormControlLabel value="asymmetric" control={<Radio />} label="Asymmetric (+/-)" />
                </RadioGroup>
              </FormControl>

              <FormControl component="fieldset">
                <FormLabel component="legend">Calculation Mode</FormLabel>
                <RadioGroup
                  row
                  value={analysisSettings.calculationMode}
                  onChange={(e) => handleCalculationModeChange(e.target.value as CalculationMode)}
                >
                  <FormControlLabel value="rss" control={<Radio />} label="RSS (Statistical)" />
                  <FormControlLabel value="worstCase" control={<Radio />} label="Worst-Case" />
                  {analysisSettings.enableMonteCarlo && (
                    <FormControlLabel value="monteCarlo" control={<Radio />} label="Monte Carlo" />
                  )}
                </RadioGroup>
              </FormControl>
            </Box>

            <FileControls
              onNew={handleNew}
              onSave={handleSave}
              onLoadFile={handleLoadFile}
              onExportCSV={handleExportCSV}
              onExportReport={handleExportReport}
              onUndo={history.undo}
              onRedo={history.redo}
              canUndo={history.canUndo}
              canRedo={history.canRedo}
              hasUnsavedChanges={hasUnsavedChanges}
            />
          </Box>
        </Paper>

        {/* Direction Tabs */}
        <Paper elevation={2}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
            <Tabs
              value={Math.min(activeTab, projectData.directions.length - 1)}
              onChange={(_, newValue) => setActiveTab(newValue)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ flexGrow: 1 }}
            >
              {projectData.directions.map((direction, index) => (
                <Tab
                  key={direction.id}
                  component="div"
                  onDoubleClick={() => handleStartRenaming(direction.id, direction.name)}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {editingTabId === direction.id ? (
                        <input
                          type="text"
                          value={editingTabName}
                          aria-label="Stack name"
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
                        <span style={{ cursor: 'pointer' }} title="Double-click to rename">
                          {direction.name}
                        </span>
                      )}
                      {activeTab === index && editingTabId !== direction.id && (
                        <IconButton
                          size="small"
                          component="span"
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
                        component="span"
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
                          component="span"
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
            <Button startIcon={<AddIcon />} onClick={handleAddDirection} sx={{ m: 1 }} variant="outlined" size="small">
              Add Tolerance Stack
            </Button>
          </Box>

          <Box sx={{ p: 2 }}>
            {projectData.directions.map((direction, index) =>
              activeTab === index ? (
                <Box key={direction.id} role="tabpanel">
                  <DirectionTab
                    direction={direction}
                    toleranceMode={projectData.toleranceMode}
                    unit={projectData.unit || 'mm'}
                    calculationMode={analysisSettings.calculationMode}
                    analysisSettings={analysisSettings}
                    onDirectionChange={handleDirectionChange}
                  />
                </Box>
              ) : null
            )}
          </Box>
        </Paper>

        {/* Footer */}
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            RSS Tolerance Stack Calculator — work is autosaved in this browser. Use Save to keep a project file.
          </Typography>
        </Box>
      </Container>

      <Suspense fallback={null}>
        {settingsOpen && (
          <ProjectMetadataEditor
            open={settingsOpen}
            metadata={projectData.metadata || {}}
            unit={projectData.unit || 'mm'}
            analysisSettings={analysisSettings}
            onClose={() => setSettingsOpen(false)}
            onSave={handleSaveMetadata}
          />
        )}
        {helpOpen && <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />}
      </Suspense>

      <Snackbar
        open={notice !== null}
        autoHideDuration={notice?.severity === 'error' ? 8000 : 4000}
        onClose={(_, reason) => reason !== 'clickaway' && setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setNotice(null)}
          severity={notice?.severity ?? 'info'}
          variant="filled"
          action={
            notice?.undoable ? (
              <Button color="inherit" size="small" onClick={() => { history.undo(); setNotice(null); }}>
                Undo
              </Button>
            ) : undefined
          }
        >
          {notice?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default App;
