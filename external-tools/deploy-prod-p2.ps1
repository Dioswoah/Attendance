# ============================================================
# P2 PRODUCTION Deployment Script — bap-rsa project
# ============================================================
# WORKFLOW:
#   1. Fix bugs / build features locally
#   2. Run deploy-staging.ps1  →  test on P2 staging
#   3. Run this script         →  deploy to P2 prod (attendance-app-prod)
#   4. Run deploy.ps1          →  deploy to P1 prod (attendance-app, P1)
#
# FLAGS:
#   -SkipBuild          Skip Docker build (reuse last pushed image)
#   -SkipInfrastructure Skip Redis IP fetch (use REDIS_URL from .env.prod-p2)
# ============================================================

param(
    [switch]$SkipBuild,
    [switch]$SkipInfrastructure
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

# ── Helpers ────────────────────────────────────────────────
function Get-EnvVar {
    param($File = ".env.prod-p2")
    if (-not (Test-Path $File)) { Write-Error ".env.prod-p2 not found."; exit 1 }
    Get-Content $File | Where-Object { $_ -match '=' -and $_ -notmatch '^#' } | ForEach-Object {
        $key, $value = $_.Split('=', 2)
        $key   = $key.Trim()
        $value = $value.Trim().Trim('"').Trim("'")
        Set-Variable -Name $key -Value $value -Scope script
    }
}

# ── Load Config ────────────────────────────────────────────
Write-Host "Loading .env.prod-p2..." -ForegroundColor Cyan
Get-EnvVar

# Required vars check
$RequiredVars = @(
    "PROJECT_ID","REGION","SERVICE_NAME","CLOUD_SQL_INSTANCE","CLOUD_SQL_REGION",
    "DATABASE_NAME","DATABASE_USER","DATABASE_PASS_ENCODED",
    "AUTH_GOOGLE_ID","AUTH_GOOGLE_SECRET","ADMIN_PASSWORD","NEXTAUTH_SECRET",
    "SERVICE_URL","GOOGLE_GENERATIVE_AI_API_KEY","ALLOWED_WORKSPACE_DOMAINS",
    "ZEPTOMAIL_PASSWORD","BIOMETRIC_APPS_SCRIPT_URL"
)
foreach ($var in $RequiredVars) {
    if (-not (Get-Variable -Name $var -ErrorAction SilentlyContinue) -or
        [string]::IsNullOrWhiteSpace((Get-Variable -Name $var -ValueOnly -ErrorAction SilentlyContinue))) {
        Write-Error "Missing or empty required variable: $var in .env.prod-p2"
        exit 1
    }
}

$IMAGE_TAG          = "us-central1-docker.pkg.dev/$PROJECT_ID/attendance-app/attendance-app-prod"
$CLOUD_SQL_CONN     = "${PROJECT_ID}:${CLOUD_SQL_REGION}:${CLOUD_SQL_INSTANCE}"
$CLOUD_RUN_MIGRATION_URL    = "postgresql://${DATABASE_USER}:${DATABASE_PASS_ENCODED}@localhost/${DATABASE_NAME}?host=/cloudsql/$CLOUD_SQL_CONN&connection_limit=3"
$CLOUD_RUN_APP_DATABASE_URL = "postgresql://${DATABASE_USER}:${DATABASE_PASS_ENCODED}@localhost/${DATABASE_NAME}?host=/cloudsql/$CLOUD_SQL_CONN&connection_limit=15&pool_timeout=30"

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " Attendance System - P2 PROD Deployment"    -ForegroundColor Green
Write-Host "   Project : $PROJECT_ID"                   -ForegroundColor Green
Write-Host "   Service : $SERVICE_NAME"                 -ForegroundColor Green
Write-Host "   Database: $DATABASE_NAME"                -ForegroundColor Green
Write-Host "   Region  : $REGION"                       -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

# ── STEP 1 — Get Redis IP ──────────────────────────────────
if (-not $SkipInfrastructure) {
    Write-Host "Step 1: Fetching Redis IP from P2 Memorystore..." -ForegroundColor Yellow
    $REDIS_HOST = gcloud redis instances describe attendance-redis `
        --region=$REGION --project=$PROJECT_ID --format="value(host)" 2>&1
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($REDIS_HOST)) {
        Write-Warning "Could not fetch Redis IP - REDIS_URL will be empty."
        $script:REDIS_URL = ""
    } else {
        $script:REDIS_URL = "redis://${REDIS_HOST}:6379"
        Write-Host "  Redis URL: $REDIS_URL" -ForegroundColor Green
    }
} else {
    Write-Host "Step 1: Using REDIS_URL from .env.prod-p2 (-SkipInfrastructure)." -ForegroundColor DarkGray
}

# ── STEP 2 — Build Docker Image ────────────────────────────
Write-Host ""
Write-Host "Step 2: Building Docker image for P2 prod..." -ForegroundColor Yellow
if (-not $SkipBuild) {
    gcloud builds submit --tag $IMAGE_TAG --project=$PROJECT_ID
    Write-Host "  Image pushed: $IMAGE_TAG" -ForegroundColor Green
} else {
    Write-Host "  Skipping build (-SkipBuild). Using: $IMAGE_TAG" -ForegroundColor DarkGray
}

# ── STEP 3 — Run Migrations ────────────────────────────────
Write-Host ""
Write-Host "Step 3: Running database migrations on attendance_live..." -ForegroundColor Yellow

$prevEAP = $ErrorActionPreference; $ErrorActionPreference = "Continue"
$jobExists = gcloud run jobs describe migrate-db-prod --region $REGION --project=$PROJECT_ID --quiet 2>$null
$ErrorActionPreference = $prevEAP

if (-not $jobExists) {
    gcloud run jobs create migrate-db-prod `
        --image $IMAGE_TAG `
        --region $REGION `
        --set-env-vars "NODE_ENV=production,DATABASE_URL=$CLOUD_RUN_MIGRATION_URL" `
        --set-cloudsql-instances $CLOUD_SQL_CONN `
        --command "npm" --args "run,db:setup" `
        --project=$PROJECT_ID --quiet
} else {
    gcloud run jobs update migrate-db-prod `
        --image $IMAGE_TAG `
        --region $REGION `
        --set-env-vars "NODE_ENV=production,DATABASE_URL=$CLOUD_RUN_MIGRATION_URL" `
        --set-cloudsql-instances $CLOUD_SQL_CONN `
        --command "npm" --args "run,db:setup" `
        --project=$PROJECT_ID --quiet
}

gcloud run jobs execute migrate-db-prod --region $REGION --project=$PROJECT_ID --wait
Write-Host "  Migrations complete." -ForegroundColor Green

# ── STEP 4 — Deploy to Cloud Run ──────────────────────────
Write-Host ""
Write-Host "Step 4: Deploying to P2 prod Cloud Run..." -ForegroundColor Yellow

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
    --set-env-vars "VERTEX_PROJECT_ID=$VERTEX_PROJECT_ID" `
    --memory 2Gi `
    --cpu 1 `
    --concurrency 1000 `
    --min-instances 1 `
    --max-instances 3 `
    --project=$PROJECT_ID `
    --quiet

# ── STEP 5 — Service Account Secret (Biometric) ───────────
Write-Host ""
Write-Host "Step 5: Setting biometric service account credentials..." -ForegroundColor Yellow
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = "Continue"
if (Get-Variable -Name "GOOGLE_SERVICE_ACCOUNT_JSON" -ErrorAction SilentlyContinue) {
    $secretName = "GOOGLE_SERVICE_ACCOUNT_JSON_PROD"
    $tmpJson = [System.IO.Path]::GetTempFileName()
    [System.IO.File]::WriteAllText($tmpJson, $GOOGLE_SERVICE_ACCOUNT_JSON, [System.Text.Encoding]::UTF8)

    gcloud secrets describe $secretName --project $PROJECT_ID --quiet
    if ($LASTEXITCODE -eq 0) {
        gcloud secrets versions add $secretName --data-file=$tmpJson --project $PROJECT_ID --quiet
    } else {
        gcloud secrets create $secretName --data-file=$tmpJson --project $PROJECT_ID --quiet
    }
    Remove-Item $tmpJson -Force -ErrorAction SilentlyContinue

    $projectNumber = (gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
    gcloud secrets add-iam-policy-binding $secretName `
        --member="serviceAccount:${projectNumber}-compute@developer.gserviceaccount.com" `
        --role="roles/secretmanager.secretAccessor" `
        --project $PROJECT_ID --quiet 2>$null

    gcloud run services update $SERVICE_NAME `
        --region $REGION `
        --update-secrets="GOOGLE_SERVICE_ACCOUNT_JSON=${secretName}:latest" `
        --project $PROJECT_ID --quiet
    Write-Host "  Biometric credentials set." -ForegroundColor Green
} else {
    Write-Host "  GOOGLE_SERVICE_ACCOUNT_JSON not in .env.prod-p2 - biometric sync unavailable." -ForegroundColor Yellow
}
$ErrorActionPreference = $prevEAP

# ── Done ───────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " P2 PROD DEPLOYMENT COMPLETE"               -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host " P2 Prod URL: $SERVICE_URL" -ForegroundColor Cyan
Write-Host ""
Write-Host " NEXT STEPS:" -ForegroundColor Yellow
Write-Host "  1. Test at the P2 prod URL above"                              -ForegroundColor White
Write-Host "  2. To also push to P1 prod, run: .\external-tools\deploy.ps1" -ForegroundColor White
Write-Host ""
