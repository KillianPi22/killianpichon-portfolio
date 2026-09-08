# Integration test: no browser, password or editorial write.
$ErrorActionPreference = 'Stop'
$serverScript = Join-Path $PSScriptRoot 'serve.ps1'
$testLog = Join-Path ([IO.Path]::GetTempPath()) ('portfolio-port-' + [guid]::NewGuid() + '.log')
$testErrorLog = $testLog + '.err'
$blocker = $null
$serverProcess = $null
try {
  # Reserve 8000 when free; if already occupied, leave its owner running.
  try {
    $blocker = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Any, 8000)
    $blocker.Start()
  } catch {
    if ($blocker) { $blocker.Stop(); $blocker = $null }
  }
  $serverProcess = Start-Process powershell -ArgumentList @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $serverScript + '"'), '-NoBrowser'
  ) -WindowStyle Hidden -PassThru -RedirectStandardOutput $testLog -RedirectStandardError $testErrorLog
  $testPort = $null
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    Start-Sleep -Milliseconds 500
    $output = Get-Content -LiteralPath $testLog -Raw -ErrorAction SilentlyContinue
    if ($output -match 'Editeur : http://localhost:(\d+)/__editor') { $testPort = [int]$Matches[1]; break }
    if ($serverProcess.HasExited) { throw 'Test server exited before listening.' }
  }
  if (-not $testPort -or $testPort -le 8000 -or $testPort -gt 8020) { throw 'Automatic port selection failed.' }
  $base = "http://localhost:$testPort"
  $editor = Invoke-WebRequest "$base/__editor" -UseBasicParsing
  if ($editor.StatusCode -ne 200 -or $editor.Content -notmatch 'id="pick"') { throw 'Editor unavailable.' }
  foreach ($entry in @(
    @{ path='/__strings'; status=401 },
    @{ path='/tools/auth.json'; status=404 },
    @{ path='/tools/.backups/'; status=404 },
    @{ path='/.git/config'; status=404 },
    @{ path='/.claude/'; status=404 }
  )) {
    $status = 0
    try { $status = (Invoke-WebRequest ($base + $entry.path) -UseBasicParsing).StatusCode }
    catch { if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode } else { throw } }
    if ($status -ne $entry.status) { throw "Unexpected status for $($entry.path): $status" }
  }
  # Explicit ports must fail, not silently move elsewhere or wait for input.
  $strict = Start-Process powershell -ArgumentList @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $serverScript + '"'), '-NoBrowser', '-Port', $testPort
  ) -WindowStyle Hidden -PassThru
  try {
    if (-not $strict.WaitForExit(15000)) { throw 'Explicit occupied port did not fail promptly.' }
    if ($strict.ExitCode -eq 0) { throw 'Explicit occupied port unexpectedly succeeded.' }
  } finally { if (-not $strict.HasExited) { Stop-Process -Id $strict.Id } }
  Write-Output "PASS: automatic fallback to $testPort, editor HTTP 200, access controls, explicit occupied port rejected."
} finally {
  if ($serverProcess -and -not $serverProcess.HasExited) { Stop-Process -Id $serverProcess.Id }
  if ($blocker) { $blocker.Stop() }
  Remove-Item -LiteralPath $testLog, $testErrorLog -ErrorAction SilentlyContinue
}
