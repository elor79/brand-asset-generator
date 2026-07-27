// ─────────────────────────────────────────────────────────────────────────────
// COLLAGE GRID GEOMETRY
// ─────────────────────────────────────────────────────────────────────────────
// Pure geometry for the Collage layout: given a cell count and a box, return one
// rect per cell. No canvas, no React — so the arrangement is unit-tested and the
// layout code just fills the rects with images.
//
// The arrangement is a near-square grid whose LAST (partial) row spans the full
// width evenly, so an odd count reads as an intentional composition rather than a
// grid with a hole: 3 → two over one, 5 → three over two, 7 → three/three/one.

export const COLLAGE_COUNTS = [2, 3, 4, 6, 9];   // the one-click presets; any 1..9 works

/** count cells packed into (W×H) with `gutter` between them. Returns [{x,y,w,h}]. */
export function collageGrid(count, W, H, gutter = 0) {
  const n = Math.max(1, Math.min(9, Math.round(count)));
  if (W <= 0 || H <= 0) return [];
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const rowH = (H - (rows - 1) * gutter) / rows;
  const rects = [];
  let placed = 0;
  for (let r = 0; r < rows; r++) {
    const remaining = n - placed;
    // full rows use `cols`; the final row takes whatever is left, spread across the
    // whole width so it never leaves a ragged gap.
    const inRow = r < rows - 1 ? cols : remaining;
    const cellW = (W - (inRow - 1) * gutter) / inRow;
    const y = r * (rowH + gutter);
    for (let c = 0; c < inRow; c++) {
      rects.push({ x: c * (cellW + gutter), y, w: cellW, h: rowH });
      placed++;
    }
  }
  return rects;
}
