// ─────────────────────────────────────────────────────────────────────────────
// MEDARTIS GROUP — A HOUSE OF BRANDS, NOT A PARTNERSHIP
// ─────────────────────────────────────────────────────────────────────────────
// IBRA's partners.js models CO-BRANDING: two independent organisations agreeing to
// appear together. Its whole vocabulary — "in cooperation with", "sponsor of",
// relation labels, a partner WALL — exists because the other party is a stranger
// whose relationship to you must be SPELLED OUT.
//
// Medartis Group is not that. The hierarchy is:
//
//     Medartis Group          <- the house
//       |-- medartis          <- the main brand
//       |-- KeriMedical
//       +-- NeoOrtho
//
// The Group sits ABOVE all three, medartis included. medartis is the main brand
// under the house, not the house itself — they are separate pieces of artwork, and
// using one where the other belongs names the house twice and the main brand never.
// All three are OWNED. There is no relation to declare, because the relation is
// the logo: they are the Group.
// So this module deliberately does NOT reuse the partner model. Putting "in
// cooperation with KeriMedical" on a Medartis Group asset would be a factual error
// dressed as a design choice — the sort of wrongness that never throws.
//
// What replaces it is an ENDORSEMENT model:
//   group      — the Medartis Group mark alone (the house speaks)
//   endorsed   — a sub-brand leads, the Group mark endorses it, smaller
//   family     — the sub-brand row: medartis · NeoOrtho · KeriMedical, as equals
//
// ARTWORK PROVENANCE
// Every path below is extracted verbatim from the supplied SVGs — not redrawn, not
// traced, not approximated. viewBox and glyph bounds are measured from the real
// path data (curves flattened to 24 segments, so the bounds include curve extrema
// and not merely the endpoints). The fills are the ones declared in each file's own
// stylesheet. Nothing here is eyeballed from a screenshot, because a brand mark
// that is ALMOST right is worse than an obviously missing one: it ships.
//
//   medartis group  viewBox 206.875 × 57.316   monochrome (takes the ink colour)
//   NeoOrtho        viewBox 2267.72 × 566.93   #582d83 violet · #00afb9 teal
//   KeriMedical     viewBox 294.081 × 130.806   #001a72 blue · #bbbdbd grey

// ─── The marks ───────────────────────────────────────────────────────────────
// `fill: null` means "inherit the ink colour" — the group mark is monochrome, so
// it takes coal on light and paper on dark. The sub-brands carry their OWN colours
// and only surrender them in the negative/mono variants below.

// ONE ARRAY, IN DOCUMENT ORDER, WITH A FLAG.
//
// The byline was briefly held in a second array and re-joined for the standalone
// build. That REORDERS the document: NeoOrtho's registered mark comes AFTER the
// byline in the file, so brand-then-byline put it in the wrong place. With
// overlapping fills, z-order is not cosmetic.
//
// So the paths stay exactly as the file has them and `byline: true` marks the ones
// that come off under the Group mark. Nothing is re-sorted, so nothing can be
// re-sorted wrongly.
//
// EVERY DRAWABLE IS HERE, not just <path>. These files also contain <polygon> and
// <rect>, and reading only paths cost NeoOrtho its "t" (it rendered "NeoOr ho"),
// KeriMedical the tilted stroke under its "l", and both a rule line. Converted
// elements keep their geometry exactly; only the notation is path data.

