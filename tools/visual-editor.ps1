# Loaded by serve.ps1: shares authentication, backups and existing serializers.
$LayoutFile = Join-Path $Root 'data\layout.js'
$LayoutGroups = @{
  home = @('clients', 'awards')
  about = @('expertise', 'specializations', 'experience', 'education', 'toolkit')
  technical = @('interests', 'studies')
  details = @('overview', 'contribution', 'pipeline')
  story = @('technicalChallenges', 'designIntent', 'rnd', 'recognition', 'impact')
}

function Read-Layout([string]$text) {
  if (-not $text) { $text = [IO.File]::ReadAllText($LayoutFile) }
  if ($text -notmatch '(?s)window\.KP_LAYOUT\s*=\s*(\{.*\})\s*;\s*$') { throw 'Disposition illisible.' }
  return ($Matches[1] | ConvertFrom-Json)
}

function Get-VisualCatalog {
  $dictionary = Read-FrDictionary
  $entries = New-Object System.Collections.Generic.List[object]
  $known = New-OrderedMap
  foreach ($it in (Get-Strings | Where-Object { $_.file -eq 'index' })) {
    $known[$it.text] = $true
    $entries.Add(@{ id = "s:$($it.line):$($it.start)"; kind = 'source'; en = $it.text
      fr = $(if ($dictionary.ui.Contains($it.text)) { $dictionary.ui[$it.text] } else { $it.text })
      section = $it.section; source = $it })
  }
  $n = 0
  foreach ($key in $dictionary.ui.Keys) {
    if (-not $known.Contains($key)) {
      $entries.Add(@{ id = "u:$n"; kind = 'ui'; en = $key; fr = $dictionary.ui[$key]; section = 'Interface' })
    }
    $n++
  }
  foreach ($rec in (Get-ProjectRecords)) {
    if ($rec.fields.Contains('protected')) { continue }
    foreach ($def in ($ProjectFields | Where-Object { $_.translate -and $_.kind -in @('text','para','list') })) {
      if (-not $rec.fields.Contains($def.key)) { continue }
      $en = @($rec.fields[$def.key])
      $translated = $en
      if ($dictionary.projects.Contains($rec.id) -and $dictionary.projects[$rec.id].Contains($def.key)) {
        $translated = @($dictionary.projects[$rec.id][$def.key])
      }
      for ($i = 0; $i -lt [Math]::Max($en.Count, $translated.Count); $i++) {
        $english = $(if ($i -lt $en.Count) { [string]$en[$i] } else { '' })
        $french = $(if ($i -lt $translated.Count) { [string]$translated[$i] } else { '' })
        if ($dictionary.ui.Contains($french)) { $french = $dictionary.ui[$french] }
        $entries.Add(@{ id = "p:$($rec.id):$($def.key):$i"; kind = 'project'; project = $rec.id
          field = $def.key; index = $i; list = ($def.kind -eq 'list'); en = $english; fr = $french
          section = $def.label })
      }
    }
  }
  return $entries.ToArray()
}

