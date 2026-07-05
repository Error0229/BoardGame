# Deployment guide — Kindred

This document contains example configuration and steps to securely host the game.

Recommended production setup (secure):
- Build the repo on the server: `npm install && npm run build`.
- Serve `client/dist` with Nginx (or another static host) on port 80/443.
- Run the Node server behind Nginx and bind it to localhost (127.0.0.1).
- Use systemd (or PM2/docker) to manage the Node process.
- Enable HTTPS (Let's Encrypt) and restrict socket.io origin to your domain.

Files under `deploy/`:
- `kindred.service` — example systemd unit (copy to `/etc/systemd/system/kindred.service` and edit paths).
- `nginx.conf` — example server block (replace `your.domain.com` and `root` path).
- `Dockerfile.server` — image that builds the monorepo and runs the built server.
- `docker-compose.yml` — quick compose example (run from `deploy/` folder).

Systemd quick steps:
1. Copy `deploy/kindred.service` to `/etc/systemd/system/kindred.service` and update `WorkingDirectory` and `ExecStart` paths.
2. `sudo systemctl daemon-reload`
3. `sudo systemctl enable --now kindred`

Nginx quick steps:
1. Place `client/dist` in a web root (e.g., `/var/www/kindred`).
2. Copy `deploy/nginx.conf` into `/etc/nginx/conf.d/kindred.conf` and replace host/domain/root.
3. `sudo nginx -t && sudo systemctl restart nginx`

Docker quick start (from `deploy/`):
1. Ensure `client/dist` is built: `npm run build`
2. `docker-compose up --build -d`

Security checklist:
- Keep `DEBUG_GAME=0` in production.
- Limit CORS/origin (don't leave `*`) — update `server/src/server.ts` to set socket.io origin to your domain.
- Run the node process as non-root user.
- Use TLS (Let's Encrypt) and HSTS.
- Monitor logs and set up log rotation.
