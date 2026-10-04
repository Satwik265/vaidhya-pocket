# Direct smoke test for packaged MedScribeAI sidecar binary

$ErrorActionPreference = "Stop"

$ProjectRoot = (Get-Item $PSScriptRoot).Parent.FullName
$TargetExe = Join-Path $ProjectRoot "src-tauri\binaries\medscribe-backend-x86_64-pc-windows-msvc.exe"

if (-not (Test-Path $TargetExe)) {
    throw "Sidecar executable not found at: $TargetExe"
}

Write-Host "Starting sidecar executable: $TargetExe" -ForegroundColor Cyan
$proc = Start-Process -FilePath $TargetExe -PassThru -NoNewWindow

try {
    # Wait for server to bind port 8000
    $bound = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Milliseconds 500
        try {
            $resp = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -Method Get -TimeoutSec 2
            if ($resp.status -eq "ok") {
                $bound = $true
                break
            }
        }
        catch {
            # Still starting
        }
    }

    if (-not $bound) {
        throw "Backend failed to respond on http://127.0.0.1:8000/health within 15 seconds"
    }

    Write-Host "[1/3] GET /health ..." -ForegroundColor Green
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -Method Get
    Write-Host "Health: $(ConvertTo-Json -Compress $health)"

    Write-Host "`n[2/3] GET /version ..." -ForegroundColor Green
    $ver = Invoke-RestMethod -Uri "http://127.0.0.1:8000/version" -Method Get
    Write-Host "Version: $(ConvertTo-Json -Compress $ver)"

    Write-Host "`n[3/3] POST /api/v1/clinical/extract ..." -ForegroundColor Green
    $body = @{
        text = [System.Text.Encoding]::UTF8.GetString([System.Text.Encoding]::UTF8.GetBytes("mujhe sar dard bahut rehta hai"))
        language = "hi"
        source_id = "test-encounter-smoke"
    } | ConvertTo-Json -Compress

    $extract = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/clinical/extract" `
        -Method Post `
        -ContentType "application/json; charset=utf-8" `
        -Body $body

    Write-Host "Extract Response: $(ConvertTo-Json -Depth 5 $extract)"

    Write-Host "`n============================================================" -ForegroundColor Green
    Write-Host "ALL DIRECT SIDECAR SMOKE TESTS PASSED" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
}
finally {
    Write-Host "`nTerminating sidecar process (PID $($proc.Id))..." -ForegroundColor Yellow
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}
