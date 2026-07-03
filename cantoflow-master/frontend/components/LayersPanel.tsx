'use client';

import { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Lock, Unlock, Trash2, ChevronUp, ChevronDown, Type, Image as ImageIcon, Square, GripVertical } from 'lucide-react';
import * as fabric from 'fabric';
import LockOptionsMenu, { LockOptions } from './LockOptionsMenu';

interface Layer {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  locked: boolean;
  lockOptions: LockOptions;
  object: fabric.Object;
}

interface LayersPanelProps {
  canvas: fabric.Canvas | null;
  selectedObject: fabric.Object | null;
  onSelectObject: (obj: fabric.Object | null) => void;
  onRefresh: () => void;
}

export default function LayersPanel({ canvas, selectedObject, onSelectObject, onRefresh }: LayersPanelProps) {
  const [layers, setLayers] = useState<Layer[]>([]);
  const [draggedLayer, setDraggedLayer] = useState<Layer | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [lockMenuLayer, setLockMenuLayer] = useState<Layer | null>(null);
  const [lockMenuPosition, setLockMenuPosition] = useState({ x: 0, y: 0 });

  // Update layers when canvas changes
  const refreshLayers = () => {
    if (!canvas) return;

    const objects = canvas.getObjects();
    const newLayers: Layer[] = objects.map((obj, index) => {
      const metadata = obj.get('metadata') || {};
      const type = obj.get('type') || 'object';

      let icon = Square;
      let typeName = 'Object';

      if (type === 'i-text' || type === 'text' || type === 'textbox' || metadata.elementType === 'text') {
        icon = Type;
        typeName = 'Text';
      } else if (type === 'image' || metadata.elementType === 'image') {
        icon = ImageIcon;
        typeName = 'Image';
      } else if (type === 'rect' || type === 'circle' || type === 'polygon') {
        icon = Square;
        typeName = 'Shape';
      }

      const lockOptions = metadata.lockOptions || {
        lockPosition: false,
        lockScale: false,
        lockRotation: false,
        lockAll: false,
      };

      return {
        id: `layer-${index}`,
        name: metadata.name || `${typeName} ${index + 1}`,
        type: typeName,
        visible: obj.visible !== false,
        locked: lockOptions.lockAll || metadata.locked || false,
        lockOptions,
        object: obj,
      };
    }).reverse(); // Reverse so top layer appears first

    setLayers(newLayers);
  };

  // Auto-refresh layers
  useEffect(() => {
    refreshLayers();
    const interval = setInterval(refreshLayers, 500);
    return () => clearInterval(interval);
  }, [canvas]);

  const toggleVisibility = (layer: Layer) => {
    layer.object.set('visible', !layer.visible);
    canvas?.renderAll();
    refreshLayers();
    onRefresh();
  };

  const applyLockOptions = (layer: Layer, options: LockOptions) => {
    const currentMetadata = layer.object.get('metadata') || {};

    layer.object.set({
      lockMovementX: options.lockPosition,
      lockMovementY: options.lockPosition,
      lockRotation: options.lockRotation,
      lockScalingX: options.lockScale,
      lockScalingY: options.lockScale,
      hasControls: !options.lockAll,
      hasBorders: !options.lockAll,
      selectable: true,
      evented: true,
    });

    layer.object.set('metadata', {
      ...currentMetadata,
      locked: options.lockAll,
      lockOptions: options,
    });

    canvas?.renderAll();
    refreshLayers();
    onRefresh();
  };

  const handleLockClick = (e: React.MouseEvent, layer: Layer) => {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setLockMenuPosition({ x: rect.left - 250, y: rect.top });
    setLockMenuLayer(layer);
  };

  const handleLockOptionsChange = (options: LockOptions) => {
    if (lockMenuLayer) {
      applyLockOptions(lockMenuLayer, options);
      // Immediately refresh to show changes
      refreshLayers();
    }
  };

  const deleteLayer = (layer: Layer) => {
    if (!canvas) return;
    canvas.remove(layer.object);
    canvas.renderAll();
    refreshLayers();
    onRefresh();
  };

  const moveLayer = (layer: Layer, direction: 'up' | 'down') => {
    if (!canvas) return;

    // Use Fabric.js v6 canvas methods for layer manipulation
    if (direction === 'up') {
      canvas.bringObjectForward(layer.object);
    } else {
      canvas.sendObjectBackwards(layer.object);
    }

    canvas.renderAll();
    canvas.fire('object:modified', { target: layer.object });

    refreshLayers();
    onRefresh();
  };

  const selectLayer = (layer: Layer) => {
    if (!canvas) return;
    canvas.setActiveObject(layer.object);
    canvas.renderAll();
    onSelectObject(layer.object);
  };

  const renameLayer = (layer: Layer, newName: string) => {
    const metadata = layer.object.get('metadata') || {};
    layer.object.set('metadata', { ...metadata, name: newName });
    refreshLayers();
    onRefresh();
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, layer: Layer) => {
    setDraggedLayer(layer);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetLayer: Layer, targetIndex: number) => {
    e.preventDefault();
    if (!canvas || !draggedLayer || draggedLayer.id === targetLayer.id) {
      setDraggedLayer(null);
      setDragOverIndex(null);
      return;
    }

    const draggedObject = draggedLayer.object;
    const targetObject = targetLayer.object;

    const objects = canvas.getObjects();
    const targetCanvasIndex = objects.indexOf(targetObject);

    if (targetCanvasIndex === -1) return;

    // Use Fabric.js v6 canvas method to move object to specific index
    canvas.moveObjectTo(draggedObject, targetCanvasIndex);

    canvas.renderAll();
    canvas.fire('object:modified', { target: draggedObject });

    setDraggedLayer(null);
    setDragOverIndex(null);
    refreshLayers();
    onRefresh();
  };

  const handleDragEnd = () => {
    setDraggedLayer(null);
    setDragOverIndex(null);
  };

  const getLayerIcon = (type: string) => {
    switch (type) {
      case 'Text':
        return <Type size={16} className="text-blue-400" />;
      case 'Image':
        return <ImageIcon size={16} className="text-green-400" />;
      default:
        return <Square size={16} className="text-gray-400" />;
    }
  };

  return (
    <div className="w-64 bg-gray-800 border-l border-gray-700 h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h3 className="font-semibold text-white">Layers</h3>
        <p className="text-xs text-gray-400 mt-1">{layers.length} layers</p>
      </div>

      {/* Layers List */}
      <div className="flex-1 overflow-y-auto">
        {layers.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No layers yet
            <p className="text-xs mt-1 text-gray-600">Add text or images to get started</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {layers.map((layer, index) => {
              const isSelected = selectedObject === layer.object;
              const isDragging = draggedLayer?.id === layer.id;
              const isDragOver = dragOverIndex === index;

              return (
                <div
                  key={layer.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, layer)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, layer, index)}
                  onDragEnd={handleDragEnd}
                  className={`group p-2 rounded-md flex items-center gap-2 transition-all cursor-move ${
                    isSelected
                      ? 'bg-blue-600 border border-blue-500'
                      : isDragging
                        ? 'opacity-50 bg-gray-700 border border-gray-600'
                        : isDragOver
                          ? 'border-t-2 border-t-blue-400 bg-gray-700'
                          : 'hover:bg-gray-700 border border-transparent'
                  }`}
                  onClick={() => selectLayer(layer)}
                >
                  {/* Drag Handle */}
                  <div className="flex-shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical size={16} className="text-gray-400" />
                  </div>

                  {/* Layer Icon */}
                  <div className="flex-shrink-0">
                    {getLayerIcon(layer.type)}
                  </div>

                  {/* Layer Name */}
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={layer.name}
                      onChange={(e) => renameLayer(layer, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className={`w-full bg-transparent border-none outline-none text-sm font-medium truncate focus:bg-gray-700 focus:px-1 rounded ${isSelected ? 'text-white' : 'text-gray-200'}`}
                    />
                    <p className={`text-xs ${isSelected ? 'text-blue-200' : 'text-gray-500'}`}>{layer.type}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleVisibility(layer);
                      }}
                      className="p-1 hover:bg-gray-600 rounded transition-colors"
                      title={layer.visible ? 'Hide' : 'Show'}
                    >
                      {layer.visible ? (
                        <Eye size={14} className="text-gray-300" />
                      ) : (
                        <EyeOff size={14} className="text-gray-500" />
                      )}
                    </button>

                    <button
                      onClick={(e) => handleLockClick(e, layer)}
                      className="p-1 hover:bg-gray-600 rounded transition-colors"
                      title={layer.locked ? 'Locked - Click for options' : 'Unlocked - Click for options'}
                    >
                      {layer.locked ? (
                        <Lock size={14} className="text-orange-400" />
                      ) : (
                        <Unlock size={14} className="text-gray-300" />
                      )}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveLayer(layer, 'up');
                      }}
                      className="p-1 hover:bg-gray-600 rounded transition-colors"
                      title="Move Up"
                    >
                      <ChevronUp size={14} className="text-gray-300" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveLayer(layer, 'down');
                      }}
                      className="p-1 hover:bg-gray-600 rounded transition-colors"
                      title="Move Down"
                    >
                      <ChevronDown size={14} className="text-gray-300" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteLayer(layer);
                      }}
                      className="p-1 hover:bg-red-600 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer with tips */}
      <div className="p-3 border-t border-gray-700 bg-gray-900 text-xs text-gray-400">
        <p className="font-medium mb-1 text-gray-300">Tips:</p>
        <ul className="space-y-1 text-gray-500">
          <li>• Click layer to select</li>
          <li>• Click name to rename</li>
          <li>• Drag layers to reorder</li>
          <li>• Click lock for options</li>
        </ul>
      </div>

      {/* Lock Options Menu */}
      {lockMenuLayer && (
        <LockOptionsMenu
          lockOptions={lockMenuLayer.lockOptions}
          onLockOptionsChange={handleLockOptionsChange}
          onClose={() => setLockMenuLayer(null)}
          position={lockMenuPosition}
        />
      )}
    </div>
  );
}
