param([string]$Root = (Split-Path $PSScriptRoot -Parent), [string]$TargetUser = 'Guest_')
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Root = [System.IO.Path]::GetFullPath($Root)
if (!(Test-Path (Join-Path $Root 'studio\network.js'))) { throw 'Run this installer from a complete Code Alkhayrat Studio checkout.' }
$git = 'C:\Program Files\Git\cmd\git.exe'
if (!(Test-Path $git)) { throw 'Git for Windows must be installed first.' }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
# Use a private, pinned LTS runtime. Do not replace Node used by other applications.
$nodeVersion = if ([Environment]::Is64BitOperatingSystem) { 'v24.22.0' } else { 'v22.23.3' }
$nodeArch = if ([Environment]::Is64BitOperatingSystem) { 'x64' } else { 'x86' }
$nodeName = 'node-' + $nodeVersion + '-win-' + $nodeArch
$runtime = Join-Path $Root '.studio\runtime'
$nodeFolder = Join-Path $runtime $nodeName
$node = Join-Path $nodeFolder 'node.exe'
if (!(Test-Path $node)) {
    New-Item -ItemType Directory -Force $runtime | Out-Null
    $archive = Join-Path $runtime ($nodeName + '.zip')
    $baseUrl = 'https://nodejs.org/dist/' + $nodeVersion + '/'
    $checksums = (Invoke-WebRequest -UseBasicParsing ($baseUrl + 'SHASUMS256.txt')).Content
    $match = [regex]::Match($checksums, ('(?m)^([a-f0-9]{64})\s+' + [regex]::Escape($nodeName + '.zip') + '\r?$'))
    if (!$match.Success) { throw 'Official Node.js checksum not found.' }
    Invoke-WebRequest -UseBasicParsing ($baseUrl + $nodeName + '.zip') -OutFile $archive
    if ((Get-FileHash $archive -Algorithm SHA256).Hash -ne $match.Groups[1].Value) { throw 'Node.js archive checksum mismatch. Installation stopped.' }
    Expand-Archive -Path $archive -DestinationPath $runtime -Force
}
$account = $env:COMPUTERNAME + '\' + $TargetUser
$privateFolder = "C:\Users\$TargetUser\AppData\Local\CodeAlkhayratStudio"
$key = Join-Path $privateFolder 'github_ed25519'
if (!(Test-Path $key)) { throw 'Prepare the repository-specific SSH key and authorize its public key on GitHub first.' }
Set-Location $Root
$env:Path = $nodeFolder + ';C:\Program Files\Git\cmd;' + $env:Path
& (Join-Path $nodeFolder 'npm.cmd') ci --omit=dev --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
& $node -e "require('./studio/network').createTLS(process.cwd());"
if ($LASTEXITCODE -ne 0) { throw 'Local HTTPS setup failed.' }

