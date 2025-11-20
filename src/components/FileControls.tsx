import React, { useRef } from 'react';
import { Button, Box, Alert, Snackbar } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import TableChartIcon from '@mui/icons-material/TableChart';
import { ProjectData } from '../types';
import { exportToJSON, importFromJSON, exportToCSV } from '../utils/fileHandlers';

interface FileControlsProps {
  projectData: ProjectData;
  onLoad: (data: ProjectData) => void;
}

const FileControls: React.FC<FileControlsProps> = ({ projectData, onLoad }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [snackbar, setSnackbar] = React.useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const handleSave = () => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `rss-calculation-${timestamp}.json`;
      exportToJSON(projectData, filename);
      setSnackbar({
        open: true,
        message: 'Project saved successfully!',
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to save project: ' + (error as Error).message,
        severity: 'error',
      });
    }
  };

  const handleExportCSV = () => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `rss-calculation-${timestamp}.csv`;
      exportToCSV(projectData, filename);
      setSnackbar({
        open: true,
        message: 'CSV exported successfully!',
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to export CSV: ' + (error as Error).message,
        severity: 'error',
      });
    }
  };

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await importFromJSON(file);
      onLoad(data);
      setSnackbar({
        open: true,
        message: 'Project loaded successfully!',
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to load project: ' + (error as Error).message,
        severity: 'error',
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          color="primary"
          size="small"
        >
          Save
        </Button>
        <Button
          variant="outlined"
          startIcon={<FileUploadIcon />}
          onClick={handleLoadClick}
          color="primary"
          size="small"
        >
          Load
        </Button>
        <Button
          variant="outlined"
          startIcon={<TableChartIcon />}
          onClick={handleExportCSV}
          color="secondary"
          size="small"
        >
          Export CSV
        </Button>
      </Box>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default FileControls;
