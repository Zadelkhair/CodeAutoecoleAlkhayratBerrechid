param([string]$Root = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
Set-Location $Root
$runtimeName = if ([Environment]::Is64BitOperatingSystem) { 'node-v24.22.0-win-x64' } else { 'node-v22.23.3-win-x86' }
$nodeFolder = Join-Path $Root ('.studio\runtime\' + $runtimeName)
$node = Join-Path $nodeFolder 'node.exe'
$env:Path = $nodeFolder + ';C:\Program Files\Git\cmd;' + $env:Path
New-Item -ItemType Directory -Force (Join-Path $Root '.studio\logs') | Out-Null
& $node (Join-Path $Root 'server.js') *>> (Join-Path $Root '.studio\logs\server.log')
exit $LASTEXITCODE
