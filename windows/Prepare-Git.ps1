param([string]$TargetUser = 'Guest_')
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$folder = "C:\Users\$TargetUser\AppData\Local\CodeAlkhayratStudio"
New-Item -ItemType Directory -Force $folder | Out-Null
$key = Join-Path $folder 'github_ed25519'
if (!(Test-Path $key)) {
    $generator = 'C:\Windows\System32\OpenSSH\ssh-keygen.exe'
    $process = Start-Process -FilePath $generator -ArgumentList @('-q', '-t', 'ed25519', '-f', $key, '-N', '""', '-C', 'CodeAlkhayratStudio') -Wait -PassThru -NoNewWindow
    if ($process.ExitCode -ne 0) { throw 'SSH key creation failed' }
}
$account = $env:COMPUTERNAME + '\' + $TargetUser
& icacls $key /inheritance:r /grant:r ($account + ':R') '*S-1-5-18:F' '*S-1-5-32-544:F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Unable to restrict the private key permissions' }
& icacls $key /setowner $account | Out-Null
[pscustomobject]@{ publicKey = (Get-Content ($key + '.pub') -Raw).Trim(); keyPath = $key } | ConvertTo-Json -Compress
