import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
} from '@mui/material';
import {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import { Direction, ToleranceMode, ToleranceUnit, DiagramData, DiagramNode, DiagramConnector } from '../types';
import DiagramCanvas from './DiagramCanvas';
import { ToleranceItemNodeData } from './ToleranceItemNode';

interface DiagramBuilderDialogProps {
  open: boolean;
  onClose: () => void;
  direction: Direction;
  toleranceMode: ToleranceMode;
  unit: ToleranceUnit;
  onSave: (updatedDirection: Direction) => void;
}

const DiagramBuilderDialog: React.FC<DiagramBuilderDialogProps> = ({
  open,
  onClose,
  direction,
  toleranceMode,
  unit,
  onSave,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize nodes and edges from direction data
  useEffect(() => {
    if (open && direction) {
      initializeDiagram();
    }
  }, [open, direction.id]); // Only reinitialize when dialog opens or direction changes

  // Track changes to positions/edges
  useEffect(() => {
    if (open && nodes.length > 0) {
      setHasChanges(true);
    }
  }, [nodes, edges]);

  // Initialize diagram: convert Direction.items to React Flow nodes
  const initializeDiagram = () => {
    const existingDiagram = direction.diagram;
    const newNodes: Node<ToleranceItemNodeData>[] = [];

    direction.items.forEach((item, index) => {
      // Find existing position from saved diagram
      const existingNode = existingDiagram?.nodes.find(n => n.id === item.id);
      const position = existingNode
        ? existingNode.position
        : { x: 100, y: 100 + index * 150 }; // Auto-position: vertical stack with 150px spacing

      newNodes.push({
        id: item.id,
        type: 'toleranceItem',
        position,
        data: {
          item,
          toleranceMode,
          unit,
        },
      });
    });

    // Convert saved connectors to React Flow edges
    const newEdges: Edge[] = existingDiagram?.connectors.map(connector => ({
      id: connector.id,
      source: connector.sourceNodeId,
      target: connector.targetNodeId,
      label: connector.label,
      animated: connector.animated || false,
      style: {
        stroke: connector.style?.strokeColor || '#888',
        strokeWidth: connector.style?.strokeWidth || 2,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: connector.style?.strokeColor || '#888',
      },
    })) || [];

    setNodes(newNodes);
    setEdges(newEdges);
    setHasChanges(false);
  };

  // Handle new connection between nodes
  const onConnect = useCallback((connection: Connection) => {
    // Ensure source and target are valid strings
    if (!connection.source || !connection.target) return;

    const newEdge: Edge = {
      id: `e${connection.source}-${connection.target}-${Date.now()}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      animated: false,
      type: 'smoothstep',
      style: { stroke: '#888', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#888',
      },
    };
    setEdges((eds) => addEdge(newEdge, eds));
    setHasChanges(true);
  }, []);

  // Convert React Flow state back to DiagramData
  const convertToDiagramData = (): DiagramData => {
    const diagramNodes: DiagramNode[] = nodes.map(node => ({
      id: node.id,
      position: node.position,
      width: node.width ?? undefined,
      height: node.height ?? undefined,
    }));

    const connectors: DiagramConnector[] = edges.map(edge => ({
      id: edge.id || `${edge.source}-${edge.target}`,
      sourceNodeId: edge.source,
      targetNodeId: edge.target,
      label: edge.label as string | undefined,
      animated: edge.animated,
      style: {
        strokeColor: (edge.style as any)?.stroke,
        strokeWidth: (edge.style as any)?.strokeWidth,
      },
    }));

    return {
      nodes: diagramNodes,
      connectors,
    };
  };

  // Handle save button click
  const handleSave = () => {
    const diagramData = convertToDiagramData();
    const updatedDirection: Direction = {
      ...direction,
      diagram: diagramData,
    };
    onSave(updatedDirection);
    setHasChanges(false);
    onClose();
  };

  // Handle cancel button click
  const handleCancel = () => {
    if (hasChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Do you want to discard them?'
      );
      if (!confirmed) return;
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth={false}
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          width: '95vw',
          height: '90vh',
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            Stack Diagram: {direction.name}
          </Typography>
          {hasChanges && (
            <Typography variant="caption" color="warning.main">
              Unsaved changes
            </Typography>
          )}
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
        <DiagramCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleCancel} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DiagramBuilderDialog;
