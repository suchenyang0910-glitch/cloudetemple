param([ValidateSet('production','staging')][string]$Environment='production')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$outputRoot = Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
foreach ($name in @('index.html','styles.css','app.js','i18n.js','telegram.js','audio.js','resources.js','beads.js','bow.js','gioi-thieu.html','quyen-rieng-tu.html','dieu-khoan.html','_headers','_routes.json')) { Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination (Join-Path $outputRoot $name) -Force }
$imageOutput = Join-Path $outputRoot 'assets/processed-v1/img'
New-Item -ItemType Directory -Path $imageOutput -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'assets/processed-v1/layout-v1.json') -Destination (Join-Path $outputRoot 'assets/processed-v1/layout-v1.json') -Force
Get-ChildItem -LiteralPath (Join-Path $projectRoot 'assets/processed-v1/img') -Filter 'scene-vn-*.webp' | Copy-Item -Destination $imageOutput -Force
foreach ($id in @('short-light','curly-dark','curly-medium','bun-light','bun-dark','ponytail-medium')) {
  foreach ($pose in @('bow-1','bow-2','bow-3','sit','beads','choose-v1')) { Copy-Item -LiteralPath (Join-Path $projectRoot "assets/processed-v1/img/visitor-$id-$pose.webp") -Destination $imageOutput -Force }
}
Write-Output 'Static files packaged in dist. Deploy with Wrangler from project root to include functions/.'

$audioOutput = Join-Path $outputRoot 'assets/audio'
New-Item -ItemType Directory -Path $audioOutput -Force | Out-Null
Get-ChildItem -LiteralPath (Join-Path $projectRoot 'assets/audio') -File | Copy-Item -Destination $audioOutput -Force
foreach ($name in @('mo.webp','mo-mallet.webp')) { Copy-Item -LiteralPath (Join-Path $projectRoot "assets/processed-v1/img/$name") -Destination $imageOutput -Force }
Copy-Item -LiteralPath (Join-Path $projectRoot 'assets/processed-v1/mobile') -Destination (Join-Path $outputRoot 'assets/processed-v1') -Recurse -Force
$debugOutput=Join-Path $outputRoot 'audio-debug.js'
if($Environment -eq 'staging'){
  Copy-Item -LiteralPath (Join-Path $projectRoot 'audio-debug.js') -Destination $debugOutput -Force
  $index=Join-Path $outputRoot 'index.html'
  $html=[IO.File]::ReadAllText($index).Replace('</body>','<script type="module" src="audio-debug.js"></script></body>')
  [IO.File]::WriteAllText($index,$html,[Text.UTF8Encoding]::new($false))
}elseif(Test-Path -LiteralPath $debugOutput){Remove-Item -LiteralPath $debugOutput}
if($Environment -eq 'production'){Get-ChildItem -LiteralPath $outputRoot -Filter 'audio-debug.*.js' | Remove-Item -Force}
& node (Join-Path $PSScriptRoot 'version-assets.mjs')
if($LASTEXITCODE){throw 'Versioning failed'}
