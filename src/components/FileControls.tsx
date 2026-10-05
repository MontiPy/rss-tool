import React, { useRef } from 'react';
import { Button, Box, IconButton, Tooltip, Divider } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import TableChartIcon from '@mui/icons-material/TableChart';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import DescriptionIcon from '@mui/icons-material/Description';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';

interface FileControlsProps {
  onNew: () => void;
  onSave: () => void;
  onLoadFile: (file: File) => void;
  onExportCSV: () => void;
  onExportReport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasUnsavedChanges: boolean;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl+';

const FileControls: React.FC<FileControlsProps> = ({
  onNew,
  onSave,
  onLoadFile,
  onExportCSV,
  onExportReport,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  hasUnsavedChanges,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onLoadFile(file);
    // Reset so the same file can be loaded again
    event.target.value = '';
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
      <Tooltip title={`Undo (${mod}Z)`}>
        <span>
          <IconButton size="small" onClick={onUndo} disabled={!canUndo} aria-label="Undo">
            <UndoIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={`Redo (${mod}${isMac ? '⇧Z' : 'Y'})`}>
        <span>
          <IconButton size="small" onClick={onRedo} disabled={!canRedo} aria-label="Redo">
            <RedoIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Divider orientation="vertical" flexItem />
      <Tooltip title="Start a new project">
        <Button variant="outlined" startIcon={<NoteAddIcon />} onClick={onNew} size="small">
          New
        </Button>
      </Tooltip>
      <Tooltip title={`Save project as JSON (${mod}S)${hasUnsavedChanges ? ' — unsaved changes' : ''}`}>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={onSave} size="small">
          Save{hasUnsavedChanges ? ' •' : ''}
        </Button>
      </Tooltip>
      <Tooltip title={`Load project JSON (${mod}O)`}>
        <Button
          variant="outlined"
          startIcon={<FileUploadIcon />}
          onClick={() => fileInputRef.current?.click()}
          size="small"
        >
          Load
        </Button>
      </Tooltip>
      <Button variant="outlined" startIcon={<TableChartIcon />} onClick={onExportCSV} color="secondary" size="small">
        Export CSV
      </Button>
      <Tooltip title="Printable report with all stacks (save as PDF from the print dialog)">
        <Button variant="outlined" startIcon={<DescriptionIcon />} onClick={onExportReport} color="secondary" size="small">
          Report
        </Button>
      </Tooltip>

      <input
        ref={fileInputRef}
        id="project-file-input"
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </Box>
  );
};

export default FileControls;
