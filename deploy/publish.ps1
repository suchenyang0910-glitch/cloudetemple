param([ValidateSet('staging','production')][string]$Environment='staging',[switch]$ApprovedProduction)
$ErrorActionPreference='Stop'
if($Environment -eq 'production' -and !$ApprovedProduction){throw 'Production requires explicit user confirmation first.'}
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  if(git status --porcelain --untracked-files=no){throw 'Commit tracked changes before deployment.'}
  & powershell -ExecutionPolicy Bypass -File tools/package.ps1 -Environment $Environment
  if($LASTEXITCODE){throw 'Packaging failed'}
  $release=(git rev-parse --short=12 HEAD).Trim()
  $archive=Join-Path $PSScriptRoot "chuamay-$release.tar.gz"
  $tarArgs=@('-czf',$archive,'--exclude=server/node_modules','--exclude=server/*.sqlite*','--exclude=server/api.env','--exclude=server/*.env')
  if($Environment -eq 'production'){$tarArgs+='--exclude=server/outbox-staging.mjs'}
  $tarArgs+=@('dist','server','deploy/activate.sh','deploy/check-secret-permissions.sh','deploy/backup.sh')
  & tar @tarArgs
  if($LASTEXITCODE){throw 'Archive failed'}
  if($Environment -eq 'production'){
    $entries=& tar -tzf $archive
    if($LASTEXITCODE){throw 'Archive inspection failed'}
    if($entries -match '(^|/)(dev-outbox[^/]*|dev/outbox\.html|outbox-staging\.mjs)$'){throw 'Production archive contains staging outbox code'}
  }
  scp $archive "root@159.223.92.104:/tmp/chuamay-$release.tar.gz"
  if($LASTEXITCODE){throw 'Upload failed'}
  $gate=if($ApprovedProduction){'approved'}else{''}
  ssh root@159.223.92.104 "set -e; mkdir -p /opt/chuamay/$Environment/releases/$release; tar -xzf /tmp/chuamay-$release.tar.gz -C /opt/chuamay/$Environment/releases/$release; bash /opt/chuamay/$Environment/releases/$release/deploy/activate.sh $Environment $release $gate"
  if($LASTEXITCODE){throw 'Deployment failed; inspect rollback status.'}
} finally { Pop-Location }
