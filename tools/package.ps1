$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$outputRoot = Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
foreach ($name in @('index.html','styles.css','app.js','i18n.js','telegram.js','gioi-thieu.html','quyen-rieng-tu.html','dieu-khoan.html','_headers','_routes.json')) { Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination (Join-Path $outputRoot $name) -Force }
$imageOutput = Join-Path $outputRoot 'assets/processed-v1/img'
New-Item -ItemType Directory -Path $imageOutput -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'assets/processed-v1/layout-v1.json') -Destination (Join-Path $outputRoot 'assets/processed-v1/layout-v1.json') -Force
Get-ChildItem -LiteralPath (Join-Path $projectRoot 'assets/processed-v1/img') -Filter 'scene-vn-*.webp' | Copy-Item -Destination $imageOutput -Force
foreach ($id in @('short-light','curly-dark','curly-medium','bun-light','bun-dark','ponytail-medium')) {
  foreach ($pose in @('bow-1','bow-2','bow-3','sit','beads')) { Copy-Item -LiteralPath (Join-Path $projectRoot "assets/processed-v1/img/visitor-$id-$pose.webp") -Destination $imageOutput -Force }
}
Write-Output 'Static files packaged in dist. Deploy with Wrangler from project root to include functions/.'
