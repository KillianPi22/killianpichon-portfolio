param(
  [ValidateRange(1024, 65535)][int]$Port = 8000,
  [string]$UserSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
)
$ErrorActionPreference = 'Stop'
try {
  # Conserver le compte qui lance l'outil, meme si l'elevation utilise un autre.
  $sid = [Security.Principal.SecurityIdentifier]::new($UserSid)
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $admin = [Security.Principal.WindowsPrincipal]::new($identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $admin) {
    $arguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -Port {1} -UserSid "{2}"' -f $PSCommandPath, $Port, $sid.Value
    $child = Start-Process powershell.exe -ArgumentList $arguments -Verb RunAs -WindowStyle Hidden -Wait -PassThru
    if ($child.ExitCode -ne 0) { throw "Autorisation Windows non terminee (code $($child.ExitCode))." }
    Write-Host 'Acces iPhone active. Relance edit-site.cmd et ouvre son adresse iPhone sur le meme reseau.'
    exit 0
  }
  . (Join-Path $PSScriptRoot 'local-network.ps1')
  $network = Get-LocalNetwork
  if (-not $network) { throw 'Aucun reseau local physique actif. Connecte le PC au routeur puis relance cet outil.' }
  $url = "http://+:$Port/"
  $reservation = (& netsh http show urlacl "url=$url" 2>&1 | Out-String)
  # Ne pas remplacer une reservation appartenant a une autre application.
  if ($reservation -notmatch [regex]::Escape($sid.Value)) {
    & netsh http add urlacl "url=$url" "sddl=D:(A;;GX;;;$($sid.Value))" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Reservation du port $Port refusee. Une autre application peut deja le reserver." }
  }
  $name = "Portfolio editor $Port"
  # Le reseau peut etre classe Public par Windows. La regle reste bornee a
  # l'adresse du PC, a sa carte physique et au sous-reseau du routeur actuel.
  # Aucun changement du profil reseau ni des protections generales du pare-feu.
  $rule = Get-NetFirewallRule -Name $name -ErrorAction SilentlyContinue
  $settings = @{
    Enabled = 'True'; Direction = 'Inbound'; Action = 'Allow'; Profile = 'Any'
    Protocol = 'TCP'; LocalPort = $Port; LocalAddress = $network.Address
    RemoteAddress = $network.Subnet; InterfaceAlias = $network.InterfaceAlias
  }
  if ($rule) { Set-NetFirewallRule -Name $name @settings | Out-Null }
  else { New-NetFirewallRule -Name $name -DisplayName $name @settings | Out-Null }
  Write-Host "Acces iPhone active : http://$($network.Address):$Port/"
  Write-Host 'Les routes de l editeur restent interdites aux autres appareils.'
} catch {
  Write-Error $_ -ErrorAction Continue
  exit 1
}
