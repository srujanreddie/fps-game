// client/js/player.js
// Factory and manager for remote player 3D avatars, floating billboard healthbars, and state interpolation.

class RemotePlayer {
  constructor(scene, playerData) {
    this.scene = scene;
    this.id = playerData.id;
    this.name = playerData.name || 'Agent';
    this.color = playerData.color || '#00f0ff';
    this.health = playerData.health !== undefined ? playerData.health : 100;
    this.maxHealth = 100;

    // Target transforms for network interpolation
    this.currentPosition = new THREE.Vector3(playerData.x, playerData.y, playerData.z);
    this.targetPosition = new THREE.Vector3(playerData.x, playerData.y, playerData.z);
    this.currentRotationY = playerData.rotationY || 0;
    this.targetRotationY = playerData.rotationY || 0;

    this.rootGroup = new THREE.Group();
    this.rootGroup.position.copy(this.currentPosition);
    this.rootGroup.rotation.y = this.currentRotationY;

    this.createAvatarMesh();
    this.createFloatingNametag();

    this.scene.add(this.rootGroup);
  }

  createAvatarMesh() {
    const skinMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.color),
      roughness: 0.4,
      metalness: 0.3
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.6,
      metalness: 0.5
    });

    // 1. Torso
    const torsoGeo = new THREE.CylinderGeometry(0.45, 0.4, 1.2, 16);
    const torso = new THREE.Mesh(torsoGeo, skinMat);
    torso.position.y = 0.6;
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.rootGroup.add(torso);

    // 2. Head
    const headGeo = new THREE.SphereGeometry(0.32, 16, 16);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.45;
    head.castShadow = true;
    this.rootGroup.add(head);

    // 3. Tactical Visor (facing positive Z)
    const visorGeo = new THREE.BoxGeometry(0.42, 0.15, 0.2);
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.6,
      roughness: 0.1
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.45, 0.22);
    this.rootGroup.add(visor);

    // 4. Weapon Mesh in Right Hand
    const weaponGeo = new THREE.BoxGeometry(0.12, 0.16, 0.7);
    const weapon = new THREE.Mesh(weaponGeo, darkMat);
    weapon.position.set(0.4, 0.8, 0.4);
    weapon.castShadow = true;
    this.rootGroup.add(weapon);

    // Attach reference back to remote player for raycast hit detection
    this.rootGroup.userData = { isPlayer: true, playerId: this.id };
    torso.userData = { isPlayer: true, playerId: this.id };
    head.userData = { isPlayer: true, playerId: this.id };
  }

  createFloatingNametag() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = 80;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;

    const spriteMat = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false
    });

    this.sprite = new THREE.Sprite(spriteMat);
    this.sprite.position.set(0, 2.2, 0);
    this.sprite.scale.set(2.4, 0.75, 1);
    this.rootGroup.add(this.sprite);

    this.updateNametagVisual();
  }

  updateNametagVisual() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, 256, 80);

    // Nametag background pill
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.beginPath();
    ctx.roundRect(16, 8, 224, 64, 10);
    ctx.fill();

    // Player Name text
    ctx.font = 'bold 22px Segoe UI, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(this.name, 128, 34);

    // Health Bar container
    const barWidth = 190;
    const barHeight = 10;
    const barX = (256 - barWidth) / 2;
    const barY = 46;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Health Bar fill
    const healthPercent = Math.max(0, Math.min(1, this.health / this.maxHealth));
    ctx.fillStyle = healthPercent > 0.4 ? '#00ff88' : '#ff0055';
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

    this.texture.needsUpdate = true;
  }

  setTargetTransform(x, y, z, rotationY) {
    this.targetPosition.set(x, y, z);
    if (typeof rotationY === 'number') {
      this.targetRotationY = rotationY;
    }
  }

  setHealth(health) {
    this.health = health;
    this.updateNametagVisual();
  }

  update(delta) {
    // Smooth lerp position (18 factor for responsive, non-jittery interpolation)
    const lerpRate = Math.min(1, delta * 18);
    this.currentPosition.lerp(this.targetPosition, lerpRate);
    this.rootGroup.position.copy(this.currentPosition);

    // Angular lerp for Y-axis rotation
    let diff = this.targetRotationY - this.currentRotationY;
    // Normalize angle difference to [-PI, PI]
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.currentRotationY += diff * lerpRate;
    this.rootGroup.rotation.y = this.currentRotationY;
  }

  destroy() {
    this.scene.remove(this.rootGroup);
    if (this.texture) this.texture.dispose();
  }
}
