// Waypoints are 3D: y is the road-surface elevation in metres. The spline runs
// through them as a closed loop, so the last point joins back to the first.
//
// Alpenpass climbs out of a valley on the eastern side, traverses a high
// plateau, then drops back down the west face. Gradients are kept under ~13%.

export const alpenpass = {
  id: 'alpenpass',
  name: 'Alpenpass',
  location: 'Swiss Alps',
  theme: 'alpine',
  waypoints: [
    // --- Valley: start/finish straight ---
    { x: 0, y: 0, z: 420 },
    { x: 111, y: 1, z: 415 },
    { x: 215, y: 3, z: 372 },
    // --- Eastern climb: long sweepers gaining height ---
    { x: 293, y: 6, z: 293 },
    { x: 338, y: 10, z: 195 },
    { x: 338, y: 15, z: 91 },
    { x: 300, y: 21, z: 0 },
    // --- Switchbacks: tightest corners on the lap ---
    { x: 246, y: 27, z: -66 },
    { x: 208, y: 34, z: -120 },
    { x: 177, y: 41, z: -177 },
    { x: 140, y: 48, z: -242 },
    { x: 83, y: 55, z: -309 },
    // --- High traverse ---
    { x: 0, y: 61, z: -350 },
    { x: -92, y: 66, z: -343 },
    { x: -170, y: 70, z: -294 },
    // --- Summit plateau ---
    { x: -219, y: 72, z: -219 },
    { x: -247, y: 72, z: -143 },
    { x: -261, y: 69, z: -70 },
    // --- Western descent ---
    { x: -270, y: 64, z: 0 },
    { x: -275, y: 58, z: 74 },
    { x: -268, y: 48, z: 155 },
    { x: -240, y: 37, z: 240 },
    { x: -188, y: 25, z: 325 },
    { x: -105, y: 11, z: 391 },
  ],
  roadWidth: 14,
  laps: 3,
};
