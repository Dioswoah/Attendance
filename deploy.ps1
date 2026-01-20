# Deployment script for Google Cloud Run
# This script automates the deployment process

$ErrorActionPreference = "Stop"

# Function to read .env file
function Get-EnvVar {
    param($File = ".env")
    if (Test-Path $File) {
        Get-Content $File | Where-Object { $_ -match '=' -and $_ -notmatch '^#' } | ForEach-Object {
            $key, $value = $_.Split('=', 2)
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

Write-Host "=== Attendance System - Cloud Run Deployment ===" -ForegroundColor Green

Write-Host "Step 1: Building Docker image..." -ForegroundColor Yellow
gcloud builds submit --tag "gcr.io/$PROJECT_ID/$SERVICE_NAME"

Write-Host "Step 2: Deploying to Cloud Run..." -ForegroundColor Yellow

# Constructing the database URL for Cloud Run (using Unix socket)
$CLOUD_RUN_DATABASE_URL = "postgresql://${DATABASE_USER}:${DATABASE_PASS_ENCODED}@localhost/${DATABASE_NAME}?host=/cloudsql/${PROJECT_ID}:${CLOUD_SQL_REGION}:${CLOUD_SQL_INSTANCE}"

gcloud run deploy $SERVICE_NAME `
  --image "gcr.io/$PROJECT_ID/$SERVICE_NAME" `
  --platform managed `
  --region $REGION `
  --allow-unauthenticated `
  --add-cloudsql-instances "${PROJECT_ID}:${CLOUD_SQL_REGION}:${CLOUD_SQL_INSTANCE}" `
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
  --max-instances 20

Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "Your application is available at:"
Write-Host "$SERVICE_URL" -ForegroundColor Cyan
Write-Host ""
Write-Host "IMPORTANT: You MUST add the following URL to your Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client IDs > Authorized redirect URIs:" -ForegroundColor Red
Write-Host "$SERVICE_URL/api/auth/callback/google" -ForegroundColor Yellow
