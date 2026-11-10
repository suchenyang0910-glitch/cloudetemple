param(
  [ValidateSet('production','staging')][string]$Environment='production',
  [switch]$IncludeFamilyCandidate
)
$ErrorActionPreference = 'Stop'
if($IncludeFamilyCandidate -and $Environment -ne 'production'){throw 'Family candidate is production-only'}
$projectRoot = Split-Path -Parent $PSScriptRoot
$outputRoot = Join-Path $projectRoot 'dist'
$archiveRoot = Join-Path $projectRoot ('_archive/package-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff'))
if (Test-Path -LiteralPath $outputRoot) {
  $resolvedOutput = (Resolve-Path -LiteralPath $outputRoot).Path
  if ($resolvedOutput -ne [IO.Path]::GetFullPath((Join-Path $projectRoot 'dist')) -or
      -not [IO.Path]::GetFullPath($archiveRoot).StartsWith([IO.Path]::GetFullPath($projectRoot) + [IO.Path]::DirectorySeparatorChar)) { throw 'Unexpected package/archive path' }
  New-Item -ItemType Directory -Path $archiveRoot -Force | Out-Null
  Move-Item -LiteralPath $resolvedOutput -Destination (Join-Path $archiveRoot 'dist')
}
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
foreach ($name in @('index.html','preload.js','styles.css','app.js','config.js','i18n.js','telegram.js','audio.js','resources.js','beads.js','bow.js','incense.js','morning.js','festival.js','gioi-thieu.html','quyen-rieng-tu.html','dieu-khoan.html','_headers','_routes.json')) { Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination (Join-Path $outputRoot $name) -Force }
Copy-Item -Path (Join-Path $projectRoot 'static/*') -Destination $outputRoot -Recurse -Force
$appFile=Join-Path $outputRoot 'app.js'
$appSource=[IO.File]::ReadAllText($appFile).Replace('__CT_FAMILY_ENABLED__',$(if($Environment -eq 'staging'){'1'}else{'0'}))
[IO.File]::WriteAllText($appFile,$appSource,[Text.UTF8Encoding]::new($false))
$imageOutput = Join-Path $outputRoot 'assets/processed-v1/img'
New-Item -ItemType Directory -Path $imageOutput -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'assets/processed-v1/layout-v1.json') -Destination (Join-Path $outputRoot 'assets/processed-v1/layout-v1.json') -Force
Get-ChildItem -LiteralPath (Join-Path $projectRoot 'assets/processed-v1/img') -Filter 'scene-vn-*.webp' | Copy-Item -Destination $imageOutput -Force
foreach ($id in @('short-light','curly-dark','curly-medium','bun-light','bun-dark','ponytail-medium')) {
  foreach ($pose in @('bow-1','bow-2','bow-3','choose-v1','mo-1-v1','mo-2-v1','mo-3-v1','beads-side-1-v1','beads-side-2-v1','beads-side-3-v1')) { Copy-Item -LiteralPath (Join-Path $projectRoot "assets/processed-v1/img/visitor-$id-$pose.webp") -Destination $imageOutput -Force }
  foreach ($pose in @('walk-1','walk-2','hold','light','vai-1','vai-2','plant-1','end')) { Copy-Item -LiteralPath (Join-Path $projectRoot "assets/processed-v1/img/visitor-$id-inc-$pose-v1.webp") -Destination $imageOutput -Force }
  Copy-Item -LiteralPath (Join-Path $projectRoot "assets/processed-v1/img/visitor-$id-stand.webp") -Destination $imageOutput -Force
  foreach ($pose in @('sit','beads')) { Copy-Item -LiteralPath (Join-Path $projectRoot "assets/processed-v1/img/visitor-$id-$pose-nocushion.webp") -Destination $imageOutput -Force }
}
Write-Output 'Static files packaged in dist. Deploy with Wrangler from project root to include functions/.'

