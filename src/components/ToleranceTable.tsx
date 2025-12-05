import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Checkbox,
  IconButton,
  Button,
  Paper,
  Typography,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Select,
  MenuItem,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import NotesIcon from '@mui/icons-material/Notes';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { ToleranceItem, ToleranceMode, CalculationMode } from '../types';
import { FLOAT_FACTORS } from '../utils/rssCalculator';
import { MONOSPACE_FONT } from '../App';
import ImageUpload from './ImageUpload';

interface ToleranceTableProps {
  items: ToleranceItem[];
  toleranceMode: ToleranceMode;
  onItemsChange: (items: ToleranceItem[]) => void;
  calculationMode: CalculationMode;
  useAdvancedDistributions?: boolean;
}

const ToleranceTable: React.FC<ToleranceTableProps> = ({
  items,
  toleranceMode,
  onItemsChange,
  calculationMode,
  useAdvancedDistributions = false,
}) => {
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ToleranceItem | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editSource, setEditSource] = useState('');

  const handleOpenNotes = (item: ToleranceItem) => {
    setEditingItem(item);
    setEditNotes(item.notes || '');
    setEditSource(item.source || '');
    setNotesDialogOpen(true);
  };

  const handleSaveNotes = () => {
    if (editingItem) {
      handleItemChange(editingItem.id, 'notes', editNotes);
      handleItemChange(editingItem.id, 'source', editSource);
    }
    setNotesDialogOpen(false);
  };

  const handleAddItem = () => {
    const newItem: ToleranceItem = {
      id: `item-${Date.now()}`,
      name: `Item ${items.length + 1}`,
      nominal: 0,
      tolerancePlus: 0.5,
      toleranceMinus: 0.5,
      floatFactor: FLOAT_FACTORS.FIXED,
    };
    onItemsChange([...items, newItem]);
  };

  const handleDeleteItem = (id: string) => {
    onItemsChange(items.filter((item) => item.id !== id));
  };

  const handleDuplicateItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const duplicatedItem: ToleranceItem = {
      ...item,
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `${item.name} (Copy)`,
    };

    // Insert the duplicated item right after the original
    const index = items.findIndex((i) => i.id === id);
    const newItems = [...items];
    newItems.splice(index + 1, 0, duplicatedItem);
    onItemsChange(newItems);
  };

  const handleItemChange = (
    id: string,
    field: keyof ToleranceItem,
    value: string | number | boolean
  ) => {
    onItemsChange(
      items.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          // In symmetric mode, keep plus and minus the same
          if (toleranceMode === 'symmetric' && field === 'tolerancePlus') {
            updatedItem.toleranceMinus = value as number;
          }
          return updatedItem;
        }
        return item;
      })
    );
  };

  const handleImageUpload = (itemId: string, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      handleItemChange(itemId, 'imageUrl', reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <Box>
      <TableContainer component={Paper} elevation={0} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>Item</strong></TableCell>
              <TableCell align="right"><strong>Nominal</strong></TableCell>
              <TableCell align="right">
                <strong>
                  {toleranceMode === 'symmetric' ? 'Tolerance (±)' : 'Tolerance (+)'}
                </strong>
              </TableCell>
              {toleranceMode === 'asymmetric' && (
                <TableCell align="right"><strong>Tolerance (-)</strong></TableCell>
              )}
              {calculationMode !== 'monteCarlo' && (
                <TableCell align="center">
                  <strong>Float (√3)</strong>
                </TableCell>
              )}
              {calculationMode === 'monteCarlo' && useAdvancedDistributions && (
                <TableCell align="center"><strong>Distribution</strong></TableCell>
              )}
              <TableCell align="center"><strong>Image</strong></TableCell>
              <TableCell align="center"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <TextField
                    value={item.name}
                    onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                    size="small"
                    fullWidth
                  />
                </TableCell>
                <TableCell align="right">
                  <TextField
                    type="number"
                    value={item.nominal ?? 0}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      handleItemChange(item.id, 'nominal', value);
                    }}
                    size="small"
                    inputProps={{ step: 0.001 }}
                    sx={{ width: 100, '& input': { fontFamily: MONOSPACE_FONT } }}
                  />
                </TableCell>
                <TableCell align="right">
                  <TextField
                    type="number"
                    value={item.tolerancePlus}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      handleItemChange(item.id, 'tolerancePlus', Math.max(0, value));
                    }}
                    size="small"
                    inputProps={{ step: 0.01, min: 0 }}
                    error={item.tolerancePlus < 0}
                    helperText={item.tolerancePlus < 0 ? 'Must be ≥ 0' : ''}
                    sx={{ '& input': { fontFamily: MONOSPACE_FONT } }}
                  />
                </TableCell>
                {toleranceMode === 'asymmetric' && (
                  <TableCell align="right">
                    <TextField
                      type="number"
                      value={item.toleranceMinus}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        handleItemChange(item.id, 'toleranceMinus', Math.max(0, value));
                      }}
                      size="small"
                      inputProps={{ step: 0.01, min: 0 }}
                      error={item.toleranceMinus < 0}
                      helperText={item.toleranceMinus < 0 ? 'Must be ≥ 0' : ''}
                      sx={{ '& input': { fontFamily: MONOSPACE_FONT } }}
                    />
                  </TableCell>
                )}
                {calculationMode !== 'monteCarlo' && (
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                      <Checkbox
                        checked={item.floatFactor > 1.5}
                        onChange={(e) => handleItemChange(
                          item.id,
                          'floatFactor',
                          e.target.checked ? FLOAT_FACTORS.SQRT3 : FLOAT_FACTORS.FIXED
                        )}
                        size="small"
                      />
                      <Typography variant="caption" color="text.secondary">
                        {item.floatFactor > 1.5 ? `(${FLOAT_FACTORS.SQRT3.toFixed(3)})` : '(1.0)'}
                      </Typography>
                    </Box>
                  </TableCell>
                )}
                {calculationMode === 'monteCarlo' && useAdvancedDistributions && (
                  <TableCell align="center">
                    <Select
                      value={item.distributionType || 'normal'}
                      onChange={(e) => handleItemChange(item.id, 'distributionType', e.target.value)}
                      size="small"
                      sx={{ width: 110 }}
                    >
                      <MenuItem value="normal">Normal</MenuItem>
                      <MenuItem value="uniform">Uniform</MenuItem>
                      <MenuItem value="triangular">Triangular</MenuItem>
                    </Select>
                  </TableCell>
                )}
                <TableCell align="center">
                  <ImageUpload
                    onImageUpload={(file) => handleImageUpload(item.id, file)}
                    imageUrl={item.imageUrl}
                  />
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="Add notes/source">
                    <IconButton
                      onClick={() => handleOpenNotes(item)}
                      size="small"
                      color={item.notes || item.source ? 'primary' : 'default'}
                    >
                      <NotesIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Duplicate item">
                    <IconButton
                      onClick={() => handleDuplicateItem(item.id)}
                      size="small"
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <IconButton
                    onClick={() => handleDeleteItem(item.id)}
                    color="error"
                    size="small"
                    title="Delete item"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box mt={1}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddItem}
          size="small"
        >
          Add Row
        </Button>
      </Box>

      {/* Notes/Source Dialog */}
      <Dialog open={notesDialogOpen} onClose={() => setNotesDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Item Details: {editingItem?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Source Reference"
              value={editSource}
              onChange={(e) => setEditSource(e.target.value)}
              placeholder="e.g., DWG-12345, Part #ABC-001"
              fullWidth
              helperText="Drawing number, part number, or specification reference"
            />
            <TextField
              label="Notes"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Additional notes or comments"
              fullWidth
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotesDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveNotes} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ToleranceTable;
