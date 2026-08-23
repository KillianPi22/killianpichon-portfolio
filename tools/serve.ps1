<#
  Editeur de contenu local + serveur de previsualisation.
  Lance-le en double-cliquant sur tools\edit-site.cmd

  - Sert le site statique sur http://localhost:8000/
  - Sert l'editeur sur http://localhost:8000/__editor
  - Ecrit les corrections de texte directement dans index.html
  - S'arrete tout seul quand l'editeur est ferme (battement de coeur)

  Ne fait partie d'aucun deploiement : GitHub Pages sert des fichiers
  statiques et n'execute jamais ce script.
#>

param(
  [int]$Port = 8000,
  [switch]$NoBrowser,
  [int]$IdleTimeoutSeconds = 25
)

$ErrorActionPreference = "Stop"

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root       = Split-Path -Parent $ScriptDir
$TargetFile = Join-Path $Root "index.html"
$BackupDir  = Join-Path $ScriptDir ".backups"

$DiagLog    = Join-Path $ScriptDir ".diagnostic-ping.log"

# Chemins que le serveur de fichiers ne divulgue jamais, resolus une fois pour
# toutes. Ils vivent dans le dossier du site mais n'en font pas partie.
$ForbiddenPaths = @(
  (Join-Path $ScriptDir "auth.json"),
  $BackupDir,
  $DiagLog,
  (Join-Path $Root ".git"),
  (Join-Path $Root ".claude")
) | ForEach-Object { [System.IO.Path]::GetFullPath($_) }

# ------------------------------------------------------------- diagnostic
# Mesure temporaire, destinee a comprendre pourquoi le serveur s'arrete en
# pleine session de travail. Elle ne change rien au comportement : elle note
# seulement l'ecart entre deux battements de l'editeur quand il depasse le
# seuil, et la raison de l'arret. L'hypothese a verifier est que Chrome
# ralentit le minuteur de l'editeur quand son onglet passe en arriere-plan,
# jusqu'a franchir la tolerance du serveur. L'editeur envoie donc l'etat de
# visibilite de son onglet avec chaque battement.
# A retirer une fois la cause etablie.
#
# Le journal doit rester lisible sans jamais devenir ambigu : une ligne de
# synthese par minute prouve que l'editeur bat toujours, une ligne dediee
# marque chaque battement en retard, et chaque facon de s'arreter laisse sa
# trace. L'absence de ligne ne doit jamais pouvoir signifier deux choses.
$DiagGapThreshold = 8
$DiagSummaryEvery = 60

function Write-Diag([string]$line) {
  try {
    $stamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    Add-Content -Path $DiagLog -Value "$stamp  $line" -Encoding utf8
  } catch {
    # Le diagnostic ne doit jamais interrompre le serveur.
  }
}

if (-not (Test-Path $TargetFile)) { throw "index.html introuvable dans $Root" }
if (-not (Test-Path $BackupDir))  { New-Item -ItemType Directory -Path $BackupDir | Out-Null }

# --------------------------------------------------------------- mot de passe
# auth.json contient un sel aleatoire et une empreinte PBKDF2 du mot de passe :
# le mot de passe lui-meme n'y figure pas et ne peut pas en etre deduit.
# Le fichier est ignore par Git (depot public) et ne quitte donc jamais la machine.
# Cree-le avec tools\set-password.cmd
$AuthFile = Join-Path $ScriptDir "auth.json"

function Get-Pbkdf2([string]$password, [byte[]]$salt, [int]$iter) {
  $d = New-Object System.Security.Cryptography.Rfc2898DeriveBytes(
        $password, $salt, $iter, [System.Security.Cryptography.HashAlgorithmName]::SHA256)
  try { return $d.GetBytes(32) } finally { $d.Dispose() }
}

# comparaison a duree constante : ne revele pas ou la difference se situe
function Test-BytesEqual([byte[]]$a, [byte[]]$b) {
  if ($a.Length -ne $b.Length) { return $false }
  $diff = 0
  for ($i = 0; $i -lt $a.Length; $i++) { $diff = $diff -bor ($a[$i] -bxor $b[$i]) }
  return ($diff -eq 0)
}

if (-not (Test-Path $AuthFile)) {
  Write-Host ""
  Write-Host "  Aucun mot de passe defini."
  Write-Host "  Lance d'abord tools\set-password.cmd, puis relance edit-site.cmd."
  Write-Host ""
  Read-Host "  Appuie sur Entree pour fermer"
  return
}

$auth = Get-Content $AuthFile -Raw | ConvertFrom-Json
$AuthSalt = [Convert]::FromBase64String($auth.salt)
$AuthHash = [Convert]::FromBase64String($auth.hash)
$AuthIter = [int]$auth.iter

function Test-Password([string]$candidate) {
  if ([string]::IsNullOrEmpty($candidate)) { return $false }
  return Test-BytesEqual (Get-Pbkdf2 $candidate $AuthSalt $AuthIter) $AuthHash
}

# jetons de session en memoire : rien n'est ecrit sur le disque
$sessions = @{}
$failCount = 0
$lockUntil = [datetime]::MinValue

function New-SessionToken {
  $b = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  $t = [Convert]::ToBase64String($b)
  $sessions[$t] = (Get-Date).AddHours(12)
  return $t
}

function Test-SessionToken([string]$t) {
  if ([string]::IsNullOrEmpty($t)) { return $false }
  if (-not $sessions.ContainsKey($t)) { return $false }
  if ((Get-Date) -gt $sessions[$t]) { $sessions.Remove($t); return $false }
  return $true
}

# ---------------------------------------------------------------- mime types
$mime = @{
  ".html"="text/html; charset=utf-8"; ".htm"="text/html; charset=utf-8"
  ".css"="text/css; charset=utf-8"; ".js"="application/javascript; charset=utf-8"
  ".json"="application/json; charset=utf-8"; ".xml"="application/xml; charset=utf-8"
  ".txt"="text/plain; charset=utf-8"; ".svg"="image/svg+xml"
  ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".gif"="image/gif"
  ".webp"="image/webp"; ".avif"="image/avif"; ".ico"="image/x-icon"
  ".mp4"="video/mp4"; ".webm"="video/webm"
  ".woff"="font/woff"; ".woff2"="font/woff2"; ".ttf"="font/ttf"; ".otf"="font/otf"
}

