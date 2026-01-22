# Deployment script for Google Cloud Run
# This script automates the deployment process using GCR and Cloud Run

param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

# Function to read .env file
function Get-EnvVar {
    param($File = ".env")
    if (Test-Path $File) {
        Get-Content $File | Where-Object { $_ -match '=' -and $_ -notmatch '^#' } | ForEach-Object {
            $key, $value = $_.Split('=', 2)
            $key = $key.Trim()
            $value = $value.Trim().Trim('"').Trim("'")
            Set-Variable -Name $key -Value $value -Scope script
        }
    } else {
        Write-Error ".env file not found!"
        exit 1
    }
}

# Load environment variables
Write-Host "Loading configuration from .env..." -ForegroundColor cyan
Get-EnvVar

# Check for required variables
$RequiredVars = @("PROJECT_ID", "REGION", "SERVICE_NAME", "CLOUD_SQL_INSTANCE", "CLOUD_SQL_REGION", "DATABASE_NAME", "DATABASE_USER", "DATABASE_PASS_ENCODED", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "ADMIN_PASSWORD", "NEXTAUTH_SECRET", "SERVICE_URL")
foreach ($var in $RequiredVars) {
    if (-not (Get-Variable -Name $var -ErrorAction SilentlyContinue)) {
        Write-Error "Missing required environment variable: $var"
        exit 1
    }
}

Write-Host "=== Attendance System - Cloud Run Deployment (GCR) ===" -ForegroundColor Green

# Define Image Tag for Container Registry
$IMAGE_TAG = "gcr.io/$PROJECT_ID/$SERVICE_NAME"

Write-Host "Step 1: Building and pushing Docker image to GCR..." -ForegroundColor Yellow
if (-not $SkipBuild) {
    gcloud builds submit --tag $IMAGE_TAG
} else {
    Write-Host "Skipping build as requested." -ForegroundColor Cyan
}

Write-Host "Step 2: Running database migrations..." -ForegroundColor Yellow
$CLOUD_SQL_CONN = "${PROJECT_ID}:${CLOUD_SQL_REGION}:${CLOUD_SQL_INSTANCE}"
$CLOUD_RUN_DATABASE_URL = "postgresql://${DATABASE_USER}:${DATABASE_PASS_ENCODED}@localhost/${DATABASE_NAME}?host=/cloudsql/$CLOUD_SQL_CONN"

# Check if migration job exists, create if not, then update and execute
$jobExists = gcloud run jobs describe migrate-db --region $REGION --quiet 2>$null
if (-not $jobExists) {
    Write-Host "Creating migrate-db job..." -ForegroundColor Cyan
    gcloud run jobs create migrate-db `
      --image $IMAGE_TAG `
      --region $REGION `
      --set-env-vars "NODE_ENV=production,DATABASE_URL=$CLOUD_RUN_DATABASE_URL" `
      --set-cloudsql-instances $CLOUD_SQL_CONN `
      --command "npm" `
      --args "run,db:setup" `
      --quiet
} else {
    Write-Host "Updating migrate-db job..." -ForegroundColor Cyan
    gcloud run jobs update migrate-db `
      --image $IMAGE_TAG `
      --region $REGION `
      --set-env-vars "NODE_ENV=production,DATABASE_URL=$CLOUD_RUN_DATABASE_URL" `
      --set-cloudsql-instances $CLOUD_SQL_CONN `
      --command "npm" `
      --args "run,db:setup" `
      --quiet
}

Write-Host "Executing migration job..." -ForegroundColor Cyan
gcloud run jobs execute migrate-db --region $REGION --wait

Write-Host "Step 3: Deploying to Cloud Run..." -ForegroundColor Yellow

gcloud run deploy $SERVICE_NAME `
  --image $IMAGE_TAG `
  --platform managed `
  --region $REGION `
  --allow-unauthenticated `
  --add-cloudsql-instances $CLOUD_SQL_CONN `
  --set-env-vars "NODE_ENV=production" `
  --set-env-vars "NEXTAUTH_SECRET=$NEXTAUTH_SECRET" `
  --set-env-vars "NEXTAUTH_URL=$SERVICE_URL" `
  --set-env-vars "AUTH_TRUST_HOST=true" `
  --set-env-vars "DATABASE_URL=$CLOUD_RUN_DATABASE_URL" `
  --set-env-vars "AUTH_GOOGLE_ID=$AUTH_GOOGLE_ID" `
  --set-env-vars "AUTH_GOOGLE_SECRET=$AUTH_GOOGLE_SECRET" `
  --set-env-vars "ADMIN_PASSWORD=$ADMIN_PASSWORD" `
  --memory 512Mi `
  --cpu 1 `
  --min-instances 0 `
  --max-instances 20 `
  --quiet

Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "Your application is available at:"
Write-Host "$SERVICE_URL" -ForegroundColor Cyan
Write-Host ""
Write-Host "IMPORTANT: Ensure $SERVICE_URL/api/auth/callback/google is in your Google OAuth Redirect URIs." -ForegroundColor Red