export const GROUP_MARK = {
  view: { w: 206.875, h: 57.316 },
  glyph: { x: 34.479, y: 19.568, w: 137.916, h: 18.18 },
  fullGlyph: { x: 34.479, y: 19.568, w: 137.916, h: 18.18 },
  paths: [
    { fill: null, d: 'M46.709,33.823v-5.973c0-1.799,0-2.883-2.209-2.883-2.802,0-2.72,2.393-2.72,4.458v4.398h-1.186v-5.973c0-1.799,0-2.883-2.209-2.883-2.802,0-2.72,2.433-2.72,4.5v4.356h-1.186v-9.818h1.145v1.146c.511-.757,1.431-1.309,2.945-1.309,1.473,0,2.475.511,2.904,1.574.696-1.063,1.718-1.574,3.191-1.574s2.536.511,2.965,1.554c.307.757.266,1.514.266,2.495v5.932h-1.186Z' },
    { fill: null, d: 'M51.902,29.2c0,2.475.328,3.682,3.088,3.682,1.33,0,2.843-.205,2.843-1.841h1.105c0,2.372-1.902,2.945-3.968,2.945-3.763,0-4.254-1.861-4.254-5.03,0-3.232.552-5.114,4.193-5.114,3.988,0,4.172,2.086,4.172,5.358h-7.179ZM54.909,24.926c-2.291,0-2.986,1.002-2.986,3.191h6.013c0-2.373-.655-3.191-3.027-3.191' },
    { fill: null, d: 'M69.061,33.823v-1.187c-.634.88-1.739,1.35-3.273,1.35-3.701,0-4.029-2.126-4.029-5.092,0-2.7.205-5.052,4.029-5.052,1.554,0,2.577.43,3.232,1.268v-5.542h1.185v14.255h-1.144ZM65.686,24.967c-2.434,0-2.741,1.411-2.741,3.968s.307,3.906,2.741,3.906c2.516,0,3.354-.797,3.354-3.906s-.838-3.968-3.354-3.968' },
    { fill: null, d: 'M80.266,33.823v-1.105c-.572.86-1.84,1.268-3.476,1.268-2.557,0-3.804-.858-3.804-2.965,0-2.7,1.738-3.088,3.906-3.088h3.293v-.328c0-.695.081-1.534-.471-2.065-.388-.389-1.002-.573-2.393-.573s-2.965.061-2.965,1.82h-1.105c0-2.311,1.677-2.945,4.234-2.945,1.881,0,3.518.47,3.824,2.393.103.532.082,1.247.082,1.943v5.645h-1.125ZM76.81,28.996c-1.657,0-2.618.245-2.618,2.005,0,1.349.634,1.922,2.537,1.922,3.21,0,3.456-1.309,3.456-3.927h-3.375Z' },
    { fill: null, d: 'M90.573,26.706c0-1.35-.572-1.738-2.127-1.738-2.884,0-2.72,2.618-2.72,4.602v4.254h-1.186v-9.818h1.145v1.146c.696-.941,1.698-1.309,2.986-1.309,1.964,0,3.006.9,3.006,2.863h-1.104Z' },
    { fill: null, d: 'M97.424,33.987c-2.147,0-3.191-.88-3.191-2.925v-5.992h-1.656v-1.064h1.656v-4.438h1.187v4.438h4.478v1.064h-4.478v5.992c0,1.412.613,1.862,2.045,1.862,1.555,0,2.147-.553,2.147-1.882h1.105c0,2.147-1.268,2.945-3.293,2.945' },
    { fill: null, d: 'M103.62,21.143c-.511,0-.776-.307-.776-.798,0-.511.265-.777.776-.777s.798.266.798.777c0,.491-.286.798-.798.798M103.027,24.006h1.187v9.818h-1.187v-9.818Z' },
    { fill: null, d: 'M111.023,33.987c-2.658,0-3.927-.757-3.927-2.945h1.105c0,1.35.674,1.8,2.802,1.8,2.208,0,2.965-.492,2.965-1.677,0-1.718-.511-1.657-2.762-1.739-2.085-.061-3.947.061-3.947-2.7,0-2.229,1.433-2.883,4.132-2.883,2.373,0,3.763.675,3.763,2.945h-1.104c0-1.309-.634-1.841-2.639-1.841-2.229,0-2.965.45-2.965,1.616,0,1.779.696,1.615,2.597,1.697,2.107.102,4.111-.143,4.111,2.761,0,2.23-1.411,2.966-4.131,2.966' },
    { fill: null, d: 'M128.423,28.926c0-1.632-.27-2.762-.81-3.389-.539-.628-1.504-.941-2.893-.941-1.187,0-2.017.31-2.489.93-.391.567-.587,1.7-.587,3.4,0,1.727.196,2.873.587,3.44.472.62,1.302.93,2.489.93,1.389,0,2.354-.316,2.893-.951.54-.634.81-1.773.81-3.419M128.969,33.013c0,1.417-.054,2.313-.162,2.691-.108.391-.31.735-.607,1.032-.675.674-1.76,1.012-3.258,1.012-1.214,0-2.121-.233-2.721-.698-.601-.466-.907-1.184-.921-2.155h.526c.014,1.551,1.032,2.327,3.056,2.327,1.362,0,2.32-.284,2.873-.85.094-.095.175-.192.243-.294.067-.101.124-.195.172-.283.047-.088.087-.205.121-.354.034-.148.057-.266.071-.354.013-.088.023-.236.03-.445.007-.209.011-.361.011-.455v-2.206c-.581,1.241-1.775,1.862-3.582,1.862-1.632,0-2.705-.466-3.217-1.396-.351-.661-.526-1.835-.526-3.521,0-1.659.175-2.819.526-3.481.512-.93,1.585-1.396,3.217-1.396,1.807,0,3.008.627,3.602,1.882v-1.74h.546v8.822Z' },
    { fill: null, d: 'M139.289,26.741h-.526c0-.674-.162-1.18-.486-1.518-.364-.418-1.011-.627-1.942-.627s-1.653.256-2.165.769c-.284.283-.493.668-.628,1.153-.135.486-.212.908-.232,1.265-.021.358-.031.867-.031,1.528v4.512h-.566v-9.632h.546v1.72c.54-1.24,1.551-1.861,3.035-1.861,1.12,0,1.902.25,2.347.748.446.486.661,1.134.648,1.943' },
    { fill: null, d: 'M148.546,31.344c.101-.506.152-1.285.152-2.337s-.051-1.831-.152-2.337c-.101-.506-.28-.907-.536-1.204-.513-.58-1.417-.87-2.712-.87-1.282,0-2.192.29-2.731.87-.257.297-.435.701-.537,1.214-.101.512-.151,1.288-.151,2.327s.05,1.814.151,2.327c.102.512.28.917.537,1.214.539.58,1.449.87,2.731.87,1.295,0,2.199-.29,2.712-.87.256-.297.435-.698.536-1.204M149.082,26.447c.121.573.182,1.426.182,2.56s-.061,1.986-.182,2.559c-.121.574-.344,1.029-.668,1.366-.607.688-1.646,1.032-3.116,1.032-1.457,0-2.502-.344-3.136-1.032-.31-.351-.53-.812-.658-1.386-.128-.573-.192-1.419-.192-2.539s.064-1.966.192-2.54c.128-.573.348-1.035.658-1.386.634-.688,1.679-1.032,3.136-1.032,1.47,0,2.509.344,3.116,1.032.324.338.547.793.668,1.366' },
    { fill: null, d: 'M160.375,33.823h-.546v-1.781c-.554,1.282-1.68,1.923-3.379,1.923-1.215,0-2.078-.256-2.59-.769-.405-.405-.648-.85-.729-1.336-.081-.485-.121-1.376-.121-2.671v-4.998h.566v4.877c0,1.254.034,2.111.101,2.57.068.459.25.836.547,1.133.431.432,1.166.647,2.205.647,1.079,0,1.882-.263,2.408-.789.324-.324.56-.745.708-1.265.149-.519.23-.944.243-1.274.013-.331.02-.914.02-1.751v-4.148h.567v9.632Z' },
    { fill: null, d: 'M171.829,28.987c0-1.754-.203-2.907-.608-3.46-.445-.62-1.274-.931-2.488-.931-1.376,0-2.337.324-2.884.971-.546.648-.819,1.788-.819,3.42,0,1.659.273,2.813.819,3.46.547.647,1.508.971,2.884.971,1.214,0,2.043-.31,2.488-.93.405-.554.608-1.721.608-3.501M172.395,28.987c0,1.74-.182,2.934-.546,3.581-.5.931-1.572,1.397-3.217,1.397-1.808,0-3.002-.621-3.582-1.862v5.585h-.567v-13.497h.547v1.741c.593-1.255,1.794-1.882,3.602-1.882,1.645,0,2.717.465,3.217,1.396.364.647.546,1.828.546,3.541' },
  ],
};

