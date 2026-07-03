import axios from 'axios';
import type { CantoAsset, CantoAuthConfig, CantoAuthResponse } from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export class CantoAPI {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private config: CantoAuthConfig;

  constructor(config: CantoAuthConfig) {
    this.config = config;
  }

  /**
   * Authenticate with Canto using OAuth 2.0
   */
  async authenticate(authorizationCode?: string): Promise<CantoAuthResponse> {
    try {
      const response = await axios.post<CantoAuthResponse>(
        `${API_BASE}/api/canto/auth`,
        {
          domain: this.config.domain,
          appId: this.config.appId,
          appSecret: this.config.appSecret,
          authorizationCode,
        }
      );

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;

      return response.data;
    } catch (error) {
      console.error('Canto authentication failed:', error);
      throw error;
    }
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl(redirectUri: string): string {
    const params = new URLSearchParams({
      app_id: this.config.appId,
      redirect_uri: redirectUri,
      response_type: 'code',
    });

    return `${this.config.oauthUrl}/authorize?${params.toString()}`;
  }

  /**
   * Search for assets in Canto
   */
  async searchAssets(
    query: string,
    options?: {
      limit?: number;
      start?: number;
      scheme?: string;
    }
  ): Promise<CantoAsset[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    try {
      const response = await axios.get(`${API_BASE}/api/canto/search`, {
        params: {
          query,
          limit: options?.limit || 50,
          start: options?.start || 0,
          scheme: options?.scheme,
        },
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      return response.data.results;
    } catch (error) {
      console.error('Asset search failed:', error);
      throw error;
    }
  }

  /**
   * Get asset details by ID
   */
  async getAsset(assetId: string, scheme: string): Promise<CantoAsset> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    try {
      const response = await axios.get(
        `${API_BASE}/api/canto/asset/${assetId}`,
        {
          params: { scheme },
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Get asset failed:', error);
      throw error;
    }
  }

  /**
   * Get asset download URL
   */
  async getAssetDownloadUrl(
    assetId: string,
    scheme: string
  ): Promise<string> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    try {
      const response = await axios.get(
        `${API_BASE}/api/canto/asset/${assetId}/download`,
        {
          params: { scheme },
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      return response.data.url;
    } catch (error) {
      console.error('Get download URL failed:', error);
      throw error;
    }
  }

  /**
   * Browse albums in Canto
   */
  async getAlbums(): Promise<any[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    try {
      const response = await axios.get(`${API_BASE}/api/canto/albums`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      return response.data.albums;
    } catch (error) {
      console.error('Get albums failed:', error);
      throw error;
    }
  }

  /**
   * Get assets from a specific album
   */
  async getAlbumAssets(albumId: string): Promise<CantoAsset[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    try {
      const response = await axios.get(
        `${API_BASE}/api/canto/albums/${albumId}/assets`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      return response.data.results;
    } catch (error) {
      console.error('Get album assets failed:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(): Promise<CantoAuthResponse> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post<CantoAuthResponse>(
        `${API_BASE}/api/canto/refresh`,
        {
          refreshToken: this.refreshToken,
        }
      );

      this.accessToken = response.data.access_token;
      if (response.data.refresh_token) {
        this.refreshToken = response.data.refresh_token;
      }

      return response.data;
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  /**
   * Clear authentication
   */
  clearAuth(): void {
    this.accessToken = null;
    this.refreshToken = null;
  }
}

// Singleton instance
let cantoApiInstance: CantoAPI | null = null;

export function getCantoAPI(): CantoAPI {
  if (!cantoApiInstance) {
    const config: CantoAuthConfig = {
      domain: process.env.NEXT_PUBLIC_CANTO_DOMAIN || '',
      appId: process.env.NEXT_PUBLIC_CANTO_APP_ID || '',
      appSecret: process.env.NEXT_PUBLIC_CANTO_APP_SECRET || '',
      oauthUrl:
        process.env.NEXT_PUBLIC_CANTO_OAUTH_URL ||
        'https://oauth.canto.global/oauth/api/oauth2',
    };

    cantoApiInstance = new CantoAPI(config);
  }

  return cantoApiInstance;
}
