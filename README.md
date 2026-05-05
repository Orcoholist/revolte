# 🏎️ Revolt Racing

**3D гоночная игра для Telegram Mini App и Android**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Быстрый старт

```bash
# Установка зависимостей
npm install

# Разработка
npm run dev

# Сборка
npm run build

# Preview
npm run preview
```

## 📱 Telegram Mini App

Полная инструкция: [TELEGRAM_DEPLOY.md](TELEGRAM_DEPLOY.md)

### Быстрый деплой

```bash
# 1. Сборка
npm run build

# 2. Деплой на Vercel
npm run deploy:vercel

# 3. Создать бота в @BotFather
# /newbot -> /newapp -> Вставить URL

# 4. Тестирование
# Откройте бота в Telegram
```

### Скрипт автоматической настройки

```bash
.\scripts\setup-tg-mini-app.ps1
```

## 🎮 Особенности

- ⚡ **Three.js** — 3D графика
- 🚗 **Cannon.js** — физика автомобиля
- 🏁 **Система кругов** — контрольные точки
- 🎯 **Навигация** — стрелки и миникарта
- 💨 **Нитро** — система частиц и ускорение
- 📱 **Адаптивность** — тач-управление для мобильных
- 🏆 **Экран результатов** — время и рекорды

## 🛠️ Технологии

| Технология | Назначение |
|------------|------------|
| Three.js | 3D рендеринг |
| Cannon.js | Физика |
| Vite | Сборка |
| Telegram WebApp | Mini App |

## 📁 Структура проекта

```
├── index.html              # HTML + UI
├── package.json            # Зависимости
├── vite.config.js          # Конфиг Vite
├── TELEGRAM_DEPLOY.md      # Инструкция по Telegram
├── src/
│   ├── main.js             # Точка входа
│   ├── engine/             # Ядро игры
│   │   ├── config.js       # Конфигурация
│   │   ├── physics.js      # Cannon.js мир
│   │   ├── renderer.js     # Three.js рендерер
│   │   └── nitroSystem.js  # Система нитро
│   ├── world/              # Трасса и окружение
│   │   ├── track.js        # Создание трассы
│   │   ├── environment.js  # Деревья, барьеры
│   │   └── lapCounter.js   # Счётчик кругов
│   ├── car/                # Машина
│   │   ├── carFactory.js   # Создание машины
│   │   └── carController.js # Управление
│   ├── controls/           # Ввод
│   │   └── input.js        # Клавиатура + тач
│   └── ui/                 # Интерфейс
│       ├── hud.js          # HUD, миникарта
│       └── telegram.js     # Telegram интеграция
└── dist/                   # Сборка (генерируется)
```

## ⚙️ Настройка

### Koda MCP конфигурация

Проект использует локальную конфигурацию Koda:

```
.koda/
├── config.yaml           # MCP серверы
└── skills/               # Скиллы агента
```

Проверка конфигурации:
```bash
.\scripts\check-koda-config.ps1
```

### Параметры игры

В `src/engine/config.js`:

```javascript
export const CONFIG = {
  car: {
    maxSpeed: 120,        // Максимальная скорость
    engineForce: 800,     // Сила двигателя
    brakeForce: 100,      // Сила торможения
    maxSteer: 0.45,       // Максимальный угол поворота
    steerSpeed: 0.015     // Скорость поворота (плавность)
  },
  physics: {
    gravity: -9.82,
    friction: 0.6
  },
  camera: {
    distance: 14,         // Дистанция камеры
    height: 6             // Высота камеры
  }
};
```

## 🎯 Управление

### Клавиатура (PC)
- **W / ↑** — газ
- **S / ↓** — задний ход
- **A / ←** — поворот влево
- **D / →** — поворот вправо
- **Пробел** — тормоз
- **Shift** — нитро
- **R** — перевернуть машину

### Тач (Mobile)
- Кнопки на экране: газ, тормоз, поворот
- **NITRO** — отдельная кнопка
- **🔄** — перевернуть (появляется при перевороте)

## 📱 Telegram Mini App

### Поддерживаемые функции

- ✅ **Развёртывание на весь экран** (`tg.expand()`)
- ✅ **Адаптация под тему** (цвета Telegram)
- ✅ **Закрытие приложения** (`tg.close()`)
- ✅ **Данные пользователя** (`tg.initDataUnsafe`)
- ✅ **MainButton** (большая кнопка)
- ✅ **Share** (общение с друзьями)

### Интеграция

```javascript
// В src/ui/telegram.js
export function initTelegram() {
  if (window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    return tg;
  }
}

// Использование данных пользователя
const user = tg.initDataUnsafe?.user;
if (user) {
  console.log('Игрок:', user.first_name);
}
```

## 🧪 Тестирование

```bash
# Локальный preview
npm run preview

# Проверка перед деплоем
npm run build && npm run preview
```

## 📦 Деплой

### Vercel (рекомендуется)

```bash
npm install -g vercel
vercel deploy --prod
```

### GitHub Pages

```bash
npm run deploy:github
```

### Netlify

```bash
netlify deploy --prod --dir=dist
```

## 🔄 CI/CD

Автоматический деплой при push в main (Vercel):

```yaml
# .vercel.yml
buildCommand: npm run build
outputDirectory: dist
```

## 📊 Мониторинг

### Telegram Analytics

- Используйте `tg.initData` для валидации
- Сохраняйте рекорды в базу данных
- Отслеживайте время прохождения

### Производительность

- DevTools → Performance (цель: 60 FPS)
- Проверка памяти (нет утечек)
- Оптимизация теней (`shadowMap.type`)

## 🎨 Кастомизация

### Цвета

В `src/engine/config.js`:

```javascript
colors: {
  sky: 0x87CEEB,
  ground: 0x4a7c2e,
  road: 0x444444,
  car: 0xff6b6b,
  // ...
}
```

### Трасса

В `src/world/track.js` измените контрольные точки:

```javascript
const points = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(80, 0, 0),
  // ...
];
```

## 🤝 Вклад

1. Fork проекта
2. Создайте ветку (`git checkout -b feature/amazing`)
3. Commit изменений (`git commit -m 'Add amazing feature'`)
4. Push в ветку (`git push origin feature/amazing`)
5. Создайте Pull Request

## 📄 Лицензия

MIT © 2024

## 🔗 Ссылки

- [Документация Telegram Mini App](https://core.telegram.org/bots/webapps)
- [Three.js Docs](https://threejs.org/docs/)
- [Cannon.js Docs](http://chandlerprall.github.io/ThreeCS/)
- [Vite Docs](https://vitejs.dev/)

## 📞 Поддержка

- Telegram: [@ваш_юзернейм]
- Email: [ваш@email.com]
- Issues: [GitHub Issues](https://github.com/ваш-юзернейм/revolt-clone-web/issues)

---

Made with ❤️ using Three.js + Cannon.js + Telegram WebApp