$audioOutput = Join-Path $outputRoot 'assets/audio'
New-Item -ItemType Directory -Path $audioOutput -Force | Out-Null
foreach ($sound in @('bell-v2','keisu-v2','mo','bead-v1','ignite-v1','ambient-courtyard','ambient-rain','breath-4-6','breath-4-4','breath-5-7')) {
  foreach ($ext in @('mp3','m4a')) { Copy-Item -LiteralPath (Join-Path $projectRoot "assets/audio/$sound.$ext") -Destination $audioOutput }
}
foreach ($name in @('LICENSES.md','measurements.json','measurements-v2.json')) { Copy-Item -LiteralPath (Join-Path $projectRoot "assets/audio/$name") -Destination $audioOutput }
foreach ($name in @('bead-wood-v2.webp','bead-spacer-v2.webp','bead-guru-v2.webp','share-qr.png')) { Copy-Item -LiteralPath (Join-Path $projectRoot "assets/processed-v1/img/$name") -Destination $imageOutput -Force }
Copy-Item -LiteralPath (Join-Path $projectRoot 'assets/processed-v1/mobile') -Destination (Join-Path $outputRoot 'assets/processed-v1') -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'assets/fonts') -Destination (Join-Path $outputRoot 'assets') -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot 'assets/share') -Destination (Join-Path $outputRoot 'assets') -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot 'assets/festival') -Destination (Join-Path $outputRoot 'assets') -Recurse
$debugOutput=Join-Path $outputRoot 'audio-debug.js'
Copy-Item -LiteralPath (Join-Path $projectRoot 'analytics.js') -Destination $outputRoot
$index=Join-Path $outputRoot 'index.html'
$html=[IO.File]::ReadAllText($index)
$banner=[IO.File]::ReadAllText((Join-Path $projectRoot 'analytics-choice.html'))
$html=$html.Replace('</main>',$banner+'</main>')
[IO.File]::WriteAllText($index,$html,[Text.UTF8Encoding]::new($false))
if($Environment -eq 'staging' -or $IncludeFamilyCandidate){
  foreach ($name in @('family.html','family.css','family.js','family-analytics.js','family-i18n.js')) { Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination $outputRoot -Force }
  Copy-Item -LiteralPath (Join-Path $projectRoot 'assets/family') -Destination (Join-Path $outputRoot 'assets') -Recurse -Force
}
if($Environment -eq 'staging'){
  Copy-Item -LiteralPath (Join-Path $projectRoot 'dev-outbox.js') -Destination $outputRoot -Force
  $devOutput=Join-Path $outputRoot 'dev'
  New-Item -ItemType Directory -Path $devOutput -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $projectRoot 'dev-outbox.html') -Destination (Join-Path $devOutput 'outbox.html') -Force
  Copy-Item -LiteralPath (Join-Path $projectRoot 'audio-debug.js') -Destination $debugOutput -Force
  $html=[IO.File]::ReadAllText($index).Replace('</body>','<script type="module" src="audio-debug.js"></script></body>')
  [IO.File]::WriteAllText($index,$html,[Text.UTF8Encoding]::new($false))
}else{
  $analytics=Join-Path $outputRoot 'analytics.js'
  $source=[IO.File]::ReadAllText($analytics).Replace('const debug={debug_mode:true};','const debug={};')
  if($source.Contains('debug_mode')){throw 'Production analytics still contains debug_mode'}
  [IO.File]::WriteAllText($analytics,$source,[Text.UTF8Encoding]::new($false))
}
$config=Join-Path $outputRoot 'config.js'
$configSource=[IO.File]::ReadAllText($config).Replace('__CT_BEAD_GURU_RULE__',$(if($Environment -eq 'staging'){'turn-back'}else{'pass-through'}))
[IO.File]::WriteAllText($config,$configSource,[Text.UTF8Encoding]::new($false))
& node (Join-Path $PSScriptRoot 'version-assets.mjs')
if($LASTEXITCODE){throw 'Versioning failed'}
$checkArgs=@("--$Environment")
if($IncludeFamilyCandidate){$checkArgs+='--family-candidate'}
& node (Join-Path $projectRoot 'tests/package-check.mjs') $checkArgs
if($LASTEXITCODE){throw 'Package assertions failed'}
