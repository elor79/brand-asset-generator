import mongoose from 'mongoose';

const templateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  category: {
    type: String,
    enum: ['social-media', 'marketing', 'events', 'corporate-comms', 'other'],
    default: 'other',
  },
  thumbnail: {
    type: String,
    default: null,
  },
  source: {
    type: String,
    enum: ['idml', 'native'],
    required: true,
  },
  format: {
    width: {
      type: Number,
      required: true,
    },
    height: {
      type: Number,
      required: true,
    },
    unit: {
      type: String,
      enum: ['px', 'mm', 'in'],
      default: 'px',
    },
    dpi: {
      type: Number,
      default: 72,
    },
    colorMode: {
      type: String,
      enum: ['RGB', 'CMYK'],
      default: 'RGB',
    },
    backgroundColor: {
      type: String,
      default: '#ffffff',
    },
  },
  backgroundColor: {
    type: String,
    default: '#ffffff',
  },
  metadata: {
    idmlSource: String,
    pages: Number,
    fonts: [String],
    colors: [String],
    tags: [String],
  },
  elements: [{
    id: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['text', 'image', 'shape', 'group'],
      required: true,
    },
    locked: {
      type: Boolean,
      default: false,
    },
    editable: {
      type: Boolean,
      default: true,
    },
    position: {
      x: Number,
      y: Number,
      z: Number,
    },
    size: {
      width: Number,
      height: Number,
    },
    style: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    content: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    originalId: String,
  }],
  createdBy: {
    type: String,
    required: true,
  },
}, {
  timestamps: true,
});

// Indexes
templateSchema.index({ category: 1, createdAt: -1 });
templateSchema.index({ source: 1 });
templateSchema.index({ 'metadata.tags': 1 });

const Template = mongoose.model('Template', templateSchema);

export default Template;
