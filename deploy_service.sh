#!/bin/bash

# Deploy the Cloud Run Service
echo "Deploying Cloud Run Service 'attendance-app'..."
gcloud run deploy attendance-app \
  --image gcr.io/buoyant-purpose-475203-t9/attendance-app:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --add-cloudsql-instances buoyant-purpose-475203-t9:australia-southeast1:bapteamproject \
  --set-env-vars NODE_ENV=production \
  --set-env-vars NEXTAUTH_SECRET="6pD+C4whgjqx4d9NmlPas9d/Xi0puOW7CjvEx/n16+Q=" \
  --set-env-vars NEXTAUTH_URL="https://attendance-app-712513641417.us-central1.run.app" \
  --set-env-vars DATABASE_URL="postgresql://attendance_user:AttendanceSecure2024!@localhost/attendance_db?host=/cloudsql/buoyant-purpose-475203-t9:australia-southeast1:bapteamproject" \
  --port 8080 \
  --quiet
