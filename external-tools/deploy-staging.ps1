# ============================================================
# STAGING Deployment Script — bap-rsa project
# ============================================================
# WORKFLOW:
#   1. Fix bugs / build features locally
#   2. Run this script  →  deploys to STAGING (bap-rsa)
#   3. Test on staging URL
#   4. Run deploy.ps1   →  promotes fix to LIVE (buoyant-purpose-475203-t9)
#
# FLAGS:
#   -SkipBuild          Skip Docker build (use last pushed image)
#   -CopyProdData       DANGER: overwrite the staging DB with a copy of prod data
#                       (opt-in since 2026-07-20; used to run by default)
#   -SkipInfrastructure Skip Cloud SQL existence check (staging has no Redis/VPC)
# ============================================================

param(
    [switch]$SkipBuild,
    [switch]$CopyProdData,
    [switch]$SkipInfrastructure
)

$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot/.."

# ── Helpers ────────────────────────────────────────────────
function Get-EnvVar {
    param($File = ".env.staging")
    if (-not (Test-Path $File)) { Write-Error ".env.staging not found. Copy it and fill in values."; exit 1 }
    Get-Content $File | Where-Object { $_ -match '=' -and $_ -notmatch '^#' } | ForEach-Object {
        $key, $value = $_.Split('=', 2)
        $key   = $key.Trim()
        $value = $value.Trim().Trim('"').Trim("'")
        Set-Variable -Name $key -Value $value -Scope script
    }
}

function Invoke-GCloud {
    param([string]$Description, [string[]]$Args)
    Write-Host "  → $Description" -ForegroundColor DarkCyan
    & gcloud @Args
    if ($LASTEXITCODE -ne 0) { Write-Error "gcloud failed: $Description"; exit 1 }
}

# ── Load Config ────────────────────────────────────────────
Write-Host "Loading .env.staging..." -ForegroundColor Cyan
Get-EnvVar

# Required vars check
$RequiredVars = @(
    "PROJECT_ID","REGION","SERVICE_NAME","CLOUD_SQL_INSTANCE","CLOUD_SQL_REGION",
    "DATABASE_NAME","DATABASE_USER","DATABASE_PASS_ENCODED","DATABASE_PASS_RAW",
    "AUTH_GOOGLE_ID","AUTH_GOOGLE_SECRET","ADMIN_PASSWORD","NEXTAUTH_SECRET",
    "SERVICE_URL","GOOGLE_GENERATIVE_AI_API_KEY","ALLOWED_WORKSPACE_DOMAINS",
    "ZEPTOMAIL_PASSWORD","BIOMETRIC_APPS_SCRIPT_URL",
    "PROD_PROJECT_ID","PROD_CLOUD_SQL_INSTANCE","PROD_CLOUD_SQL_REGION","PROD_DATABASE_NAME",
    "XERO_CLIENT_ID","XERO_CLIENT_SECRET","XERO_REDIRECT_URI"
)
foreach ($var in $RequiredVars) {
    if (-not (Get-Variable -Name $var -ErrorAction SilentlyContinue) -or
        [string]::IsNullOrWhiteSpace((Get-Variable -Name $var -ValueOnly -ErrorAction SilentlyContinue))) {
        Write-Error "Missing or empty required variable: $var in .env.staging"
        exit 1
    }
}

