# Cyber-FPS | 3D Multiplayer Browser Shooter

A functional, full-stack prototype of a 3D browser-based multiplayer first-person shooter (FPS) game built with **Three.js**, **HTML5/WebGL**, **Node.js**, **Express**, and **Socket.io**.

---

## 🎮 Features

1. **Client-Side 3D Graphics & Scene (Three.js)**:
   - Dynamic arena with atmospheric fog, directional shadow mapping, and high-tech procedural floor grid.
   - Central elevated platform, concrete barriers, shipping containers, and cover obstacles.
   - First-person viewmodel weapon with plasma rail accents, weapon sway, and procedural recoil kickback.
   - Real-time particle impact bursts and laser bullet tracers.

2. **FPS Controls & Physics**:
   - Hardware mouse capture via the **PointerLock API**.
   - Clamped Euler camera look (Y-axis yaw and X-axis pitch limited to $\pm 85^\circ$ to prevent gimbal inversion).
   - `WASD` tactical movement with `Shift` sprinting and `Space` thruster jumping.
   - Continuous AABB bounding-box collision detection against perimeter walls and cover objects.

3. **Real-Time Multiplayer Synchronization (Socket.io)**:
   - 30Hz server-authoritative state broadcast loop.
   - Smooth interpolation (lerp position and angular lerp rotation) for remote player avatars.
   - Dynamic 3D avatar generation with floating billboard nametags and real-time health bars.
   - Raycast hit detection, damage synchronization, respawning, and a real-time killfeed.

4. **Cyberpunk In-Game HUD**:
   - Precision center-screen reticle crosshair.
   - Animated red hitmarker upon damaging an opponent.
   - Dynamic vitality/shield health bar and ammo counter.
   - Live player count and connection status indicator.
   - Click-to-play start modal with full control reference.

---

## 📁 Project Structure

```
browser-fps-multiplayer/
├── package.json               # Project manifest & npm scripts
├── server/
│   └── index.js              # Express static server & Socket.io multiplayer state
├── client/
│   ├── index.html            # Main HTML entry & HUD overlay
│   ├── css/
│   │   └── style.css         # Dark cyberpunk HUD, crosshair, and modal styling
│   └── js/
│       ├── world.js          # 3D map environment, lighting & collision bounds
│       ├── player.js         # Remote player 3D avatars & floating nametags
│       ├── controls.js       # PointerLock controls, Euler camera & physics
│       ├── network.js        # Socket.io synchronization & event dispatching
│       └── main.js           # Three.js loop, viewmodel weapon & raycast shooting
└── README.md
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18+ or v24+ recommended)
- **npm** (included with Node.js)

### 2. Installation
Open your terminal in the project directory:
```bash
cd "C:\Users\SRUJAN REDDY\.gemini\antigravity\scratch\browser-fps-multiplayer"
npm install
```

### 3. Start the Server
```bash
npm start
```
The server will start on port `3000`:
```
🚀 FPS Multiplayer Server running on port 3000
👉 Access game locally: http://localhost:3000
```

### 4. Play and Test Multiplayer
1. Open your browser and navigate to: **`http://localhost:3000`**
2. Click **DEPLOY TO BATTLEFIELD** to lock your mouse cursor and start playing.
3. **To test multiplayer**: Open a second browser window (or Incognito tab) side-by-side at `http://localhost:3000`. You will see each player's 3D avatar moving, aiming, jumping, and shooting in real time with synchronized health bars and killfeed notices!

---

## 🕹️ Controls Reference

| Control | Action |
| :--- | :--- |
| **W, A, S, D** | Move forward, left, backward, right |
| **Mouse** | Aim & Look (360° yaw, clamped pitch) |
| **Left Click** | Fire Plasma Weapon (Raycast shooting) |
| **Space** | Jump / Thruster jump |
| **Shift** | Sprint Acceleration |
| **Esc** | Pause / Release Pointer Lock |
