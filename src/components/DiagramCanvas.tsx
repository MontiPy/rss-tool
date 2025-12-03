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
import ResultNode from './ResultNode';

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
  result: ResultNode,
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
      <style>
        {`
          .react-flow__edge.selected .react-flow__edge-path {
            stroke: #1976d2 !important;
            stroke-width: 3px !important;
          }
          .react-flow__edge:hover .react-flow__edge-path {
            stroke: #555 !important;
            cursor: pointer;
          }
        `}
      </style>
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
        selectNodesOnDrag={false}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode={null}
        defaultEdgeOptions={{
          animated: false,
          type: 'smoothstep',
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
            // Result node: green
            if (node.type === 'result') {
              return '#4caf50';
            }

            // Tolerance items: orange for floating, blue for fixed
            const data = node.data as { item?: { floatFactor: number } };
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
