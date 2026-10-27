# Prepara Cine Andino para abrirlo desde el celular en la misma red Wi-Fi (HTTP y HTTPS con cámara).
#  1) Abre los puertos en el Firewall de Windows (5173 http, 5443 https, 3001-3003 APIs).
#  2) Detecta la IP del PC y la guarda en .env como EXTRA_IPS (la usa el certificado HTTPS).
#  3) Ofrece reiniciar los contenedores y muestra las URL para el celular.
# Uso: clic derecho > "Ejecutar con PowerShell" (pide permisos de administrador).
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  exit
}

$root  = Split-Path -Parent $PSScriptRoot
$ports = 5173, 5443, 3001, 3002, 3003
$rule  = "Cine Andino (red local)"

# 1) Firewall
Remove-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName $rule -Direction Inbound -Protocol TCP -LocalPort $ports -Action Allow -Profile Private,Domain | Out-Null
Write-Host "Puertos abiertos para redes privadas: $($ports -join ', ')" -ForegroundColor Green

$publica = Get-NetConnectionProfile | Where-Object { $_.NetworkCategory -eq 'Public' }
if ($publica) {
  Write-Host ""
  Write-Host "AVISO: tu red '$($publica.Name)' esta marcada como Publica y Windows bloqueara al celular." -ForegroundColor Yellow
  Write-Host "Cambiala a Privada con:  Set-NetConnectionProfile -Name '$($publica.Name)' -NetworkCategory Private" -ForegroundColor Yellow
}

# 2) IP(s) del PC -> .env (EXTRA_IPS)
$ips = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -match '^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)' -and $_.InterfaceAlias -notmatch 'vEthernet|WSL|Loopback|VirtualBox|VMware|Hyper-V' } |
  Select-Object -ExpandProperty IPAddress -Unique

$envFile = Join-Path $root ".env"
if (-not (Test-Path $envFile)) { Copy-Item (Join-Path $root ".env.example") $envFile }
if ($ips) {
  $lista = ($ips -join ",")
  $txt = Get-Content $envFile -Raw
  if ($txt -match '(?m)^EXTRA_IPS=.*$') { $txt = [regex]::Replace($txt, '(?m)^EXTRA_IPS=.*$', "EXTRA_IPS=$lista") }
  else { $txt = $txt.TrimEnd() + "`r`nEXTRA_IPS=$lista`r`n" }
  Set-Content -Path $envFile -Value $txt -Encoding UTF8
  Write-Host "EXTRA_IPS=$lista guardado en .env" -ForegroundColor Green
} else {
  Write-Host "No se detecto una IP de red local. Escribe tu IPv4 (ipconfig) en EXTRA_IPS dentro de .env." -ForegroundColor Yellow
}

# 3) Reiniciar contenedores
$r = Read-Host "Reiniciar ahora los contenedores para aplicar el certificado? (S/N)"
if ($r -match '^[sSyY]') {
  Push-Location $root
  docker compose up -d --build
  Pop-Location
}

Write-Host ""
Write-Host "Abre en el celular (misma red Wi-Fi):" -ForegroundColor Cyan
foreach ($ip in $ips) {
  Write-Host ("  https://{0}:5443   <- con camara para leer QR (acepta la advertencia del certificado)" -f $ip)
  Write-Host ("  http://{0}:5173    <- sin camara" -f $ip)
}
Write-Host ""
Read-Host "Presiona Enter para cerrar"
