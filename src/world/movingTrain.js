import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class MovingTrain {
    constructor(scene, world, path, trainModel) {
        this.scene = scene;
        this.world = world;
        this.path = path;
        this.currentPathIndex = 0;
        this.speed = 15; // Скорость движения поезда
        this.mesh = null;
        this.body = null;
        this.direction = 1; // 1 для движения вперед, -1 для назад

        console.log("MovingTrain: Конструктор вызван. Инициализация поезда из готовой модели.");
        this.initializeFromModel(trainModel);
        this.createRails();
    }

    initializeFromModel(trainModel) {
        console.log("MovingTrain: Инициализация поезда из готовой модели.");
        this.mesh = trainModel;
        // Масштабирование модели, если необходимо
        this.mesh.scale.set(1, 1, 1); 
        console.log("MovingTrain: Модель поезда добавлена в сцену.");
        this.scene.add(this.mesh);

        // Создаем физическое тело для поезда
        const trainBox = new THREE.Box3().setFromObject(this.mesh);
        const trainSize = trainBox.getSize(new THREE.Vector3());
        const trainHalfExtents = new CANNON.Vec3(trainSize.x / 2, trainSize.y / 2, trainSize.z / 2);
        console.log("MovingTrain: Размеры поезда:", trainSize);

        this.halfExtents = trainHalfExtents;

        const startPos = this.path[0].clone();
        startPos.y += trainHalfExtents.y; // Чтобы поезд стоял на земле, а не проваливался

        this.halfExtents = trainHalfExtents;

        this.body = new CANNON.Body({
            mass: 0, // Kinematic — движется по скрипту, не реагирует на импульсы
            type: CANNON.Body.KINEMATIC,
            shape: new CANNON.Box(trainHalfExtents),
            position: startPos,
        });
        this.body.allowSleep = false;
        console.log("MovingTrain: Физическое тело поезда создано и добавлено в мир.");
        this.world.addBody(this.body);
    }

    reset() {
        if (!this.body || !this.mesh) return;
        const startPos = this.path[0].clone();
        startPos.y += this.halfExtents.y;
        this.body.position.copy(startPos);
        this.body.velocity.set(0, 0, 0);
        this.body.angularVelocity.set(0, 0, 0);
        this.body.quaternion.set(0, 0, 0, 1);
        this.currentPathIndex = 0;
        this.direction = 1;
        this.mesh.position.copy(this.body.position);
        this.mesh.quaternion.copy(this.body.quaternion);
        console.log('MovingTrain: Поезд сброшен на стартовую позицию.');
    }

    destroy() {
        if (this.body) {
            this.world.removeBody(this.body);
            this.body = null;
        }
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh = null;
        }
        const rails = this.scene.getObjectByName('trainRails');
        if (rails) {
            this.scene.remove(rails);
        }
    }

    createRails() {
        console.log("MovingTrain: Создание рельсов.");
        const railGroup = new THREE.Group();
        railGroup.name = 'trainRails';

        const railRadius = 0.2;
        const railSegments = 64;

        for (let i = 0; i < this.path.length - 1; i++) {
            const start = this.path[i];
            const end = this.path[i + 1];

            const railGeometry = new THREE.CylinderGeometry(railRadius, railRadius, start.distanceTo(end), railSegments);
            const railMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
            const rail = new THREE.Mesh(railGeometry, railMaterial);

            // Позиционирование и ориентирование рельса
            rail.position.copy(start).lerp(end, 0.5);
            rail.lookAt(end);
            rail.rotateX(Math.PI / 2); // Цилиндр по умолчанию стоит вертикально, поворачиваем горизонтально

            railGroup.add(rail);

            // Добавить шпалы
            const sleeperCount = Math.floor(start.distanceTo(end) / 5);
            for (let j = 0; j < sleeperCount; j++) {
                const sleeperPos = start.clone().lerp(end, j / sleeperCount);
                const sleeperGeometry = new THREE.BoxGeometry(4, 0.5, 1);
                const sleeperMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Коричневый цвет для шпал
                const sleeper = new THREE.Mesh(sleeperGeometry, sleeperMaterial);
                sleeper.position.copy(sleeperPos);
                sleeper.position.y += 0.25; // Чуть выше рельсов
                sleeper.rotation.y = Math.random() * Math.PI; // Случайный поворот шпал
                railGroup.add(sleeper);
            }
        }
        this.scene.add(railGroup);
        console.log("MovingTrain: Рельсы добавлены в сцену.");
    }

    update(dt) {
        if (!this.mesh || !this.body) return;

        const targetPoint = this.path[this.currentPathIndex];
        const currentPosition = this.body.position;

        // Направление к следующей точке
        const directionToTarget = new THREE.Vector3().subVectors(targetPoint, currentPosition);
        const distanceToTarget = directionToTarget.length();

        if (distanceToTarget < 5) {
            this.currentPathIndex += this.direction;
            if (this.currentPathIndex >= this.path.length - 1 || this.currentPathIndex < 0) {
                this.direction *= -1;
                this.currentPathIndex += this.direction;
            }
        }

        directionToTarget.normalize();

        // Для kinematic тела задаём скорость напрямую
        this.body.velocity.set(
            directionToTarget.x * this.speed,
            directionToTarget.y * this.speed,
            directionToTarget.z * this.speed
        );

        // Синхронизируем меш с физическим телом
        this.mesh.position.copy(this.body.position);
        this.mesh.quaternion.copy(this.body.quaternion);
    }

    checkCollision(carController) {
        if (!this.body) return false;

        const carPos = carController.mesh.position;
        const trainPos = this.body.position;
        const collisionDistance = 10;

        if (carPos.distanceToSquared(trainPos) < collisionDistance * collisionDistance) {
            const impactDirection = new THREE.Vector3()
                .subVectors(carPos, trainPos)
                .normalize();

            // Мягкий импульс в сторону от поезда + небольшой подброс
            const impulse = new CANNON.Vec3(
                impactDirection.x * 6,
                2.5,
                impactDirection.z * 6
            );

            carController.chassisBody.wakeUp();
            carController.chassisBody.applyImpulse(impulse, carController.chassisBody.position);

            return true;
        }
        return false;
    }
}