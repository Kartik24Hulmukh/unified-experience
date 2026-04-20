param(
  [ValidateSet('dispatch', 'latest')]
  [string]$Action = 'dispatch',

  [string]$Owner = '',
  [string]$Repo = '',
  [string]$Workflow = 'staging-security-gate.yml',
  [string]$Ref = 'main',
  [string]$Token = '',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Resolve-RepoContext {
  param(
    [string]$Owner,
    [string]$Repo
  )

  if ($Owner -and $Repo) {
    return @{ Owner = $Owner; Repo = $Repo }
  }

  $originUrl = ''
  try {
    $originUrl = (git config --get remote.origin.url 2>$null)
  } catch {
    $originUrl = ''
  }

  if ($originUrl) {
    $normalized = $originUrl.Trim()

    if ($normalized -match 'github\.com[:/](?<owner>[^/]+)/(?<repo>[^/.]+)(?:\.git)?$') {
      return @{ Owner = $Matches['owner']; Repo = $Matches['repo'] }
    }
  }

  $fromEnv = $env:GITHUB_REPOSITORY
  if ($fromEnv -and $fromEnv.Contains('/')) {
    $parts = $fromEnv.Split('/', 2)
    return @{ Owner = $parts[0]; Repo = $parts[1] }
  }

  throw "Owner/Repo not provided. Pass -Owner and -Repo, ensure git remote.origin points to GitHub, or set GITHUB_REPOSITORY=<owner>/<repo>."
}

function Read-GitHubApiError {
  param([System.Management.Automation.ErrorRecord]$ErrorRecord)

  $statusCode = -1
  $bodyText = ''
  $message = $ErrorRecord.Exception.Message

  $resp = $ErrorRecord.Exception.Response
  if ($resp) {
    try {
      $statusCode = [int]$resp.StatusCode
    } catch {}
  }

  if ($ErrorRecord.ErrorDetails -and $ErrorRecord.ErrorDetails.Message) {
    $bodyText = $ErrorRecord.ErrorDetails.Message
  }

  if (-not $bodyText) {
    $bodyText = $message
  }

  [PSCustomObject]@{
    StatusCode = $statusCode
    Body = $bodyText
  }
}

function Throw-FriendlyApiError {
  param(
    [string]$Operation,
    [string]$Workflow,
    [string]$Owner,
    [string]$Repo,
    [PSCustomObject]$ApiError
  )

  $status = $ApiError.StatusCode
  $body = $ApiError.Body

  if ($status -eq 404) {
    throw "$Operation failed (404). Workflow '$Workflow' was not found in $Owner/$Repo on GitHub, or this token cannot read workflow metadata. Ensure the workflow file is committed and pushed to the target ref. API: $body"
  }

  if ($status -eq 403) {
    throw "$Operation failed (403). Token is not authorized for Actions workflow operations on $Owner/$Repo. Use a token with workflow/actions permissions for this repository. API: $body"
  }

  throw "$Operation failed ($status). API: $body"
}

$ctx = Resolve-RepoContext -Owner $Owner -Repo $Repo
$ownerValue = $ctx.Owner
$repoValue = $ctx.Repo

if (-not $Token) {
  $Token = $env:GITHUB_TOKEN
}

if (-not $DryRun -and -not $Token) {
  throw "Missing GitHub token. Set GITHUB_TOKEN or pass -Token."
}

$apiBase = "https://api.github.com/repos/$ownerValue/$repoValue/actions/workflows/$Workflow"
$commonHeaders = @{
  Accept = 'application/vnd.github+json'
  'X-GitHub-Api-Version' = '2022-11-28'
}

if ($Token) {
  $commonHeaders.Authorization = "Bearer $Token"
}

if ($Action -eq 'dispatch') {
  $dispatchUri = "$apiBase/dispatches"
  $payload = @{
    ref = $Ref
    inputs = @{ ref = $Ref }
  }

  if ($DryRun) {
    Write-Output "DRY_RUN dispatch endpoint: $dispatchUri"
    Write-Output "DRY_RUN payload: $($payload | ConvertTo-Json -Depth 6 -Compress)"
    exit 0
  }

  try {
    Invoke-RestMethod -Method Post -Uri $dispatchUri -Headers $commonHeaders -Body ($payload | ConvertTo-Json -Depth 6) -ContentType 'application/json'
  } catch {
    $apiError = Read-GitHubApiError -ErrorRecord $_
    Throw-FriendlyApiError -Operation 'Workflow dispatch' -Workflow $Workflow -Owner $ownerValue -Repo $repoValue -ApiError $apiError
  }

  Write-Output "Workflow dispatch requested: $Workflow on ref $Ref"
  exit 0
}

if ($Action -eq 'latest') {
  $runsUri = "$apiBase/runs?event=workflow_dispatch&branch=$Ref&per_page=10"

  if ($DryRun) {
    Write-Output "DRY_RUN runs endpoint: $runsUri"
    exit 0
  }

  try {
    $runs = Invoke-RestMethod -Method Get -Uri $runsUri -Headers $commonHeaders
  } catch {
    $apiError = Read-GitHubApiError -ErrorRecord $_
    Throw-FriendlyApiError -Operation 'Workflow runs lookup' -Workflow $Workflow -Owner $ownerValue -Repo $repoValue -ApiError $apiError
  }

  $run = $runs.workflow_runs | Select-Object -First 1

  if (-not $run) {
    Write-Output "No workflow_dispatch runs found for $Workflow on branch $Ref"
    exit 2
  }

  $summary = [PSCustomObject]@{
    workflow = $Workflow
    id = $run.id
    status = $run.status
    conclusion = $run.conclusion
    html_url = $run.html_url
    created_at = $run.created_at
    updated_at = $run.updated_at
    head_branch = $run.head_branch
    head_sha = $run.head_sha
  }

  $summary | ConvertTo-Json -Depth 5
  exit 0
}
