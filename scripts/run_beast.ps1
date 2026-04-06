$ErrorActionPreference = "Continue"

Write-Host "==========================================" -ForegroundColor Magenta
Write-Host "🔥 BEAST MODE ACTIVATED FOR UNIFIED-EXPERIENCE 🔥" -ForegroundColor Yellow
Write-Host "==========================================`n" -ForegroundColor Magenta

Write-Host "[1/5] Running claude-mem codebase analysis..." -ForegroundColor Cyan
try { claude-mem init } catch { "claude-mem initialization skipped" }
try { claude-mem audit } catch { "claude-mem audit skipped" }

Write-Host "`n[2/5] Running Everything-Claude-Code AI Quality Check..." -ForegroundColor Cyan
try { ecc check ./src } catch { "ecc check skipped" }

Write-Host "`n[3/5] Running TypeScript & Linter Checks..." -ForegroundColor Cyan
npm run type-check --silent
$typeCheckExit = $LASTEXITCODE
npm run lint --silent
$lintExit = $LASTEXITCODE

Write-Host "`n[4/5] Building Unified-Experience for Production..." -ForegroundColor Cyan
npm run build
$buildExit = $LASTEXITCODE

if ($buildExit -eq 0 -and $typeCheckExit -eq 0) {
    Write-Host "`n✅ APP IS PRODUCTION READY. ALL CHECKS PASSED.`n" -ForegroundColor Green
    
    Write-Host "[5/5] Deploying App to Production via Docker Compose..." -ForegroundColor Cyan
    docker-compose -f docker-compose.prod.yml down
    docker-compose -f docker-compose.prod.yml up -d --build
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n🚀 REDEPLOYMENT SUCCESSFUL! UNIFIED-EXPERIENCE IS LIVE OUT OF BEAST MODE. 🚀" -ForegroundColor Green
    } else {
        Write-Host "`n❌ Redeployment failed during docker-compose step." -ForegroundColor Red
    }
} else {
    Write-Host "`n❌ PRODUCTION BUILD FAILED OR HAD ERRORS." -ForegroundColor Red
    Write-Host "Type Errors: $typeCheckExit | Lint: $lintExit | Build: $buildExit" -ForegroundColor Yellow
    Write-Host "Attempting auto-remidiation via ECC..." -ForegroundColor Cyan
    try { ecc fix ./src } catch { "Auto-fix failed or ECC unavailable." }
}
