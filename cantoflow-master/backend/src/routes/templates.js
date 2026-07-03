import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import idmlParser from '../services/idml-parser/index.js';
import Template from '../models/Template.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.idml') {
      cb(null, true);
    } else {
      cb(new Error('Only IDML files are allowed'));
    }
  },
});

/**
 * POST /api/templates/upload-idml
 * Upload and parse IDML file
 */
router.post('/upload-idml', upload.single('idml'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { name, description, category } = req.body;

    console.log(`Processing IDML file: ${req.file.originalname}`);

    // Parse IDML
    const parsed = await idmlParser.parse(req.file.buffer);

    // Create template in database
    const template = new Template({
      name: name || path.basename(req.file.originalname, '.idml'),
      description: description || '',
      category: category || 'other',
      source: 'idml',
      format: {
        width: 800, // Default, should be extracted from IDML
        height: 600,
        unit: 'px',
      },
      metadata: {
        idmlSource: req.file.originalname,
        pages: parsed.metadata.pages,
        fonts: parsed.metadata.fonts,
        colors: parsed.metadata.colors,
      },
      elements: parsed.elements,
      createdBy: 'system', // TODO: Add user authentication
    });

    await template.save();

    res.status(201).json({
      templateId: template._id,
      name: template.name,
      parsed: true,
      elementsCount: parsed.elements.length,
      metadata: parsed.metadata,
    });
  } catch (error) {
    console.error('IDML upload error:', error);
    next(error);
  }
});

/**
 * GET /api/templates
 * List all templates
 */
router.get('/', async (req, res, next) => {
  try {
    const { category, source, limit = 50, skip = 0 } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (source) filter.source = source;

    const templates = await Template.find(filter)
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .sort({ createdAt: -1 })
      .select('-elements'); // Don't send full elements in list view

    const total = await Template.countDocuments(filter);

    res.json({
      templates,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/templates/:id
 * Get template by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const template = await Template.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/templates/:id
 * Update template
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { name, description, category, format, backgroundColor, elements, thumbnail, metadata } = req.body;

    const update = {};
    if (name) update.name = name;
    if (description !== undefined) update.description = description;
    if (category) update.category = category;
    if (format) update.format = format;
    if (backgroundColor !== undefined) update.backgroundColor = backgroundColor;
    if (elements) update.elements = elements;
    if (thumbnail !== undefined) update.thumbnail = thumbnail;
    if (metadata) update.metadata = { ...update.metadata, ...metadata };
    update.updatedAt = new Date();

    const template = await Template.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/templates/:id
 * Delete template
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const template = await Template.findByIdAndDelete(req.params.id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/templates
 * Create template from scratch (native editor)
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, description, category, format, elements, thumbnail, metadata } = req.body;

    if (!name || !format || !elements) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['name', 'format', 'elements'],
      });
    }

    const template = new Template({
      name,
      description: description || '',
      category: category || 'other',
      source: 'native',
      format,
      elements,
      thumbnail: thumbnail || null,
      metadata: metadata || {},
      createdBy: 'system', // TODO: Add user authentication
    });

    await template.save();

    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

export default router;
