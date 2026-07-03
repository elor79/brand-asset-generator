'use client';

import { useState, useRef, useEffect } from 'react';
import { Lock, Unlock, Move, Maximize2, RotateCcw, LockKeyhole } from 'lucide-react';

export interface LockOptions {
  lockPosition: boolean;
  lockScale: boolean;
  lockRotation: boolean;
  lockAll: boolean;
}

interface LockOptionsMenuProps {
  lockOptions: LockOptions;
  onLockOptionsChange: (options: LockOptions) => void;
  onClose: () => void;
  position: { x: number; y: number };
}

export default function LockOptionsMenu({ lockOptions, onLockOptionsChange, onClose, position }: LockOptionsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const toggleOption = (option: keyof LockOptions) => {
    const newOptions = { ...lockOptions };

    if (option === 'lockAll') {
      const newValue = !lockOptions.lockAll;
      newOptions.lockAll = newValue;
      newOptions.lockPosition = newValue;
      newOptions.lockScale = newValue;
      newOptions.lockRotation = newValue;
    } else {
      newOptions[option] = !lockOptions[option];
      // If all individual options are true, set lockAll to true
      newOptions.lockAll = newOptions.lockPosition && newOptions.lockScale && newOptions.lockRotation;
    }

    onLockOptionsChange(newOptions);
  };

  return (
    <div
      ref={menuRef}
      className="absolute z-50 w-56 bg-gray-800 border border-gray-700 rounded-md shadow-lg"
      style={{ left: position.x, top: position.y }}
    >
      <div className="p-2">
        <div className="text-xs font-semibold text-gray-400 px-2 py-1 mb-1">Lock Options</div>

        <button
          onClick={() => toggleOption('lockAll')}
          className={`w-full flex items-center gap-2 px-2 py-2 rounded text-sm transition-colors ${
            lockOptions.lockAll
              ? 'bg-orange-600 text-white'
              : 'hover:bg-gray-700 text-gray-300'
          }`}
        >
          <LockKeyhole size={16} />
          <span className="flex-1 text-left">Lock All</span>
          {lockOptions.lockAll && <span className="text-xs text-orange-200"></span>}
        </button>

        <div className="my-2 border-t border-gray-700"></div>

        <button
          onClick={() => toggleOption('lockPosition')}
          className={`w-full flex items-center gap-2 px-2 py-2 rounded text-sm transition-colors ${
            lockOptions.lockPosition
              ? 'bg-blue-600 text-white'
              : 'hover:bg-gray-700 text-gray-300'
          }`}
        >
          <Move size={16} />
          <span className="flex-1 text-left">Lock Position</span>
          {lockOptions.lockPosition && <span className="text-xs text-blue-200"></span>}
        </button>

        <button
          onClick={() => toggleOption('lockScale')}
          className={`w-full flex items-center gap-2 px-2 py-2 rounded text-sm transition-colors ${
            lockOptions.lockScale
              ? 'bg-green-600 text-white'
              : 'hover:bg-gray-700 text-gray-300'
          }`}
        >
          <Maximize2 size={16} />
          <span className="flex-1 text-left">Lock Scale</span>
          {lockOptions.lockScale && <span className="text-xs text-green-200"></span>}
        </button>

        <button
          onClick={() => toggleOption('lockRotation')}
          className={`w-full flex items-center gap-2 px-2 py-2 rounded text-sm transition-colors ${
            lockOptions.lockRotation
              ? 'bg-purple-600 text-white'
              : 'hover:bg-gray-700 text-gray-300'
          }`}
        >
          <RotateCcw size={16} />
          <span className="flex-1 text-left">Lock Rotation</span>
          {lockOptions.lockRotation && <span className="text-xs text-purple-200"></span>}
        </button>
      </div>
    </div>
  );
}
