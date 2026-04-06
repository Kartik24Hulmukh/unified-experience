Write-Host "Waiting for berozgar-api-prod container to become healthy..." -ForegroundColor Yellow

do {
    Write-Host "." -NoNewline
    Start-Sleep -Seconds 5
    $status = docker inspect -f '{{.State.Health.Status}}' berozgar-api-prod 2> $null
} while ($status -ne 'healthy')

Write-Host "
Container is healthy! Pushing Prisma DB schema..." -ForegroundColor Cyan
docker exec berozgar-api-prod npx prisma db push --accept-data-loss
Write-Host "DB Push Complete! Running seed..." -ForegroundColor Cyan
docker exec berozgar-api-prod npm run db:seed
Write-Host "
Database successfully migrated and seeded for production! Enjoy BEAST MODE!" -ForegroundColor Green
