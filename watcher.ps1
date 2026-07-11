# Quick Fill Auto-Updater
# Run this once — it stays in background and auto-updates the extension
# Press Ctrl+C or close the window to stop

$extPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$gitUrl = "https://raw.githubusercontent.com/Drakuu/Auto-Fill/main/version.json"
$checkInterval = 120 # seconds

Write-Host "Quick Fill Auto-Updater running..." -ForegroundColor Cyan
Write-Host "Watching: $extPath" -ForegroundColor Gray
Write-Host "Checking every $checkInterval seconds" -ForegroundColor Gray
Write-Host ""

while ($true) {
    try {
        $remoteJson = (Invoke-WebRequest -Uri "$gitUrl?t=$(Get-Date -UFormat %s)" -UseBasicParsing).Content
        $remote = $remoteJson | ConvertFrom-Json
        
        if (Test-Path "$extPath\version.json") {
            $local = Get-Content "$extPath\version.json" | ConvertFrom-Json
            
            if ($remote.version -ne $local.version) {
                Write-Host "$(Get-Date -Format HH:mm:ss) Update detected: $($local.version) -> $($remote.version)" -ForegroundColor Yellow
                
                Set-Location -LiteralPath $extPath
                git pull
                
                # Update version.json with new version + pull timestamp
                $newJson = @{ version = $remote.version; lastPull = (Get-Date -UFormat %s) } | ConvertTo-Json -Compress
                $newJson | Set-Content "$extPath\version.json" -Force
                
                Write-Host "$(Get-Date -Format HH:mm:ss) Update applied! Extension will reload automatically." -ForegroundColor Green
            }
        } else {
            # First run — save current version
            $remoteJson | Set-Content "$extPath\version.json" -Force
            Write-Host "$(Get-Date -Format HH:mm:ss) Initial version saved: $($remote.version)" -ForegroundColor Gray
        }
    } catch {
        # Silent on errors (offline, etc.)
    }
    
    Start-Sleep -Seconds $checkInterval
}
