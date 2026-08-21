param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-z0-9][a-z0-9-]*$')]
    [string]$ResourceId,

    [Parameter(Mandatory = $true)]
    [string]$Target,

    [ValidateRange(100000, 5000000)]
    [int]$Iterations = 600000
)

$ErrorActionPreference = 'Stop'
$allowedHosts = @()
$absoluteTarget = $null
if ([Uri]::TryCreate($Target, [UriKind]::Absolute, [ref]$absoluteTarget)) {
    if ($absoluteTarget.Scheme -ne 'https') {
        throw 'External targets must use HTTPS.'
    }
    $allowedHosts = @($absoluteTarget.DnsSafeHost.ToLowerInvariant())
} elseif (-not ($Target.StartsWith('/') -or $Target.StartsWith('./') -or $Target.StartsWith('../'))) {
    throw 'Use an HTTPS URL or a same-site relative path.'
}

$secureCode = Read-Host 'Access code' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureCode)
$aes = $null
$kdf = $null
try {
    $accessCode = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Normalize([Text.NormalizationForm]::FormC)
    if ([string]::IsNullOrWhiteSpace($accessCode)) {
        throw 'The access code cannot be empty.'
    }

    $salt = [byte[]]::new(16)
    $iv = [byte[]]::new(12)
    [Security.Cryptography.RandomNumberGenerator]::Fill($salt)
    [Security.Cryptography.RandomNumberGenerator]::Fill($iv)

    $passwordBytes = [Text.Encoding]::UTF8.GetBytes($accessCode)
    $kdf = [Security.Cryptography.Rfc2898DeriveBytes]::new(
        $passwordBytes,
        $salt,
        $Iterations,
        [Security.Cryptography.HashAlgorithmName]::SHA256
    )
    $key = $kdf.GetBytes(32)
    $payload = @{ url = $Target } | ConvertTo-Json -Compress
    $plaintext = [Text.Encoding]::UTF8.GetBytes($payload)
    $ciphertext = [byte[]]::new($plaintext.Length)
    $tag = [byte[]]::new(16)
    $aad = [Text.Encoding]::UTF8.GetBytes("kp-protected-content:${ResourceId}:v1")
    $aes = [Security.Cryptography.AesGcm]::new($key, 16)
    $aes.Encrypt($iv, $plaintext, $ciphertext, $tag, $aad)
    $ciphertextAndTag = [byte[]]::new($ciphertext.Length + $tag.Length)
    [Array]::Copy($ciphertext, 0, $ciphertextAndTag, 0, $ciphertext.Length)
    [Array]::Copy($tag, 0, $ciphertextAndTag, $ciphertext.Length, $tag.Length)

    [pscustomobject]@{
        id = $ResourceId
        version = 1
        iterations = $Iterations
        salt = [Convert]::ToBase64String($salt)
        iv = [Convert]::ToBase64String($iv)
        ciphertext = [Convert]::ToBase64String($ciphertextAndTag)
        allowedHosts = $allowedHosts
    } | ConvertTo-Json -Depth 3
} finally {
    if ($aes) { $aes.Dispose() }
    if ($kdf) { $kdf.Dispose() }
    if ($key) { [Array]::Clear($key, 0, $key.Length) }
    if ($passwordBytes) { [Array]::Clear($passwordBytes, 0, $passwordBytes.Length) }
    if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    $accessCode = $null
}
