Set-Location "$PSScriptRoot/.."
# Check if Proxy is running
$proxyProcess = Get-Process cloud-sql-proxy -ErrorAction SilentlyContinue
if (-not $proxyProcess) {
    Write-Host "Starting Cloud SQL Proxy in a new window..."
    Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "& '$PSScriptRoot\start_proxy.ps1'"
    Write-Host "Waiting 5 seconds for proxy to initialize..."
    Start-Sleep -Seconds 5
} else {
    Write-Host "Cloud SQL Proxy is already running."
}

# Set Environment to Production
$env:NODE_ENV="production"

# Run the Custom Server
Write-Host "Starting Production Server..."
# Using --skip-project to avoid issues with tsconfig collisions if any, but properly specifying commonjs
npx ts-node --project tsconfig.server.json server.ts
