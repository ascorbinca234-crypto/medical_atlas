# Медицинский атлас — развёртывание сервера входа в Яндекс Облаке.
# Запуск в PowerShell (после шага 2 инструкции, когда yc init уже выполнен):
#   powershell -ExecutionPolicy Bypass -File "$HOME\Documents\medical_atlas_deploy\deploy.ps1"
# Скрипт можно запускать повторно: он находит уже созданное и обновляет код и настройки.
# Ключи и пароли сохраняются только на этом компьютере: %LOCALAPPDATA%\medical-atlas\deploy-state.json

$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Here      = Split-Path -Parent $MyInvocation.MyCommand.Path
$Zip       = Join-Path $Here 'function.zip'
$SiteUrl   = 'https://ascorbinca234-crypto.github.io/medical_atlas'
$Name      = 'atlas-api'
$DbName    = 'atlas-db'
$StateDir  = Join-Path $env:LOCALAPPDATA 'medical-atlas'
$StateFile = Join-Path $StateDir 'deploy-state.json'

function Step([string]$t) { Write-Host ''; Write-Host "== $t" -ForegroundColor Cyan }
function Fail([string]$t) {
  Write-Host ''
  Write-Host "Ошибка: $t" -ForegroundColor Red
  Write-Host 'Пришли скриншот этого окна в чат.' -ForegroundColor Red
  exit 1
}

# Вызов программы yc с ответом в JSON (функция названа YcJson, чтобы не путаться с самой yc).
# -AllowFail: если объекта нет (NotFound) — вернуть $null. Сетевые сбои повторяются до трёх раз.
function YcJson {
  param([string[]]$A, [switch]$AllowFail)
  for ($try = 1; $try -le 3; $try++) {
    $errFile = [System.IO.Path]::GetTempFileName()
    $out = & yc @A --format json 2> $errFile
    $code = $LASTEXITCODE
    $err = ''
    if (Test-Path $errFile) { $err = "$(Get-Content $errFile -Raw)"; Remove-Item $errFile -ErrorAction SilentlyContinue }
    if ($code -eq 0) {
      $text = ($out | Out-String).Trim()
      if (-not $text) { return $null }
      return ($text | ConvertFrom-Json)
    }
    if ($err -match 'DeadlineExceeded|Unavailable|connection|timeout|TLS|EOF') {
      if ($try -lt 3) { Write-Host "Нет связи с Яндекс Облаком, повторяю ($try из 3)..." -ForegroundColor Yellow; Start-Sleep -Seconds 5; continue }
      Fail ("нет связи с API Яндекс Облака. Выключи VPN или прокси, проверь интернет и запусти скрипт снова.`n" + $err)
    }
    if ($AllowFail -and $err -match 'NotFound|not found|не найден') { return $null }
    Fail ("yc " + ($A -join ' ') + "`n" + $err)
  }
}

# ---------- сохранённые значения ----------
$State = @{}
if (Test-Path $StateFile) {
  try { (Get-Content $StateFile -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $State[$_.Name] = $_.Value } } catch { }
}
function Save-State {
  New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
  ($State | ConvertTo-Json) | Set-Content -Path $StateFile -Encoding UTF8
}
function Ask([string]$Label, [string]$Key, [switch]$Secret, [switch]$Optional) {
  $has = $State.ContainsKey($Key) -and $State[$Key]
  $hint = ''
  if ($has -and $Secret) { $hint = ' [сохранено, Enter — оставить]' }
  elseif ($has) { $hint = " [$($State[$Key]), Enter — оставить]" }
  elseif ($Optional) { $hint = ' [Enter — пропустить]' }
  while ($true) {
    if ($Secret) {
      $ss = Read-Host -AsSecureString ($Label + $hint)
      $v = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($ss))
    } else {
      $v = Read-Host ($Label + $hint)
    }
    $v = "$v".Trim()
    if (-not $v -and ($has -or $Optional)) { return }
    if ($v) { $State[$Key] = $v; Save-State; return }
    Write-Host 'Это значение обязательно.' -ForegroundColor Yellow
  }
}

