'use client';

import { useState, useEffect } from 'react';
import { Image, Search, Download, ExternalLink, Folder, ChevronRight, Home, Grid3x3, List, FolderOpen } from "lucide-react";

// Tree node structure from Canto API
interface TreeNode {
  scheme: 'folder' | 'album';
  id: string;
  name: string;
  children?: TreeNode[];
  description?: string;
}

// Asset structure (for when we load album contents)
export interface CantoAsset {
  id: string;
  name: string;
  url: {
    directUrlOriginal: string;
    directUrlPreview: string;
  };
  scheme?: string;
  default?: {
    Scheme?: string;
  };
}

// Breadcrumb path item
interface BreadcrumbItem {
  id: string;
  name: string;
  scheme: 'folder' | 'album';
}

interface CantoAssetPickerProps {
  onAssetSelect?: (asset: CantoAsset) => void;
  mode?: 'page' | 'modal';
}

export default function CantoAssetPicker({ onAssetSelect, mode = 'page' }: CantoAssetPickerProps) {
  // Tree state
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Navigation state
  const [currentPath, setCurrentPath] = useState<string[]>([]); // Array of IDs
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);

  // Display state
  const [displayItems, setDisplayItems] = useState<TreeNode[]>([]);
  const [viewFilter, setViewFilter] = useState<'all' | 'folders' | 'albums'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CantoAsset[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Load the entire tree once on mount
  useEffect(() => {
    loadTree();
  }, []);

  const loadTree = async () => {
    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/canto/folders`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to load folder tree');
      }

      const data = await response.json();
      setTree(data);

      // Display root level children
      if (data.children) {
        setDisplayItems(data.children);
      }

      // Set root breadcrumb
      setBreadcrumbs([]);
      setCurrentPath([]);
    } catch (err: any) {
      console.error('Load tree error:', err);
      setError(err.message);
      setTree(null);
    } finally {
      setLoading(false);
    }
  };

  // Find a node in the tree by path
  const findNodeByPath = (path: string[]): TreeNode | null => {
    if (!tree) return null;
    if (path.length === 0) return tree;

    let current: TreeNode = tree;
    for (const id of path) {
      const child = current.children?.find(c => c.id === id);
      if (!child) return null;
      current = child;
    }
    return current;
  };

  // Navigate to a node by clicking on it
  const navigateToNode = async (node: TreeNode) => {
    console.log('navigateToNode called with:', node);
    const newPath = [...currentPath, node.id];
    setCurrentPath(newPath);

    // Update breadcrumbs
    const newBreadcrumbs = [...breadcrumbs, {
      id: node.id,
      name: node.name,
      scheme: node.scheme
    }];
    setBreadcrumbs(newBreadcrumbs);

    // Clear search when navigating
    setSearchQuery('');
    setHasSearched(false);
    setSearchResults([]);

    // If it's an album, load its assets
    console.log('Node scheme:', node.scheme);
    if (node.scheme === 'album') {
      console.log('Loading album assets for album ID:', node.id);
      setLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const url = `${apiUrl}/api/canto/albums/${node.id}/assets`;
        console.log('Fetching album assets from URL:', url);

        const response = await fetch(url);
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Response error text:', errorText);
          throw new Error(`Failed to load album contents: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        console.log('Album data received:', data);

        // Set search results to show the assets
        setSearchResults(data.results || []);
        setHasSearched(true);
        setDisplayItems([]);
        console.log('Search results set, count:', data.results?.length || 0);
      } catch (err: any) {
        console.error('Error loading album contents:', err);
        console.error('Error stack:', err.stack);
        setError(err.message);
        setDisplayItems([]);
      } finally {
        setLoading(false);
        console.log('Loading complete');
      }
    } else {
      // It's a folder, show its children
      if (node.children) {
        setDisplayItems(node.children);
      } else {
        setDisplayItems([]);
      }
    }
  };

  // Navigate using breadcrumbs
  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      // Navigate to root
      setCurrentPath([]);
      setBreadcrumbs([]);
      if (tree?.children) {
        setDisplayItems(tree.children);
      }
    } else {
      // Navigate to specific breadcrumb
      const newPath = currentPath.slice(0, index + 1);
      const newBreadcrumbs = breadcrumbs.slice(0, index + 1);

      setCurrentPath(newPath);
      setBreadcrumbs(newBreadcrumbs);

      const node = findNodeByPath(newPath);
      if (node?.children) {
        setDisplayItems(node.children);
      } else {
        setDisplayItems([]);
      }
    }

    // Clear search when navigating
    setSearchQuery('');
    setHasSearched(false);
    setSearchResults([]);
  };

  // Handle search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchQuery.trim()) {
      setHasSearched(false);
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(
        `${apiUrl}/api/canto/search?keyword=${encodeURIComponent(searchQuery)}&limit=200`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to search assets');
      }

      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Filter displayed items based on view filter
  const getFilteredItems = () => {
    if (hasSearched && searchQuery) {
      // In search mode, we're showing assets, not tree nodes
      return [];
    }

    if (viewFilter === 'all') {
      return displayItems;
    } else if (viewFilter === 'folders') {
      return displayItems.filter(item => item.scheme === 'folder');
    } else if (viewFilter === 'albums') {
      return displayItems.filter(item => item.scheme === 'album');
    }
    return displayItems;
  };

  const filteredItems = getFilteredItems();

  // Determine what to show
  const showingSearch = hasSearched;
  const showingTreeItems = !showingSearch;
  const itemsToDisplay = showingSearch ? searchResults : filteredItems;

  // Handle asset selection
  const handleAssetClick = (asset: CantoAsset) => {
    if (onAssetSelect) {
      onAssetSelect(asset);
    }
  };

  // Container classes based on mode
  const containerClasses = mode === 'modal'
    ? 'h-full flex flex-col'
    : 'min-h-screen bg-gray-50';

  const mainClasses = mode === 'modal'
    ? 'flex-1 overflow-auto px-4 py-4'
    : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8';

  return (
    <div className={containerClasses}>
      <main className={mainClasses}>
        {/* Breadcrumbs */}
        <nav className="mb-4 flex items-center gap-2 text-sm">
          <button
            onClick={() => navigateToBreadcrumb(-1)}
            className={`flex items-center gap-1 ${
              breadcrumbs.length === 0
                ? 'text-gray-900 font-medium'
                : 'text-blue-600 hover:text-blue-800'
            }`}
          >
            <Home size={16} />
            {tree?.name || 'All Assets'}
          </button>

          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.id} className="flex items-center gap-2">
              <ChevronRight size={16} className="text-gray-400" />
              <button
                onClick={() => navigateToBreadcrumb(index)}
                className={`flex items-center gap-1 ${
                  index === breadcrumbs.length - 1
                    ? 'text-gray-900 font-medium'
                    : 'text-blue-600 hover:text-blue-800'
                }`}
              >
                {crumb.name}
              </button>
            </div>
          ))}
        </nav>

        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {showingSearch
                ? `Search Results for "${searchQuery}"`
                : breadcrumbs.length > 0
                  ? breadcrumbs[breadcrumbs.length - 1].name
                  : tree?.name || 'Canto Assets'
              }
            </h1>
            <p className="text-gray-600 mt-2">
              {showingSearch
                ? `${searchResults.length} asset${searchResults.length !== 1 ? 's' : ''} found`
                : `${filteredItems.length} item${filteredItems.length !== 1 ? 's' : ''}`
              }
            </p>
          </div>

          {/* View Mode Toggle */}
          <div className="flex gap-1 bg-gray-100 rounded p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Grid View"
            >
              <Grid3x3 size={20} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="List View"
            >
              <List size={20} />
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg border p-4 mb-6">
          <form onSubmit={handleSearch} className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search Canto assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>

          {/* View Filter - Only show when browsing tree (not searching) */}
          {!showingSearch && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Show:</span>
              <div className="flex gap-1 bg-gray-100 rounded p-1">
                <button
                  type="button"
                  onClick={() => setViewFilter('all')}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    viewFilter === 'all'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setViewFilter('folders')}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    viewFilter === 'folders'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Folders
                </button>
                <button
                  type="button"
                  onClick={() => setViewFilter('albums')}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    viewFilter === 'albums'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Albums
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <h3 className="text-red-900 font-semibold mb-2">Connection Error</h3>
            <p className="text-red-800 text-sm mb-4">{error}</p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-900 mb-2 text-sm">
                Configuration Required
              </h4>
              <p className="text-xs text-yellow-800 mb-3">
                Add your Canto credentials to backend <code className="bg-yellow-100 px-2 py-1 rounded">.env</code>:
              </p>
              <pre className="bg-yellow-100 p-3 rounded text-xs overflow-x-auto">
{`CANTO_DOMAIN=your-company.canto.com
CANTO_APP_ID=your_app_id
CANTO_APP_SECRET=your_app_secret
# OR use a pre-generated access token:
CANTO_ACCESS_TOKEN=your_access_token`}
              </pre>
              <p className="text-xs text-yellow-800 mt-3">
                Get credentials from: <strong>Canto Dashboard → Settings → API Keys</strong>
              </p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {(loading || isSearching) && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">
                {isSearching ? 'Searching Canto assets...' : 'Loading folder tree...'}
              </p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !isSearching && !error && itemsToDisplay.length === 0 && (
          <div className="bg-white rounded-lg border p-12 text-center">
            <Image className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {showingSearch ? 'No assets found' : `No ${viewFilter === 'all' ? 'items' : viewFilter} found`}
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              {showingSearch
                ? `No results for "${searchQuery}". Try a different search term.`
                : viewFilter !== 'all'
                  ? `No ${viewFilter} in this location.`
                  : 'This location is empty.'
              }
            </p>
          </div>
        )}

        {/* Grid View - Tree Items */}
        {!loading && !isSearching && !error && showingTreeItems && filteredItems.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredItems.map((item) => {
              const isFolder = item.scheme === 'folder';
              const isAlbum = item.scheme === 'album';

              return (
                <div
                  key={item.id}
                  onClick={() => navigateToNode(item)}
                  className="group bg-white border-2 border-gray-200 rounded-lg overflow-hidden hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer"
                >
                  <div className="aspect-square bg-gradient-to-br from-blue-50 to-blue-100 relative overflow-hidden flex items-center justify-center">
                    {isFolder ? (
                      <Folder size={64} className="text-blue-500 group-hover:text-blue-600 transition-colors" />
                    ) : (
                      <FolderOpen size={64} className="text-purple-500 group-hover:text-purple-600 transition-colors" />
                    )}
                    <div className="absolute top-2 right-2">
                      <div className={`${isFolder ? 'bg-blue-500' : 'bg-purple-500'} text-white text-xs px-2 py-1 rounded`}>
                        {isFolder ? 'Folder' : 'Album'}
                      </div>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors" title={item.name}>
                      {item.name}
                    </p>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2" title={item.description}>
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Grid View - Search Results (Assets) */}
        {!loading && !isSearching && !error && showingSearch && searchResults.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {searchResults.map((asset) => {
              const imageUrl = asset.url?.directUrlPreview || asset.url?.directUrlOriginal || '';

              return (
                <div
                  key={asset.id}
                  onClick={() => handleAssetClick(asset)}
                  className="group bg-white border-2 border-gray-200 rounded-lg overflow-hidden hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer"
                >
                  <div className="aspect-square bg-gray-100 relative overflow-hidden">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image size={48} className="text-gray-400" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex gap-2">
                        {(() => {
                          const domain = process.env.NEXT_PUBLIC_CANTO_DOMAIN || '';
                          const scheme = asset.scheme || asset.default?.Scheme || '';
                          const mdcLink = domain && scheme && asset.id
                            ? `https://${domain}/asset/detail?id=${asset.id}&scheme=${scheme}`
                            : null;

                          return mdcLink ? (
                            <a
                              href={mdcLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 bg-white rounded-full hover:bg-gray-100"
                              title="Open in Canto"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink size={18} className="text-gray-700" />
                            </a>
                          ) : null;
                        })()}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(asset.url.directUrlOriginal, '_blank');
                          }}
                          className="p-2 bg-white rounded-full hover:bg-gray-100"
                          title="Download"
                        >
                          <Download size={18} className="text-gray-700" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-gray-900 truncate" title={asset.name}>
                      {asset.name}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* List View - Tree Items */}
        {!loading && !isSearching && !error && showingTreeItems && filteredItems.length > 0 && viewMode === 'list' && (
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredItems.map((item) => {
                  const isFolder = item.scheme === 'folder';

                  return (
                    <tr
                      key={item.id}
                      onClick={() => navigateToNode(item)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {isFolder ? (
                            <Folder size={20} className="text-blue-500" />
                          ) : (
                            <FolderOpen size={20} className="text-purple-500" />
                          )}
                          <span className={`text-xs font-medium ${isFolder ? 'text-blue-600 bg-blue-50' : 'text-purple-600 bg-purple-50'} px-2 py-1 rounded`}>
                            {isFolder ? 'Folder' : 'Album'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500 line-clamp-2">
                          {item.description || '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateToNode(item);
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Open →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* List View - Search Results (Assets) */}
        {!loading && !isSearching && !error && showingSearch && searchResults.length > 0 && viewMode === 'list' && (
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Preview
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {searchResults.map((asset) => {
                  const domain = process.env.NEXT_PUBLIC_CANTO_DOMAIN || '';
                  const scheme = asset.scheme || asset.default?.Scheme || '';
                  const mdcLink = domain && scheme && asset.id
                    ? `https://${domain}/asset/detail?id=${asset.id}&scheme=${scheme}`
                    : null;
                  const imageUrl = asset.url?.directUrlPreview || asset.url?.directUrlOriginal || '';

                  return (
                    <tr
                      key={asset.id}
                      onClick={() => handleAssetClick(asset)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="w-12 h-12 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={asset.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <Image size={24} className="text-gray-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{asset.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-gray-600 bg-gray-50 px-2 py-1 rounded">
                          Asset
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {mdcLink && (
                            <a
                              href={mdcLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Open in Canto"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink size={16} />
                            </a>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(asset.url.directUrlOriginal, '_blank');
                            }}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Download"
                          >
                            <Download size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
