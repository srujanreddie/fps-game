// client/js/main.js
// Main entry point: Scene orchestration, viewmodel weapon, visual FX, raycast shooting, and animation loop.

class FXManager {
  constructor(scene) {
    this.scene = scene;
    this.tracers = [];
    this.hitmarkerEl = document.getElementById('hitmarker');
  }

  spawnTracer(startPos, endPos) {
    // Laser cylinder / line connecting origin to impact point
    const points = [
      new THREE.Vector3(startPos.x, startPos.y, startPos.z),
      new THREE.Vector3(endPos.x, endPos.y, endPos.z)
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      linewidth: 3,
      transparent: true,
      opacity: 0.9
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);

    this.tracers.push({
      mesh: line,
      mat: mat,
      lifetime: 0.12,
      elapsed: 0
    });

    this.spawnImpactParticles(endPos);
  }

  spawnImpactParticles(pos) {
    // Quick burst of 8 glowing particles
    const particleCount = 8;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;

      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 6 + 2,
        (Math.random() - 0.5) * 6
      ));
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.2,
      transparent: true,
      opacity: 1
    });

    const pSystem = new THREE.Points(geo, mat);
    this.scene.add(pSystem);

    this.tracers.push({
      mesh: pSystem,
      mat: mat,
      positions: positions,
      velocities: velocities,
      lifetime: 0.25,
      elapsed: 0,
      isParticle: true
    });
  }

  triggerHitmarker() {
    if (!this.hitmarkerEl) return;
    this.hitmarkerEl.classList.add('active');
    setTimeout(() => {
      this.hitmarkerEl.classList.remove('active');
    }, 120);
  }

  flashDamageVignette() {
    const container = document.getElementById('game-container');
    container.style.boxShadow = 'inset 0 0 80px rgba(255, 0, 85, 0.8)';
    setTimeout(() => {
      container.style.boxShadow = 'none';
    }, 200);
  }

  update(delta) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const item = this.tracers[i];
      item.elapsed += delta;

      if (item.isParticle) {
        // Move particles outward
        const posAttr = item.mesh.geometry.attributes.position;
        for (let p = 0; p < item.velocities.length; p++) {
          item.positions[p * 3] += item.velocities[p].x * delta;
          item.positions[p * 3 + 1] += item.velocities[p].y * delta;
          item.positions[p * 3 + 2] += item.velocities[p].z * delta;
        }
        posAttr.needsUpdate = true;
      }

      // Fade out
      const progress = item.elapsed / item.lifetime;
      item.mat.opacity = Math.max(0, 1 - progress);

      if (item.elapsed >= item.lifetime) {
        this.scene.remove(item.mesh);
        item.mesh.geometry.dispose();
        item.mat.dispose();
        this.tracers.splice(i, 1);
      }
    }
  }
}

