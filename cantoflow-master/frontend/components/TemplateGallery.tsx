'use client';

import { useState, useEffect } from 'react';
import { FileText, Clock, X, Search, Grid3x3, List } from 'lucide-react';

interface Template {
  _id: string;
  name: string;
  description: string;
  category: string;
  format: {
    width: number;
    height: number;
    unit: string;
  };
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
  elementsCount?: number;
}

interface TemplateGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: Template) => void;
}

export default function TemplateGallery({ isOpen, onClose, onSelectTemplate }: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/templates?limit=50`);

      if (!response.ok) throw new Error('Failed to load templates');

      const data = await response.json();
      // Backend returns { templates: [], total, limit, skip }
      setTemplates(Array.isArray(data) ? data : (data.templates || []));
    } catch (error) {
      console.error('Error loading templates:', error);
      setTemplates([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category)))];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Template Gallery</h2>
            <p className="text-sm text-gray-500 mt-1">{filteredTemplates.length} templates available</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Search and Filters */}
        <div className="p-4 border-b bg-gray-50">
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 items-center">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>

              <div className="flex border rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'}`}
                >
                  <Grid3x3 size={20} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'}`}
                >
                  <List size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Templates Grid/List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading templates...</p>
              </div>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <FileText size={48} className="mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">No templates found</p>
                <p className="text-sm text-gray-400 mt-2">Try adjusting your search or filters</p>
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map(template => (
                <div
                  key={template._id}
                  onClick={() => {
                    onSelectTemplate(template);
                    onClose();
                  }}
                  className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer group"
                >
                  {/* Thumbnail */}
                  <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center relative overflow-hidden">
                    {template.thumbnail ? (
                      <img src={template.thumbnail} alt={template.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-4">
                        <FileText size={48} className="mx-auto mb-2 text-gray-400 group-hover:text-blue-500 transition-colors" />
                        <div className="text-xs text-gray-500">
                          {template.format.width} × {template.format.height} {template.format.unit}
                        </div>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                      {template.category}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                      {template.name}
                    </h3>
                    {template.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{template.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        {new Date(template.updatedAt).toLocaleDateString()}
                      </div>
                      {template.elementsCount && (
                        <div>{template.elementsCount} elements</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTemplates.map(template => (
                <div
                  key={template._id}
                  onClick={() => {
                    onSelectTemplate(template);
                    onClose();
                  }}
                  className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded flex items-center justify-center flex-shrink-0">
                    {template.thumbnail ? (
                      <img src={template.thumbnail} alt={template.name} className="w-full h-full object-cover rounded" />
                    ) : (
                      <FileText size={24} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                      {template.name}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">{template.description || 'No description'}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">{template.category}</span>
                      <span>{template.format.width} × {template.format.height} {template.format.unit}</span>
                      <span>{new Date(template.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
          <p className="text-sm text-gray-600">
            Select a template to start editing
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