export const NEOORTHO_MARK = {
  view: { w: 2267.72, h: 566.93 },
  glyph: { x: 184.38, y: 58.07, w: 1904.49, h: 283.47 },          // brand only — what the Group lockup reserves space for
  fullGlyph: { x: 184.38, y: 58.07, w: 1904.49, h: 450.07 },
  // NeoOrtho carries the byline too — it just does not announce it.
  //
  // There is no <g id="medartis_group"> here, and grepping the file for "medartis"
  // returns nothing, which is what convinced me it had none. Wrong test: the byline
  // is OUTLINED TYPE, so there is no text to find. It sat in the path data the whole
  // time, and the canvas rendered "NeoOrtho / medartis group" directly beneath the
  // Medartis Group mark until someone looked at the screen.
  //
  // The split is unambiguous once you stop grepping: the byline elements are the
  // UNFILLED ones (they take the ink) and they sit at y 377-508, below the logotype
  // at y 58-341. Colour and position agree.
  paths: [
    { fill: '#582d83', d: 'M368.91,160.8c-36.75,11.2-71.1,5.39-76.74-12.98-5.63-18.38,19.59-42.36,56.34-53.56,36.75-11.2,71.1-5.39,76.74,12.98,5.63,18.38-19.59,42.36-56.34,53.56ZM404.06,58.07h-155.9c-35.23,0-63.78,28.56-63.78,63.78v142.21c56.42-35.39,192.52-38.31,252.11-86.72,21.29-17.3,30.4-35.99,31.35-53.33v-2.16c0-35.22-28.55-63.78-63.78-63.78Z' },
    { fill: '#582d83', d: 'M467.84,211.68v66.08c0,35.22-28.55,63.78-63.78,63.78h-155.9c-16.02,0-30.65-5.9-41.85-15.65,34.36-42.85,196.92-46.77,261.53-114.21Z' },
    { fill: '#582d83', d: 'M756.98,58.07v251.84c0,17.47-14.16,31.63-31.62,31.63-9.9,0-18.73-4.54-24.53-11.66-.18-.22-157.86-197.04-157.86-197.04v208.7h-46.78V89.7c0-17.47,14.16-31.63,31.63-31.63,10.33,0,19.51,4.95,25.28,12.61.02.03,157.11,196.1,157.11,196.1V58.07h46.77Z' },
    { fill: '#582d83', d: 'M960.16,267.55c1.21-5.31,1.96-10.79,2.22-16.41,2.54-53.87-40.91-99.53-94.84-99.53s-95.81,43.36-94.96,96.53,43.01,93.08,94.34,93.4c39.04.24,72.66-23.07,87.48-56.56h-50.33c-9.52,9.05-22.38,14.6-36.54,14.6-21.82,0-40.56-13.19-48.69-32.03h141.32ZM867.53,193.57c21.83,0,40.57,13.19,48.7,32.03h-97.39c8.13-18.84,26.87-32.03,48.69-32.03Z' },
    { fill: '#582d83', d: 'M1073.04,341.54c-52.45,0-94.96-42.52-94.96-94.96s42.52-94.96,94.96-94.96,94.96,42.52,94.96,94.96-42.52,94.96-94.96,94.96ZM1126.05,246.58c0-29.28-23.73-53.01-53.01-53.01s-53.01,23.73-53.01,53.01,23.73,53.01,53.01,53.01,53.01-23.73,53.01-53.01Z' },
    { fill: '#00afb9', d: 'M1323.91,341.54c-78.28,0-141.73-63.46-141.73-141.73s63.46-141.73,141.73-141.73,141.73,63.46,141.73,141.73-63.46,141.73-141.73,141.73ZM1423.69,199.81c0-55.11-44.67-99.78-99.78-99.78s-99.78,44.67-99.78,99.78,44.67,99.78,99.78,99.78,99.78-44.67,99.78-99.78Z' },
    { fill: '#00afb9', d: 'M1574.78,151.61v41.96c-29.28,0-53.01,23.73-53.01,53.01v94.96h-41.95v-94.96c0-52.45,42.51-94.97,94.96-94.97Z' },
    { fill: '#00afb9', d: 'M1673.99,151.61 L1673.99,193.57 L1630.9,193.57 L1630.9,341.54 L1588.95,341.54 L1588.95,109.1 L1630.9,109.1 L1630.9,151.61 L1673.99,151.61Z' },
    { fill: '#00afb9', d: 'M1878.08,246.58v94.96h-41.95v-94.96c0-29.28-23.73-53.01-53.01-53.01s-53,23.73-53,53.01v94.96h-41.96V109.1h41.96v58.67c15.14-10.2,33.37-16.16,53-16.16,52.45,0,94.96,42.52,94.96,94.97Z' },
    { fill: '#00afb9', d: 'M1987.21,341.54c-52.45,0-94.96-42.52-94.96-94.96s42.52-94.96,94.96-94.96,94.96,42.52,94.96,94.96-42.52,94.96-94.96,94.96ZM2040.22,246.58c0-29.28-23.73-53.01-53.01-53.01s-53.01,23.73-53.01,53.01,23.73,53.01,53.01,53.01,53.01-23.73,53.01-53.01Z' },
    { byline: true, fill: null, d: 'M1182.18,377.68H2082.1800000000003V382.78000000000003H1182.18Z' },
    { byline: true, fill: null, d: 'M1268.94,482.48v-38.36c0-6.35.27-11.24-1.72-16.13-2.78-6.74-9.66-10.05-19.18-10.05s-16.13,3.31-20.63,10.19c-2.78-6.88-9.26-10.19-18.78-10.19s-15.74,3.57-19.05,8.47v-7.41h-7.41v63.48h7.67v-28.18c0-13.35-.53-29.09,17.59-29.09,14.28,0,14.28,7.01,14.28,18.65v38.62h7.67v-28.44c0-13.36-.53-28.83,17.59-28.83,14.29,0,14.29,7.01,14.29,18.65v38.62h7.67ZM1340.33,452.59c0-21.16-1.19-34.65-26.98-34.65-23.54,0-27.11,12.17-27.11,33.06s3.17,32.54,27.51,32.54c13.36,0,25.66-3.71,25.66-19.05h-7.14c0,10.58-9.79,11.91-18.38,11.91-17.86,0-19.97-7.81-19.97-23.81h46.42ZM1332.93,445.58h-38.89c0-14.15,4.5-20.64,19.31-20.64s19.58,5.29,19.58,20.64M1411.15,482.48v-92.18h-7.68v35.84c-4.23-5.43-10.85-8.2-20.9-8.2-24.73,0-26.05,15.21-26.05,32.67,0,19.18,2.12,32.93,26.05,32.93,9.92,0,17.06-3.04,21.16-8.73v7.67h7.41ZM1403.6,450.87c0,20.1-5.42,25.26-21.69,25.26s-17.72-8.73-17.72-25.26,1.99-25.66,17.72-25.66,21.69,5.56,21.69,25.66M1482.21,482.48v-36.5c0-4.5.14-9.13-.52-12.56-1.98-12.43-12.57-15.48-24.74-15.48-16.53,0-27.37,4.1-27.37,19.04h7.15c0-11.37,10.18-11.77,19.17-11.77s12.97,1.19,15.48,3.7c3.57,3.45,3.04,8.87,3.04,13.36v2.12h-21.29c-14.02,0-25.26,2.52-25.26,19.97,0,13.62,8.07,19.18,24.6,19.18,10.58,0,18.78-2.65,22.48-8.2v7.14h7.27ZM1474.41,451.26c0,16.93-1.58,25.39-22.35,25.39-12.3,0-16.4-3.7-16.4-12.43,0-11.38,6.22-12.97,16.92-12.97h21.82ZM1547.39,436.45c0-12.69-6.74-18.51-19.44-18.51-8.33,0-14.82,2.38-19.31,8.47v-7.41h-7.41v63.48h7.67v-27.51c0-12.83-1.06-29.75,17.59-29.75,10.05,0,13.76,2.52,13.76,11.24h7.14ZM1609.71,464.49h-7.14c0,8.59-3.83,12.17-13.89,12.17-9.25,0-13.22-2.91-13.22-12.03v-38.75h28.96v-6.88h-28.96v-24.73h-7.67v24.73h-10.71v6.88h10.71v38.75c0,13.22,6.74,18.91,20.63,18.91,13.09,0,21.29-5.15,21.29-19.05M1633.72,398.36c0-3.3-1.84-5.02-5.15-5.02s-5.03,1.72-5.03,5.02,1.73,5.16,5.03,5.16,5.15-1.98,5.15-5.16M1632.41,418.99h-7.67v63.48h7.67v-63.48ZM1701.22,464.36c0-18.78-12.96-17.19-26.59-17.85-12.3-.53-16.8.53-16.8-10.99,0-7.53,4.76-10.44,19.18-10.44,12.96,0,17.06,3.44,17.06,11.9h7.15c0-14.68-8.99-19.04-24.34-19.04-17.46,0-26.72,4.24-26.72,18.65,0,17.85,12.03,17.06,25.52,17.46,14.55.53,17.86.13,17.86,11.25,0,7.67-4.89,10.84-19.18,10.84s-18.12-2.91-18.12-11.64h-7.14c0,14.15,8.2,19.05,25.39,19.05s26.72-4.76,26.72-19.18M1805.43,476.53v-57.53h-7.41v7.14c-4.23-5.42-11.25-8.2-21.29-8.2-23.55,0-25.92,13.89-25.92,32.14,0,19.18,2.25,32.53,26.19,32.53,9.92,0,16.53-2.91,20.76-8.33-.14,4.9.27,10.06-.4,14.95-1.32,10.05-11.37,11.9-20.23,11.9-10.71,0-17.33-3.3-17.33-10.71h-7.41c0,13.1,11.12,17.72,25.13,17.72,12.43,0,25.39-3.57,27.38-16.92.66-3.71.53-8.47.53-14.69M1797.89,450.33c0,19.71-5.68,24.87-21.69,24.87s-17.73-8.32-17.73-24.87,1.98-25.13,17.73-25.13,21.69,5.82,21.69,25.13M1871.38,436.45c0-12.69-6.75-18.51-19.44-18.51-8.34,0-14.82,2.38-19.31,8.47v-7.41h-7.41v63.48h7.68v-27.51c0-12.83-1.06-29.76,17.59-29.76,10.05,0,13.76,2.52,13.76,11.24h7.15ZM1940.2,450.74c0-13.76-1.33-20.9-6.08-25.8-4.77-4.89-11.51-7.01-21.96-7.01s-17.19,2.12-22.08,7.01c-4.63,4.89-6.09,12.04-6.09,25.8s1.45,20.9,6.09,25.79c4.89,4.89,11.63,7.01,22.08,7.01s17.19-2.12,21.96-7.01c4.76-4.89,6.08-12.04,6.08-25.79M1932.53,450.47c0,16.27-.66,25.66-20.37,25.66s-20.5-9.25-20.5-25.66.79-25.26,20.5-25.26,20.37,8.2,20.37,25.26M2008.36,482.48v-63.48h-7.67v28.97c0,14.95.14,28.44-19.71,28.44-17.72,0-16.26-8.86-16.26-23.94v-33.47h-7.67v34.79c0,14.41-1.59,29.75,23.41,29.75,10.05,0,16.41-3.04,20.5-8.46v7.4h7.4ZM2082.7,450.87c0-19.18-1.98-32.93-26.05-32.93-9.91,0-17.06,3.04-21.15,8.73v-7.68h-7.41v88.75h7.67v-32.41c4.37,5.43,10.98,8.2,20.9,8.2,24.73,0,26.05-15.21,26.05-32.67M2075.03,450.74c0,16.53-1.98,25.39-17.72,25.39s-21.69-5.29-21.69-25.39,5.56-25.53,21.69-25.53,17.72,8.99,17.72,25.53' },
    { fill: '#00afb9', d: 'M2074.49,152.76h-2.48v5.32h2.56c1.45,0,2.5-.2,3.13-.6.63-.4.94-1.06.94-1.95,0-.97-.33-1.68-.98-2.11-.66-.43-1.71-.66-3.16-.66M2075.03,150.8c2.23,0,3.91.37,5.03,1.1s1.69,1.83,1.69,3.29c0,1.14-.32,2.09-.96,2.85-.64.75-1.54,1.24-2.71,1.48l3.6,7.34h-3.41l-3.27-6.86h-2.99v6.86h-3.04v-16.07h6.07ZM2087.01,159.24c0-1.72-.3-3.32-.9-4.82-.59-1.5-1.47-2.81-2.61-3.96-1.18-1.19-2.52-2.09-4.02-2.71-1.5-.62-3.09-.93-4.78-.93s-3.24.3-4.72.9c-1.48.6-2.77,1.47-3.87,2.59-1.21,1.22-2.14,2.59-2.78,4.11-.65,1.53-.97,3.1-.97,4.7s.31,3.14.93,4.62c.63,1.48,1.52,2.81,2.69,3.99,1.15,1.18,2.48,2.08,3.98,2.72,1.5.63,3.04.95,4.63.95,1.67,0,3.25-.31,4.75-.92,1.5-.61,2.86-1.51,4.09-2.69,1.16-1.13,2.04-2.42,2.66-3.89.61-1.47.92-3.02.92-4.66M2074.65,144.93c1.93,0,3.77.36,5.5,1.08,1.73.72,3.27,1.76,4.62,3.13,1.32,1.33,2.33,2.86,3.04,4.58.71,1.72,1.06,3.51,1.06,5.38s-.35,3.76-1.06,5.45c-.71,1.7-1.73,3.2-3.08,4.51-1.39,1.36-2.96,2.4-4.7,3.13-1.74.73-3.53,1.09-5.38,1.09s-3.68-.36-5.4-1.09c-1.71-.72-3.25-1.78-4.61-3.16-1.35-1.36-2.38-2.89-3.08-4.59-.71-1.7-1.06-3.47-1.06-5.33s.37-3.68,1.1-5.44c.74-1.75,1.8-3.32,3.19-4.72,1.29-1.32,2.78-2.32,4.45-3,1.67-.68,3.47-1.02,5.4-1.02' },
  ],
};

