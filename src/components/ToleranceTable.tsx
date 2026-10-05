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
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { ToleranceItem, ToleranceMode, CalculationMode } from '../types';
import { FLOAT_FACTORS, getStackNominal, isFloatingItem } from '../utils/rssCalculator';
import { createDefaultItem, generateId } from '../utils/projectDefaults';
import NumericField from './NumericField';
import { MONOSPACE_FONT } from '../theme';
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
      // Update both fields in one change so neither overwrites the other
      updateItem(editingItem.id, {
        notes: editNotes.trim() || undefined,
        source: editSource.trim() || undefined,
      });
    }
    setNotesDialogOpen(false);
  };

  const handleAddItem = () => {
    onItemsChange([...items, createDefaultItem(items.length + 1)]);
  };

  const handleMoveItem = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const newItems = [...items];
    [newItems[index], newItems[target]] = [newItems[target], newItems[index]];
    onItemsChange(newItems);
  };

  const handleDeleteItem = (id: string) => {
    onItemsChange(items.filter((item) => item.id !== id));
  };

  const handleDuplicateItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const duplicatedItem: ToleranceItem = {
      ...item,
      id: generateId('item'),
      name: `${item.name} (Copy)`,
    };

    // Insert the duplicated item right after the original
    const index = items.findIndex((i) => i.id === id);
    const newItems = [...items];
    newItems.splice(index + 1, 0, duplicatedItem);
    onItemsChange(newItems);
  };

  const updateItem = (id: string, changes: Partial<ToleranceItem>) => {
    onItemsChange(
      items.map((item) => {
        if (item.id !== id) return item;
        const updatedItem = { ...item, ...changes };
        // In symmetric mode, keep plus and minus the same
        if (toleranceMode === 'symmetric' && changes.tolerancePlus !== undefined) {
          updatedItem.toleranceMinus = changes.tolerancePlus;
        }
        return updatedItem;
      })
    );
  };

  const handleItemChange = <K extends keyof ToleranceItem>(id: string, field: K, value: ToleranceItem[K]) => {
    updateItem(id, { [field]: value } as Partial<ToleranceItem>);
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
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  No items yet — click “Add Row” or import from CSV.
                </TableCell>
              </TableRow>
            )}
            {items.map((item, index) => (
              <TableRow key={item.id} hover>
                <TableCell>
                  <TextField
                    value={item.name}
                    onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                    size="small"
                    fullWidth
                  />
                </TableCell>
                <TableCell align="right">
                  <NumericField
                    value={item.nominal ?? 0}
                    onChange={(value) => handleItemChange(item.id, 'nominal', value ?? 0)}
                    size="small"
                    step={0.001}
                    inputProps={{ 'aria-label': `${item.name} nominal` }}
                    sx={{ width: 100, '& input': { fontFamily: MONOSPACE_FONT, textAlign: 'right' } }}
                  />
                </TableCell>
                <TableCell align="right">
                  <NumericField
                    value={item.tolerancePlus}
                    onChange={(value) => handleItemChange(item.id, 'tolerancePlus', value ?? 0)}
                    size="small"
                    min={0}
                    step={0.01}
                    inputProps={{ 'aria-label': `${item.name} tolerance plus` }}
                    sx={{ width: 100, '& input': { fontFamily: MONOSPACE_FONT, textAlign: 'right' } }}
                  />
                </TableCell>
                {toleranceMode === 'asymmetric' && (
                  <TableCell align="right">
                    <NumericField
                      value={item.toleranceMinus}
                      onChange={(value) => handleItemChange(item.id, 'toleranceMinus', value ?? 0)}
                      size="small"
                      min={0}
                      step={0.01}
                      inputProps={{ 'aria-label': `${item.name} tolerance minus` }}
                      sx={{ width: 100, '& input': { fontFamily: MONOSPACE_FONT, textAlign: 'right' } }}
                    />
                  </TableCell>
                )}
                {calculationMode !== 'monteCarlo' && (
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                      <Checkbox
                        checked={isFloatingItem(item)}
                        inputProps={{ 'aria-label': `${item.name} floating` }}
                        onChange={(e) => handleItemChange(
                          item.id,
                          'floatFactor',
                          e.target.checked ? FLOAT_FACTORS.SQRT3 : FLOAT_FACTORS.FIXED
                        )}
                        size="small"
                      />
                      <Typography variant="caption" color="text.secondary">
                        ({item.floatFactor === 1 ? '1.0' : item.floatFactor.toFixed(3)})
                      </Typography>
                    </Box>
                  </TableCell>
                )}
                {calculationMode === 'monteCarlo' && useAdvancedDistributions && (
                  <TableCell align="center">
                    <Select
                      value={item.distributionType || 'normal'}
                      onChange={(e) => handleItemChange(item.id, 'distributionType', e.target.value as ToleranceItem['distributionType'])}
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
                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                  <Tooltip title="Move up">
                    <span>
                      <IconButton size="small" onClick={() => handleMoveItem(index, -1)} disabled={index === 0} aria-label="Move up">
                        <ArrowUpwardIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Move down">
                    <span>
                      <IconButton size="small" onClick={() => handleMoveItem(index, 1)} disabled={index === items.length - 1} aria-label="Move down">
                        <ArrowDownwardIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={item.notes || item.source ? [item.source, item.notes].filter(Boolean).join(' — ') : 'Add notes/source'}>
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
                  <Tooltip title="Delete item">
                    <IconButton
                      onClick={() => handleDeleteItem(item.id)}
                      color="error"
                      size="small"
                      aria-label="Delete item"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box mt={1} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddItem}
          size="small"
        >
          Add Row
        </Button>
        {items.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: MONOSPACE_FONT }}>
            {items.length} item{items.length === 1 ? '' : 's'} · Σ nominal = {getStackNominal(items).toFixed(4)}
          </Typography>
        )}
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
