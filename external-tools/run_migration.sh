#!/bin/bash

# Update the Cloud Run Job to use 'prisma db push' since there are no migration files
cd "$(dirname "$0")/.."
echo "Updating migration job to use 'db push'..."
gcloud run jobs update migrate-db \
  --command npx \
  --args prisma,db,push,--accept-data-loss \
  --region us-central1

echo "Executing migration job..."
gcloud run jobs execute migrate-db --region us-central1 --wait