export const KERIMEDICAL_MARK = {
  view: { w: 294.081, h: 130.806 },
  glyph: { x: 0.567, y: 0.566, w: 292.938, h: 129.671 },
  fullGlyph: { x: 0.434, y: 0.566, w: 293.071, h: 129.671 },
  // Here the artwork states its own split: <g id="medartis_group"> above
  // <g id="KeriMedical">, and KeriMedical_Logo_neg.svg hides the former with
  // display:none. The brand ships a byline-off build; this model is theirs.
  paths: [
    { byline: true, fill: null, d: 'M0.505,92.76H134.284V93.551H0.505Z' },
    { byline: true, fill: null, d: 'M76.494,107.678c0-2.752-1.899-2.519-3.896-2.616-1.802-.078-2.461.077-2.461-1.609,0-1.105.698-1.53,2.81-1.53,1.9,0,2.5.503,2.5,1.744h1.047c0-2.152-1.318-2.791-3.566-2.791-2.558,0-3.915.62-3.915,2.733,0,2.616,1.763,2.499,3.74,2.558,2.133.077,2.617.019,2.617,1.647,0,1.124-.717,1.589-2.811,1.589-2.015,0-2.655-.427-2.655-1.706h-1.046c0,2.074,1.202,2.791,3.721,2.791,2.577,0,3.915-.697,3.915-2.81M66.41,101.03h-1.124v9.303h1.124v-9.303ZM66.604,98.006c0-.484-.271-.736-.755-.736s-.737.252-.737.736c0,.465.253.756.737.756s.755-.291.755-.756M63.085,107.697h-1.047c0,1.26-.561,1.783-2.035,1.783-1.357,0-1.938-.427-1.938-1.763v-5.679h4.244v-1.008h-4.244v-3.624h-1.124v3.624h-1.57v1.008h1.57v5.679c0,1.938.988,2.771,3.023,2.771,1.919,0,3.121-.755,3.121-2.791M53.953,103.588c0-1.86-.988-2.713-2.849-2.713-1.221,0-2.171.349-2.829,1.241v-1.086h-1.086v9.303h1.124v-4.032c0-1.88-.155-4.36,2.578-4.36,1.472,0,2.016.369,2.016,1.647h1.046ZM43.258,105.759c0,2.481-.232,3.721-3.274,3.721-1.803,0-2.403-.542-2.403-1.821,0-1.667.911-1.9,2.48-1.9h3.198ZM44.402,110.333v-5.349c0-.659.02-1.338-.077-1.841-.291-1.822-1.842-2.268-3.625-2.268-2.422,0-4.012.6-4.012,2.791h1.047c0-1.667,1.492-1.725,2.81-1.725s1.9.175,2.268.542c.523.504.446,1.299.446,1.958v.31h-3.12c-2.055,0-3.702.369-3.702,2.927,0,1.996,1.183,2.81,3.605,2.81,1.55,0,2.752-.388,3.294-1.202v1.047h1.066ZM32.882,105.701c0,2.946-.795,3.702-3.179,3.702-2.307,0-2.597-1.28-2.597-3.702s.291-3.76,2.597-3.76c2.383,0,3.179.814,3.179,3.76M33.987,110.333v-13.508h-1.125v5.252c-.619-.795-1.589-1.202-3.062-1.202-3.624,0-3.818,2.229-3.818,4.787,0,2.81.31,4.826,3.818,4.826,1.453,0,2.5-.446,3.101-1.279v1.124h1.086ZM22.525,104.925h-5.699c0-2.074.659-3.024,2.83-3.024,2.249,0,2.869.775,2.869,3.024M23.61,105.952c0-3.101-.175-5.078-3.954-5.078-3.449,0-3.973,1.783-3.973,4.845,0,3.005.465,4.768,4.031,4.768,1.958,0,3.76-.542,3.76-2.791h-1.046c0,1.55-1.434,1.745-2.694,1.745-2.617,0-2.927-1.144-2.927-3.489h6.803ZM13.148,110.333v-5.621c0-.93.039-1.647-.252-2.364-.408-.988-1.415-1.472-2.81-1.472s-2.364.484-3.024,1.492c-.408-1.008-1.357-1.492-2.752-1.492-1.434,0-2.307.523-2.791,1.241v-1.086H.434v9.303h1.125v-4.129c0-1.957-.078-4.263,2.577-4.263,2.094,0,2.094,1.027,2.094,2.733v5.659h1.124v-4.167c0-1.958-.078-4.225,2.577-4.225,2.094,0,2.094,1.027,2.094,2.733v5.659h1.124Z' },
    { byline: true, fill: null, d: 'M131.273,105.682c0,2.422-.291,3.721-2.597,3.721-2.364,0-3.179-.775-3.179-3.721s.814-3.741,3.179-3.741c2.307,0,2.597,1.318,2.597,3.741M132.397,105.701c0-2.81-.291-4.826-3.818-4.826-1.453,0-2.5.446-3.101,1.28v-1.125h-1.086v13.005h1.124v-4.749c.64.795,1.609,1.202,3.063,1.202,3.624,0,3.818-2.229,3.818-4.787M121.503,110.333v-9.303h-1.124v4.244c0,2.191.02,4.168-2.888,4.168-2.596,0-2.383-1.299-2.383-3.508v-4.904h-1.124v5.098c0,2.113-.233,4.36,3.43,4.36,1.472,0,2.403-.446,3.004-1.24v1.085h1.085ZM110.391,105.643c0,2.383-.097,3.76-2.985,3.76s-3.004-1.357-3.004-3.76.116-3.702,3.004-3.702c2.81,0,2.985,1.202,2.985,3.702M111.515,105.682c0-2.016-.194-3.063-.891-3.78-.698-.717-1.686-1.027-3.218-1.027s-2.519.31-3.237,1.027c-.678.717-.892,1.764-.892,3.78s.214,3.062.892,3.779c.717.717,1.705,1.027,3.237,1.027s2.519-.31,3.218-1.027c.697-.717.891-1.764.891-3.779M101.43,103.588c0-1.86-.989-2.713-2.849-2.713-1.222,0-2.171.349-2.83,1.241v-1.086h-1.086v9.303h1.125v-4.031c0-1.88-.155-4.361,2.577-4.361,1.473,0,2.016.369,2.016,1.647h1.047ZM90.661,105.623c0,2.888-.833,3.644-3.179,3.644-2.268,0-2.597-1.221-2.597-3.644s.291-3.682,2.597-3.682c2.384,0,3.179.853,3.179,3.682M91.766,109.461v-8.431h-1.085v1.047c-.62-.795-1.648-1.202-3.121-1.202-3.45,0-3.799,2.035-3.799,4.71,0,2.81.33,4.767,3.838,4.767,1.453,0,2.422-.426,3.043-1.221-.02.717.039,1.473-.059,2.191-.194,1.472-1.666,1.744-2.965,1.744-1.57,0-2.539-.484-2.539-1.57h-1.085c0,1.919,1.628,2.597,3.682,2.597,1.822,0,3.721-.523,4.012-2.48.097-.543.078-1.241.078-2.152' },
    { fill: '#bbbdbd', d: 'M103.334,56.537l11.52,13.836,11.581-13.836v29.257s7.619,0,7.619,0v-40.839s-7.619,0-7.619,0l-11.581,14.385-11.52-14.385h-7.619s0,40.839,0,40.839h7.619s0-29.257,0-29.257h0ZM152.888,61.17c4.023,0,6.949,2.255,8.046,5.973h-16.092c1.036-3.718,4.023-5.973,8.046-5.973h0ZM167.456,77.017h-8.107c-1.463,2.194-3.779,2.926-6.461,2.926-4.267,0-7.315-2.499-8.229-6.583h23.772c.183-.914.305-1.829.305-2.804,0-9.265-6.583-15.848-15.848-15.848-9.265,0-15.848,6.583-15.848,15.848,0,9.326,6.583,15.848,15.848,15.848,6.888,0,12.922-3.474,14.568-9.387h0ZM187.083,79.638c-5.12,0-8.533-3.596-8.533-9.082s3.413-9.143,8.533-9.143c5.181,0,8.533,3.657,8.533,9.143s-3.352,9.082-8.533,9.082h0ZM195.616,85.795h7.315s0-40.839,0-40.839h-7.315s0,12.739,0,12.739c-2.255-1.95-5.181-2.987-8.533-2.987-9.265,0-15.848,6.583-15.848,15.848,0,9.326,6.583,15.848,15.848,15.848,3.352,0,6.278-1.036,8.533-2.987v2.377h0ZM206.588,51.661h7.315s0-6.705,0-6.705h-7.315s0,6.705,0,6.705h0ZM206.588,85.795h7.315s0-30.477,0-30.477h-7.315s0,30.477,0,30.477h0ZM248.462,68.728c-.792-8.29-7.132-14.019-15.726-14.019-9.265,0-15.848,6.583-15.848,15.848,0,9.326,6.583,15.848,15.848,15.848,8.655,0,14.934-5.669,15.726-14.019h-7.375c-.671,4.51-3.84,7.253-8.351,7.253-5.181,0-8.533-3.596-8.533-9.082s3.352-9.143,8.533-9.143c4.511,0,7.68,2.804,8.351,7.315h7.375ZM266.687,79.639c-5.181,0-8.533-3.596-8.533-9.082s3.352-9.143,8.533-9.143c5.12,0,8.533,3.657,8.533,9.143s-3.413,9.082-8.533,9.082h0ZM275.22,85.795h7.315s0-30.477,0-30.477h-7.315s0,2.377,0,2.377c-2.255-1.95-5.181-2.987-8.533-2.987-9.265,0-15.848,6.583-15.848,15.848,0,9.326,6.583,15.848,15.848,15.848,3.352,0,6.278-1.036,8.533-2.987v2.377h0ZM293.505,85.795v-40.839s-7.314,0-7.314,0v40.839s7.314,0,7.314,0h0Z' },
    { fill: '#001a72', d: 'M8.186,85.794v-12.313s3.84-4.449,3.84-4.449l11.337,16.762h9.021s-15.665-22.309-15.665-22.309l15.909-18.53h-9.265s-15.177,17.982-15.177,17.982v-17.982s-7.619,0-7.619,0v40.839s7.619,0,7.619,0h0ZM45.917,61.17c4.023,0,6.949,2.255,8.046,5.973h-16.092c1.036-3.718,4.023-5.973,8.046-5.973h0ZM60.485,77.017h-8.107c-1.463,2.194-3.779,2.926-6.461,2.926-4.267,0-7.315-2.499-8.229-6.583h23.772c.183-.914.305-1.829.305-2.804,0-9.265-6.583-15.848-15.848-15.848s-15.848,6.583-15.848,15.848c0,9.326,6.583,15.848,15.848,15.848,6.888,0,12.922-3.474,14.568-9.387h0ZM81.269,62.023v-6.705s-16.58,0-16.58,0v30.477s7.314,0,7.314,0v-23.772s9.265,0,9.265,0h0ZM84.743,51.661h7.314s0-6.705,0-6.705h-7.314s0,6.705,0,6.705h0ZM84.743,85.794h7.314s0-30.477,0-30.477h-7.314s0,30.477,0,30.477h0Z' },
    { fill: '#001a72', d: 'M7.881,41.405V.566s-7.314,0-7.314,0v40.839s7.314,0,7.314,0h0ZM18.852,41.405V.566s-7.314,0-7.314,0v40.839s7.314,0,7.314,0h0ZM29.824,41.405V.566s-7.314,0-7.314,0v40.839s7.314,0,7.314,0h0ZM40.795,41.405V.566s-7.314,0-7.314,0v40.839s7.314,0,7.314,0h0Z' },
    { fill: '#001a72', d: 'M281.305,130.237 L293.496,89.398 L285.876,89.398 L273.686,130.237 L281.305,130.237 L281.305,130.237Z' },
  ],
};