// ================= MASTER GAME CONTROLLER =================
class GameApp {
  constructor() {
    this.initThree();
    this.world = new GameWorld(this.scene);
    this.controls = new FPSControls(this.camera, this.renderer.domElement, this.world);
    this.fxManager = new FXManager(this.scene);
    this.network = new NetworkManager(this.scene, this.controls, this.fxManager);

    this.createViewmodelWeapon();
    this.initShooting();
    this.initUI();

    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0c14);

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    const container = document.getElementById('game-container');
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  createViewmodelWeapon() {
    // Weapon attached to camera in first-person view
    this.weaponGroup = new THREE.Group();

    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.3,
      metalness: 0.8
    });
    const neonMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.7,
      roughness: 0.2
    });

    // Receiver / Body
    const bodyGeo = new THREE.BoxGeometry(0.1, 0.16, 0.6);
    const body = new THREE.Mesh(bodyGeo, metalMat);
    this.weaponGroup.add(body);

    // Barrel
    const barrelGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.4, 12);
    const barrel = new THREE.Mesh(barrelGeo, metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.04, -0.45);
    this.weaponGroup.add(barrel);

    // Glowing energy cell / rail
    const energyGeo = new THREE.BoxGeometry(0.04, 0.05, 0.35);
    const energy = new THREE.Mesh(energyGeo, neonMat);
    energy.position.set(0, 0.07, -0.05);
    this.weaponGroup.add(energy);

    // Initial first person offsets (lower right)
    this.baseWeaponPos = new THREE.Vector3(0.28, -0.24, -0.52);
    this.weaponGroup.position.copy(this.baseWeaponPos);
    this.camera.add(this.weaponGroup);
    this.scene.add(this.camera);

    this.recoilOffset = 0;
  }

  initShooting() {
    this.raycaster = new THREE.Raycaster();
    this.ammo = 30;
    this.maxAmmo = 30;

    window.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || !this.controls.isLocked) return;

      this.shoot();
    });
  }

  shoot() {
    // 1. Recoil impulse on viewmodel
    this.recoilOffset = 0.12;

    // Crosshair pop animation
    const crosshair = document.getElementById('crosshair');
    if (crosshair) {
      crosshair.style.transform = 'translate(-50%, -50%) scale(1.35)';
      setTimeout(() => {
        crosshair.style.transform = 'translate(-50%, -50%) scale(1)';
      }, 70);
    }

    // 2. Raycast from camera center (0, 0)
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    // Collect all collidable targets: world objects + remote player meshes
    const candidateMeshes = [...this.world.collidableMeshes];
    this.network.remotePlayers.forEach((player) => {
      candidateMeshes.push(...player.rootGroup.children);
    });

    const intersects = this.raycaster.intersectObjects(candidateMeshes, true);

    // Muzzle flash point in world coordinates
    const muzzlePos = new THREE.Vector3();
    this.weaponGroup.getWorldPosition(muzzlePos);
    muzzlePos.add(new THREE.Vector3(0, 0.05, -0.3).applyQuaternion(this.camera.quaternion));

    let hitPoint = null;
    let targetId = null;

    if (intersects.length > 0) {
      const hit = intersects[0];
      hitPoint = hit.point;

      // Check if target is a remote player
      let cur = hit.object;
      while (cur && cur !== this.scene) {
        if (cur.userData && cur.userData.isPlayer) {
          targetId = cur.userData.playerId;
          break;
        }
        cur = cur.parent;
      }
    } else {
      // If no hit, bullet travels 100 units forward
      hitPoint = new THREE.Vector3();
      this.raycaster.ray.at(100, hitPoint);
    }

    // 3. Spawn local tracer
    this.fxManager.spawnTracer(muzzlePos, hitPoint);

    // 4. Emit shot to network
    this.network.emitShoot(
      muzzlePos,
      this.raycaster.ray.direction,
      hitPoint,
      targetId
    );
  }

  initUI() {
    const playBtn = document.getElementById('play-button');
    const blocker = document.getElementById('blocker');

    const startAction = () => {
      this.controls.lock();
    };

    if (playBtn) playBtn.addEventListener('click', startAction);
    if (blocker) blocker.addEventListener('click', (e) => {
      if (e.target === blocker) startAction();
    });
  }

  animate() {
    requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.1);

    // Update controls & local physics
    this.controls.update(delta);

    // Update viewmodel weapon recoil recovery
    if (this.recoilOffset > 0) {
      this.recoilOffset = Math.max(0, this.recoilOffset - delta * 0.9);
    }
    this.weaponGroup.position.set(
      this.baseWeaponPos.x,
      this.baseWeaponPos.y,
      this.baseWeaponPos.z + this.recoilOffset
    );

    // Update multiplayer network state
    this.network.update(delta);

    // Update FX
    this.fxManager.update(delta);

    // Render frame
    this.renderer.render(this.scene, this.camera);
  }
}

// Start application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  window.gameApp = new GameApp();
});
