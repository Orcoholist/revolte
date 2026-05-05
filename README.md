# 🏎️ Revolt Racing

3D гоночная игра для **Telegram Mini App** и **Android**, вдохновлённая классическими гонками.

## 🚀 Технологии

- **Three.js** — 3D графика
- **Cannon-es** — физический движок
- **Capacitor** — обёртка для Android
- **Vite** — сборка проекта
- **Native JavaScript** — максимальная производительность

## 📦 Установка

```bash
# Установка зависимостей
npm install

# Запуск в браузере (разработка)
npm run dev

# Сборка для продакшена
npm run build
```

## 📱 Telegram Mini App

1. Создайте бота через [@BotFather](https://t.me/BotFather)
2. Задеплойте `dist` на любой хостинг (Vercel, Netlify, GitHub Pages)
3. В BotFather настройте Web App:
   ```
   /newapp → выберите бота → укажите URL с dist
   ```

## 🤖 Android

```bash
# Установка Capacitor
npm install @capacitor/core @capacitor/cli -g

# Инициализация Android проекта
npx cap init

# Добавить Android платформу
npx cap add android

# Сборка после npm run build
npm run build
npx cap sync
npx cap open android
```

В Android Studio откроется проект, оттуда можно запустить на эмуляторе или собрать APK.

## 🎮 Управление

| Клавиша | Действие |
|---------|----------|
| W / ↑ | Газ |
| S / ↓ | Тормоз/Назад |
| A / ← | Поворот влево |
| D / → | Поворот вправо |
| Space | Тормоз |
| Shift | Нитро |

**Мобильные устройства:** экранные кнопки появляются автоматически.

## 🔗 Управление конфигурацией Koda

### Синхронизация глобального и локального конфига

```bash
# Скопировать глобальный конфиг в проект
Copy-Item "$env:USERPROFILE\.koda\config.yaml" .koda/config.yaml

# Скопировать скиллы в проект
Copy-Item -Path "$env:USERPROFILE\.koda\skills\*" -Destination .koda/skills/ -Recurse

# Проверить содержимое локального конфига
Get-Content .koda/config.yaml
```

### Переключение между конфигурациями

| Конфигурация | Когда использовать |
|--------------|-------------------|
| **Локальная** (`.koda/`) | Для этого проекта, версионируется в Git |
| **Глобальная** (`~/.koda/`) | Для всех проектов, личные настройки |

### Проверка текущей конфигурации

```bash
# Проверить, существует ли локальный конфиг
Test-Path .koda/config.yaml

# Проверить глобальный конфиг
Test-Path "$env:USERPROFILE\.koda\config.yaml"

# Запустить проверку конфигурации
.\scripts\check-koda-config.ps1

# Синхронизировать с глобальным конфигом
.\scripts\sync-koda-config.ps1
```

## 📁 Структура проекта

```
├── index.html          # HTML + UI
├── package.json        # Зависимости
├── vite.config.js      # Конфиг Vite
├── capacitor.config.json  # Конфиг Capacitor
├── src/
│   └── main.js         # Основной код игры
└── dist/               # Сборка (генерируется)
```

## 🔧 Настройка

### Koda MCP конфигурация

Проект использует **локальную конфигурацию** Koda:

```
.koda/
├── config.yaml           # MCP серверы для проекта
└── skills/
    ├── game-development.md
    ├── threejs-templates.md
    └── MCP-GAME-DEVELOPMENT.md
```

**Глобальная конфигурация** (опционально):
- Путь: `C:\Users\Aleksey\.koda\config.yaml`
- Используется, если локальный конфиг не найден

**Переопределение пути:**
Создай `.env` файл в корне:
```bash
KODA_CONFIG_PATH=.koda/config.yaml
KODA_SKILLS_PATH=.koda/skills
```

В `src/engine/config.js` в объекте `CONFIG` можно изменить:
- `car.maxSpeed` — максимальная скорость
- `car.acceleration` — разгон
- `car.turnSpeed` — скорость поворота
- `colors.*` — цвета окружения

## 📱 Запуск в Telegram

1. Откройте бота в Telegram
2. Нажмите кнопку меню или ссылку на Web App
3. Игра запустится внутри Telegram

## 🎯 Следующие шаги

- [ ] Добавить больше трасс
- [ ] Реализовать систему финиша круга
- [ ] Добавить модели машин (GLTF)
- [ ] Звуковые эффекты
- [ ] Лидерборды
- [ ] TON интеграция (опционально)

## 📄 Лицензия

MIT