$IMAGE_TAG      = "us-central1-docker.pkg.dev/$PROJECT_ID/attendance-app/$SERVICE_NAME"
$CLOUD_SQL_CONN = "${PROJECT_ID}:${CLOUD_SQL_REGION}:${CLOUD_SQL_INSTANCE}"
$CLOUD_RUN_MIGRATION_URL = "postgresql://${DATABASE_USER}:${DATABASE_PASS_ENCODED}@localhost/${DATABASE_NAME}?host=/cloudsql/$CLOUD_SQL_CONN&connection_limit=3"
$CLOUD_RUN_APP_DATABASE_URL = "postgresql://${DATABASE_USER}:${DATABASE_PASS_ENCODED}@localhost/${DATABASE_NAME}?host=/cloudsql/$CLOUD_SQL_CONN&connection_limit=3&pool_timeout=30"
$DUMP_BUCKET    = "gs://${PROJECT_ID}-sql-dumps"
$DUMP_FILE      = "$DUMP_BUCKET/attendance_db_latest.sql"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Attendance System — STAGING Deployment" -ForegroundColor Green
Write-Host "   Project : $PROJECT_ID"               -ForegroundColor Green
Write-Host "   Service : $SERVICE_NAME"              -ForegroundColor Green
Write-Host "   Region  : $REGION"                    -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# ── STEP 1 — Enable APIs ───────────────────────────────────
Write-Host "Step 1: Enabling required APIs in $PROJECT_ID..." -ForegroundColor Yellow
gcloud services enable `
    sqladmin.googleapis.com `
    run.googleapis.com `
    cloudbuild.googleapis.com `
    redis.googleapis.com `
    vpcaccess.googleapis.com `
    storage.googleapis.com `
    secretmanager.googleapis.com `
    containerregistry.googleapis.com `
    --project=$PROJECT_ID --quiet
Write-Host "  APIs enabled." -ForegroundColor Green

# ── STEP 2 — Infrastructure (Cloud SQL only) ───────────────
# NOTE: staging deliberately has NO Redis and NO VPC connector — those belong to
# prod SG only (attendance-redis-sg / attendance-vpc-sg). Staging connects
# directly to Cloud SQL. Do not re-add provisioning for them here; doing so
# recreates the orphaned Sydney resources that were cleaned up on 2026-06-22.
if (-not $SkipInfrastructure) {
    Write-Host ""
    Write-Host "Step 2: Setting up staging infrastructure (Cloud SQL only)..." -ForegroundColor Yellow

    # Cloud SQL Instance
    $prevEAP = $ErrorActionPreference; $ErrorActionPreference = "Continue"
    $sqlExists = gcloud sql instances describe $CLOUD_SQL_INSTANCE `
        --project=$PROJECT_ID --quiet 2>$null
    $ErrorActionPreference = $prevEAP
    if (-not $sqlExists) {
        Write-Host "  Creating Cloud SQL instance (this takes ~5 min)..." -ForegroundColor Cyan
        gcloud sql instances create $CLOUD_SQL_INSTANCE `
            --database-version=POSTGRES_15 `
            --tier=db-g1-small `
            --region=$CLOUD_SQL_REGION `
            --storage-type=SSD `
            --storage-size=10GB `
            --no-backup `
            --project=$PROJECT_ID `
            --quiet
        Write-Host "  Cloud SQL instance created." -ForegroundColor Green

        Write-Host "  Creating database user..." -ForegroundColor Cyan
        gcloud sql users create $DATABASE_USER `
            --instance=$CLOUD_SQL_INSTANCE `
            --password=$DATABASE_PASS_RAW `
            --project=$PROJECT_ID `
            --quiet

        Write-Host "  Creating database..." -ForegroundColor Cyan
        gcloud sql databases create $DATABASE_NAME `
            --instance=$CLOUD_SQL_INSTANCE `
            --project=$PROJECT_ID `
            --quiet
        Write-Host "  Cloud SQL database ready." -ForegroundColor Green
    } else {
        Write-Host "  Cloud SQL instance already exists, skipping." -ForegroundColor DarkGray
    }
} else {
    Write-Host "Step 2: Skipping infrastructure setup (-SkipInfrastructure)." -ForegroundColor DarkGray
}

# ── STEP 3 — Redis skipped for staging ────────────────────
Write-Host ""
Write-Host "Step 3: Skipping Redis — staging connects directly to Cloud SQL." -ForegroundColor DarkGray
$script:REDIS_URL = ""

# ── STEP 4 — Copy Data from Production (opt-in: -CopyProdData) ──
if ($CopyProdData) {
    Write-Host ""
    Write-Host "Step 4: Copying production data to staging..." -ForegroundColor Yellow

    # 4a. Create dump bucket in staging project
    $bucketExists = gsutil ls $DUMP_BUCKET 2>$null
    if (-not $bucketExists) {
        Write-Host "  Creating GCS dump bucket in staging..." -ForegroundColor Cyan
        gsutil mb -p $PROJECT_ID -l $CLOUD_SQL_REGION $DUMP_BUCKET
    }

    # 4b. Get Cloud SQL service accounts directly from the instances
    $STAGING_SQL_SA = gcloud sql instances describe $CLOUD_SQL_INSTANCE --project=$PROJECT_ID --format="value(serviceAccountEmailAddress)" 2>&1
    $PROD_SQL_SA    = gcloud sql instances describe $PROD_CLOUD_SQL_INSTANCE --project=$PROD_PROJECT_ID --format="value(serviceAccountEmailAddress)" 2>&1

    # 4c. Create prod dump bucket (if needed) and grant prod SQL SA write access
    $PROD_DUMP_BUCKET = "gs://${PROD_PROJECT_ID}-sql-dumps"
    $prodBucketExists = gsutil ls $PROD_DUMP_BUCKET 2>$null
    if (-not $prodBucketExists) {
        Write-Host "  Creating GCS dump bucket in prod project..." -ForegroundColor Cyan
        gsutil mb -p $PROD_PROJECT_ID -l $PROD_CLOUD_SQL_REGION $PROD_DUMP_BUCKET
    }
    $prevEAP = $ErrorActionPreference; $ErrorActionPreference = "Continue"
    gsutil iam ch "serviceAccount:${PROD_SQL_SA}:roles/storage.objectAdmin" $PROD_DUMP_BUCKET 2>$null
    $ErrorActionPreference = $prevEAP

    # 4d. Export production database
    $PROD_DUMP_FILE = "$PROD_DUMP_BUCKET/attendance_db_staging_copy.sql"
    Write-Host "  Exporting production Cloud SQL to $PROD_DUMP_FILE ..." -ForegroundColor Cyan
    gcloud sql export sql $PROD_CLOUD_SQL_INSTANCE $PROD_DUMP_FILE `
        --database=$PROD_DATABASE_NAME `
        --project=$PROD_PROJECT_ID `
        --quiet
    Write-Host "  Export complete." -ForegroundColor Green

    # 4e. Copy dump to staging bucket
    Write-Host "  Copying dump to staging bucket..." -ForegroundColor Cyan
    gsutil cp $PROD_DUMP_FILE $DUMP_FILE

    # 4f. Grant staging Cloud SQL SA read access to staging bucket
    $prevEAP = $ErrorActionPreference; $ErrorActionPreference = "Continue"
    gsutil iam ch "serviceAccount:${STAGING_SQL_SA}:roles/storage.objectViewer" $DUMP_BUCKET 2>$null
    $ErrorActionPreference = $prevEAP

    # 4g. Clean schema via SQL import (avoids dropping DB which fails with active connections),
    #     then import the full prod dump.
    Write-Host "  Cleaning staging schema before import..." -ForegroundColor Cyan
    $cleanupSql = "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO PUBLIC; GRANT ALL ON SCHEMA public TO $DATABASE_USER;"
    $cleanupTmp = [System.IO.Path]::GetTempFileName() + ".sql"
    [System.IO.File]::WriteAllText($cleanupTmp, $cleanupSql, [System.Text.Encoding]::UTF8)
    $CLEANUP_FILE = "$DUMP_BUCKET/cleanup_schema.sql"
    gsutil cp $cleanupTmp $CLEANUP_FILE
    Remove-Item $cleanupTmp -Force -ErrorAction SilentlyContinue
    gcloud sql import sql $CLOUD_SQL_INSTANCE $CLEANUP_FILE `
        --database=$DATABASE_NAME `
        --project=$PROJECT_ID `
        --quiet
    Write-Host "  Importing dump into staging Cloud SQL..." -ForegroundColor Cyan
    gcloud sql import sql $CLOUD_SQL_INSTANCE $DUMP_FILE `
        --database=$DATABASE_NAME `
        --project=$PROJECT_ID `
        --quiet
    Write-Host "  Data copy complete — staging DB mirrors production." -ForegroundColor Green
} else {
    Write-Host "Step 4: Skipping data copy (pass -CopyProdData to overwrite staging DB with prod data)." -ForegroundColor DarkGray
}

