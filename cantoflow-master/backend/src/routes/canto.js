import express from 'express';
import cantoService from '../services/canto/index.js';

const router = express.Router();

/**
 * POST /api/canto/auth
 * Authenticate with Canto and get access token
 */
router.post('/auth', async (req, res, next) => {
  try {
    const { domain, appId, appSecret, authorizationCode, redirectUri } = req.body;

    if (!domain || !appId || !appSecret) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['domain', 'appId', 'appSecret'],
      });
    }

    let tokenData;

    if (authorizationCode) {
      // Authorization code flow
      tokenData = await cantoService.getAccessToken(
        appId,
        appSecret,
        authorizationCode,
        redirectUri
      );
    } else {
      // Client credentials flow
      tokenData = await cantoService.getClientCredentialsToken(appId, appSecret);
    }

    res.json(tokenData);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/canto/refresh
 * Refresh access token
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { appId, appSecret, refreshToken } = req.body;

    if (!appId || !appSecret || !refreshToken) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['appId', 'appSecret', 'refreshToken'],
      });
    }

    const tokenData = await cantoService.refreshAccessToken(
      appId,
      appSecret,
      refreshToken
    );

    res.json(tokenData);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/canto/search
 * Search for assets (auto-authenticates using configured credentials)
 */
router.get('/search', async (req, res, next) => {
  try {
    const { keyword, limit, start, sortBy, sortDirection } = req.query;

    // Use configured credentials from environment
    const domain = process.env.CANTO_DOMAIN;
    const preGeneratedToken = process.env.CANTO_ACCESS_TOKEN;
    const appId = process.env.CANTO_APP_ID;
    const appSecret = process.env.CANTO_APP_SECRET;

    if (!domain) {
      return res.status(500).json({
        success: false,
        error: 'Canto domain not configured',
        message: 'Please configure CANTO_DOMAIN in backend .env',
        configured: false
      });
    }

    let accessToken;

    // Option 1: Use pre-generated access token (Client Credentials Mode)
    if (preGeneratedToken) {
      console.log('Using pre-generated Canto access token');
      accessToken = preGeneratedToken;
    }
    // Option 2: Try OAuth flow with App ID and Secret
    else if (appId && appSecret) {
      console.log('Canto configuration:', {
        domain,
        appId: appId.substring(0, 8) + '...',
        hasSecret: !!appSecret
      });

      // Get access token using client credentials OAuth
      try {
        const tokenData = await cantoService.getClientCredentialsToken(appId, appSecret);
        accessToken = tokenData.accessToken;
      } catch (authError) {
        console.error('OAuth authentication failed:', authError.message);

        return res.status(401).json({
          success: false,
          error: 'Canto authentication failed',
          message: 'OAuth failed. Please generate an access token in Canto (Settings -> Client Credentials Mode) and add it to CANTO_ACCESS_TOKEN in backend .env',
          details: 'OAuth error: ' + authError.message,
          configured: true,
          authFailed: true
        });
      }
    }
    // No authentication method available
    else {
      return res.status(500).json({
        success: false,
        error: 'No Canto authentication configured',
        message: 'Please either: (1) Add CANTO_ACCESS_TOKEN to backend .env, or (2) Configure CANTO_APP_ID and CANTO_APP_SECRET',
        configured: false
      });
    }

    // Search for assets
    const response = await cantoService.searchAssets(
      domain,
      accessToken,
      keyword || '',
      {
        limit: parseInt(limit) || 200,
        start: parseInt(start) || 0,
        sortBy: sortBy || 'default',
        sortDirection: sortDirection || 'descending',
      }
    );

    // Transform response to match frontend expectations
    // Proxy URLs through our backend to avoid CORS issues
    const results = response.results?.map(asset => {
      // Priority for original/high-resolution URL:
      // 1. directUrlOriginal - highest quality
      // 2. download - full quality download URL
      // 3. CantoImage - original canvas URL
      // 4. preview - fallback (lower quality)
      const originalUrl = asset.url?.directUrlOriginal
        || asset.url?.download
        || asset.url?.CantoImage
        || asset.url?.preview
        || '';

      // Preview URL for thumbnails (lower resolution is fine)
      const previewUrl = asset.url?.preview || asset.url?.directUrlOriginal || '';

      return {
        id: asset.id,
        name: asset.name || 'Untitled',
        scheme: asset.scheme,
        default: asset.default, // Contains Scheme for MDC links
        url: {
          // High-res original for canvas use
          directUrlOriginal: originalUrl ? `http://localhost:4000/api/canto/proxy-image?url=${encodeURIComponent(originalUrl)}&quality=high` : '',
          // Preview for thumbnails
          directUrlPreview: previewUrl ? `http://localhost:4000/api/canto/proxy-image?url=${encodeURIComponent(previewUrl)}&quality=preview` : ''
        }
      };
    }) || [];

    res.json({
      success: true,
      results: results,
      total: response.found || results.length
    });
  } catch (error) {
    console.error('Canto search error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to search Canto assets'
    });
  }
});

