# PayExpert Deployment Guide

## Dual-Server Architektur auf Debian 13

Diese Anleitung beschreibt die Einrichtung von PayExpert auf zwei separaten Debian 13 Servern:

- **Server 1 (Public)**: Landing Page, Karriere, Bewerbungen
- **Server 2 (Admin)**: Dashboard, Tasks, Verwaltung

---

## Inhaltsverzeichnis

1. [Architektur-Übersicht](#architektur-übersicht)
2. [Voraussetzungen](#voraussetzungen)
3. [Server 1 - Public Server](#server-1---public-server)
4. [Server 2 - Admin Server](#server-2---admin-server)
5. [Environment Variables](#environment-variables)
6. [Nginx Konfiguration](#nginx-konfiguration)
7. [SSL Zertifikate](#ssl-zertifikate)
8. [Build & Deployment](#build--deployment)
9. [Wartung & Monitoring](#wartung--monitoring)

---

## Architektur-Übersicht

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTERNET                                 │
└─────────────────────────┬───────────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
          ▼                               ▼
┌─────────────────────┐       ┌─────────────────────┐
│   Server 1 (Public) │       │   Server 2 (Admin)  │
│   www.payexpert.de  │       │  admin.payexpert.de │
├─────────────────────┤       ├─────────────────────┤
│ • Landing Page (/)  │       │ • Dashboard         │
│ • /careers          │       │ • /tasks            │
│ • /application      │       │ • /admin/*          │
│ • /register/*       │       │ • /settings         │
│ • /impressum        │       │ • /documents        │
│ • /privacy          │       │ • /payroll          │
│ • /contact          │       │ • /login            │
│ • /services         │       │ • /auth             │
│ • /industries/*     │       │ • /verification     │
│ • /partners         │       │                     │
└─────────────────────┘       └─────────────────────┘
          │                               │
          └───────────────┬───────────────┘
                          │
                          ▼
              ┌─────────────────────┐
              │   Lovable Cloud     │
              │   (Supabase)        │
              ├─────────────────────┤
              │ • Database          │
              │ • Auth              │
              │ • Edge Functions    │
              │ • Storage           │
              │ • Secrets           │
              └─────────────────────┘
```

---

## Voraussetzungen

### Hardware (Minimum pro Server)
- 2 CPU Cores
- 4 GB RAM
- 40 GB SSD
- Debian 13 (Trixie)

### Domains
- `www.payexpert.de` → Server 1 IP
- `admin.payexpert.de` → Server 2 IP

### Zugangsdaten (aus Lovable Cloud)
```
VITE_SUPABASE_URL=https://qljjcyjdpqwfeesmfdvl.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_PROJECT_ID=qljjcyjdpqwfeesmfdvl
```

---

## Server 1 - Public Server

### 1.1 System-Update & Basis-Pakete

```bash
# Als root oder mit sudo
apt update && apt upgrade -y
apt install -y curl wget git nginx certbot python3-certbot-nginx ufw
```

### 1.2 Node.js 20 LTS installieren

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node --version  # Sollte v20.x.x anzeigen
npm --version
```

### 1.3 Firewall konfigurieren

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

### 1.4 Anwendungsbenutzer erstellen

```bash
useradd -m -s /bin/bash payexpert
mkdir -p /var/www/payexpert-public
chown -R payexpert:payexpert /var/www/payexpert-public
```

### 1.5 Projekt-Verzeichnis vorbereiten

```bash
su - payexpert
cd /var/www/payexpert-public

# Projekt-Dateien hier ablegen (via SCP, SFTP, etc.)
# Beispiel mit SCP von lokalem Rechner:
# scp -r ./dist/* payexpert@server1:/var/www/payexpert-public/
```

### 1.6 Environment-Datei erstellen

```bash
cat > /var/www/payexpert-public/.env << 'EOF'
VITE_SUPABASE_URL=https://qljjcyjdpqwfeesmfdvl.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsampjeWpkcHF3ZmVlc21mZHZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjEwNzcsImV4cCI6MjA3NjczNzA3N30.mcN3cH52b1X6JXSDSbja2ICmZYMFD5ujPrHyverdB3E
VITE_SUPABASE_PROJECT_ID=qljjcyjdpqwfeesmfdvl
VITE_SERVER_TYPE=public
EOF
```

---

## Server 2 - Admin Server

### 2.1 System-Update & Basis-Pakete

```bash
apt update && apt upgrade -y
apt install -y curl wget git nginx certbot python3-certbot-nginx ufw
```

### 2.2 Node.js 20 LTS installieren

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

### 2.3 Firewall konfigurieren

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

### 2.4 Anwendungsbenutzer erstellen

```bash
useradd -m -s /bin/bash payexpert
mkdir -p /var/www/payexpert-admin
chown -R payexpert:payexpert /var/www/payexpert-admin
```

### 2.5 Environment-Datei erstellen

```bash
cat > /var/www/payexpert-admin/.env << 'EOF'
VITE_SUPABASE_URL=https://qljjcyjdpqwfeesmfdvl.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsampjeWpkcHF3ZmVlc21mZHZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjEwNzcsImV4cCI6MjA3NjczNzA3N30.mcN3cH52b1X6JXSDSbja2ICmZYMFD5ujPrHyverdB3E
VITE_SUPABASE_PROJECT_ID=qljjcyjdpqwfeesmfdvl
VITE_SERVER_TYPE=admin
EOF
```

---

## Environment Variables

### Übersicht aller Variablen

| Variable | Wert | Server | Beschreibung |
|----------|------|--------|--------------|
| `VITE_SUPABASE_URL` | `https://qljjcyjdpqwfeesmfdvl.supabase.co` | Beide | Supabase API URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJhbGci...` | Beide | Öffentlicher Supabase Key |
| `VITE_SUPABASE_PROJECT_ID` | `qljjcyjdpqwfeesmfdvl` | Beide | Projekt-ID |
| `VITE_SERVER_TYPE` | `public` / `admin` | Je nach Server | Steuert Routing-Logik |

### Backend-Secrets (nur in Lovable Cloud / Edge Functions)

Diese Secrets sind bereits in Lovable Cloud konfiguriert und werden **NUR** von Edge Functions verwendet:

| Secret Name | Verwendung |
|-------------|------------|
| `RESEND_API_KEY` | E-Mail-Versand |
| `ANOSIM_API_KEY` | SMS-Weiterleitung |
| `VMOS_API_KEY` | Cloud-Phones |
| `VMOS_SECRET_KEY` | Cloud-Phones Auth |
| `FIRECRAWL_API_KEY` | Web Scraping |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin-Operationen |

> ⚠️ **Wichtig**: Diese Secrets werden NIEMALS auf den Frontend-Servern gespeichert!

---

## Nginx Konfiguration

### Server 1 - Public (`/etc/nginx/sites-available/payexpert-public`)

```nginx
server {
    listen 80;
    server_name www.payexpert.de payexpert.de;
    return 301 https://www.payexpert.de$request_uri;
}

server {
    listen 443 ssl http2;
    server_name www.payexpert.de payexpert.de;

    # SSL wird von Certbot konfiguriert
    ssl_certificate /etc/letsencrypt/live/www.payexpert.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.payexpert.de/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /var/www/payexpert-public;
    index index.html;

    # Gzip Kompression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Cache für statische Assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Redirect Admin-Routen zu Server 2
    location ~ ^/(dashboard|admin|tasks|settings|documents|payroll|login|auth|verification|employee-settings|freelancer) {
        return 301 https://admin.payexpert.de$request_uri;
    }

    # Erlaubte Public-Routen
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Health Check Endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

### Server 2 - Admin (`/etc/nginx/sites-available/payexpert-admin`)

```nginx
server {
    listen 80;
    server_name admin.payexpert.de;
    return 301 https://admin.payexpert.de$request_uri;
}

server {
    listen 443 ssl http2;
    server_name admin.payexpert.de;

    # SSL wird von Certbot konfiguriert
    ssl_certificate /etc/letsencrypt/live/admin.payexpert.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.payexpert.de/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /var/www/payexpert-admin;
    index index.html;

    # Gzip Kompression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "frame-ancestors 'self';" always;

    # Cache für statische Assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Redirect Public-Routen zu Server 1
    location ~ ^/(careers|application|register|impressum|privacy|contact|services|industries|partners)$ {
        return 301 https://www.payexpert.de$request_uri;
    }

    # Root-Redirect (Landing Page ist auf Server 1)
    location = / {
        return 301 https://www.payexpert.de/;
    }

    # Alle anderen Routen (Admin-Bereich)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Health Check Endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

### Nginx aktivieren

```bash
# Auf beiden Servern:
ln -s /etc/nginx/sites-available/payexpert-* /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default  # Default-Config entfernen
nginx -t  # Syntax prüfen
systemctl reload nginx
```

---

## SSL Zertifikate

### Server 1

```bash
certbot --nginx -d www.payexpert.de -d payexpert.de
```

### Server 2

```bash
certbot --nginx -d admin.payexpert.de
```

### Auto-Renewal testen

```bash
certbot renew --dry-run
```

### Cron für Auto-Renewal (automatisch von Certbot eingerichtet)

```bash
# Prüfen ob Timer aktiv ist:
systemctl status certbot.timer
```

---

## Build & Deployment

### Lokaler Build (auf Entwicklungsrechner)

```bash
# 1. Dependencies installieren
npm install

# 2. Build für Production
npm run build

# Der Build landet in ./dist/
```

### Deployment-Script (`deploy.sh`)

Erstelle dieses Script auf deinem lokalen Rechner:

```bash
#!/bin/bash

# Konfiguration
PUBLIC_SERVER="payexpert@server1.payexpert.de"
ADMIN_SERVER="payexpert@server2.payexpert.de"
PUBLIC_PATH="/var/www/payexpert-public"
ADMIN_PATH="/var/www/payexpert-admin"

echo "🔨 Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "📦 Deploying to Public Server..."
rsync -avz --delete ./dist/ $PUBLIC_SERVER:$PUBLIC_PATH/
ssh $PUBLIC_SERVER "sudo systemctl reload nginx"

echo "📦 Deploying to Admin Server..."
rsync -avz --delete ./dist/ $ADMIN_SERVER:$ADMIN_PATH/
ssh $ADMIN_SERVER "sudo systemctl reload nginx"

echo "✅ Deployment complete!"
echo "🌐 Public: https://www.payexpert.de"
echo "🔐 Admin:  https://admin.payexpert.de"
```

### Deployment ausführen

```bash
chmod +x deploy.sh
./deploy.sh
```

---

## Wartung & Monitoring

### Log-Dateien

```bash
# Nginx Access Logs
tail -f /var/log/nginx/access.log

# Nginx Error Logs
tail -f /var/log/nginx/error.log

# System Logs
journalctl -u nginx -f
```

### Health Checks

```bash
# Server 1
curl -s https://www.payexpert.de/health

# Server 2
curl -s https://admin.payexpert.de/health
```

### Disk Space prüfen

```bash
df -h
```

### Nginx Status

```bash
systemctl status nginx
nginx -t  # Konfiguration validieren
```

### SSL Zertifikats-Ablauf prüfen

```bash
certbot certificates
```

---

## Troubleshooting

### Problem: 502 Bad Gateway

```bash
# Nginx Logs prüfen
tail -50 /var/log/nginx/error.log

# Nginx neu starten
systemctl restart nginx
```

### Problem: SSL-Zertifikat abgelaufen

```bash
certbot renew --force-renewal
systemctl reload nginx
```

### Problem: Berechtigungsfehler

```bash
# Dateiberechtigungen korrigieren
chown -R payexpert:payexpert /var/www/payexpert-*
chmod -R 755 /var/www/payexpert-*
```

### Problem: Seite lädt nicht (SPA Routing)

Stelle sicher, dass `try_files $uri $uri/ /index.html;` in der Nginx-Config ist.

---

## Backup-Strategie

### Tägliches Backup-Script (`/opt/backup-payexpert.sh`)

```bash
#!/bin/bash
BACKUP_DIR="/backups/payexpert"
DATE=$(date +%Y-%m-%d)

mkdir -p $BACKUP_DIR

# Frontend-Dateien sichern
tar -czf $BACKUP_DIR/frontend-$DATE.tar.gz /var/www/payexpert-*

# Nginx-Config sichern
tar -czf $BACKUP_DIR/nginx-$DATE.tar.gz /etc/nginx/sites-available/

# Alte Backups löschen (älter als 30 Tage)
find $BACKUP_DIR -type f -mtime +30 -delete

echo "Backup completed: $DATE"
```

### Cron einrichten

```bash
crontab -e
# Füge hinzu:
0 2 * * * /opt/backup-payexpert.sh >> /var/log/backup.log 2>&1
```

---

## Sicherheitshinweise

1. **SSH-Keys verwenden** - Passwort-Authentifizierung deaktivieren
2. **Fail2ban installieren** - Brute-Force-Schutz
3. **Regelmäßige Updates** - `apt update && apt upgrade`
4. **Firewall aktiv halten** - Nur benötigte Ports öffnen
5. **Backend-Secrets** - Niemals im Frontend-Code speichern
6. **HTTPS erzwingen** - Alle HTTP-Anfragen redirecten

---

## Kontakt & Support

Bei Fragen zur Infrastruktur oder Lovable Cloud wende dich an das Entwicklungsteam.

**Lovable Cloud Dashboard**: Zugriff über Lovable.dev Projekteinstellungen

---

*Zuletzt aktualisiert: Januar 2026*
