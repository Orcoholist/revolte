 import * as CANNON from 'cannon-es';
import { CONFIG } from './config.js';

export function createPhysicsWorld() {
  const world = new CANNON.World();
  world.gravity.set(0, CONFIG.physics.gravity, 0);
  // Используем NaiveBroadphase для совместимости с cannon-es v0.20
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = 10;

  // Материалы
  const groundMat = new CANNON.Material('ground');
  const wheelMat = new CANNON.Material('wheel');

  const contactMat = new CANNON.ContactMaterial(wheelMat, groundMat, {
    friction: CONFIG.physics.friction,
    restitution: CONFIG.physics.restitution,
    contactEquationStiffness: 1e8,
    contactEquationRelaxation: 3
  });
  world.addContactMaterial(contactMat);

  // Ground body удалён - используем slabs из track.js для коллизии с землёй
  // Это решает проблему с внутренней ошибкой cannon-es в RaycastVehicle

  return { world, groundMat, wheelMat };
}