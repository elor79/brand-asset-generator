import { FileText, Layers, Code, BookOpen } from 'lucide-react';
import Link from 'next/link';

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Layers className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">CantoFlow</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/" className="text-gray-700 hover:text-blue-600">
                Home
              </Link>
              <Link href="/templates" className="text-gray-700 hover:text-blue-600">
                Templates
              </Link>
              <Link href="/assets" className="text-gray-700 hover:text-blue-600">
                Canto Assets
              </Link>
              <Link href="/editor" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                New Template
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Documentation
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Everything you need to know about using CantoFlow
          </p>
        </div>

        {/* Quick Links */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          <Link href="/docs/getting-started" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all">
            <div className="mb-4">
              <BookOpen className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Getting Started</h3>
            <p className="text-gray-600 text-sm">Quick start guide and setup instructions</p>
          </Link>

          <Link href="/docs/idml" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all">
            <div className="mb-4">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">IDML Import</h3>
            <p className="text-gray-600 text-sm">Learn how to import InDesign templates</p>
          </Link>

          <Link href="/docs/canto" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all">
            <div className="mb-4">
              <Layers className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Canto Integration</h3>
            <p className="text-gray-600 text-sm">Connect your Canto DAM account</p>
          </Link>

          <Link href="/docs/api" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all">
            <div className="mb-4">
              <Code className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">API Reference</h3>
            <p className="text-gray-600 text-sm">Complete API documentation</p>
          </Link>
        </div>

        {/* Documentation Sections */}
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Quick Start</h2>

          <div className="space-y-8">
            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">1. System Requirements</h3>
              <ul className="list-disc list-inside text-gray-600 space-y-2">
                <li>Node.js 18+ and npm</li>
                <li>Docker (for MongoDB and Redis)</li>
                <li>Adobe InDesign (for template creation)</li>
                <li>Canto DAM account (optional)</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">2. Installation</h3>
              <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm">
                <p className="text-gray-800"># Start all services</p>
                <p className="text-blue-600">./start.sh</p>
                <br />
                <p className="text-gray-800"># Run health checks</p>
                <p className="text-blue-600">./test.sh</p>
              </div>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">3. Create Your First Template</h3>
              <ol className="list-decimal list-inside text-gray-600 space-y-2">
                <li>Design your template in Adobe InDesign</li>
                <li>Mark editable fields using the marking script</li>
                <li>Export as IDML (File → Export → InDesign Markup)</li>
                <li>Upload to CantoFlow via the Templates page</li>
              </ol>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">4. Connect Canto DAM</h3>
              <ol className="list-decimal list-inside text-gray-600 space-y-2">
                <li>Get API credentials from your Canto dashboard</li>
                <li>Add credentials to <code className="bg-gray-100 px-2 py-1 rounded text-sm">frontend/.env.local</code></li>
                <li>Restart the frontend server</li>
                <li>Browse assets from the Assets page</li>
              </ol>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">5. Export Templates</h3>
              <p className="text-gray-600 mb-3">Export your customized templates to multiple formats:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-2">
                <li><strong>PDF</strong> - Print-ready documents</li>
                <li><strong>Instagram</strong> - 1080x1080 (square) or 1080x1920 (story)</li>
                <li><strong>Facebook</strong> - 1200x630</li>
                <li><strong>LinkedIn</strong> - 1200x627</li>
                <li><strong>Twitter/X</strong> - 1200x675</li>
              </ul>
            </section>
          </div>

          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">📚 More Resources</h4>
            <ul className="text-blue-700 space-y-1">
              <li>• <strong>Full Documentation:</strong> See <code>docs/</code> folder in project root</li>
              <li>• <strong>API Reference:</strong> Available at <code>docs/api.md</code></li>
              <li>• <strong>IDML Workflow:</strong> See <code>docs/idml-workflow.md</code></li>
              <li>• <strong>Status & Health:</strong> Check <code>STATUS.md</code></li>
            </ul>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-24 py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-600">
          <p>© 2024 CantoFlow. Built for creative teams.</p>
        </div>
      </footer>
    </div>
  );
}
