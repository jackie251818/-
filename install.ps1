$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

function U([int[]]$codes) { return -join ($codes | ForEach-Object { [char]$_ }) }

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$cnTitle  = U @(0x56FA, 0x5B9A, 0x8D44, 0x4EA7, 0x7BA1, 0x7406, 0x7CFB, 0x7EDF)
$cnInstall = U @(0x5B89, 0x88C5)
$cnDesktop = U @(0x684C, 0x9762)
$cnError   = U @(0x9519, 0x8BEF)
$cnOk      = U @(0x6210, 0x529F)
$cnWarning = U @(0x8B66, 0x544A)
$cnExit    = U @(0x6309, 0x56DE, 0x8F66, 0x952E, 0x9000, 0x51FA)
$cnDoubleClick = U @(0x53CC, 0x51FB, 0x5373, 0x53EF, 0x8FD0, 0x884C)
$cnShortcut = U @(0x521B, 0x5EFA, 0x684C, 0x9762, 0x5FEB, 0x6377, 0x65B9, 0x5F0F)
$cnCopyExe = U @(0x590D, 0x5236, 0x5230, 0x684C, 0x9762)
$cnFallback = U @(0x6539, 0x4E3A, 0x5C1D, 0x8BD5)
$cnNotFound = U @(0x672A, 0x627E, 0x5230, 0x53EF, 0x6267, 0x884C, 0x6587, 0x4EF6)
$cnDistErr  = U @(0x8BF7, 0x5148, 0x8FD0, 0x884C, 0x20, 0x6E, 0x70, 0x20, 0x7279, 0x522B)
$cnSteps   = U @(0x64CD, 0x4F5C, 0x6B65, 0x9AA4)
$cnPath    = U @(0x8DEF, 0x5F84)
$cnFound   = U @(0x627E, 0x5230, 0x7A0B, 0x5E8F)
$cnIcon    = U @(0x684C, 0x9762, 0x56FE, 0x6807)
$cnFail    = U @(0x5B89, 0x88C5, 0x5931, 0x8D25)
$cnDesc    = U @(0x56FA, 0x5B9A, 0x8D44, 0x4EA7, 0x7406, 0x7CFB, 0x7EDF, 0x20, 0x2D, 0x20, 0x4FBF, 0x5E6A, 0x5F0F)
$colon = [char]0xFF1A
$excl  = [char]0xFF01
$successMsg = $cnOk + $excl
$failMsg    = $cnFail + $excl

Write-Host ''
Write-Host '====================================================' -ForegroundColor Cyan
Write-Host "  $cnTitle$cnDesktop$cnInstall" -ForegroundColor Cyan
Write-Host '====================================================' -ForegroundColor Cyan
Write-Host ''

# Locate portable exe
$distDir = Join-Path $scriptDir 'dist'

if (-not (Test-Path $distDir)) {
    Write-Host "[$cnError] dist $cnDistErr" -ForegroundColor Red
    Write-Host ''
    Read-Host $cnExit
    exit 1
}

$allExes = Get-ChildItem -Path $distDir -Filter '*.exe' -File -ErrorAction SilentlyContinue
$exePath = $null

foreach ($exe in $allExes) {
    if ($exe.Name -notlike 'win-unpacked*' -and $exe.Name -notlike 'electron*') {
        $exePath = $exe.FullName
        break
    }
}

if (-not $exePath) {
    Write-Host "[$cnError] $cnNotFound" -ForegroundColor Red
    Write-Host ''
    Write-Host "  $cnSteps" -ForegroundColor Yellow
    Write-Host '    1. npm install' -ForegroundColor Yellow
    Write-Host '    2. npm run build' -ForegroundColor Yellow
    Write-Host ''
    Read-Host $cnExit
    exit 1
}

Write-Host "$($cnFound)$colon $exePath" -ForegroundColor Green
Write-Host ''

# Get desktop path
$desktop = [Environment]::GetFolderPath('Desktop')
if (-not (Test-Path $desktop)) {
    $desktop = Join-Path $env:USERPROFILE 'Desktop'
}
Write-Host "$($cnDesktop)$($cnPath)$colon $desktop" -ForegroundColor Gray
Write-Host ''

# Create desktop shortcut
$lnkPath = Join-Path $desktop ($cnTitle + '.lnk')
$exeDir  = Split-Path $exePath -Parent
$exeName = Split-Path $exePath -Leaf
$shortcutCreated = $false
$fallbackMsg = $null
$destMsg = $null

Write-Host "$cnShortcut" -ForegroundColor Yellow

try {
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($lnkPath)
    $shortcut.TargetPath = $exePath
    $shortcut.WorkingDirectory = $exeDir
    $shortcut.Description = $cnDesc
    $shortcut.IconLocation = $exePath
    $shortcut.Save()

    if (Test-Path $lnkPath) {
        $shortcutCreated = $true
    }
} catch {
    Write-Host "[$cnWarning] $cnShortcut $colon $_" -ForegroundColor Yellow
}

# Fallback: copy exe directly
if (-not $shortcutCreated) {
    Write-Host "$cnFallback$cnCopyExe" -ForegroundColor Yellow
    $destExe = Join-Path $desktop $exeName
    try {
        Copy-Item -Path $exePath -Destination $destExe -Force
        $shortcutCreated = $true
        $fallbackMsg = U @(0x5DF2, 0x590D, 0x5236, 0x5230, 0x684C, 0x9762)
        $destMsg = "$($cnPath)$colon $destExe"
    } catch {
        Write-Host "[$cnError] $_" -ForegroundColor Red
        Write-Host ''
        Read-Host $cnExit
        exit 1
    }
}

# Success output
Write-Host ''
Write-Host '====================================================' -ForegroundColor Green
if ($shortcutCreated) {
    if ($fallbackMsg) {
        Write-Host "  $fallbackMsg" -ForegroundColor Green
        Write-Host "  $destMsg" -ForegroundColor Green
    } else {
        Write-Host "  $successMsg" -ForegroundColor Green
        Write-Host "  $cnIcon$colon $cnTitle" -ForegroundColor Green
    }
    Write-Host "  $cnDoubleClick" -ForegroundColor Green
} else {
    Write-Host "  $failMsg" -ForegroundColor Red
}
Write-Host '====================================================' -ForegroundColor Green
Write-Host ''
Read-Host $cnExit
