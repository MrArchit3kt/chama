#!/usr/bin/env bash
#
# Sauvegarde quotidienne de la base PostgreSQL de chama-squad-manager.
#
# Usage :
#   ./scripts/backup-db.sh
#
# Lit DATABASE_URL depuis l'environnement, ou depuis le fichier .env à la
# racine du projet si la variable n'est pas déjà exportée. Écrit un dump
# compressé horodaté dans BACKUP_DIR (par défaut /var/backups/chama), puis
# supprime les dumps plus vieux que RETENTION_DAYS jours (défaut 14).
#
# Pensé pour être lancé par cron sur le VPS (voir DEPLOY.md, section
# "Sauvegardes automatiques").

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/chama}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if [ -z "${DATABASE_URL:-}" ] && [ -f "$PROJECT_DIR/.env" ]; then
  # N'exporte que DATABASE_URL depuis .env, sans polluer l'environnement
  # avec le reste (secrets Discord/Twitch, etc.) qui n'a rien à faire ici.
  DATABASE_URL="$(grep -m1 '^DATABASE_URL=' "$PROJECT_DIR/.env" | cut -d'=' -f2- | tr -d '"')"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[backup-db] Erreur : DATABASE_URL introuvable (ni dans l'environnement, ni dans .env)." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "[backup-db] Erreur : pg_dump n'est pas installé (postgresql-client)." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
DEST_FILE="$BACKUP_DIR/chama_${TIMESTAMP}.dump"

echo "[backup-db] Sauvegarde vers $DEST_FILE ..."

# Format custom (-Fc) : compressé, restaurable sélectivement avec pg_restore.
pg_dump "$DATABASE_URL" -Fc -f "$DEST_FILE"

echo "[backup-db] OK ($(du -h "$DEST_FILE" | cut -f1))."

echo "[backup-db] Nettoyage des sauvegardes de plus de $RETENTION_DAYS jours..."
find "$BACKUP_DIR" -name 'chama_*.dump' -type f -mtime "+$RETENTION_DAYS" -print -delete

echo "[backup-db] Terminé."
