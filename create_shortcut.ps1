$ws = New-Object -ComObject WScript.Shell
$desktop = [System.Environment]::GetFolderPath('Desktop')
$ch = [string][char]0x56FA + [char]0x5B9A + [char]0x8D44 + [char]0x4EA7 + [char]0x7BA1 + [char]0x7406 + [char]0x7CFB + [char]0x7EDF + [char]0x79BB + [char]0x7EBF + [char]0x7248
$scp = Join-Path $desktop ($ch + '.lnk')
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sc = $ws.CreateShortcut($scp)
$sc.TargetPath = Join-Path $dir 'index.html'
$sc.WorkingDirectory = $dir
$sc.Save()
Write-Host "OK: $scp"
