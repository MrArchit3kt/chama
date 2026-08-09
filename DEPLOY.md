# Déploiement — chama-gaming.site

Ce site cohabite avec d'autres sites sur le même VPS : chaque site a son
propre dossier, sa propre base Postgres, son propre process PM2 et son
propre port local. Adapte `/var/www/chama` si tes autres sites vivent
ailleurs (garde juste le même parent que les autres).

## 0. Choisir un port libre

Chaque site sur le VPS doit tourner sur un port différent en local (nginx
fait ensuite le routage par nom de domaine). Vérifie ce qui est déjà pris :

```bash
pm2 list
sudo ss -tlnp | grep LISTEN
```

Le reste de ce guide suppose le port **3010** — remplace-le partout si déjà
utilisé par un autre site.

## 1. Prérequis sur le VPS (une seule fois, si pas déjà en place)

```bash
# Node.js (si pas déjà installé)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs

# pnpm via corepack
corepack enable
corepack prepare pnpm@latest --activate

# PM2 (gestionnaire de process, garde l'app en vie)
sudo npm install -g pm2

# nginx + certbot (si pas déjà en place)
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

## 2. Base de données dédiée

Un site = une base séparée (comme tes autres sites sur ce VPS) :

```bash
sudo -u postgres psql -c "CREATE USER chama WITH PASSWORD 'CHOISIS_UN_MOT_DE_PASSE_FORT';"
sudo -u postgres psql -c "CREATE DATABASE chama OWNER chama;"
```

## 3. Cloner le projet dans le dossier chama

```bash
sudo mkdir -p /var/www/chama
sudo chown $USER:$USER /var/www/chama
git clone https://github.com/MrArchit3kt/chama.git /var/www/chama
cd /var/www/chama
```

## 4. Configuration (.env)

```bash
cp .env.example .env
nano .env
```

Remplir :
- `NEXTAUTH_URL="https://chama-gaming.site"`
- `NEXTAUTH_SECRET` : générer une valeur **propre à cet environnement**
  (jamais celle du dev) :
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
  ```
- `DATABASE_URL="postgresql://chama:CHOISIS_UN_MOT_DE_PASSE_FORT@localhost:5432/chama"`
- `DISCORD_WEBHOOK_URL` : vraie valeur si utilisée
- `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` (optionnel, pour le badge
  "EN LIVE" automatique sur la page /lives) :
  1. Aller sur https://dev.twitch.tv/console/apps → **Register Your Application**
  2. Name : `CHAMA Squad Manager` (ou autre nom unique)
  3. OAuth Redirect URLs : `https://chama-gaming.site` (obligatoire dans le
     formulaire Twitch, mais pas utilisé — cette intégration n'utilise que
     le flow "app access token", sans connexion utilisateur)
  4. Category : `Application Integration`
  5. Une fois créée, copier le **Client ID**, puis cliquer **New Secret**
     pour générer le **Client Secret** (affiché une seule fois)
  6. Coller les deux valeurs dans `.env`
