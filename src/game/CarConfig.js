export const DEFAULT_CAR_CONFIG = {
  mass: 850,
  chassisWidth: 1.7,
  chassisHeight: 0.6,
  chassisLength: 4.0,

  centerOfMassOffset: { x: 0, y: -0.2, z: 0.3 },

  wheelRadius: 0.33,
  suspensionStiffness: 28,
  suspensionDamping: 3.2,
  suspensionRestLength: 0.3,
  maxSuspensionTravel: 0.2,
  suspensionForceMax: 50000,

  frictionSlip: 5.5,
  rollInfluence: 0.01,

  maxEngineForce: 3500,
  maxBrakeForce: 25,
  maxSteerAngle: 0.55,
  steerSpeed: 3.0,

  wheelPositions: {
    frontLeft:  { x: -0.75, y: -0.35, z: 1.4 },
    frontRight: { x: 0.75,  y: -0.35, z: 1.4 },
    rearLeft:   { x: -0.75, y: -0.35, z: -1.3 },
    rearRight:  { x: 0.75,  y: -0.35, z: -1.3 },
  },
};

export const CARS = {
  '356-speedster': {
    name: '356 Speedster',
    era: 'classic',
    mass: 800,
    maxEngineForce: 2800,
    maxSpeed: 180,
    maxSteerAngle: 0.5,
    color: 0xc41e3a,
  },
  '550-spyder': {
    name: '550 Spyder',
    era: 'classic',
    mass: 720,
    maxEngineForce: 3000,
    maxSpeed: 200,
    maxSteerAngle: 0.52,
    color: 0xcccccc,
  },
  '911-carrera': {
    name: '911 Carrera',
    era: 'mid',
    mass: 1100,
    maxEngineForce: 3800,
    maxSpeed: 220,
    maxSteerAngle: 0.48,
    color: 0x1e3a8a,
  },
  '930-turbo': {
    name: '930 Turbo',
    era: 'mid',
    mass: 1200,
    maxEngineForce: 4200,
    maxSpeed: 240,
    maxSteerAngle: 0.45,
    color: 0x1a1a1a,
  },
  '911-gt3': {
    name: '911 GT3',
    era: 'modern',
    mass: 1350,
    maxEngineForce: 5500,
    maxSpeed: 290,
    maxSteerAngle: 0.42,
    color: 0xffffff,
  },
  'cayman-gt4': {
    name: 'Cayman GT4',
    era: 'modern',
    mass: 1300,
    maxEngineForce: 5200,
    maxSpeed: 280,
    maxSteerAngle: 0.44,
    color: 0xf5a623,
  },
};

export function buildCarConfig(carId) {
  const carOverride = CARS[carId] || {};
  const config = { ...DEFAULT_CAR_CONFIG, ...carOverride };
  config.maxBrakeForce = config.maxEngineForce * 0.8;
  return config;
}
