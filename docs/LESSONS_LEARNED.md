# Lessons Learned — Production Deployment

This document captures the key lessons learned from deploying a Node.js backend with a React + Vite frontend behind Nginx, including CI/CD via GitHub Actions.

I'm trying to be transparent about unforced errors during this project build so that others can get better faster. These lessons were summarized by LLM from my larger episodes of troubleshooting. 

---

## 0. Rate limiting at the application layer when the API first deployed
- Server would work fine for minutes to hours but eventually all attempts would reach "Too many requests"
- A key difference between the prod and dev environments is access through nginx reverse proxy to the API
- Express saw these as repeated requests from the same IP, so the fix was to add:
- app.set('trust proxy', 1);
- Happened again after I realized my rapidly-scaffolded frontend was making too many calls to the database too fast
- The rate limit bucket of 100 requests in 10 minutes could be exceeded readily if I was adding many stickers on one or two accounts simultaneously on my local machine
- You have to consider rate limiting holistically: behind the proxy, and how hard you're hammering the API from the frontend.

## 1. Never Serve Web Content from `/root`

- Nginx runs as `www-data` and cannot traverse `/root` by default.
- Serving static files from `/root` causes opaque 500 errors.
- Relaxing `/root` permissions is a security anti-pattern.

**Best practice**
- Repos may live anywhere
- Static assets must be served from:
  - `/var/www/<site>`
  - `/apps/<site>`
- Sync build artifacts to a public web root during deploy

---

## 2. Separate Build-Time and Runtime Dependencies

Frontend builds and backend runtime have different requirements.

- Frontend builds require devDependencies (e.g. Vite)
- Backend runtime should exclude devDependencies

**Correct pattern**
```bash
# Backend
npm ci --omit=dev

# Frontend
npm ci --include=dev
npm run build
```

Never rely on implicit environment behavior.

---

## 3. Nginx Must Have Single Responsibility per Path

Problems occurred when `/` was:
- proxied to Node **and**
- treated as the SPA entry point

**Best practice**
- Nginx serves the SPA
- Nginx proxies APIs only

Canonical routing model:
```
/            → React SPA
/assets/     → static, long-cache
/api/v1/     → Node backend
```

---

## 4. Only One `location /` Block per Server

- Duplicate `location /` blocks cause Nginx to fail startup
- When Nginx fails, the site times out entirely

**Correct SPA fallback**
```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

---

## 5. Always Test Nginx Before Reloading

```bash
nginx -t && systemctl reload nginx
```

If `nginx -t` fails:
- Nginx will not reload
- The service may stop listening entirely

---

## 6. Keep Deployment Targets Immutable

The server drifted from Git state:
- Modified lockfiles
- Inconsistent installs
- Non-reproducible behavior

**Best practice**
```bash
git reset --hard origin/main
git clean -fd
```

Every deploy should be reproducible from Git alone.

---

## 7. Publish Static Build Artifacts Explicitly

Correct production model:
- Build in repo directory
- Publish build output to web root
- Serve only published artifacts

This improves:
- Security
- Debuggability
- Deployment reliability

---

## 8. Debug Bottom-Up, Not Top-Down

The root causes were:
- Nginx not running
- Filesystem permissions
- Invalid config

**Correct debug order**
1. Is the service running?
2. Is it listening on the port?
3. Can it read the files?
4. Is routing correct?

---

## Core Mental Model

> **Build where it’s convenient. Serve from where it’s safe.**

- CI builds
- Nginx serves static files
- Node serves APIs
- Each layer does exactly one job

---

## One Key Takeaway

> **Static frontend = filesystem problem**  
> **API backend = process problem**

Treat them separately to keep production stable and boring.
