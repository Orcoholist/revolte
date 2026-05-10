export const CONFIG = {
  car: {
    maxSpeed: 120,
    engineForce: 800,
    brakeForce: 100,
    reverseForce: 800,
    maxSteer: 0.45,
    mass: 150,
    wheelRadius: 0.35,
    wheelFriction: 100,
    suspensionStiffness: 45,
    dampingRelaxation: 2.3,
    dampingCompression: 4.4
  },
  physics: {
    gravity: -9.82,
    substeps: 5,
    friction: 0.6,
    restitution: 0.1
  },
  world: {
    size: 500,
    trackWidth: 20
  },
  colors: {
    sky: 0x87CEEB,
    ground: 0x4a7c2e,
    road: 0x444444,
    curb: 0xcc0000,
    car: 0xff6b6b,
    cabin: 0x222222,
    wheel: 0x1a1a1a,
    tree: {
      trunk: 0x6b4226,
      leaves: 0x2d8c2d
    }
  },
  camera: {
    height: 4,
    distance: 9,
    lerpSpeed: 0.08,
    speedZoomFactor: 0.4
  }
};