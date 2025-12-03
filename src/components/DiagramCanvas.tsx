import React from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  ConnectionMode,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import ToleranceItemNode from './ToleranceItemNode';

interface DiagramCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
}

// Define custom node types
const nodeTypes: NodeTypes = {
  toleranceItem: ToleranceItemNode,
};

const DiagramCanvas: React.FC<DiagramCanvasProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
}) => {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          animated: false,
          style: { stroke: '#888', strokeWidth: 2 },
        }}
      >
        <Background
          variant={BackgroundVariant.Lines}
          // gap={16}
          // size={1}
          // color="#ddd"
        />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as { item?: { floatFactor: number } };
            // Orange for floating, blue for fixed
            return data.item?.floatFactor && data.item.floatFactor > 1.0
              ? '#ff9800'
              : '#1976d2';
          }}
          nodeStrokeWidth={3}
          zoomable
          pannable
        />
      </ReactFlow>
    </div>
  );
};

export default DiagramCanvas;