# ── STEP 5 — Build Docker Image ────────────────────────────
Write-Host ""
Write-Host "Step 5: Building Docker image for staging..." -ForegroundColor Yellow
if (-not $SkipBuild) {
    gcloud builds submit --tag $IMAGE_TAG --project=$PROJECT_ID
    Write-Host "  Image pushed: $IMAGE_TAG" -ForegroundColor Green
} else {
    Write-Host "  Skipping build (-SkipBuild)." -ForegroundColor DarkGray
}

# ── STEP 6 — Run Migrations ────────────────────────────────
# Skip when data copy ran: the prod dump already contains the full schema.
# Running migrations after a data copy hits Cloud SQL connection limits on db-g1-small.
Write-Host ""
if ($CopyProdData) {
    Write-Host "Step 6: Skipping migrations — schema already included in prod data dump." -ForegroundColor DarkGray
} else {
Write-Host "Step 6: Running database migrations on staging..." -ForegroundColor Yellow

$prevEAP = $ErrorActionPreference; $ErrorActionPreference = "Continue"
$jobExists = gcloud run jobs describe migrate-db --region $REGION --project=$PROJECT_ID --quiet 2>$null
$ErrorActionPreference = $prevEAP
if (-not $jobExists) {
    gcloud run jobs create migrate-db `
        --image $IMAGE_TAG `
        --region $REGION `
        --set-env-vars "NODE_ENV=production,DATABASE_URL=$CLOUD_RUN_MIGRATION_URL" `
        --set-cloudsql-instances $CLOUD_SQL_CONN `
        --command "npm" --args "run,db:setup" `
        --project=$PROJECT_ID --quiet
} else {
    gcloud run jobs update migrate-db `
        --image $IMAGE_TAG `
        --region $REGION `
        --set-env-vars "NODE_ENV=production,DATABASE_URL=$CLOUD_RUN_MIGRATION_URL" `
        --set-cloudsql-instances $CLOUD_SQL_CONN `
        --command "npm" --args "run,db:setup" `
        --project=$PROJECT_ID --quiet
}

gcloud run jobs execute migrate-db --region $REGION --project=$PROJECT_ID --wait
Write-Host "  Migrations complete." -ForegroundColor Green
} # end of migration else block

