'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import { ArrowLeft, Upload as UploadIcon } from "lucide-react";
import TemplateEditor from '@/components/TemplateEditor';
import IDMLUploader from '@/components/IDMLUploader';

export default function EditorPage() {
  const [templateData, setTemplateData] = useState<any>(null);
  const [showUploader, setShowUploader] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load template if templateId is in URL
  useEffect(() => {
    // Get templateId from URL on client side
    const params = new URLSearchParams(window.location.search);
    const templateId = params.get('templateId');

    if (templateId) {
      loadTemplate(templateId);
    }
  }, []);

  const loadTemplate = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/templates/${id}`);

      if (!response.ok) {
        throw new Error('Failed to load template');
      }

      const template = await response.json();
      setTemplateData(template);
      setShowUploader(false);
    } catch (err: any) {
      console.error('Error loading template:', err);
      setError(err.message || 'Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadComplete = (template: any) => {
    setTemplateData(template);
    setShowUploader(false);
  };

  const handleNewUpload = () => {
    setTemplateData(null);
    setShowUploader(true);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Navigation */}
      <nav className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-4">
              <Link
                href="/templates"
                className="flex items-center gap-2 text-gray-700 hover:text-blue-600"
              >
                <ArrowLeft className="h-5 w-5" />
                Back to Templates
              </Link>
              <span className="text-gray-300">|</span>
              <span className="font-semibold text-gray-900">
                {templateData ? templateData.name : 'New Template'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {!showUploader && (
                <button
                  onClick={handleNewUpload}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <UploadIcon className="h-4 w-4" />
                  Upload New IDML
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">Loading template...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
              <h2 className="text-red-800 font-semibold mb-2">Error Loading Template</h2>
              <p className="text-red-600 mb-4">{error}</p>
              <Link
                href="/templates"
                className="inline-block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Back to Templates
              </Link>
            </div>
          </div>
        ) : showUploader ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-full max-w-4xl">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Create a New Template</h1>
                <p className="text-gray-600">
                  Upload an IDML file from InDesign or start with a blank canvas
                </p>
              </div>

              <IDMLUploader onUploadComplete={handleUploadComplete} />

              <div className="mt-8 text-center">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-gray-100 text-gray-500">OR</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setTemplateData({
                      name: 'Blank Template',
                      dimensions: { width: 800, height: 600 },
                      elements: [],
                    });
                    setShowUploader(false);
                  }}
                  className="mt-6 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  Start with Blank Canvas
                </button>
              </div>

              {/* Usage Instructions */}
              <div className="mt-12 bg-blue-50 rounded-lg p-6">
                <h3 className="font-semibold text-blue-900 mb-3">📝 How to prepare your IDML file:</h3>
                <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                  <li>Design your template in Adobe InDesign</li>
                  <li>Mark editable fields using the marking script (<code className="bg-blue-100 px-1">scripts/mark-editable-fields.jsx</code>)</li>
                  <li>Export as IDML: <strong>File → Export → InDesign Markup (IDML)</strong></li>
                  <li>Upload the .idml file here</li>
                </ol>
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <p className="text-xs text-blue-700">
                    <strong>Tip:</strong> The script will label frames as "EDITABLE_TEXT" or "EDITABLE_IMAGE"
                    to mark them as editable in the web editor.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1">
            <TemplateEditor
              templateData={templateData}
              templateId={templateData?._id}
              width={templateData?.dimensions?.width || 800}
              height={templateData?.dimensions?.height || 600}
            />
          </div>
        )}
      </div>
    </div>
  );
}
