@echo off
setlocal
cd /d "%~dp0"

set "WIX_BIN=C:\Program Files (x86)\WiX Toolset v3.14\bin"
set "BACKEND_DIR=%~dp0..\Backend"
set "PUBLISH_DIR=%~dp0..\Backend\bin\x64\Release\net8.0-windows10.0.19041.0\win-x64\publish"

echo [1/4] Publishing Backend...
cd /d "%BACKEND_DIR%"
dotnet publish Backend.csproj -r win-x64 -c Release -p:Platform=x64 --self-contained true
if errorlevel 1 goto error

echo [2/4] Harvesting files with heat.exe...
cd /d "%~dp0"
"%WIX_BIN%\heat.exe" dir "%PUBLISH_DIR%" -gg -sfrag -scom -sreg -srd -dr INSTALLFOLDER -cg AppFiles -var var.PublishDir -out Files.wxs
if errorlevel 1 goto error

echo [3/4] Compiling with candle.exe...
"%WIX_BIN%\candle.exe" -dPublishDir="%PUBLISH_DIR%" Package.wxs Files.wxs
if errorlevel 1 goto error

echo [4/4] Linking MSI with light.exe...
"%WIX_BIN%\light.exe" -ext WixUIExtension Package.wixobj Files.wixobj -out BlueStep.msi
if errorlevel 1 goto error

echo.
echo ========================================================
echo SUCCESS! BlueStep.msi built successfully.
echo ========================================================
goto end

:error
echo.
echo [ERROR] Build failed. Check the error message above.
pause
exit /b 1

:end
pause

