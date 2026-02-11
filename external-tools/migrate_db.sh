#!/bin/bash

# Create a Cloud Run Job for database migration
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

gcloud run jobs create migrate-db \
  --image gcr.io/${PROJECT_ID}/${SERVICE_NAME} \
  --region ${REGION} \
  --set-env-vars NODE_ENV=production \
  --set-env-vars DATABASE_URL="${CLOUD_RUN_DATABASE_URL}" \
  --set-cloudsql-instances ${PROJECT_ID}:${CLOUD_SQL_REGION}:${CLOUD_SQL_INSTANCE} \
  --command npx \
  --args prisma,migrate,deploy

# Execute the job
gcloud run jobs execute migrate-db --region ${REGION} --wait

# Run seed
gcloud run jobs update migrate-db \
  --command npx \
  --args prisma,db,seed \
  --region ${REGION}

gcloud run jobs execute migrate-db --region ${REGION} --wait
