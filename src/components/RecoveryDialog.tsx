import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import DeleteIcon from '@mui/icons-material/Delete';
import { ProjectData } from '../types';

interface RecoveryDialogProps {
  open: boolean;
  recoveryData: ProjectData | null;
  recoveryTimestamp: number | null;
  onRecover: (data: ProjectData) => void;
  onDiscard: () => void;
}

/**
 * Dialog shown when auto-saved data is detected from a previous session.
 * Allows user to recover their work or discard the saved data.
 */
const RecoveryDialog: React.FC<RecoveryDialogProps> = ({
  open,
  recoveryData,
  recoveryTimestamp,
  onRecover,
  onDiscard,
}) => {
  if (!recoveryData || !recoveryTimestamp) {
    return null;
  }

  const formattedDate = new Date(recoveryTimestamp).toLocaleString();
  const timeSince = getTimeSince(recoveryTimestamp);

  const projectName = recoveryData.metadata?.projectName || 'Untitled Project';
  const directionCount = recoveryData.directions?.length || 0;
  const totalItems = recoveryData.directions?.reduce(
    (sum, dir) => sum + (dir.items?.length || 0),
    0
  ) || 0;

  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RestoreIcon color="primary" />
          Recover Unsaved Work
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          We found auto-saved data from a previous session. Would you like to
          recover it?
        </Alert>

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Project Details
          </Typography>
          <Box
            sx={{
              p: 2,
              bgcolor: 'action.hover',
              borderRadius: 1,
            }}
          >
            <Typography variant="body2">
              <strong>Name:</strong> {projectName}
            </Typography>
            <Typography variant="body2">
              <strong>Tolerance Stacks:</strong> {directionCount}
            </Typography>
            <Typography variant="body2">
              <strong>Total Items:</strong> {totalItems}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Last saved: {formattedDate} ({timeSince})
            </Typography>
          </Box>
        </Box>

        <Typography variant="caption" color="text.secondary">
          Note: Choosing to discard will permanently delete the auto-saved data.
          This action cannot be undone.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onDiscard}
          startIcon={<DeleteIcon />}
          color="error"
          variant="outlined"
        >
          Discard
        </Button>
        <Button
          onClick={() => onRecover(recoveryData)}
          startIcon={<RestoreIcon />}
          variant="contained"
          autoFocus
        >
          Recover
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * Helper function to format time since a timestamp
 */
function getTimeSince(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

export default RecoveryDialog;
