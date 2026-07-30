// A Normandy clifftop run: an elongated loop with the sea falling away on the
// outside and farmland on the inside. Much flatter than Alpenpass — the drama
// comes from the drop to the water, not from gradient.

export const cotedalbatre = {
  id: 'cotedalbatre',
  name: "Côte d'Albâtre",
  location: 'Normandy, France',
  theme: 'coastal',
  waypoints: [
    // --- Harbour straight ---
    { x: 0, y: 2, z: 310 },
    { x: 135, y: 4, z: 299 },
    { x: 260, y: 8, z: 268 },
    // --- Climb onto the first headland ---
    { x: 368, y: 14, z: 219 },
    { x: 450, y: 20, z: 155 },
    { x: 502, y: 26, z: 80 },
    { x: 520, y: 30, z: 0 },
    // --- Tight cliff hairpin ---
    { x: 412, y: 32, z: -66 },
    { x: 360, y: 28, z: -124 },
    { x: 324, y: 22, z: -193 },
    { x: 260, y: 16, z: -268 },
    { x: 135, y: 10, z: -299 },
    // --- Inland turn through the fields ---
    { x: 0, y: 6, z: -310 },
    { x: -135, y: 4, z: -299 },
    { x: -260, y: 6, z: -268 },
    { x: -368, y: 11, z: -219 },
    // --- Second headland ---
    { x: -427, y: 17, z: -68 },
    { x: -442, y: 22, z: 0 },
    { x: -442, y: 25, z: 70 },
    { x: -450, y: 22, z: 155 },
    // --- Descent back to the harbour ---
    { x: -368, y: 17, z: 219 },
    { x: -260, y: 12, z: 268 },
    { x: -135, y: 6, z: 299 },
  ],
  roadWidth: 13,
  laps: 3,
};
