'use client';

import { useState, useEffect } from 'react';
import { Search, X, Image as ImageIcon, Loader } from 'lucide-react';

interface CantoImagePickerProps {
  onSelectImage: (imageUrl: string) => void;
  onSelectMultiple?: (imageUrls: string[]) => void;
  onClose: () => void;
  multiSelect?: boolean;
}

interface CantoAsset {
  id: string;
  name: string;
  url: {
    directUrlOriginal: string;
    directUrlPreview: string;
  };
}

export default function CantoImagePicker({
  onSelectImage,
  onSelectMultiple,
  onClose,
  multiSelect = false
}: CantoImagePickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [assets, setAssets] = useState<CantoAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);

  useEffect(() => {
    // Check if Canto is configured
    const domain = process.env.NEXT_PUBLIC_CANTO_DOMAIN;
    const appId = process.env.NEXT_PUBLIC_CANTO_APP_ID;
    const appSecret = process.env.NEXT_PUBLIC_CANTO_APP_SECRET;

    if (domain && appId && appSecret) {
      setIsConfigured(true);
      loadAssets();
    } else {
      setIsConfigured(false);
      loadMockAssets();
    }
  }, []);

  const loadMockAssets = () => {
    const mockAssets = [
      {
        id: '1',
        name: 'Product Photo 1',
        url: {
          directUrlOriginal: 'https://via.placeholder.com/800x600/3B82F6/FFFFFF?text=Product+1',
          directUrlPreview: 'https://via.placeholder.com/400x300/3B82F6/FFFFFF?text=Product+1'
        }
      },
      {
        id: '2',
        name: 'Product Photo 2',
        url: {
          directUrlOriginal: 'https://via.placeholder.com/800x600/10B981/FFFFFF?text=Product+2',
          directUrlPreview: 'https://via.placeholder.com/400x300/10B981/FFFFFF?text=Product+2'
        }
      },
      {
        id: '3',
        name: 'Marketing Banner',
        url: {
          directUrlOriginal: 'https://via.placeholder.com/1600x800/EF4444/FFFFFF?text=Banner',
          directUrlPreview: 'https://via.placeholder.com/400x200/EF4444/FFFFFF?text=Banner'
        }
      },
      {
        id: '4',
        name: 'Team Photo',
        url: {
          directUrlOriginal: 'https://via.placeholder.com/1200x800/F59E0B/FFFFFF?text=Team',
          directUrlPreview: 'https://via.placeholder.com/400x267/F59E0B/FFFFFF?text=Team'
        }
      },
      {
        id: '5',
        name: 'Office Space',
        url: {
          directUrlOriginal: 'https://via.placeholder.com/1600x1200/8B5CF6/FFFFFF?text=Office',
          directUrlPreview: 'https://via.placeholder.com/400x300/8B5CF6/FFFFFF?text=Office'
        }
      },
      {
        id: '6',
        name: 'Logo Variations',
        url: {
          directUrlOriginal: 'https://via.placeholder.com/800x800/EC4899/FFFFFF?text=Logo',
          directUrlPreview: 'https://via.placeholder.com/400x400/EC4899/FFFFFF?text=Logo'
        }
      },
    ];

    setAssets(mockAssets as CantoAsset[]);
  };

  const loadAssets = async (query: string = '') => {
    setLoading(true);
    setError('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/canto/search?${new URLSearchParams({
        keyword: query || '',
        limit: '20',
        sortBy: 'default',
        sortDirection: 'descending'
      })}`);

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Show detailed error message
        if (data.authFailed) {
          throw new Error('Canto authentication failed. Please verify your App ID and App Secret are correct.');
        } else if (data.configured === false) {
          throw new Error('Canto credentials not configured on backend server.');
        } else {
          throw new Error(data.message || data.error || 'Failed to fetch assets from Canto');
        }
      }

      if (data.results) {
        setAssets(data.results);
      } else {
        throw new Error('No assets found');
      }
    } catch (err: any) {
      console.error('Canto API error:', err);
      setError(err.message || 'Failed to load assets');
      // Fallback to mock data on error
      if (!isConfigured) {
        loadMockAssets();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (isConfigured) {
      loadAssets(searchQuery);
    } else {
      // Mock search filter
      setLoading(true);
      setTimeout(() => {
        loadMockAssets();
        setLoading(false);
      }, 300);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Select Image from Canto
              {isConfigured && <span className="ml-2 text-sm text-green-600">✓ Connected to {process.env.NEXT_PUBLIC_CANTO_DOMAIN}</span>}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {isConfigured
                ? 'Choose an asset from your Medartis DAM'
                : 'Using demo mode - Configure Canto credentials to connect'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="p-6 border-b">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Search assets..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {assets.length} asset{assets.length !== 1 ? 's' : ''} found
            </span>
            {!isConfigured && (
              <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                Demo Mode - Configure .env.local for real data
              </span>
            )}
          </div>

          {error && (
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">⚠️ {error}</p>
            </div>
          )}
        </div>

        {/* Assets Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <ImageIcon size={64} className="mb-4" />
              <p className="text-lg">No assets found</p>
              <p className="text-sm mt-2">
                {isConfigured ? 'Try a different search query' : 'Configure Canto credentials to see real assets'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {assets.map((asset) => {
                const isSelected = selectedAssets.includes(asset.url.directUrlOriginal);
                return (
                  <button
                    key={asset.id}
                    onClick={() => {
                      if (multiSelect) {
                        // Toggle selection
                        if (isSelected) {
                          setSelectedAssets(selectedAssets.filter(url => url !== asset.url.directUrlOriginal));
                        } else {
                          setSelectedAssets([...selectedAssets, asset.url.directUrlOriginal]);
                        }
                      } else {
                        // Single select - close immediately
                        onSelectImage(asset.url.directUrlOriginal);
                        onClose();
                      }
                    }}
                    className={`group relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:shadow-lg ${
                      isSelected
                        ? 'border-blue-600 ring-2 ring-blue-500'
                        : 'border-gray-200 hover:border-blue-500'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 z-10 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                        ✓
                      </div>
                    )}
                    {asset.url.directUrlPreview ? (
                      <img
                        src={asset.url.directUrlPreview}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback if image fails to load
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300/E5E7EB/9CA3AF?text=No+Preview';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <ImageIcon className="w-16 h-16 text-gray-400" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity flex items-end">
                      <div className="w-full p-3 bg-gradient-to-t from-black to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-white text-sm font-medium truncate">{asset.name}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 rounded-b-lg">
          <div className="flex items-center justify-between">
            <div>
              {isConfigured ? (
                <p className="text-sm text-gray-600">
                  <strong>Connected:</strong> Using real Canto API for {process.env.NEXT_PUBLIC_CANTO_DOMAIN}
                </p>
              ) : (
                <p className="text-sm text-gray-600">
                  <strong>Demo Mode:</strong> Configure credentials in <code className="bg-gray-200 px-2 py-1 rounded text-xs">frontend/.env.local</code>
                </p>
              )}
              {multiSelect && selectedAssets.length > 0 && (
                <p className="text-sm text-blue-600 font-medium mt-1">
                  {selectedAssets.length} image{selectedAssets.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {multiSelect && selectedAssets.length > 0 && (
                <button
                  onClick={() => {
                    if (onSelectMultiple) {
                      onSelectMultiple(selectedAssets);
                    }
                    onClose();
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Add {selectedAssets.length} Image{selectedAssets.length !== 1 ? 's' : ''}
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
