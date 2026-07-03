'use client';

import { AlignLeft, AlignCenter, AlignRight, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter, AlignStartVertical, AlignCenterVertical, AlignEndVertical, Maximize2, Group, Ungroup } from 'lucide-react';
import * as fabric from 'fabric';

interface AlignmentToolsProps {
  canvas: fabric.Canvas | null;
  selectedObjects: fabric.Object[];
  onUpdate: () => void;
}

export default function AlignmentTools({ canvas, selectedObjects, onUpdate }: AlignmentToolsProps) {
  if (!canvas || selectedObjects.length === 0) return null;

  const alignLeft = () => {
    if (selectedObjects.length === 0) return;
    const minLeft = Math.min(...selectedObjects.map(obj => obj.left || 0));
    selectedObjects.forEach(obj => {
      obj.set('left', minLeft);
    });
    canvas.renderAll();
    onUpdate();
  };

  const alignCenter = () => {
    if (selectedObjects.length === 0) return;
    const avgLeft = selectedObjects.reduce((sum, obj) => sum + (obj.left || 0) + ((obj.width || 0) * (obj.scaleX || 1)) / 2, 0) / selectedObjects.length;
    selectedObjects.forEach(obj => {
      obj.set('left', avgLeft - ((obj.width || 0) * (obj.scaleX || 1)) / 2);
    });
    canvas.renderAll();
    onUpdate();
  };

  const alignRight = () => {
    if (selectedObjects.length === 0) return;
    const maxRight = Math.max(...selectedObjects.map(obj => (obj.left || 0) + ((obj.width || 0) * (obj.scaleX || 1))));
    selectedObjects.forEach(obj => {
      obj.set('left', maxRight - ((obj.width || 0) * (obj.scaleX || 1)));
    });
    canvas.renderAll();
    onUpdate();
  };

  const alignTop = () => {
    if (selectedObjects.length === 0) return;
    const minTop = Math.min(...selectedObjects.map(obj => obj.top || 0));
    selectedObjects.forEach(obj => {
      obj.set('top', minTop);
    });
    canvas.renderAll();
    onUpdate();
  };

  const alignMiddle = () => {
    if (selectedObjects.length === 0) return;
    const avgTop = selectedObjects.reduce((sum, obj) => sum + (obj.top || 0) + ((obj.height || 0) * (obj.scaleY || 1)) / 2, 0) / selectedObjects.length;
    selectedObjects.forEach(obj => {
      obj.set('top', avgTop - ((obj.height || 0) * (obj.scaleY || 1)) / 2);
    });
    canvas.renderAll();
    onUpdate();
  };

  const alignBottom = () => {
    if (selectedObjects.length === 0) return;
    const maxBottom = Math.max(...selectedObjects.map(obj => (obj.top || 0) + ((obj.height || 0) * (obj.scaleY || 1))));
    selectedObjects.forEach(obj => {
      obj.set('top', maxBottom - ((obj.height || 0) * (obj.scaleY || 1)));
    });
    canvas.renderAll();
    onUpdate();
  };

  const distributeHorizontal = () => {
    if (selectedObjects.length < 3) return;
    const sorted = [...selectedObjects].sort((a, b) => (a.left || 0) - (b.left || 0));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalWidth = (last.left || 0) + ((last.width || 0) * (last.scaleX || 1)) - (first.left || 0);
    const objectsWidth = sorted.reduce((sum, obj) => sum + ((obj.width || 0) * (obj.scaleX || 1)), 0);
    const gap = (totalWidth - objectsWidth) / (sorted.length - 1);

    let currentLeft = first.left || 0;
    sorted.forEach((obj, index) => {
      if (index > 0) {
        currentLeft += gap;
        obj.set('left', currentLeft);
      }
      currentLeft += (obj.width || 0) * (obj.scaleX || 1);
    });
    canvas.renderAll();
    onUpdate();
  };

  const distributeVertical = () => {
    if (selectedObjects.length < 3) return;
    const sorted = [...selectedObjects].sort((a, b) => (a.top || 0) - (b.top || 0));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalHeight = (last.top || 0) + ((last.height || 0) * (last.scaleY || 1)) - (first.top || 0);
    const objectsHeight = sorted.reduce((sum, obj) => sum + ((obj.height || 0) * (obj.scaleY || 1)), 0);
    const gap = (totalHeight - objectsHeight) / (sorted.length - 1);

    let currentTop = first.top || 0;
    sorted.forEach((obj, index) => {
      if (index > 0) {
        currentTop += gap;
        obj.set('top', currentTop);
      }
      currentTop += (obj.height || 0) * (obj.scaleY || 1);
    });
    canvas.renderAll();
    onUpdate();
  };

  const centerInCanvas = () => {
    if (selectedObjects.length === 0) return;
    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();

    selectedObjects.forEach(obj => {
      obj.set({
        left: (canvasWidth - ((obj.width || 0) * (obj.scaleX || 1))) / 2,
        top: (canvasHeight - ((obj.height || 0) * (obj.scaleY || 1))) / 2,
      });
    });
    canvas.renderAll();
    onUpdate();
  };

  const groupObjects = () => {
    if (selectedObjects.length < 2) return;
    const group = new fabric.Group(selectedObjects);
    selectedObjects.forEach(obj => canvas.remove(obj));
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.renderAll();
    onUpdate();
  };

  const ungroupObjects = () => {
    const activeObject = canvas.getActiveObject();
    if (!activeObject || activeObject.type !== 'group') return;

    const group = activeObject as fabric.Group;
    const items = group.getObjects();

    group.toActiveSelection();
    canvas.discardActiveObject();

    canvas.renderAll();
    onUpdate();
  };

  const isGroup = selectedObjects.length === 1 && selectedObjects[0].type === 'group';

  return (
    <div className="bg-white border rounded-lg shadow-sm p-3">
      <div className="space-y-3">
        {/* Horizontal Alignment */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">Align Horizontal</label>
          <div className="flex gap-1">
            <button
              onClick={alignLeft}
              className="flex-1 p-2 border rounded hover:bg-blue-50 hover:border-blue-500 transition-colors"
              title="Align Left"
            >
              <AlignLeft size={16} className="mx-auto" />
            </button>
            <button
              onClick={alignCenter}
              className="flex-1 p-2 border rounded hover:bg-blue-50 hover:border-blue-500 transition-colors"
              title="Align Center"
            >
              <AlignCenter size={16} className="mx-auto" />
            </button>
            <button
              onClick={alignRight}
              className="flex-1 p-2 border rounded hover:bg-blue-50 hover:border-blue-500 transition-colors"
              title="Align Right"
            >
              <AlignRight size={16} className="mx-auto" />
            </button>
          </div>
        </div>

        {/* Vertical Alignment */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">Align Vertical</label>
          <div className="flex gap-1">
            <button
              onClick={alignTop}
              className="flex-1 p-2 border rounded hover:bg-blue-50 hover:border-blue-500 transition-colors"
              title="Align Top"
            >
              <AlignStartVertical size={16} className="mx-auto" />
            </button>
            <button
              onClick={alignMiddle}
              className="flex-1 p-2 border rounded hover:bg-blue-50 hover:border-blue-500 transition-colors"
              title="Align Middle"
            >
              <AlignCenterVertical size={16} className="mx-auto" />
            </button>
            <button
              onClick={alignBottom}
              className="flex-1 p-2 border rounded hover:bg-blue-50 hover:border-blue-500 transition-colors"
              title="Align Bottom"
            >
              <AlignEndVertical size={16} className="mx-auto" />
            </button>
          </div>
        </div>

        {/* Distribute */}
        {selectedObjects.length >= 3 && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Distribute</label>
            <div className="flex gap-1">
              <button
                onClick={distributeHorizontal}
                className="flex-1 p-2 border rounded hover:bg-blue-50 hover:border-blue-500 transition-colors"
                title="Distribute Horizontally"
              >
                <AlignHorizontalJustifyCenter size={16} className="mx-auto" />
              </button>
              <button
                onClick={distributeVertical}
                className="flex-1 p-2 border rounded hover:bg-blue-50 hover:border-blue-500 transition-colors"
                title="Distribute Vertically"
              >
                <AlignVerticalJustifyCenter size={16} className="mx-auto" />
              </button>
            </div>
          </div>
        )}

        {/* Center in Canvas */}
        <div>
          <button
            onClick={centerInCanvas}
            className="w-full p-2 border rounded hover:bg-blue-50 hover:border-blue-500 transition-colors flex items-center justify-center gap-2"
            title="Center in Canvas"
          >
            <Maximize2 size={16} />
            <span className="text-sm">Center in Canvas</span>
          </button>
        </div>

        {/* Group/Ungroup */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">Group</label>
          <div className="flex gap-1">
            <button
              onClick={groupObjects}
              disabled={selectedObjects.length < 2}
              className="flex-1 p-2 border rounded hover:bg-blue-50 hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              title="Group Objects"
            >
              <Group size={16} />
              <span className="text-xs">Group</span>
            </button>
            <button
              onClick={ungroupObjects}
              disabled={!isGroup}
              className="flex-1 p-2 border rounded hover:bg-blue-50 hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              title="Ungroup Objects"
            >
              <Ungroup size={16} />
              <span className="text-xs">Ungroup</span>
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="text-xs text-gray-500 pt-2 border-t">
          {selectedObjects.length} object{selectedObjects.length !== 1 ? 's' : ''} selected
        </div>
      </div>
    </div>
  );
}