# ---------- 1. проверки ----------
Step 'Проверяю программу yc и файлы'
if (-not (Get-Command yc -ErrorAction SilentlyContinue)) { Fail 'Программа yc не найдена. Сделай шаг 2 инструкции и открой PowerShell заново.' }
if (-not (Test-Path $Zip)) { Fail "Нет файла $Zip — он должен лежать рядом со скриптом." }
$Folder = (& yc config get folder-id 2>$null | Out-String).Trim()
if (-not $Folder) { Fail 'Не выбран каталог облака. Выполни команду: yc init' }
Write-Host "Каталог: $Folder"
$null = YcJson @('resource-manager', 'folder', 'get', '--id', $Folder)
Write-Host 'Связь с Яндекс Облаком есть.'

# ---------- 2. сервисный аккаунт и роли ----------
Step 'Сервисный аккаунт'
$sa = YcJson @('iam', 'service-account', 'get', '--name', $Name) -AllowFail
if (-not $sa) { $sa = YcJson @('iam', 'service-account', 'create', '--name', $Name) }
Write-Host "Аккаунт: $($sa.id)"
foreach ($role in @('ydb.editor', 'functions.functionInvoker')) {
  $null = YcJson @('resource-manager', 'folder', 'add-access-binding', '--id', $Folder, '--role', $role, '--subject', "serviceAccount:$($sa.id)") -AllowFail
}

# ---------- 3. база ----------
Step 'База данных YDB (Serverless)'
$db = YcJson @('ydb', 'database', 'get', '--name', $DbName) -AllowFail
if (-not $db) {
  Write-Host 'Создаю базу, это занимает 1–3 минуты...'
  $db = YcJson @('ydb', 'database', 'create', '--name', $DbName, '--serverless', '--sls-storage-size', '1GB')
}
for ($i = 0; $i -lt 60 -and $db.status -ne 'RUNNING'; $i++) { Start-Sleep -Seconds 5; $db = YcJson @('ydb', 'database', 'get', '--name', $DbName) }
if ($db.status -ne 'RUNNING') { Fail "База не запустилась, статус: $($db.status)" }
$DocApi = $db.document_api_endpoint
if (-not $DocApi) { $p = $db.PSObject.Properties | Where-Object { $_.Name -match 'document' -and "$($_.Value)" -match '^https' } | Select-Object -First 1; if ($p) { $DocApi = $p.Value } }
if (-not $DocApi) { Fail 'У базы не нашёлся адрес Document API.' }
Write-Host "База: $DocApi"

# ---------- 4. ключи ----------
Step 'Ключ доступа к базе'
if (-not $State.ydbKeyId -or $State.saId -ne $sa.id) {
  $k = YcJson @('iam', 'access-key', 'create', '--service-account-id', $sa.id)
  $State.ydbKeyId = $k.access_key.key_id
  $State.ydbSecret = $k.secret
  $State.saId = $sa.id
  Save-State
  Write-Host 'Создан ключ. Он сохранён только на этом компьютере.'
} else { Write-Host 'Ключ уже есть.' }
if (-not $State.secret) {
  $bytes = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $State.secret = -join ($bytes | ForEach-Object { $_.ToString('x2') })
  Save-State
}

# ---------- 5. функция и API-шлюз ----------
Step 'Функция'
$fn = YcJson @('serverless', 'function', 'get', '--name', $Name) -AllowFail
if (-not $fn) { $fn = YcJson @('serverless', 'function', 'create', '--name', $Name) }
Write-Host "Функция: $($fn.id)"

Step 'API-шлюз'
$spec = @"
openapi: 3.0.0
info:
  title: medical-atlas-api
  version: 1.0.0
paths:
  /{path+}:
    x-yc-apigateway-any-method:
      parameters:
        - name: path
          in: path
          required: true
          schema:
            type: string
      x-yc-apigateway-integration:
        type: cloud_functions
        function_id: $($fn.id)
        tag: "`$latest"
        service_account_id: $($sa.id)
