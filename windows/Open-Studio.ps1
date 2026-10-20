param([string]$Root = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
$url = 'http://localhost:5080/'
try { $ready = (Invoke-RestMethod ($url + 'api/health') -TimeoutSec 2).ok } catch { $ready = $false }
if (!$ready) {
    Start-ScheduledTask -TaskName 'CodeAlkhayratStudio'
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Milliseconds 500
        try { if ((Invoke-RestMethod ($url + 'api/health') -TimeoutSec 2).ok) { $ready = $true; break } } catch {}
    }
}
if (!$ready) {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show('Le studio ne repond pas encore. Attendez quelques instants puis reessayez.', 'Code Alkhayrat Studio') | Out-Null
    exit 1
}
$candidates = @('C:\Program Files\Google\Chrome\Application\chrome.exe', 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe', 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe', 'C:\Program Files\Microsoft\Edge\Application\msedge.exe')
$browser = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($browser) { Start-Process -FilePath $browser -ArgumentList @('--app=http://localhost:5080/', '--no-first-run') }
else { Start-Process $url }
