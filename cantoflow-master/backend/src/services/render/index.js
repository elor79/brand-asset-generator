import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';

/**
 * Render Service
 * Handles PDF and image generation from templates
 */
export class RenderService {
  constructor() {
    this.browser = null;
    this.outputDir = process.env.UPLOAD_PATH || './uploads';
  }

  /**
   * Initialize browser instance
   */
  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browser;
  }

  /**
   * Close browser
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Render template to PDF
   * @param {Object} template - Template data
   * @param {Object} customData - User customizations
   * @param {Object} options - Rendering options
   */
  async renderToPDF(template, customData = {}, options = {}) {
    try {
      await this.initBrowser();

      const html = this.generateHTML(template, customData);
      const page = await this.browser.newPage();

      // Set viewport and content
      await page.setViewport({
        width: template.format.width,
        height: template.format.height,
        deviceScaleFactor: options.dpi ? options.dpi / 72 : 1,
      });

      await page.setContent(html, { waitUntil: 'networkidle0' });

      // Generate PDF
      const pdfOptions = {
        width: `${template.format.width}px`,
        height: `${template.format.height}px`,
        printBackground: true,
        preferCSSPageSize: false,
      };

      const pdfBuffer = await page.pdf(pdfOptions);

      await page.close();

      return pdfBuffer;
    } catch (error) {
      console.error('PDF render error:', error);
      throw new Error(`Failed to render PDF: ${error.message}`);
    }
  }

  /**
   * Render template to image (PNG/JPG)
   * @param {Object} template - Template data
   * @param {Object} customData - User customizations
   * @param {Object} options - Rendering options
   */
  async renderToImage(template, customData = {}, options = {}) {
    try {
      await this.initBrowser();

      const html = this.generateHTML(template, customData);
      const page = await this.browser.newPage();

      // Calculate dimensions for social media presets
      let width = template.format.width;
      let height = template.format.height;

      if (options.preset) {
        const dimensions = this.getSocialMediaDimensions(options.preset);
        width = dimensions.width;
        height = dimensions.height;
      } else if (options.scale) {
        width = Math.round(width * options.scale);
        height = Math.round(height * options.scale);
      }

      await page.setViewport({
        width,
        height,
        deviceScaleFactor: options.dpi ? options.dpi / 72 : 2, // Default 2x for retina
      });

      await page.setContent(html, { waitUntil: 'networkidle0' });

      // Take screenshot
      const screenshotBuffer = await page.screenshot({
        type: options.format === 'jpg' ? 'jpeg' : 'png',
        quality: options.format === 'jpg' ? (options.quality || 90) : undefined,
        fullPage: false,
      });

      await page.close();

      // Process with Sharp if needed (resize, compress, etc.)
      let imageBuffer = screenshotBuffer;

      if (options.optimize !== false) {
        const sharpInstance = sharp(screenshotBuffer);

        if (options.format === 'jpg') {
          imageBuffer = await sharpInstance
            .jpeg({ quality: options.quality || 90 })
            .toBuffer();
        } else {
          imageBuffer = await sharpInstance
            .png({ compressionLevel: 9 })
            .toBuffer();
        }
      }

      return imageBuffer;
    } catch (error) {
      console.error('Image render error:', error);
      throw new Error(`Failed to render image: ${error.message}`);
    }
  }

  /**
   * Generate HTML from template and custom data
   */
  generateHTML(template, customData) {
    const elements = template.elements.map((el) => {
      // Merge custom data if provided
      const customEl = customData.elements?.find((e) => e.id === el.id);
      const merged = customEl ? { ...el, ...customEl } : el;

      return this.renderElement(merged);
    }).join('\n');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      width: ${template.format.width}px;
      height: ${template.format.height}px;
      position: relative;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    }

    .element {
      position: absolute;
    }

    .element-text {
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .element-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .element-shape {
      border: 1px solid #000;
    }
  </style>
</head>
<body>
  ${elements}
</body>
</html>
    `.trim();
  }

  /**
   * Render a single element to HTML
   */
  renderElement(element) {
    const style = this.getElementStyle(element);

    switch (element.type) {
      case 'text':
        return `
          <div class="element element-text" style="${style}">
            ${this.escapeHtml(element.content || '')}
          </div>
        `;

      case 'image':
        const imgSrc = element.content?.src || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E';
        return `
          <div class="element element-image" style="${style}">
            <img src="${imgSrc}" alt="" />
          </div>
        `;

      case 'shape':
        return `
          <div class="element element-shape" style="${style}"></div>
        `;

      default:
        return '';
    }
  }

  /**
   * Generate CSS style string from element
   */
  getElementStyle(element) {
    const styles = [];

    // Position
    if (element.position) {
      styles.push(`left: ${element.position.x}px`);
      styles.push(`top: ${element.position.y}px`);
      if (element.position.z !== undefined) {
        styles.push(`z-index: ${element.position.z}`);
      }
    }

    // Size
    if (element.size) {
      styles.push(`width: ${element.size.width}px`);
      styles.push(`height: ${element.size.height}px`);
    }

    // Style properties
    if (element.style) {
      const s = element.style;

      if (s.fill) styles.push(`background-color: ${s.fill}`);
      if (s.stroke) styles.push(`border-color: ${s.stroke}`);
      if (s.strokeWidth) styles.push(`border-width: ${s.strokeWidth}px`);
      if (s.opacity !== undefined) styles.push(`opacity: ${s.opacity}`);
      if (s.fontFamily) styles.push(`font-family: ${s.fontFamily}`);
      if (s.fontSize) styles.push(`font-size: ${s.fontSize}px`);
      if (s.fontWeight) styles.push(`font-weight: ${s.fontWeight}`);
      if (s.textAlign) styles.push(`text-align: ${s.textAlign}`);
      if (s.lineHeight) styles.push(`line-height: ${s.lineHeight}`);
    }

    return styles.join('; ');
  }

  /**
   * Get social media preset dimensions
   */
  getSocialMediaDimensions(preset) {
    const presets = {
      'instagram-post': { width: 1080, height: 1080 },
      'instagram-story': { width: 1080, height: 1920 },
      'facebook-post': { width: 1200, height: 630 },
      'twitter-post': { width: 1200, height: 675 },
      'linkedin-post': { width: 1200, height: 627 },
    };

    return presets[preset] || { width: 1200, height: 1200 };
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Generate thumbnail for template
   */
  async generateThumbnail(template, width = 400, height = 300) {
    try {
      const imageBuffer = await this.renderToImage(template, {}, {
        format: 'png',
        optimize: true,
      });

      const thumbnail = await sharp(imageBuffer)
        .resize(width, height, {
          fit: 'cover',
          position: 'center',
        })
        .png({ compressionLevel: 9 })
        .toBuffer();

      return thumbnail;
    } catch (error) {
      console.error('Thumbnail generation error:', error);
      throw error;
    }
  }
}

export default new RenderService();
