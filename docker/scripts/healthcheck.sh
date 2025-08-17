#!/bin/bash
set -e

# Health check para a aplicação Node.js
echo "Checking application health..."
curl -f http://localhost:3001/api/v1/health || {
  echo "❌ Application health check failed"
  exit 1
}

# Verificar conectividade com Redis externo (opcional, não crítico)
if [ -n "$REDIS_HOST" ] && [ "$REDIS_HOST" != "localhost" ] && [ "$REDIS_HOST" != "127.0.0.1" ]; then
  echo "Testing Redis connectivity to $REDIS_HOST:${REDIS_PORT:-6379}..."
  timeout 5 nc -z $REDIS_HOST ${REDIS_PORT:-6379} || {
    echo "⚠️  Warning: Cannot connect to Redis at $REDIS_HOST:${REDIS_PORT:-6379}"
    echo "Application will continue but caching may not work properly"
  }
else
  echo "Redis configured as localhost or not specified, skipping connectivity test"
fi

echo "✅ Health check passed"
exit 0