# ============================================================
# P2 PRODUCTION (Singapore) Deployment Script — bap-rsa project
# ============================================================
# PURPOSE:
#   Deploy attendance-app-prod to asia-southeast1 so Cloud Run
#   domain mappings can be enabled for redadair.com.au.
#   (Domain mappings are NOT available in australia-southeast1.)
#
# KEY DIFFERENCES FROM deploy-prod-p2.ps1:
#   - Region   : asia-southeast1 (Singapore)
#   - VPC      : attendance-vpc-connector-sg  (new — VPC connectors are regional)
#   - Redis    : attendance-redis-sg          (new — Memorystore is regional)
#   - Cloud SQL: SAME instance (bap-rsa:australia-southeast1:attendance-staging)
#   - Migrate  : migrate-db-prod-sg job in asia-southeast1
#   - Image    : SAME Docker image (Artifact Registry is global)
#   - Config   : SAME .env.prod-p2 file
#
# FIRST RUN (provisions infra):
#   .\external-tools\deploy-prod-p2-sg.ps1
#
# SUBSEQUENT DEPLOYS (infra already exists):
#   .\external-tools\deploy-prod-p2-sg.ps1 -SkipInfrastructure
#   .\external-tools\deploy-prod-p2-sg.ps1 -SkipBuild -SkipInfrastructure
#
# AFTER DEPLOYMENT:
#   1. Test at the Cloud Run URL printed at the end
#   2. Cloud Console > Cloud Run > attendance-app-prod (asia-southeast1) > Domain mappings
#   3. Map redadair.com.au and follow the DNS verification steps
#   4. Update SERVICE_URL in .env.prod-p2 to the mapped domain, then redeploy
#
# FLAGS:
#   -SkipBuild          Skip Docker build (reuse last pushed image)
#   -SkipInfrastructure Skip VPC connector + Redis creation (still fetches Redis IP)
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
    Write-Host " Prod SG must be deployed from: main" -ForegroundColor Yellow
    Write-Host ""
    Write-Host " To deploy to prod SG:" -ForegroundColor Cyan
    Write-Host "   1. git checkout main" -ForegroundColor Cyan
    Write-Host "   2. git merge marc" -ForegroundColor Cyan
    Write-Host "   3. Re-run this script" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Red
    Write-Host ""
    exit 1
}

$SG_REGION          = "asia-southeast1"
$VPC_CONNECTOR_NAME = "attendance-vpc-sg"
$REDIS_INSTANCE     = "attendance-redis-sg"
$MIGRATE_JOB        = "migrate-db-prod-sg"

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

$IMAGE_TAG                  = "us-central1-docker.pkg.dev/$PROJECT_ID/attendance-app/attendance-app-prod"
$CLOUD_SQL_CONN             = "${PROJECT_ID}:${CLOUD_SQL_REGION}:${CLOUD_SQL_INSTANCE}"
$CLOUD_RUN_MIGRATION_URL    = "postgresql://${DATABASE_USER}:${DATABASE_PASS_ENCODED}@localhost/${DATABASE_NAME}?host=/cloudsql/$CLOUD_SQL_CONN&connection_limit=3"
$CLOUD_RUN_APP_DATABASE_URL = "postgresql://${DATABASE_USER}:${DATABASE_PASS_ENCODED}@localhost/${DATABASE_NAME}?host=/cloudsql/$CLOUD_SQL_CONN&connection_limit=5&pool_timeout=30"

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " Attendance System - P2 PROD (Singapore)"   -ForegroundColor Green
Write-Host "   Project  : $PROJECT_ID"                  -ForegroundColor Green
Write-Host "   Service  : $SERVICE_NAME"                -ForegroundColor Green
Write-Host "   Region   : $SG_REGION"                   -ForegroundColor Green
Write-Host "   Database : $DATABASE_NAME"               -ForegroundColor Green
Write-Host "   Cloud SQL: $CLOUD_SQL_CONN (cross-region)" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

