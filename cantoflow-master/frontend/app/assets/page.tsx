'use client';

import Link from "next/link";
import CantoAssetPicker from "@/components/CantoAssetPicker";

export default function AssetsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-xl font-bold text-gray-900">
              CantoFlow
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/templates" className="text-gray-700 hover:text-blue-600">
                Templates
              </Link>
              <Link href="/assets" className="text-blue-600 font-medium">
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

      <CantoAssetPicker mode="page" />
    </div>
  );
}