function Test-VisualLayout($layout) {
  if ($null -eq $layout -or $layout -isnot [pscustomobject]) { throw 'Disposition invalide.' }
  $projects = @(Get-ProjectRecords)
  $previous = Read-Layout
  foreach ($prop in $previous.PSObject.Properties) {
    if ($prop.Name -cmatch '^project:([a-z0-9-]+):(details|story)$') {
      $record = $projects | Where-Object { $_.id -ceq $Matches[1] } | Select-Object -First 1
      if ($record -and $record.fields.Contains('protected') -and
          (ConvertTo-Json -InputObject $layout.($prop.Name) -Compress) -cne (ConvertTo-Json -InputObject $prop.Value -Compress)) {
        throw 'Les blocs des fiches protegees ne se modifient pas.'
      }
    }
  }
  foreach ($prop in $layout.PSObject.Properties) {
    $group = $prop.Name
    $allowed = $LayoutGroups[$group]
    if ($group -cmatch '^project:([a-z0-9-]+):(details|story)$') {
      $id = $Matches[1]; $kind = $Matches[2]
      $rec = $projects | Where-Object { $_.id -ceq $id } | Select-Object -First 1
      if (-not $rec -or $rec.fields.Contains('protected')) {
        if ((ConvertTo-Json -InputObject $previous.$group -Compress) -ceq (ConvertTo-Json -InputObject $prop.Value -Compress)) { continue }
        throw 'Fiche absente ou protegee.'
      }
      $allowed = $LayoutGroups[$kind]
    } elseif ($group -cnotin @('home','about','technical')) { throw 'Groupe de blocs inconnu.' }
    if ($prop.Value -isnot [array]) { throw 'Liste de blocs attendue.' }
    $seen = @()
    foreach ($id in $prop.Value) {
      if ($id -isnot [string] -or $id -cnotin $allowed -or $id -cin $seen) { throw 'Bloc inconnu ou repete.' }
      $seen += $id
    }
  }
}

function Save-Visual($payload) {
  $snapshots = @{}
  try {
    if (-not $payload.stamp -or $payload.stamp -cne (Get-FileStamp)) { throw 'Les fichiers ont change. Recharge avant de poursuivre ; ton brouillon est conserve.' }
    $catalog = @{}
    foreach ($entry in (Get-VisualCatalog)) { $catalog[$entry.id] = $entry }
    $edits = @($payload.edits)
    if ($edits.Count -gt 1000) { throw 'Trop de modifications.' }
    $seen = @{}
    foreach ($change in $edits) {
      $entry = $catalog[[string]$change.id]
      if (-not $entry -or $change.lang -cnotin @('en','fr')) { throw 'Texte inconnu.' }
      if ($change.text -isnot [string] -or [string]::IsNullOrWhiteSpace($change.text) -or $change.text.Length -gt 20000) { throw 'Texte vide ou trop long.' }
      if (-not $entry[$change.lang] -or ($entry.kind -eq 'ui' -and $change.lang -eq 'en')) { throw 'Ce texte ne se modifie pas directement dans cette langue.' }
      $identity = "$($change.id):$($change.lang)"
      if ($seen.ContainsKey($identity)) { throw 'Modification dupliquee.' }
      $seen[$identity] = $true
    }
    Test-VisualLayout $payload.layout
    # Validate everything before touching files. Restore all bytes if a write fails.
    foreach ($path in @($TargetFile, $DataFile, $FrFile, $LayoutFile, (Join-Path $Root 'sitemap.xml'))) {
      $snapshots[$path] = [IO.File]::ReadAllBytes($path)
    }
    $frData = Read-FrDictionary
    $frChanged = $false
    foreach ($change in ($edits | Where-Object { $_.lang -eq 'fr' })) {
      $entry = $catalog[$change.id]
      if ($entry.kind -eq 'project') {
        if (-not $frData.projects.Contains($entry.project)) { $frData.projects[$entry.project] = New-OrderedMap }
        $fields = $frData.projects[$entry.project]
        if ($entry.list) {
          $values = @(if ($fields.Contains($entry.field)) { @($fields[$entry.field]) } else {
            $rec = Get-ProjectDetail $entry.project
            @($rec.values[$entry.field])
          })
          $values[$entry.index] = $change.text
          $fields[$entry.field] = $values
        } else { $fields[$entry.field] = $change.text }
      } else {
        $frData.ui[$entry.en] = $change.text
        $frData.stale = @($frData.stale | Where-Object { $_ -cne $entry.en })
      }
      $frChanged = $true
    }
    if ($frChanged) { Write-FrDictionary $frData (Get-FrSectionMap) }
    $sourceEdits = @()
    $projectEdits = @{}
    foreach ($change in ($edits | Where-Object { $_.lang -eq 'en' })) {
      $entry = $catalog[$change.id]
      if ($entry.kind -eq 'source') {
        $it = $entry.source
        $sourceEdits += @{ file='index'; line=$it.line; start=$it.start; len=$it.len; quote=$it.quote; raw=$it.raw; text=$change.text }
      } else {
        if (-not $projectEdits.ContainsKey($entry.project)) { $projectEdits[$entry.project] = (Get-ProjectDetail $entry.project).values }
        $fields = $projectEdits[$entry.project]
        if ($entry.list) { $fields[$entry.field][$entry.index] = $change.text }
        else { $fields[$entry.field] = $change.text }
      }
    }
    if ($sourceEdits.Count) {
      $result = Save-Strings $sourceEdits
      if (@($result.rejected).Count -or $result.applied -ne $sourceEdits.Count) { throw 'La source a change ; aucun texte enregistre.' }
    }
    foreach ($id in $projectEdits.Keys) {
      $result = Save-Project ([pscustomobject]@{ id=$id; values=[pscustomobject]$projectEdits[$id] })
      if (-not $result.ok) { throw $result.reason }
    }
    $layoutText = "// Section order, shared by both languages. Empty = original order.`r`nwindow.KP_LAYOUT = " + ($payload.layout | ConvertTo-Json -Depth 6) + ";`r`n"
    if ($layoutText -cne [IO.File]::ReadAllText($LayoutFile)) {
      Backup-Source (Get-Source 'layout')
      [IO.File]::WriteAllText($LayoutFile, $layoutText, [Text.UTF8Encoding]::new($false))
    }
    return @{ ok=$true; stamp=(Get-FileStamp) }
  } catch {
    $reason = $_.Exception.Message
    foreach ($path in $snapshots.Keys) { [IO.File]::WriteAllBytes($path, $snapshots[$path]) }
    return @{ ok=$false; reason=$reason }
  }
}

