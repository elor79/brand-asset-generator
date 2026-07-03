import express from 'express';
import renderService from '../services/render/index.js';
import Template from '../models/Template.js';

const router = express.Router();

/**
 * POST /api/render/pdf
 * Render template to PDF
 */
router.post('/pdf', async (req, res, next) => {
  try {
    const { templateId, customData, options = {} } = req.body;

    if (!templateId) {
      return res.status(400).json({ error: 'Template ID required' });
    }

    // Get template
    const template = await Template.findById(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Render to PDF
    const pdfBuffer = await renderService.renderToPDF(
      template.toObject(),
      customData,
      options
    );

    // Send PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${template.name}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/render/image
 * Render template to image (PNG/JPG)
 */
router.post('/image', async (req, res, next) => {
  try {
    const { templateId, customData, options = {} } = req.body;

    if (!templateId) {
      return res.status(400).json({ error: 'Template ID required' });
    }

    // Get template
    const template = await Template.findById(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const format = options.format || 'png';
    const preset = options.preset;

    // Render to image
    const imageBuffer = await renderService.renderToImage(
      template.toObject(),
      customData,
      {
        format,
        preset,
        quality: options.quality,
        scale: options.scale,
        dpi: options.dpi,
      }
    );

    // Send image
    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const extension = format === 'jpg' ? 'jpg' : 'png';

    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${template.name}.${extension}"`
    );
    res.send(imageBuffer);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/render/preview
 * Generate preview image (smaller, faster)
 */
router.post('/preview', async (req, res, next) => {
  try {
    const { templateId, customData } = req.body;

    if (!templateId) {
      return res.status(400).json({ error: 'Template ID required' });
    }

    const template = await Template.findById(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Render smaller preview
    const imageBuffer = await renderService.renderToImage(
      template.toObject(),
      customData,
      {
        format: 'png',
        scale: 0.5, // Half size for preview
        optimize: true,
      }
    );

    res.setHeader('Content-Type', 'image/png');
    res.send(imageBuffer);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/render/social-presets
 * Get available social media presets
 */
router.get('/social-presets', (req, res) => {
  const presets = {
    'instagram-post': { width: 1080, height: 1080, name: 'Instagram Post (Square)' },
    'instagram-story': { width: 1080, height: 1920, name: 'Instagram Story' },
    'facebook-post': { width: 1200, height: 630, name: 'Facebook Post' },
    'twitter-post': { width: 1200, height: 675, name: 'Twitter/X Post' },
    'linkedin-post': { width: 1200, height: 627, name: 'LinkedIn Post' },
  };

  res.json(presets);
});

export default router;
