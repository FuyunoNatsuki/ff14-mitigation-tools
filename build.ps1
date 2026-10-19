# Builds single-file versions of mitigation-planner.html by inlining css/, data/ and js/.
#   dist/MitigationPlanner.html : standalone page (open it directly, e.g. the Desktop copy)
#   online/index.html           : the claude.ai page version (the publisher adds its own html/head/body)
# Usage: powershell -ExecutionPolicy Bypass -File build.ps1
$root = $PSScriptRoot
$utf8 = New-Object Text.UTF8Encoding $false
$read = { param($rel) [IO.File]::ReadAllText((Join-Path $root $rel), [Text.Encoding]::UTF8) }

$html = & $read 'mitigation-planner.html'
# <link rel="stylesheet" href="css/..."> -> <style>...</style>
$html = [regex]::Replace($html, '<link rel="stylesheet" href="((?:css)/[^"]+)">', {
  param($m) "<style>`n" + (& $read $m.Groups[1].Value).TrimEnd() + "`n</style>" })
# <script src="data/... or js/..."></script> -> inline script
$html = [regex]::Replace($html, '<script src="((?:data|js)/[^"]+)"></script>', {
  param($m) "<script>`n" + (& $read $m.Groups[1].Value).TrimEnd() + "`n</script>" })
# config.js (database URL, not in git): inline it when it exists, otherwise drop the tag.
# The output files contain the URL, so do not commit or publish dist/ or online/ outside your own use.
$config = Join-Path $root 'config.js'
$configTag = '<script src="config.js"></script>'
if (Test-Path $config) {
  $html = $html.Replace($configTag, "<script>`n" + ([IO.File]::ReadAllText($config, [Text.Encoding]::UTF8)).TrimEnd() + "`n</script>")
} else {
  Write-Warning 'config.js not found: shared rooms will not work in the built files (copy config.example.js to config.js).'
  $html = $html.Replace($configTag, '')
}

New-Item -ItemType Directory -Force (Join-Path $root 'dist') | Out-Null
[IO.File]::WriteAllText((Join-Path $root 'dist\MitigationPlanner.html'), $html, $utf8)
Write-Output 'Wrote dist\MitigationPlanner.html'

$online = $html -replace '(?is)^\s*<!doctype html>\s*<html[^>]*>\s*<head>\s*', ''
$online = $online -replace '(?i)<meta charset="utf-8">\s*', ''
$online = $online -replace '(?i)<meta name="viewport"[^>]*>\s*', ''
$online = $online -replace '(?i)</head>\s*<body>\s*', "`n"
$online = $online -replace '(?is)\s*</body>\s*</html>\s*$', "`n"
New-Item -ItemType Directory -Force (Join-Path $root 'online') | Out-Null
[IO.File]::WriteAllText((Join-Path $root 'online\index.html'), $online, $utf8)
Write-Output 'Wrote online\index.html'