- `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` / `DISCORD_BOT_TOKEN` /
  `DISCORD_GUILD_ID` (optionnel, pour la connexion Discord des joueurs
  + le déplacement automatique en vocal à la génération d'un mix) :
  1. Aller sur https://discord.com/developers/applications → **New Application**
  2. Onglet **OAuth2** : copier le **Client ID** et générer/copier le
     **Client Secret**. Dans **Redirects**, ajouter
     `https://chama-gaming.site/api/discord/callback`
  3. Onglet **Bot** : **Reset Token** pour générer le **Bot Token**
     (affiché une seule fois, à copier tout de suite). Désactiver
     "Public Bot" si tu ne veux pas qu'il soit ajoutable par d'autres.
  4. Inviter le bot sur ton serveur : onglet **OAuth2** → **URL Generator**
     → scope `bot` → permission **Move Members** → ouvrir l'URL générée
     et sélectionner ton serveur
  5. `DISCORD_GUILD_ID` : sur Discord, activer le mode développeur
     (Réglages → Avancés), puis clic droit sur le serveur → **Copier
     l'identifiant du serveur**
  6. Une fois les 4 valeurs dans `.env`, configurer les salons vocaux
     par jeu depuis `/admin/discord` (l'ID de chaque salon vocal
     s'obtient pareil : clic droit sur le salon → Copier l'ID)
  Sans ces deux valeurs, `/lives` fonctionne quand même (liste des chaînes
  Twitch renseignées), juste sans détection automatique du live.

## 5. Installer, migrer, builder

```bash
pnpm install
pnpm prisma generate      # régénère le client Prisma (dossier ignoré par git)
pnpm prisma migrate deploy
pnpm build
```

## 6. Lancer avec PM2 (port 3010)

⚠️ `pm2 start "pnpm start" --name chama` ne fonctionne pas de façon fiable
(PM2 tente d'interpréter la chaîne comme un script et échoue silencieusement).
Utiliser le fichier `ecosystem.config.js` fourni dans le repo à la place :

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # affiche une commande à exécuter une fois pour démarrer PM2 au boot du VPS
```

Le port et `NODE_ENV` sont définis dans `ecosystem.config.js` — modifier ce
fichier si le port 3010 est déjà pris par un autre site.

Vérifier que ça tourne en local :
```bash
curl -I http://localhost:3010
```

## 7. nginx — routage par domaine

Créer `/etc/nginx/sites-available/chama` :

```nginx
server {
  listen 80;
  server_name chama-gaming.site www.chama-gaming.site;

  location / {
    proxy_pass http://127.0.0.1:3010;
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

Activer et recharger :
```bash
sudo ln -s /etc/nginx/sites-available/chama /etc/nginx/sites-enabled/chama
sudo nginx -t
sudo systemctl reload nginx
```

`X-Forwarded-For` doit être transmis (c'est le cas ci-dessus) : le rate
limiting anti-spam (inscription/contact) et le suivi de présence en ligne
en dépendent pour identifier les visiteurs.

## 8. Domaine — configuration DNS chez Ionos

1. Récupère l'IP publique du VPS : `curl -4 ifconfig.me` (exécuté sur le VPS)
2. Va sur [ionos.fr](https://www.ionos.fr) → connecte-toi → **Domaines & SSL**
3. Clique sur `chama-gaming.site` → **DNS**
4. Ajoute/modifie ces enregistrements :

   | Type | Nom (host) | Valeur          | TTL     |
   |------|-----------|------------------|---------|
   | A    | @         | `87.106.25.44`   | 1h (défaut) |
   | A    | www       | `87.106.25.44`   | 1h (défaut) |

   (Supprime tout enregistrement A ou CNAME préexistant sur `@`/`www` qui
   pointerait ailleurs — un domaine ne peut avoir qu'une seule destination.)

5. Sauvegarde. La propagation prend en général de quelques minutes à
   quelques heures (rarement jusqu'à 24-48h).

Vérifier la propagation :
```bash
dig +short chama-gaming.site
# doit renvoyer l'IP du VPS
```

## 9. Certificat HTTPS (une fois le DNS propagé)

```bash
sudo certbot --nginx -d chama-gaming.site -d www.chama-gaming.site
```

Certbot modifie automatiquement le bloc nginx pour rediriger en HTTPS et
programme le renouvellement automatique.

## 10. Vérification finale

```bash
curl -I https://chama-gaming.site
```
→ doit répondre `307` vers `/login` (le site exige une connexion, comme prévu).

## 11. Sauvegardes automatiques de la base

Le script `scripts/backup-db.sh` (fourni dans le repo) fait un dump
compressé de la base (`pg_dump -Fc`) et supprime automatiquement les dumps
de plus de 14 jours. Il lit `DATABASE_URL` depuis `.env`, pas besoin de
config supplémentaire.

Test manuel :
```bash
cd /var/www/chama
./scripts/backup-db.sh
# écrit dans /var/backups/chama/ par défaut
```

Programmer une sauvegarde quotidienne à 4h du matin via cron :
```bash
sudo mkdir -p /var/backups/chama
sudo chown $USER:$USER /var/backups/chama
crontab -e
```
Ajouter cette ligne :
```cron
0 4 * * * /var/www/chama/scripts/backup-db.sh >> /var/log/chama-backup.log 2>&1
```

Pour changer le dossier ou la rétention, définir `BACKUP_DIR` /
`RETENTION_DAYS` avant l'appel dans le cron :
```cron
0 4 * * * BACKUP_DIR=/mnt/backups/chama RETENTION_DAYS=30 /var/www/chama/scripts/backup-db.sh >> /var/log/chama-backup.log 2>&1
```

⚠️ Ces dumps restent sur le même serveur : en cas de perte totale du VPS
(disque HS, résiliation…) ils sont perdus avec le reste. Idéalement,
copier périodiquement `/var/backups/chama` ailleurs (autre machine, espace
de stockage externe type S3/Backblaze via `rclone`, etc.) — pas fait ici
par manque d'accès à un compte de stockage externe.

**Restaurer un dump** (efface et recrée la base — à ne faire qu'en cas de
besoin réel, jamais sur la prod sans être sûr) :
```bash
sudo -u postgres dropdb chama
sudo -u postgres createdb chama --owner=chama
pg_restore -U chama -h localhost -d chama /var/backups/chama/chama_AAAA-MM-JJ_HH-MM-SS.dump
```

## 12. Mises à jour ultérieures

```bash
cd /var/www/chama
git pull
pnpm install
pnpm prisma generate
pnpm prisma migrate deploy
pnpm build
pm2 restart chama
```