/**
 * GET /api/canto/asset/:assetId
 * Get asset details
 */
router.get('/asset/:assetId', async (req, res, next) => {
  try {
    const { assetId } = req.params;
    const { domain, scheme } = req.query;
    const accessToken = req.headers.authorization?.replace('Bearer ', '');

    if (!accessToken) {
      return res.status(401).json({ error: 'No access token provided' });
    }

    if (!domain || !scheme) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['domain', 'scheme'],
      });
    }

    const asset = await cantoService.getAsset(domain, accessToken, assetId, scheme);

    res.json(asset);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/canto/asset/:assetId/download
 * Get asset download URL
 */
router.get('/asset/:assetId/download', async (req, res, next) => {
  try {
    const { assetId } = req.params;
    const { domain, scheme, version } = req.query;
    const accessToken = req.headers.authorization?.replace('Bearer ', '');

    if (!accessToken) {
      return res.status(401).json({ error: 'No access token provided' });
    }

    if (!domain || !scheme) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['domain', 'scheme'],
      });
    }

    const url = await cantoService.getDirectUrl(
      domain,
      accessToken,
      assetId,
      scheme
    );

    res.json({ url });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/canto/folders
 * List folders (auto-authenticates using configured credentials)
 */
router.get('/folders', async (req, res, next) => {
  try {
    const { limit, start } = req.query;

    // Use configured credentials from environment
    const domain = process.env.CANTO_DOMAIN;
    const preGeneratedToken = process.env.CANTO_ACCESS_TOKEN;
    const appId = process.env.CANTO_APP_ID;
    const appSecret = process.env.CANTO_APP_SECRET;

    if (!domain) {
      return res.status(500).json({
        success: false,
        error: 'Canto domain not configured',
        message: 'Please configure CANTO_DOMAIN in backend .env',
        configured: false
      });
    }

    let accessToken;

    // Option 1: Use pre-generated access token
    if (preGeneratedToken) {
      accessToken = preGeneratedToken;
    }
    // Option 2: Try OAuth flow with App ID and Secret
    else if (appId && appSecret) {
      try {
        const tokenData = await cantoService.getClientCredentialsToken(appId, appSecret);
        accessToken = tokenData.accessToken;
      } catch (authError) {
        return res.status(401).json({
          success: false,
          error: 'Canto authentication failed',
          message: 'Please add CANTO_ACCESS_TOKEN to backend .env',
          configured: true,
          authFailed: true
        });
      }
    }
    // No authentication method available
    else {
      return res.status(500).json({
        success: false,
        error: 'No Canto authentication configured',
        message: 'Please add CANTO_ACCESS_TOKEN to backend .env',
        configured: false
      });
    }

    const response = await cantoService.getFolders(domain, accessToken, {
      limit: parseInt(limit) || 100,
      start: parseInt(start) || 0,
    });

    // Recursive function to preserve tree structure with children
    const transformTreeNode = (node) => {
      const transformed = {
        id: node.id,
        name: node.name || 'Untitled',
        scheme: node.scheme || 'folder',
        description: node.description || ''
      };

      // Recursively transform children if they exist
      if (node.children && Array.isArray(node.children)) {
        transformed.children = node.children.map(transformTreeNode);
      }

      return transformed;
    };

    // If results is an array, wrap in a synthetic root with children
    // Otherwise, treat as single tree node
    let treeData;
    if (Array.isArray(response.results)) {
      treeData = {
        id: 'root',
        name: domain,
        scheme: 'folder',
        children: response.results.map(transformTreeNode)
      };
    } else if (response.children) {
      // Single tree node already
      treeData = transformTreeNode(response);
    } else {
      // Fallback: empty root
      treeData = {
        id: 'root',
        name: domain,
        scheme: 'folder',
        children: []
      };
    }

    res.json(treeData);
  } catch (error) {
    console.error('Canto folders error:', error);
    res.json({
      id: 'root',
      name: 'Error',
      scheme: 'folder',
      children: [],
      error: 'Folders endpoint not available or no folders found'
    });
  }
});

/**
 * GET /api/canto/folders/:folderId/albums
 * Get albums from a folder (auto-authenticates using configured credentials)
 */
