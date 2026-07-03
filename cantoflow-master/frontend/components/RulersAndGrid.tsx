'use client';

import { useEffect, useRef } from 'react';

interface RulersAndGridProps {
  canvasWidth: number;
  canvasHeight: number;
  showRulers: boolean;
  showGrid: boolean;
  gridSize: number;
  zoom: number;
}

export default function RulersAndGrid({
  canvasWidth,
  canvasHeight,
  showRulers,
  showGrid,
  gridSize = 20,
  zoom = 1
}: RulersAndGridProps) {
  const horizontalRulerRef = useRef<HTMLCanvasElement>(null);
  const verticalRulerRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!showRulers) return;

    // Draw horizontal ruler
    const hCanvas = horizontalRulerRef.current;
    if (hCanvas) {
      const ctx = hCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, hCanvas.width, hCanvas.height);
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(0, 0, hCanvas.width, hCanvas.height);

        ctx.strokeStyle = '#9ca3af';
        ctx.fillStyle = '#374151';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Draw ticks and numbers
        for (let i = 0; i <= canvasWidth; i += gridSize) {
          const x = i * zoom;
          const isMajor = i % (gridSize * 5) === 0;

          ctx.beginPath();
          ctx.moveTo(x, isMajor ? 15 : 20);
          ctx.lineTo(x, 30);
          ctx.stroke();

          if (isMajor && i > 0) {
            ctx.fillText(i.toString(), x, 2);
          }
        }
      }
    }

    // Draw vertical ruler
    const vCanvas = verticalRulerRef.current;
    if (vCanvas) {
      const ctx = vCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, vCanvas.width, vCanvas.height);
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(0, 0, vCanvas.width, vCanvas.height);

        ctx.strokeStyle = '#9ca3af';
        ctx.fillStyle = '#374151';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        // Draw ticks and numbers
        for (let i = 0; i <= canvasHeight; i += gridSize) {
          const y = i * zoom;
          const isMajor = i % (gridSize * 5) === 0;

          ctx.beginPath();
          ctx.moveTo(isMajor ? 15 : 20, y);
          ctx.lineTo(30, y);
          ctx.stroke();

          if (isMajor && i > 0) {
            ctx.save();
            ctx.translate(12, y);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(i.toString(), 0, 0);
            ctx.restore();
          }
        }
      }
    }
  }, [canvasWidth, canvasHeight, showRulers, gridSize, zoom]);

  return (
    <>
      {/* Horizontal Ruler */}
      {showRulers && (
        <>
          <canvas
            ref={horizontalRulerRef}
            width={canvasWidth * zoom}
            height={30}
            className="absolute top-0 left-[30px] bg-gray-100 border-b border-gray-300"
            style={{ zIndex: 10 }}
          />
          <canvas
            ref={verticalRulerRef}
            width={30}
            height={canvasHeight * zoom}
            className="absolute left-0 top-[30px] bg-gray-100 border-r border-gray-300"
            style={{ zIndex: 10 }}
          />
          {/* Corner square */}
          <div className="absolute top-0 left-0 w-[30px] h-[30px] bg-gray-200 border-r border-b border-gray-300" style={{ zIndex: 10 }} />
        </>
      )}

      {/* Grid Overlay (SVG for better performance) */}
      {showGrid && (
        <svg
          className="absolute pointer-events-none"
          width={canvasWidth * zoom}
          height={canvasHeight * zoom}
          style={{
            top: showRulers ? 30 : 0,
            left: showRulers ? 30 : 0,
            zIndex: 1
          }}
        >
          <defs>
            <pattern
              id="grid"
              width={gridSize * zoom}
              height={gridSize * zoom}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${gridSize * zoom} 0 L 0 0 0 ${gridSize * zoom}`}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="0.5"
              />
            </pattern>
            <pattern
              id="grid-major"
              width={gridSize * 5 * zoom}
              height={gridSize * 5 * zoom}
              patternUnits="userSpaceOnUse"
            >
              <rect width={gridSize * 5 * zoom} height={gridSize * 5 * zoom} fill="url(#grid)" />
              <path
                d={`M ${gridSize * 5 * zoom} 0 L 0 0 0 ${gridSize * 5 * zoom}`}
                fill="none"
                stroke="#d1d5db"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-major)" />
        </svg>
      )}
    </>
  );
}
