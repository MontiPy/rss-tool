import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Box, Typography, Divider, Collapse, IconButton } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { ToleranceItem, ToleranceMode, ToleranceUnit } from '../types';

// Node data structure
export interface ToleranceItemNodeData {
  item: ToleranceItem;
  toleranceMode: ToleranceMode;
  unit: ToleranceUnit;
  onUpdate?: (item: ToleranceItem) => void;
}

const ToleranceItemNode: React.FC<NodeProps<ToleranceItemNodeData>> = ({ data }) => {
  const { item, toleranceMode, unit } = data;
  const [expanded, setExpanded] = useState(false);

  // Determine node color based on float factor
  const isFloating = item.floatFactor > 1.0;
  const headerColor = isFloating ? '#ff9800' : '#1976d2'; // Orange for floating, blue for fixed
  const headerGradient = isFloating
    ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
    : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)';

  // Format tolerance display based on mode
  const toleranceDisplay = toleranceMode === 'symmetric'
    ? `±${item.tolerancePlus.toFixed(3)} ${unit}`
    : `+${item.tolerancePlus.toFixed(3)}/-${item.toleranceMinus.toFixed(3)} ${unit}`;

  // Has metadata?
  const hasMetadata = Boolean(item.notes || item.source);

  return (
    <Box
      sx={{
        minWidth: 250,
        maxWidth: 300,
        background: '#fff',
        border: `2px solid ${headerColor}`,
        borderRadius: 2,
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        '&:hover': {
          boxShadow: '0 6px 12px rgba(0,0,0,0.15)',
        },
      }}
    >
      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: headerColor, width: 10, height: 10 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: headerColor, width: 10, height: 10 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: headerColor, width: 10, height: 10 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: headerColor, width: 10, height: 10 }}
      />

      {/* Header */}
      <Box
        sx={{
          background: headerGradient,
          color: '#fff',
          p: 1.5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="body1" sx={{ fontWeight: 600, flex: 1 }}>
          {item.name}
        </Typography>
      </Box>

      {/* Main Content */}
      <Box sx={{ p: 1.5 }}>
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          <strong>Tolerance:</strong> {toleranceDisplay}
        </Typography>
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          <strong>Float:</strong> {isFloating ? '√3' : '1.0'} ({item.floatFactor.toFixed(3)})
        </Typography>
      </Box>

      {/* Metadata Section (Collapsible) */}
      {hasMetadata && (
        <>
          <Divider />
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 1.5,
              py: 0.5,
              cursor: 'pointer',
              bgcolor: expanded ? 'action.hover' : 'transparent',
              '&:hover': { bgcolor: 'action.hover' },
            }}
            onClick={() => setExpanded(!expanded)}
          >
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              Details
            </Typography>
            <IconButton size="small" sx={{ p: 0 }}>
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Box>
          <Collapse in={expanded}>
            <Box sx={{ px: 1.5, pb: 1.5, pt: 0.5 }}>
              {item.source && (
                <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                  <strong>Source:</strong> {item.source}
                </Typography>
              )}
              {item.notes && (
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  <strong>Notes:</strong> {item.notes}
                </Typography>
              )}
            </Box>
          </Collapse>
        </>
      )}
    </Box>
  );
};

// Memo to prevent unnecessary re-renders
export default memo(ToleranceItemNode);
