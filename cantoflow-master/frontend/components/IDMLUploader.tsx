'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, CheckCircle, XCircle, Loader } from 'lucide-react';

interface IDMLUploaderProps {
  onUploadComplete?: (template: any) => void;
}

export default function IDMLUploader({ onUploadComplete }: IDMLUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [templateData, setTemplateData] = useState<any>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Validate file extension
    if (!file.name.toLowerCase().endsWith('.idml')) {
      setUploadStatus('error');
      setErrorMessage('Please upload an IDML file');
      return;
    }

    setUploading(true);
    setUploadStatus('idle');
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('idml', file);
      formData.append('name', file.name.replace('.idml', ''));
      formData.append('category', 'other');

      const response = await fetch('http://localhost:4000/api/templates/upload-idml', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      const data = await response.json();

      setUploadStatus('success');
      setTemplateData(data.template);

      if (onUploadComplete) {
        onUploadComplete(data.template);
      }

    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setErrorMessage(error.message || 'Failed to upload IDML file');
    } finally {
      setUploading(false);
    }
  }, [onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/octet-stream': ['.idml'],
      'application/zip': ['.idml'],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  const reset = () => {
    setUploadStatus('idle');
    setErrorMessage('');
    setTemplateData(null);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {uploadStatus === 'idle' && (
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}
            ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />

          <div className="flex flex-col items-center gap-4">
            {uploading ? (
              <>
                <Loader className="w-16 h-16 text-blue-600 animate-spin" />
                <p className="text-lg font-medium text-gray-900">Uploading and parsing IDML...</p>
                <p className="text-sm text-gray-500">This may take a few seconds</p>
              </>
            ) : (
              <>
                <Upload className="w-16 h-16 text-gray-400" />
                <div>
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    {isDragActive ? 'Drop the IDML file here' : 'Upload IDML Template'}
                  </p>
                  <p className="text-sm text-gray-500">
                    Drag and drop your InDesign IDML file, or click to browse
                  </p>
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  Accepted format: .idml
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {uploadStatus === 'success' && templateData && (
        <div className="border-2 border-green-500 bg-green-50 rounded-lg p-8">
          <div className="flex flex-col items-center gap-4">
            <CheckCircle className="w-16 h-16 text-green-600" />
            <h3 className="text-xl font-bold text-green-900">Upload Successful!</h3>

            <div className="bg-white rounded-lg p-4 w-full">
              <div className="flex items-start gap-3">
                <FileText className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-2">{templateData.name}</h4>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Dimensions:</span>
                      <span className="ml-2 font-medium">
                        {Math.round(templateData.dimensions?.width || 0)} × {Math.round(templateData.dimensions?.height || 0)}
                      </span>
                    </div>

                    <div>
                      <span className="text-gray-500">Elements:</span>
                      <span className="ml-2 font-medium">{templateData.elements?.length || 0}</span>
                    </div>

                    <div>
                      <span className="text-gray-500">Editable:</span>
                      <span className="ml-2 font-medium">
                        {templateData.elements?.filter((e: any) => e.editable).length || 0}
                      </span>
                    </div>

                    <div>
                      <span className="text-gray-500">Locked:</span>
                      <span className="ml-2 font-medium">
                        {templateData.elements?.filter((e: any) => !e.editable).length || 0}
                      </span>
                    </div>
                  </div>

                  {templateData.elements && templateData.elements.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-2">Element Types:</p>
                      <div className="flex gap-2 flex-wrap">
                        {templateData.elements.filter((e: any) => e.type === 'text').length > 0 && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                            {templateData.elements.filter((e: any) => e.type === 'text').length} Text
                          </span>
                        )}
                        {templateData.elements.filter((e: any) => e.type === 'image').length > 0 && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                            {templateData.elements.filter((e: any) => e.type === 'image').length} Images
                          </span>
                        )}
                        {templateData.elements.filter((e: any) => e.type === 'shape').length > 0 && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                            {templateData.elements.filter((e: any) => e.type === 'shape').length} Shapes
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={reset}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upload Another Template
            </button>
          </div>
        </div>
      )}

      {uploadStatus === 'error' && (
        <div className="border-2 border-red-500 bg-red-50 rounded-lg p-8">
          <div className="flex flex-col items-center gap-4">
            <XCircle className="w-16 h-16 text-red-600" />
            <h3 className="text-xl font-bold text-red-900">Upload Failed</h3>
            <p className="text-red-700">{errorMessage}</p>
            <button
              onClick={reset}
              className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
