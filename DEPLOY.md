# Déploiement — chama-gaming.site

## 1. Récupérer le code sur le VPS

```bash
git clone https://github.com/MrArchit3kt/chama.git
cd chama
```

## 2. Variables d'environnement

```bash
cp .env.example .env
```

Puis remplir `.env` :
- `NEXTAUTH_URL="https://chama-gaming.site"`
- `NEXTAUTH_SECRET` : générer une valeur **différente** de celle du dev avec
  `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`
- `DATABASE_URL` : pointer vers la base Postgres de prod
- `DISCORD_WEBHOOK_URL`, `TWILIO_*` : vraies valeurs si utilisées

## 3. Installer et builder

```bash
corepack enable
pnpm install
pnpm prisma migrate deploy
pnpm build
```

## 4. Lancer le serveur

Le process doit rester actif en permanence (PM2, systemd, ou équivalent) :

```bash
pnpm start   # écoute sur le port 3000 par défaut
```

Exemple avec PM2 :
```bash
pnpm add -g pm2
pm2 start "pnpm start" --name chama
pm2 save
```

## 5. Reverse proxy + HTTPS (nginx + certbot)

Pointer le DNS de `chama-gaming.site` vers l'IP du VPS, puis :

```nginx
server {
  listen 80;
  server_name chama-gaming.site;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
  }
}
```

Puis :
```bash
sudo certbot --nginx -d chama-gaming.site
```

`X-Forwarded-For` doit être transmis par le proxy : le rate limiting
(inscription/contact) et le tracking de présence en dépendent pour
identifier les clients correctement.

## 6. Mises à jour ultérieures

```bash
git pull
pnpm install
pnpm prisma migrate deploy
pnpm build
pm2 restart chama
```
