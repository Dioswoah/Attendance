#!/bin/bash

# Deployment script for Google Cloud Run
# This script automates the deployment process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Attendance System - Cloud Run Deployment ===${NC}\n"

# Configuration
PROJECT_ID="your-gcp-project-id"
REGION="us-central1"
SERVICE_NAME="attendance-app"
CLOUD_SQL_INSTANCE="attendance-db-instance"
DATABASE_NAME="attendance_db"
DATABASE_USER="attendance_user"

echo -e "${YELLOW}Step 1: Building Docker image...${NC}"
gcloud builds submit --tag gcr.io/${PROJECT_ID}/${SERVICE_NAME}

echo -e "\n${YELLOW}Step 2: Deploying to Cloud Run...${NC}"
gcloud run deploy ${SERVICE_NAME} \
  --image gcr.io/${PROJECT_ID}/${SERVICE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --add-cloudsql-instances ${PROJECT_ID}:${REGION}:${CLOUD_SQL_INSTANCE} \
  --set-env-vars NODE_ENV=production \
  --set-secrets DATABASE_URL=attendance-db-url:latest,NEXTAUTH_SECRET=nextauth-secret:latest \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10

echo -e "\n${GREEN}Deployment complete!${NC}"
echo -e "Your application is available at:"
gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)'
