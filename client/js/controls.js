// client/js/controls.js
// Handles PointerLock API, mouse look, WASD physics movement, jumping, and collision detection.

class FPSControls {
  constructor(camera, domElement, world) {
    this.camera = camera;
    this.domElement = domElement;
    this.world = world;

    this.isLocked = false;

    // Movement state
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false
    };

    // Camera angles (Euler angles in radians)
    this.yaw = 0;   // Horizontal rotation around world Y
    this.pitch = 0; // Vertical rotation around camera X

    // Player physical representation
    this.position = new THREE.Vector3(0, 1.8, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.playerHeight = 1.8;
    this.playerRadius = 0.5;

    // Movement configuration
    this.walkSpeed = 14.0;
    this.sprintSpeed = 22.0;
    this.jumpForce = 11.5;
    this.gravity = -28.0;
    this.canJump = false;

    // View bobbing effect
    this.bobTimer = 0;

    this.initListeners();
  }

  initListeners() {
    // 1. Pointer Lock Event Handlers
    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.domElement;
      const blocker = document.getElementById('blocker');
      if (this.isLocked) {
        blocker.classList.add('hidden');
      } else {
        blocker.classList.remove('hidden');
      }
    });

    document.addEventListener('pointerlockerror', (e) => {
      console.warn('Pointer lock error:', e);
    });

    // 2. Mouse Look Listener
    document.addEventListener('mousemove', (event) => {
      if (!this.isLocked) return;

      const sensitivity = 0.0022;
      const movementX = event.movementX || 0;
      const movementY = event.movementY || 0;

      // Update yaw (turn left/right)
      this.yaw -= movementX * sensitivity;

      // Update pitch (look up/down), clamped to [-85°, 85°]
      this.pitch -= movementY * sensitivity;
      const maxPitch = Math.PI / 2 - 0.05;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

      this.updateCameraRotation();
    });

    // 3. Keyboard Listeners
    const onKeyChange = (keyCode, isPressed) => {
      switch (keyCode) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = isPressed;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = isPressed;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = isPressed;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = isPressed;
          break;
        case 'Space':
          this.keys.jump = isPressed;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.sprint = isPressed;
          break;
      }
    };

    window.addEventListener('keydown', (e) => onKeyChange(e.code, true));
    window.addEventListener('keyup', (e) => onKeyChange(e.code, false));
  }

  lock() {
    this.domElement.requestPointerLock();
  }

  unlock() {
    document.exitPointerLock();
  }

  updateCameraRotation() {
    // Combine yaw and pitch in Euler order YXZ
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.x = this.pitch;
    euler.y = this.yaw;
    this.camera.quaternion.setFromEuler(euler);
  }

  // Get current direction vectors for movement calculation
  getForwardVector() {
    const vector = new THREE.Vector3(0, 0, -1);
    vector.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    return vector;
  }

  getSideVector() {
    const vector = new THREE.Vector3(1, 0, 0);
    vector.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    return vector;
  }

  update(delta) {
    if (!this.isLocked) return;

    // Determine current speed (walking or sprinting)
    const currentSpeed = this.keys.sprint ? this.sprintSpeed : this.walkSpeed;

    // Movement intent direction
    const moveDir = new THREE.Vector3();
    const forward = this.getForwardVector();
    const side = this.getSideVector();

    if (this.keys.forward) moveDir.add(forward);
    if (this.keys.backward) moveDir.sub(forward);
    if (this.keys.right) moveDir.add(side);
    if (this.keys.left) moveDir.sub(side);

    // Normalize movement direction to avoid diagonal speed boost
    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      this.bobTimer += delta * (this.keys.sprint ? 14 : 9);
    }

    // Apply horizontal acceleration & damping
    const accel = 60.0;
    const damping = 12.0;

    this.velocity.x += moveDir.x * accel * delta;
    this.velocity.z += moveDir.z * accel * delta;

    this.velocity.x -= this.velocity.x * damping * delta;
    this.velocity.z -= this.velocity.z * damping * delta;

    // Apply gravity
    this.velocity.y += this.gravity * delta;

    // Handle jump
    if (this.keys.jump && this.canJump) {
      this.velocity.y = this.jumpForce;
      this.canJump = false;
    }

    // Step physics & AABB collision resolution
    this.resolveCollisions(delta);

    // Update camera position with subtle head bobbing
    const bobOffset = Math.sin(this.bobTimer) * 0.05 * (moveDir.lengthSq() > 0 && this.canJump ? 1 : 0);
    this.camera.position.set(
      this.position.x,
      this.position.y + bobOffset,
      this.position.z
    );
  }

  resolveCollisions(delta) {
    const obstacles = this.world.obstacles;
    const r = this.playerRadius;
    const h = this.playerHeight;

    // 1. Move along X and resolve X collisions
    const newX = this.position.x + this.velocity.x * delta;
    let collidedX = false;
    for (const box of obstacles) {
      if (
        newX + r > box.min.x && newX - r < box.max.x &&
        this.position.z + r > box.min.z && this.position.z - r < box.max.z &&
        this.position.y - h < box.max.y && this.position.y > box.min.y
      ) {
        collidedX = true;
        this.velocity.x = 0;
        break;
      }
    }
    if (!collidedX) this.position.x = newX;

    // 2. Move along Z and resolve Z collisions
    const newZ = this.position.z + this.velocity.z * delta;
    let collidedZ = false;
    for (const box of obstacles) {
      if (
        this.position.x + r > box.min.x && this.position.x - r < box.max.x &&
        newZ + r > box.min.z && newZ - r < box.max.z &&
        this.position.y - h < box.max.y && this.position.y > box.min.y
      ) {
        collidedZ = true;
        this.velocity.z = 0;
        break;
      }
    }
    if (!collidedZ) this.position.z = newZ;

    // 3. Move along Y (vertical) and test ground/obstacle landings
    const newY = this.position.y + this.velocity.y * delta;
    let grounded = false;

    // Check collision with obstacles (landing on crates/platforms)
    for (const box of obstacles) {
      if (
        this.position.x + r > box.min.x && this.position.x - r < box.max.x &&
        this.position.z + r > box.min.z && this.position.z - r < box.max.z
      ) {
        // Landing on top of an obstacle
        if (this.position.y >= box.max.y + h - 0.2 && newY <= box.max.y + h) {
          this.position.y = box.max.y + h;
          this.velocity.y = 0;
          this.canJump = true;
          grounded = true;
          break;
        }
        // Hitting ceiling/bottom of an obstacle
        if (this.position.y <= box.min.y && newY + 0.1 >= box.min.y) {
          this.position.y = box.min.y - 0.05;
          this.velocity.y = 0;
          break;
        }
      }
    }

    // Ground floor check
    if (!grounded) {
      if (newY <= this.playerHeight) {
        this.position.y = this.playerHeight;
        this.velocity.y = 0;
        this.canJump = true;
      } else {
        this.position.y = newY;
        this.canJump = false;
      }
    }
  }

  setPosition(x, y, z) {
    this.position.set(x, y, z);
    this.camera.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
  }
}
