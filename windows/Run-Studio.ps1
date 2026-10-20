param([string]$Root = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
Set-Location $Root
$node = 'C:\Program Files\nodejs\node.exe'
$env:Path = 'C:\Program Files\Git\cmd;C:\Program Files\nodejs;' + $env:Path
New-Item -ItemType Directory -Force (Join-Path $Root '.studio\logs') | Out-Null
& $node (Join-Path $Root 'server.js') *>> (Join-Path $Root '.studio\logs\server.log')
exit $LASTEXITCODE
