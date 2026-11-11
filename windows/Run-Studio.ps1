param([string]$Root = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
Set-Location $Root
$runtimeName = if ([Environment]::Is64BitOperatingSystem) { 'node-v24.22.0-win-x64' } else { 'node-v22.23.3-win-x86' }
$nodeFolder = Join-Path $Root ('.studio\runtime\' + $runtimeName)
$node = Join-Path $nodeFolder 'node.exe'
$env:Path = $nodeFolder + ';C:\Program Files\Git\cmd;' + $env:Path
New-Item -ItemType Directory -Force (Join-Path $Root '.studio\logs') | Out-Null
# Windows PowerShell 5 treats native stderr as error records. Node logs handled
# API/Git errors there; they must not terminate the launcher or its server.
# Keep logging those records and preserve Node's real exit code for restarts.
$ErrorActionPreference = 'Continue'
& $node (Join-Path $Root 'server.js') *>> (Join-Path $Root '.studio\logs\server.log')
exit $LASTEXITCODE