# ------------------------------------------------------------ scan des textes
$pattern = @'
(?<q>['"])(?<val>(?:\\.|(?!\k<q>).)*)\k<q>
'@
$rx = [regex]::new($pattern.Trim())

function Test-Editorial([string]$v) {
  if ($v.Length -lt 4) { return $false }
  if ($v -notmatch '\s') { return $false }
  if ($v -match 'var\(--|[0-9]+px|[0-9]+%|rgba?\(|#[0-9a-fA-F]{3,6}\b|cubic-bezier|linear-gradient|repeating-|translate|scale\(|blur\(|/\*|http[s]?://') { return $false }
  if ($v -match '^\s*[0-9]+\s*/\s*[0-9]+\s*$') { return $false }
  if ($v -match '^[\s0-9.,/*+\-]+$') { return $false }
  if ($v -match '^[Mm][\s0-9.,\-]') { return $false }
  if ($v -match '^[A-Za-z]?[\s0-9.,\-]+[A-Za-z]?[\s0-9.,\-]*$') { return $false }
  if ($v -match '^(flex|grid|none|block|absolute|relative|sticky|center|space-between|inline-flex|column|row|hidden|auto|pointer|not-allowed|uppercase|transparent|repeat\(|x mandatory|y mandatory)') { return $false }
  if ($v -match '^[a-z-]+ (var|[0-9])') { return $false }
  if ($v -match '^[\s\\]*(\\x[0-9A-Fa-f]{2}|\\u[0-9A-Fa-f]{4})[\s\\]*$') { return $false }
  if ($v -notmatch '[A-Za-z]{2}') { return $false }
  return $true
}

# Litteral source -> texte lisible.
# if/elseif volontaire : `continue` dans un switch PowerShell sort du switch,
# pas de la boucle, ce qui dupliquait silencieusement un caractere.
function ConvertFrom-SourceLiteral([string]$s) {
  $sb = New-Object System.Text.StringBuilder
  $i = 0
  while ($i -lt $s.Length) {
    $c = $s[$i]
    if ($c -ne '\' -or $i + 1 -ge $s.Length) { [void]$sb.Append($c); $i++; continue }
    $n = $s[$i+1]
    if     ($n -eq 'n')  { [void]$sb.Append("`n"); $i += 2 }
    elseif ($n -eq 't')  { [void]$sb.Append("`t"); $i += 2 }
    elseif ($n -eq 'r')  { $i += 2 }
    elseif ($n -eq '\')  { [void]$sb.Append('\');  $i += 2 }
    elseif ($n -eq "'")  { [void]$sb.Append("'");  $i += 2 }
    elseif ($n -eq '"')  { [void]$sb.Append('"');  $i += 2 }
    elseif ($n -eq 'x' -and $i + 3 -lt $s.Length) {
      [void]$sb.Append([char][Convert]::ToInt32($s.Substring($i+2, 2), 16)); $i += 4
    }
    elseif ($n -eq 'u' -and $i + 5 -lt $s.Length) {
      [void]$sb.Append([char][Convert]::ToInt32($s.Substring($i+2, 4), 16)); $i += 6
    }
    else { [void]$sb.Append($c); $i++ }
  }
  return $sb.ToString()
}

# Texte lisible -> litteral source (UTF-8 brut conserve : le fichier en contient deja)
function ConvertTo-SourceLiteral([string]$s, [char]$quote) {
  $s = $s -replace '\\', '\\'
  $s = $s.Replace("`r", '')
  $s = $s.Replace("`n", '\n')
  $s = $s.Replace("`t", '\t')
  if ($quote -eq "'") { $s = $s.Replace("'", "\'") } else { $s = $s.Replace('"', '\"') }
  return $s
}

function Get-FileStamp {
  $fi = New-Object System.IO.FileInfo $TargetFile
  return "$($fi.LastWriteTimeUtc.Ticks)-$($fi.Length)"
}

function Get-Branch {
  $head = Join-Path $Root ".git\HEAD"
  if (Test-Path $head) {
    $c = (Get-Content $head -Raw).Trim()
    if ($c -match 'ref:\s*refs/heads/(.+)$') { return $Matches[1] }
    return $c.Substring(0, [Math]::Min(8, $c.Length))
  }
  return "(hors git)"
}

# Frontiere entre le bundle React vendorise et le code applicatif.
# Elle etait codee en dur : le fichier grandissant, le scan a fini par mordre
# sur React minifie et exposer ses tables d'evenements a l'edition. On la
# retrouve donc sur un marqueur du code, et on refuse de scanner s'il manque
# plutot que de deviner.
function Get-AppCodeStart([string[]]$lines) {
  for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match 'window\.__asset\s*=\s*function') { return $i + 1 }
  }
  return -1
}

function Get-StringsFromLines([string[]]$lines) {
  $AppCodeStartLine = Get-AppCodeStart $lines
  if ($AppCodeStartLine -lt 0) { return @() }

  $items = @()
  $section = "Global"
  for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    # Le nom de section vient de la fonction englobante. Sans le second cas, le
    # code de premier niveau qui suit les fonctions (SCREEN_META, PROJECT_DATA)
    # heritait du nom de la derniere fonction rencontree, ce qui etait faux.
    if ($line -match '^function\s+([A-Za-z0-9_]+)\s*\(') { $section = $Matches[1] }
    elseif ($line -match '^(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=') { $section = $Matches[1] }
    if (($i + 1) -lt $AppCodeStartLine) { continue }
    foreach ($m in $rx.Matches($line)) {
      $v = $m.Groups['val'].Value
      if (-not (Test-Editorial $v)) { continue }
      $items += [pscustomobject]@{
        line    = $i + 1
        start   = $m.Groups['val'].Index
        len     = $v.Length
        quote   = [string]$m.Groups['q'].Value
        section = $section
        raw     = $v
        text    = (ConvertFrom-SourceLiteral $v)
      }
    }
  }
  return $items
}

function Get-Strings {
  return Get-StringsFromLines ([System.IO.File]::ReadAllLines($TargetFile, [System.Text.UTF8Encoding]::new($false)))
}

# ================================================================= MEDIAS ====
# On s'ancre sur l'extension du fichier, pas sur window.__asset(...). Ancre sur
# l'appel, le scan ratait deux formes bien reelles : les logos, ecrits
# __asset(LOGO_BASE + 'sat.png'), et une image posee en src: "..." sans
# __asset du tout. Le scanner de textes ignore ces chaines, faute d'espace :
# les deux inventaires ne se recouvrent pas.
$rxImage = [regex]::new("(?<q>['""])(?<v>[^'""]*\.(?:avif|webp|jpe?g|png|gif|svg|mp4|webm))\k<q>",
                        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
$rxBaseDecl = [regex]::new("^(?:const|let|var)\s+(?<n>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*['""](?<p>[^'""]*/)['""]")
$rxConcat = [regex]::new("(?<n>[A-Za-z_][A-Za-z0-9_]*)\s*\+\s*$")

function Get-MediaFromLines([string[]]$lines) {
  $start = Get-AppCodeStart $lines
  if ($start -lt 0) { return @() }

  # Les prefixes de chemin declares en constante, pour resoudre les
  # concatenations et pouvoir afficher une vignette.
  $bases = @{}
  foreach ($l in $lines) {
    $b = $rxBaseDecl.Match($l)
    if ($b.Success) { $bases[$b.Groups['n'].Value] = $b.Groups['p'].Value }
  }

  $items = @()
  $section = "Global"
  for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    if ($line -match '^function\s+([A-Za-z0-9_]+)\s*\(') { $section = $Matches[1] }
    elseif ($line -match '^(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=') { $section = $Matches[1] }
    if (($i + 1) -lt $start) { continue }

    foreach ($m in $rxImage.Matches($line)) {
      $literal = $m.Groups['v'].Value
      $base = ''
      $before = $line.Substring(0, $m.Index)
      $c = $rxConcat.Match($before)
      if ($c.Success -and $bases.ContainsKey($c.Groups['n'].Value)) {
        $base = $bases[$c.Groups['n'].Value]
      }
      $resolved = $base + $literal
      $disk = Join-Path $Root ($resolved -replace '/', '\')
      $items += [pscustomobject]@{
        line     = $i + 1
        start    = $m.Groups['v'].Index
        len      = $literal.Length
        quote    = [string]$m.Groups['q'].Value
        section  = $section
        raw      = $literal
        text     = $literal
        base     = $base
        resolved = $resolved
        exists   = (Test-Path -LiteralPath $disk -PathType Leaf)
      }
    }
  }
  return $items
}

function Get-Media {
  return Get-MediaFromLines ([System.IO.File]::ReadAllLines($TargetFile, [System.Text.UTF8Encoding]::new($false)))
}

# Inventaire des fichiers disponibles, pour proposer un choix plutot que de
# laisser saisir un chemin a l'aveugle.
function Get-MediaLibrary {
  $exts = @('.avif','.webp','.jpg','.jpeg','.png','.gif','.svg','.mp4','.webm')
  $out = @()
  foreach ($dir in @('assets','projects')) {
    $full = Join-Path $Root $dir
    if (-not (Test-Path $full)) { continue }
    Get-ChildItem $full -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
      if ($exts -contains $_.Extension.ToLowerInvariant()) {
        $rel = $_.FullName.Substring($Root.Length).TrimStart('\') -replace '\\', '/'
        $out += $rel
      }
    }
  }
  return ($out | Sort-Object)
}

# ------------------------------------------------------------------ git local
# Toutes les commandes git passent par un tableau d'arguments : rien n'est
# interpole dans une ligne de commande, donc rien n'est injectable.
function Invoke-Git([string[]]$gitArgs) {
  $out = [System.IO.Path]::GetTempFileName()
  $err = [System.IO.Path]::GetTempFileName()
  try {
    $p = Start-Process -FilePath "git" -ArgumentList (@("-C", $Root) + $gitArgs) `
           -RedirectStandardOutput $out -RedirectStandardError $err `
           -NoNewWindow -Wait -PassThru
    $enc = [System.Text.UTF8Encoding]::new($false)
    return @{
      code   = $p.ExitCode
      stdout = [System.IO.File]::ReadAllText($out, $enc)
      stderr = [System.IO.File]::ReadAllText($err, $enc)
    }
  } finally {
    Remove-Item $out, $err -Force -ErrorAction SilentlyContinue
  }
}

# Version de index.html telle qu'elle est dans le dernier commit.
# Passe par un fichier pour recuperer les octets bruts : une capture texte
# de la sortie de git abimerait les accents.
function Get-HeadContent {
  $tmp = [System.IO.Path]::GetTempFileName()
  try {
    $p = Start-Process -FilePath "git" -ArgumentList @("-C", $Root, "show", "HEAD:index.html") `
           -RedirectStandardOutput $tmp -NoNewWindow -Wait -PassThru
    if ($p.ExitCode -ne 0) { return $null }
    $enc = [System.Text.UTF8Encoding]::new($false)
    return @{
      lines = [System.IO.File]::ReadAllLines($tmp, $enc)
      text  = [System.IO.File]::ReadAllText($tmp, $enc)
    }
  } catch { return $null }
  finally { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
}

# Compare le fichier de travail au dernier commit, texte par texte.
# L'editeur ne remplace que le contenu des chaines : la structure est
# preservee, donc les deux listes s'alignent. Si ce n'est pas le cas, le
# fichier a ete modifie autrement et on le dit au lieu de deviner.
function Get-Changes {
  $headContent = Get-HeadContent
  if ($null -eq $headContent) { return @{ ok = $false; reason = "impossible de lire la version commitee" } }

  $changes = @()

  # 1. Les reglages. Ils vivent en partie dans l'en-tete HTML, hors du domaine
  #    du comparateur de textes : sans ce bloc, une modification de titre ou de
  #    favicon serait commitee sans jamais avoir ete relue.
  $headSet = @(Get-SettingsFromText $headContent.text)
  $nowSet  = @(Get-Settings)
  for ($i = 0; $i -lt $nowSet.Count; $i++) {
    if ($nowSet[$i].problem -or $headSet[$i].problem) { continue }
    if ($headSet[$i].value -ne $nowSet[$i].value) {
      $changes += [pscustomobject]@{
        line = 0; section = "Reglages - $($nowSet[$i].group)"
        label = $nowSet[$i].label
        before = $headSet[$i].value; after = $nowSet[$i].value
      }
    }
  }

  # 2. Les chemins d'images.
  $nowMedia  = @(Get-Media)
  $headMedia = @(Get-MediaFromLines $headContent.lines)
  if ($headMedia.Count -eq $nowMedia.Count) {
    for ($i = 0; $i -lt $nowMedia.Count; $i++) {
      if ($headMedia[$i].raw -ne $nowMedia[$i].raw) {
        $changes += [pscustomobject]@{
          line = $nowMedia[$i].line; section = "Medias - $($nowMedia[$i].section)"
          label = $null
          before = $headMedia[$i].raw; after = $nowMedia[$i].raw
        }
      }
    }
  }

  # 3. Les textes du code applicatif.
  $now  = @(Get-StringsFromLines ([System.IO.File]::ReadAllLines($TargetFile, [System.Text.UTF8Encoding]::new($false))))
  $head = @(Get-StringsFromLines $headContent.lines)

  if ($head.Count -ne $now.Count) {
    return @{ ok = $false; structural = $true
              reason = "La structure du fichier a change ($($head.Count) textes commites contre $($now.Count) actuellement). Passe par GitHub Desktop pour ce commit." }
  }

  for ($i = 0; $i -lt $now.Count; $i++) {
    if ($head[$i].raw -ne $now[$i].raw) {
      $changes += [pscustomobject]@{
        line = $now[$i].line; section = $now[$i].section
        label = $null
        before = $head[$i].text; after = $now[$i].text
      }
    }
  }
  return @{ ok = $true; changes = $changes; count = $changes.Count }
}

function Save-Strings($edits) {
  $enc = [System.Text.UTF8Encoding]::new($false)
  $content = [System.IO.File]::ReadAllText($TargetFile, $enc)
  $nl = if ($content.Contains("`r`n")) { "`r`n" } else { "`n" }
  $lines = [System.Collections.Generic.List[string]]::new()
  foreach ($l in ($content -split "`r`n|`n")) { $lines.Add($l) }

  $applied = 0; $rejected = @()

  $byLine = $edits | Group-Object -Property { $_.line }
  foreach ($g in $byLine) {
    $idx = [int]$g.Name - 1
    if ($idx -lt 0 -or $idx -ge $lines.Count) {
      foreach ($e in $g.Group) { $rejected += "ligne $($e.line) hors limites" }
      continue
    }
    $line = $lines[$idx]
    # droite vers gauche : les decalages restent valides
    foreach ($e in ($g.Group | Sort-Object -Property { [int]$_.start } -Descending)) {
      $start = [int]$e.start; $len = [int]$e.len
      if ($start + $len -gt $line.Length) { $rejected += "ligne $($e.line) : decalage"; continue }
      if ($line.Substring($start, $len) -ne $e.raw) {
        $rejected += "ligne $($e.line) : la source a change depuis le chargement"; continue
      }
      $new = ConvertTo-SourceLiteral $e.text ([char]$e.quote)
      $line = $line.Substring(0, $start) + $new + $line.Substring($start + $len)
      $applied++
    }
    $lines[$idx] = $line
  }

  if ($applied -gt 0) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    [System.IO.File]::Copy($TargetFile, (Join-Path $BackupDir "index.$stamp.html"), $true)
    [System.IO.File]::WriteAllText($TargetFile, ($lines -join $nl), $enc)
    # ne garder que les 20 sauvegardes les plus recentes
    Get-ChildItem $BackupDir -Filter "index.*.html" |
      Sort-Object LastWriteTime -Descending | Select-Object -Skip 20 |
      Remove-Item -Force -ErrorAction SilentlyContinue
  }
  return @{ ok = ($applied -gt 0); applied = $applied; rejected = $rejected; stamp = (Get-FileStamp) }
}

# =============================================================== REGLAGES ====
# Les metadonnees vivent a trois endroits qui doivent rester d'accord :
#   1. les balises statiques de l'en-tete
#   2. la table SCREEN_META, que le routeur applique a l'execution
#   3. les donnees structurees JSON-LD lues par les moteurs de recherche
# Les robots des reseaux sociaux n'executent pas JavaScript : ce sont les
# balises statiques qui decident de l'apparence des partages. Un reglage
# ecrit donc dans TOUTES ses cibles a la fois, sinon l'onglet et la carte de
# partage divergent.

function New-MetaPattern([string]$attr, [string]$name) {
  return "(?<pre><meta $attr=""$([regex]::Escape($name))"" content="")(?<v>[^""]*)(?<post>"")"
}
function New-ScreenMetaPattern([string]$screen, [string]$field) {
  if ($field -eq 'title') {
    return "(?<pre>$screen`:\s*\{\s*title:\s*')(?<v>(?:\\.|[^'])*)(?<post>')"
  }
  return "(?<pre>$screen`:\s*\{\s*title:\s*'(?:\\.|[^'])*',\s*description:\s*')(?<v>(?:\\.|[^'])*)(?<post>')"
}
function New-JsonLdPattern([string]$type, [string]$field) {
  $escapedType = [regex]::Escape($type)
  $escapedField = [regex]::Escape($field)
  # Le commentaire regex (?#json) permet d'appliquer l'echappement JSON.
  return "(?s)(?#json)(?<pre>""@type""\s*:\s*""$escapedType""(?:(?!\r?\n\s*\}).)*?""$escapedField""\s*:\s*"")(?<v>(?:\\.|[^""])*)((?<post>""))"
}

$SettingsDef = @(
  @{ key='title'; group='Identite'; label="Titre d'onglet"; kind='text'
     help="Ecrit aussi dans og:title, twitter:title, SCREEN_META.home et les donnees structurees."
     targets=@( '(?<pre><title>)(?<v>[^<]*)(?<post></title>)',
                (New-MetaPattern 'property' 'og:title'),
                (New-MetaPattern 'name' 'twitter:title'),
                (New-ScreenMetaPattern 'home' 'title'),
                (New-JsonLdPattern 'WebPage' 'name') ) }

  @{ key='description'; group='Identite'; label='Description'; kind='textarea'
     help="Ecrit aussi dans og:description, SCREEN_META.home et les donnees structurees."
     targets=@( (New-MetaPattern 'name' 'description'),
                (New-MetaPattern 'property' 'og:description'),
                (New-ScreenMetaPattern 'home' 'description'),
                (New-JsonLdPattern 'WebSite' 'description'),
                (New-JsonLdPattern 'WebPage' 'description') ) }

  @{ key='twitterDescription'; group='Identite'; label='Description Twitter'; kind='textarea'
     help="Version courte, distincte de la description generale. Vue par le robot Twitter ; remplacee ensuite a l'execution."
     targets=@( (New-MetaPattern 'name' 'twitter:description') ) }

  @{ key='siteName'; group='Identite'; label='Nom du site'; kind='text'
     targets=@( (New-MetaPattern 'property' 'og:site_name'),
                (New-JsonLdPattern 'WebSite' 'name') ) }

  @{ key='lang'; group='Identite'; label='Langue'; kind='text'
     help="Code de la balise html, par exemple en ou fr."
     targets=@( '(?<pre><html lang=")(?<v>[^"]*)(?<post>")' ) }

  @{ key='locale'; group='Identite'; label='Locale sociale'; kind='text'
     help='Format en_CA, fr_CA.'
     targets=@( (New-MetaPattern 'property' 'og:locale') ) }

  @{ key='themeColor'; group='Identite'; label='Couleur de theme'; kind='color'
     targets=@( (New-MetaPattern 'name' 'theme-color') ) }

  @{ key='canonical'; group='Identite'; label='Adresse canonique'; kind='text'
     targets=@( '(?<pre><link rel="canonical" href=")(?<v>[^"]*)(?<post>")',
                (New-MetaPattern 'property' 'og:url') ) }

  @{ key='favicon32'; group='Images'; label='Favicon 32x32'; kind='image'
     targets=@( '(?<pre><link rel="icon" href=")(?<v>[^"]*)(?<post>" sizes="32x32")' ) }

  @{ key='favicon64'; group='Images'; label='Favicon 64x64'; kind='image'
     targets=@( '(?<pre><link rel="icon" href=")(?<v>[^"]*)(?<post>" sizes="64x64")' ) }

  @{ key='favicon96'; group='Images'; label='Favicon 96x96 (Google)'; kind='image'
     help='Version recommandee pour les resultats de recherche Google.'
     targets=@( '(?<pre><link rel="icon" href=")(?<v>[^"]*)(?<post>" sizes="96x96")' ) }

  @{ key='appleTouch'; group='Images'; label='Apple touch icon 180x180'; kind='image'
     targets=@( '(?<pre><link rel="apple-touch-icon" href=")(?<v>[^"]*)(?<post>")' ) }

  @{ key='shareImage'; group='Images'; label='Image de partage 1200x630'; kind='image'
     help='Adresse absolue. Ecrit dans og:image et twitter:image.'
     targets=@( (New-MetaPattern 'property' 'og:image'),
                (New-MetaPattern 'name' 'twitter:image'),
                (New-JsonLdPattern 'ImageObject' 'url') ) }

  @{ key='shareImageAlt'; group='Images'; label="Texte alternatif de l'image de partage"; kind='textarea'
     targets=@( (New-MetaPattern 'property' 'og:image:alt'),
                (New-MetaPattern 'name' 'twitter:image:alt') ) }
)

foreach ($screen in @('about','technical','contact')) {
  $nice = @{ about='A propos'; technical='Technique'; contact='Contact' }[$screen]
  $SettingsDef += @{ key="${screen}Title"; group='Pages'; label="$nice - titre"; kind='text'
                     targets=@( (New-ScreenMetaPattern $screen 'title') ) }
  $SettingsDef += @{ key="${screen}Desc"; group='Pages'; label="$nice - description"; kind='textarea'
                     targets=@( (New-ScreenMetaPattern $screen 'description') ) }
}

# Une cible SCREEN_META vit entre apostrophes dans du JavaScript ; une cible
# d'en-tete vit dans du HTML. Les deux ne s'echappent pas de la meme facon.
function Test-JsTarget([string]$p) { return $p -match "\(\?<post>'\)" }
function Test-JsonTarget([string]$p) { return $p -match '\(\?#json\)' }

function ConvertFrom-HtmlText([string]$s) {
  # &amp; en dernier, sinon "&amp;lt;" se decoderait en "<"
  return ($s -replace '&quot;','"' -replace '&#39;',"'" -replace '&lt;','<' -replace '&gt;','>' -replace '&amp;','&')
}
function ConvertTo-HtmlText([string]$s) {
  # &amp; en premier, pour ne pas re-echapper les entites qu'on vient d'ecrire
  return ($s -replace '&','&amp;' -replace '<','&lt;' -replace '>','&gt;' -replace '"','&quot;')
}

function Read-Target([string]$text, [string]$p) {
  $ms = [regex]::Matches($text, $p)
  # une cible ambigue est refusee : mieux vaut ne rien proposer que de
  # reecrire la mauvaise occurrence
  if ($ms.Count -ne 1) { return @{ ok = $false; count = $ms.Count } }
  $raw = $ms[0].Groups['v'].Value
  return @{
    ok = $true; raw = $raw; index = $ms[0].Groups['v'].Index
    text = $(if ((Test-JsTarget $p) -or (Test-JsonTarget $p)) { ConvertFrom-SourceLiteral $raw } else { ConvertFrom-HtmlText $raw })
  }
}

function Get-SettingsFromText([string]$text) {
  $out = @()
  foreach ($s in $SettingsDef) {
    $value = $null; $problem = $null; $divergent = $false
    foreach ($p in $s.targets) {
      $r = Read-Target $text $p
      if (-not $r.ok) { $problem = "$($r.count) correspondance(s) pour cette cible"; break }
      if ($null -eq $value) { $value = $r.text }
      elseif ($value -ne $r.text) { $divergent = $true }
    }
    $out += [pscustomobject]@{
      key = $s.key; group = $s.group; label = $s.label; kind = $s.kind
      help = $(if ($s.ContainsKey('help')) { $s.help } else { $null })
      value = $(if ($problem) { '' } else { $value })
      targets = $s.targets.Count
      problem = $problem
      # les cibles d'un meme reglage ne disent pas la meme chose :
      # enregistrer les realignera toutes sur la valeur affichee
      divergent = $divergent
    }
  }
  return $out
}

function Get-Settings {
  return Get-SettingsFromText ([System.IO.File]::ReadAllText($TargetFile, [System.Text.UTF8Encoding]::new($false)))
}

function Save-Settings($values) {
  $enc = [System.Text.UTF8Encoding]::new($false)
  $text = [System.IO.File]::ReadAllText($TargetFile, $enc)
  $applied = 0; $rejected = @()

  foreach ($s in $SettingsDef) {
    $incoming = $values.PSObject.Properties[$s.key]
    if (-not $incoming) { continue }
    $new = [string]$incoming.Value

    foreach ($p in $s.targets) {
      # rematche a chaque cible : le texte a pu bouger a l'iteration precedente
      $r = Read-Target $text $p
      if (-not $r.ok) { $rejected += "$($s.label) : $($r.count) correspondance(s)"; continue }
      $encoded = $(if (Test-JsTarget $p) { ConvertTo-SourceLiteral $new ([char]"'") }
                   elseif (Test-JsonTarget $p) { ConvertTo-SourceLiteral $new ([char]'"') }
                   else { ConvertTo-HtmlText $new })
      if ($r.raw -eq $encoded) { continue }
      $text = $text.Remove($r.index, $r.raw.Length).Insert($r.index, $encoded)
      $applied++
    }
  }

  if ($applied -gt 0) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    [System.IO.File]::Copy($TargetFile, (Join-Path $BackupDir "index.$stamp.html"), $true)
    [System.IO.File]::WriteAllText($TargetFile, $text, $enc)
  }
  return @{ ok = ($applied -gt 0); applied = $applied; rejected = $rejected; stamp = (Get-FileStamp) }
}

function Send-Json($res, $obj) {
  $json = $obj | ConvertTo-Json -Depth 6 -Compress
  $b = [System.Text.Encoding]::UTF8.GetBytes($json)
  $res.ContentType = "application/json; charset=utf-8"
  $res.Headers.Add("Cache-Control", "no-store")
  $res.ContentLength64 = $b.Length
  $res.OutputStream.Write($b, 0, $b.Length)
  $res.StatusCode = 200
}

# ------------------------------------------------------------------ adresses
function Get-LanIp {
  try {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
      Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL' } |
      Sort-Object -Property InterfaceMetric | Select-Object -First 1
    if ($ip) { return $ip.IPAddress }
  } catch {}
  return $null
}

$lanIp = Get-LanIp

# Renvoie un listener demarre, ou $null. Ferme systematiquement l'objet en cas
# d'echec : un listener abandonne garde sa reservation et fait echouer l'essai
# suivant avec un message trompeur.
function Start-Listener([string]$prefix) {
  $l = New-Object System.Net.HttpListener
  try {
    $l.Prefixes.Add($prefix)
    $l.Start()
    return $l
  } catch {
    try { $l.Close() } catch {}
    return $null
  }
}

# Ecoute sur toutes les interfaces si Windows l'autorise (necessaire pour
# l'iPhone), sinon repli sur localhost.
$lanMode = $true
$listener = Start-Listener "http://+:$Port/"
if (-not $listener) {
  $lanMode = $false
  $listener = Start-Listener "http://localhost:$Port/"
}

if (-not $listener) {
  Write-Host ""
  Write-Host "  Impossible d'ecouter sur le port $Port."
  Write-Host ""

  $who = $null
  try {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1
    if ($conn) {
      $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
      # HTTP.sys fait apparaitre les listeners sous le processus System (PID 4)
      if ($proc -and $proc.Id -ne 4) { $who = "$($proc.ProcessName) (PID $($proc.Id))" }
      else { $who = "un autre serveur local" }
    }
  } catch {}

  if ($who) { Write-Host "  Le port est deja utilise par $who." }
  else { Write-Host "  Le port est deja utilise, ou reserve par Windows." }

  Write-Host ""
  Write-Host "  Le plus souvent : une fenetre de l'editeur est deja ouverte."
  Write-Host "  Ferme-la, puis relance edit-site.cmd."
  Write-Host ""
  Write-Host "  Sinon, utilise un autre port :"
  Write-Host "      edit-site.cmd -Port 8001"
  Write-Host ""
  Read-Host "  Appuie sur Entree pour fermer" | Out-Null
  return
}

$editorUrl = "http://localhost:$Port/__editor"
$lanUrl = if ($lanMode -and $lanIp) { "http://${lanIp}:$Port/" } else { $null }

Write-Host ""
Write-Host "  Editeur : $editorUrl"
Write-Host "  Site    : http://localhost:$Port/"
if ($lanUrl) {
  Write-Host "  iPhone  : $lanUrl  (meme reseau Wi-Fi - lecture seule)"
  Write-Host "            L'editeur reste reserve a cet ordinateur."
} else {
  Write-Host "  iPhone  : indisponible - lance tools\setup-wifi.cmd une fois pour l'activer"
}
Write-Host "  Branche : $(Get-Branch)"
Write-Host ""
Write-Host "  Ferme l'onglet de l'editeur pour arreter le serveur."
Write-Host ""

if (-not $NoBrowser) { Start-Process $editorUrl | Out-Null }

# --------------------------------------------------------------- boucle HTTP
$lastPing = Get-Date
$everPinged = $false
$lastVisibility = "?"
# Le diagnostic tient son propre horodatage. $lastPing est rafraichi par les
# DIX routes de l'editeur, pas seulement par /__ping : mesurer l'ecart entre
# battements a partir de lui reviendrait a effacer un battement en retard des
# que tu enregistres un texte ou charges une image, c'est-a-dire exactement
# quand il faut le voir.
$lastBeat = Get-Date
$diagFirstBeatLogged = $false
$diagWindowStart = Get-Date
$diagBeats = 0
$diagMaxGap = 0
$diagHiddenBeats = 0
$diagStopLogged = $false
Write-Diag "--- demarrage  port=$Port  tolerance=${IdleTimeoutSeconds}s  avant-premier-ping=120s"

try {
  while ($listener.IsListening) {

    # attente non bloquante : permet l'arret automatique sur inactivite
    $task = $listener.GetContextAsync()
    while (-not $task.AsyncWaitHandle.WaitOne(1000)) {
      $idle = ((Get-Date) - $lastPing).TotalSeconds
      $limit = if ($everPinged) { $IdleTimeoutSeconds } else { 120 }
      if ($idle -gt $limit) {
        if ($everPinged) { Write-Host "  Editeur ferme - arret du serveur." }
        else { Write-Host "  Aucun editeur connecte - arret du serveur." }
        # Deux silences distincts : celui que le serveur surveille (toute route
        # de l'editeur) et celui des seuls battements. Un ecart entre les deux
        # signe une activite qui masquait un coeur deja arrete.
        $beatSilence = ((Get-Date) - $lastBeat).TotalSeconds
        Write-Diag ("ARRET par inactivite  silence={0:N1}s  silence-battement={1:N1}s  tolerance={2}s  dernier-onglet={3}  premier-ping-recu={4}" -f $idle, $beatSilence, $limit, $lastVisibility, $everPinged)
        $diagStopLogged = $true
        $listener.Stop(); return
      }
    }
    $ctx = $task.GetAwaiter().GetResult()
    $req = $ctx.Request
    $res = $ctx.Response

    try {
      $rel = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)

      # ------------------------------------------------------------ securite
      # Les routes de l'editeur (/__*) sont reservees a CET ordinateur.
      # En mode Wi-Fi le serveur ecoute sur tout le reseau local pour que
      # l'iPhone puisse AFFICHER le site : sans ce garde-fou, n'importe qui
      # sur le meme reseau pourrait ecrire dans index.html.
      # Le telephone lit le site ; lui seul edite.
      if ($rel.StartsWith("/__") -and -not $req.IsLocal) {
        $res.StatusCode = 403
        $deny = [System.Text.Encoding]::UTF8.GetBytes(
          "403 - L'editeur de contenu n'est accessible que depuis l'ordinateur qui l'execute.")
        $res.ContentType = "text/plain; charset=utf-8"
        $res.ContentLength64 = $deny.Length
        $res.OutputStream.Write($deny, 0, $deny.Length)
        Write-Host "  Acces editeur refuse depuis $($req.RemoteEndPoint.Address)"
        $res.Close(); continue
      }

      # Ouverture de session. Ralentissement progressif apres des echecs
      # repetes, pour qu'un essai automatise ne serve a rien.
      if ($rel -eq "/__auth" -and $req.HttpMethod -eq "POST") {
        if ((Get-Date) -lt $lockUntil) {
          $wait = [int]($lockUntil - (Get-Date)).TotalSeconds
          Send-Json $res @{ ok = $false; locked = $true; wait = $wait }
          $res.Close(); continue
        }
        $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
        $body = $reader.ReadToEnd(); $reader.Close()
        $pw = ($body | ConvertFrom-Json).password
        if (Test-Password $pw) {
          $failCount = 0
          Send-Json $res @{ ok = $true; token = (New-SessionToken) }
          Write-Host "  Session ouverte."
        } else {
          $failCount++
          if ($failCount -ge 5) {
            $lockUntil = (Get-Date).AddSeconds([Math]::Min(300, 15 * ($failCount - 4)))
            Write-Host "  $failCount echecs - blocage temporaire."
          }
          Start-Sleep -Milliseconds 400
          Send-Json $res @{ ok = $false }
        }
        $res.Close(); continue
      }

      # /__editor sert la page (qui affiche l'ecran de deverrouillage) et
      # /__ping reste libre : il ne renvoie rien d'autre que "le serveur est
      # vivant", et sans lui le serveur s'arreterait pendant qu'on saisit le
      # mot de passe. Toute autre route exige une session valide.
      if ($rel.StartsWith("/__") -and $rel -ne "/__editor" -and $rel -ne "/__ping") {
        $token = $req.Headers["X-Auth-Token"]
        if (-not (Test-SessionToken $token)) {
          $res.StatusCode = 401
          $m = [System.Text.Encoding]::UTF8.GetBytes("401 - session requise")
          $res.ContentType = "text/plain; charset=utf-8"
          $res.ContentLength64 = $m.Length
          $res.OutputStream.Write($m, 0, $m.Length)
          $res.Close(); continue
        }
      }

      if ($rel -eq "/__ping") {
        # Diagnostic : les battements en retard sont notes un par un, les
        # autres seulement comptes puis resumes chaque minute. Sans ce resume,
        # un journal muet ne dirait pas si l'editeur bat ou s'il est absent.
        $gap = ((Get-Date) - $lastBeat).TotalSeconds
        $visibility = $req.QueryString["v"]
        if (-not $visibility) { $visibility = "?" }

        if (-not $diagFirstBeatLogged) {
          Write-Diag "premier battement recu  onglet=$visibility"
          $diagFirstBeatLogged = $true
          $diagWindowStart = Get-Date
        } else {
          $diagBeats++
          if ($gap -gt $diagMaxGap) { $diagMaxGap = $gap }
          if ($visibility -eq "hidden") { $diagHiddenBeats++ }
          if ($gap -ge $DiagGapThreshold) {
            Write-Diag ("battement en retard  ecart={0:N1}s  tolerance={1}s  onglet={2}" -f $gap, $IdleTimeoutSeconds, $visibility)
          }
          $windowAge = ((Get-Date) - $diagWindowStart).TotalSeconds
          if ($windowAge -ge $DiagSummaryEvery) {
            Write-Diag ("synthese  {0} battements en {1:N0}s  ecart-max={2:N1}s  onglet-cache={3}/{0}" -f $diagBeats, $windowAge, $diagMaxGap, $diagHiddenBeats)
            $diagWindowStart = Get-Date; $diagBeats = 0; $diagMaxGap = 0; $diagHiddenBeats = 0
          }
        }
        # Un battement sans etat connu ne doit pas effacer le dernier etat reel :
        # la ligne d'arret perdrait justement l'information qu'on cherche.
        if ($visibility -ne "?") { $lastVisibility = $visibility }
        $lastBeat = Get-Date

        $lastPing = Get-Date; $everPinged = $true
        Send-Json $res @{ ok = $true }
        $res.Close(); continue
      }

      if ($rel -eq "/__meta") {
        $lastPing = Get-Date; $everPinged = $true
        Send-Json $res @{ stamp = (Get-FileStamp); branch = (Get-Branch); lanUrl = $lanUrl }
        $res.Close(); continue
      }

      if ($rel -eq "/__quit") {
        Send-Json $res @{ ok = $true }
        $res.Close()
        Write-Host "  Arret demande par l'editeur."
        Write-Diag ("ARRET propre demande par l'editeur  dernier-onglet={0}" -f $lastVisibility)
        $diagStopLogged = $true
        $listener.Stop(); return
      }

      if ($rel -eq "/__strings") {
        $lastPing = Get-Date; $everPinged = $true
        $srcLines = [System.IO.File]::ReadAllLines($TargetFile, [System.Text.UTF8Encoding]::new($false))
        $boundary = Get-AppCodeStart $srcLines
        $warn = $null
        if ($boundary -lt 0) {
          $warn = "Le debut du code applicatif est introuvable dans index.html (marqueur window.__asset absent). Aucun texte n'est expose, pour ne pas risquer de modifier le moteur React."
        }
        Send-Json $res @{
          items = @(Get-StringsFromLines $srcLines); stamp = (Get-FileStamp)
          branch = (Get-Branch); lanUrl = $lanUrl; boundary = $boundary; warning = $warn
        }
        $res.Close(); continue
      }

      if ($rel -eq "/__save" -and $req.HttpMethod -eq "POST") {
        $lastPing = Get-Date; $everPinged = $true
        $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
        $body = $reader.ReadToEnd(); $reader.Close()
        Send-Json $res (Save-Strings (($body | ConvertFrom-Json).edits))
        $res.Close(); continue
      }

      if ($rel -eq "/__media" -and $req.HttpMethod -eq "GET") {
        $lastPing = Get-Date; $everPinged = $true
        Send-Json $res @{ items = @(Get-Media); library = @(Get-MediaLibrary) }
        $res.Close(); continue
      }

      # meme mecanique d'ecriture que les textes : ancrage ligne + decalage,
      # verification de la source avant remplacement
      if ($rel -eq "/__media" -and $req.HttpMethod -eq "POST") {
        $lastPing = Get-Date; $everPinged = $true
        $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
        $body = $reader.ReadToEnd(); $reader.Close()
        Send-Json $res (Save-Strings (($body | ConvertFrom-Json).edits))
        $res.Close(); continue
      }

      if ($rel -eq "/__settings" -and $req.HttpMethod -eq "GET") {
        $lastPing = Get-Date; $everPinged = $true
        Send-Json $res @{ items = @(Get-Settings) }
        $res.Close(); continue
      }

      if ($rel -eq "/__settings" -and $req.HttpMethod -eq "POST") {
        $lastPing = Get-Date; $everPinged = $true
        $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
        $body = $reader.ReadToEnd(); $reader.Close()
        Send-Json $res (Save-Settings (($body | ConvertFrom-Json).values))
        $res.Close(); continue
      }

      if ($rel -eq "/__changes") {
        $lastPing = Get-Date; $everPinged = $true
        $c = Get-Changes
        $c["branch"] = (Get-Branch)
        Send-Json $res $c
        $res.Close(); continue
      }

      # Commit limite a index.html : la pathspec finale garantit qu'aucun
      # autre fichier modifie ne sera embarque, quel que soit l'index git.
      if ($rel -eq "/__commit" -and $req.HttpMethod -eq "POST") {
        $lastPing = Get-Date; $everPinged = $true
        $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
        $body = $reader.ReadToEnd(); $reader.Close()
        $msg = ($body | ConvertFrom-Json).message

        if ([string]::IsNullOrWhiteSpace($msg)) {
          Send-Json $res @{ ok = $false; reason = "Message de commit vide." }
          $res.Close(); continue
        }

        $st = Invoke-Git @("status", "--porcelain", "--", "index.html")
        if ([string]::IsNullOrWhiteSpace($st.stdout)) {
          Send-Json $res @{ ok = $false; reason = "Aucune modification a commiter dans index.html." }
          $res.Close(); continue
        }

        # message passe par un fichier : aucun probleme de guillemets ou d'accents
        $msgFile = [System.IO.Path]::GetTempFileName()
        try {
          [System.IO.File]::WriteAllText($msgFile, $msg, [System.Text.UTF8Encoding]::new($false))
          $r = Invoke-Git @("commit", "-F", $msgFile, "--", "index.html")
          if ($r.code -eq 0) {
            $h = (Invoke-Git @("rev-parse", "--short", "HEAD")).stdout.Trim()
            Write-Host "  Commit $h sur $(Get-Branch)"
            Send-Json $res @{ ok = $true; hash = $h; branch = (Get-Branch) }
          } else {
            $why = if ([string]::IsNullOrWhiteSpace($r.stderr)) { $r.stdout } else { $r.stderr }
            Send-Json $res @{ ok = $false; reason = $why.Trim() }
          }
        } finally {
          Remove-Item $msgFile -Force -ErrorAction SilentlyContinue
        }
        $res.Close(); continue
      }

      if ($rel -eq "/__editor") {
        $b = [System.IO.File]::ReadAllBytes((Join-Path $ScriptDir "editor.html"))
        $res.ContentType = "text/html; charset=utf-8"
        $res.Headers.Add("Cache-Control", "no-store")
        $res.ContentLength64 = $b.Length
        $res.OutputStream.Write($b, 0, $b.Length)
        $res.StatusCode = 200
        $res.Close(); continue
      }

      if ($rel -eq "/" -or $rel -eq "") { $rel = "/index.html" }
      $candidate = Join-Path $Root ($rel.TrimStart("/") -replace "/", "\")
      $full = [System.IO.Path]::GetFullPath($candidate)
      $rootFull = [System.IO.Path]::GetFullPath($Root)
      if (-not $full.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)) {
        $res.StatusCode = 403; $res.Close(); continue
      }

      # Fichiers presents dans le dossier mais jamais servis : empreinte du mot
      # de passe, historique Git, sauvegardes de l'editeur, copies de travail.
      # En Wi-Fi, sans ce filtre, tout appareil du reseau local pourrait les
      # lire. Le test porte sur le chemin resolu, pas sur l'URL : aucune
      # variante d'encodage ne le contourne.
      $isForbidden = $false
      foreach ($guarded in $ForbiddenPaths) {
        if ($full.Equals($guarded, [StringComparison]::OrdinalIgnoreCase) -or
            $full.StartsWith($guarded + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
          $isForbidden = $true; break
        }
      }
      if ($isForbidden) {
        $res.StatusCode = 404
        $m = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $rel")
        $res.ContentType = "text/plain; charset=utf-8"
        $res.ContentLength64 = $m.Length
        if ($req.HttpMethod -ne "HEAD") { $res.OutputStream.Write($m, 0, $m.Length) }
        $res.Close(); continue
      }

      if (Test-Path -LiteralPath $full -PathType Container) { $full = Join-Path $full "index.html" }

      if (Test-Path -LiteralPath $full -PathType Leaf) {
        $bytes = [System.IO.File]::ReadAllBytes($full)
        $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
        $type = $mime[$ext]; if (-not $type) { $type = "application/octet-stream" }
        $res.ContentType = $type
        $res.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")
        $res.ContentLength64 = $bytes.Length
        # Une reponse a HEAD ne porte pas de corps : ecrire quand meme leve une
        # exception et renvoie 500. L'editeur s'en sert pour verifier qu'un
        # chemin d'image existe.
        if ($req.HttpMethod -ne "HEAD") { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
        $res.StatusCode = 200
      } else {
        $res.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $rel")
        $res.ContentType = "text/plain; charset=utf-8"
        $res.ContentLength64 = $msg.Length
        if ($req.HttpMethod -ne "HEAD") { $res.OutputStream.Write($msg, 0, $msg.Length) }
      }
    } catch {
      try {
        $res.StatusCode = 500
        $m = [System.Text.Encoding]::UTF8.GetBytes("500: $($_.Exception.Message)")
        $res.ContentLength64 = $m.Length
        $res.OutputStream.Write($m, 0, $m.Length)
      } catch {}
    } finally {
      try { $res.Close() } catch {}
    }
  }
} finally {
  # Diagnostic : filet pour les sorties qui n'ont pas journalise leur raison
  # (Ctrl+C, exception). Une fenetre de console fermee brutalement tue le
  # processus sans passer ici : ce cas restera muet, et c'est justement ce
  # qu'une derniere ligne de synthese permet de distinguer.
  if (-not $diagStopLogged) {
    Write-Diag ("ARRET sans raison journalisee  dernier-onglet={0}  premier-ping-recu={1}" -f $lastVisibility, $everPinged)
  }
  try { $listener.Stop(); $listener.Close() } catch {}
}
