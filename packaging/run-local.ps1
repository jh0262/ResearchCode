$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$appRoot = Join-Path $root 'app'
$port = 4173
$url = "http://127.0.0.1:$port/"

if (-not (Test-Path $appRoot)) {
  Write-Host "未找到 app 目录：$appRoot"
  Read-Host "按回车键退出"
  exit 1
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

function Resolve-RequestPath([string]$rawUrl) {
  $relative = [Uri]::UnescapeDataString(($rawUrl -split '\?')[0]).TrimStart('/')
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

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($url)
$listener.Start()

Write-Host ''
Write-Host '职业标准能力图谱生成器已启动'
Write-Host "访问地址: $url"
Write-Host '如果浏览器没有自动打开，请手动访问上面的地址'
Write-Host '关闭当前窗口或按 Ctrl+C 可停止服务'
Write-Host ''

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $response = $context.Response

    try {
      $filePath = Resolve-RequestPath $context.Request.RawUrl
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $response.ContentType = Get-ContentType $filePath
      $response.ContentLength64 = $bytes.LongLength
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
      $response.StatusCode = 500
      $message = [System.Text.Encoding]::UTF8.GetBytes("应用启动失败：$($_.Exception.Message)")
      $response.ContentType = 'text/plain; charset=utf-8'
      $response.ContentLength64 = $message.LongLength
      $response.OutputStream.Write($message, 0, $message.Length)
    } finally {
      $response.OutputStream.Close()
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
