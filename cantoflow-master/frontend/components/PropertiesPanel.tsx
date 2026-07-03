'use client';

import { useEffect, useState } from 'react';
import * as fabric from 'fabric';
import { AlignLeft, AlignCenter, AlignRight, AlignJustify, Bold, Italic, Underline } from 'lucide-react';

interface PropertiesPanelProps {
  canvas: fabric.Canvas | null;
  selectedObject: fabric.Object | null;
  onUpdate: () => void;
}

export default function PropertiesPanel({ canvas, selectedObject, onUpdate }: PropertiesPanelProps) {
  const [properties, setProperties] = useState<any>({});

  useEffect(() => {
    if (!selectedObject) {
      setProperties({});
      return;
    }

    // Extract current properties
    const type = selectedObject.get('type');
    const metadata = selectedObject.get('metadata') || {};

    const props: any = {
      type,
      left: Math.round(selectedObject.left || 0),
      top: Math.round(selectedObject.top || 0),
      width: Math.round((selectedObject.width || 0) * (selectedObject.scaleX || 1)),
      height: Math.round((selectedObject.height || 0) * (selectedObject.scaleY || 1)),
      angle: Math.round(selectedObject.angle || 0),
      opacity: (selectedObject.opacity || 1) * 100,
    };

    // Text-specific properties
    if (type === 'i-text' || type === 'text' || type === 'textbox') {
      const textObj = selectedObject as fabric.IText;
      props.text = textObj.text || '';
      props.fontFamily = textObj.fontFamily || 'Arial';
      props.fontSize = textObj.fontSize || 16;
      props.fontWeight = textObj.fontWeight || 'normal';
      props.fontStyle = textObj.fontStyle || 'normal';
      props.underline = textObj.underline || false;
      props.linethrough = textObj.linethrough || false;
      props.textAlign = textObj.textAlign || 'left';
      props.fill = textObj.fill || '#000000';
      props.lineHeight = textObj.lineHeight || 1.16;
      props.charSpacing = textObj.charSpacing || 0;
    }

    // Image-specific properties
    if (type === 'image') {
      props.filter = 'none';
    }

    // Shape properties
    if (selectedObject.fill) {
      props.fill = selectedObject.fill;
    }
    if (selectedObject.stroke) {
      props.stroke = selectedObject.stroke;
      props.strokeWidth = selectedObject.strokeWidth || 0;
    }

    // Shadow
    if (selectedObject.shadow) {
      const shadow = selectedObject.shadow as fabric.Shadow;
      props.shadowEnabled = true;
      props.shadowColor = shadow.color || 'rgba(0,0,0,0.3)';
      props.shadowBlur = shadow.blur || 0;
      props.shadowOffsetX = shadow.offsetX || 0;
      props.shadowOffsetY = shadow.offsetY || 0;
    } else {
      props.shadowEnabled = false;
    }

    // Editable in Use mode
    props.editable = metadata.editable === true;

    setProperties(props);
  }, [selectedObject]);

  const updateProperty = (key: string, value: any) => {
    if (!selectedObject || !canvas) return;

    const updates: any = {};
    updates[key] = value;

    // Special handling for dimensions
    if (key === 'width' || key === 'height') {
      const currentScale = key === 'width' ? selectedObject.scaleX || 1 : selectedObject.scaleY || 1;
      const originalSize = key === 'width' ? selectedObject.width || 1 : selectedObject.height || 1;
      const newScale = value / originalSize;
      updates[key === 'width' ? 'scaleX' : 'scaleY'] = newScale;
      delete updates[key];
    }

    selectedObject.set(updates);
    canvas.renderAll();
    onUpdate();

    // Update local state
    setProperties((prev: any) => ({ ...prev, [key]: value }));
  };

  const updateTextStyle = (style: string, value: any) => {
    if (!selectedObject || !canvas) return;
    selectedObject.set(style as any, value);
    canvas.renderAll();
    onUpdate();
    setProperties((prev: any) => ({ ...prev, [style]: value }));
  };

  const toggleShadow = () => {
    if (!selectedObject || !canvas) return;

    if (properties.shadowEnabled) {
      selectedObject.set('shadow', null);
      setProperties((prev: any) => ({ ...prev, shadowEnabled: false }));
    } else {
      selectedObject.set('shadow', new fabric.Shadow({
        color: 'rgba(0,0,0,0.3)',
        blur: 10,
        offsetX: 5,
        offsetY: 5,
      }));
      setProperties((prev: any) => ({
        ...prev,
        shadowEnabled: true,
        shadowColor: 'rgba(0,0,0,0.3)',
        shadowBlur: 10,
        shadowOffsetX: 5,
        shadowOffsetY: 5,
      }));
    }

    canvas.renderAll();
    onUpdate();
  };

  const updateShadow = (key: string, value: any) => {
    if (!selectedObject || !canvas || !selectedObject.shadow) return;

    const shadow = selectedObject.shadow as fabric.Shadow;
    (shadow as any)[key] = value;
    selectedObject.set('shadow', shadow);
    canvas.renderAll();
    onUpdate();

    setProperties((prev: any) => ({ ...prev, [`shadow${key.charAt(0).toUpperCase() + key.slice(1)}`]: value }));
  };

  const toggleEditable = () => {
    if (!selectedObject || !canvas) return;

    const metadata = selectedObject.get('metadata') || {};
    const newEditable = !metadata.editable;

    selectedObject.set('metadata', {
      ...metadata,
      editable: newEditable,
    });

    canvas.renderAll();
    onUpdate();
  };

  if (!selectedObject) {
    return (
      <div className="w-64 bg-gray-800 border-l border-gray-700 h-full flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h3 className="font-semibold text-white">Properties</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4 text-center text-gray-500 text-sm">
          Select an object to edit its properties
        </div>
      </div>
    );
  }

  const isText = properties.type === 'i-text' || properties.type === 'text' || properties.type === 'textbox';

  return (
    <div className="w-64 bg-gray-800 border-l border-gray-700 h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
        <h3 className="font-semibold text-white">Properties</h3>
        <p className="text-xs text-gray-400 mt-1">{properties.type}</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Transform Properties */}
        <div className="p-4 border-b border-gray-700">
          <h4 className="font-medium text-sm text-gray-300 mb-3">Transform</h4>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">X</label>
              <input
                type="number"
                value={properties.left || 0}
                onChange={(e) => updateProperty('left', parseInt(e.target.value))}
                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Y</label>
              <input
                type="number"
                value={properties.top || 0}
                onChange={(e) => updateProperty('top', parseInt(e.target.value))}
                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Width</label>
              <input
                type="number"
                value={properties.width || 0}
                onChange={(e) => updateProperty('width', parseInt(e.target.value))}
                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Height</label>
              <input
                type="number"
                value={properties.height || 0}
                onChange={(e) => updateProperty('height', parseInt(e.target.value))}
                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Rotation</label>
              <input
                type="number"
                value={properties.angle || 0}
                onChange={(e) => updateProperty('angle', parseInt(e.target.value))}
                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Opacity %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={properties.opacity || 100}
                onChange={(e) => {
                  const value = e.target.value;
                  setProperties((prev: any) => ({ ...prev, opacity: parseInt(value) || 0 }));
                  if (selectedObject && canvas) {
                    selectedObject.set('opacity', (parseInt(value) || 0) / 100);
                    canvas.renderAll();
                    onUpdate();
                  }
                }}
                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Template Mode Settings */}
        <div className="p-4 border-b border-gray-700">
          <h4 className="font-medium text-sm text-gray-300 mb-3">Template Settings</h4>

          <div className="flex items-center justify-between">
            <div>
              <label className="block text-xs font-medium text-gray-300">Editable in Use Mode</label>
              <p className="text-xs text-gray-500 mt-0.5">Allow editing when template is in use</p>
            </div>
            <button
              onClick={toggleEditable}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                properties.editable ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  properties.editable ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Text Properties */}
        {isText && (
          <>
            <div className="p-4 border-b border-gray-700">
              <h4 className="font-medium text-sm text-gray-300 mb-3">Typography</h4>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Font Family</label>
                  <select
                    value={properties.fontFamily || 'Arial'}
                    onChange={(e) => updateTextStyle('fontFamily', e.target.value)}
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Arial">Arial</option>
                    <option value="Helvetica">Helvetica</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Verdana">Verdana</option>
                    <option value="Impact">Impact</option>
                    <option value="Comic Sans MS">Comic Sans MS</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Size</label>
                    <input
                      type="number"
                      value={properties.fontSize || 16}
                      onChange={(e) => updateTextStyle('fontSize', parseInt(e.target.value))}
                      className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Weight</label>
                    <select
                      value={properties.fontWeight || 'normal'}
                      onChange={(e) => updateTextStyle('fontWeight', e.target.value)}
                      className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="normal">Normal</option>
                      <option value="bold">Bold</option>
                      <option value="lighter">Lighter</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-2">Style</label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => updateTextStyle('fontWeight', properties.fontWeight === 'bold' ? 'normal' : 'bold')}
                      className={`flex-1 p-2 border border-gray-600 rounded ${properties.fontWeight === 'bold' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
                      title="Bold"
                    >
                      <Bold size={16} className="mx-auto" />
                    </button>
                    <button
                      onClick={() => updateTextStyle('fontStyle', properties.fontStyle === 'italic' ? 'normal' : 'italic')}
                      className={`flex-1 p-2 border border-gray-600 rounded ${properties.fontStyle === 'italic' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
                      title="Italic"
                    >
                      <Italic size={16} className="mx-auto" />
                    </button>
                    <button
                      onClick={() => updateTextStyle('underline', !properties.underline)}
                      className={`flex-1 p-2 border border-gray-600 rounded ${properties.underline ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
                      title="Underline"
                    >
                      <Underline size={16} className="mx-auto" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-2">Alignment</label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => updateTextStyle('textAlign', 'left')}
                      className={`flex-1 p-2 border border-gray-600 rounded ${properties.textAlign === 'left' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
                    >
                      <AlignLeft size={16} className="mx-auto" />
                    </button>
                    <button
                      onClick={() => updateTextStyle('textAlign', 'center')}
                      className={`flex-1 p-2 border border-gray-600 rounded ${properties.textAlign === 'center' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
                    >
                      <AlignCenter size={16} className="mx-auto" />
                    </button>
                    <button
                      onClick={() => updateTextStyle('textAlign', 'right')}
                      className={`flex-1 p-2 border border-gray-600 rounded ${properties.textAlign === 'right' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
                    >
                      <AlignRight size={16} className="mx-auto" />
                    </button>
                    <button
                      onClick={() => updateTextStyle('textAlign', 'justify')}
                      className={`flex-1 p-2 border border-gray-600 rounded ${properties.textAlign === 'justify' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
                    >
                      <AlignJustify size={16} className="mx-auto" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Color</label>
                  <input
                    type="color"
                    value={typeof properties.fill === 'string' ? properties.fill : '#000000'}
                    onChange={(e) => updateTextStyle('fill', e.target.value)}
                    className="w-full h-8 rounded border border-gray-600 bg-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Line Height</label>
                  <input
                    type="number"
                    step="0.1"
                    value={properties.lineHeight || 1.16}
                    onChange={(e) => updateTextStyle('lineHeight', parseFloat(e.target.value))}
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Letter Spacing</label>
                  <input
                    type="number"
                    step="10"
                    value={properties.charSpacing || 0}
                    onChange={(e) => updateTextStyle('charSpacing', parseInt(e.target.value))}
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Fill & Stroke */}
        {!isText && (
          <div className="p-4 border-b border-gray-700">
            <h4 className="font-medium text-sm text-gray-300 mb-3">Fill & Stroke</h4>

            <div className="space-y-3">
              {properties.fill && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Fill Color</label>
                  <input
                    type="color"
                    value={typeof properties.fill === 'string' ? properties.fill : '#cccccc'}
                    onChange={(e) => updateProperty('fill', e.target.value)}
                    className="w-full h-8 rounded border border-gray-600 bg-gray-700"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-400 mb-1">Stroke Color</label>
                <input
                  type="color"
                  value={properties.stroke || '#000000'}
                  onChange={(e) => updateProperty('stroke', e.target.value)}
                  className="w-full h-8 rounded border border-gray-600 bg-gray-700"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Stroke Width</label>
                <input
                  type="number"
                  min="0"
                  value={properties.strokeWidth || 0}
                  onChange={(e) => updateProperty('strokeWidth', parseInt(e.target.value))}
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}

        {/* Effects */}
        <div className="p-4">
          <h4 className="font-medium text-sm text-gray-300 mb-3">Effects</h4>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-400">Shadow</label>
              <button
                onClick={toggleShadow}
                className={`px-3 py-1 text-xs rounded ${
                  properties.shadowEnabled
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                }`}
              >
                {properties.shadowEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {properties.shadowEnabled && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Shadow Color</label>
                  <input
                    type="color"
                    value={properties.shadowColor || 'rgba(0,0,0,0.3)'}
                    onChange={(e) => updateShadow('color', e.target.value)}
                    className="w-full h-8 rounded border border-gray-600 bg-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Blur</label>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={properties.shadowBlur || 0}
                    onChange={(e) => updateShadow('blur', parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <span className="text-xs text-gray-500">{properties.shadowBlur || 0}px</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Offset X</label>
                    <input
                      type="number"
                      value={properties.shadowOffsetX || 0}
                      onChange={(e) => updateShadow('offsetX', parseInt(e.target.value))}
                      className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Offset Y</label>
                    <input
                      type="number"
                      value={properties.shadowOffsetY || 0}
                      onChange={(e) => updateShadow('offsetY', parseInt(e.target.value))}
                      className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
