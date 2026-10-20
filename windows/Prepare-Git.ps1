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
$acl = New-Object Security.AccessControl.FileSecurity
$acl.SetAccessRuleProtection($true, $false)
$acl.SetOwner((New-Object Security.Principal.NTAccount($account)))
$acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($account, 'Read', 'Allow')))
foreach ($sid in @('S-1-5-18', 'S-1-5-32-544')) {
    $identity = New-Object Security.Principal.SecurityIdentifier($sid)
    $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'Allow')))
}
Set-Acl -LiteralPath $key -AclObject $acl
[pscustomobject]@{ publicKey = (Get-Content ($key + '.pub') -Raw).Trim(); keyPath = $key } | ConvertTo-Json -Compress
