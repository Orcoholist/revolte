# Telegram Mini App Setup Script
# Автоматическая проверка и подготовка к деплою

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Telegram Mini App Setup" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# 1. Проверка Node.js
Write-Host "[1/6] Проверка Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "  [OK] Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Node.js не найден!" -ForegroundColor Red
    exit 1
}

# 2. Проверка зависимостей
Write-Host "`n[2/6] Проверка зависимостей..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "  [OK] node_modules существует" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Установите зависимости..." -ForegroundColor Yellow
    npm install
}

# 3. Сборка проекта
Write-Host "`n[3/6] Сборка проекта..." -ForegroundColor Yellow
npm run build

if (Test-Path "dist") {
    Write-Host "  [OK] Сборка успешна (dist/)" -ForegroundColor Green
    
    # Подсчитать размер
    $size = (Get-ChildItem -Path "dist" -Recurse | Measure-Object -Property Length -Sum).Sum / 1KB
    Write-Host "  Размер: $('{0:N1}' -f $size) KB" -ForegroundColor Gray
} else {
    Write-Host "  [ERROR] Сборка не удалась!" -ForegroundColor Red
    exit 1
}

# 4. Проверка Telegram WebApp SDK
Write-Host "`n[4/6] Проверка Telegram WebApp SDK..." -ForegroundColor Yellow
$indexHtml = Get-Content "index.html" -Raw
if ($indexHtml -match "telegram-web-app") {
    Write-Host "  [OK] Telegram WebApp SDK подключён" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Telegram WebApp SDK не найден!" -ForegroundColor Yellow
    Write-Host "    Добавьте: <script src='https://telegram.org/js/telegram-web-app.js'></script>" -ForegroundColor Gray
}

# 5. Проверка инициализации
Write-Host "`n[5/6] Проверка инициализации..." -ForegroundColor Yellow
$telegramJs = Get-Content "src/ui/telegram.js" -Raw
if ($telegramJs -match "initTelegram") {
    Write-Host "  [OK] initTelegram() найдена" -ForegroundColor Green
} else {
    Write-Host "  [WARN] initTelegram() не найдена!" -ForegroundColor Yellow
}

# 6. Инструкция
Write-Host "`n[6/6] Следующие шаги:" -ForegroundColor Yellow
Write-Host @"

  1. Деплой на хостинг:
     npm run deploy:vercel

  2. Создать бота в Telegram:
     @BotFather -> /newbot

  3. Создать Mini App:
     @BotFather -> /newapp
     Вставьте URL из шага 1

  4. Тестирование:
     Откройте бота -> Нажмите "Play"

Детальная инструкция: TELEGRAM_DEPLOY.md
"@ -ForegroundColor White

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  ✅ Подготовка завершена!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan
