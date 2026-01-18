import { createTheme } from '@mui/material';

// Custom theme with Yu Gothic font and increased font size
export const theme = createTheme({
  typography: {
    fontFamily: "'Yu Gothic', 'Yu Gothic UI', 'Segoe UI', 'Helvetica Neue', sans-serif",
    fontSize: 13,
  },
});

// Monospace font for numeric values
export const MONOSPACE_FONT = "'Consolas', 'Monaco', 'Courier New', monospace";
