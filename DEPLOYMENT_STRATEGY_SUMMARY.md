# iChange Deployment Strategy - Conversation Summary

> **STATUS: APPROVED & PRODUCTION READY ✅**
> Approved by: Sudharsan | Date: April 14, 2026

**Date:** April 14, 2026
**Topic:** Deploying the iChange platform to support 1,200 concurrent users for free.

---

## 1. Web App Server Status
In this session, we started the local development server to test the frontend and backend.
- The web app is currently running locally.
- Access it via your browser at: http://localhost:5173

## 2. CI/CD & Updating App Post-Deployment
We discussed how application updates are managed post-deployment. Once the initial stack is live, future code updates are synchronized via GitHub. Cloudflare Pages automatically detects new commits, rebuilds, and deploys with zero downtime.

## 3. High-Concurrency Free Tier Deployment Architecture

### Frontend (Static Files)
- **Host:** Cloudflare Pages
- **Benefit:** 100% free, unlimited bandwidth, global CDN. Zero load on backend servers.

### Backend (Node.js + WebSockets + Mediasoup)
- **Host:** Oracle Cloud Always Free Tier — Ampere A1 Compute Instance
- **Specs:** 24GB RAM, 4 ARM CPU Cores, 200GB Block Storage, 10 TB outbound bandwidth/month
- **Benefit:** The only free-tier provider capable of Mediasoup video-routing at 1,200 concurrent users. PM2 runs the backend across all 4 CPU cores.

### Database & Message Broker (MongoDB & Redis)
- **Host:** Self-hosted Docker containers on Oracle VPS
- **Benefit:** Bypasses MongoDB Atlas's 500 connection limit. Oracle's 24GB RAM handles both natively.

### SSL & Reverse Proxy
- **Tool:** Caddy (auto Let's Encrypt SSL)
- **Note:** DNS must point directly to Oracle IP (grey-cloud on Cloudflare) so Mediasoup UDP is not blocked.

---

## 4. Finalized & Approved Deployment Model ✅

| Component | Service | Cost |
|---|---|---|
| Frontend | Cloudflare Pages | Free |
| HLS Video Delivery | Cloudflare R2 + Stream | ~Free for moderate use |
| Signaling + Chat API | Oracle A1 VM | Free |
| DB | Self-hosted MongoDB on Oracle | Free |
| Redis | Self-hosted on Oracle | Free |

### Key Decision: Live vs. Recorded Video
- **Live sessions (WebRTC)** → Mediasoup on Oracle A1 VM
- **Recorded/VOD playback (HLS)** → Cloudflare R2 + Stream

> **Note:** Cloudflare Stream costs ~$5/month per 1,000 minutes delivered. Suitable for VOD only, not live WebRTC streams.

---

## 5. Pre-Deployment Code Changes Applied ✅

All changes applied on April 14, 2026:

| File | Change |
|---|---|
| `src/routes/session.routes.js` | Removed all debug console.log statements |
| `src/config/db.js` | Admin password moved to ADMIN_PASSWORD env variable |
| `src/config/mediasoup.js` | Fatal startup guard if MEDIASOUP_ANNOUNCED_IP not set in production |
| `backend/production.env.example` | Added ADMIN_EMAIL, ADMIN_PASSWORD fields + better comments |
| `.gitignore` | Now covers **/.env and all nested env files |

---

## 6. Environment Variables to Configure on Oracle Server

```
# apps/backend/.env  (fill these on the Oracle server)
NODE_ENV=production
ADMIN_PASSWORD=<your_strong_password>
ADMIN_EMAIL=sudharsanrj1971@gmail.com
MEDIASOUP_ANNOUNCED_IP=<oracle_public_ip>
MONGODB_URI=mongodb://localhost:27017/ichange
REDIS_URL=redis://localhost:6379
JWT_SECRET=<64+ char random string>
JWT_REFRESH_SECRET=<64+ char random string>
FRONTEND_URL=https://your-cloudflare-pages-domain.com

# Cloudflare Pages - Environment Variables (Dashboard)
VITE_API_URL=https://api.yourdomain.com
VITE_GOOGLE_CLIENT_ID=323801519369-53avmrpuqvmmq73q3emq5phd5886un80.apps.googleusercontent.com
```

---

## 7. Deployment Execution Checklist

**Step 1 — Oracle Cloud**
- [ ] Create Oracle Cloud Always Free account (oracle.com/cloud/free)
- [ ] Launch Ampere A1 instance (4 OCPU, 24GB RAM, Ubuntu 22.04)
- [ ] Open firewall ports: 80, 443, 5000, and 10000-59999 (UDP for WebRTC)

**Step 2 — Server Setup**
- [ ] Install Docker, Node.js 20+, PM2, Caddy
- [ ] Run MongoDB and Redis as Docker containers
- [ ] Copy production.env.example to .env and fill in all values

**Step 3 — Deploy Backend**
- [ ] Push code to GitHub, pull on Oracle server
- [ ] Run: npm run start:scale (via PM2)

**Step 4 — Deploy Frontend**
- [ ] Connect GitHub repo to Cloudflare Pages
- [ ] Set VITE_API_URL and VITE_GOOGLE_CLIENT_ID in Cloudflare Pages env settings
- [ ] Build command: npm run build --workspace=apps/frontend
- [ ] Output directory: apps/frontend/dist

---
*Last updated: April 14, 2026 — Saved per user request.*
