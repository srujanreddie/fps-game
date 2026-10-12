const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Serve static frontend assets from /client
app.use(express.static(path.join(__dirname, '../client')));

// Predefined vibrant colors for player skins
const PLAYER_COLORS = [
  '#00f5d4', // Cyan / Neon Aqua
  '#7b2cbf', // Cyber Purple
  '#ff0054', // Neon Pink
  '#38b000', // Acid Green
  '#ff9e00', // Solar Amber
  '#0077b6', // Deep Cyan
  '#f72585', // Magenta
  '#4361ee'  // Electric Blue
];

// Spawning points across the arena map
const SPAWN_POINTS = [
  { x: 0, y: 1.8, z: 0 },
  { x: -25, y: 1.8, z: -25 },
  { x: 25, y: 1.8, z: 25 },
  { x: -25, y: 1.8, z: 25 },
  { x: 25, y: 1.8, z: -25 },
  { x: 0, y: 1.8, z: -35 },
  { x: 0, y: 1.8, z: 35 },
  { x: -35, y: 1.8, z: 0 },
  { x: 35, y: 1.8, z: 0 }
];

function getRandomSpawn() {
  const spawn = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
  return {
    x: spawn.x + (Math.random() * 4 - 2),
    y: spawn.y,
    z: spawn.z + (Math.random() * 4 - 2)
  };
}

// In-memory state tracking for active players
const players = {};

io.on('connection', (socket) => {
  const spawn = getRandomSpawn();
  const playerColor = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
  const shortId = socket.id.slice(0, 4).toUpperCase();
  const playerName = `Agent_${shortId}`;

  console.log(`[Connect] Player connected: ${socket.id} (${playerName})`);

  // Initialize player data on server
  players[socket.id] = {
    id: socket.id,
    name: playerName,
    color: playerColor,
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    rotationY: 0,
    cameraPitch: 0,
    health: 100,
    maxHealth: 100,
    kills: 0,
    deaths: 0,
    lastUpdate: Date.now()
  };

  // 1. Send all existing players and self-initialization to the newly joined player
  socket.emit('initSelf', {
    selfId: socket.id,
    playerData: players[socket.id],
    players: players
  });

  // 2. Notify all other players about the new player
  socket.broadcast.emit('playerJoined', players[socket.id]);

  // Handle continuous movement & orientation sync from client
  socket.on('playerMovement', (data) => {
    if (!players[socket.id]) return;

    const p = players[socket.id];
    // Basic server-side sanitization / bounds check
    p.x = typeof data.x === 'number' ? data.x : p.x;
    p.y = typeof data.y === 'number' ? data.y : p.y;
    p.z = typeof data.z === 'number' ? data.z : p.z;
    p.rotationY = typeof data.rotationY === 'number' ? data.rotationY : p.rotationY;
    p.cameraPitch = typeof data.cameraPitch === 'number' ? data.cameraPitch : p.cameraPitch;
    p.lastUpdate = Date.now();
  });

  // Handle weapon firing & tracer sync
  socket.on('playerShoot', (shotData) => {
    if (!players[socket.id]) return;

    // Broadcast visual bullet tracer to other players
    socket.broadcast.emit('remotePlayerShoot', {
      shooterId: socket.id,
      origin: shotData.origin,
      direction: shotData.direction,
      hitPoint: shotData.hitPoint
    });

    // Process hit registration if client reported a target hit
    if (shotData.targetId && players[shotData.targetId]) {
      const victim = players[shotData.targetId];
      const shooter = players[socket.id];

      // Damage calculation (e.g. 25 damage per hit)
      const damage = 25;
      victim.health = Math.max(0, victim.health - damage);

      if (victim.health <= 0) {
        // Player eliminated
        shooter.kills += 1;
        victim.deaths += 1;

        io.emit('playerKilled', {
          killerId: shooter.id,
          killerName: shooter.name,
          victimId: victim.id,
          victimName: victim.name
        });

        // Respawn victim after delay
        setTimeout(() => {
          if (players[victim.id]) {
            const newSpawn = getRandomSpawn();
            victim.health = 100;
            victim.x = newSpawn.x;
            victim.y = newSpawn.y;
            victim.z = newSpawn.z;

            io.emit('playerRespawn', {
              id: victim.id,
              x: victim.x,
              y: victim.y,
              z: victim.z,
              health: victim.health
            });
          }
        }, 2000);
      } else {
        // Player damaged
        io.emit('playerDamaged', {
          victimId: victim.id,
          shooterId: shooter.id,
          damage: damage,
          health: victim.health
        });
      }
    }
  });

  // Handle player disconnect
  socket.on('disconnect', () => {
    console.log(`[Disconnect] Player disconnected: ${socket.id}`);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

// Periodic server-side state broadcast loop (30Hz tick rate)
// Syncs positions to all connected clients for smooth interpolation
const TICK_RATE = 30;
setInterval(() => {
  if (Object.keys(players).length > 0) {
    io.emit('syncState', players);
  }
}, 1000 / TICK_RATE);

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 FPS Multiplayer Server running on port ${PORT}`);
  console.log(`👉 Access game locally: http://localhost:${PORT}`);
  console.log(`===============================================`);
});