# ── STEP 7 — Deploy to Cloud Run ──────────────────────────
Write-Host ""
Write-Host "Step 7: Deploying to staging Cloud Run..." -ForegroundColor Yellow

gcloud run deploy $SERVICE_NAME `
    --image $IMAGE_TAG `
    --platform managed `
    --region $REGION `
    --allow-unauthenticated `
    --add-cloudsql-instances $CLOUD_SQL_CONN `
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
    --set-env-vars "DISABLE_EMAILS=true" `
    --set-env-vars "VERTEX_PROJECT_ID=$PROD_PROJECT_ID" `
    --set-env-vars "GOOGLE_GENAI_USE_VERTEXAI=1" `
    --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROD_PROJECT_ID" `
    --set-env-vars "GOOGLE_CLOUD_LOCATION=us-central1" `
    --set-env-vars "XERO_CLIENT_ID=$XERO_CLIENT_ID" `
    --set-env-vars "XERO_CLIENT_SECRET=$XERO_CLIENT_SECRET" `
    --set-env-vars "XERO_REDIRECT_URI=$XERO_REDIRECT_URI" `
    --set-env-vars "SIMPRO_BASE_URL=$SIMPRO_BASE_URL" `
    --set-env-vars "SIMPRO_TOKEN=$SIMPRO_TOKEN" `
    --set-env-vars "SIMPRO_WEBHOOK_SECRET=$SIMPRO_WEBHOOK_SECRET" `
    --set-env-vars "SIMPRO_ATTENDANCE_WRITE=$SIMPRO_ATTENDANCE_WRITE" `
    --set-env-vars "SIMPRO_POLL_ENABLED=$SIMPRO_POLL_ENABLED" `
    --memory 1Gi `
    --cpu 1 `
    --concurrency 500 `
    --min-instances 0 `
    --max-instances 1 `
    --project=$PROJECT_ID `
    --quiet

# ── STEP 8 — Service Account Secret (Biometric) ───────────
Write-Host ""
Write-Host "Step 8: Setting biometric service account credentials..." -ForegroundColor Yellow
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = "Continue"
if (Get-Variable -Name "GOOGLE_SERVICE_ACCOUNT_JSON" -ErrorAction SilentlyContinue) {
    $secretName = "GOOGLE_SERVICE_ACCOUNT_JSON"
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
    Write-Host "  GOOGLE_SERVICE_ACCOUNT_JSON not in .env.staging — biometric sync unavailable in staging." -ForegroundColor Yellow
}
$ErrorActionPreference = $prevEAP

# ── Done ───────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " STAGING DEPLOYMENT COMPLETE"               -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green

$STAGING_URL = gcloud run services describe $SERVICE_NAME `
    --region $REGION --project $PROJECT_ID --format="value(status.url)" 2>&1
Write-Host ""
Write-Host " Staging URL: $STAGING_URL" -ForegroundColor Cyan
Write-Host ""
Write-Host " NEXT STEPS:" -ForegroundColor Yellow
Write-Host "  1. Open the staging URL above and test your changes"           -ForegroundColor White
Write-Host "  2. If .env.staging SERVICE_URL is blank, update it with the"  -ForegroundColor White
Write-Host "     URL above and re-run this script (-SkipBuild -SkipInfrastructure)" -ForegroundColor White
Write-Host "  3. Add the staging callback URL to Google OAuth Console:"      -ForegroundColor White
Write-Host "     $STAGING_URL/api/auth/callback/google"                      -ForegroundColor Cyan
Write-Host "  4. Happy with staging? Run deploy.ps1 to push to LIVE."        -ForegroundColor White
Write-Host ""
Write-Host " To refresh staging data from production later, run:"            -ForegroundColor DarkGray
Write-Host "  .\external-tools\deploy-staging.ps1 -SkipBuild -SkipInfrastructure" -ForegroundColor DarkGray
Write-Host ""
