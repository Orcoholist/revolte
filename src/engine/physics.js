import * as CANNON from 'cannon-es';
import { CONFIG } from './config.js';

export function createPhysicsWorld() {
  const world = new CANNON.World();
  world.gravity.set(0, CONFIG.physics.gravity, 0);
  world.broadphase = new CANNON.SAPBroadphase(world);
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

  // Физическая плоскость на высоте трассы (y=0)
  // Если трасса имеет рельеф, нужно извлечь её геометрию для физики
  const groundBody = new CANNON.Body({ mass: 0, material: groundMat });
  groundBody.addShape(new CANNON.Plane());
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  groundBody.position.set(0, 0, 0); // высота поверхности трассы
  world.addBody(groundBody);

  return { world, groundMat, wheelMat };
}