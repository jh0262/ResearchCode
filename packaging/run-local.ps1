$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$appRoot = Join-Path $root 'app'
$distRoot = Join-Path (Split-Path -Parent $root) 'dist'
$port = 4173
$url = "http://127.0.0.1:$port/"

if (-not (Test-Path $appRoot -PathType Container)) {
  if (Test-Path $distRoot -PathType Container) {
    $appRoot = $distRoot
  } else {
    Write-Host "App folder not found: $appRoot"
    Read-Host "Press Enter to exit"
    exit 1
  }
}

$mimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.js' = 'application/javascript; charset=utf-8'
  '.mjs' = 'application/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.txt' = 'text/plain; charset=utf-8'
  '.xlsx' = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  '.png' = 'image/png'
  '.jpg' = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.svg' = 'image/svg+xml'
  '.pdf' = 'application/pdf'
  '.woff' = 'font/woff'
  '.woff2' = 'font/woff2'
}

function Get-ContentType([string]$path) {
  $ext = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
  if ($mimeTypes.ContainsKey($ext)) {
    return $mimeTypes[$ext]
  }

  return 'application/octet-stream'
}

function Resolve-RequestPath([string]$rawPath) {
  $relative = [Uri]::UnescapeDataString(($rawPath -split '\?')[0]).TrimStart('/')
  if ([string]::IsNullOrWhiteSpace($relative)) {
    return Join-Path $appRoot 'index.html'
  }

  $candidate = Join-Path $appRoot $relative.Replace('/', '\')
  if (Test-Path $candidate -PathType Leaf) {
    return $candidate
  }

  if (Test-Path $candidate -PathType Container) {
    $indexFile = Join-Path $candidate 'index.html'
    if (Test-Path $indexFile -PathType Leaf) {
      return $indexFile
    }
  }

  return Join-Path $appRoot 'index.html'
}

function Write-Response(
  [System.Net.Sockets.NetworkStream]$stream,
  [int]$statusCode,
  [string]$statusText,
  [string]$contentType,
  [byte[]]$body
) {
  $headerText = @(
    "HTTP/1.1 $statusCode $statusText",
    "Content-Type: $contentType",
    "Content-Length: $($body.Length)",
    'Connection: close',
    '',
    ''
  ) -join "`r`n"

  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headerText)
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($body.Length -gt 0) {
    $stream.Write($body, 0, $body.Length)
  }
}

try {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
  $listener.Start()
} catch {
  Write-Host "Startup failed: $($_.Exception.Message)"
  Read-Host "Press Enter to exit"
  exit 1
}

Write-Host ''
Write-Host 'Occupation graph app is running.'
Write-Host "Open: $url"
Write-Host 'If the browser does not open automatically, open the address above.'
Write-Host 'Close this window or press Ctrl+C to stop the server.'
Write-Host ''

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    $stream = $null
    $reader = $null

    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()
      while (($line = $reader.ReadLine()) -ne '') { }

      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        continue
      }

      $parts = $requestLine.Split(' ')
      if ($parts.Length -lt 2) {
        $body = [System.Text.Encoding]::UTF8.GetBytes('Bad Request')
        Write-Response $stream 400 'Bad Request' 'text/plain; charset=utf-8' $body
        continue
      }

      $method = $parts[0].ToUpperInvariant()
      if ($method -ne 'GET' -and $method -ne 'HEAD') {
        $body = [System.Text.Encoding]::UTF8.GetBytes('Method Not Allowed')
        Write-Response $stream 405 'Method Not Allowed' 'text/plain; charset=utf-8' $body
        continue
      }

      $filePath = Resolve-RequestPath $parts[1]
      $body = [System.IO.File]::ReadAllBytes($filePath)
      if ($method -eq 'HEAD') {
        $body = [byte[]]::new(0)
      }

      Write-Response $stream 200 'OK' (Get-ContentType $filePath) $body
    } catch {
      if ($stream) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Server error: $($_.Exception.Message)")
        Write-Response $stream 500 'Internal Server Error' 'text/plain; charset=utf-8' $body
      }
    } finally {
      if ($reader) { $reader.Dispose() }
      if ($stream) { $stream.Dispose() }
      $client.Dispose()
    }
  }
} finally {
  $listener.Stop()
}
