# Production Deployment Checklist
Node.js API + React/Vite SPA + Nginx

This checklist was LLM generated after fighting through my first production deployment of both the front and backend.

---

## 1. Repository Hygiene

- [ ] Server working tree is clean
```bash
git reset --hard origin/main
git clean -fd
```
- [ ] Lockfiles committed and authoritative
- [ ] No build artifacts committed
- [ ] Node/npm versions known

---

## 2. Dependency Installation

### Backend (Runtime Only)
- [ ] Install production dependencies only
```bash
npm ci --omit=dev
```

### Frontend (Build Step)
- [ ] Install devDependencies explicitly
```bash
npm ci --include=dev
```
- [ ] Build succeeds
```bash
npm run build
```
- [ ] Output exists in `client/dist/`

---

## 3. Static Asset Publishing

- [ ] Static assets are **not** served from `/root`
- [ ] Public web root exists
  - `/var/www/<site>` or `/apps/<site>`
- [ ] Build artifacts synced on each deploy
```bash
rsync -a --delete web/dist/ /var/www/<site>/
```
- [ ] Permissions allow Nginx access
```bash
chmod -R a=rX /var/www/<site>
```

---

## 4. Nginx Configuration

### Canonical Layout
```nginx
root /var/www/<site>;
index index.html;

location /assets/ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}

location ^~ /api/v1/ {
  proxy_pass http://127.0.0.1:5050;
}

location / {
  try_files $uri $uri/ /index.html;
}
```

---

## 5. Nginx Safety Checks

- [ ] Config test passes
```bash
nginx -t
```
- [ ] Nginx is running
```bash
systemctl status nginx
```
- [ ] Nginx is listening
```bash
ss -lntp | grep ':443'
```

---

## 6. Backend Process Management

- [ ] Backend bound to `127.0.0.1:<port>`
- [ ] PM2 process running
```bash
pm2 status
```
- [ ] PM2 state saved
```bash
pm2 save
```
- [ ] Logs are clean
```bash
pm2 logs --lines 50
```

---

## 7. Connectivity Verification

### Local (on server)
- [ ] SPA reachable
```bash
curl -Ik https://127.0.0.1/
```
- [ ] API reachable
```bash
curl -I http://127.0.0.1:5050/api/v1/health
```

### External
- [ ] HTTPS reachable
```bash
curl -Ik https://<domain>
```
- [ ] API reachable
```bash
curl -I https://<domain>/api/v1/health
```

---

## Rule of Thumb

> **Static frontend = filesystem + Nginx**
> **API backend = process + proxy**

If those stay separate, deployments stay boring.
