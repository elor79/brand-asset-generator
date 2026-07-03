'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Plus, Clock, Search } from "lucide-react";
import IDMLUploader from "@/components/IDMLUploader";

interface Template {
  _id: string;
  name: string;
  description?: string;
  category: string;
  format: {
    width: number;
    height: number;
    unit: string;
  };
  source?: string;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
}

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all');
  const [showIDMLUploader, setShowIDMLUploader] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/templates?limit=100`);

      if (!response.ok) throw new Error('Failed to load templates');

      const data = await response.json();
      setTemplates(Array.isArray(data) ? data : (data.templates || []));
    } catch (error) {
      console.error('Error loading templates:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesSource = selectedSource === 'all' || template.source === selectedSource;
    return matchesSearch && matchesCategory && matchesSource;
  });

  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category)))];
  const sources = ['all', ...Array.from(new Set(templates.map(t => t.source || 'native')))];

  const handleTemplateClick = (template: Template) => {
    router.push(`/editor?templateId=${template._id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-xl font-bold text-gray-900">
              CantoFlow
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/templates" className="text-blue-600 font-medium">
                Templates
              </Link>
              <Link href="/assets" className="text-gray-700 hover:text-blue-600">
                Canto Assets
              </Link>
              <Link
                href="/editor"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                New Template
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Templates</h1>
            <p className="text-gray-600 mt-2">
              {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} available
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowIDMLUploader(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <Plus className="h-5 w-5" />
              Upload IDML
            </button>
            <Link
              href="/editor"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-5 w-5" />
              Create Template
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border p-4 mb-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {sources.map(source => (
                <option key={source} value={source}>
                  {source === 'all' ? 'All Sources' : source.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Templates Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading templates...</p>
            </div>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="bg-white rounded-lg border p-12 text-center">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {templates.length === 0 ? 'No templates yet' : 'No templates found'}
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {templates.length === 0
                ? 'Get started by creating a template from scratch or uploading an IDML file from InDesign.'
                : 'Try adjusting your search or filters.'
              }
            </p>
            {templates.length === 0 && (
              <div className="flex gap-4 justify-center">
                <Link
                  href="/editor"
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Template
                </Link>
                <button
                  onClick={() => setShowIDMLUploader(true)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Upload IDML
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredTemplates.map(template => (
              <div
                key={template._id}
                onClick={() => handleTemplateClick(template)}
                className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer group"
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center relative overflow-hidden">
                  {template.thumbnail ? (
                    <img
                      src={template.thumbnail}
                      alt={template.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <FileText size={48} className="mx-auto mb-2 text-gray-400 group-hover:text-blue-500 transition-colors" />
                      <div className="text-xs text-gray-500">
                        {template.format.width} × {template.format.height} {template.format.unit}
                      </div>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-2">
                    <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded">
                      {template.category}
                    </div>
                    {template.source && (
                      <div className="bg-purple-500 text-white text-xs px-2 py-1 rounded uppercase">
                        {template.source}
                      </div>
                    )}
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
                  <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
                    <Clock size={14} />
                    {new Date(template.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* IDML Uploader Modal */}
      {showIDMLUploader && (
        <IDMLUploader
          onClose={() => setShowIDMLUploader(false)}
          onUploadSuccess={() => {
            setShowIDMLUploader(false);
            loadTemplates();
          }}
        />
      )}
    </div>
  );
}
