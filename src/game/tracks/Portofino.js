// A tight harbourside street circuit. Shortest and narrowest of the three, with
// buildings crowding the barriers and a steady climb away from the waterfront
// into the old town before dropping back down.

export const portofino = {
  id: 'portofino',
  name: 'Portofino',
  location: 'Ligurian Coast',
  theme: 'urban',
  waypoints: [
    // --- Waterfront straight ---
    { x: 0, y: 0, z: 340 },
    { x: 89, y: 1, z: 333 },
    { x: 165, y: 3, z: 286 },
    // --- Into the narrow streets, climbing ---
    { x: 212, y: 7, z: 212 },
    { x: 230, y: 12, z: 133 },
    { x: 227, y: 17, z: 61 },
    { x: 225, y: 22, z: 0 },
    { x: 227, y: 27, z: -61 },
    // --- Old town, tightest section ---
    { x: 225, y: 32, z: -130 },
    { x: 209, y: 36, z: -209 },
    { x: 165, y: 39, z: -286 },
    { x: 91, y: 40, z: -338 },
    // --- Highest point, hairpin at the top ---
    { x: 0, y: 38, z: -355 },
    { x: -89, y: 35, z: -333 },
    { x: -160, y: 31, z: -277 },
    { x: -202, y: 26, z: -202 },
    // --- Descent back toward the harbour ---
    { x: -217, y: 21, z: -125 },
    { x: -217, y: 16, z: -58 },
    { x: -220, y: 11, z: 0 },
    { x: -227, y: 7, z: 61 },
    { x: -229, y: 4, z: 133 },
    { x: -212, y: 2, z: 212 },
    { x: -165, y: 1, z: 286 },
    { x: -89, y: 0, z: 333 },
  ],
  roadWidth: 11,
  laps: 3,
};
