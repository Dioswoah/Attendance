#!/bin/bash

# Deploy the Cloud Run Service
# Deploy the Cloud Run Service
# Load environment variables
cd "$(dirname "$0")/.."
if [ -f .env ]; then
    echo "Loading configuration from .env..."
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "Error: .env file not found!"
    exit 1
fi

echo "Deploying Cloud Run Service '${SERVICE_NAME}'..."

# Constructing the database URL for Cloud Run (using Unix socket)
CLOUD_RUN_DATABASE_URL="postgresql://${DATABASE_USER}:${DATABASE_PASS_ENCODED}@localhost/${DATABASE_NAME}?host=/cloudsql/${PROJECT_ID}:${CLOUD_SQL_REGION}:${CLOUD_SQL_INSTANCE}"

gcloud run deploy ${SERVICE_NAME} \
  --image gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --add-cloudsql-instances ${PROJECT_ID}:${CLOUD_SQL_REGION}:${CLOUD_SQL_INSTANCE} \
  --set-env-vars NODE_ENV=production \
  --set-env-vars NEXTAUTH_SECRET="${NEXTAUTH_SECRET}" \
  --set-env-vars NEXTAUTH_URL="${SERVICE_URL}" \
  --set-env-vars DATABASE_URL="${CLOUD_RUN_DATABASE_URL}" \
  --set-env-vars AUTH_GOOGLE_ID="${AUTH_GOOGLE_ID}" \
  --set-env-vars AUTH_GOOGLE_SECRET="${AUTH_GOOGLE_SECRET}" \
  --set-env-vars ADMIN_PASSWORD="${ADMIN_PASSWORD}" \
  --port 8080 \
  --quiet
