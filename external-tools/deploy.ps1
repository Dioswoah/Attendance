# Deployment script for Google Cloud Run
# This script automates the deployment process using GCR and Cloud Run

param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot/.."

# ── Branch Safety Check ────────────────────────────────────
$currentBranch = git rev-parse --abbrev-ref HEAD 2>$null
if ($currentBranch -ne "main") {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Red
    Write-Host " PROD DEPLOY BLOCKED" -ForegroundColor Red
    Write-Host "============================================" -ForegroundColor Red
    Write-Host " You are on branch: $currentBranch" -ForegroundColor Yellow
    Write-Host " Prod must be deployed from: main" -ForegroundColor Yellow
    Write-Host ""
    Write-Host " To deploy to prod:" -ForegroundColor Cyan
    Write-Host "   1. git checkout main" -ForegroundColor Cyan
    Write-Host "   2. Cherry-pick the approved commits" -ForegroundColor Cyan
    Write-Host "   3. Re-run this script" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Red
    Write-Host ""
    exit 1
}

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
$RequiredVars = @("PROJECT_ID", "REGION", "SERVICE_NAME", "CLOUD_SQL_INSTANCE", "CLOUD_SQL_REGION", "DATABASE_NAME", "DATABASE_USER", "DATABASE_PASS_ENCODED", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "ADMIN_PASSWORD", "NEXTAUTH_SECRET", "SERVICE_URL", "GOOGLE_GENERATIVE_AI_API_KEY", "ALLOWED_WORKSPACE_DOMAINS", "ZEPTOMAIL_PASSWORD", "BIOMETRIC_APPS_SCRIPT_URL")
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
# Support cross-project Cloud SQL: use CLOUD_SQL_PROJECT_ID if set, otherwise fall back to PROJECT_ID
$CloudSqlProjectId = if ($CLOUD_SQL_PROJECT_ID) { $CLOUD_SQL_PROJECT_ID } else { $PROJECT_ID }
$CLOUD_SQL_CONN = "${CloudSqlProjectId}:${CLOUD_SQL_REGION}:${CLOUD_SQL_INSTANCE}"
# Migration job uses a low connection limit (3) since it runs briefly and sequentially
$CLOUD_RUN_MIGRATION_URL = "postgresql://${DATABASE_USER}:${DATABASE_PASS_ENCODED}@localhost/${DATABASE_NAME}?host=/cloudsql/$CLOUD_SQL_CONN&connection_limit=3"
# connection_limit=15 per instance: with max-instances=3 that's 45 total connections, well within Cloud SQL limits
$CLOUD_RUN_APP_DATABASE_URL = "postgresql://${DATABASE_USER}:${DATABASE_PASS_ENCODED}@localhost/${DATABASE_NAME}?host=/cloudsql/$CLOUD_SQL_CONN&connection_limit=15&pool_timeout=30"

