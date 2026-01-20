# PowerShell script to run database migrations on Google Cloud Run Jobs
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

$IMAGE_NAME = "gcr.io/$PROJECT_ID/$SERVICE_NAME"
$CLOUD_SQL_CONN = "$PROJECT_ID:$CLOUD_SQL_REGION:$CLOUD_SQL_INSTANCE"
$CLOUD_RUN_DATABASE_URL = "postgresql://${DATABASE_USER}:${DATABASE_PASS_ENCODED}@localhost/${DATABASE_NAME}?host=/cloudsql/$CLOUD_SQL_CONN"

Write-Host "Updating migrate-db job to use npm run db:setup..." -ForegroundColor Yellow
gcloud run jobs update migrate-db `
  --image $IMAGE_NAME `
  --region $REGION `
  --set-env-vars "NODE_ENV=production,DATABASE_URL=$CLOUD_RUN_DATABASE_URL" `
  --set-cloudsql-instances $CLOUD_SQL_CONN `
  --command "npm" `
  --args "run,db:setup"

Write-Host "Executing migrate-db job..." -ForegroundColor Yellow
gcloud run jobs execute migrate-db --region $REGION --wait

Write-Host "Database migration and seeding complete!" -ForegroundColor Green
