// client/js/world.js
// Handles 3D arena generation, procedural textures, lighting, and collision bounding boxes.

class GameWorld {
  constructor(scene) {
    this.scene = scene;
    this.obstacles = []; // Array of THREE.Box3 for AABB collision detection
    this.collidableMeshes = [];

    this.initEnvironment();
    this.createArena();
  }

  initEnvironment() {
    // Atmospheric exponential fog
    this.scene.fog = new THREE.FogExp2(0x0d0f18, 0.012);

    // Soft ambient lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    // Directional sunlight with shadows
    const sunLight = new THREE.DirectionalLight(0xdbeafe, 1.0);
    sunLight.position.set(40, 60, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 200;
    const d = 60;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    this.scene.add(sunLight);

    // Accent PointLights around the arena
    const pointLights = [
      { color: 0x00f0ff, pos: [0, 8, 0], intensity: 2 },
      { color: 0xff0055, pos: [-30, 6, -30], intensity: 1.5 },
      { color: 0x00ff88, pos: [30, 6, 30], intensity: 1.5 }
    ];

    pointLights.forEach(pl => {
      const light = new THREE.PointLight(pl.color, pl.intensity, 40);
      light.position.set(...pl.pos);
      this.scene.add(light);
    });
  }

  // Generates a procedural high-tech grid floor canvas texture
  createGridTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Dark slate background
    ctx.fillStyle = '#111420';
    ctx.fillRect(0, 0, 512, 512);

    // Outer grid lines
    ctx.strokeStyle = '#1e2438';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 512, 512);

    // Sub-grid lines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 2;
    const step = 64;
    for (let i = step; i < 512; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }

    // Corner tech markers
    ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.fillRect(10, 10, 8, 8);
    ctx.fillRect(512 - 18, 10, 8, 8);
    ctx.fillRect(10, 512 - 18, 8, 8);
    ctx.fillRect(512 - 18, 512 - 18, 8, 8);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(20, 20);
    return texture;
  }

  createArena() {
    // 1. Ground Floor (120 x 120 units)
    const floorGeo = new THREE.PlaneGeometry(120, 120);
    const floorMat = new THREE.MeshStandardMaterial({
      map: this.createGridTexture(),
      roughness: 0.6,
      metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // 2. Perimeter Boundary Walls
    const wallHeight = 12;
    const arenaSize = 100;
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x1a1f33,
      roughness: 0.8,
      metalness: 0.3
    });

    const wallConfigs = [
      { size: [arenaSize, wallHeight, 2], pos: [0, wallHeight / 2, -arenaSize / 2] },
      { size: [arenaSize, wallHeight, 2], pos: [0, wallHeight / 2, arenaSize / 2] },
      { size: [2, wallHeight, arenaSize], pos: [-arenaSize / 2, wallHeight / 2, 0] },
      { size: [2, wallHeight, arenaSize], pos: [arenaSize / 2, wallHeight / 2, 0] }
    ];

    wallConfigs.forEach(wc => {
      const wallGeo = new THREE.BoxGeometry(...wc.size);
      const wallMesh = new THREE.Mesh(wallGeo, wallMat);
      wallMesh.position.set(...wc.pos);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      this.scene.add(wallMesh);
      this.addObstacle(wallMesh);
    });

    // 3. Central Elevated Platform
    const centerPlatformGeo = new THREE.BoxGeometry(24, 2, 24);
    const centerPlatformMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.5,
      metalness: 0.4
    });
    const centerPlatform = new THREE.Mesh(centerPlatformGeo, centerPlatformMat);
    centerPlatform.position.set(0, 1, 0);
    centerPlatform.receiveShadow = true;
    centerPlatform.castShadow = true;
    this.scene.add(centerPlatform);
    this.addObstacle(centerPlatform);

    // Glowing Center Beacon
    const beaconGeo = new THREE.CylinderGeometry(1.2, 1.2, 8, 16);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.8,
      roughness: 0.2
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, 6, 0);
    this.scene.add(beacon);
    this.addObstacle(beacon);

    // 4. Tactical Cover Objects, Crates & Ramps
    const crateMat1 = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 }); // Orange Crate
    const crateMat2 = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5 }); // Blue Crate
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.9 }); // Concrete barrier

    const structures = [
      // Concrete barriers around center
      { size: [8, 3, 1.5], pos: [-8, 1.5, -8], rotY: 0.4, mat: concreteMat },
      { size: [8, 3, 1.5], pos: [8, 1.5, 8], rotY: 0.4, mat: concreteMat },
      { size: [8, 3, 1.5], pos: [-8, 1.5, 8], rotY: -0.4, mat: concreteMat },
      { size: [8, 3, 1.5], pos: [8, 1.5, -8], rotY: -0.4, mat: concreteMat },

      // Stacked Shipping Containers / High Cover
      { size: [12, 5, 5], pos: [-24, 2.5, -16], rotY: 0, mat: crateMat2 },
      { size: [5, 5, 12], pos: [24, 2.5, -16], rotY: 0, mat: crateMat1 },
      { size: [12, 5, 5], pos: [24, 2.5, 20], rotY: 0, mat: crateMat2 },
      { size: [5, 5, 12], pos: [-24, 2.5, 20], rotY: 0, mat: crateMat1 },

      // Corner defense blocks
      { size: [6, 4, 6], pos: [-36, 2, -36], rotY: 0, mat: concreteMat },
      { size: [6, 4, 6], pos: [36, 2, 36], rotY: 0, mat: concreteMat },
      { size: [6, 4, 6], pos: [-36, 2, 36], rotY: 0, mat: concreteMat },
      { size: [6, 4, 6], pos: [36, 2, -36], rotY: 0, mat: concreteMat }
    ];

    structures.forEach(st => {
      const geo = new THREE.BoxGeometry(...st.size);
      const mesh = new THREE.Mesh(geo, st.mat);
      mesh.position.set(...st.pos);
      if (st.rotY) mesh.rotation.y = st.rotY;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.addObstacle(mesh);
    });
  }

  addObstacle(mesh) {
    this.collidableMeshes.push(mesh);
    const box = new THREE.Box3().setFromObject(mesh);
    this.obstacles.push(box);
  }
}
