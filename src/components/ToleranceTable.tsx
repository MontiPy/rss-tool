import { useState, useCallback } from 'react';
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
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ToleranceItem, ToleranceMode, CalculationMode } from '../types';
import { FLOAT_FACTORS } from '../utils/rssCalculator';
import { MONOSPACE_FONT } from '../theme';
import ImageUpload from './ImageUpload';

interface ToleranceTableProps {
  items: ToleranceItem[];
  toleranceMode: ToleranceMode;
  onItemsChange: (items: ToleranceItem[]) => void;
  calculationMode: CalculationMode;
  useAdvancedDistributions?: boolean;
}

interface SortableRowProps {
  item: ToleranceItem;
  toleranceMode: ToleranceMode;
  calculationMode: CalculationMode;
  useAdvancedDistributions: boolean;
  onItemChange: (id: string, field: keyof ToleranceItem, value: string | number | boolean) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onOpenNotes: (item: ToleranceItem) => void;
  onImageUpload: (itemId: string, file: File) => void;
}

const SortableRow: React.FC<SortableRowProps> = ({
  item,
  toleranceMode,
  calculationMode,
  useAdvancedDistributions,
  onItemChange,
  onDelete,
  onDuplicate,
  onOpenNotes,
  onImageUpload,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isDragging ? 'rgba(25, 118, 210, 0.08)' : undefined,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell sx={{ width: 30, padding: '4px 8px' }}>
        <IconButton
          {...attributes}
          {...listeners}
          size="small"
          sx={{ cursor: 'grab', '&:active': { cursor: 'grabbing' } }}
          aria-label="Drag to reorder"
        >
          <DragIndicatorIcon fontSize="small" />
        </IconButton>
      </TableCell>
      <TableCell>
        <TextField
          value={item.name}
          onChange={(e) => onItemChange(item.id, 'name', e.target.value)}
          size="small"
          fullWidth
          aria-label="Item name"
        />
      </TableCell>
      <TableCell align="right">
        <TextField
          type="number"
          value={item.nominal ?? 0}
          onChange={(e) => {
            const value = parseFloat(e.target.value) || 0;
            onItemChange(item.id, 'nominal', value);
          }}
          size="small"
          inputProps={{ step: 0.001, 'aria-label': 'Nominal value' }}
          sx={{ width: 100, '& input': { fontFamily: MONOSPACE_FONT } }}
        />
      </TableCell>
      <TableCell align="right">
        <TextField
          type="number"
          value={item.tolerancePlus}
          onChange={(e) => {
            const value = parseFloat(e.target.value) || 0;
            onItemChange(item.id, 'tolerancePlus', Math.max(0, value));
          }}
          size="small"
          inputProps={{ step: 0.01, min: 0, 'aria-label': 'Tolerance plus' }}
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
              onItemChange(item.id, 'toleranceMinus', Math.max(0, value));
            }}
            size="small"
            inputProps={{ step: 0.01, min: 0, 'aria-label': 'Tolerance minus' }}
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
              onChange={(e) => onItemChange(
                item.id,
                'floatFactor',
                e.target.checked ? FLOAT_FACTORS.SQRT3 : FLOAT_FACTORS.FIXED
              )}
              size="small"
              inputProps={{ 'aria-label': 'Float factor checkbox' }}
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
            onChange={(e) => onItemChange(item.id, 'distributionType', e.target.value)}
            size="small"
            sx={{ width: 110 }}
            aria-label="Distribution type"
          >
            <MenuItem value="normal">Normal</MenuItem>
            <MenuItem value="uniform">Uniform</MenuItem>
            <MenuItem value="triangular">Triangular</MenuItem>
          </Select>
        </TableCell>
      )}
      <TableCell align="center">
        <ImageUpload
          onImageUpload={(file) => onImageUpload(item.id, file)}
          imageUrl={item.imageUrl}
        />
      </TableCell>
      <TableCell align="center">
        <Tooltip title="Add notes/source">
          <IconButton
            onClick={() => onOpenNotes(item)}
            size="small"
            color={item.notes || item.source ? 'primary' : 'default'}
            aria-label="Add notes"
          >
            <NotesIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Duplicate item">
          <IconButton
            onClick={() => onDuplicate(item.id)}
            size="small"
            aria-label="Duplicate item"
          >
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete item">
          <IconButton
            onClick={() => onDelete(item.id)}
            color="error"
            size="small"
            aria-label="Delete item"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
};

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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      onItemsChange(arrayMove(items, oldIndex, newIndex));
    }
  }, [items, onItemsChange]);

  const handleOpenNotes = useCallback((item: ToleranceItem) => {
    setEditingItem(item);
    setEditNotes(item.notes || '');
    setEditSource(item.source || '');
    setNotesDialogOpen(true);
  }, []);

  const handleSaveNotes = useCallback(() => {
    if (editingItem) {
      onItemsChange(
        items.map((item) => {
          if (item.id === editingItem.id) {
            return { ...item, notes: editNotes, source: editSource };
          }
          return item;
        })
      );
    }
    setNotesDialogOpen(false);
  }, [editingItem, editNotes, editSource, items, onItemsChange]);

  const handleAddItem = useCallback(() => {
    const newItem: ToleranceItem = {
      id: `item-${Date.now()}`,
      name: `Item ${items.length + 1}`,
      nominal: 0,
      tolerancePlus: 0.5,
      toleranceMinus: 0.5,
      floatFactor: FLOAT_FACTORS.FIXED,
    };
    onItemsChange([...items, newItem]);
  }, [items, onItemsChange]);

  const handleDeleteItem = useCallback((id: string) => {
    onItemsChange(items.filter((item) => item.id !== id));
  }, [items, onItemsChange]);

  const handleDuplicateItem = useCallback((id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const duplicatedItem: ToleranceItem = {
      ...item,
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `${item.name} (Copy)`,
    };

    const index = items.findIndex((i) => i.id === id);
    const newItems = [...items];
    newItems.splice(index + 1, 0, duplicatedItem);
    onItemsChange(newItems);
  }, [items, onItemsChange]);

  const handleItemChange = useCallback((
    id: string,
    field: keyof ToleranceItem,
    value: string | number | boolean
  ) => {
    onItemsChange(
      items.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          if (toleranceMode === 'symmetric' && field === 'tolerancePlus') {
            updatedItem.toleranceMinus = value as number;
          }
          return updatedItem;
        }
        return item;
      })
    );
  }, [items, onItemsChange, toleranceMode]);

  const handleImageUpload = useCallback((itemId: string, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      handleItemChange(itemId, 'imageUrl', reader.result as string);
    };
    reader.readAsDataURL(file);
  }, [handleItemChange]);

  return (
    <Box>
      <TableContainer component={Paper} elevation={0} variant="outlined">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <Table size="small" aria-label="Tolerance items table">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 30 }}></TableCell>
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
              <SortableContext
                items={items.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                {items.map((item) => (
                  <SortableRow
                    key={item.id}
                    item={item}
                    toleranceMode={toleranceMode}
                    calculationMode={calculationMode}
                    useAdvancedDistributions={useAdvancedDistributions}
                    onItemChange={handleItemChange}
                    onDelete={handleDeleteItem}
                    onDuplicate={handleDuplicateItem}
                    onOpenNotes={handleOpenNotes}
                    onImageUpload={handleImageUpload}
                  />
                ))}
              </SortableContext>
            </TableBody>
          </Table>
        </DndContext>
      </TableContainer>
      <Box mt={1}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddItem}
          size="small"
          aria-label="Add new tolerance item"
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
