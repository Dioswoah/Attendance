#!/bin/bash

# Setup a fresh database on Cloud SQL
# This script will push the schema and seed the database

# Load environment variables
cd "$(dirname "$0")/.."
if [ -f .env ]; then
    echo "Loading configuration from .env..."
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "Error: .env file not found!"
    exit 1
fi

CLOUD_RUN_DATABASE_URL="postgresql://${DATABASE_USER}:${DATABASE_PASS_ENCODED}@localhost/${DATABASE_NAME}?host=/cloudsql/${PROJECT_ID}:${CLOUD_SQL_REGION}:${CLOUD_SQL_INSTANCE}"

echo "Creating/Updating migration job for fresh setup..."
gcloud run jobs create setup-fresh-db \
  --image gcr.io/${PROJECT_ID}/${SERVICE_NAME} \
  --region ${REGION} \
  --set-env-vars NODE_ENV=production \
  --set-env-vars DATABASE_URL="${CLOUD_RUN_DATABASE_URL}" \
  --set-cloudsql-instances ${PROJECT_ID}:${CLOUD_SQL_REGION}:${CLOUD_SQL_INSTANCE} \
  --command npm \
  --args run,db:setup \
  --quiet

echo "Executing setup job (push + seed)..."
gcloud run jobs execute setup-fresh-db --region ${REGION} --wait

echo "Database fresh setup complete!"
