'use client';

import { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { Type, Image as ImageIcon, Lock, Unlock, Trash2, Download, ImagePlus, Save, FolderOpen, Layers, Grid3x3, Ruler, AlignCenter, Upload, FileDown, Settings, Square, Circle, Shapes } from 'lucide-react';
import CantoAssetPicker, { type CantoAsset } from './CantoAssetPicker';
import LayersPanel from './LayersPanel';
import PropertiesPanel from './PropertiesPanel';
import TemplateGallery from './TemplateGallery';
import AlignmentTools from './AlignmentTools';
import RulersAndGrid from './RulersAndGrid';

interface TemplateEditorProps {
  templateData?: any;
  templateId?: string;
  width?: number;
  height?: number;
}

export default function TemplateEditor({
  templateData,
  templateId,
  width: initialWidth = 800,
  height: initialHeight = 600
}: TemplateEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const [selectedObject, setSelectedObject] = useState<fabric.Object | null>(null);
  const [selectedObjects, setSelectedObjects] = useState<fabric.Object[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyStep, setHistoryStep] = useState(0);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [showLayers, setShowLayers] = useState(true);
  const [showProperties, setShowProperties] = useState(true);
  const [templateName, setTemplateName] = useState('Untitled Template');
  const [currentTemplateId, setCurrentTemplateId] = useState(templateId);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [showRulers, setShowRulers] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [gridSize, setGridSize] = useState(20);
  const [showAlignmentTools, setShowAlignmentTools] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedState, setLastSavedState] = useState<string>('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCanvasSettings, setShowCanvasSettings] = useState(false);
  const [width, setWidth] = useState(initialWidth);
  const [height, setHeight] = useState(initialHeight);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [drawingMode, setDrawingMode] = useState<'select' | 'rectangle' | 'circle' | 'line'>('select');
  const [templateMode, setTemplateMode] = useState<'design' | 'use'>('design'); // Design = full editing, Use = only editable fields

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor,
      preserveObjectStacking: true,
    });

    fabricCanvasRef.current = canvas;

    // Selection event handlers
    canvas.on('selection:created', (e) => {
      const objects = canvas.getActiveObjects();
      setSelectedObjects(objects);
      setSelectedObject(e.selected?.[0] || null);
    });

    canvas.on('selection:updated', (e) => {
      const objects = canvas.getActiveObjects();
      setSelectedObjects(objects);
      setSelectedObject(e.selected?.[0] || null);
    });

    canvas.on('selection:cleared', () => {
      setSelectedObjects([]);
      setSelectedObject(null);
    });

    // Save history on object modifications
    canvas.on('object:modified', () => {
      saveHistory();
    });

    // Grid snapping
    canvas.on('object:moving', (e) => {
      if (!showGrid) return;
      const obj = e.target;
      if (!obj) return;

      obj.set({
        left: Math.round((obj.left || 0) / gridSize) * gridSize,
        top: Math.round((obj.top || 0) / gridSize) * gridSize,
      });
    });

    // Load template data if provided
    if (templateData) {
      loadTemplateData(canvas, templateData);
    } else {
      // Add default guide text
      addDefaultContent(canvas);
    }

    saveHistory();

    return () => {
      canvas.dispose();
    };
  }, [templateData]); // Remove width/height to prevent canvas recreation

  // Update canvas dimensions without recreating it
  useEffect(() => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.setWidth(width);
      fabricCanvasRef.current.setHeight(height);
      fabricCanvasRef.current.renderAll();
    }
  }, [width, height]);

  // Update canvas background color without recreating it
  useEffect(() => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.set('backgroundColor', backgroundColor);
      fabricCanvasRef.current.renderAll();
    }
  }, [backgroundColor]);

  // Apply template mode to all objects
  useEffect(() => {
    if (!fabricCanvasRef.current) return;

    const objects = fabricCanvasRef.current.getObjects();
    objects.forEach(obj => {
      const metadata = obj.get('metadata') || {};
      const lockOptions = metadata.lockOptions || {
        lockPosition: false,
        lockScale: false,
        lockRotation: false,
        lockAll: false,
      };

      if (templateMode === 'use') {
        // Use mode: Only objects explicitly marked as editable are selectable
        // If editable is undefined, default to false (locked) for use mode
        const isEditable = metadata.editable === true;

        if (isEditable) {
          // Editable: Allow full interaction
          obj.set({
            selectable: true,
            evented: true,
            hasControls: true,
            hasBorders: true,
            lockMovementX: false,
            lockMovementY: false,
            lockRotation: false,
            lockScalingX: false,
            lockScalingY: false,
          });
        } else {
          // Not editable: Completely lock down
          obj.set({
            selectable: false,
            evented: false,
            hasControls: false,
            hasBorders: false,
            lockMovementX: true,
            lockMovementY: true,
            lockRotation: true,
            lockScalingX: true,
            lockScalingY: true,
          });
        }
      } else {
        // Design mode: Apply granular lock options from layers panel
        obj.set({
          selectable: true,
          evented: true,
          hasControls: !lockOptions.lockAll,
          hasBorders: !lockOptions.lockAll,
          lockMovementX: lockOptions.lockPosition || lockOptions.lockAll,
          lockMovementY: lockOptions.lockPosition || lockOptions.lockAll,
          lockRotation: lockOptions.lockRotation || lockOptions.lockAll,
          lockScalingX: lockOptions.lockScale || lockOptions.lockAll,
          lockScalingY: lockOptions.lockScale || lockOptions.lockAll,
        });
      }
    });

    fabricCanvasRef.current.discardActiveObject();
    fabricCanvasRef.current.renderAll();
  }, [templateMode]);

  const addDefaultContent = (canvas: fabric.Canvas) => {
    const text = new fabric.IText('Click to edit text', {
      left: 100,
      top: 100,
      fontSize: 32,
      fontFamily: 'Arial',
      fill: '#333333',
      editable: true,
    });

    canvas.add(text);
    canvas.renderAll();
  };

  const loadTemplateData = async (canvas: fabric.Canvas, data: any) => {
    if (!data.elements || !Array.isArray(data.elements)) {
      console.warn('No elements found in template data');
      return;
    }

    console.log(`Loading template with ${data.elements.length} elements`);

    // Clear the canvas first
    canvas.clear();

    // Set canvas dimensions if provided
    if (data.format) {
      setWidth(data.format.width);
      setHeight(data.format.height);
      canvas.setWidth(data.format.width);
      canvas.setHeight(data.format.height);
    }

    // Set background color from multiple possible sources
    console.log('Loading template data - checking background sources:');
    console.log('  data.backgroundColor:', data.backgroundColor);
    console.log('  data.format?.backgroundColor:', data.format?.backgroundColor);

    const bgColor = data.backgroundColor || data.format?.backgroundColor || '#ffffff';
    console.log('  Selected bgColor:', bgColor);

    setBackgroundColor(bgColor);
    canvas.backgroundColor = bgColor;

    // Use Fabric.js deserialization to properly restore objects from saved state
    const objectsToEnliven = data.elements
      .map((element: any) => {
        // If element has a 'style' property with full Fabric.js object data, use it
        if (element.style && element.style.type) {
          // Merge metadata to preserve editable/locked state
          const fabricObject = {
            ...element.style,
            metadata: {
              ...(element.style.metadata || {}),
              editable: element.editable !== false,
              locked: element.locked || false,
              originalId: element.originalId || element.id,
              elementType: element.type, // Preserve original element type
            },
          };
          return fabricObject;
        }
        return null;
      })
      .filter((obj: any) => obj !== null);

    if (objectsToEnliven.length > 0) {
      try {
        // Use Fabric.js built-in deserialization
        const enlivenedObjects = await fabric.util.enlivenObjects(objectsToEnliven);
        console.log(`Enlivened ${enlivenedObjects.length} objects from template`);

        enlivenedObjects.forEach((obj: fabric.Object, index: number) => {
          if (obj) {
            const metadata = obj.get('metadata') || {};
            const element = data.elements[index];

            // Apply lock options based on metadata
            if (metadata.lockOptions) {
              obj.set({
                lockMovementX: metadata.lockOptions.lockPosition,
                lockMovementY: metadata.lockOptions.lockPosition,
                lockRotation: metadata.lockOptions.lockRotation,
                lockScalingX: metadata.lockOptions.lockScale,
                lockScalingY: metadata.lockOptions.lockScale,
                hasControls: !metadata.lockOptions.lockAll,
                hasBorders: !metadata.lockOptions.lockAll,
                selectable: true,
                evented: true,
              });
            } else if (element && element.locked) {
              // Fallback: apply basic lock
              obj.set({
                lockMovementX: true,
                lockMovementY: true,
                lockRotation: true,
                lockScalingX: true,
                lockScalingY: true,
                hasControls: false,
                hasBorders: false,
                selectable: true,
                evented: true,
              });
            }

            canvas.add(obj);
          }
        });

        canvas.renderAll();
        console.log('Template objects loaded and rendered successfully');
      } catch (error) {
        console.error('Error enlivening objects:', error);
        alert('Error loading template objects. Please check the console for details.');
      }
    } else {
      console.warn('No Fabric.js objects found in template elements');
      canvas.renderAll();
    }
  };

  const saveHistory = () => {
    if (!fabricCanvasRef.current) return;

    const json = JSON.stringify(fabricCanvasRef.current.toJSON(['metadata']));

    // Check if canvas has changed
    if (json !== lastSavedState) {
      setHasUnsavedChanges(true);
    }

    setHistory((prev) => {
      const newHistory = prev.slice(0, historyStep + 1);
      newHistory.push(json);
      setHistoryStep(newHistory.length - 1);
      return newHistory;
    });
  };

  const undo = () => {
    if (historyStep === 0 || !fabricCanvasRef.current) return;

    const newStep = historyStep - 1;
    const json = history[newStep];

    fabricCanvasRef.current.loadFromJSON(json, () => {
      fabricCanvasRef.current?.renderAll();
      setHistoryStep(newStep);
    });
  };

  const redo = () => {
    if (historyStep >= history.length - 1 || !fabricCanvasRef.current) return;

    const newStep = historyStep + 1;
    const json = history[newStep];

    fabricCanvasRef.current.loadFromJSON(json, () => {
      fabricCanvasRef.current?.renderAll();
      setHistoryStep(newStep);
    });
  };

  const addText = () => {
    if (!fabricCanvasRef.current) return;

    const text = new fabric.IText('New Text', {
      left: 100,
      top: 100,
      fontSize: 24,
      fontFamily: 'Arial',
      fill: '#333333',
      editable: true,
    });

    text.set('metadata', {
      editable: true,
      elementType: 'text',
    });

    fabricCanvasRef.current.add(text);
    fabricCanvasRef.current.setActiveObject(text);
    fabricCanvasRef.current.renderAll();
    saveHistory();
  };

  const addImagePlaceholder = () => {
    if (!fabricCanvasRef.current) return;

    // Create a hidden file input element
    const input = document.createElement('input');
    input.type = 'file';
    // Support all common image formats including WebP, SVG, AVIF, TIFF, BMP, ICO
    input.accept = 'image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml,image/avif,image/tiff,image/bmp,image/x-icon,.png,.jpg,.jpeg,.gif,.webp,.svg,.avif,.tiff,.tif,.bmp,.ico';

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];

      if (file) {
        // Create a data URL from the file
        const reader = new FileReader();
        reader.onload = (event) => {
          const imageUrl = event.target?.result as string;
          if (imageUrl) {
            handleImageSelect(imageUrl);
          }
        };
        reader.readAsDataURL(file);
      }
    };

    // Trigger the file picker
    input.click();
  };

  const deleteSelected = () => {
    if (!fabricCanvasRef.current || !selectedObject) return;

    fabricCanvasRef.current.remove(selectedObject);
    fabricCanvasRef.current.renderAll();
    setSelectedObject(null);
    saveHistory();
  };

  const toggleLock = () => {
    if (!selectedObject) return;

    const currentMetadata = selectedObject.get('metadata') || {};
    const isLocked = currentMetadata.locked || false;

    // Toggle locked state
    selectedObject.set({
      lockMovementX: !isLocked,
      lockMovementY: !isLocked,
      lockRotation: !isLocked,
      lockScalingX: !isLocked,
      lockScalingY: !isLocked,
      hasControls: isLocked, // Hide controls when locked
      hasBorders: isLocked, // Hide borders when locked
      selectable: true, // Always selectable to toggle lock state
      evented: true, // Always respond to events
    });

    // Update metadata to track lock state
    selectedObject.set('metadata', {
      ...currentMetadata,
      locked: !isLocked,
    });

    // Add visual indicator for locked objects
    if (!isLocked) {
      selectedObject.set({
        opacity: selectedObject.opacity || 1,
      });
    }

    fabricCanvasRef.current?.renderAll();
    saveHistory();
  };

  const handleImageSelect = (imageUrl: string) => {
    if (!fabricCanvasRef.current) return;

    console.log('Loading image from:', imageUrl);

    // Function to try loading with fallback
    const loadImageWithFallback = async (url: string) => {
      try {
        return await fabric.FabricImage.fromURL(url, {
          crossOrigin: 'anonymous',
        });
      } catch (error) {
        console.error('Failed to load image from:', url, error);

        // If the URL has quality=high, try without it or with quality=preview
        if (url.includes('quality=high')) {
          console.log('Retrying with quality=preview...');
          const fallbackUrl = url.replace('quality=high', 'quality=preview');
          return await fabric.FabricImage.fromURL(fallbackUrl, {
            crossOrigin: 'anonymous',
          });
        }
        throw error;
      }
    };

    loadImageWithFallback(imageUrl).then((img) => {
      if (!fabricCanvasRef.current) return;

      console.log('Image loaded successfully:', img);

      if (selectedObject) {
        // Replace the selected object with the image
        const targetWidth = selectedObject.width || 200;
        const targetHeight = selectedObject.height || 150;

        // Scale the image to fit
        const scaleX = targetWidth / (img.width || 1);
        const scaleY = targetHeight / (img.height || 1);
        const scale = Math.min(scaleX, scaleY);

        img.set({
          scaleX: scale,
          scaleY: scale,
          left: selectedObject.left,
          top: selectedObject.top,
        });

        // Copy metadata if exists
        const metadata = selectedObject.get('metadata');
        if (metadata) {
          img.set('metadata', { ...metadata, elementType: 'image' });
        }

        // Remove the old object and add the new image
        fabricCanvasRef.current.remove(selectedObject);
      } else {
        // No object selected, add image at center
        const maxWidth = 300;
        const scale = maxWidth / (img.width || 1);

        img.set({
          scaleX: scale,
          scaleY: scale,
          left: (fabricCanvasRef.current.width || 800) / 2 - (maxWidth / 2),
          top: (fabricCanvasRef.current.height || 600) / 2 - ((img.height || 1) * scale / 2),
        });
        img.set('metadata', { editable: true, elementType: 'image' });
      }

      fabricCanvasRef.current.add(img);
      fabricCanvasRef.current.setActiveObject(img);
      fabricCanvasRef.current.renderAll();
      saveHistory();

      console.log('Image added to canvas');
    }).catch((error: Error) => {
      console.error('Error loading image:', error);
      alert('Failed to load image. This may be a temporary server issue. Please try another image or try again later.\n\nError: ' + error.message);
    });
  };

  const handleMultipleImagesSelect = async (imageUrls: string[]) => {
    if (!fabricCanvasRef.current) return;

    console.log(`Loading ${imageUrls.length} images...`);

    const canvasWidth = fabricCanvasRef.current.width || 800;
    const canvasHeight = fabricCanvasRef.current.height || 600;
    const maxWidth = 250;
    const spacing = 20;

    // Calculate grid layout
    const cols = Math.ceil(Math.sqrt(imageUrls.length));
    const rows = Math.ceil(imageUrls.length / cols);

    let loadedCount = 0;

    // Function to load image with fallback
    const loadImageWithFallback = async (url: string) => {
      try {
        return await fabric.FabricImage.fromURL(url, {
          crossOrigin: 'anonymous',
        });
      } catch (error) {
        console.error('Failed to load image from:', url, error);

        // If the URL has quality=high, try with quality=preview
        if (url.includes('quality=high')) {
          console.log('Retrying with quality=preview...');
          const fallbackUrl = url.replace('quality=high', 'quality=preview');
          return await fabric.FabricImage.fromURL(fallbackUrl, {
            crossOrigin: 'anonymous',
          });
        }
        throw error;
      }
    };

    // Load all images
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      const col = i % cols;
      const row = Math.floor(i / cols);

      try {
        const img = await loadImageWithFallback(imageUrl);

        if (!fabricCanvasRef.current) return;

        const scale = maxWidth / (img.width || 1);

        // Position in grid
        const left = 50 + col * (maxWidth + spacing);
        const top = 50 + row * ((img.height || 1) * scale + spacing);

        img.set({
          scaleX: scale,
          scaleY: scale,
          left,
          top,
        });
        img.set('metadata', { editable: true, elementType: 'image' });

        fabricCanvasRef.current.add(img);
        loadedCount++;

        console.log(`Loaded ${loadedCount}/${imageUrls.length} images`);
      } catch (error) {
        console.error(`Failed to load image ${i + 1}:`, error);
      }
    }

    fabricCanvasRef.current.renderAll();
    saveHistory();

    console.log(`Successfully loaded ${loadedCount} images`);
  };

  const saveTemplate = async (saveAs: boolean = false) => {
    if (!fabricCanvasRef.current) return;

    setIsSaving(true);

    try {
      // Ensure background color is set on canvas before saving
      fabricCanvasRef.current.backgroundColor = backgroundColor;

      const canvasData = fabricCanvasRef.current.toJSON(['metadata']);
      console.log('Saving canvas with backgroundColor:', backgroundColor);
      console.log('Canvas background in toJSON:', canvasData.background);

      const objects = fabricCanvasRef.current.getObjects();

      // Convert fabric objects to our template format
      const elements = objects.map((obj) => {
        const metadata = obj.get('metadata') || {};
        const type = obj.get('type');

        let elementType = 'shape';
        if (type === 'i-text' || type === 'text' || type === 'textbox' || metadata.elementType === 'text') {
          elementType = 'text';
        } else if (type === 'image' || metadata.elementType === 'image') {
          elementType = 'image';
        }

        return {
          id: metadata.id || `obj-${Date.now()}-${Math.random()}`,
          type: elementType,
          locked: metadata.locked || false,
          editable: metadata.editable !== false,
          position: {
            x: obj.left || 0,
            y: obj.top || 0,
            z: objects.indexOf(obj),
          },
          size: {
            width: (obj.width || 0) * (obj.scaleX || 1),
            height: (obj.height || 0) * (obj.scaleY || 1),
          },
          style: {
            ...canvasData.objects[objects.indexOf(obj)],
          },
          content: elementType === 'text' ? (obj as any).text : null,
          originalId: metadata.originalId,
        };
      });

      // Generate thumbnail
      const thumbnail = fabricCanvasRef.current.toDataURL({
        format: 'png',
        quality: 0.8,
        multiplier: 0.2, // Scale down for thumbnail
      });

      const templatePayload = {
        name: templateName,
        description: '',
        category: 'other',
        format: {
          width,
          height,
          unit: 'px',
          backgroundColor,
        },
        backgroundColor,
        elements,
        thumbnail,
        metadata: {
          canvasData: JSON.stringify(canvasData),
        },
      };

      console.log('Template payload backgroundColor:', templatePayload.backgroundColor);
      console.log('Template payload format.backgroundColor:', templatePayload.format.backgroundColor);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      let url = `${apiUrl}/api/templates`;
      let method = 'POST';

      if (currentTemplateId && !saveAs) {
        // Update existing template
        url = `${apiUrl}/api/templates/${currentTemplateId}`;
        method = 'PUT';
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templatePayload),
      });

      if (!response.ok) {
        throw new Error('Failed to save template');
      }

      const result = await response.json();
      setCurrentTemplateId(result._id);

      // Update saved state
      const currentState = JSON.stringify(fabricCanvasRef.current.toJSON(['metadata']));
      setLastSavedState(currentState);
      setHasUnsavedChanges(false);

      alert(`Template "${templateName}" saved successfully!`);
    } catch (error: any) {
      console.error('Save error:', error);
      alert('Failed to save template: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const loadTemplate = async (template: any) => {
    if (!fabricCanvasRef.current) return;

    try {
      setTemplateName(template.name);
      setCurrentTemplateId(template._id);
      setTemplateMode('use'); // Default to "use" mode when loading a template

      // Fetch full template data (including elements) if not already loaded
      let fullTemplate = template;
      if (!template.elements && !template.metadata?.canvasData) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const response = await fetch(`${apiUrl}/api/templates/${template._id}`);
        if (response.ok) {
          fullTemplate = await response.json();
        }
      }

      // Load from saved canvas data if available
      if (fullTemplate.metadata?.canvasData) {
        const canvasData = JSON.parse(fullTemplate.metadata.canvasData);

        // Update canvas dimensions from template
        if (fullTemplate.format) {
          setWidth(fullTemplate.format.width);
          setHeight(fullTemplate.format.height);
          fabricCanvasRef.current.setWidth(fullTemplate.format.width);
          fabricCanvasRef.current.setHeight(fullTemplate.format.height);
        }

        // Clear canvas before loading
        fabricCanvasRef.current.clear();

        // Load canvas data using Fabric.js v6 API
        fabricCanvasRef.current.loadFromJSON(canvasData).then(() => {
          // Set background color from multiple possible sources
          console.log('Loading template - checking background sources:');
          console.log('  canvasData.background:', canvasData.background);
          console.log('  canvasData.backgroundColor:', canvasData.backgroundColor);
          console.log('  fullTemplate.backgroundColor:', fullTemplate.backgroundColor);
          console.log('  fullTemplate.format?.backgroundColor:', fullTemplate.format?.backgroundColor);

          const bgColor = canvasData.background ||
                         canvasData.backgroundColor ||
                         fullTemplate.backgroundColor ||
                         fullTemplate.format?.backgroundColor ||
                         '#ffffff';

          console.log('  Selected bgColor:', bgColor);

          setBackgroundColor(bgColor);
          fabricCanvasRef.current!.backgroundColor = bgColor;

          // Restore all custom properties including metadata
          const objects = fabricCanvasRef.current?.getObjects() || [];
          objects.forEach((obj, index) => {
            const savedObj = canvasData.objects?.[index];
            if (savedObj && savedObj.metadata) {
              obj.set('metadata', savedObj.metadata);
            }
          });

          fabricCanvasRef.current?.renderAll();
          saveHistory();
          setRefreshKey(prev => prev + 1); // Force UI refresh
        }).catch((error: any) => {
          console.error('Error loading template:', error);
          alert('Error loading template. The template data may be corrupted.');
        });
      }
      // Handle IDML-parsed elements
      else if (fullTemplate.elements && fullTemplate.elements.length > 0) {
        console.log('Loading IDML template with', fullTemplate.elements.length, 'elements');
        fabricCanvasRef.current.clear();

        // Convert template format dimensions to canvas dimensions
        if (fullTemplate.format) {
          setWidth(fullTemplate.format.width);
          setHeight(fullTemplate.format.height);
          fabricCanvasRef.current.setWidth(fullTemplate.format.width);
          fabricCanvasRef.current.setHeight(fullTemplate.format.height);
        }

        // Set background color from multiple possible sources
        console.log('Loading IDML template - checking background sources:');
        console.log('  fullTemplate.backgroundColor:', fullTemplate.backgroundColor);
        console.log('  fullTemplate.format?.backgroundColor:', fullTemplate.format?.backgroundColor);

        const bgColor = fullTemplate.backgroundColor || fullTemplate.format?.backgroundColor || '#ffffff';
        console.log('  Selected bgColor:', bgColor);

        setBackgroundColor(bgColor);
        fabricCanvasRef.current.backgroundColor = bgColor;

        // Use Fabric.js deserialization to properly restore objects from saved state
        const objectsToEnliven = fullTemplate.elements
          .map((element: any) => {
            // If element has a 'style' property with full Fabric.js object data, use it
            if (element.style && element.style.type) {
              // Merge metadata to preserve editable/locked state
              const fabricObject = {
                ...element.style,
                metadata: {
                  ...(element.style.metadata || {}),
                  editable: element.editable !== false,
                  locked: element.locked || false,
                  originalId: element.originalId || element.id,
                  elementType: element.type, // Preserve original element type
                },
              };
              return fabricObject;
            }
            return null;
          })
          .filter((obj: any) => obj !== null);

        if (objectsToEnliven.length > 0) {
          // Use Fabric.js built-in deserialization
          fabric.util.enlivenObjects(objectsToEnliven).then((enlivenedObjects: fabric.Object[]) => {
            console.log(`Enlivened ${enlivenedObjects.length} objects from template`);

            enlivenedObjects.forEach((obj: fabric.Object, index: number) => {
              if (obj) {
                const metadata = obj.get('metadata') || {};
                const element = fullTemplate.elements[index];

                // Apply lock options based on metadata
                if (metadata.lockOptions) {
                  obj.set({
                    lockMovementX: metadata.lockOptions.lockPosition,
                    lockMovementY: metadata.lockOptions.lockPosition,
                    lockRotation: metadata.lockOptions.lockRotation,
                    lockScalingX: metadata.lockOptions.lockScale,
                    lockScalingY: metadata.lockOptions.lockScale,
                    hasControls: !metadata.lockOptions.lockAll,
                    hasBorders: !metadata.lockOptions.lockAll,
                    selectable: true,
                    evented: true,
                  });
                } else if (element && element.locked) {
                  // Fallback: apply basic lock
                  obj.set({
                    lockMovementX: true,
                    lockMovementY: true,
                    lockRotation: true,
                    lockScalingX: true,
                    lockScalingY: true,
                    hasControls: false,
                    hasBorders: false,
                    selectable: true,
                    evented: true,
                  });
                }

                fabricCanvasRef.current?.add(obj);
              }
            });

            fabricCanvasRef.current.renderAll();
            saveHistory();
            console.log('Template objects loaded and rendered successfully');
          }).catch((error: any) => {
            console.error('Error enlivening objects:', error);
            alert('Error loading template objects. Please check the console for details.');
          });
        } else {
          // Fallback: no proper Fabric objects found, log warning
          console.warn('No Fabric.js objects found in template elements');
          fabricCanvasRef.current.renderAll();
          saveHistory();
        }
      }
      else {
        // Fallback: clear canvas if no data
        fabricCanvasRef.current.clear();
        fabricCanvasRef.current.backgroundColor = '#ffffff';
        fabricCanvasRef.current.renderAll();
      }

      console.log(`Template "${template.name}" loaded successfully!`);
    } catch (error: any) {
      console.error('Load error:', error);
      alert('Failed to load template: ' + error.message);
    }
  };

  const newTemplate = () => {
    if (!fabricCanvasRef.current) return;

    if (confirm('Create a new template? Unsaved changes will be lost.')) {
      fabricCanvasRef.current.clear();
      fabricCanvasRef.current.backgroundColor = '#ffffff';
      fabricCanvasRef.current.renderAll();
      setTemplateName('Untitled Template');
      setCurrentTemplateId(undefined);
      setTemplateMode('design'); // Default to "design" mode for new templates
      saveHistory();
    }
  };

  const exportTemplate = (format: 'json' | 'png' | 'pdf') => {
    if (!fabricCanvasRef.current) return;

    if (format === 'json') {
      const json = fabricCanvasRef.current.toJSON(['metadata']);
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${templateName.replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'png') {
      const dataURL = fabricCanvasRef.current.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 2,
      });
      const a = document.createElement('a');
      a.href = dataURL;
      a.download = `${templateName.replace(/\s+/g, '_')}.png`;
      a.click();
    } else if (format === 'pdf') {
      // For PDF, we'll export as PNG and let the user convert
      // (PDF generation requires additional libraries)
      const dataURL = fabricCanvasRef.current.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 3,
      });
      const a = document.createElement('a');
      a.href = dataURL;
      a.download = `${templateName.replace(/\s+/g, '_')}_HiRes.png`;
      a.click();
    }
  };

  const uploadToCanto = async () => {
    if (!fabricCanvasRef.current) return;

    try {
      // Export canvas as PNG blob
      const dataURL = fabricCanvasRef.current.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 2,
      });

      // Convert data URL to blob
      const response = await fetch(dataURL);
      const blob = await response.blob();

      // Create form data
      const formData = new FormData();
      formData.append('file', blob, `${templateName.replace(/\s+/g, '_')}.png`);
      formData.append('name', templateName);

      // Upload to Canto via backend
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const uploadResponse = await fetch(`${apiUrl}/api/canto/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload to Canto');
      }

      const result = await uploadResponse.json();
      alert(`Successfully uploaded "${templateName}" to Canto!`);
    } catch (error: any) {
      console.error('Upload error:', error);
      alert('Failed to upload to Canto: ' + error.message);
    }
  };

  // Handle beforeunload to warn about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Update canvas dimensions
  useEffect(() => {
    if (!fabricCanvasRef.current) return;
    fabricCanvasRef.current.setWidth(width);
    fabricCanvasRef.current.setHeight(height);
    fabricCanvasRef.current.renderAll();
  }, [width, height]);

  // Update canvas background color
  useEffect(() => {
    if (!fabricCanvasRef.current) return;
    fabricCanvasRef.current.backgroundColor = backgroundColor;
    fabricCanvasRef.current.renderAll();
    saveHistory();
  }, [backgroundColor]);

  // Shape drawing functions
  const addRectangle = () => {
    if (!fabricCanvasRef.current) return;
    const rect = new fabric.Rect({
      left: 100,
      top: 100,
      width: 200,
      height: 150,
      fill: '#3b82f6',
      stroke: '#1e40af',
      strokeWidth: 2,
    });
    fabricCanvasRef.current.add(rect);
    fabricCanvasRef.current.setActiveObject(rect);
    fabricCanvasRef.current.renderAll();
    saveHistory();
  };

  const addCircle = () => {
    if (!fabricCanvasRef.current) return;
    const circle = new fabric.Circle({
      left: 150,
      top: 150,
      radius: 75,
      fill: '#10b981',
      stroke: '#059669',
      strokeWidth: 2,
    });
    fabricCanvasRef.current.add(circle);
    fabricCanvasRef.current.setActiveObject(circle);
    fabricCanvasRef.current.renderAll();
    saveHistory();
  };

  const applyCanvasSettings = (newWidth: number, newHeight: number, newBg: string) => {
    setWidth(newWidth);
    setHeight(newHeight);
    setBackgroundColor(newBg);
    setShowCanvasSettings(false);
  };

  return (
    <div className="flex h-full bg-gray-900">
      {/* Main Editor Area */}
      <div className="flex flex-col flex-1">
        {/* Toolbar */}
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-2.5 flex items-center gap-3 flex-wrap shadow-lg">
          {/* Template Name */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-medium"
              placeholder="Untitled Template"
            />
            {hasUnsavedChanges && (
              <span className="text-xs text-orange-400 font-medium">● Unsaved</span>
            )}
          </div>

          <div className="w-px h-6 bg-gray-600 mx-1" />

          {/* Template Mode Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 bg-gray-700 rounded-md p-0.5">
              <button
                onClick={() => setTemplateMode('design')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  templateMode === 'design'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-300 hover:text-white hover:bg-gray-600'
                }`}
                title="Design Mode - Full editing access"
              >
                Design
              </button>
              <button
                onClick={() => setTemplateMode('use')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  templateMode === 'use'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-300 hover:text-white hover:bg-gray-600'
                }`}
                title="Use Mode - Only editable fields unlocked"
              >
                Use
              </button>
            </div>
            {templateMode === 'use' && (
              <span className="text-xs text-blue-400 font-medium">
                Only editable elements are selectable
              </span>
            )}
          </div>

          <div className="w-px h-6 bg-gray-600 mx-1" />

          {/* File Operations */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowTemplateGallery(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-all text-xs font-medium"
              title="Load Template (Ctrl+O)"
            >
              <FolderOpen size={14} />
              Open
            </button>

            <button
              onClick={() => saveTemplate(false)}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-all text-xs font-medium shadow-sm"
              title="Save Template (Ctrl+S)"
            >
              <Save size={14} />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>

          {/* Insert Section - Only show in Design mode */}
          {templateMode === 'design' && (
            <>
              <div className="w-px h-6 bg-gray-600 mx-1" />

              <div className="flex items-center gap-1">
                <button
                  onClick={addText}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 hover:text-white transition-all"
                  title="Add Text Box (T)"
                >
                  <Type size={16} />
                </button>

                <button
                  onClick={addImagePlaceholder}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 hover:text-white transition-all"
                  title="Add Image Placeholder (I)"
                >
                  <ImageIcon size={16} />
                </button>

                <button
                  onClick={(e) => {
                    setMultiSelectMode(e.shiftKey);
                    setShowImagePicker(true);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-all shadow-sm"
                  title="Add from Canto DAM (Hold Shift for multi-select)"
                >
                  <ImagePlus size={16} />
                </button>

                <button
                  onClick={addRectangle}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 hover:text-white transition-all"
                  title="Add Rectangle (R)"
                >
                  <Square size={16} />
                </button>

                <button
                  onClick={addCircle}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 hover:text-white transition-all"
                  title="Add Circle (C)"
                >
                  <Circle size={16} />
                </button>
              </div>

              <div className="w-px h-6 bg-gray-600 mx-1" />
            </>
          )}

          {/* Edit Section - Only show in Design mode */}
          {templateMode === 'design' && (
            <>
              <div className="w-px h-6 bg-gray-600 mx-1" />

              <div className="flex items-center gap-1">
                <button
                  onClick={undo}
                  disabled={historyStep === 0}
                  className="px-2.5 py-1.5 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm"
                  title="Undo (Ctrl+Z)"
                >
                  ↶
                </button>

                <button
                  onClick={redo}
                  disabled={historyStep >= history.length - 1}
                  className="px-2.5 py-1.5 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm"
                  title="Redo (Ctrl+Y)"
                >
                  ↷
                </button>

                <button
                  onClick={() => setShowCanvasSettings(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 hover:text-white transition-all"
                  title="Canvas Settings - Size & Background"
                >
                  <Settings size={16} />
                </button>
              </div>

              {selectedObject && (
                <>
                  <div className="w-px h-6 bg-gray-600 mx-1" />

                  <div className="flex items-center gap-1">
                    <button
                      onClick={toggleLock}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all ${
                        selectedObject.get('metadata')?.locked
                          ? 'bg-orange-600 text-white hover:bg-orange-700'
                          : 'bg-gray-700 text-gray-200 hover:bg-gray-600 hover:text-white'
                      }`}
                      title={selectedObject.get('metadata')?.locked ? 'Unlock Object' : 'Lock Object (prevents editing)'}
                    >
                      {selectedObject.get('metadata')?.locked ? <Lock size={14} /> : <Unlock size={14} />}
                    </button>

                    <button
                      onClick={deleteSelected}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-all"
                      title="Delete Selected Object (Delete key)"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          <div className="ml-auto flex items-center gap-1">
            {/* View Controls */}
            <button
              onClick={() => setShowRulers(!showRulers)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all ${showRulers ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
              title="Toggle Rulers"
            >
              <Ruler size={16} />
            </button>

            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all ${showGrid ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
              title="Toggle Grid"
            >
              <Grid3x3 size={16} />
            </button>

            <button
              onClick={() => setShowAlignmentTools(!showAlignmentTools)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all ${showAlignmentTools ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
              title="Toggle Alignment Tools"
            >
              <AlignCenter size={16} />
            </button>

            <div className="w-px h-6 bg-gray-600 mx-1" />

            {/* Panel Toggles */}
            <button
              onClick={() => setShowLayers(!showLayers)}
              className={`px-3 py-1.5 rounded-md transition-all text-xs font-medium ${showLayers ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
              title="Toggle Layers Panel"
            >
              Layers
            </button>

            <button
              onClick={() => setShowProperties(!showProperties)}
              className={`px-3 py-1.5 rounded-md transition-all text-xs font-medium ${showProperties ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
              title="Toggle Properties Panel"
            >
              Properties
            </button>

            {/* Export & Upload Menu */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 hover:text-white transition-all text-xs font-medium"
                title="Export & Upload"
              >
                <FileDown size={14} />
                Export
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        exportTemplate('png');
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <Download size={14} />
                      Export as PNG
                    </button>
                    <button
                      onClick={() => {
                        exportTemplate('pdf');
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <Download size={14} />
                      Export as Hi-Res PNG
                    </button>
                    <button
                      onClick={() => {
                        exportTemplate('json');
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <Download size={14} />
                      Export as JSON
                    </button>
                    <div className="border-t border-gray-200 my-1"></div>
                    <button
                      onClick={() => {
                        uploadToCanto();
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-purple-600"
                    >
                      <Upload size={14} />
                      Upload to Canto
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Canvas Area */}
      <div className="flex-1 overflow-auto p-8 flex items-center justify-center" style={{
        backgroundImage: `
          linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px',
        backgroundColor: '#1e1e1e'
      }}>
        <div className="relative bg-white shadow-2xl" style={{
          width: `${width + (showRulers ? 30 : 0)}px`,
          height: `${height + (showRulers ? 30 : 0)}px`
        }}>
          <RulersAndGrid
            canvasWidth={width}
            canvasHeight={height}
            showRulers={showRulers}
            showGrid={showGrid}
            gridSize={gridSize}
            zoom={1}
          />
          <div
            className="absolute bg-white"
            style={{
              left: showRulers ? 30 : 0,
              top: showRulers ? 30 : 0,
              width: `${width}px`,
              height: `${height}px`
            }}
          >
            <canvas ref={canvasRef} />
          </div>
        </div>
      </div>

        {/* Status Bar */}
        <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 text-xs text-gray-300 flex items-center gap-4">
          <span className="font-medium">{width} × {height}px</span>
          {selectedObject && (
            <>
              <span className="text-gray-600">|</span>
              <span className="text-gray-400">
                {selectedObject.get('type')}
                {selectedObject.get('metadata')?.elementType &&
                  ` · ${selectedObject.get('metadata').elementType}`
                }
              </span>
            </>
          )}
          <div className="ml-auto flex items-center gap-3">
            {currentTemplateId && (
              <>
                {hasUnsavedChanges ? (
                  <span className="text-orange-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                    Unsaved
                  </span>
                ) : (
                  <span className="text-green-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                    Saved
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Floating Alignment Tools Panel */}
      {showAlignmentTools && selectedObjects.length > 0 && (
        <div className="absolute left-1/2 bottom-8 transform -translate-x-1/2 z-20">
          <AlignmentTools
            canvas={fabricCanvasRef.current}
            selectedObjects={selectedObjects}
            onUpdate={() => {
              fabricCanvasRef.current?.renderAll();
              setRefreshKey(prev => prev + 1);
              saveHistory();
            }}
          />
        </div>
      )}

      {/* Right Sidebar - Layers Panel */}
      {showLayers && (
        <LayersPanel
          canvas={fabricCanvasRef.current}
          selectedObject={selectedObject}
          onSelectObject={setSelectedObject}
          onRefresh={() => setRefreshKey(prev => prev + 1)}
        />
      )}

      {/* Right Sidebar - Properties Panel */}
      {showProperties && (
        <PropertiesPanel
          canvas={fabricCanvasRef.current}
          selectedObject={selectedObject}
          onUpdate={() => {
            fabricCanvasRef.current?.renderAll();
            setRefreshKey(prev => prev + 1);
          }}
        />
      )}

      {/* Canto Image Picker Modal */}
      {showImagePicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Browse Canto Assets</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Navigate folders and albums to find and insert images into your template
                </p>
              </div>
              <button
                onClick={() => {
                  setShowImagePicker(false);
                  setMultiSelectMode(false);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Asset Picker */}
            <div className="flex-1 overflow-hidden">
              <CantoAssetPicker
                mode="modal"
                onAssetSelect={(asset: CantoAsset) => {
                  handleImageSelect(asset.url.directUrlOriginal);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Canvas Settings Modal */}
      {showCanvasSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Canvas Settings</h2>

            <div className="space-y-4">
              {/* Canvas Dimensions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Canvas Size</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Width (px)</label>
                    <input
                      type="number"
                      value={width}
                      onChange={(e) => setWidth(parseInt(e.target.value) || 800)}
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="100"
                      max="5000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Height (px)</label>
                    <input
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(parseInt(e.target.value) || 600)}
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="100"
                      max="5000"
                    />
                  </div>
                </div>

                {/* Preset Sizes */}
                <div className="mt-3">
                  <label className="block text-xs text-gray-500 mb-2">Presets</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => { setWidth(800); setHeight(600); }} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">
                      800×600
                    </button>
                    <button onClick={() => { setWidth(1920); setHeight(1080); }} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">
                      1920×1080
                    </button>
                    <button onClick={() => { setWidth(1080); setHeight(1080); }} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">
                      Square
                    </button>
                    <button onClick={() => { setWidth(1080); setHeight(1920); }} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">
                      Story
                    </button>
                    <button onClick={() => { setWidth(1200); setHeight(628); }} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">
                      Facebook
                    </button>
                    <button onClick={() => { setWidth(1024); setHeight(1024); }} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">
                      Instagram
                    </button>
                  </div>
                </div>
              </div>

              {/* Background Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Background Color</label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-16 h-10 border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="#ffffff"
                  />
                </div>

                {/* Color Presets */}
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setBackgroundColor('#ffffff')} className="w-8 h-8 rounded border-2 border-gray-300 bg-white" title="White" />
                  <button onClick={() => setBackgroundColor('#f3f4f6')} className="w-8 h-8 rounded border-2 border-gray-300 bg-gray-100" title="Light Gray" />
                  <button onClick={() => setBackgroundColor('#000000')} className="w-8 h-8 rounded border-2 border-gray-300 bg-black" title="Black" />
                  <button onClick={() => setBackgroundColor('#3b82f6')} className="w-8 h-8 rounded border-2 border-gray-300 bg-blue-500" title="Blue" />
                  <button onClick={() => setBackgroundColor('#10b981')} className="w-8 h-8 rounded border-2 border-gray-300 bg-green-500" title="Green" />
                  <button onClick={() => setBackgroundColor('#ef4444')} className="w-8 h-8 rounded border-2 border-gray-300 bg-red-500" title="Red" />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCanvasSettings(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Gallery Modal */}
      <TemplateGallery
        isOpen={showTemplateGallery}
        onClose={() => setShowTemplateGallery(false)}
        onSelectTemplate={loadTemplate}
      />
    </div>
  );
}