router.get('/folders/:folderId/albums', async (req, res, next) => {
  try {
    const { folderId } = req.params;
    const { limit, start } = req.query;

    // Use configured credentials from environment
    const domain = process.env.CANTO_DOMAIN;
    const preGeneratedToken = process.env.CANTO_ACCESS_TOKEN;
    const appId = process.env.CANTO_APP_ID;
    const appSecret = process.env.CANTO_APP_SECRET;

    if (!domain) {
      return res.status(500).json({
        success: false,
        error: 'Canto domain not configured',
        message: 'Please configure CANTO_DOMAIN in backend .env',
        configured: false
      });
    }

    let accessToken;

    // Option 1: Use pre-generated access token
    if (preGeneratedToken) {
      accessToken = preGeneratedToken;
    }
    // Option 2: Try OAuth flow with App ID and Secret
    else if (appId && appSecret) {
      try {
        const tokenData = await cantoService.getClientCredentialsToken(appId, appSecret);
        accessToken = tokenData.accessToken;
      } catch (authError) {
        return res.status(401).json({
          success: false,
          error: 'Canto authentication failed',
          message: 'Please add CANTO_ACCESS_TOKEN to backend .env',
          configured: true,
          authFailed: true
        });
      }
    }
    // No authentication method available
    else {
      return res.status(500).json({
        success: false,
        error: 'No Canto authentication configured',
        message: 'Please add CANTO_ACCESS_TOKEN to backend .env',
        configured: false
      });
    }

    const response = await cantoService.getFolderContents(domain, accessToken, folderId, {
      limit: parseInt(limit) || 100,
      start: parseInt(start) || 0,
    });

    // Transform response to include scheme
    const results = (response.results || []).map(album => ({
      id: album.id,
      name: album.name || 'Untitled Album',
      description: album.description || '',
      scheme: 'album'
    }));

    res.json({
      success: true,
      results: results,
      total: response.found || results.length
    });
  } catch (error) {
    console.error('Canto folder contents error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to load folder contents'
    });
  }
});

/**
 * GET /api/canto/albums
 * List albums (auto-authenticates using configured credentials)
 */
router.get('/albums', async (req, res, next) => {
  try {
    const { limit, start } = req.query;

    // Use configured credentials from environment
    const domain = process.env.CANTO_DOMAIN;
    const preGeneratedToken = process.env.CANTO_ACCESS_TOKEN;
    const appId = process.env.CANTO_APP_ID;
    const appSecret = process.env.CANTO_APP_SECRET;

    if (!domain) {
      return res.status(500).json({
        success: false,
        error: 'Canto domain not configured',
        message: 'Please configure CANTO_DOMAIN in backend .env',
        configured: false
      });
    }

    let accessToken;

    // Option 1: Use pre-generated access token
    if (preGeneratedToken) {
      accessToken = preGeneratedToken;
    }
    // Option 2: Try OAuth flow with App ID and Secret
    else if (appId && appSecret) {
      try {
        const tokenData = await cantoService.getClientCredentialsToken(appId, appSecret);
        accessToken = tokenData.accessToken;
      } catch (authError) {
        return res.status(401).json({
          success: false,
          error: 'Canto authentication failed',
          message: 'Please add CANTO_ACCESS_TOKEN to backend .env',
          configured: true,
          authFailed: true
        });
      }
    }
    // No authentication method available
    else {
      return res.status(500).json({
        success: false,
        error: 'No Canto authentication configured',
        message: 'Please add CANTO_ACCESS_TOKEN to backend .env',
        configured: false
      });
    }

    const response = await cantoService.getAlbums(domain, accessToken, {
      limit: parseInt(limit) || 100,
      start: parseInt(start) || 0,
    });

    // Transform response to include scheme
    const results = (response.results || []).map(album => ({
      id: album.id,
      name: album.name || 'Untitled Album',
      description: album.description || '',
      scheme: 'album'
    }));

    res.json({
      success: true,
      results: results,
      total: response.found || results.length
    });
  } catch (error) {
    console.error('Canto albums error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to load albums'
    });
  }
});

/**
 * GET /api/canto/albums/:albumId/assets
 * Get assets from an album (auto-authenticates using configured credentials)
 */