# ── STEP 1 — VPC Connector ─────────────────────────────────
Write-Host "Step 1: VPC connector ($SG_REGION)..." -ForegroundColor Yellow
if (-not $SkipInfrastructure) {
    $prevEAP = $ErrorActionPreference; $ErrorActionPreference = "Continue"
    $connectorExists = gcloud compute networks vpc-access connectors describe $VPC_CONNECTOR_NAME `
        --region $SG_REGION --project $PROJECT_ID --quiet 2>$null
    $ErrorActionPreference = $prevEAP

    if (-not $connectorExists) {
        Write-Host "  Creating $VPC_CONNECTOR_NAME in $SG_REGION..." -ForegroundColor Yellow
        gcloud compute networks vpc-access connectors create $VPC_CONNECTOR_NAME `
            --network default `
            --region $SG_REGION `
            --range 10.9.0.16/28 `
            --project $PROJECT_ID --quiet
        Write-Host "  VPC connector created." -ForegroundColor Green
    } else {
        Write-Host "  VPC connector already exists." -ForegroundColor Green
    }
} else {
    Write-Host "  Skipping creation (-SkipInfrastructure). Assuming $VPC_CONNECTOR_NAME exists." -ForegroundColor DarkGray
}

# ── STEP 2 — Redis (Memorystore in asia-southeast1) ────────
Write-Host ""
Write-Host "Step 2: Redis instance ($SG_REGION)..." -ForegroundColor Yellow
if (-not $SkipInfrastructure) {
    $prevEAP = $ErrorActionPreference; $ErrorActionPreference = "Continue"
    $redisExists = gcloud redis instances describe $REDIS_INSTANCE `
        --region $SG_REGION --project $PROJECT_ID --quiet 2>$null
    $ErrorActionPreference = $prevEAP

    if (-not $redisExists) {
        Write-Host "  Creating $REDIS_INSTANCE (takes ~5 minutes)..." -ForegroundColor Yellow
        gcloud redis instances create $REDIS_INSTANCE `
            --size 1 `
            --region $SG_REGION `
            --network default `
            --project $PROJECT_ID --quiet
        Write-Host "  Redis instance created." -ForegroundColor Green
    } else {
        Write-Host "  Redis instance already exists." -ForegroundColor Green
    }
}

