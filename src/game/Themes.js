/**
 * Per-track look and landscape. A track picks a theme by name; Track and
 * Environment read everything scenic from here, so adding a location is a data
 * change rather than a code change.
 *
 * terrain.inside / terrain.outside describe how the ground behaves either side
 * of the road corridor — the road is cut into a slope, so "inside the loop"
 * generally climbs and "outside" generally falls away. A negative cap falls.
 */

export const THEMES = {
  // --- Swiss alps: high pass, forested slopes, snow-capped peaks ---
  alpine: {
    sky: ['#1a3a6b', '#3a6bb5', '#6ba3d6', '#a3cbe8', '#d4e8f5', '#e8f0f5'],
    fog: { color: 0xa3cbe8, density: 0.0005 },
    light: {
      sun: 0xfff5e0, sunIntensity: 1.8,
      ambient: 0x8090b0, ambientIntensity: 0.5,
      hemiSky: 0x87ceeb, hemiGround: 0x3a5a1e, hemiIntensity: 0.6,
      fill: 0xffe0b0, fillIntensity: 0.3,
    },
    ground: { color: 0x4a8a3a, base: '#3a7a2a', blade: '#5fa832' },
    verge: 0x5a9a45,
    terrain: {
      inside: { slope: 0.14, cap: 210 },
      outside: { slope: 0.09, cap: -120 },
      noise: [26, 11, 2.5],
    },
    mountains: [
      { distance: 950, height: 320, color: 0x4a6741, count: 18, scale: 1.6 },
      { distance: 1250, height: 480, color: 0x5a7a5a, count: 15, scale: 2.1 },
      { distance: 1600, height: 700, color: 0x7a8a9a, count: 12, scale: 2.6 },
    ],
    snowline: 1250,
    clouds: { count: 32, baseHeight: 620, spread: 500 },
    trees: {
      count: 520,
      coniferShare: 0.5,
      minOffset: 16,
      maxOffset: 90,
      tints: [0x1a5a1a, 0x2a6a20, 0x1a4a2a, 0x25702a],
    },
    rocks: { count: 140, minOffset: 12, maxOffset: 70, tints: [0x6a6a6a, 0x7a7a70] },
    buildings: {
      count: 30,
      minOffset: 26,
      maxOffset: 85,
      width: [7, 12],
      depth: [6, 10],
      height: [4, 7],
      roofHeight: [2.5, 4],
      wallTints: [0xd8cbb0, 0xc9b898, 0xb9a488],
      roofTints: [0x6b4a32, 0x5a3d2b, 0x7a5236],
    },
  },

  // --- Normandy coast: sea on the outside, hedgerows and farmland inland ---
  coastal: {
    sky: ['#2a5a8c', '#4a83bb', '#7db0d8', '#b4d4e8', '#dbe9f2', '#eef4f7'],
    fog: { color: 0xc2d8e6, density: 0.00045 },
    light: {
      sun: 0xfff2dd, sunIntensity: 1.7,
      ambient: 0x93a8bd, ambientIntensity: 0.55,
      hemiSky: 0x9fc9e8, hemiGround: 0x6b7a4a, hemiIntensity: 0.65,
      fill: 0xdfeaf2, fillIntensity: 0.35,
    },
    ground: { color: 0x6d9a4a, base: '#5c8a3c', blade: '#83b155' },
    verge: 0x74a352,
    sea: { level: -30, color: 0x2f6b8f },
    terrain: {
      inside: { slope: 0.05, cap: 55 },
      // Drops well below sea level so the water is actually exposed — the road
      // sits on a clifftop, not on a shelf above a hidden plane.
      outside: { slope: 0.55, cap: -70 },
      noise: [10, 5, 1.6],
    },
    mountains: [
      { distance: 1500, height: 150, color: 0x6a7f5a, count: 10, scale: 2.2 },
    ],
    snowline: null,
    clouds: { count: 40, baseHeight: 480, spread: 420 },
    trees: {
      count: 300,
      coniferShare: 0.12,
      minOffset: 20,
      maxOffset: 70,
      tints: [0x4a7a32, 0x3f6d2c, 0x56873a],
    },
    rocks: { count: 90, minOffset: 14, maxOffset: 60, tints: [0x9a9384, 0x8a8477] },
    buildings: {
      count: 34,
      minOffset: 24,
      maxOffset: 70,
      width: [8, 13],
      depth: [7, 11],
      height: [4, 6],
      roofHeight: [2.5, 3.5],
      wallTints: [0xe3ded2, 0xd6cfbe, 0xc8bfa8],
      roofTints: [0x8a4a3a, 0x743f33, 0x5c5148],
    },
  },

  // --- Monte Carlo / industrial: dense streets, tall blocks, little greenery ---
  urban: {
    sky: ['#20406b', '#3f6a9c', '#7396bb', '#a8bccd', '#cdd8e0', '#e2e7ea'],
    fog: { color: 0xb8c2cc, density: 0.00065 },
    light: {
      sun: 0xfff0d8, sunIntensity: 1.55,
      ambient: 0x8d939c, ambientIntensity: 0.6,
      hemiSky: 0xa8bccd, hemiGround: 0x50504e, hemiIntensity: 0.5,
      fill: 0xd8dde2, fillIntensity: 0.3,
    },
    ground: { color: 0x7b7a70, base: '#6f6e66', blade: '#87857a' },
    verge: 0x74736a,
    terrain: {
      inside: { slope: 0.05, cap: 60 },
      outside: { slope: 0.04, cap: -30 },
      noise: [7, 3, 1.2],
    },
    mountains: [
      { distance: 1700, height: 260, color: 0x5f6d63, count: 9, scale: 2.0 },
    ],
    snowline: null,
    clouds: { count: 18, baseHeight: 700, spread: 520 },
    trees: {
      count: 90,
      coniferShare: 0.1,
      minOffset: 14,
      maxOffset: 34,
      tints: [0x3f6b34, 0x4a7a3c],
    },
    rocks: { count: 30, minOffset: 30, maxOffset: 70, tints: [0x8a8a8a, 0x9a9a95] },
    buildings: {
      count: 120,
      minOffset: 15,
      maxOffset: 60,
      width: [9, 18],
      depth: [9, 16],
      height: [9, 26],
      roofHeight: [0.6, 1.6],
      wallTints: [0xd9cfc0, 0xc4bcae, 0xb0a99d, 0xe0d8cb, 0x9e968b],
      roofTints: [0x6a6a6a, 0x585858, 0x7a7268],
    },
  },
};

export function getTheme(name) {
  return THEMES[name] || THEMES.alpine;
}