# Private keys and temporary audio never enter Git or the public website.
& icacls $Root /grant ($account + ':(OI)(CI)M') /T /C | Out-Null
& icacls (Join-Path $Root '.studio') /inheritance:r /grant:r ($account + ':(OI)(CI)F') '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' /T /C | Out-Null
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$meta = Invoke-RestMethod 'https://api.github.com/meta' -Headers @{ 'User-Agent' = 'CodeAlkhayratStudio-Installer' }
$knownHosts = Join-Path $privateFolder 'known_hosts'
$lines = @($meta.ssh_keys | ForEach-Object { 'github.com ' + $_ })
[IO.File]::WriteAllText($knownHosts, (($lines -join "`n") + "`n"), (New-Object Text.UTF8Encoding($false)))
$keyForward = $key.Replace('\', '/')
$knownForward = $knownHosts.Replace('\', '/')
$sshCommand = '"C:/Windows/System32/OpenSSH/ssh.exe" -i "' + $keyForward + '" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="' + $knownForward + '"'
$gitBase = @('-c', ('safe.directory=' + $Root))
& $git @gitBase config core.sshCommand $sshCommand
& $git @gitBase config user.name 'zad'
& $git @gitBase config user.email 'abdo.zad.raja2@gmail.com'
& $git @gitBase config core.autocrlf false
& $git @gitBase remote set-url origin 'git@github.com:Zadelkhair/CodeAutoecoleAlkhayratBerrechid.git'
if ($LASTEXITCODE -ne 0) { throw 'Git configuration failed.' }
& icacls $Root /setowner $account | Out-Null
& icacls (Join-Path $Root '.git') /setowner $account | Out-Null

# Draw the existing yellow steering-wheel mark and package it as a Windows icon.
Add-Type -AssemblyName System.Drawing
$assets = Join-Path $Root '.studio\assets'
New-Item -ItemType Directory -Force $assets | Out-Null
$bitmap = New-Object Drawing.Bitmap(256, 256)
$graphics = [Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([Drawing.ColorTranslator]::FromHtml('#EDC451'))
$pen = New-Object Drawing.Pen([Drawing.ColorTranslator]::FromHtml('#272B24'), 13)
$graphics.DrawEllipse($pen, 33, 33, 190, 190)
$graphics.DrawEllipse($pen, 110, 110, 36, 36)
$graphics.DrawLine($pen, 34, 108, 110, 108)
$graphics.DrawLine($pen, 146, 108, 222, 108)
$graphics.DrawLine($pen, 128, 147, 128, 222)
$graphics.DrawLine($pen, 61, 69, 195, 69)
$stream = New-Object IO.MemoryStream
$bitmap.Save($stream, [Drawing.Imaging.ImageFormat]::Png)
$png = $stream.ToArray()
$iconPath = Join-Path $assets 'studio.ico'
$iconStream = [IO.File]::Create($iconPath)
$writer = New-Object IO.BinaryWriter($iconStream)
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]1)
$writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0)
$writer.Write([uint16]1); $writer.Write([uint16]32); $writer.Write([uint32]$png.Length); $writer.Write([uint32]22); $writer.Write($png)
$writer.Dispose(); $stream.Dispose(); $graphics.Dispose(); $bitmap.Dispose(); $pen.Dispose()

$taskName = 'CodeAlkhayratStudio'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + (Join-Path $Root 'windows\Run-Studio.ps1') + '" -Root "' + $Root + '"') -WorkingDirectory $Root
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
$logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $account
try {
    $principal = New-ScheduledTaskPrincipal -UserId $account -LogonType S4U -RunLevel Limited
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @((New-ScheduledTaskTrigger -AtStartup), $logonTrigger) -Settings $settings -Principal $principal -Description 'Code Alkhayrat Studio - local administration and phone audio' -Force | Out-Null
    $taskMode = 'Startup + logon (no stored password)'
} catch {
    $principal = New-ScheduledTaskPrincipal -UserId $account -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $logonTrigger -Settings $settings -Principal $principal -Description 'Code Alkhayrat Studio - local administration and phone audio' -Force | Out-Null
    $taskMode = 'User logon'
}
if (!(Get-NetFirewallRule -Name 'CodeAlkhayratStudio-LAN' -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -Name 'CodeAlkhayratStudio-LAN' -DisplayName 'Code Alkhayrat Studio - LAN' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5080,5443 -RemoteAddress LocalSubnet -Profile Any -Program $node | Out-Null
}
$shell = New-Object -ComObject WScript.Shell
$desktop = "C:\Users\$TargetUser\Desktop"
$shortcutPath = Join-Path $desktop 'Code Alkhayrat Studio.lnk'
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
$shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + (Join-Path $Root 'windows\Open-Studio.ps1') + '" -Root "' + $Root + '"'
$shortcut.WorkingDirectory = $Root
$shortcut.IconLocation = $iconPath
$shortcut.Description = 'Code Alkhayrat - series, questions et enregistrements audio'
$shortcut.WindowStyle = 7
$shortcut.Save()
Start-ScheduledTask -TaskName $taskName
[pscustomobject]@{ root = $Root; shortcut = $shortcutPath; task = $taskName; taskMode = $taskMode; http = 'http://localhost:5080/'; https = 'https://localhost:5443/'; certificate = (Join-Path $Root '.studio\tls\root-ca.crt') } | ConvertTo-Json -Compress
