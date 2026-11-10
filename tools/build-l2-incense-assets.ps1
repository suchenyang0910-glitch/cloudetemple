$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'assets/processed-v1/img'
$review = Join-Path $root 'review/l2-incense-ritual'
$poses = 'walk-1','walk-2','hold','light','vai-1','vai-2','plant-1','end'
$visitors = 'bun-light','short-light','curly-dark','curly-medium','bun-dark','ponytail-medium'

foreach ($visitor in $visitors) {
  foreach ($pose in $poses) {
    if ($visitor -eq 'bun-light') {
      $source = if ($pose -eq 'light') {
        Join-Path $review 'scene-validation-v4/visitor-bun-light-inc-light-v4.png'
      } elseif ($pose -eq 'plant-1') {
        Join-Path $review 'scene-validation-v4/visitor-bun-light-inc-plant-natural-v4.png'
      } else {
        Join-Path $review "v3-frames-560x960/visitor-bun-light-inc-$pose-v3.png"
      }
    } else {
      $source = Join-Path $review "remaining-five/frames-560x960/visitor-$visitor-inc-$pose-review.png"
    }
    $target = Join-Path $out "visitor-$visitor-inc-$pose-v1.webp"
    & ffmpeg -hide_banner -loglevel error -y -i $source -c:v libwebp -quality 92 -compression_level 5 -pix_fmt yuva420p $target
    if ($LASTEXITCODE) { throw "ffmpeg failed: $source" }
  }
}

$periods = 'dawn','day','dusk','night'
foreach ($period in $periods) {
  $source = Join-Path $review "formal-patches/source-$period-ai-edit.png"
  $target = Join-Path $out "scene-vn-hall-side-incense-patch-$period.webp"
  # Only the empty incense/smoke area and the removed cushion are visible in this overlay.
  $filter = "color=c=black@0:s=941x1672,format=rgba,drawbox=x=238:y=500:w=150:h=430:color=white@1:t=fill,drawbox=x=650:y=1080:w=291:h=315:color=white@1:t=fill,gblur=sigma=9[mask];[0:v]format=rgba[base];[base][mask]alphamerge"
  & ffmpeg -hide_banner -loglevel error -y -i $source -filter_complex $filter -c:v libwebp -quality 92 -compression_level 5 -pix_fmt yuva420p $target
  if ($LASTEXITCODE) { throw "ffmpeg failed: $source" }
}

Write-Output "Built $($visitors.Count * $poses.Count) visitor frames and $($periods.Count) scene patches."