"@
$specFile = Join-Path $env:TEMP 'atlas-gateway.yaml'
[System.IO.File]::WriteAllText($specFile, $spec)
$gw = YcJson @('serverless', 'api-gateway', 'get', '--name', $Name) -AllowFail
if ($gw) { $null = YcJson @('serverless', 'api-gateway', 'update', '--name', $Name, '--spec', $specFile) }
else { $null = YcJson @('serverless', 'api-gateway', 'create', '--name', $Name, '--spec', $specFile) }
$gw = YcJson @('serverless', 'api-gateway', 'get', '--name', $Name)
if (-not $gw.domain) { Fail 'У API-шлюза нет адреса.' }
$ApiUrl = 'https://' + $gw.domain
Write-Host "Адрес сервера: $ApiUrl" -ForegroundColor Green

# ---------- 6. почта и входы ----------
Step 'Почта и способы входа'
Write-Host 'Вставляй значения правой кнопкой мыши. Секреты при вводе не отображаются — так и должно быть.'
Ask 'Адрес ящика для писем (шаг 3)' 'mailUser'
Ask 'Пароль приложения почты (шаг 3)' 'mailPass' -Secret
Ask 'ClientID Яндекс ID (шаг 4)' 'yandexId' -Optional
if ($State.yandexId) { Ask 'Client secret Яндекс ID (шаг 4)' 'yandexSecret' -Secret }
Ask 'ID приложения VK ID (шаг 5)' 'vkId' -Optional

# ---------- 7. версия функции ----------
Step 'Выкладываю код сервера'
$vars = [ordered]@{
  SITE_URL = $SiteUrl; API_URL = $ApiUrl; SECRET = $State.secret; STORE = 'ydb'
  YDB_DOCAPI_ENDPOINT = $DocApi; YDB_ACCESS_KEY_ID = $State.ydbKeyId; YDB_SECRET_ACCESS_KEY = $State.ydbSecret
  SMTP_USER = $State.mailUser; SMTP_PASS = $State.mailPass
}
if ($State.yandexId -and $State.yandexSecret) { $vars.YANDEX_CLIENT_ID = $State.yandexId; $vars.YANDEX_CLIENT_SECRET = $State.yandexSecret }
if ($State.vkId) { $vars.VK_CLIENT_ID = $State.vkId }
foreach ($e in $vars.GetEnumerator()) { if ("$($e.Value)" -match ',') { Fail "Значение $($e.Key) содержит запятую — проверь, что вставил." } }
$envArg = ($vars.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ','
$null = YcJson @('serverless', 'function', 'version', 'create', '--function-id', $fn.id, '--runtime', 'nodejs22', '--entrypoint', 'index.handler',
  '--memory', '256MB', '--execution-timeout', '10s', '--source-path', $Zip, '--service-account-id', $sa.id, '--environment', $envArg)
Write-Host 'Код выложен.'

# ---------- 8. проверка ----------
Step 'Проверяю сервер'
$h = $null
for ($i = 0; $i -lt 6 -and -not $h; $i++) {
  Start-Sleep -Seconds 5
  try { $h = Invoke-RestMethod -Uri "$ApiUrl/health" -TimeoutSec 60 } catch { Write-Host "Пока не отвечает: $($_.Exception.Message)" }
}

$result = [ordered]@{
  api_url = $ApiUrl
  yandex_redirect_uri = "$ApiUrl/auth/yandex/callback"
  vk_base_domain = $gw.domain
  vk_redirect_url = "$ApiUrl/auth/vk/callback"
  health = $h
  deployed_at = (Get-Date).ToString('s')
}
($result | ConvertTo-Json -Depth 5) | Set-Content -Path (Join-Path $Here 'result.json') -Encoding UTF8

Write-Host ''
if ($h -and $h.ok) { Write-Host 'Готово. Сервер работает.' -ForegroundColor Green }
elseif ($h) { Write-Host ('Сервер отвечает, но не всё настроено: ' + ($h.missing -join ', ') + ' ' + $h.tables) -ForegroundColor Yellow }
else { Write-Host 'Сервер пока не ответил. Напиши в чат — я посмотрю.' -ForegroundColor Yellow }
Write-Host "Адрес сервера (API_URL): $ApiUrl"
Write-Host "Redirect URI для Яндекс ID: $ApiUrl/auth/yandex/callback"
Write-Host "Базовый домен для VK ID: $($gw.domain)"
Write-Host "Redirect URL для VK ID: $ApiUrl/auth/vk/callback"
Write-Host 'Напиши в чат «готово» — остальное я увижу сам.'
