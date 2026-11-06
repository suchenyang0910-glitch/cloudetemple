param([ValidateSet('staging','production')][string]$Environment='staging',[switch]$ApprovedProduction)
$ErrorActionPreference='Stop'
if($Environment -eq 'production' -and !$ApprovedProduction){throw 'Production requires explicit user confirmation first.'}
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  if(git status --porcelain --untracked-files=no){throw 'Commit tracked changes before deployment.'}
  & powershell -ExecutionPolicy Bypass -File tools/package.ps1
  if($LASTEXITCODE){throw 'Packaging failed'}
  $release=(git rev-parse --short=12 HEAD).Trim()
  $archive=Join-Path $PSScriptRoot "chuamay-$release.tar.gz"
  tar -czf $archive --exclude=server/node_modules --exclude=server/*.sqlite* --exclude=server/api.env --exclude=server/*.env -- dist server deploy/activate.sh deploy/check-secret-permissions.sh deploy/backup.sh
  if($LASTEXITCODE){throw 'Archive failed'}
  scp $archive "root@159.223.92.104:/tmp/chuamay-$release.tar.gz"
  if($LASTEXITCODE){throw 'Upload failed'}
  $gate=if($ApprovedProduction){'approved'}else{''}
  ssh root@159.223.92.104 "set -e; mkdir -p /opt/chuamay/$Environment/releases/$release; tar -xzf /tmp/chuamay-$release.tar.gz -C /opt/chuamay/$Environment/releases/$release; bash /opt/chuamay/$Environment/releases/$release/deploy/activate.sh $Environment $release $gate"
  if($LASTEXITCODE){throw 'Deployment failed; inspect rollback status.'}
} finally { Pop-Location }