/**
 * The paths to draw, and the bounds they occupy.
 *
 * `withByline` is the whole question: TRUE when the co-brand stands alone (the
 * byline is the only thing naming its parent), FALSE under the Medartis Group mark
 * (where it would state the same relationship twice, in opposite directions).
 */
export function markGeometry(mark, withByline) {
  return {
    paths: withByline ? mark.paths : mark.paths.filter((p) => !p.byline),
    glyph: withByline ? (mark.fullGlyph || mark.glyph) : mark.glyph,
    view: mark.view,
  };
}

export const CO_BRANDS = { neoortho: NEOORTHO_MARK, kerimedical: KERIMEDICAL_MARK };

export const SUB_BRANDS = {
  medartis: {
    label: 'medartis',
    // The engine owns this artwork (WORDMARK_PATHS). It is the MAIN BRAND under the
    // Group — not the Group mark, which is separate artwork living in GROUP_MARK.
    mark: 'MEDARTIS_WORDMARK_MARK',
    colors: { primary: '#131310' },   // coal — medartis is monochrome by definition
    note: 'The main brand under the house. Monochrome: no colour of its own to lend.',
  },
  neoortho: {
    label: 'NeoOrtho',
    mark: 'NEOORTHO_MARK',
    colors: { primary: '#582d83', secondary: '#00afb9' },  // violet · teal
  },
  kerimedical: {
    label: 'KeriMedical',
    mark: 'KERIMEDICAL_MARK',
    colors: { primary: '#001a72', secondary: '#bbbdbd' },  // deep blue · grey
  },
};

