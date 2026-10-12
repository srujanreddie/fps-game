// client/js/network.js
// Socket.io real-time multiplayer synchronization manager.

class NetworkManager {
  constructor(scene, controls, fxManager) {
    this.scene = scene;
    this.controls = controls;
    this.fxManager = fxManager;

    this.socket = io();
    this.selfId = null;
    this.remotePlayers = new Map();

    // Stats
    this.kills = 0;
    this.deaths = 0;

    // Movement emission throttler (~30 updates/sec)
    this.lastEmitTime = 0;
    this.emitInterval = 1000 / 30;

    this.initSocketEvents();
  }

  initSocketEvents() {
    // 1. Initial Self & World State
    this.socket.on('initSelf', (data) => {
      this.selfId = data.selfId;
      console.log(`[Network] Connected as ${data.playerData.name} (${this.selfId})`);

      // Spawn local player at assigned coordinate
      this.controls.setPosition(data.playerData.x, data.playerData.y, data.playerData.z);
      this.updateHealthHUD(data.playerData.health);

      // Create meshes for already connected players
      for (const id in data.players) {
        if (id !== this.selfId) {
          const pData = data.players[id];
          const remotePlayer = new RemotePlayer(this.scene, pData);
          this.remotePlayers.set(id, remotePlayer);
        }
      }

      this.updatePlayerCount();
    });

    // 2. Another Player Joined
    this.socket.on('playerJoined', (pData) => {
      if (pData.id === this.selfId) return;
      console.log(`[Network] Player joined: ${pData.name}`);

      const remotePlayer = new RemotePlayer(this.scene, pData);
      this.remotePlayers.set(pData.id, remotePlayer);
      this.updatePlayerCount();
      this.addKillfeedNotice(`<span class="killer">${pData.name}</span> connected.`);
    });

    // 3. Periodic Server Position Sync
    this.socket.on('syncState', (playersState) => {
      for (const id in playersState) {
        if (id === this.selfId) continue;

        const pData = playersState[id];
        let remotePlayer = this.remotePlayers.get(id);

        if (!remotePlayer) {
          // If player wasn't registered yet, create
          remotePlayer = new RemotePlayer(this.scene, pData);
          this.remotePlayers.set(id, remotePlayer);
        }

        remotePlayer.setTargetTransform(pData.x, pData.y, pData.z, pData.rotationY);
        if (pData.health !== undefined) {
          remotePlayer.setHealth(pData.health);
        }
      }
      this.updatePlayerCount();
    });

    // 4. Remote Player Weapon Fire Visuals
    this.socket.on('remotePlayerShoot', (data) => {
      if (this.fxManager) {
        this.fxManager.spawnTracer(data.origin, data.hitPoint);
      }
    });

    // 5. Damage Registered
    this.socket.on('playerDamaged', (data) => {
      // If local player took damage
      if (data.victimId === this.selfId) {
        this.updateHealthHUD(data.health);
        if (this.fxManager) this.fxManager.flashDamageVignette();
      }

      // If local player scored a hit
      if (data.shooterId === this.selfId) {
        if (this.fxManager) this.fxManager.triggerHitmarker();
      }

      // Update remote player nametag healthbar
      const remotePlayer = this.remotePlayers.get(data.victimId);
      if (remotePlayer) {
        remotePlayer.setHealth(data.health);
      }
    });

    // 6. Elimination Notice
    this.socket.on('playerKilled', (data) => {
      this.addKillfeedNotice(
        `<span class="killer">${data.killerName}</span> vaporized <span class="victim">${data.victimName}</span>`
      );

      if (data.killerId === this.selfId) {
        this.kills += 1;
        document.getElementById('kills-display').innerText = this.kills;
      }

      if (data.victimId === this.selfId) {
        this.deaths += 1;
        document.getElementById('deaths-display').innerText = this.deaths;
      }
    });

    // 7. Player Respawn
    this.socket.on('playerRespawn', (data) => {
      if (data.id === this.selfId) {
        this.controls.setPosition(data.x, data.y, data.z);
        this.updateHealthHUD(data.health);
      } else {
        const remotePlayer = this.remotePlayers.get(data.id);
        if (remotePlayer) {
          remotePlayer.setTargetTransform(data.x, data.y, data.z);
          remotePlayer.setHealth(data.health);
        }
      }
    });

    // 8. Player Disconnected
    this.socket.on('playerDisconnected', (id) => {
      const remotePlayer = this.remotePlayers.get(id);
      if (remotePlayer) {
        this.addKillfeedNotice(`<span class="victim">${remotePlayer.name}</span> disconnected.`);
        remotePlayer.destroy();
        this.remotePlayers.delete(id);
        this.updatePlayerCount();
      }
    });
  }

  emitMovement() {
    if (!this.selfId || !this.controls.isLocked) return;

    const now = performance.now();
    if (now - this.lastEmitTime < this.emitInterval) return;
    this.lastEmitTime = now;

    this.socket.emit('playerMovement', {
      x: this.controls.position.x,
      y: this.controls.position.y,
      z: this.controls.position.z,
      rotationY: this.controls.yaw,
      cameraPitch: this.controls.pitch
    });
  }

  emitShoot(origin, direction, hitPoint, targetId) {
    if (!this.selfId) return;

    this.socket.emit('playerShoot', {
      origin: { x: origin.x, y: origin.y, z: origin.z },
      direction: { x: direction.x, y: direction.y, z: direction.z },
      hitPoint: { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z },
      targetId: targetId || null
    });
  }

  update(delta) {
    // Update and interpolate all remote player avatars
    this.remotePlayers.forEach((player) => {
      player.update(delta);
    });

    // Sync local player position to server
    this.emitMovement();
  }

  updatePlayerCount() {
    const count = this.remotePlayers.size + 1;
    const countEl = document.getElementById('player-count');
    if (countEl) {
      countEl.innerText = `● ONLINE - ${count} ${count === 1 ? 'PLAYER' : 'PLAYERS'}`;
    }
  }

  updateHealthHUD(health) {
    const valEl = document.getElementById('health-value');
    const fillEl = document.getElementById('health-fill');
    if (valEl) valEl.innerText = Math.max(0, health);
    if (fillEl) {
      const pct = Math.max(0, Math.min(100, health));
      fillEl.style.width = `${pct}%`;
      if (pct < 30) {
        fillEl.style.background = 'linear-gradient(90deg, #ff0055, #ff5500)';
      } else {
        fillEl.style.background = 'linear-gradient(90deg, #00f0ff, #00ff88)';
      }
    }
  }

  addKillfeedNotice(htmlContent) {
    const feed = document.getElementById('killfeed');
    if (!feed) return;

    const item = document.createElement('div');
    item.className = 'killfeed-item';
    item.innerHTML = htmlContent;
    feed.appendChild(item);

    // Fade out and remove after 4.5 seconds
    setTimeout(() => {
      item.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      item.style.opacity = '0';
      item.style.transform = 'translateX(20px)';
      setTimeout(() => item.remove(), 400);
    }, 4500);
  }
}
