# Run this when the extension shows "Update Available"
# It pulls latest code and reloads the extension

$extPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$extName = "Quick Fill"

Write-Host "Updating $extName..." -ForegroundColor Cyan
Write-Host "Path: $extPath" -ForegroundColor Gray

Set-Location -LiteralPath $extPath
git pull

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nUpdate pulled successfully!" -ForegroundColor Green
    Write-Host "Now click the '↻ Reload' button in the extension popup to apply." -ForegroundColor Yellow
} else {
    Write-Host "`nGit pull failed. Check for conflicts." -ForegroundColor Red
}

Write-Host "`nPress any key to close..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
