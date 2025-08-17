#!/bin/bash
set -e

# Health check para a aplicação Node.js
curl -f http://localhost:3001/api/v1/health || exit 1

# Verificar se Redis está acessível
if [ -n "$REDIS_HOST" ]; then
  nc -z $REDIS_HOST ${REDIS_PORT:-6379} || exit 1
fi

echo "Health check passed"
exit 0