router.get('/albums/:albumId/assets', async (req, res, next) => {
  try {
    const { albumId } = req.params;
    const { limit, start } = req.query;

    // Use configured credentials from environment
    const domain = process.env.CANTO_DOMAIN;
    const preGeneratedToken = process.env.CANTO_ACCESS_TOKEN;
    const appId = process.env.CANTO_APP_ID;
    const appSecret = process.env.CANTO_APP_SECRET;

    if (!domain) {
      return res.status(500).json({
        success: false,
        error: 'Canto domain not configured',
        message: 'Please configure CANTO_DOMAIN in backend .env',
        configured: false
      });
    }

    let accessToken;

    // Option 1: Use pre-generated access token
    if (preGeneratedToken) {
      accessToken = preGeneratedToken;
    }
    // Option 2: Try OAuth flow with App ID and Secret
    else if (appId && appSecret) {
      try {
        const tokenData = await cantoService.getClientCredentialsToken(appId, appSecret);
        accessToken = tokenData.accessToken;
      } catch (authError) {
        return res.status(401).json({
          success: false,
          error: 'Canto authentication failed',
          message: 'Please add CANTO_ACCESS_TOKEN to backend .env',
          configured: true,
          authFailed: true
        });
      }
    }
    // No authentication method available
    else {
      return res.status(500).json({
        success: false,
        error: 'No Canto authentication configured',
        message: 'Please add CANTO_ACCESS_TOKEN to backend .env',
        configured: false
      });
    }

    const response = await cantoService.getAlbumContents(
      domain,
      accessToken,
      albumId,
      {
        limit: parseInt(limit) || 200,
        start: parseInt(start) || 0,
      }
    );

    // Transform response to match frontend expectations (same as search)
    const results = response.results?.map(asset => {
      // Priority for original/high-resolution URL:
      // 1. directUrlOriginal - highest quality
      // 2. download - full quality download URL
      // 3. CantoImage - original canvas URL
      // 4. preview - fallback (lower quality)
      const originalUrl = asset.url?.directUrlOriginal
        || asset.url?.download
        || asset.url?.CantoImage
        || asset.url?.preview
        || '';

      // Preview URL for thumbnails (lower resolution is fine)
      const previewUrl = asset.url?.preview || asset.url?.directUrlOriginal || '';

      return {
        id: asset.id,
        name: asset.name || 'Untitled',
        scheme: asset.scheme,
        default: asset.default, // Contains Scheme for MDC links
        url: {
          // High-res original for canvas use
          directUrlOriginal: originalUrl ? `http://localhost:4000/api/canto/proxy-image?url=${encodeURIComponent(originalUrl)}&quality=high` : '',
          // Preview for thumbnails
          directUrlPreview: previewUrl ? `http://localhost:4000/api/canto/proxy-image?url=${encodeURIComponent(previewUrl)}&quality=preview` : ''
        }
      };
    }) || [];

    res.json({
      success: true,
      results: results,
      total: response.found || results.length
    });
  } catch (error) {
    console.error('Canto album contents error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to load album contents'
    });
  }
});

/**
 * GET /api/canto/proxy-image
 * Proxy Canto images to avoid CORS issues
 */
router.get('/proxy-image', async (req, res, next) => {
  try {
    const { url, quality } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    // Use the configured access token
    const accessToken = process.env.CANTO_ACCESS_TOKEN;

    if (!accessToken) {
      return res.status(500).json({ error: 'Canto access token not configured' });
    }

    // Determine which URL to use based on quality
    // For high quality, try to get the original, otherwise use the provided URL
    let imageUrl = url;

    // Note: quality param is just metadata for now - Canto URLs already determine quality
    // We could enhance this later to fetch different versions from Canto API

    console.log(`Proxying image: ${imageUrl.substring(0, 100)}... (quality: ${quality || 'default'})`);

    // Fetch the image from Canto with authentication
    const axios = (await import('axios')).default;
    const response = await axios.get(imageUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      responseType: 'arraybuffer',
      maxContentLength: 50 * 1024 * 1024, // 50MB max for high-res images
    });

    // Forward the content type and set CORS headers for images
    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.set('Cross-Origin-Resource-Policy', 'cross-origin'); // Allow cross-origin access
    res.set('Access-Control-Allow-Origin', '*'); // Allow any origin for images
    res.send(response.data);
  } catch (error) {
    console.error('Error proxying image:', error.response?.status, error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to load image',
      details: error.message
    });
  }
});

/**
 * POST /api/canto/upload
 * Upload file to Canto
 */
router.post('/upload', async (req, res, next) => {
  try {
    // Note: This is a placeholder endpoint
    // Canto's API for uploading files requires specific permissions and setup
    // For now, we'll return a success message indicating this feature needs additional configuration

    res.status(501).json({
      error: 'Upload to Canto not yet implemented',
      message: 'Uploading to Canto requires additional API configuration and permissions. Please contact your Canto administrator to enable this feature.',
      success: false
    });
  } catch (error) {
    next(error);
  }
});

export default router;
