import JSZip from 'jszip';
import { parseStringPromise } from 'xml2js';
import { v4 as uuidv4 } from 'uuid';

/**
 * IDML Parser Service
 * Parses Adobe InDesign IDML files and extracts template structure
 */
export class IDMLParser {
  constructor() {
    this.supportedVersion = 'CS4+';
  }

  /**
   * Parse IDML file buffer
   * @param {Buffer} idmlBuffer - IDML file buffer
   * @returns {Promise<Object>} Parsed template data
   */
  async parse(idmlBuffer) {
    try {
      const zip = await JSZip.loadAsync(idmlBuffer);

      console.log('Parsing IDML file...');

      // Extract key IDML components
      const designmap = await this.extractDesignmap(zip);
      const spreads = await this.extractSpreads(zip);
      const styles = await this.extractStyles(zip);
      const preferences = await this.extractPreferences(zip);

      // Extract editable elements
      const elements = await this.extractElements(spreads);

      // Extract metadata
      const metadata = this.extractMetadata(designmap, styles, preferences);

      return {
        version: this.getIDMLVersion(designmap),
        metadata,
        elements,
        raw: {
          designmap,
          spreads,
          styles,
          preferences,
        },
      };
    } catch (error) {
      console.error('IDML parsing error:', error);
      throw new Error(`Failed to parse IDML: ${error.message}`);
    }
  }

  /**
   * Extract designmap.xml (document structure)
   */
  async extractDesignmap(zip) {
    try {
      const designmapFile = zip.file('designmap.xml');
      if (!designmapFile) {
        throw new Error('Missing designmap.xml');
      }

      const content = await designmapFile.async('string');
      return await parseStringPromise(content);
    } catch (error) {
      console.error('Error extracting designmap:', error);
      throw error;
    }
  }

  /**
   * Extract all spread files
   */
  async extractSpreads(zip) {
    const spreads = [];
    const spreadFiles = zip.folder('Spreads').file(/Spread_.*\.xml/);

    for (const file of spreadFiles) {
      try {
        const content = await file.async('string');
        const parsed = await parseStringPromise(content);
        spreads.push({
          name: file.name,
          data: parsed,
        });
      } catch (error) {
        console.error(`Error parsing spread ${file.name}:`, error);
      }
    }

    return spreads;
  }

  /**
   * Extract styles.xml
   */
  async extractStyles(zip) {
    try {
      const stylesFile = zip.file('Resources/Styles.xml');
      if (!stylesFile) {
        return null;
      }

      const content = await stylesFile.async('string');
      return await parseStringPromise(content);
    } catch (error) {
      console.error('Error extracting styles:', error);
      return null;
    }
  }

  /**
   * Extract preferences.xml
   */
  async extractPreferences(zip) {
    try {
      const preferencesFile = zip.file('Resources/Preferences.xml');
      if (!preferencesFile) {
        return null;
      }

      const content = await preferencesFile.async('string');
      return await parseStringPromise(content);
    } catch (error) {
      console.error('Error extracting preferences:', error);
      return null;
    }
  }

  /**
   * Extract template elements (text frames, image frames, etc.)
   */
  async extractElements(spreads) {
    const elements = [];

    for (const spread of spreads) {
      try {
        // Look for text frames
        const textFrames = this.findTextFrames(spread.data);
        elements.push(...textFrames);

        // Look for rectangles (image frames)
        const rectangles = this.findRectangles(spread.data);
        elements.push(...rectangles);

        // Look for groups
        const groups = this.findGroups(spread.data);
        elements.push(...groups);
      } catch (error) {
        console.error('Error extracting elements from spread:', error);
      }
    }

    return elements;
  }

  /**
   * Find text frames in spread data
   */
  findTextFrames(spreadData) {
    const frames = [];

    // Navigate through the XML structure to find TextFrame elements
    // This is a simplified version - real implementation would be more complex
    const traverse = (obj, path = []) => {
      if (!obj || typeof obj !== 'object') return;

      if (obj.TextFrame) {
        const textFrames = Array.isArray(obj.TextFrame) ? obj.TextFrame : [obj.TextFrame];

        textFrames.forEach((frame) => {
          const element = this.parseTextFrame(frame);
          if (element) {
            frames.push(element);
          }
        });
      }

      // Recursively traverse
      Object.values(obj).forEach((value) => {
        if (typeof value === 'object') {
          traverse(value, [...path]);
        }
      });
    };

    traverse(spreadData);
    return frames;
  }

