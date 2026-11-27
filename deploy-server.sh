#!/usr/bin/env bash
# ==============================================================================
# ITASK Production Server Deployment Script (No GitHub Required)
# ==============================================================================
set -e

APP_DIR="/var/www/itask"
echo "🚀 [1/6] Starting ITASK Production Deployment..."

cd "$APP_DIR"

# 1. Ensure Docker Database Container is running
echo "🐳 [2/6] Verifying Docker PostgreSQL service..."
docker compose up -d

# 2. Install PHP Backend Dependencies
echo "📦 [3/6] Installing backend dependencies..."
cd "$APP_DIR/backend"
composer install --no-dev --optimize-autoloader --no-interaction

# 3. Run Database Migrations
echo "🗄️ [4/6] Running database migrations..."
php artisan migrate --force

# 4. Compile Frontend Client Assets
echo "🎨 [5/6] Building production frontend assets..."
cd "$APP_DIR/frontend"
npm ci --prefer-offline || npm install
npm run build

# 5. Optimize Laravel caches and set permissions
echo "⚡ [6/6] Optimizing caches & permissions..."
cd "$APP_DIR/backend"
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

# Set storage and bootstrap cache permissions
chown -R www-data:www-data "$APP_DIR/backend/storage" "$APP_DIR/backend/bootstrap/cache"
chmod -R 775 "$APP_DIR/backend/storage" "$APP_DIR/backend/bootstrap/cache"

# Reload web services
if systemctl is-active --quiet php8.2-fpm; then
    systemctl reload php8.2-fpm
elif systemctl is-active --quiet php8.3-fpm; then
    systemctl reload php8.3-fpm
fi

systemctl reload nginx

echo "✅ ITASK deployment completed successfully!"
