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
  [int]$IdleTimeoutSeconds = 25,
  # Charge les fonctions sans ouvrir de port. Sert a les mettre a l'epreuve
  # depuis un script de test, sur une copie du site, sans mot de passe.
  [switch]$NoServe
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

# ------------------------------------------------------------ fichiers edites
# index.html porte le site, data/projects.js porte les fiches des projets.
# Les deux doivent etre inspectes ensemble : depuis que les fiches ont quitte
# index.html, ne scanner que lui ferait disparaitre tous les textes de projet
# de l'inventaire, sans que rien ne le signale.
$DataFile = Join-Path $Root "data\projects.js"
$FrFile   = Join-Path $Root "data\fr.js"

# scan indique si le fichier est balaye a la recherche de textes et de medias
# editables. data/fr.js n'est pas balaye : il ne contient pas l'anglais du site
# mais sa traduction, et l'exposer dans l'onglet Textes ferait apparaitre chaque
# phrase deux fois. Il figure quand meme ici pour que l'empreinte de fichier et
# les sauvegardes le couvrent comme les autres.
$Sources = @(
  [pscustomobject]@{ key = "index";    path = $TargetFile; label = "index.html";       backup = "index";    ext = ".html"; scan = $true  }
  [pscustomobject]@{ key = "projects"; path = $DataFile;   label = "data/projects.js"; backup = "projects"; ext = ".js";   scan = $true  }
  [pscustomobject]@{ key = "fr";       path = $FrFile;     label = "data/fr.js";       backup = "fr";       ext = ".js";   scan = $false }
)

function Get-ScannedSources { return @(Get-Sources | Where-Object { $_.scan }) }