function Get-VisualChanges {
  $previous = Get-HeadContent 'data/layout.js'
  $before = if ($previous) { Read-Layout $previous.text } else { [pscustomobject]@{} }
  $after = Read-Layout
  foreach ($name in (@($before.PSObject.Properties.Name) + @($after.PSObject.Properties.Name) | Select-Object -Unique)) {
    if (-not $name) { continue }
    $was = @($before.$name) -join ' > '; $now = @($after.$name) -join ' > '
    if ($was -cne $now) {
      [pscustomobject]@{ line=0; section='Disposition des blocs'; label=$name; before=$(if ($was) {$was} else {'Ordre initial'}); after=$(if ($now) {$now} else {'Ordre initial'}) }
    }
  }
  $previous = Get-HeadContent 'data/fr.js'
  if (-not $previous) { return }
  $before = Expand-FrChanges (Read-FrDictionary $previous.text)
  $after = Expand-FrChanges (Read-FrDictionary)
  $keys = New-OrderedMap
  foreach ($key in @($before.Keys)+@($after.Keys)) { $keys[$key]=$true }
  foreach ($key in $keys.Keys) {
    if ($before[$key] -cne $after[$key]) {
      [pscustomobject]@{ line=0; section='Traductions'; label=$key; before=[string]$before[$key]; after=[string]$after[$key] }
    }
  }
}

function Expand-FrChanges($dictionary) {
  $flat = New-OrderedMap
  foreach ($section in @('ui','uiSection')) {
    foreach ($key in $dictionary[$section].Keys) { $flat["$section / $key"] = [string]$dictionary[$section][$key] }
  }
  foreach ($section in @('projects','head')) {
    foreach ($id in $dictionary[$section].Keys) {
      foreach ($field in $dictionary[$section][$id].Keys) { $flat["$section / $id / $field"] = @($dictionary[$section][$id][$field]) -join "`n" }
    }
  }
  $flat['Traductions a revoir'] = @($dictionary.stale) -join "`n"
  return ,$flat
}
