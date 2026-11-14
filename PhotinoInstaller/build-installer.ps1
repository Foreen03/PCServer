# BlueStep MSI Builder Script
# Run this script from PowerShell (as Administrator if updating installed instances)

$ErrorActionPreference = "Stop"

$wixBin = "C:\Program Files (x86)\WiX Toolset v3.14\bin"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$backendDir = Join-Path $projectRoot "Backend"
$installerDir = $scriptDir

# The published win-x64 output directory (contains ScreenRecorderLib.dll, frontend wwwroot, and recordings folder)
$publishDir = Join-Path $backendDir "bin\x64\Release\net8.0-windows10.0.19041.0\win-x64\publish"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Step 1: Publishing Backend (Release, win-x64)" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Set-Location $backendDir
dotnet publish Backend.csproj -r win-x64 -c Release -p:Platform=x64 --self-contained true

if (!(Test-Path "$publishDir\ScreenRecorderLib.dll")) {
    Write-Error "ScreenRecorderLib.dll was not found in $publishDir"
}

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Step 2: Harvesting files with heat.exe" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Set-Location $installerDir
& "$wixBin\heat.exe" dir "$publishDir" -gg -sfrag -scom -sreg -srd -dr INSTALLFOLDER -cg AppFiles -var var.PublishDir -out "$installerDir\Files.wxs"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Step 3: Compiling WiX objects with candle.exe" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
& "$wixBin\candle.exe" -dPublishDir="$publishDir" Package.wxs Files.wxs

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Step 4: Linking MSI installer with light.exe" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
# If BlueStep.msi is locked by Windows Installer service, retry or save to BlueStep_Release.msi
$outputMsi = "$installerDir\BlueStep.msi"
try {
    & "$wixBin\light.exe" -ext WixUIExtension "$installerDir\Package.wixobj" "$installerDir\Files.wixobj" -out $outputMsi
}
catch {
    Write-Warning "BlueStep.msi might be locked by another process (e.g. running installer). Generating BlueStep_Build.msi instead..."
    $outputMsi = "$installerDir\BlueStep_Build.msi"
    & "$wixBin\light.exe" -ext WixUIExtension "$installerDir\Package.wixobj" "$installerDir\Files.wixobj" -out $outputMsi
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "SUCCESS! Installer created at: $outputMsi" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

