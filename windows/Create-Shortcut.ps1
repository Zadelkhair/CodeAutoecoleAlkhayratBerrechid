param([string]$Root = (Split-Path $PSScriptRoot -Parent), [string]$TargetUser = 'Guest_')
$ErrorActionPreference = 'Stop'
$Root = [System.IO.Path]::GetFullPath($Root)
$candidates = @(
    'C:\Program Files\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
)
$browser = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (!$browser) { throw 'Install Google Chrome or Microsoft Edge before creating the studio shortcut.' }
$desktop = "C:\Users\$TargetUser\Desktop"
if (!(Test-Path -LiteralPath $desktop)) { throw 'The target user desktop was not found.' }
$shortcutPath = Join-Path $desktop 'Code Alkhayrat Studio.lnk'
$iconPath = Join-Path $Root '.studio\assets\studio.ico'
$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcutPath)
# Explorer may prohibit PowerShell for restricted accounts. The server is managed
# by its scheduled task; the desktop shortcut only opens the allowed browser.
$shortcut.TargetPath = $browser
$shortcut.Arguments = '--app=http://localhost:5080/ --no-first-run'
$shortcut.WorkingDirectory = $Root
$shortcut.IconLocation = if (Test-Path -LiteralPath $iconPath) { $iconPath } else { $browser }
$shortcut.Description = 'Code Alkhayrat - series, questions et enregistrements audio'
$shortcut.WindowStyle = 1
$shortcut.Save()
[pscustomobject]@{ path = $shortcutPath; target = $browser; icon = $shortcut.IconLocation }