// ─── THE DERIVATION RULE ──────────────────────────────────────────────────────
// "The gradient colours are derived from the co-brands' original colours."
//
// The rule, stated so it can be argued with:
//
//   A Group gradient runs between two colours that are OWNED by two different
//   parts of the Group. One endpoint per brand. Nothing in between is invented.
//
// That is why `group` is KeriMedical blue → NeoOrtho teal: it is the only pair
// where each end belongs to a different sub-brand, and it happens to run deep→bright,
// which is what makes it legible as a background at all.
//
// WHAT IS DELIBERATELY NOT HERE
// KeriMedical's #bbbdbd is a light neutral grey. It is a real brand colour, and it
// is a terrible gradient endpoint: against it, paper-white type fails contrast and
// coal type goes muddy — so a "blue → grey" preset would be a trap that looks
// plausible in the picker. It is used as a RULE line and a mono fallback instead.
//
// No fourth colour is blended into existence to "bridge" violet and blue. Two
// saturated brand colours 40° apart on the wheel pass through a muddy indigo that
// belongs to nobody. If the Group ever needs that bridge, it is a brand decision
// made by people, not an interpolation made by this file.

const SB = SUB_BRANDS;

/**
 * A darker shade of a brand colour: every channel scaled by k.
 *
 * Channel scaling — not an HSL lightness move. Halving RGB holds hue and saturation
 * EXACTLY (they are ratios between channels, and scaling all three leaves those
 * ratios untouched), whereas an HSL round-trip drifts the hue a fraction of a degree
 * and needs a colour-space library to explain. A shade of a brand colour should be
 * provably the same hue, not approximately.
 */
