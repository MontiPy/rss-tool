import React, { useRef, useState } from 'react';
import { Button, Box, Alert, Snackbar, Tooltip, CircularProgress } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import TableChartIcon from '@mui/icons-material/TableChart';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { ProjectData } from '../types';
import { exportToJSON, importFromJSON, exportToCSV } from '../utils/fileHandlers';
import { exportToPDF } from '../utils/pdfExport';

interface FileControlsProps {
  projectData: ProjectData;
  onLoad: (data: ProjectData) => void;
}

const FileControls: React.FC<FileControlsProps> = ({ projectData, onLoad }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const handleSave = () => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const projectName = projectData.metadata?.projectName?.replace(/\s+/g, '-').toLowerCase() || 'rss-calculation';
      const filename = `${projectName}-${timestamp}.json`;
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
      const projectName = projectData.metadata?.projectName?.replace(/\s+/g, '-').toLowerCase() || 'rss-calculation';
      const filename = `${projectName}-${timestamp}.csv`;
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

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const projectName = projectData.metadata?.projectName?.replace(/\s+/g, '-').toLowerCase() || 'tolerance-analysis';
      const filename = `${projectName}-${timestamp}.pdf`;
      await exportToPDF(projectData, filename);
      setSnackbar({
        open: true,
        message: 'PDF exported successfully!',
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to export PDF: ' + (error as Error).message,
        severity: 'error',
      });
    } finally {
      setIsExportingPDF(false);
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
    <Box role="group" aria-label="File operations">
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Tooltip title="Save project as JSON file">
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            color="primary"
            size="small"
            aria-label="Save project to JSON file"
          >
            Save
          </Button>
        </Tooltip>
        <Tooltip title="Load project from JSON file">
          <Button
            variant="outlined"
            startIcon={<FileUploadIcon />}
            onClick={handleLoadClick}
            color="primary"
            size="small"
            aria-label="Load project from JSON file"
          >
            Load
          </Button>
        </Tooltip>
        <Tooltip title="Export data to CSV spreadsheet">
          <Button
            variant="outlined"
            startIcon={<TableChartIcon />}
            onClick={handleExportCSV}
            color="secondary"
            size="small"
            aria-label="Export to CSV spreadsheet"
          >
            CSV
          </Button>
        </Tooltip>
        <Tooltip title="Export analysis report to PDF">
          <Button
            variant="outlined"
            startIcon={isExportingPDF ? <CircularProgress size={18} /> : <PictureAsPdfIcon />}
            onClick={handleExportPDF}
            color="secondary"
            size="small"
            disabled={isExportingPDF}
            aria-label="Export to PDF report"
          >
            PDF
          </Button>
        </Tooltip>
      </Box>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        aria-label="File input for loading project"
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default FileControls;
