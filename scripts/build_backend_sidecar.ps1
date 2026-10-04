# Build MedScribeAI Python Backend Sidecar for Tauri Desktop
# Target: src-tauri/binaries/medscribe-backend-x86_64-pc-windows-msvc.exe

$ErrorActionPreference = "Stop"

$ProjectRoot = (Get-Item $PSScriptRoot).Parent.FullName
$BackendDir = Join-Path $ProjectRoot "backend"
$SpecFile = Join-Path $BackendDir "medscribe_backend.spec"
$TargetDir = Join-Path $ProjectRoot "src-tauri\binaries"
$TargetExe = Join-Path $TargetDir "medscribe-backend-x86_64-pc-windows-msvc.exe"
$WorkPath = Join-Path $ProjectRoot "build_pyinstaller"
$DistPath = Join-Path $ProjectRoot "dist_pyinstaller"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "MedScribeAI - Building Python Backend Sidecar" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Project Root: $ProjectRoot"
Write-Host "Backend Dir:  $BackendDir"
Write-Host "Target Dir:   $TargetDir"

# Ensure target directory exists
if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
    Write-Host "Created target directory: $TargetDir" -ForegroundColor Green
}

# Verify Python
Write-Host ""
Write-Host "[1/4] Verifying Python runtime..." -ForegroundColor Yellow
$PythonVersion = python --version
Write-Host "Python: $PythonVersion"

# Verify PyInstaller is installed
Write-Host ""
Write-Host "[2/4] Verifying PyInstaller..." -ForegroundColor Yellow
python -m PyInstaller --version

# Run PyInstaller
Write-Host ""
Write-Host "[3/4] Running PyInstaller build..." -ForegroundColor Yellow
Push-Location $BackendDir
try {
    python -m PyInstaller --clean --noconfirm --workpath $WorkPath --distpath $DistPath $SpecFile
}
finally {
    Pop-Location
}

# Move output executable to src-tauri/binaries
$GeneratedExe = Join-Path $DistPath "medscribe-backend-x86_64-pc-windows-msvc.exe"
if (-not (Test-Path $GeneratedExe)) {
    throw "PyInstaller build succeeded but expected executable was not found at: $GeneratedExe"
}

Write-Host ""
Write-Host "[4/4] Placing executable in Tauri binaries directory..." -ForegroundColor Yellow
Copy-Item -Path $GeneratedExe -Destination $TargetExe -Force

# Clean temporary build/dist directories
if (Test-Path $WorkPath) {
    Remove-Item -Recurse -Force $WorkPath
}
if (Test-Path $DistPath) {
    Remove-Item -Recurse -Force $DistPath
}

# Verification
$FileInfo = Get-Item $TargetExe
$FileHash = (Get-FileHash -Path $TargetExe -Algorithm SHA256).Hash

$SizeMB = [math]::Round($FileInfo.Length / 1MB, 2)
$SizeBytes = $FileInfo.Length
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "SIDECAR BUILD SUCCESSFUL" -ForegroundColor Green
Write-Host "Artifact: $TargetExe"
Write-Host "Size MB:  $SizeMB"
Write-Host "Bytes:    $SizeBytes"
Write-Host "SHA-256:  $FileHash"
Write-Host "============================================================" -ForegroundColor Green