# Un depot sans fichier de donnees reste utilisable : on n'expose que ce qui
# existe vraiment, plutot que d'echouer a la lecture.
function Get-Sources { return @($Sources | Where-Object { Test-Path -LiteralPath $_.path -PathType Leaf }) }
function Get-Source([string]$key) { return (Get-Sources | Where-Object { $_.key -eq $key } | Select-Object -First 1) }
function Read-SourceLines($src) { return [System.IO.File]::ReadAllLines($src.path, [System.Text.UTF8Encoding]::new($false)) }
function Get-SourceRelPath($src) { return ($src.path.Substring($Root.Length).TrimStart('\') -replace '\\', '/') }

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
  # En mode bibliotheque, aucun port n'est ouvert : il n'y a rien a proteger,
  # et exiger un mot de passe empecherait simplement de tester les fonctions.
  if (-not $NoServe) {
    Write-Host ""
    Write-Host "  Aucun mot de passe defini."
    Write-Host "  Lance d'abord tools\set-password.cmd, puis relance edit-site.cmd."
    Write-Host ""
    Read-Host "  Appuie sur Entree pour fermer"
    return
  }
}

if (Test-Path $AuthFile) {
  $auth = Get-Content $AuthFile -Raw | ConvertFrom-Json
  $AuthSalt = [Convert]::FromBase64String($auth.salt)
  $AuthHash = [Convert]::FromBase64String($auth.hash)
  $AuthIter = [int]$auth.iter
}

function Test-Password([string]$candidate) {
  if ([string]::IsNullOrEmpty($candidate)) { return $false }
  if (-not $AuthHash) { return $false }
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
  # L'empreinte couvre tous les fichiers edites : une modification exterieure
  # de data/projects.js doit alerter au meme titre qu'une modification
  # d'index.html.
  $parts = @()
  foreach ($src in Get-Sources) {
    $fi = New-Object System.IO.FileInfo $src.path
    $parts += "$($src.key):$($fi.LastWriteTimeUtc.Ticks)-$($fi.Length)"
  }
  return ($parts -join '|')
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

# Ou commence la zone editable du fichier. index.html embarque React minifie,
# qu'il ne faut jamais exposer ; data/projects.js ne contient que des donnees,
# donc tout y est editable des la premiere ligne.
function Get-ScanStart([string[]]$lines, [string]$key) {
  if ($key -eq "index") { return Get-AppCodeStart $lines }
  return 0
}

function Get-StringsFromLines([string[]]$lines, [string]$key = "index") {
  $AppCodeStartLine = Get-ScanStart $lines $key
  if ($AppCodeStartLine -lt 0) { return @() }

  $items = @()
  $section = "Global"
  for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    # Le nom de section vient de la fonction englobante. Sans le second cas, le
    # code de premier niveau qui suit les fonctions (SCREEN_META, PROJECT_DATA)
    # heritait du nom de la derniere fonction rencontree, ce qui etait faux.
    # Dans le fichier de donnees, la section utile est le projet lui-meme.
    if ($key -eq "projects") {
      if ($line -match $ProjectKeyPattern) { $section = "Projet " + $Matches['id'] }
    }
    elseif ($line -match '^function\s+([A-Za-z0-9_]+)\s*\(') { $section = $Matches[1] }
    elseif ($line -match '^(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=') { $section = $Matches[1] }
    if (($i + 1) -lt $AppCodeStartLine) { continue }
    foreach ($m in $rx.Matches($line)) {
      $v = $m.Groups['val'].Value
      if (-not (Test-Editorial $v)) { continue }
      $items += [pscustomobject]@{
        file    = $key
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
  $items = @()
  foreach ($src in Get-ScannedSources) {
    $items += @(Get-StringsFromLines (Read-SourceLines $src) $src.key)
  }
  return $items
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

function Get-MediaFromLines([string[]]$lines, [string]$key = "index") {
  $start = Get-ScanStart $lines $key
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
    if ($key -eq "projects") {
      if ($line -match $ProjectKeyPattern) { $section = "Projet " + $Matches['id'] }
    }
    elseif ($line -match '^function\s+([A-Za-z0-9_]+)\s*\(') { $section = $Matches[1] }
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
        file     = $key
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
  $items = @()
  foreach ($src in Get-ScannedSources) {
    $items += @(Get-MediaFromLines (Read-SourceLines $src) $src.key)
  }
  return $items
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
# Ce que l'editeur a le droit de commiter. La pathspec finale garantit
# qu'aucun autre fichier modifie ne sera embarque, quel que soit l'index git.
$CommitPaths = @("index.html", "data/projects.js", "projects", "sitemap.xml")

# Branche de travail de l'editeur. main est la branche de publication : y
# ecrire depuis l'outil mettrait le site en ligne sans relecture.
$ContentBranch = "content"

function Set-ContentBranch {
  $current = Get-Branch
  if ($current -eq $ContentBranch) { return @{ ok = $true; switched = $false } }
  if ($current -eq "(hors git)") { return @{ ok = $false; reason = "Dossier hors depot git." } }

  $exists = (Invoke-Git @("rev-parse", "--verify", "--quiet", "refs/heads/$ContentBranch")).code -eq 0
  $checkoutArgs = $(if ($exists) { @("checkout", $ContentBranch) } else { @("checkout", "-b", $ContentBranch) })
  $r = Invoke-Git $checkoutArgs
  if ($r.code -ne 0) {
    $why = $(if ([string]::IsNullOrWhiteSpace($r.stderr)) { $r.stdout } else { $r.stderr }).Trim()
    return @{ ok = $false; reason = "Impossible de passer sur la branche $ContentBranch : $why" }
  }
  return @{ ok = $true; switched = $true; from = $current }
}

function Get-HeadContent([string]$rel = "index.html") {
  $tmp = [System.IO.Path]::GetTempFileName()
  try {
    $p = Start-Process -FilePath "git" -ArgumentList @("-C", $Root, "show", "HEAD:$rel") `
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

  # 2. Les chemins d'images d'index.html. Ceux des fiches sont compares plus
  #    bas, projet par projet : les melanger ferait dependre la comparaison du
  #    nombre de projets, donc echouer des qu'on en ajoute un.
  $nowMedia  = @(Get-MediaFromLines ([System.IO.File]::ReadAllLines($TargetFile, [System.Text.UTF8Encoding]::new($false))) "index")
  $headMedia = @(Get-MediaFromLines $headContent.lines "index")
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
              reason = "La structure d'index.html a change ($($head.Count) textes commites contre $($now.Count) actuellement). Passe par GitHub Desktop pour ce commit." }
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

  # 4. Les fiches de projet. Elles se comparent champ par champ, et non chaine
  #    par chaine : ajouter ou retirer un projet change forcement le nombre de
  #    textes, et ce n'est pas une anomalie mais l'usage normal de l'outil.
  $changes += @(Get-ProjectChanges)

  return @{ ok = $true; changes = $changes; count = $changes.Count }
}

function Format-FieldValue($v) {
  if ($null -eq $v) { return '' }
  if ($v -is [array]) { return (@($v) -join ' · ') }
  if ($v -is [pscustomobject] -and $v.PSObject.Properties['__raw']) { return '(contenu chiffre)' }
  if ($v -is [bool]) { return $(if ($v) { 'oui' } else { 'non' }) }
  return [string]$v
}

function Get-ProjectChanges {
  $src = Get-Source "projects"
  if (-not $src) { return @() }
  $rel = Get-SourceRelPath $src
  $headContent = Get-HeadContent $rel

  $nowBlocks = @(Get-ProjectBlocks (Read-SourceLines $src))
  $headBlocks = @()
  if ($headContent) { $headBlocks = @(Get-ProjectBlocks $headContent.lines) }

  $nowMap = @{}; foreach ($b in $nowBlocks) { $nowMap[$b.id] = ConvertFrom-ProjectBody $b.body }
  $headMap = @{}; foreach ($b in $headBlocks) { $headMap[$b.id] = ConvertFrom-ProjectBody $b.body }

  $changes = @()
  foreach ($id in $nowMap.Keys) {
    if ($headMap.ContainsKey($id)) { continue }
    $t = $(if ($nowMap[$id].Contains('title')) { [string]$nowMap[$id]['title'] } else { $id })
    $changes += [pscustomobject]@{ line = 0; section = "Projet $id"; label = "Projet ajoute"; before = ''; after = $t }
  }
  foreach ($id in $headMap.Keys) {
    if ($nowMap.ContainsKey($id)) { continue }
    $t = $(if ($headMap[$id].Contains('title')) { [string]$headMap[$id]['title'] } else { $id })
    $changes += [pscustomobject]@{ line = 0; section = "Projet $id"; label = "Projet retire"; before = $t; after = '' }
  }
  foreach ($id in $nowMap.Keys) {
    if (-not $headMap.ContainsKey($id)) { continue }
    $a = $headMap[$id]; $b = $nowMap[$id]
    $keys = @($a.Keys) + @($b.Keys) | Select-Object -Unique
    foreach ($k in $keys) {
      $va = $(if ($a.Contains($k)) { Format-FieldValue $a[$k] } else { '' })
      $vb = $(if ($b.Contains($k)) { Format-FieldValue $b[$k] } else { '' })
      if ($va -ne $vb) {
        $changes += [pscustomobject]@{ line = 0; section = "Projet $id"; label = $k; before = $va; after = $vb }
      }
    }
  }
  return $changes
}

# Sauvegarde datee du fichier avant ecriture, et purge des plus anciennes.
# Chaque fichier edite garde sa propre serie : les sauvegardes d'index.html et
# celles du fichier de donnees ne doivent jamais se chasser l'une l'autre.
function Backup-Source($src) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  [System.IO.File]::Copy($src.path, (Join-Path $BackupDir "$($src.backup).$stamp$($src.ext)"), $true)
  Get-ChildItem $BackupDir -Filter "$($src.backup).*$($src.ext)" |
    Sort-Object LastWriteTime -Descending | Select-Object -Skip 20 |
    Remove-Item -Force -ErrorAction SilentlyContinue
}

# Renomme une cle sans perdre sa place : une table ordonnee ne sait pas renommer,
# on la reconstruit donc a l'identique en substituant au passage.
function Rename-FrKey($map, [string]$old, [string]$new) {
  $out = New-OrderedMap
  foreach ($k in $map.Keys) {
    if ($k -ceq $old) { $out[$new] = $map[$k] } else { $out[$k] = $map[$k] }
  }
  return $out
}

# Remove() d'une table ordonnee compare sans tenir compte de la casse : il
# emporterait 'Next project' en visant 'Next Project'. On reconstruit.
function Remove-FrKey($map, [string]$cle) {
  $out = New-OrderedMap
  foreach ($k in $map.Keys) { if ($k -cne $cle) { $out[$k] = $map[$k] } }
  return $out
}

# Report des traductions quand l'anglais change.
# La cle du dictionnaire est la phrase anglaise : modifier un texte anglais
# rendrait sa traduction orpheline, en silence. On la deplace donc sur la
# nouvelle cle et on l'inscrit dans stale, pour que l'editeur la signale a
# relire plutot que de laisser passer un francais qui ne dit plus la meme chose.
function Move-FrTranslations($renames) {
  if (@($renames).Count -eq 0) { return 0 }
  $d = Read-FrDictionary
  if ($d.ui.Count -eq 0) { return 0 }

  $deplacees = 0
  foreach ($r in $renames) {
    $old = [string]$r.old; $new = [string]$r.new
    if ($old -ceq $new -or -not $d.ui.Contains($old)) { continue }

    if ($d.ui.Contains($new)) {
      # La nouvelle phrase avait deja sa traduction : on garde celle-la et on
      # retire l'ancienne entree, dont l'anglais n'existe plus nulle part.
      $d.ui = Remove-FrKey $d.ui $old
      $deplacees++
      continue
    }

    $d.ui = Rename-FrKey $d.ui $old $new
    $dejaSignalee = $false
    foreach ($s in @($d.stale)) { if ($s -and ([string]$s -ceq $new)) { $dejaSignalee = $true } }
    if (-not $dejaSignalee) {
      $liste = @(); foreach ($s in @($d.stale)) { if ($s) { $liste += [string]$s } }
      $liste += $new
      $d.stale = $liste
    }
    $deplacees++
  }

  # Une entree signalee dont la cle a disparu n'a plus de sens.
  # Boucle explicite plutot que Where-Object : un tableau vide range dans une
  # table ordonnee ressort parfois avec un element nul, et Contains($null) leve.
  $propre = @()
  foreach ($s in @($d.stale)) {
    if ($s -and $d.ui.Contains([string]$s)) { $propre += [string]$s }
  }
  $d.stale = $propre

  if ($deplacees -gt 0) { Write-FrDictionary $d (Get-FrSectionMap) }
  return $deplacees
}

function Save-Strings($edits) {
  $enc = [System.Text.UTF8Encoding]::new($false)
  $applied = 0; $rejected = @()
  $renames = New-Object System.Collections.Generic.List[hashtable]

  # Une modification sans fichier vient d'une version anterieure de l'editeur :
  # elle designe forcement index.html.
  $byFile = $edits | Group-Object -Property { if ($_.file) { [string]$_.file } else { "index" } }
  foreach ($fileGroup in $byFile) {
    $src = Get-Source $fileGroup.Name
    if (-not $src) {
      foreach ($e in $fileGroup.Group) { $rejected += "fichier inconnu : $($fileGroup.Name)" }
      continue
    }

    $content = [System.IO.File]::ReadAllText($src.path, $enc)
    $nl = if ($content.Contains("`r`n")) { "`r`n" } else { "`n" }
    $lines = [System.Collections.Generic.List[string]]::new()
    foreach ($l in ($content -split "`r`n|`n")) { $lines.Add($l) }

    $fileApplied = 0

    $byLine = $fileGroup.Group | Group-Object -Property { $_.line }
    foreach ($g in $byLine) {
      $idx = [int]$g.Name - 1
      if ($idx -lt 0 -or $idx -ge $lines.Count) {
        foreach ($e in $g.Group) { $rejected += "$($src.label) ligne $($e.line) hors limites" }
        continue
      }
      $line = $lines[$idx]
      # droite vers gauche : les decalages restent valides
      foreach ($e in ($g.Group | Sort-Object -Property { [int]$_.start } -Descending)) {
        $start = [int]$e.start; $len = [int]$e.len
        if ($start + $len -gt $line.Length) { $rejected += "$($src.label) ligne $($e.line) : decalage"; continue }
        if ($line.Substring($start, $len) -ne $e.raw) {
          $rejected += "$($src.label) ligne $($e.line) : la source a change depuis le chargement"; continue
        }
        $new = ConvertTo-SourceLiteral $e.text ([char]$e.quote)
        $line = $line.Substring(0, $start) + $new + $line.Substring($start + $len)
        $fileApplied++
        # L'ancien texte anglais est la cle de sa traduction. On note le
        # changement ; le report se fait une fois, apres l'ecriture des fichiers.
        $ancien = ConvertFrom-SourceLiteral $e.raw
        if ($ancien -cne [string]$e.text) { $renames.Add(@{ old = $ancien; new = [string]$e.text }) }
      }
      $lines[$idx] = $line
    }

    if ($fileApplied -gt 0) {
      Backup-Source $src
      [System.IO.File]::WriteAllText($src.path, ($lines -join $nl), $enc)
      $applied += $fileApplied
    }
  }

  # Apres l'ecriture seulement : une traduction ne se deplace que si le texte
  # anglais a reellement change sur le disque.
  $reportees = 0
  if ($applied -gt 0) { $reportees = Move-FrTranslations $renames }

  return @{ ok = ($applied -gt 0); applied = $applied; rejected = $rejected; carried = $reportees; stamp = (Get-FileStamp) }
}

# ================================================================ PROJETS ====
# data/projects.js a une forme stable, ecrite par cet outil : un projet par
# bloc, ouvert par "  <id>: {" et ferme par "  }" en colonne 2. On peut donc le
# lire sans embarquer un analyseur JavaScript complet.
#
# Deux garde-fous portent tout le reste : une modification ne reecrit que le
# bloc du projet concerne, et un bloc dont la forme n'est pas reconnue est
# refuse au lieu d'etre reecrit de travers.

$ProjectIdPattern = '^[a-z0-9][a-z0-9-]*$'

# Champs listes, dans l'ordre ou l'editeur les presente. Tout champ absent de
# cette table est conserve tel quel a la fin du bloc : une donnee que l'outil
# ne comprend pas ne doit jamais disparaitre a l'enregistrement.
$ProjectFields = @(
  @{ key='title'; translate=$true;               kind='text';   group='Identite';    label='Titre' }
  @{ key='category'; translate=$true;            kind='text';   group='Identite';    label='Categorie' }
  @{ key='cardCategory'; translate=$true;        kind='text';   group='Identite';    label='Categorie courte (grille)'; help="Vide, la grille reprend la categorie." }
  @{ key='date';                kind='text';   group='Identite';    label='Date (AAAA-MM)'; help="Seule source de l'ordre du site." }
  @{ key='thumb';               kind='media';  group='Identite';    label='Vignette' }
  @{ key='studio';              kind='text';   group='Contexte';    label='Studio' }
  @{ key='roleTitle'; translate=$true;           kind='text';   group='Contexte';    label='Statut' }
  @{ key='client'; translate=$true;              kind='text';   group='Contexte';    label='Client' }
  @{ key='venue'; translate=$true;               kind='text';   group='Contexte';    label='Lieu' }
  @{ key='desc'; translate=$true;                kind='para';   group='Recit';       label='Accroche' }
  @{ key='overview'; translate=$true;            kind='para';   group='Recit';       label='Contexte' }
  @{ key='role'; translate=$true;                kind='text';   group='Recit';       label='Role' }
  @{ key='tools';               kind='list';   group='Recit';       label='Outils' }
  @{ key='contribution'; translate=$true;        kind='list';   group='Recit';       label='Contribution' }
  @{ key='contributionNote'; translate=$true;    kind='para';   group='Recit';       label='Note de contribution' }
  @{ key='designIntent'; translate=$true;        kind='para';   group='Recit';       label='Intention' }
  @{ key='technicalChallenges'; translate=$true; kind='list';   group='Recit';       label='Defi et reponse de production' }
  @{ key='rnd'; translate=$true;                 kind='list';   group='Recit';       label='Recherche' }
  @{ key='pipeline'; translate=$true;            kind='list';   group='Recit';       label='Etapes' }
  @{ key='impact'; translate=$true;              kind='para';   group='Recit';       label='Resultat' }
  @{ key='recognition'; translate=$true;         kind='list';   group='Recit';       label='Reconnaissances' }
  @{ key='heroImage';           kind='media';  group='Medias';      label='Image principale' }
  @{ key='galleryImages';       kind='medias'; group='Medias';      label='Galerie' }
  @{ key='placeholderTiles';    kind='number'; group='Medias';      label='Tuiles vides' }
  @{ key='trailerUrl';          kind='text';   group='Medias';      label='Lien video' }
  @{ key='videoUrls';           kind='list';   group='Medias';      label='Liens video (plusieurs)'; help="Rempli, il remplace le lien video unique : une tuile par adresse." }
  @{ key='trailerEmbedDisabled';kind='bool';   group='Medias';      label='Interdire la lecture integree' }
  @{ key='videoPoster';         kind='media';  group='Medias';      label='Affiche video' }
  @{ key='externalUrl';         kind='text';   group='Liens';       label='Lien externe' }
  @{ key='externalLabel'; translate=$true;       kind='text';   group='Liens';       label='Libelle du lien' }
  @{ key='creditsNote'; translate=$true;         kind='text';   group='Liens';       label='Credits' }
  @{ key='relatedProjects';     kind='projects'; group='Liens';     label='Projets lies'; help="Choisis parmi les projets existants : un titre saisi a la main ne renvoyait vers rien." }
  @{ key='listing';             kind='text';   group='Visibilite';  label='Affichage' }
  @{ key='lockedTitle'; translate=$true;         kind='text';   group='Visibilite';  label='Libelle de la tuile verrouillee' }
)

$ProjectFieldOrder = @($ProjectFields | ForEach-Object { $_.key })

# --- lecture d'un litteral JavaScript ---------------------------------------
# Le decoupage se fait au caractere : une virgule dans une phrase ne doit
# jamais etre prise pour un separateur, et une accolade dans un texte ne doit
# jamais compter comme une imbrication.
function Split-JsTopLevel([string]$body) {
  $parts = @()
  $depth = 0; $quote = $null; $escaped = $false
  $sb = New-Object System.Text.StringBuilder
  foreach ($c in $body.ToCharArray()) {
    if ($escaped) { [void]$sb.Append($c); $escaped = $false; continue }
    if ($c -eq '\') { [void]$sb.Append($c); $escaped = $true; continue }
    if ($quote) {
      [void]$sb.Append($c)
      if ($c -eq $quote) { $quote = $null }
      continue
    }
    if ($c -eq "'" -or $c -eq '"') { $quote = $c; [void]$sb.Append($c); continue }
    if ($c -eq '{' -or $c -eq '[') { $depth++; [void]$sb.Append($c); continue }
    if ($c -eq '}' -or $c -eq ']') { $depth--; [void]$sb.Append($c); continue }
    if ($c -eq ',' -and $depth -eq 0) { $parts += $sb.ToString(); [void]$sb.Clear(); continue }
    [void]$sb.Append($c)
  }
  if ($sb.Length -gt 0) { $parts += $sb.ToString() }
  return @($parts | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
}

function ConvertFrom-JsLiteral([string]$raw) {
  $raw = $raw.Trim()
  if ($raw.Length -ge 2 -and ($raw[0] -eq "'" -or $raw[0] -eq '"') -and $raw[$raw.Length-1] -eq $raw[0]) {
    return (ConvertFrom-SourceLiteral $raw.Substring(1, $raw.Length - 2))
  }
  if ($raw -eq 'true')  { return $true }
  if ($raw -eq 'false') { return $false }
  $n = 0
  if ([int]::TryParse($raw, [ref]$n)) { return $n }
  return $raw
}

# Corps d'un bloc de projet -> table des champs. Les valeurs qui ne sont ni
# texte, ni liste, ni nombre (protectedMedia, protected) sont conservees
# telles quelles, sous forme brute.
function ConvertFrom-ProjectBody([string]$body) {
  $out = [ordered]@{}
  foreach ($pair in (Split-JsTopLevel $body)) {
    $m = [regex]::Match($pair, '^\s*(?<k>[A-Za-z0-9_]+)\s*:\s*(?<v>[\s\S]*)$')
    if (-not $m.Success) { continue }
    $k = $m.Groups['k'].Value
    $v = $m.Groups['v'].Value.Trim()
    if ($v.StartsWith('[')) {
      $inner = $v.Substring(1, $v.Length - 2)
      $out[$k] = @(Split-JsTopLevel $inner | ForEach-Object { ConvertFrom-JsLiteral $_ })
    }
    elseif ($v.StartsWith('{')) {
      $out[$k] = [pscustomobject]@{ __raw = $v }
    }
    else {
      $out[$k] = ConvertFrom-JsLiteral $v
    }
  }
  return $out
}

# --- ecriture ----------------------------------------------------------------
# Le guillemet suit le contenu : une apostrophe dans le texte passe en
# guillemets doubles plutot que d'etre echappee. C'est la convention deja
# presente dans le fichier, et elle evite un bruit inutile dans les diffs.
function ConvertTo-JsString([string]$s) {
  if ($s.Contains("'") -and -not $s.Contains('"')) {
    return '"' + (ConvertTo-SourceLiteral $s ([char]'"')) + '"'
  }
  return "'" + (ConvertTo-SourceLiteral $s ([char]"'")) + "'"
}

function ConvertTo-JsValue($value, [string]$kind) {
  if ($kind -eq 'number') { return [string][int]$value }
  if ($kind -eq 'bool')   { if ($value) { return 'true' } else { return 'false' } }
  if ($kind -eq 'list' -or $kind -eq 'medias' -or $kind -eq 'projects') {
    $items = @($value | ForEach-Object { ConvertTo-JsString ([string]$_) })
    return '[' + ($items -join ', ') + ']'
  }
  return (ConvertTo-JsString ([string]$value))
}

# ============================================================ traduction FR ==
# Lecture et ecriture de data/fr.js. Le dictionnaire a pour cle la phrase
# anglaise elle-meme ; il n'y a donc pas de cle inventee a tenir en parallele,
# mais les cles sont des phrases entieres, parfois des paragraphes.
#
# Le fichier est reecrit en entier a chaque enregistrement, jamais retouche par
# ligne et decalage comme index.html. Une entree occupe une ou deux lignes selon
# sa longueur : l'ancrage par decalage y serait fragile pour ne rien gagner.
# Seul l'en-tete de documentation est conserve verbatim.

# Les cles JavaScript distinguent la casse, les tables PowerShell non :
# [ordered]@{} fondrait 'Next Project' et 'Next project' en une seule entree,
# et une traduction disparaitrait en silence. D'ou le comparateur ordinal.
function New-OrderedMap {
  return (New-Object System.Collections.Specialized.OrderedDictionary([System.StringComparer]::Ordinal))
}

# Indispensable avant tout decoupage : les commentaires de fr.js contiennent des
# apostrophes francaises (l'anglais, d'entree). Sans ce passage, une apostrophe
# isolee dans un commentaire ouvre une chaine qui ne se referme jamais et avale
# tout ce qui suit. Le retrait est lui-meme conscient des chaines, sinon une
# adresse contenant // serait tronquee.
function Remove-JsComments([string]$src) {
  $sb = New-Object System.Text.StringBuilder
  $quote = $null; $escaped = $false
  for ($i = 0; $i -lt $src.Length; $i++) {
    $c = $src[$i]
    if ($escaped) { [void]$sb.Append($c); $escaped = $false; continue }
    if ($quote) {
      [void]$sb.Append($c)
      if ($c -eq '\') { $escaped = $true }
      elseif ($c -eq $quote) { $quote = $null }
      continue
    }
    if ($c -eq "'" -or $c -eq '"') { $quote = $c; [void]$sb.Append($c); continue }
    if ($c -eq '/' -and $i + 1 -lt $src.Length) {
      $n = $src[$i + 1]
      if ($n -eq '/') {
        while ($i -lt $src.Length -and $src[$i] -ne "`n") { $i++ }
        [void]$sb.Append("`n"); continue
      }
      if ($n -eq '*') {
        $i += 2
        while ($i + 1 -lt $src.Length -and -not ($src[$i] -eq '*' -and $src[$i + 1] -eq '/')) { $i++ }
        $i++; [void]$sb.Append(' '); continue
      }
    }
    [void]$sb.Append($c)
  }
  return $sb.ToString()
}

# Une paire "cle: valeur" dont la cle peut etre un identifiant nu ou une chaine
# entre guillemets. ConvertFrom-ProjectBody n'accepte que la premiere forme ;
# les cles de fr.js sont des phrases anglaises, donc toujours entre guillemets.
function Split-JsPair([string]$pair) {
  $s = $pair.Trim()
  if ($s.Length -eq 0) { return $null }
  $quote = $null
  if ($s[0] -eq "'" -or $s[0] -eq '"') { $quote = $s[0] }

  if ($quote) {
    $escaped = $false
    for ($i = 1; $i -lt $s.Length; $i++) {
      $c = $s[$i]
      if ($escaped) { $escaped = $false; continue }
      if ($c -eq '\') { $escaped = $true; continue }
      if ($c -eq $quote) {
        $key = ConvertFrom-SourceLiteral $s.Substring(1, $i - 1)
        $rest = $s.Substring($i + 1).TrimStart()
        if (-not $rest.StartsWith(':')) { return $null }
        return @{ key = $key; value = $rest.Substring(1).Trim() }
      }
    }
    return $null
  }

  $m = [regex]::Match($s, '^(?<k>[A-Za-z0-9_$-]+)\s*:\s*(?<v>[\s\S]*)$')
  if (-not $m.Success) { return $null }
  return @{ key = $m.Groups['k'].Value; value = $m.Groups['v'].Value.Trim() }
}

function Get-JsInnerBody([string]$raw) {
  $t = $raw.Trim()
  if ($t.Length -lt 2) { return '' }
  return $t.Substring(1, $t.Length - 2)
}

function Read-FrFlatMap([string]$raw) {
  $out = New-OrderedMap
  foreach ($pair in (Split-JsTopLevel (Get-JsInnerBody $raw))) {
    $p = Split-JsPair $pair
    if ($p) { $out[$p.key] = [string](ConvertFrom-JsLiteral $p.value) }
  }
  return $out
}

function Read-FrStringList([string]$raw) {
  return @(Split-JsTopLevel (Get-JsInnerBody $raw) | ForEach-Object { [string](ConvertFrom-JsLiteral $_) })
}

function Read-FrHeadMap([string]$raw) {
  $out = New-OrderedMap
  foreach ($pair in (Split-JsTopLevel (Get-JsInnerBody $raw))) {
    $p = Split-JsPair $pair
    if ($p) { $out[$p.key] = Read-FrFlatMap $p.value }
  }
  return $out
}

function Read-FrProjectsMap([string]$raw) {
  $out = New-OrderedMap
  foreach ($pair in (Split-JsTopLevel (Get-JsInnerBody $raw))) {
    $p = Split-JsPair $pair
    if (-not $p) { continue }
    $fields = New-OrderedMap
    foreach ($f in (Split-JsTopLevel (Get-JsInnerBody $p.value))) {
      $fp = Split-JsPair $f
      if (-not $fp) { continue }
      if ($fp.value.StartsWith('[')) {
        $fields[$fp.key] = @(Split-JsTopLevel (Get-JsInnerBody $fp.value) | ForEach-Object { [string](ConvertFrom-JsLiteral $_) })
      } else {
        $fields[$fp.key] = [string](ConvertFrom-JsLiteral $fp.value)
      }
    }
    $out[$p.key] = $fields
  }
  return $out
}

function Read-FrDictionary {
  $vide = [ordered]@{ ui = (New-OrderedMap); uiSection = (New-OrderedMap); projects = (New-OrderedMap); head = (New-OrderedMap); stale = @() }
  if (-not (Test-Path -LiteralPath $FrFile -PathType Leaf)) { return $vide }

  $src = [System.IO.File]::ReadAllText($FrFile, [System.Text.UTF8Encoding]::new($false))
  $clean = Remove-JsComments $src

  $m = [regex]::Match($clean, 'window\.KP_FR\s*=\s*\{')
  if (-not $m.Success) { return $vide }

  # Fin du bloc : on suit la profondeur depuis l'accolade ouvrante plutot que
  # de chercher un motif, pour ne pas se faire piper par une accolade en texte.
  $start = $m.Index + $m.Length
  $depth = 1; $quote = $null; $escaped = $false; $end = -1
  for ($i = $start; $i -lt $clean.Length; $i++) {
    $c = $clean[$i]
    if ($escaped) { $escaped = $false; continue }
    if ($quote) {
      if ($c -eq '\') { $escaped = $true }
      elseif ($c -eq $quote) { $quote = $null }
      continue
    }
    if ($c -eq "'" -or $c -eq '"') { $quote = $c; continue }
    if ($c -eq '{' -or $c -eq '[') { $depth++; continue }
    if ($c -eq '}' -or $c -eq ']') { $depth--; if ($depth -eq 0) { $end = $i; break }; continue }
  }
  if ($end -lt 0) { return $vide }

  $out = [ordered]@{ ui = (New-OrderedMap); uiSection = (New-OrderedMap); projects = (New-OrderedMap); head = (New-OrderedMap); stale = @() }
  foreach ($pair in (Split-JsTopLevel $clean.Substring($start, $end - $start))) {
    $p = Split-JsPair $pair
    if (-not $p) { continue }
    switch ($p.key) {
      'ui'        { $out.ui        = Read-FrFlatMap     $p.value }
      'uiSection' { $out.uiSection = Read-FrFlatMap     $p.value }
      'head'      { $out.head      = Read-FrHeadMap     $p.value }
      'stale'     { $out.stale     = Read-FrStringList  $p.value }
      'projects'  { $out.projects  = Read-FrProjectsMap $p.value }
    }
  }
  return $out
}

# --- format de transport -----------------------------------------------------
# Tout circule a plat, en tableaux de paires, jamais en objets JSON.
# Deux raisons : ConvertFrom-Json rend un PSCustomObject dont les noms de
# propriete sont insensibles a la casse, ce qui ferait entrer en collision
# 'Next Project' et 'Next project' ; et une structure plate reste sous la
# profondeur de serialisation de Send-Json.
function ConvertTo-FrPayload($data) {
  $ui = @(); foreach ($k in $data.ui.Keys)        { $ui        += @{ k = $k; v = [string]$data.ui[$k] } }
  $us = @(); foreach ($k in $data.uiSection.Keys) { $us        += @{ k = $k; v = [string]$data.uiSection[$k] } }
  $pr = @()
  foreach ($id in $data.projects.Keys) {
    foreach ($f in $data.projects[$id].Keys) {
      $v = $data.projects[$id][$f]
      if ($v -is [array]) { $pr += @{ id = $id; field = $f; list = $true;  v = @($v | ForEach-Object { [string]$_ }) } }
      else                { $pr += @{ id = $id; field = $f; list = $false; v = @([string]$v) } }
    }
  }
  $hd = @()
  foreach ($e in $data.head.Keys) {
    foreach ($f in $data.head[$e].Keys) { $hd += @{ screen = $e; field = $f; v = [string]$data.head[$e][$f] } }
  }
  return @{ ui = $ui; uiSection = $us; projects = $pr; head = $hd; stale = @($data.stale) }
}

function ConvertFrom-FrPayload($body) {
  $out = [ordered]@{ ui = (New-OrderedMap); uiSection = (New-OrderedMap); projects = (New-OrderedMap); head = (New-OrderedMap); stale = @() }

  foreach ($p in @($body.ui))        { if ($p -and $p.k) { $out.ui[[string]$p.k]        = [string]$p.v } }
  foreach ($p in @($body.uiSection)) { if ($p -and $p.k) { $out.uiSection[[string]$p.k] = [string]$p.v } }

  foreach ($p in @($body.projects)) {
    if (-not $p -or -not $p.id -or -not $p.field) { continue }
    $id = [string]$p.id
    if (-not $out.projects.Contains($id)) { $out.projects[$id] = New-OrderedMap }
    if ($p.list) { $out.projects[$id][[string]$p.field] = @(@($p.v) | ForEach-Object { [string]$_ }) }
    else         { $out.projects[$id][[string]$p.field] = [string](@($p.v)[0]) }
  }

  foreach ($p in @($body.head)) {
    if (-not $p -or -not $p.screen -or -not $p.field) { continue }
    $e = [string]$p.screen
    if (-not $out.head.Contains($e)) { $out.head[$e] = New-OrderedMap }
    $out.head[$e][[string]$p.field] = [string]$p.v
  }

  $out.stale = @(@($body.stale) | ForEach-Object { [string]$_ } | Where-Object { $_ -ne '' })
  return $out
}

# Associe chaque phrase anglaise au nom de la fonction qui la contient dans
# index.html, pour que les regroupements du fichier suivent la liste de l'editeur.
function Get-FrSectionMap {
  $map = New-OrderedMap
  foreach ($it in (Get-Strings)) {
    if (-not $map.Contains($it.text)) { $map[$it.text] = $it.section }
  }
  return $map
}

# Cle et valeur sur une ligne tant que ca reste lisible, sinon la valeur passe a
# la ligne suivante. Le seuil vaut pour le confort de relecture des diffs.
function Format-FrEntry([string]$key, [string]$value, [int]$indent) {
  $pad = ' ' * $indent
  $line = $pad + $key + ': ' + $value
  if ($line.Length -le 110) { return @($line) }
  # Parentheses obligatoires : la virgule lie plus fort que +, sans elles les
  # deux lignes se concatenaient en une seule.
  return @(($pad + $key + ':'), ($pad + '  ' + $value))
}

# $sections associe une phrase anglaise au nom de la fonction qui la contient
# dans index.html. Les regroupements du fichier en sont deduits : l'ordre du
# dictionnaire suit ainsi celui de la liste affichee dans l'editeur.
function Write-FrDictionary($data, $sections) {
  $entete = @"
/**
 * Traduction francaise du portfolio.
 *
 * FICHIER GENERE par l'editeur local (tools/). Il se relit sans peine et se
 * corrige a la main sans risque, mais tout enregistrement depuis l'outil le
 * reecrit en entier : les commentaires ajoutes ici ne survivent pas.
 *
 * L'anglais reste la source unique. Il vit dans index.html et data/projects.js
 * et s'edite normalement ; ce fichier est une couche posee par-dessus. Une
 * entree absente retombe sur l'anglais, donc le site ne casse jamais, meme a
 * moitie traduit.
 *
 * ui        La cle est la phrase anglaise elle-meme, au caractere pres.
 * uiSection Cas rares ou la meme phrase doit diverger selon l'endroit.
 * projects  Surcharges des fiches, par identifiant puis par champ.
 * head      Titres et descriptions de page, par ecran.
 * stale     Traductions dont l'anglais a change depuis. A relire, puis a
 *           retirer d'ici. L'editeur les signale par un badge.
 *
 * Les reperes {...} se remplacent apres traduction : le francais peut donc les
 * remettre dans un autre ordre que l'anglais.
 *
 * Les noms propres ne se traduisent pas : titres d'oeuvres, studios, clients,
 * festivals, prix, logiciels.
 */
"@
  $entete = ($entete -replace "`r`n", "`n") -replace "`n", "`r`n"

  $L = New-Object System.Collections.Generic.List[string]
  [void]$L.Add('window.KP_FR = {')

  [void]$L.Add('  ui: {')
  $parSection = New-OrderedMap
  foreach ($k in $data.ui.Keys) {
    $sec = 'Autres'
    if ($sections -and $sections.Contains($k)) { $sec = [string]$sections[$k] }
    if (-not $parSection.Contains($sec)) { $parSection[$sec] = (New-Object System.Collections.Generic.List[string]) }
    $parSection[$sec].Add($k)
  }
  $premier = $true
  foreach ($sec in $parSection.Keys) {
    if (-not $premier) { [void]$L.Add('') }
    $premier = $false
    [void]$L.Add('    /* ' + $sec + ' */')
    foreach ($k in $parSection[$sec]) {
      foreach ($ligne in (Format-FrEntry (ConvertTo-JsString $k) ((ConvertTo-JsString ([string]$data.ui[$k])) + ',') 4)) {
        [void]$L.Add($ligne)
      }
    }
  }
  [void]$L.Add('  },')
  [void]$L.Add('')

  if ($data.uiSection.Count -eq 0) {
    [void]$L.Add('  uiSection: {},')
  } else {
    [void]$L.Add('  uiSection: {')
    foreach ($k in $data.uiSection.Keys) {
      foreach ($ligne in (Format-FrEntry (ConvertTo-JsString $k) ((ConvertTo-JsString ([string]$data.uiSection[$k])) + ',') 4)) {
        [void]$L.Add($ligne)
      }
    }
    [void]$L.Add('  },')
  }
  [void]$L.Add('')

  if ($data.projects.Count -eq 0) {
    [void]$L.Add('  projects: {},')
  } else {
    [void]$L.Add('  projects: {')
    $premier = $true
    foreach ($id in $data.projects.Keys) {
      if (-not $premier) { [void]$L.Add('') }
      $premier = $false
      [void]$L.Add('    ' + (Format-ProjectKey $id) + ': {')
      $champs = $data.projects[$id]
      $noms = @($champs.Keys)
      for ($i = 0; $i -lt $noms.Count; $i++) {
        $nom = $noms[$i]
        $v = $champs[$nom]
        $virgule = $(if ($i -lt $noms.Count - 1) { ',' } else { '' })
        if ($v -is [array]) {
          $items = @($v | ForEach-Object { ConvertTo-JsString ([string]$_) })
          $rendu = '[' + ($items -join ', ') + ']'
        } else {
          $rendu = ConvertTo-JsString ([string]$v)
        }
        foreach ($ligne in (Format-FrEntry (Format-ProjectKey $nom) ($rendu + $virgule) 6)) {
          [void]$L.Add($ligne)
        }
      }
      [void]$L.Add('    },')
    }
    $L[$L.Count - 1] = '    }'
    [void]$L.Add('  },')
  }
  [void]$L.Add('')

  if ($data.head.Count -eq 0) {
    [void]$L.Add('  head: {},')
  } else {
    [void]$L.Add('  head: {')
    $noms = @($data.head.Keys)
    for ($i = 0; $i -lt $noms.Count; $i++) {
      $ecran = $noms[$i]
      $virgule = $(if ($i -lt $noms.Count - 1) { ',' } else { '' })
      [void]$L.Add('    ' + (Format-ProjectKey $ecran) + ': {')
      $champs = $data.head[$ecran]
      $cles = @($champs.Keys)
      for ($j = 0; $j -lt $cles.Count; $j++) {
        $vg = $(if ($j -lt $cles.Count - 1) { ',' } else { '' })
        foreach ($ligne in (Format-FrEntry (Format-ProjectKey $cles[$j]) ((ConvertTo-JsString ([string]$champs[$cles[$j]])) + $vg) 6)) {
          [void]$L.Add($ligne)
        }
      }
      [void]$L.Add('    }' + $virgule)
    }
    [void]$L.Add('  },')
  }
  [void]$L.Add('')

  if (@($data.stale).Count -eq 0) {
    [void]$L.Add('  stale: []')
  } else {
    [void]$L.Add('  stale: [')
    $items = @($data.stale)
    for ($i = 0; $i -lt $items.Count; $i++) {
      $vg = $(if ($i -lt $items.Count - 1) { ',' } else { '' })
      [void]$L.Add('    ' + (ConvertTo-JsString ([string]$items[$i])) + $vg)
    }
    [void]$L.Add('  ]')
  }
  [void]$L.Add('};')

  $src = Get-Source "fr"
  if ($src) { Backup-Source $src }
  $texte = $entete + "`r`n" + ($L -join "`r`n") + "`r`n"
  [System.IO.File]::WriteAllText($FrFile, $texte, [System.Text.UTF8Encoding]::new($false))
}

# --- reperage des blocs ------------------------------------------------------
# Une cle contenant un tiret n'est pas un identifiant JavaScript valide : elle
# doit etre ecrite entre apostrophes. Les deux formes coexistent donc dans le
# fichier, et tout ce qui le lit doit accepter les deux.
$ProjectKeyPattern = "^  (?:'(?<id>[^']+)'|(?<id>[A-Za-z0-9_\$]+)):\s*\{"

function Format-ProjectKey([string]$id) {
  if ($id -match '^[A-Za-z_$][A-Za-z0-9_$]*$') { return $id }
  return "'" + $id + "'"
}

function Get-ProjectBlocks([string[]]$lines) {
  $blocks = @()
  $open = -1; $id = $null
  for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($open -lt 0) {
      if ($lines[$i] -match ($ProjectKeyPattern + '\s*$')) { $open = $i; $id = $Matches['id'] }
      continue
    }
    if ($lines[$i] -match '^  \},?\s*$') {
      $body = ($lines[($open + 1)..($i - 1)] -join "`n")
      $blocks += [pscustomobject]@{ id = $id; start = $open; end = $i; body = $body }
      $open = -1; $id = $null
    }
  }
  return $blocks
}

function Get-ProjectRecords {
  $src = Get-Source "projects"
  if (-not $src) { return @() }
  $lines = Read-SourceLines $src
  $out = @()
  foreach ($b in (Get-ProjectBlocks $lines)) {
    $fields = ConvertFrom-ProjectBody $b.body
    $out += [pscustomobject]@{ id = $b.id; start = $b.start; end = $b.end; fields = $fields }
  }
  return $out
}

# Vue courte pour la liste de l'editeur : ce qu'il faut pour reconnaitre un
# projet et voir son etat, rien de plus.
function Get-ProjectSummaries {
  $out = @()
  foreach ($r in (Get-ProjectRecords)) {
    $f = $r.fields
    $protected = $f.Contains('protected')
    $gallery = @()
    if ($f.Contains('galleryImages')) { $gallery = @($f['galleryImages']) }
    $listing = if ($f.Contains('listing')) { [string]$f['listing'] } else { '' }
    $out += [pscustomobject]@{
      id        = $r.id
      title     = $(if ($f.Contains('title')) { [string]$f['title'] } else { '' })
      date      = $(if ($f.Contains('date')) { [string]$f['date'] } else { '' })
      category  = $(if ($f.Contains('category')) { [string]$f['category'] } else { '' })
      thumb     = $(if ($f.Contains('thumb')) { [string]$f['thumb'] } else { '' })
      listing   = $listing
      protected = $protected
      hasLink   = $f.Contains('protectedMedia')
      medias    = $gallery.Count
    }
  }
  return @($out | Sort-Object -Property date -Descending)
}

function Get-ProjectDetail([string]$id) {
  $rec = Get-ProjectRecords | Where-Object { $_.id -eq $id } | Select-Object -First 1
  if (-not $rec) { return $null }
  $values = [ordered]@{}
  $extra = [ordered]@{}
  foreach ($k in $rec.fields.Keys) {
    if ($ProjectFieldOrder -contains $k) { $values[$k] = $rec.fields[$k] }
    else { $extra[$k] = $rec.fields[$k] }
  }
  # La ressource chiffree repart telle quelle vers l'editeur : c'est lui qui
  # dechiffre, avec le code saisi par son utilisateur.
  $resource = $null
  if ($rec.fields.Contains('protected')) {
    $raw = $rec.fields['protected']
    if ($raw -is [pscustomobject] -and $raw.PSObject.Properties['__raw']) {
      $inner = $raw.__raw.Trim()
      $inner = $inner.Substring(1, $inner.Length - 2)
      $resource = ConvertFrom-ProjectBody $inner
    }
  }
  return @{ id = $rec.id; values = $values; extraKeys = @($extra.Keys); protectedResource = $resource }
}

# Rend le bloc complet d'un projet.
#
# L'ordre des champs suit celui deja present dans le fichier, et les nouveaux
# champs viennent ensuite. Un enregistrement qui ne change rien doit rendre un
# bloc identique au caractere pres : sans cela, chaque sauvegarde produirait un
# diff illisible ou tout le projet parait avoir bouge.
function Format-ProjectBlock([string]$id, $values, $preserved, $existingOrder) {
  $order = @()
  foreach ($k in @($existingOrder)) {
    if ($null -eq $k) { continue }
    if (($values.Contains($k) -or ($preserved -and $preserved.Contains($k))) -and $order -notcontains $k) { $order += $k }
  }
  foreach ($def in $ProjectFields) {
    if ($values.Contains($def.key) -and $order -notcontains $def.key) { $order += $def.key }
  }
  if ($preserved) {
    foreach ($k in $preserved.Keys) { if ($order -notcontains $k) { $order += $k } }
  }

  $out = @("  " + (Format-ProjectKey $id) + ": {")
  foreach ($k in $order) {
    if ($values.Contains($k)) {
      $def = $ProjectFields | Where-Object { $_.key -eq $k } | Select-Object -First 1
      $kind = $(if ($def) { $def.kind } else { 'text' })
      $v = $values[$k]
      if ($null -eq $v) { continue }
      if ($kind -eq 'list' -or $kind -eq 'medias' -or $kind -eq 'projects') {
        $arr = @($v | Where-Object { $null -ne $_ -and ([string]$_).Trim() -ne '' })
        if ($arr.Count -eq 0) { continue }
        $out += "    ${k}: " + (ConvertTo-JsValue $arr $kind) + ","
      }
      elseif ($kind -eq 'bool') {
        if (-not $v) { continue }
        $out += "    ${k}: true,"
      }
      elseif ($kind -eq 'number') {
        $out += "    ${k}: " + ([string][int]$v) + ","
      }
      else {
        $s = [string]$v
        if ($s.Trim() -eq '') { continue }
        $out += "    ${k}: " + (ConvertTo-JsString $s) + ","
      }
    }
    elseif ($preserved -and $preserved.Contains($k)) {
      $raw = $preserved[$k]
      if ($raw -is [pscustomobject] -and $raw.PSObject.Properties['__raw']) {
        $out += "    ${k}: " + $raw.__raw + ","
      } elseif ($raw -is [array]) {
        $out += "    ${k}: " + (ConvertTo-JsValue $raw 'list') + ","
      } elseif ($raw -is [bool]) {
        $out += "    ${k}: " + (ConvertTo-JsValue $raw 'bool') + ","
      } elseif ($raw -is [int]) {
        $out += "    ${k}: " + (ConvertTo-JsValue $raw 'number') + ","
      } else {
        $out += "    ${k}: " + (ConvertTo-JsValue $raw 'text') + ","
      }
    }
  }
  # derniere virgule retiree : la forme reste celle du fichier genere
  if ($out.Count -gt 1 -and $out[$out.Count - 1].EndsWith(',')) {
    $out[$out.Count - 1] = $out[$out.Count - 1].TrimEnd(',')
  }
  $out += "  }"

  # Une valeur conservee peut s'etendre sur plusieurs lignes, protectedMedia
  # notamment. Elle doit ressortir en autant de lignes, sinon ses retours
  # internes resteraient en LF dans un fichier ecrit en CRLF.
  $expanded = @()
  foreach ($line in $out) {
    foreach ($piece in ($line -split "\r?\n")) { $expanded += $piece }
  }
  return $expanded
}

# La virgule de fin de bloc depend de la position, pas du contenu : on la
# retablit apres chaque insertion ou suppression plutot que de la calculer au
# moment d'ecrire un bloc isole.
function Repair-BlockCommas([System.Collections.Generic.List[string]]$lines) {
  $blocks = @(Get-ProjectBlocks $lines.ToArray())
  for ($i = 0; $i -lt $blocks.Count; $i++) {
    $isLast = ($i -eq $blocks.Count - 1)
    $lines[$blocks[$i].end] = $(if ($isLast) { "  }" } else { "  }," })
  }
}

function Read-ProjectFileLines {
  $src = Get-Source "projects"
  if (-not $src) { throw "data/projects.js introuvable." }
  $list = [System.Collections.Generic.List[string]]::new()
  foreach ($l in (Read-SourceLines $src)) { $list.Add($l) }
  # la virgule empeche PowerShell de derouler la liste en tableau fige
  return ,$list
}

function Write-ProjectFileLines([System.Collections.Generic.List[string]]$lines) {
  $src = Get-Source "projects"
  Backup-Source $src
  [System.IO.File]::WriteAllLines($src.path, $lines.ToArray(), [System.Text.UTF8Encoding]::new($false))
}

function Test-ProjectId([string]$id) { return ($id -and ($id -cmatch $ProjectIdPattern)) }

# Ecrit un projet : remplace son bloc s'il existe, l'ajoute sinon. Les autres
# blocs ne sont pas touches, donc le diff reste lisible.
function Save-Project($payload) {
  $id = [string]$payload.id
  if (-not (Test-ProjectId $id)) {
    return @{ ok = $false; reason = "Identifiant invalide : minuscules, chiffres et tirets uniquement." }
  }
  $incoming = $payload.values
  if (-not $incoming) { return @{ ok = $false; reason = "Aucune donnee recue." } }

  $date = [string]$incoming.date
  if ($date -notmatch '^\d{4}-(0[1-9]|1[0-2])$') {
    return @{ ok = $false; reason = "La date doit s'ecrire AAAA-MM, par exemple 2026-03." }
  }
  $title = [string]$incoming.title
  $existing = Get-ProjectRecords | Where-Object { $_.id -eq $id } | Select-Object -First 1
  # Ecrire en clair par-dessus une fiche protegee publierait ce que le
  # chiffrement met a l'abri. La levee de protection est un geste separe.
  if ($existing -and $existing.fields.Contains('protected')) {
    return @{ ok = $false; reason = "Cette fiche est protegee. Deprotege-la avant de la modifier." }
  }
  if ([string]::IsNullOrWhiteSpace($title)) {
    return @{ ok = $false; reason = "Le titre est obligatoire." }
  }

  # Champs conserves : tout ce que l'editeur ne presente pas, contenu chiffre
  # en tete. Les perdre silencieusement rendrait une fiche protegee illisible.
  $preserved = [ordered]@{}
  if ($existing) {
    foreach ($k in $existing.fields.Keys) {
      if ($ProjectFieldOrder -notcontains $k) { $preserved[$k] = $existing.fields[$k] }
    }
  }

  $values = [ordered]@{}
  foreach ($def in $ProjectFields) {
    $prop = $incoming.PSObject.Properties[$def.key]
    if (-not $prop) { continue }
    $v = $prop.Value
    if ($null -eq $v) { continue }
    if ($def.kind -eq 'list' -or $def.kind -eq 'medias' -or $def.kind -eq 'projects') { $values[$def.key] = @($v) }
    elseif ($def.kind -eq 'bool') { $values[$def.key] = [bool]$v }
    elseif ($def.kind -eq 'number') { $values[$def.key] = [int]$v }
    else { $values[$def.key] = [string]$v }
  }

  $existingOrder = @()
  if ($existing) { $existingOrder = @($existing.fields.Keys) }
  $block = Format-ProjectBlock $id $values $preserved $existingOrder
  $lines = Read-ProjectFileLines
  $blocks = @(Get-ProjectBlocks $lines.ToArray())
  $target = $blocks | Where-Object { $_.id -eq $id } | Select-Object -First 1

  if ($target) {
    $lines.RemoveRange($target.start, $target.end - $target.start + 1)
    $lines.InsertRange($target.start, [string[]]$block)
    $created = $false
  } else {
    $close = -1
    for ($i = $lines.Count - 1; $i -ge 0; $i--) {
      if ($lines[$i] -match '^\};?\s*$') { $close = $i; break }
    }
    if ($close -lt 0) { return @{ ok = $false; reason = "Fin du fichier de donnees introuvable." } }
    $lines.InsertRange($close, [string[]]$block)
    $created = $true
  }

  Repair-BlockCommas $lines
  Write-ProjectFileLines $lines
  Update-Sitemap
  return @{ ok = $true; id = $id; created = $created; stamp = (Get-FileStamp) }
}

# Retire la fiche. Les medias restent sur le disque : la regle du depot
# interdit de supprimer un media sans autorisation explicite, et une fiche
# retiree par erreur doit pouvoir etre refaite sans rien avoir perdu.
function Remove-Project([string]$id) {
  if (-not (Test-ProjectId $id)) { return @{ ok = $false; reason = "Identifiant invalide." } }
  $lines = Read-ProjectFileLines
  $blocks = @(Get-ProjectBlocks $lines.ToArray())
  if ($blocks.Count -le 1) {
    return @{ ok = $false; reason = "Le site doit garder au moins un projet." }
  }
  $target = $blocks | Where-Object { $_.id -eq $id } | Select-Object -First 1
  if (-not $target) { return @{ ok = $false; reason = "Projet introuvable : $id" } }

  # Les medias d'une fiche protegee portent des noms aleatoires, et la
  # correspondance avec leurs noms d'origine vit dans le contenu chiffre.
  # Supprimer la fiche d'abord la detruirait, laissant sur le disque des
  # fichiers que plus rien ne permet d'identifier.
  $record = Get-ProjectRecords | Where-Object { $_.id -eq $id } | Select-Object -First 1
  if ($record -and $record.fields.Contains('protected')) {
    return @{ ok = $false; reason = "Deprotege d'abord cette fiche : sinon ses medias resteraient sur le disque sous des noms illisibles." }
  }

  $mediaDir = Join-Path $Root ("projects\" + $id)
  $keptMedia = (Test-Path -LiteralPath $mediaDir -PathType Container)

  $lines.RemoveRange($target.start, $target.end - $target.start + 1)
  Repair-BlockCommas $lines
  Write-ProjectFileLines $lines
  Update-Sitemap
  return @{ ok = $true; id = $id; keptMedia = $keptMedia; mediaDir = "projects/$id"; stamp = (Get-FileStamp) }
}

# Le plan du site liste les vignettes des projets. Il se recalcule a chaque
# ajout, retrait ou mise sous protection, sinon il pointerait vers des images
# disparues, ou pire : il publierait le chemin d'un media protege, que tout
# le chiffrement vise justement a garder hors de portee.
function Update-Sitemap {
  $path = Join-Path $Root "sitemap.xml"
  if (-not (Test-Path $path)) { return }
  $enc = [System.Text.UTF8Encoding]::new($false)
  $text = [System.IO.File]::ReadAllText($path, $enc)

  $images = @("https://killianpichon.art/assets/og-image.jpg")
  foreach ($r in (Get-ProjectRecords)) {
    $f = $r.fields
    if ($f.Contains('protected')) { continue }
    if ($f.Contains('listing') -and [string]$f['listing'] -eq 'hidden') { continue }
    if (-not $f.Contains('thumb')) { continue }
    $images += "https://killianpichon.art/" + ([string]$f['thumb']).TrimStart('/')
  }

  $block = ($images | Select-Object -Unique | ForEach-Object { "    <image:image>`r`n      <image:loc>$_</image:loc>`r`n    </image:image>" }) -join "`r`n"
  $updated = [regex]::Replace($text, '(?s)(\r?\n)\s*<image:image>.*?</image:image>\s*(\r?\n  </url>)', "`r`n$block`$2")
  $updated = [regex]::Replace($updated, '<lastmod>[^<]*</lastmod>', "<lastmod>$(Get-Date -Format 'yyyy-MM-dd')</lastmod>")
  if ($updated -ne $text) { [System.IO.File]::WriteAllText($path, $updated, $enc) }
}

# ------------------------------------------------------- fichiers de projet
# Tout chemin recu de l'editeur passe par ici. La verification porte sur le
# chemin resolu, pas sur la chaine : aucune variante d'ecriture ne permet de
# viser un fichier hors du dossier projects/.
$MediaExtensions = @('.avif','.webp','.jpg','.jpeg','.png','.gif','.svg','.mp4','.webm')

# Media du site, quel que soit son dossier d'origine : sert a verifier une
# vignette qu'on laisse en clair, sans autoriser pour autant a designer un
# fichier hors du site.
function Resolve-PublicMedia([string]$rel) {
  if ([string]::IsNullOrWhiteSpace($rel)) { return $null }
  if ($rel -match '^[A-Za-z]:' -or $rel.StartsWith('/') -or $rel.StartsWith('\')) { return $null }
  if ($rel.Contains('..')) { return $null }
  $full = [System.IO.Path]::GetFullPath((Join-Path $Root ($rel -replace '/', '\')))
  $sep = [System.IO.Path]::DirectorySeparatorChar
  foreach ($dir in @('projects', 'assets')) {
    $base = [System.IO.Path]::GetFullPath((Join-Path $Root $dir))
    if ($full.StartsWith($base + $sep, [StringComparison]::OrdinalIgnoreCase)) { return $full }
  }
  return $null
}

function Resolve-ProjectPath([string]$rel) {
  if ([string]::IsNullOrWhiteSpace($rel)) { return $null }
  if ($rel -match '^[A-Za-z]:' -or $rel.StartsWith('/') -or $rel.StartsWith('\')) { return $null }
  if ($rel.Contains('..')) { return $null }
  $full = [System.IO.Path]::GetFullPath((Join-Path $Root ($rel -replace '/', '\')))
  $projectsRoot = [System.IO.Path]::GetFullPath((Join-Path $Root 'projects'))
  $sep = [System.IO.Path]::DirectorySeparatorChar
  if (-not $full.StartsWith($projectsRoot + $sep, [StringComparison]::OrdinalIgnoreCase)) { return $null }
  return $full
}

# Nom de fichier reduit a ce qui est sur : un media televerse ne doit jamais
# pouvoir choisir son emplacement, seulement son nom.
function Get-SafeFileName([string]$name) {
  $name = [System.IO.Path]::GetFileName($name)
  $ext = [System.IO.Path]::GetExtension($name).ToLowerInvariant()
  if ($MediaExtensions -notcontains $ext) { return $null }
  $base = [System.IO.Path]::GetFileNameWithoutExtension($name).ToLowerInvariant()
  $base = ($base -replace '[^a-z0-9._-]', '-') -replace '-{2,}', '-'
  $base = $base.Trim('-', '.')
  if ([string]::IsNullOrWhiteSpace($base)) { $base = "media" }
  if ($base.Length -gt 60) { $base = $base.Substring(0, 60) }
  return "$base$ext"
}

function Save-UploadedMedia([string]$projectId, [string]$fileName, [byte[]]$bytes) {
  if (-not (Test-ProjectId $projectId)) { return @{ ok = $false; reason = "Identifiant de projet invalide." } }
  $safe = Get-SafeFileName $fileName
  if (-not $safe) { return @{ ok = $false; reason = "Format non accepte. Formats permis : " + ($MediaExtensions -join ' ') }}
  if ($bytes.Length -eq 0) { return @{ ok = $false; reason = "Fichier vide." } }

  $dir = Join-Path $Root ("projects\" + $projectId)
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

  # Un fichier existant n'est jamais ecrase : le doublon prend un suffixe.
  $target = Join-Path $dir $safe
  if (Test-Path -LiteralPath $target) {
    $base = [System.IO.Path]::GetFileNameWithoutExtension($safe)
    $ext = [System.IO.Path]::GetExtension($safe)
    $n = 2
    while (Test-Path -LiteralPath $target) {
      $safe = "$base-$n$ext"
      $target = Join-Path $dir $safe
      $n++
    }
  }
  [System.IO.File]::WriteAllBytes($target, $bytes)
  return @{ ok = $true; path = "projects/$projectId/$safe"; bytes = $bytes.Length }
}

# Deplacements de medias demandes lors d'une mise sous protection, ou de sa
# levee. Rien n'est ecrase, et un deplacement impossible interrompt la serie
# avant d'avoir touche quoi que ce soit.
# Un projet ne deplace que ses propres medias. Sans cette regle, proteger un
# projet qui reutilise l'image d'un autre emporterait cette image et laisserait
# l'autre fiche avec une vignette morte.
function Test-OwnedMedia([string]$rel, [string]$id) {
  return ([string]$rel).StartsWith("projects/$id/", [StringComparison]::OrdinalIgnoreCase)
}

function Move-ProjectMedia($moves, [string]$ownerId, [string]$side) {
  $planned = @()
  foreach ($m in @($moves)) {
    if ($ownerId) {
      $owned = $(if ($side -eq 'restore') { [string]$m.to } else { [string]$m.from })
      if (-not (Test-OwnedMedia $owned $ownerId)) {
        return @{ ok = $false; reason = "Ce media n'appartient pas au projet $ownerId : $owned. Copie-le dans projects/$ownerId/ avant de proteger la fiche." }
      }
    }
    $from = Resolve-ProjectPath ([string]$m.from)
    $to   = Resolve-ProjectPath ([string]$m.to)
    if (-not $from -or -not $to) { return @{ ok = $false; reason = "Chemin de media refuse : $($m.from) -> $($m.to)" } }
    # Un meme fichier peut etre cite deux fois dans une fiche, en vignette et
    # en galerie. Il ne se deplace qu'une fois : sans ce filtre, le second
    # deplacement echouait sur un fichier deja parti.
    if ($planned | Where-Object { $_.from -eq $from }) { continue }
    if ($planned | Where-Object { $_.to -eq $to }) { return @{ ok = $false; reason = "Deux medias vises au meme endroit : $($m.to)" } }
    if (-not (Test-Path -LiteralPath $from -PathType Leaf)) { return @{ ok = $false; reason = "Media introuvable : $($m.from)" } }
    if (Test-Path -LiteralPath $to) { return @{ ok = $false; reason = "Destination deja occupee : $($m.to)" } }
    $planned += @{ from = $from; to = $to }
  }
  $done = 0
  foreach ($p in $planned) {
    try {
      $dir = Split-Path -Parent $p.to
      if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
      Move-Item -LiteralPath $p.from -Destination $p.to
      $done++
    } catch {
      # Interrompre ici laisse les fichiers deja deplaces la ou ils sont : on
      # le dit, plutot que de laisser croire que rien n'a bouge.
      return @{ ok = $false; reason = "Deplacement interrompu apres $done fichier(s) : $($_.Exception.Message)" }
    }
  }
  # Le dossier d'origine vide n'a plus de raison d'exister. Il n'est retire
  # que s'il ne contient plus rien : aucun fichier ne peut disparaitre ici.
  foreach ($dir in (@($planned | ForEach-Object { Split-Path -Parent $_.from }) | Select-Object -Unique)) {
    try {
      if ((Test-Path $dir) -and -not (Get-ChildItem -LiteralPath $dir -Force)) { Remove-Item -LiteralPath $dir -Force }
    } catch {}
  }
  return @{ ok = $true; moved = $done }
}

# Le chiffrement lui-meme se fait dans le navigateur de l'editeur : Windows
# PowerShell 5.1 n'expose pas AES-GCM, et surtout le code d'acces n'a alors
# aucune raison de traverser le serveur. Ici on ne fait que verifier la forme
# de la ressource recue avant de l'ecrire.
function Test-ProtectedResource($resource) {
  if (-not $resource) { return "ressource absente" }
  foreach ($k in @('id','version','iterations','salt','iv','ciphertext')) {
    if (-not $resource.PSObject.Properties[$k]) { return "champ manquant : $k" }
  }
  if ([int]$resource.iterations -lt 100000) { return "nombre d'iterations trop faible" }
  foreach ($k in @('salt','iv','ciphertext')) {
    try { [void][Convert]::FromBase64String([string]$resource.$k) }
    catch { return "champ $k illisible" }
  }
  return $null
}

function Protect-ProjectRecord($payload) {
  $id = [string]$payload.id
  if (-not (Test-ProjectId $id)) { return @{ ok = $false; reason = "Identifiant invalide." } }
  $problem = Test-ProtectedResource $payload.resource
  if ($problem) { return @{ ok = $false; reason = "Ressource protegee invalide : $problem" } }

  $existing = Get-ProjectRecords | Where-Object { $_.id -eq $id } | Select-Object -First 1
  if (-not $existing) { return @{ ok = $false; reason = "Projet introuvable : $id" } }
  $date = [string]$existing.fields['date']
  if (-not $date) { return @{ ok = $false; reason = "Le projet n'a pas de date : impossible de le classer une fois protege." } }

  $listing = [string]$payload.listing
  if ($listing -ne 'locked' -and $listing -ne 'hidden' -and $listing -ne 'nda') { $listing = 'locked' }
  $lockedTitle = [string]$payload.lockedTitle
  if ([string]::IsNullOrWhiteSpace($lockedTitle)) { $lockedTitle = 'Projet protege' }

  $moveResult = Move-ProjectMedia $payload.moves $id 'protect'
  if (-not $moveResult.ok) { return $moveResult }

  # Ne reste en clair que ce qui sert a classer et a afficher la tuile.
  # En mode NDA, la vignette reste lisible : c'est un choix assume, la tuile
  # doit montrer une image. Le fichier reste donc a sa place, et lui seul.
  $values = [ordered]@{ date = $date; listing = $listing }
  if ($listing -ne 'hidden') { $values['lockedTitle'] = $lockedTitle }
  if ($listing -eq 'nda') {
    # La vignette peut venir de n'importe quel dossier de medias du site : elle
    # ne bouge pas, elle reste simplement lisible. Seul compte le fait qu'elle
    # existe et qu'elle ne sorte pas du site.
    $thumb = [string]$payload.thumb
    $thumbPath = Resolve-PublicMedia $thumb
    if (-not $thumbPath -or -not (Test-Path -LiteralPath $thumbPath -PathType Leaf)) {
      return @{ ok = $false; reason = "Vignette introuvable : $thumb" }
    }
    $values['thumb'] = $thumb
  }
  $preserved = [ordered]@{ protected = [pscustomobject]@{ __raw = (Format-ResourceLiteral $payload.resource) } }

  $block = Format-ProjectBlock $id $values $preserved @('date','listing','lockedTitle','thumb','protected')
  $lines = Read-ProjectFileLines
  $blocks = @(Get-ProjectBlocks $lines.ToArray())
  $target = $blocks | Where-Object { $_.id -eq $id } | Select-Object -First 1
  if (-not $target) { return @{ ok = $false; reason = "Bloc introuvable : $id" } }
  $lines.RemoveRange($target.start, $target.end - $target.start + 1)
  $lines.InsertRange($target.start, [string[]]$block)
  Repair-BlockCommas $lines
  Write-ProjectFileLines $lines
  Update-Sitemap
  return @{ ok = $true; id = $id; moved = $moveResult.moved; stamp = (Get-FileStamp) }
}

# Ressource chiffree -> litteral JavaScript multiligne, dans la forme deja
# employee par protectedMedia.
function Format-ResourceLiteral($r) {
  $lines = @('{')
  $lines += "      id: " + (ConvertTo-JsString ([string]$r.id)) + ","
  $lines += "      version: " + ([string][int]$r.version) + ","
  # Un lien protege porte en plus son libelle et son hote autorise ; une fiche
  # protegee n'en a pas besoin.
  if ($r.PSObject.Properties['label'] -and $r.label) {
    $lines += "      label: " + (ConvertTo-JsString ([string]$r.label)) + ","
  }
  if ($r.PSObject.Properties['provider'] -and $r.provider) {
    $lines += "      provider: " + (ConvertTo-JsString ([string]$r.provider)) + ","
  }
  $lines += "      iterations: " + ([string][int]$r.iterations) + ","
  $lines += "      salt: " + (ConvertTo-JsString ([string]$r.salt)) + ","
  $lines += "      iv: " + (ConvertTo-JsString ([string]$r.iv)) + ","
  $lines += "      ciphertext: " + (ConvertTo-JsString ([string]$r.ciphertext))
  if ($r.PSObject.Properties['allowedHosts'] -and @($r.allowedHosts).Count -gt 0) {
    $hosts = @($r.allowedHosts | ForEach-Object { ConvertTo-JsString ([string]$_) })
    $lines[$lines.Count - 1] = $lines[$lines.Count - 1] + ","
    $lines += "      allowedHosts: [" + ($hosts -join ', ') + "]"
  }
  $lines += "    }"
  return ($lines -join "`n")
}

# Remplace le bloc d'un projet en conservant ses champs connus, et en imposant
# la liste des champs conserves. Sert aux operations qui ne touchent qu'a un
# champ hors formulaire, comme le lien protege.
function Update-ProjectPreserved([string]$id, $preserved) {
  $existing = Get-ProjectRecords | Where-Object { $_.id -eq $id } | Select-Object -First 1
  if (-not $existing) { return @{ ok = $false; reason = "Projet introuvable : $id" } }
  if ($existing.fields.Contains('protected')) {
    return @{ ok = $false; reason = "Cette fiche est protegee dans son ensemble : le lien protege ne s'applique qu'a une fiche publique." }
  }

  $values = [ordered]@{}
  foreach ($k in $existing.fields.Keys) {
    if ($ProjectFieldOrder -contains $k) { $values[$k] = $existing.fields[$k] }
  }
  $block = Format-ProjectBlock $id $values $preserved @($existing.fields.Keys)
  $lines = Read-ProjectFileLines
  $blocks = @(Get-ProjectBlocks $lines.ToArray())
  $target = $blocks | Where-Object { $_.id -eq $id } | Select-Object -First 1
  if (-not $target) { return @{ ok = $false; reason = "Bloc introuvable : $id" } }
  $lines.RemoveRange($target.start, $target.end - $target.start + 1)
  $lines.InsertRange($target.start, [string[]]$block)
  Repair-BlockCommas $lines
  Write-ProjectFileLines $lines
  return @{ ok = $true; id = $id; stamp = (Get-FileStamp) }
}

# Lien protege : la fiche reste publique, seule une adresse est chiffree.
# C'est le mecanisme deja employe pour le film de Traveler's Introspection.
function Set-ProjectLink($payload) {
  $id = [string]$payload.id
  if (-not (Test-ProjectId $id)) { return @{ ok = $false; reason = "Identifiant invalide." } }
  $problem = Test-ProtectedResource $payload.resource
  if ($problem) { return @{ ok = $false; reason = "Ressource protegee invalide : $problem" } }

  $existing = Get-ProjectRecords | Where-Object { $_.id -eq $id } | Select-Object -First 1
  if (-not $existing) { return @{ ok = $false; reason = "Projet introuvable : $id" } }
  $preserved = [ordered]@{}
  foreach ($k in $existing.fields.Keys) {
    if ($ProjectFieldOrder -notcontains $k -and $k -ne 'protectedMedia') { $preserved[$k] = $existing.fields[$k] }
  }
  $preserved['protectedMedia'] = [pscustomobject]@{ __raw = (Format-ResourceLiteral $payload.resource) }
  return Update-ProjectPreserved $id $preserved
}

function Remove-ProjectLink([string]$id) {
  if (-not (Test-ProjectId $id)) { return @{ ok = $false; reason = "Identifiant invalide." } }
  $existing = Get-ProjectRecords | Where-Object { $_.id -eq $id } | Select-Object -First 1
  if (-not $existing) { return @{ ok = $false; reason = "Projet introuvable : $id" } }
  if (-not $existing.fields.Contains('protectedMedia')) { return @{ ok = $false; reason = "Ce projet n'a pas de lien protege." } }
  $preserved = [ordered]@{}
  foreach ($k in $existing.fields.Keys) {
    if ($ProjectFieldOrder -notcontains $k -and $k -ne 'protectedMedia') { $preserved[$k] = $existing.fields[$k] }
  }
  return Update-ProjectPreserved $id $preserved
}

# Leve la protection : l'editeur a dechiffre la fiche et renvoie son contenu.
function Unprotect-ProjectRecord($payload) {
  $id = [string]$payload.id
  if (-not (Test-ProjectId $id)) { return @{ ok = $false; reason = "Identifiant invalide." } }
  $existing = Get-ProjectRecords | Where-Object { $_.id -eq $id } | Select-Object -First 1
  if (-not $existing) { return @{ ok = $false; reason = "Projet introuvable : $id" } }
  if (-not $existing.fields.Contains('protected')) { return @{ ok = $false; reason = "Ce projet n'est pas protege." } }

  $moveResult = Move-ProjectMedia $payload.moves $id 'restore'
  if (-not $moveResult.ok) { return $moveResult }

  # Le bloc est reconstruit a partir de la fiche dechiffree, sans conserver
  # l'ancien contenu chiffre : le laisser reviendrait a publier deux versions.
  $lines = Read-ProjectFileLines
  $blocks = @(Get-ProjectBlocks $lines.ToArray())
  $target = $blocks | Where-Object { $_.id -eq $id } | Select-Object -First 1
  $values = [ordered]@{}
  foreach ($def in $ProjectFields) {
    $prop = $payload.values.PSObject.Properties[$def.key]
    if (-not $prop -or $null -eq $prop.Value) { continue }
    if ($def.kind -eq 'list' -or $def.kind -eq 'medias' -or $def.kind -eq 'projects') { $values[$def.key] = @($prop.Value) }
    elseif ($def.kind -eq 'bool') { $values[$def.key] = [bool]$prop.Value }
    elseif ($def.kind -eq 'number') { $values[$def.key] = [int]$prop.Value }
    else { $values[$def.key] = [string]$prop.Value }
  }
  $values.Remove('listing') | Out-Null
  $values.Remove('lockedTitle') | Out-Null

  $block = Format-ProjectBlock $id $values $null @()
  $lines.RemoveRange($target.start, $target.end - $target.start + 1)
  $lines.InsertRange($target.start, [string[]]$block)
  Repair-BlockCommas $lines
  Write-ProjectFileLines $lines
  Update-Sitemap
  return @{ ok = $true; id = $id; moved = $moveResult.moved; stamp = (Get-FileStamp) }
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
  @{ key='title'; translate=$true; group='Identite'; label="Titre d'onglet"; kind='text'
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

if ($NoServe) { return }

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
          items = @(Get-Strings); stamp = (Get-FileStamp)
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

      if ($rel -eq "/__fr" -and $req.HttpMethod -eq "GET") {
        $lastPing = Get-Date; $everPinged = $true
        $d = Read-FrDictionary
        $p = ConvertTo-FrPayload $d
        $p.stamp = (Get-FileStamp)
        Send-Json $res $p
        $res.Close(); continue
      }

      if ($rel -eq "/__fr" -and $req.HttpMethod -eq "POST") {
        $lastPing = Get-Date; $everPinged = $true
        $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
        $body = $reader.ReadToEnd(); $reader.Close()
        try {
          $data = ConvertFrom-FrPayload (($body | ConvertFrom-Json))
          Write-FrDictionary $data (Get-FrSectionMap)
          Send-Json $res @{ ok = $true; entries = $data.ui.Count; stamp = (Get-FileStamp) }
        } catch {
          Send-Json $res @{ ok = $false; error = $_.Exception.Message }
        }
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

      # ---------------------------------------------------------- projets
      if ($rel -eq "/__projects" -and $req.HttpMethod -eq "GET") {
        $lastPing = Get-Date; $everPinged = $true
        Send-Json $res @{ items = @(Get-ProjectSummaries); fields = @($ProjectFields); stamp = (Get-FileStamp) }
        $res.Close(); continue
      }

      if ($rel -eq "/__project" -and $req.HttpMethod -eq "GET") {
        $lastPing = Get-Date; $everPinged = $true
        $detail = Get-ProjectDetail ([string]$req.QueryString["id"])
        if (-not $detail) { Send-Json $res @{ ok = $false; reason = "Projet introuvable." } }
        else { Send-Json $res @{ ok = $true; id = $detail.id; values = $detail.values; extraKeys = @($detail.extraKeys); protectedResource = $detail.protectedResource } }
        $res.Close(); continue
      }

      if ($rel -eq "/__project" -and $req.HttpMethod -eq "POST") {
        $lastPing = Get-Date; $everPinged = $true
        $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
        $body = $reader.ReadToEnd(); $reader.Close()
        Send-Json $res (Save-Project ($body | ConvertFrom-Json))
        $res.Close(); continue
      }

      if ($rel -eq "/__project-delete" -and $req.HttpMethod -eq "POST") {
        $lastPing = Get-Date; $everPinged = $true
        $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
        $body = $reader.ReadToEnd(); $reader.Close()
        Send-Json $res (Remove-Project ([string]($body | ConvertFrom-Json).id))
        $res.Close(); continue
      }

      if ($rel -eq "/__project-protect" -and $req.HttpMethod -eq "POST") {
        $lastPing = Get-Date; $everPinged = $true
        $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
        $body = $reader.ReadToEnd(); $reader.Close()
        Send-Json $res (Protect-ProjectRecord ($body | ConvertFrom-Json))
        $res.Close(); continue
      }

      if ($rel -eq "/__project-link" -and $req.HttpMethod -eq "POST") {
        $lastPing = Get-Date; $everPinged = $true
        $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
        $body = $reader.ReadToEnd(); $reader.Close()
        $data = $body | ConvertFrom-Json
        if ($data.remove) { Send-Json $res (Remove-ProjectLink ([string]$data.id)) }
        else { Send-Json $res (Set-ProjectLink $data) }
        $res.Close(); continue
      }

      if ($rel -eq "/__project-unprotect" -and $req.HttpMethod -eq "POST") {
        $lastPing = Get-Date; $everPinged = $true
        $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
        $body = $reader.ReadToEnd(); $reader.Close()
        Send-Json $res (Unprotect-ProjectRecord ($body | ConvertFrom-Json))
        $res.Close(); continue
      }

      # Televersement : le fichier arrive brut, son nom et son projet en
      # en-tete. Pas de multipart a analyser, donc rien a mal interpreter.
      if ($rel -eq "/__upload" -and $req.HttpMethod -eq "POST") {
        $lastPing = Get-Date; $everPinged = $true
        $projectId = [string]$req.Headers["X-Project-Id"]
        $fileName = [string]$req.Headers["X-File-Name"]
        if ($req.ContentLength64 -gt 64MB) {
          Send-Json $res @{ ok = $false; reason = "Fichier trop volumineux (limite 64 Mo)." }
          $res.Close(); continue
        }
        $ms = New-Object System.IO.MemoryStream
        $req.InputStream.CopyTo($ms)
        Send-Json $res (Save-UploadedMedia $projectId $fileName $ms.ToArray())
        $ms.Dispose()
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

        # La branche de publication ne s'ecrit jamais depuis l'editeur : le
        # depot l'interdit, et un contenu en cours de redaction n'a rien a
        # faire en ligne. On bascule sur la branche de contenu, en la creant
        # au besoin.
        $switch = Set-ContentBranch
        if (-not $switch.ok) {
          Send-Json $res @{ ok = $false; reason = $switch.reason }
          $res.Close(); continue
        }

        $st = Invoke-Git (@("status", "--porcelain", "--") + $CommitPaths)
        if ([string]::IsNullOrWhiteSpace($st.stdout)) {
          Send-Json $res @{ ok = $false; reason = "Aucune modification a commiter." }
          $res.Close(); continue
        }

        # message passe par un fichier : aucun probleme de guillemets ou d'accents
        $msgFile = [System.IO.Path]::GetTempFileName()
        try {
          [System.IO.File]::WriteAllText($msgFile, $msg, [System.Text.UTF8Encoding]::new($false))
          # Les medias ajoutes ne sont pas encore suivis : sans cet ajout
          # explicite, un projet serait commite sans ses images.
          $null = Invoke-Git (@("add", "--") + $CommitPaths)
          $r = Invoke-Git (@("commit", "-F", $msgFile, "--") + $CommitPaths)
          if ($r.code -eq 0) {
            $h = (Invoke-Git @("rev-parse", "--short", "HEAD")).stdout.Trim()
            $branch = Get-Branch
            Write-Host "  Commit $h sur $branch"
            $push = Invoke-Git @("push", "--set-upstream", "origin", $branch)
            $pushed = ($push.code -eq 0)
            $pushWhy = $null
            if (-not $pushed) {
              $pushWhy = $(if ([string]::IsNullOrWhiteSpace($push.stderr)) { $push.stdout } else { $push.stderr }).Trim()
              Write-Host "  Push refuse : $pushWhy"
            } else {
              Write-Host "  Pousse sur origin/$branch"
            }
            Send-Json $res @{ ok = $true; hash = $h; branch = $branch; pushed = $pushed; pushReason = $pushWhy; switched = $switch.switched }
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
        # Les routes de l'editeur attendent toujours du JSON. Une erreur
        # renvoyee en texte brut se lisait cote editeur comme un JSON invalide,
        # et masquait la vraie cause derriere un message de syntaxe.
        $isEditorRoute = $false
        try { $isEditorRoute = ($req.Url.AbsolutePath -like "/__*") } catch {}
        if ($isEditorRoute) {
          $res.StatusCode = 200
          $payload = @{ ok = $false; reason = "Erreur du serveur : $($_.Exception.Message)" } | ConvertTo-Json -Compress
          $m = [System.Text.Encoding]::UTF8.GetBytes($payload)
          $res.ContentType = "application/json; charset=utf-8"
        } else {
          $res.StatusCode = 500
          $m = [System.Text.Encoding]::UTF8.GetBytes("500: $($_.Exception.Message)")
        }
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
