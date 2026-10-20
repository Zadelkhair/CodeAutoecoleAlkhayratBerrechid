param([string]$Root = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
Set-Location $Root
$nodeFolder = Join-Path $Root '.studio\runtime\node-v24.22.0-win-x64'
$node = Join-Path $nodeFolder 'node.exe'
$env:Path = $nodeFolder + ';C:\Program Files\Git\cmd;' + $env:Path
New-Item -ItemType Directory -Force (Join-Path $Root '.studio\logs') | Out-Null
& $node (Join-Path $Root 'server.js') *>> (Join-Path $Root '.studio\logs\server.log')
exit $LASTEXITCODE