# Always fetch Redis IP (whether just created or pre-existing) so REDIS_URL is always correct
$REDIS_HOST = gcloud redis instances describe $REDIS_INSTANCE `
    --region $SG_REGION --project $PROJECT_ID --format="value(host)" 2>&1
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($REDIS_HOST)) {
    Write-Warning "Could not fetch Redis IP from $REDIS_INSTANCE - REDIS_URL will be empty."
    $script:REDIS_URL = ""
} else {
    $script:REDIS_URL = "redis://${REDIS_HOST}:6379"
    Write-Host "  Redis URL: $REDIS_URL" -ForegroundColor Green
}

# ── STEP 3 — Build Docker Image ────────────────────────────
Write-Host ""
Write-Host "Step 3: Building Docker image..." -ForegroundColor Yellow
if (-not $SkipBuild) {
    gcloud builds submit --tag $IMAGE_TAG --project=$PROJECT_ID
    Write-Host "  Image pushed: $IMAGE_TAG" -ForegroundColor Green
} else {
    Write-Host "  Skipping build (-SkipBuild). Using: $IMAGE_TAG" -ForegroundColor DarkGray
}

# ── STEP 4 — Run Migrations ────────────────────────────────
Write-Host ""
Write-Host "Step 4: Running database migrations on $DATABASE_NAME..." -ForegroundColor Yellow

$prevEAP = $ErrorActionPreference; $ErrorActionPreference = "Continue"
$jobExists = gcloud run jobs describe $MIGRATE_JOB --region $SG_REGION --project=$PROJECT_ID --quiet 2>$null
$ErrorActionPreference = $prevEAP

if (-not $jobExists) {
    gcloud run jobs create $MIGRATE_JOB `
        --image $IMAGE_TAG `
        --region $SG_REGION `
        --set-env-vars "NODE_ENV=production,DATABASE_URL=$CLOUD_RUN_MIGRATION_URL" `
        --set-cloudsql-instances $CLOUD_SQL_CONN `
        --command "npm" --args "run,db:setup" `
        --project=$PROJECT_ID --quiet
} else {
    gcloud run jobs update $MIGRATE_JOB `
        --image $IMAGE_TAG `
        --region $SG_REGION `
        --set-env-vars "NODE_ENV=production,DATABASE_URL=$CLOUD_RUN_MIGRATION_URL" `
        --set-cloudsql-instances $CLOUD_SQL_CONN `
        --command "npm" --args "run,db:setup" `
        --project=$PROJECT_ID --quiet
}

gcloud run jobs execute $MIGRATE_JOB --region $SG_REGION --project=$PROJECT_ID --wait
Write-Host "  Migrations complete." -ForegroundColor Green

# ── STEP 5 — Deploy to Cloud Run (asia-southeast1) ─────────
Write-Host ""
Write-Host "Step 5: Deploying $SERVICE_NAME to $SG_REGION..." -ForegroundColor Yellow

gcloud run deploy $SERVICE_NAME `
    --image $IMAGE_TAG `
    --platform managed `
    --region $SG_REGION `
    --allow-unauthenticated `
    --add-cloudsql-instances $CLOUD_SQL_CONN `
    --vpc-connector $VPC_CONNECTOR_NAME `
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
    --set-env-vars "SIMPRO_BASE_URL=$SIMPRO_BASE_URL" `
    --set-env-vars "SIMPRO_TOKEN=$SIMPRO_TOKEN" `
    --set-env-vars "SIMPRO_WEBHOOK_SECRET=$SIMPRO_WEBHOOK_SECRET" `
    --set-env-vars "SIMPRO_ATTENDANCE_WRITE=$SIMPRO_ATTENDANCE_WRITE" `
    --set-env-vars "SIMPRO_POLL_ENABLED=$SIMPRO_POLL_ENABLED" `
    --set-env-vars "ENABLE_CRON=true" `
    --memory 2Gi `
    --cpu 1 `
    --concurrency 1000 `
    --min-instances 1 `
    --max-instances 3 `
    --timeout 3600 `
    --cpu-boost `
    --project=$PROJECT_ID `
    --quiet

Write-Host "  Deployed to $SG_REGION." -ForegroundColor Green

# ── STEP 6 — Service Account Secret (Biometric) ───────────
Write-Host ""
Write-Host "Step 6: Setting biometric service account credentials..." -ForegroundColor Yellow
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
        --region $SG_REGION `
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
Write-Host " P2 PROD (Singapore) DEPLOYMENT COMPLETE"   -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host " Region  : $SG_REGION"                      -ForegroundColor Cyan
Write-Host " Service : $SERVICE_NAME"                   -ForegroundColor Cyan
Write-Host " Redis   : $REDIS_URL"                      -ForegroundColor Cyan
Write-Host ""
Write-Host " NEXT STEPS:" -ForegroundColor Yellow
Write-Host "  1. Copy the service URL printed above by gcloud"                                    -ForegroundColor White
Write-Host "  2. Test the app at that URL"                                                        -ForegroundColor White
Write-Host "  3. Set up domain mapping in Cloud Console:"                                         -ForegroundColor White
Write-Host "     Cloud Run > $SERVICE_NAME ($SG_REGION) > Domain mappings > Add mapping"         -ForegroundColor White
Write-Host "  4. After mapping is verified, update SERVICE_URL in .env.prod-p2 to the domain"    -ForegroundColor White
Write-Host "     then run: .\external-tools\deploy-prod-p2-sg.ps1 -SkipBuild -SkipInfrastructure" -ForegroundColor White
Write-Host "  5. Update OAuth redirect URIs in Google Cloud Console to include the new domain"   -ForegroundColor White
Write-Host ""