export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k));
  return '#' + ch.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export const GROUP_GRADIENTS = {
  group: {
    from: SB.kerimedical.colors.primary,   // #001a72
    to:   SB.neoortho.colors.secondary,    // #00afb9
    angle: 45,
    label: 'Group — KeriMedical blue → NeoOrtho teal',
    guide: true,
    derivation: 'One endpoint per sub-brand. The whole Group in one ramp.',
  },
  neoortho: {
    from: SB.neoortho.colors.primary,      // #582d83
    to:   SB.neoortho.colors.secondary,    // #00afb9
    angle: 45,
    label: 'NeoOrtho — violet → teal',
    derivation: "NeoOrtho's own two colours. For NeoOrtho-led assets.",
  },
  kerimedical: {
    from: shade(SB.kerimedical.colors.primary, 0.5),   // #000d39
    to:   SB.kerimedical.colors.primary,               // #001a72
    angle: 45,
    label: 'KeriMedical — deep → blue',
    // KeriMedical owns exactly one usable gradient colour (the grey is unusable as
    // an endpoint, see above), so a same-brand ramp needs a second one. Rather than
    // borrow another sub-brand's — which would silently make a KeriMedical asset
    // half-NeoOrtho — this is #001a72's own 50% shade: every channel halved.
    //
    // Computed, not typed. The hex is not written down anywhere, so it cannot drift
    // from the blue it claims to be a shade of, and nobody can "adjust it slightly"
    // into a fifth brand colour.
    derivation: 'A 50% shade of #001a72, because KeriMedical has no second colour to ramp to.',
  },
  house: {
    from: '#131310',                       // coal, the medartis colour
    to:   SB.kerimedical.colors.primary,   // #001a72
    angle: 45,
    label: 'House — coal → KeriMedical blue',
    derivation: 'medartis lends the ink; KeriMedical lends the colour.',
  },
};

// The grey is real, and it has a job — just not that one.
export const GROUP_RULE_COLOR = SB.kerimedical.colors.secondary;  // #bbbdbd

export const MARK_VARIANTS = ['color', 'white', 'mono'];

/** The paths of a mark, recoloured for the surface it lands on. */
export function markPaths(mark, variant, inkColor, withByline = true) {
  if (!mark) return [];
  const src = withByline ? mark.paths : mark.paths.filter((p) => !p.byline);
  return src.map((p) => {
    if (variant === 'white') return { ...p, fill: '#FFFFFF' };
    if (variant === 'mono') return { ...p, fill: inkColor || '#131310' };
    return { ...p, fill: p.fill || inkColor || '#131310' };
  });
}

// ─── Clear space ──────────────────────────────────────────────────────────────
// The medartis rule is 1.5 × the height of the "d". That rule is about the medartis
// wordmark and does not transfer: NeoOrtho and KeriMedical have no "d" ascender to
// measure, and their own guidelines are not in hand.
//
// So rather than invent a rule per brand and be quietly wrong three times, each mark
// reserves 1.5 × ITS OWN cap height — measured from the real path bounds. For the
// medartis wordmark that reduces to the existing 1.5×d rule (the "d" IS its tallest
// glyph), so the house rule is preserved exactly where it applies, and the others
// get a defensible equivalent rather than a guess dressed as a standard.

