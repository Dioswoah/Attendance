#!/bin/bash

# Create a Cloud Run Job for database migration
gcloud run jobs create migrate-db \
  --image gcr.io/buoyant-purpose-475203-t9/attendance-app \
  --region us-central1 \
  --set-env-vars NODE_ENV=production \
  --set-env-vars DATABASE_URL="postgresql://attendance_user:AttendanceSecure2024!@localhost/attendance_db?host=/cloudsql/buoyant-purpose-475203-t9:australia-southeast1:bapteamproject" \
  --set-cloudsql-instances buoyant-purpose-475203-t9:australia-southeast1:bapteamproject \
  --command npx \
  --args prisma,migrate,deploy

# Execute the job
gcloud run jobs execute migrate-db --region us-central1 --wait