  /**
   * Parse a text frame into our element format
   */
  parseTextFrame(frame) {
    try {
      const attrs = frame.$ || {};

      // Check if this frame is marked as editable
      const label = attrs.ItemLayer || '';
      const isEditable = label.includes('EDITABLE') || label.includes('EditableText');

      // Extract geometric bounds [y1, x1, y2, x2]
      const bounds = attrs.GeometricBounds
        ? attrs.GeometricBounds.split(' ').map(Number)
        : [0, 0, 100, 100];

      // Get text content
      let content = '';
      if (frame.ParagraphStyleRange) {
        const paragraphs = Array.isArray(frame.ParagraphStyleRange)
          ? frame.ParagraphStyleRange
          : [frame.ParagraphStyleRange];

        content = paragraphs
          .map((p) => {
            if (p.CharacterStyleRange) {
              const chars = Array.isArray(p.CharacterStyleRange)
                ? p.CharacterStyleRange
                : [p.CharacterStyleRange];
              return chars.map((c) => c.Content || '').join('');
            }
            return '';
          })
          .join('\n');
      }

      return {
        id: attrs.Self || uuidv4(),
        type: 'text',
        locked: !isEditable,
        editable: isEditable,
        position: {
          x: bounds[1] || 0,
          y: bounds[0] || 0,
          z: 0,
        },
        size: {
          width: (bounds[3] - bounds[1]) || 100,
          height: (bounds[2] - bounds[0]) || 50,
        },
        style: this.extractTextStyle(frame),
        content: content.trim() || 'Editable Text',
        originalId: attrs.Self,
      };
    } catch (error) {
      console.error('Error parsing text frame:', error);
      return null;
    }
  }

  /**
   * Find rectangles (often used for image placeholders)
   */
  findRectangles(spreadData) {
    const rectangles = [];

    const traverse = (obj) => {
      if (!obj || typeof obj !== 'object') return;

      if (obj.Rectangle) {
        const rects = Array.isArray(obj.Rectangle) ? obj.Rectangle : [obj.Rectangle];

        rects.forEach((rect) => {
          const element = this.parseRectangle(rect);
          if (element) {
            rectangles.push(element);
          }
        });
      }

      Object.values(obj).forEach((value) => {
        if (typeof value === 'object') {
          traverse(value);
        }
      });
    };

    traverse(spreadData);
    return rectangles;
  }

  /**
   * Parse a rectangle into our element format
   */
  parseRectangle(rect) {
    try {
      const attrs = rect.$ || {};
      const label = attrs.ItemLayer || '';
      const isEditable = label.includes('EDITABLE') || label.includes('EditableImage');

      const bounds = attrs.GeometricBounds
        ? attrs.GeometricBounds.split(' ').map(Number)
        : [0, 0, 100, 100];

      // Check if it has an image
      const hasImage = !!rect.Image || !!rect.EPS || !!rect.PDF;

      return {
        id: attrs.Self || uuidv4(),
        type: hasImage ? 'image' : 'shape',
        locked: !isEditable,
        editable: isEditable,
        position: {
          x: bounds[1] || 0,
          y: bounds[0] || 0,
          z: 0,
        },
        size: {
          width: (bounds[3] - bounds[1]) || 100,
          height: (bounds[2] - bounds[0]) || 100,
        },
        style: this.extractShapeStyle(rect),
        content: hasImage ? { type: 'image', src: null } : null,
        originalId: attrs.Self,
      };
    } catch (error) {
      console.error('Error parsing rectangle:', error);
      return null;
    }
  }

  /**
   * Find groups
   */
  findGroups(spreadData) {
    // Simplified - would need more complex logic for real implementation
    return [];
  }

  /**
   * Extract text styling
   */
  extractTextStyle(frame) {
    const style = {};

    // This is simplified - real implementation would parse AppliedFont, PointSize, etc.
    if (frame.ParagraphStyleRange) {
      const para = Array.isArray(frame.ParagraphStyleRange)
        ? frame.ParagraphStyleRange[0]
        : frame.ParagraphStyleRange;

      if (para && para.CharacterStyleRange) {
        const char = Array.isArray(para.CharacterStyleRange)
          ? para.CharacterStyleRange[0]
          : para.CharacterStyleRange;

        if (char && char.$) {
          style.fontSize = parseFloat(char.$.PointSize) || 12;
          style.fontFamily = char.$.AppliedFont || 'Arial';
        }
      }
    }

    return style;
  }

  /**
   * Extract shape styling
   */
  extractShapeStyle(rect) {
    const style = {};
    const attrs = rect.$ || {};

    // Extract fill color, stroke, etc.
    if (attrs.FillColor) {
      style.fill = attrs.FillColor;
    }

    if (attrs.StrokeColor) {
      style.stroke = attrs.StrokeColor;
    }

    if (attrs.StrokeWeight) {
      style.strokeWidth = parseFloat(attrs.StrokeWeight);
    }

    return style;
  }

  /**
   * Extract document metadata
   */
  extractMetadata(designmap, styles, preferences) {
    const metadata = {
      fonts: [],
      colors: [],
      pages: 0,
    };

    try {
      // Extract page count from designmap
      if (designmap && designmap.Document) {
        const doc = designmap.Document;
        if (doc.idPkg && doc.idPkg.Spread) {
          const spreads = Array.isArray(doc.idPkg.Spread)
            ? doc.idPkg.Spread
            : [doc.idPkg.Spread];
          metadata.pages = spreads.length;
        }
      }

      // Extract fonts (simplified)
      // Real implementation would parse font references
      metadata.fonts = ['Arial', 'Helvetica'];

      // Extract colors (simplified)
      metadata.colors = [];
    } catch (error) {
      console.error('Error extracting metadata:', error);
    }

    return metadata;
  }

  /**
   * Get IDML version
   */
  getIDMLVersion(designmap) {
    try {
      if (designmap && designmap.Document && designmap.Document.$) {
        return designmap.Document.$.DOMVersion || 'Unknown';
      }
    } catch (error) {
      console.error('Error getting version:', error);
    }
    return 'Unknown';
  }
}

export default new IDMLParser();
