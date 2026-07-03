import Link from "next/link";
import { FileText, Image, Layers, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <nav className="border-b bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Layers className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">
                CantoFlow
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/templates"
                className="text-gray-700 hover:text-blue-600"
              >
                Templates
              </Link>
              <Link
                href="/assets"
                className="text-gray-700 hover:text-blue-600"
              >
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Create Branded Content
            <span className="text-blue-600"> Instantly</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Design templates in InDesign, integrate with Canto DAM, and export
            to any format. Built for marketing teams who demand speed and brand
            consistency.
          </p>
          <div className="mt-8 flex gap-4 justify-center">
            <Link
              href="/templates"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Browse Templates
            </Link>
            <Link
              href="/docs"
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
            >
              Documentation
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mt-16">
          <FeatureCard
            icon={<FileText className="h-8 w-8 text-blue-600" />}
            title="IDML Import"
            description="Design templates in InDesign and import them as IDML files for web-based editing."
          />
          <FeatureCard
            icon={<Image className="h-8 w-8 text-blue-600" />}
            title="Canto Integration"
            description="Seamlessly pull assets from your Canto DAM directly into templates."
          />
          <FeatureCard
            icon={<Layers className="h-8 w-8 text-blue-600" />}
            title="Multi-Format Export"
            description="Export to PDF, PNG, JPG with presets for social media and print."
          />
          <FeatureCard
            icon={<Zap className="h-8 w-8 text-blue-600" />}
            title="Brand Compliance"
            description="Lock design elements while allowing controlled customization."
          />
        </div>

        <div className="mt-24 bg-blue-50 rounded-2xl p-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Built For Your Team
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <DepartmentCard
              name="Social Media"
              description="Pre-sized templates for Instagram, Facebook, LinkedIn, Twitter/X"
            />
            <DepartmentCard
              name="Marketing"
              description="Multi-page PDFs, campaign kits, variable data templates"
            />
            <DepartmentCard
              name="Events"
              description="Badges, tickets, posters, and quick event customization"
            />
            <DepartmentCard
              name="Corporate Comms"
              description="Reports, presentations, branded documents with workflows"
            />
          </div>
        </div>
      </main>

      <footer className="border-t mt-24 py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-600">
          <p>&copy; 2024 CantoFlow. Built for creative teams.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  );
}

function DepartmentCard({
  name,
  description,
}: {
  name: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{name}</h3>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  );
}
