$SERVICE_NAME = "attendance-app"
$logs = gcloud logging read "resource.labels.service_name=$SERVICE_NAME" --limit 500 --format="json" | ConvertFrom-Json
foreach ($log in $logs) {
    if ($log.textPayload -like "*PrismaClientKnownRequestError*" -or $log.textPayload -like "*Can't reach database server*") {
        Write-Host "DATABASE ERROR: " $log.textPayload
    }
    if ($log.textPayload -like "*[Auth] Error in signIn callback*") {
        Write-Host "AUTH CALLBACK ERROR: " $log.textPayload
    }
}
