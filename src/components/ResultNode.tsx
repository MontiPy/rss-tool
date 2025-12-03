import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Box, Typography } from '@mui/material';
import { ResultNodeData } from '../types';

const ResultNode: React.FC<NodeProps<ResultNodeData>> = ({ data }) => {
  const {
    targetNominal,
    variance,
    rssTotal,
    unit,
  } = data;

  // Variance color: green if positive/zero, red if negative
  const varianceColor = variance >= 0 ? '#4caf50' : '#d32f2f';

  return (
    <Box
      sx={{
        minWidth: 280,
        maxWidth: 320,
        background: '#fff',
        border: '2px solid #4caf50',
        borderRadius: 2,
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        '&:hover': {
          boxShadow: '0 6px 12px rgba(0,0,0,0.15)',
        },
      }}
    >
      {/* Connection Handles (left side) */}
      <Handle
        type="target"
        position={Position.Left}
        id="left-top"
        style={{ background: '#4caf50', width: 10, height: 10, top: '20%' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left-bottom"
        style={{ background: '#4caf50', width: 10, height: 10, top: '80%' }}
      />

      {/* Header */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)',
          color: '#fff',
          p: 1.5,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
        }}
      >
        <Typography variant="body1" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
          STACK RESULT
        </Typography>
      </Box>

      {/* Content */}
      <Box sx={{ p: 2 }}>
        {/* Target Nominal */}
        {targetNominal !== undefined && (
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Target Nominal:</strong> {targetNominal.toFixed(3)} {unit}
          </Typography>
        )}

        {/* Variance (only if target exists) */}
        {targetNominal !== undefined && (
          <Typography variant="body2" sx={{ mb: 1, color: varianceColor }}>
            <strong>Variance:</strong> {variance >= 0 ? '+' : ''}{variance.toFixed(3)} {unit}
          </Typography>
        )}

        {/* RSS Total */}
        <Typography variant="body2">
          <strong>RSS Total:</strong> ±{rssTotal.toFixed(3)} {unit}
        </Typography>
      </Box>
    </Box>
  );
};

// Memo to prevent unnecessary re-renders
export default memo(ResultNode);
