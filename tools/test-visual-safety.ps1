param([Parameter(Mandatory=$true)][string]$Fixture)
$ErrorActionPreference = 'Stop'
$full = [IO.Path]::GetFullPath($Fixture)
$temp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
if (-not $full.StartsWith($temp, [StringComparison]::OrdinalIgnoreCase) -or
    (Split-Path $full -Leaf) -notmatch '^kp-visual-test-') { throw 'Temporary test fixture required.' }
. (Join-Path $full 'tools/serve.ps1') -NoServe
$files = @($TargetFile, $DataFile, $FrFile, $LayoutFile, (Join-Path $Root 'sitemap.xml'))
$before = @{}
foreach ($file in $files) { $before[$file] = [Convert]::ToBase64String([IO.File]::ReadAllBytes($file)) }
$catalog = @(Get-VisualCatalog)
$source = $catalog | Where-Object { $_.kind -eq 'source' } | Select-Object -First 1
$project = $catalog | Where-Object { $_.kind -eq 'project' -and -not $_.list } | Select-Object -First 1
# Force a late failure after French and source text writes, on this copy only.
function Save-Project { throw 'Simulated write failure' }
$result = Save-Visual ([pscustomobject]@{
  stamp=(Get-FileStamp); layout=(Read-Layout); edits=@(
    [pscustomobject]@{id=$source.id;lang='fr';text='Test de restauration FR'}
    [pscustomobject]@{id=$source.id;lang='en';text='Rollback test EN'}
    [pscustomobject]@{id=$project.id;lang='en';text='Rollback project test'}
  )
})
if ($result.ok -or $result.reason -ne 'Simulated write failure') { throw 'Expected write failure was not reached.' }
foreach ($file in $files) {
  if ([Convert]::ToBase64String([IO.File]::ReadAllBytes($file)) -cne $before[$file]) { throw 'Rollback did not restore every file.' }
}
Write-Output 'PASS late write failure restores all files byte for byte'