export const GROUP_CLEAR_RATIO = 1.5;

export function clearSpaceFor(mark, drawnHeight) {
  if (!mark) return 0;
  // drawnHeight is the GLYPH height on canvas, so the ratio applies directly.
  return GROUP_CLEAR_RATIO * drawnHeight;
}

// ─── The crossover, and why it is the only dangerous part of a ramp ───────────
// A gradient is a RANGE, not a colour, and the engine already picks ink per region
// by sampling luminance. So "is white legible on this gradient?" is the wrong
// question — it fails on the teal end of a perfectly good ramp and would condemn
// the Group's own sanctioned gradient.
//
// The right question is whether SOME ink works at every point. For a ramp that runs
// dark→mid, the answer is yes almost everywhere: paper wins the dark end, coal wins
// the light end. But they swap, and where they swap BOTH are mediocre. On the Group
// ramp that crossover sits around t ≈ 0.63, and it is roughly 3% of the ramp wide.
//
// That band is the whole hazard. Type centred there fails no matter which ink the
// sampler picks, and it fails QUIETLY — the sampler returns its best guess and the
// best guess is 4.2:1.
//
// So it is measured, not avoided by superstition.

const _lum = ([r, g, b]) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const _ratio = (a, b) => { const [x, y] = [_lum(a), _lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

export const GROUP_INKS = { paper: [255, 255, 255], coal: [19, 19, 16] };

/**
 * The best ink at axis position t, and how good it actually is.
 * `safe` is the honest bit: false means NEITHER ink clears 4.5:1 here.
 */
export function legibleInkAt(g, t, colorAtFn) {
  const c = colorAtFn(g, t);
  let best = null;
  for (const [name, ink] of Object.entries(GROUP_INKS)) {
    const r = _ratio(ink, c);
    if (!best || r > best.ratio) best = { ink: name, ratio: r };
  }
  return { ...best, safe: best.ratio >= 4.5 };
}

/**
 * The band(s) of the ramp where no ink is legible. Empty array = the ramp is safe
 * end to end. Anything returned here is a place type must not land bare — the
 * layout engine either moves the text or puts a scrim under it.
 */
export function deadZones(g, colorAtFn, n = 101) {
  const zones = [];
  let cur = null;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    if (!legibleInkAt(g, t, colorAtFn).safe) {
      if (!cur) cur = { from: t, to: t };
      else cur.to = t;
    } else if (cur) { zones.push(cur); cur = null; }
  }
  if (cur) zones.push(cur);
  return zones;
}

// ─── Measuring a mark from its own path data ──────────────────────────────────
// The `glyph` bounds above are stored, and stored data drifts from the thing it
// describes. If someone nudges a path, the bounds keep saying what they always said
// — and clear space, which is computed FROM those bounds, silently becomes a
// fiction. The mark would still draw. It would just stop being spaced correctly.
//
// So the bounds are recomputable, and check_group.mjs recomputes them.
//
// Curves are flattened rather than read at their endpoints: a bézier's extremum can
// lie outside its start and end, so an endpoint-only bbox can UNDER-report height —
// and under-reported height means under-reserved clear space, which is the one
// direction the error must never go.

export function pathBounds(paths) {
  const num = /[a-zA-Z]|-?\d*\.?\d+(?:[eE]-?\d+)?/g;
  let xs = [], ys = [];
  const bez = (p0, p1, p2, p3) => {
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, m = 1 - t;
      xs.push(m*m*m*p0[0] + 3*m*m*t*p1[0] + 3*m*t*t*p2[0] + t*t*t*p3[0]);
      ys.push(m*m*m*p0[1] + 3*m*m*t*p1[1] + 3*m*t*t*p2[1] + t*t*t*p3[1]);
    }
  };
  for (const p of paths) {
    const T = (p.d || '').match(num) || [];
    let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, pc = null;
    const take = () => parseFloat(T[i++]);
    const put = () => { xs.push(x); ys.push(y); };
    while (i < T.length) {
      if (/[a-zA-Z]/.test(T[i])) { cmd = T[i++]; continue; }
      const rel = cmd === cmd.toLowerCase(), c = cmd.toUpperCase();
      if (c === 'M') { const a = take(), b = take(); x = rel ? x+a : a; y = rel ? y+b : b; sx = x; sy = y; put(); cmd = rel ? 'l' : 'L'; }
      else if (c === 'L') { const a = take(), b = take(); x = rel ? x+a : a; y = rel ? y+b : b; put(); }
      else if (c === 'H') { const a = take(); x = rel ? x+a : a; put(); }
      else if (c === 'V') { const a = take(); y = rel ? y+a : a; put(); }
      else if (c === 'C' || c === 'S') {
        let p1;
        if (c === 'C') { const a = take(), b = take(); p1 = rel ? [x+a, y+b] : [a, b]; }
        else p1 = pc ? [2*x - pc[0], 2*y - pc[1]] : [x, y];
        const cc = take(), dd = take(), nx = take(), ny = take();
        const p2 = rel ? [x+cc, y+dd] : [cc, dd], p3 = rel ? [x+nx, y+ny] : [nx, ny];
        bez([x, y], p1, p2, p3); pc = p2; x = p3[0]; y = p3[1];
      }
      else if (c === 'Q' || c === 'T') {
        let p1;
        if (c === 'Q') { const a = take(), b = take(); p1 = rel ? [x+a, y+b] : [a, b]; }
        else p1 = pc ? [2*x - pc[0], 2*y - pc[1]] : [x, y];
        const nx = take(), ny = take();
        const p2 = rel ? [x+nx, y+ny] : [nx, ny];
        bez([x, y], [x + 2/3*(p1[0]-x), y + 2/3*(p1[1]-y)],
                    [p2[0] + 2/3*(p1[0]-p2[0]), p2[1] + 2/3*(p1[1]-p2[1])], p2);
        pc = p1; x = p2[0]; y = p2[1];
      }
      else if (c === 'A') { take(); take(); take(); take(); take(); const nx = take(), ny = take(); x = rel ? x+nx : nx; y = rel ? y+ny : ny; put(); }
      else if (c === 'Z') { x = sx; y = sy; put(); }
      else i++;
      if (c !== 'C' && c !== 'S' && c !== 'Q' && c !== 'T') pc = null;
    }
  }
  if (!xs.length) return null;
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  return { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 };
}
