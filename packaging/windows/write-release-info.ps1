$ErrorActionPreference = 'Stop'
$installer = Join-Path $PSScriptRoot '../../dist-installer/Skechu-PPT-Windows-Setup.exe'
$installer = (Resolve-Path -LiteralPath $installer).Path
$releaseDir = Split-Path -Parent $installer
$signature = Get-AuthenticodeSignature -LiteralPath $installer
$digest = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant()
[System.IO.File]::WriteAllText((Join-Path $releaseDir 'SHA256SUMS.txt'), "$digest  Skechu-PPT-Windows-Setup.exe`n")
$signature | Select-Object @{Name='Status';Expression={$_.Status.ToString()}}, StatusMessage, @{Name='Publisher';Expression={$_.SignerCertificate.Subject}} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $releaseDir 'signature-status.json') -Encoding UTF8
$notice = if ($signature.Status -eq 'Valid') { 'Installer signature verified during the release build. See signature-status.json for the publisher.' } else { '**Unsigned release / 尚未數位簽章。** Free OSS signing application materials are being prepared; no certificate approval has been granted. Windows may still warn. Do not disable Defender or SmartScreen. Browser-only editable PPTX export requires no installation.' }
$notes = @"
$notice

[Code signing policy / 安裝安全與隱私](https://github.com/evan6007/skechu-ppt/blob/main/docs/code-signing-policy.md)

SHA256SUMS.txt detects altered downloads; it is not a trusted publisher signature.
This per-user package includes the connector and runtime, not Microsoft PowerPoint. No administrator rights are required. Start the connector after installation, then return to the existing web tab. Browser clipboard and local-network consent remain browser-controlled.
"@
[System.IO.File]::WriteAllText((Join-Path $releaseDir 'release-notes.md'), $notes)
