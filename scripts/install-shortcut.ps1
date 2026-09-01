[CmdletBinding()]
param(
    [string]$ShortcutName = 'Skechu-PPT'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $PSScriptRoot 'launch.ps1'
$icon = Join-Path $repoRoot 'assets\brand\skechu-ppt-mark.ico'
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop ($ShortcutName + '.lnk')
$powerShell = (Get-Command powershell.exe -ErrorAction Stop).Source

if (-not (Test-Path -LiteralPath $launcher)) {
    throw 'Skechu-PPT launcher was not found.'
}
if (-not (Test-Path -LiteralPath $icon)) {
    throw 'Skechu-PPT icon was not found.'
}
if (-not (Test-Path -LiteralPath $desktop)) {
    throw 'Windows desktop folder was not found.'
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powerShell
$shortcut.Arguments = '-NoLogo -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $launcher + '"'
$shortcut.WorkingDirectory = $repoRoot
$shortcut.IconLocation = $icon + ',0'
$shortcut.Description = 'Open Skechu-PPT local vector tracing studio'
$shortcut.WindowStyle = 7
$shortcut.Save()

Write-Output $shortcutPath
