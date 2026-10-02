# Build with the existing tsdown configuration, then preserve links by writing artifacts in-place.
$ErrorActionPreference = 'Stop'
$node = 'C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
$lines = & $node (Join-Path $PSScriptRoot 'build-memory.mjs')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$line = $lines | Where-Object { $_ -like 'DSH_ARTIFACTS:*' }
if (-not $line) { throw 'No artifacts returned' }
$artifacts = $line.Substring(14) | ConvertFrom-Json
foreach ($artifact in $artifacts) {
  if ($artifact.name -notin @('client.js', 'index.js', 'index.d.ts')) { throw "Unexpected artifact $($artifact.name)" }
  $target = Join-Path 'D:\Project\Code\dsh-your-turn\lib' $artifact.name
  [System.IO.File]::WriteAllText($target, $artifact.content, [System.Text.UTF8Encoding]::new($false))
  Write-Output "Built $($artifact.name) ($($artifact.content.Length) chars)"
}
