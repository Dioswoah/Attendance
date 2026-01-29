#!/bin/bash

# Deployment script for Google Cloud Run
# This script automates the deployment process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env ]; then
    echo -e "${YELLOW}Loading configuration from .env...${NC}"
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${RED}Error: .env file not found!${NC}"
    exit 1
fi

# Check variables
REQUIRED_VARS=("PROJECT_ID" "REGION" "SERVICE_NAME" "CLOUD_SQL_INSTANCE" "CLOUD_SQL_REGION" "DATABASE_NAME" "DATABASE_USER" "DATABASE_PASS_ENCODED" "AUTH_GOOGLE_ID" "AUTH_GOOGLE_SECRET" "ADMIN_PASSWORD" "NEXTAUTH_SECRET" "SERVICE_URL")
for VAR in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!VAR}" ]; then
        echo -e "${RED}Error: Missing required environment variable: $VAR${NC}"
        exit 1
    fi
done

echo -e "${GREEN}=== Attendance System - Cloud Run Deployment ===${NC}\n"

echo -e "${YELLOW}Step 1: Building Docker image...${NC}"
gcloud builds submit --tag gcr.io/${PROJECT_ID}/${SERVICE_NAME}

echo -e "\n${YELLOW}Step 2: Deploying to Cloud Run...${NC}"

# Constructing the database URL for Cloud Run (using Unix socket)
CLOUD_RUN_DATABASE_URL="postgresql://${DATABASE_USER}:${DATABASE_PASS_ENCODED}@localhost/${DATABASE_NAME}?host=/cloudsql/${PROJECT_ID}:${CLOUD_SQL_REGION}:${CLOUD_SQL_INSTANCE}"

gcloud run deploy ${SERVICE_NAME} \
  --image gcr.io/${PROJECT_ID}/${SERVICE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --add-cloudsql-instances ${PROJECT_ID}:${CLOUD_SQL_REGION}:${CLOUD_SQL_INSTANCE} \
  --set-env-vars NODE_ENV=production \
  --set-env-vars NEXTAUTH_SECRET="${NEXTAUTH_SECRET}" \
  --set-env-vars NEXTAUTH_URL="${SERVICE_URL}" \
  --set-env-vars DATABASE_URL="${CLOUD_RUN_DATABASE_URL}" \
  --set-env-vars AUTH_TRUST_HOST=true \
  --set-env-vars AUTH_GOOGLE_ID="${AUTH_GOOGLE_ID}" \
  --set-env-vars AUTH_GOOGLE_SECRET="${AUTH_GOOGLE_SECRET}" \
  --set-env-vars ADMIN_PASSWORD="${ADMIN_PASSWORD}" \
  --set-env-vars GOOGLE_GENERATIVE_AI_API_KEY="${GOOGLE_GENERATIVE_AI_API_KEY}" \
  --set-env-vars PROJECT_ID="${PROJECT_ID}" \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 20

echo -e "\n${GREEN}Deployment complete!${NC}"
echo -e "Your application is available at:"
gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)'
