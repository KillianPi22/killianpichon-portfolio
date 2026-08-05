<#
  Definit le mot de passe de l'editeur de contenu local.

  Ce script n'enregistre PAS le mot de passe. Il enregistre un sel aleatoire
  et une empreinte PBKDF2-SHA256 (310 000 iterations) dans tools\auth.json.
  L'empreinte ne permet pas de retrouver le mot de passe.

  auth.json est ignore par Git : le depot etant public, l'empreinte ne doit
  pas etre publiee, meme si elle est irreversible.
#>

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AuthFile  = Join-Path $ScriptDir "auth.json"
$Iterations = 310000
$MinLength = 8

function Read-Plain([string]$prompt) {
  $secure = Read-Host -Prompt $prompt -AsSecureString
  $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

Write-Host ""
Write-Host "  Mot de passe de l'editeur de contenu"
Write-Host "  ------------------------------------"
if (Test-Path $AuthFile) {
  Write-Host "  Un mot de passe est deja defini. Il va etre remplace."
  Write-Host ""
}
Write-Host "  La saisie reste invisible. Minimum $MinLength caracteres."
Write-Host ""

$pw1 = Read-Plain "  Nouveau mot de passe"
if ($pw1.Length -lt $MinLength) {
  Write-Host ""
  Write-Host "  Trop court : $MinLength caracteres minimum. Rien n'a ete modifie."
  Write-Host ""
  Read-Host "  Appuie sur Entree pour fermer" | Out-Null
  return
}

$pw2 = Read-Plain "  Confirme le mot de passe"
if ($pw1 -cne $pw2) {
  Write-Host ""
  Write-Host "  Les deux saisies different. Rien n'a ete modifie."
  Write-Host ""
  Read-Host "  Appuie sur Entree pour fermer" | Out-Null
  return
}

$salt = New-Object byte[] 16
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($salt)

$derive = New-Object System.Security.Cryptography.Rfc2898DeriveBytes(
            $pw1, $salt, $Iterations, [System.Security.Cryptography.HashAlgorithmName]::SHA256)
try { $hash = $derive.GetBytes(32) } finally { $derive.Dispose() }

@{
  v    = 1
  algo = "PBKDF2-SHA256"
  iter = $Iterations
  salt = [Convert]::ToBase64String($salt)
  hash = [Convert]::ToBase64String($hash)
} | ConvertTo-Json | Set-Content -Path $AuthFile -Encoding utf8

$pw1 = $null; $pw2 = $null
[GC]::Collect()

Write-Host ""
Write-Host "  Mot de passe enregistre dans tools\auth.json"
Write-Host "  Ce fichier reste sur cette machine : il n'est jamais publie."
Write-Host ""
Write-Host "  Tu peux maintenant lancer tools\edit-site.cmd"
Write-Host ""
Read-Host "  Appuie sur Entree pour fermer" | Out-Null
