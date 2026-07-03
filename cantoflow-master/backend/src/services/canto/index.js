import axios from 'axios';

/**
 * Canto API Service
 * Handles all interactions with Canto DAM API
 */
export class CantoService {
  constructor() {
    this.apiBase = process.env.CANTO_API_BASE || 'https://api.canto.com';
    this.oauthUrl =
      process.env.CANTO_OAUTH_URL ||
      'https://oauth.canto.global/oauth/api/oauth2';
  }

  /**
   * Exchange authorization code for access token
   */
  async getAccessToken(appId, appSecret, authorizationCode, redirectUri) {
    try {
      const response = await axios.post(`${this.oauthUrl}/token`, {
        app_id: appId,
        app_secret: appSecret,
        grant_type: 'authorization_code',
        code: authorizationCode,
        redirect_uri: redirectUri,
      });

      return response.data;
    } catch (error) {
      console.error('Error getting access token:', error.response?.data || error.message);
      throw new Error('Failed to obtain access token');
    }
  }

  /**
   * Get access token using client credentials (for app-level access)
   */
  async getClientCredentialsToken(appId, appSecret) {
    try {
      // Use URLSearchParams for form-encoded data
      const params = new URLSearchParams();
      params.append('app_id', appId);
      params.append('app_secret', appSecret);
      params.append('grant_type', 'client_credentials');

      const response = await axios.post(`${this.oauthUrl}/token`, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error getting client credentials token:', error.response?.data || error.message);
      throw new Error('Failed to obtain client credentials token');
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(appId, appSecret, refreshToken) {
    try {
      const response = await axios.post(`${this.oauthUrl}/token`, {
        app_id: appId,
        app_secret: appSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      return response.data;
    } catch (error) {
      console.error('Error refreshing token:', error.response?.data || error.message);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Search for assets
   */
  async searchAssets(domain, accessToken, query, options = {}) {
    try {
      const params = {
        keyword: query || '*', // Use wildcard if no keyword
        limit: options.limit || 50,
        start: options.start || 0,
      };

      // Only add sortBy/sortDirection if explicitly provided and valid
      if (options.sortBy && options.sortBy !== 'default') {
        params.sortBy = options.sortBy;
      }
      if (options.sortDirection) {
        params.sortDirection = options.sortDirection;
      }

      if (options.scheme) {
        params.scheme = options.scheme;
      }

      console.log('Canto API request:', {
        url: `https://${domain}/api/v1/search`,
        params
      });

      const response = await axios.get(
        `https://${domain}/api/v1/search`,
        {
          params,
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      console.log('Canto API response:', {
        status: response.status,
        resultCount: response.data?.results?.length || 0
      });

      return response.data;
    } catch (error) {
      const errorData = error.response?.data;
      console.error('Error searching assets:', errorData || error.message);

      // Handle specific Canto error codes
      if (errorData?.code === 3301) {
        throw new Error('Invalid Canto API request. Error 3301: ' + (errorData.message || 'Bad request'));
      } else if (errorData?.code) {
        throw new Error(`Canto API error ${errorData.code}: ${errorData.message || 'Unknown error'}`);
      }

      throw new Error('Failed to search assets: ' + (error.message || 'Unknown error'));
    }
  }

  /**
   * Get asset details
   */
  async getAsset(domain, accessToken, assetId, scheme) {
    try {
      const response = await axios.get(
        `https://${domain}/api/v1/asset/${assetId}`,
        {
          params: { scheme },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error getting asset:', error.response?.data || error.message);
      throw new Error('Failed to get asset');
    }
  }

  /**
   * Get asset content (download URL)
   */
  async getAssetContent(domain, accessToken, assetId, scheme, version = 'original') {
    try {
      const response = await axios.get(
        `https://${domain}/api/v1/content/${assetId}`,
        {
          params: {
            scheme,
            version, // 'original', 'preview', 'thumbnail'
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error getting asset content:', error.response?.data || error.message);
      throw new Error('Failed to get asset content');
    }
  }

  /**
   * Get direct download URL
   */
  async getDirectUrl(domain, accessToken, assetId, scheme) {
    try {
      const response = await axios.get(
        `https://${domain}/api/v1/asset/${assetId}/directurl/original`,
        {
          params: { scheme },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      return response.data.url;
    } catch (error) {
      console.error('Error getting direct URL:', error.response?.data || error.message);
      throw new Error('Failed to get direct URL');
    }
  }

  /**
   * List folders
   */
  async getFolders(domain, accessToken, options = {}) {
    try {
      const params = {
        limit: options.limit || 50,
        start: options.start || 0,
      };

      const response = await axios.get(
        `https://${domain}/api/v1/tree`,
        {
          params,
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      console.log('Root folders/tree response:', {
        status: response.status,
        itemCount: response.data?.results?.length || 0
      });

      // Log first few results to understand structure
      if (response.data?.results?.length > 0) {
        console.log('Sample root tree items (first 3):',
          JSON.stringify(response.data.results.slice(0, 3), null, 2)
        );
      }

      return response.data;
    } catch (error) {
      console.error('Error getting folders:', error.response?.data || error.message);
      throw new Error('Failed to get folders');
    }
  }

  /**
   * Get folder contents (albums within a folder)
   */
  async getFolderContents(domain, accessToken, folderId, options = {}) {
    try {
      const params = {
        limit: options.limit || 50,
        start: options.start || 0,
      };

      const response = await axios.get(
        `https://${domain}/api/v1/tree/${folderId}`,
        {
          params,
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      console.log('Folder contents response:', {
        folderId,
        status: response.status,
        itemCount: response.data?.results?.length || 0
      });

      // Log first few results to understand structure
      if (response.data?.results?.length > 0) {
        console.log('Sample folder contents (first 3):',
          JSON.stringify(response.data.results.slice(0, 3), null, 2)
        );
      }

      return response.data;
    } catch (error) {
      console.error('Error getting folder contents:', error.response?.data || error.message);
      throw new Error('Failed to get folder contents');
    }
  }

  /**
   * List albums
   */
  async getAlbums(domain, accessToken, options = {}) {
    try {
      const params = {
        limit: options.limit || 50,
        start: options.start || 0,
      };

      const response = await axios.get(
        `https://${domain}/api/v1/album`,
        {
          params,
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      console.log('Albums list response:', {
        status: response.status,
        albumCount: response.data?.results?.length || 0
      });

      // Log first few results to understand structure
      if (response.data?.results?.length > 0) {
        console.log('Sample albums (first 3):',
          JSON.stringify(response.data.results.slice(0, 3), null, 2)
        );
      }

      return response.data;
    } catch (error) {
      console.error('Error getting albums:', error.response?.data || error.message);
      throw new Error('Failed to get albums');
    }
  }

  /**
   * Get album contents
   * Uses the /album/{id} endpoint to get assets within a specific album
   */
  async getAlbumContents(domain, accessToken, albumId, options = {}) {
    try {
      const params = {
        limit: options.limit || 50,
        start: options.start || 0,
      };

      const response = await axios.get(
        `https://${domain}/api/v1/album/${albumId}`,
        {
          params,
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      console.log('Album contents response:', {
        albumId,
        status: response.status,
        resultCount: response.data?.results?.length || 0
      });

      // Check if the response has a results array or if assets are in a different property
      if (response.data?.results) {
        return response.data;
      } else if (response.data?.items) {
        return { results: response.data.items, total: response.data.total || response.data.items.length };
      } else {
        // If the response doesn't have the expected structure, return as-is
        console.warn('Unexpected album response structure, returning as-is');
        return response.data;
      }
    } catch (error) {
      console.error('Error getting album contents:', error.response?.data || error.message);

      // If the /album endpoint doesn't work, fall back to /tree endpoint
      if (error.response?.status === 404 || error.response?.status === 400) {
        console.log('Trying alternative /tree endpoint for album:', albumId);
        try {
          const response = await axios.get(
            `https://${domain}/api/v1/tree/${albumId}`,
            {
              params: {
                limit: options.limit || 50,
                start: options.start || 0,
              },
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );
          return response.data;
        } catch (treeError) {
          console.error('Tree endpoint also failed:', treeError.response?.data || treeError.message);
        }
      }

      throw new Error('Failed to get album contents');
    }
  }

  /**
   * Get metadata schema
   */
  async getMetadataSchema(domain, accessToken, scheme) {
    try {
      const response = await axios.get(
        `https://${domain}/api/v1/metadata`,
        {
          params: { scheme },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error getting metadata schema:', error.response?.data || error.message);
      throw new Error('Failed to get metadata schema');
    }
  }
}

export default new CantoService();
