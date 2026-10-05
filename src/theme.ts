import { createTheme } from '@mui/material';

// Monospace font for numeric values
export const MONOSPACE_FONT = "'Consolas', 'Monaco', 'Courier New', monospace";

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
  },
  typography: {
    fontFamily: "'Yu Gothic', 'Yu Gothic UI', 'Segoe UI', 'Helvetica Neue', sans-serif",
    fontSize: 13,
  },
});
