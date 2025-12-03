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
  NodeChange,
} from 'reactflow';
import { Direction, ToleranceMode, ToleranceUnit, DiagramData, DiagramNode, DiagramConnector, RSSResult, ResultNodeData } from '../types';
import DiagramCanvas from './DiagramCanvas';
import { ToleranceItemNodeData } from './ToleranceItemNode';

interface DiagramBuilderDialogProps {
  open: boolean;
  onClose: () => void;
  direction: Direction;
  toleranceMode: ToleranceMode;
  unit: ToleranceUnit;
  rssResult: RSSResult | null;
  onSave: (updatedDirection: Direction) => void;
}

const DiagramBuilderDialog: React.FC<DiagramBuilderDialogProps> = ({
  open,
  onClose,
  direction,
  toleranceMode,
  unit,
  rssResult,
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

    // Calculate nominal sum for result node
    const calculatedNominal = direction.items.reduce((sum, item) => sum + (item.nominal ?? 0), 0);
    const variance = direction.targetNominal !== undefined
      ? calculatedNominal - direction.targetNominal
      : 0;

    // Create result node (always present)
    const resultNodeId = `result-${direction.id}`;
    const existingResultNode = existingDiagram?.resultNodePosition;

    // Position: right side of tolerance items
    // Calculate rightmost x position + offset
    const maxX = newNodes.length > 0
      ? Math.max(...newNodes.map(n => n.position.x))
      : 100;
    const resultPosition = existingResultNode
      ? existingResultNode
      : { x: maxX + 400, y: 100 };  // 400px to the right, align with top

    const resultNode: Node<ResultNodeData> = {
      id: resultNodeId,
      type: 'result',
      position: resultPosition,
      data: {
        targetNominal: direction.targetNominal,
        calculatedNominal,
        variance,
        rssTotal: rssResult?.totalPlus ?? 0,
        unit,
        directionId: direction.id,
        directionName: direction.name,
      },
      // Make result node non-deletable
      deletable: false,
      draggable: true,  // Allow repositioning
    };

    newNodes.push(resultNode);

    // Convert saved connectors to React Flow edges
    const newEdges: Edge[] = existingDiagram?.connectors.map(connector => ({
      id: connector.id,
      source: connector.sourceNodeId,
      target: connector.targetNodeId,
      sourceHandle: connector.sourceHandleId ?? null,
      targetHandle: connector.targetHandleId ?? null,
      label: connector.label,
      animated: connector.animated || false,
      type: 'smoothstep',  // Preserve edge type on reload
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

  // Custom nodes change handler that protects result node from deletion
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    // Filter out deletion attempts on result node
    const filteredChanges = changes.filter(change => {
      if (change.type === 'remove') {
        const node = nodes.find(n => n.id === change.id);
        return node?.type !== 'result';  // Prevent result node deletion
      }
      return true;
    });

    onNodesChange(filteredChanges);
  }, [nodes, onNodesChange]);

  // Convert React Flow state back to DiagramData
  const convertToDiagramData = (): DiagramData => {
    // Find result node and filter it out from regular nodes
    const resultNode = nodes.find(n => n.type === 'result');

    const diagramNodes: DiagramNode[] = nodes
      .filter(node => node.type !== 'result')  // Exclude result node
      .map(node => ({
        id: node.id,
        position: node.position,
        width: node.width ?? undefined,
        height: node.height ?? undefined,
      }));

    const connectors: DiagramConnector[] = edges.map(edge => ({
      id: edge.id || `${edge.source}-${edge.target}`,
      sourceNodeId: edge.source,
      targetNodeId: edge.target,
      sourceHandleId: edge.sourceHandle ?? undefined,
      targetHandleId: edge.targetHandle ?? undefined,
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
      resultNodePosition: resultNode ? resultNode.position : undefined,  // Save result node position separately
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
          <Box>
            <Typography variant="h6">
              Stack Diagram: {direction.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Click connectors to select, press Delete/Backspace to remove
            </Typography>
          </Box>
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
          onNodesChange={handleNodesChange}
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
