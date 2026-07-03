// Core template types
export interface Template {
  id: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  thumbnail?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  source: 'idml' | 'native';
  format: TemplateFormat;
  metadata: TemplateMetadata;
  elements: TemplateElement[];
}

export type TemplateCategory =
  | 'social-media'
  | 'marketing'
  | 'events'
  | 'corporate-comms'
  | 'other';

export interface TemplateFormat {
  width: number;
  height: number;
  unit: 'px' | 'mm' | 'in';
  dpi?: number;
  colorMode?: 'RGB' | 'CMYK';
}

export interface TemplateMetadata {
  idmlSource?: string; // Original IDML file path
  pages?: number;
  fonts?: string[];
  colors?: string[];
  tags?: string[];
}

export interface TemplateElement {
  id: string;
  type: 'text' | 'image' | 'shape' | 'group';
  locked: boolean;
  editable: boolean;
  position: Position;
  size: Size;
  style: ElementStyle;
  content?: any;
}

export interface Position {
  x: number;
  y: number;
  z?: number; // Layer order
}

export interface Size {
  width: number;
  height: number;
}

export interface ElementStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
}

// Canto DAM types
export interface CantoAsset {
  id: string;
  name: string;
  url: {
    preview: string;
    download: string;
    directUrlPreview?: string;
    directUrlOriginal?: string;
  };
  metadata: {
    width?: number;
    height?: number;
    size?: number;
    format?: string;
    created?: string;
    modified?: string;
  };
  scheme: string;
}

export interface CantoAuthConfig {
  domain: string;
  appId: string;
  appSecret: string;
  oauthUrl: string;
}

export interface CantoAuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

// Export types
export type ExportFormat = 'pdf' | 'png' | 'jpg';

export interface ExportOptions {
  format: ExportFormat;
  quality?: number; // 1-100 for JPG
  dpi?: number; // For print-ready exports
  scale?: number; // For image exports
  preset?: SocialMediaPreset;
}

export type SocialMediaPreset =
  | 'instagram-post' // 1080x1080
  | 'instagram-story' // 1080x1920
  | 'facebook-post' // 1200x630
  | 'twitter-post' // 1200x675
  | 'linkedin-post' // 1200x627
  | 'custom';

export const SOCIAL_MEDIA_DIMENSIONS: Record<
  Exclude<SocialMediaPreset, 'custom'>,
  { width: number; height: number }
> = {
  'instagram-post': { width: 1080, height: 1080 },
  'instagram-story': { width: 1080, height: 1920 },
  'facebook-post': { width: 1200, height: 630 },
  'twitter-post': { width: 1200, height: 675 },
  'linkedin-post': { width: 1200, height: 627 },
};

// IDML parsing types
export interface IDMLTemplate {
  designmap: any;
  spreads: any[];
  styles: any;
  preferences: any;
  fonts: string[];
  elements: TemplateElement[];
}

export interface IDMLUploadResponse {
  templateId: string;
  name: string;
  parsed: boolean;
  elementsCount: number;
  errors?: string[];
}