# Check if migration job exists, create if not, then update and execute
$jobExists = gcloud run jobs describe migrate-db --region $REGION --quiet 2>$null
if (-not $jobExists) {
    Write-Host "Creating migrate-db job..." -ForegroundColor Cyan
    gcloud run jobs create migrate-db `
      --image $IMAGE_TAG `
      --region $REGION `
      --set-env-vars "NODE_ENV=production,DATABASE_URL=$CLOUD_RUN_MIGRATION_URL" `
      --set-cloudsql-instances $CLOUD_SQL_CONN `
      --command "npm" `
      --args "run,db:setup" `
      --quiet
} else {
    Write-Host "Updating migrate-db job..." -ForegroundColor Cyan
    gcloud run jobs update migrate-db `
      --image $IMAGE_TAG `
      --region $REGION `
      --set-env-vars "NODE_ENV=production,DATABASE_URL=$CLOUD_RUN_MIGRATION_URL" `
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
  --vpc-connector attendance-vpc-connector `
  --vpc-egress private-ranges-only `
  --set-env-vars "NODE_ENV=production" `
  --set-env-vars "NEXTAUTH_SECRET=$NEXTAUTH_SECRET" `
  --set-env-vars "NEXTAUTH_URL=$SERVICE_URL" `
  --set-env-vars "AUTH_URL=$SERVICE_URL" `
  --set-env-vars "AUTH_TRUST_HOST=true" `
  --set-env-vars "DATABASE_URL=$CLOUD_RUN_APP_DATABASE_URL" `
  --set-env-vars "AUTH_GOOGLE_ID=$AUTH_GOOGLE_ID" `
  --set-env-vars "AUTH_GOOGLE_SECRET=$AUTH_GOOGLE_SECRET" `
  --set-env-vars "ADMIN_PASSWORD=$ADMIN_PASSWORD" `
  --set-env-vars "GOOGLE_GENERATIVE_AI_API_KEY=$GOOGLE_GENERATIVE_AI_API_KEY" `
  --set-env-vars "PROJECT_ID=$PROJECT_ID" `
  --set-env-vars "^|^ALLOWED_WORKSPACE_DOMAINS=$ALLOWED_WORKSPACE_DOMAINS" `
  --set-env-vars "ZEPTOMAIL_PASSWORD=$ZEPTOMAIL_PASSWORD" `
  --set-env-vars "BIOMETRIC_APPS_SCRIPT_URL=$BIOMETRIC_APPS_SCRIPT_URL" `
  --set-env-vars "REDIS_URL=$REDIS_URL" `
  --memory 2Gi `
  --cpu 1 `
  --concurrency 1000 `
  --min-instances 1 `
  --max-instances 3 `
  --quiet

# Step 4: Set GOOGLE_SERVICE_ACCOUNT_JSON via gcloud secrets to handle embedded JSON quotes/commas
Write-Host "Step 4: Setting service account credentials (biometric sync)..." -ForegroundColor Yellow
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = "Continue"   # gcloud writes success output to stderr; don't treat it as fatal
if (Get-Variable -Name "GOOGLE_SERVICE_ACCOUNT_JSON" -ErrorAction SilentlyContinue) {
    $secretName = "GOOGLE_SERVICE_ACCOUNT_JSON"
    # Write JSON to temp file, then create/update secret in Secret Manager
    $tmpJson = [System.IO.Path]::GetTempFileName()
    [System.IO.File]::WriteAllText($tmpJson, $GOOGLE_SERVICE_ACCOUNT_JSON, [System.Text.Encoding]::UTF8)

    # Create or update secret (check exit code, not stderr)
    gcloud secrets describe $secretName --project $PROJECT_ID --quiet
    if ($LASTEXITCODE -eq 0) {
        gcloud secrets versions add $secretName --data-file=$tmpJson --project $PROJECT_ID --quiet
    } else {
        gcloud secrets create $secretName --data-file=$tmpJson --project $PROJECT_ID --quiet
    }
    Remove-Item $tmpJson -Force -ErrorAction SilentlyContinue

    # Grant Cloud Run service account access to the secret
    $projectNumber = (gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
    gcloud secrets add-iam-policy-binding $secretName `
      --member="serviceAccount:$projectNumber-compute@developer.gserviceaccount.com" `
      --role="roles/secretmanager.secretAccessor" `
      --project $PROJECT_ID `
      --quiet 2>$null

    # Mount secret as env var
    gcloud run services update $SERVICE_NAME `
      --region $REGION `
      --update-secrets="GOOGLE_SERVICE_ACCOUNT_JSON=${secretName}:latest" `
      --quiet
    Write-Host "Service account credentials set via Secret Manager." -ForegroundColor Green
} else {
    Write-Host "GOOGLE_SERVICE_ACCOUNT_JSON not found in .env - biometric Strategy 2 (service account) will be unavailable." -ForegroundColor Yellow
}
$ErrorActionPreference = $prevEAP   # restore

Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "Your application is available at:"
Write-Host "$SERVICE_URL" -ForegroundColor Cyan
Write-Host ""
Write-Host "IMPORTANT: Ensure $SERVICE_URL/api/auth/callback/google is in your Google OAuth Redirect URIs." -ForegroundColor Red


