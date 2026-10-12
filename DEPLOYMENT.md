# Deployment Guide: Play with Friends Online

## 🌐 1. Instant Play (Active Right Now!)

A live, secure public tunnel powered by Cloudflare Edge is currently broadcasting your local server:

- **Public Multiplayer URL**: **`https://underwear-temple-ambien-fine.trycloudflare.com`**
- **Requirements**: None! No downloads or plugins needed.
- **How to join**: Send the URL to your friends. Anyone opening the link will instantly connect to the same 3D arena match with real-time movement, jumping, shooting, and synchronized health bars.

*(This tunnel stays active as long as your local server and `cloudflared` are running).*

---

## ☁️ 2. Permanent 24/7 Cloud Hosting (Free)

If you want the game to stay online 24/7 even when your computer is turned off, you can deploy it to a free cloud host that supports persistent Node.js WebSockets.

### Option A: Render (Recommended - Free Web Service)
1. Create a free account at [render.com](https://render.com).
2. Push this project folder to your GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of 3D multiplayer FPS"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```
3. In Render, click **New +** -> **Web Service**.
4. Connect your GitHub repository.
5. Set the following settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server/index.js`
   - **Plan**: `Free`
6. Click **Deploy Web Service**. Render will generate a permanent URL (e.g. `https://my-fps-game.onrender.com`).

---

### Option B: Railway (One-Click Deploy)
1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. Click **New Project** -> **Deploy from GitHub repo**.
3. Select this repository. Railway automatically detects Node.js and starts the server with WebSockets enabled.
4. Go to **Settings** -> **Generate Domain** to get your public permanent URL.
