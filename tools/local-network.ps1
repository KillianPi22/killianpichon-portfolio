# Une adresse du reseau physique actif, jamais celle d'un VPN ou d'une carte
# deconnectee. Partage entre le serveur et l'autorisation Windows.
function Get-LocalNetwork {
  $interfaces = Get-NetIPInterface -AddressFamily IPv4 -ErrorAction Stop |
    Where-Object { $_.ConnectionState -eq 'Connected' } |
    Sort-Object InterfaceMetric
  foreach ($interface in $interfaces) {
    $adapter = Get-NetAdapter -InterfaceIndex $interface.InterfaceIndex -ErrorAction SilentlyContinue
    if (-not $adapter -or -not $adapter.HardwareInterface) { continue }
    $config = Get-NetIPConfiguration -InterfaceIndex $interface.InterfaceIndex -ErrorAction Stop
    if (-not $config.IPv4DefaultGateway) { continue }
    $address = $config.IPv4Address | Where-Object {
      $_.IPAddress -match '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)'
    } | Select-Object -First 1
    if (-not $address) { continue }
    $bytes = [System.Net.IPAddress]::Parse($address.IPAddress).GetAddressBytes()
    $prefix = [int]$address.PrefixLength
    for ($i = 0; $i -lt 4; $i++) {
      $bits = [Math]::Min(8, [Math]::Max(0, $prefix - 8 * $i))
      $bytes[$i] = $bytes[$i] -band (256 - [Math]::Pow(2, 8 - $bits))
    }
    return [pscustomobject]@{
      Address = $address.IPAddress
      Subnet = (($bytes -join '.') + '/' + $prefix)
      InterfaceAlias = $adapter.Name
    }
  }
  return $null
}
