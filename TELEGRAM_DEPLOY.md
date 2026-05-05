# 📱 Развёртывание Telegram Mini App

## Шаг 1: Сборка проекта

```bash
npm run build
```

Файлы для деплоя будут в папке `dist/`.

## Шаг 2: Деплой на хостинг (HTTPS обязателен)

### Вариант A: Vercel (рекомендую ✅)

```bash
# Установить Vercel CLI
npm install -g vercel

# Логин в Vercel
vercel login

# Деплой
vercel deploy --prod
```

**Автоматический деплой через GitHub:**
1. Push в GitHub: `git push origin main`
2. Подключить репозиторий в [Vercel](https://vercel.com)
3. Auto-deploy по каждому push

### Вариант B: GitHub Pages

```bash
# Установить gh-pages
npm install -D gh-pages --save-dev

# Добавить в package.json:
# "homepage": "https://<username>.github.io/<repo>"

# Задеплоить
npm run deploy:github
```

### Вариант C: Netlify

```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

**Получите HTTPS URL** (например: `https://revolt-racing.vercel.app`)

## Шаг 3: Создать бота в Telegram

### 3.1. Создать бота

1. Откройте [@BotFather](https://t.me/BotFather)
2. Отправьте команду `/newbot`
3. Введите название бота (например: `Revolt Racing Bot`)
4. Введите username (должен заканчиваться на `bot`, например: `revolt_racing_bot`)
5. **Сохраните API Token** (нужен для бэкенда, если будет)

### 3.2. Создать Mini App

1. В @BotFather отправьте `/newapp`
2. Выберите созданного бота
3. Введите название приложения (например: `Revolt Racing`)
4. Введите описание (например: `3D racing game`)
5. **Вставьте URL из Шага 2** (например: `https://revolt-racing.vercel.app`)
6. Введите название кнопки (например: `Play`)
7. Загрузите фото 640x360 (опционально)

## Шаг 4: Тестирование

1. Откройте созданного бота в Telegram
2. Нажмите кнопку меню (🌐) или команду `/start`
3. Mini App откроется внутри Telegram

## Шаг 5: Настройка в коде

### Проверка Telegram WebApp

В `src/ui/telegram.js` уже есть базовая инициализация:

```javascript
export function initTelegram() {
  if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    return tg;
  }
  return null;
}
```

### Использование данных пользователя

```javascript
// В src/main.js после initTelegram()
const tg = window.Telegram.WebApp;
const user = tg.initDataUnsafe?.user;

if (user) {
  console.log('User:', user.first_name, user.id);
  // Можно сохранить для лидерборда
}
```

### Цвета темы Telegram

```javascript
const tg = window.Telegram.WebApp;

// Применить цвета темы
document.documentElement.style.setProperty('--tg-theme-bg-color', 
  tg.themeParams?.bg_color || '#1a1a2e');
document.documentElement.style.setProperty('--tg-theme-text-color', 
  tg.themeParams?.text_color || '#ffffff');
```

## Шаг 6: Продвинутые настройки

### Share Button

```javascript
// Кнопка "Поделиться"
const shareBtn = document.getElementById('share-btn');
shareBtn.addEventListener('click', () => {
  tg.sendData('Я прошёл трассу за 45.2s!');
});
```

### MainButton (большая кнопка внизу)

```javascript
const tg = window.Telegram.WebApp;

// Показать кнопку
tg.MainButton.setText("НАЧАТЬ ГОНКУ");
tg.MainButton.show();

// Обработка нажатия
tg.MainButton.onClick(() => {
  startGame();
});
```

### Close App

```javascript
// Закрыть Mini App
const closeBtn = document.getElementById('menu-btn');
closeBtn.addEventListener('click', () => {
  tg.close();
});
```

## 🔧 Полезные команды

```bash
# Локальный preview
npm run preview

# Проверка перед деплоем
npm run build && npm run preview

# Деплой на Vercel
npm run deploy:vercel
```

## 📊 Мониторинг

### Telegram Analytics

Используйте `tg.initData` для проверки подлинности данных:

```javascript
// Проверка валидности initData
function validateTelegramData(initData) {
  // Проверка хеша (требуется бэкенд)
  return true;
}
```

## 🚀 Пример полного деплоя

```bash
# 1. Push в GitHub
git add .
git commit -m "Telegram Mini App ready"
git push origin main

# 2. Деплой на Vercel
vercel login
vercel deploy --prod

# 3. Скопировать URL и подключить в @BotFather

# 4. Протестировать
# Откройте бота в Telegram и нажмите "Play"
```

## 📝 Чеклист

- [ ] Сборка работает (`npm run build`)
- [ ] HTTPS URL получен (Vercel/Netlify/GitHub Pages)
- [ ] Бот создан в @BotFather
- [ ] Mini App подключено к боту
- [ ] URL Mini App указан правильно
- [ ] Приложение открывается в Telegram
- [ ] Кнопки работают
- [ ] Нет ошибок в консоли

## ❓ Troubleshooting

### Приложение не открывается
- Проверьте, что URL HTTPS (не HTTP)
- Убедитесь, что файл `index.html` доступен по корневому пути
- Проверьте CORS в DevTools

### Ошибка "Invalid URL"
- Убедитесь, что URL доступен извне
- Проверьте, что нет редиректов на страницу входа

### Не работает на Android
- Проверьте `capacitor.config.json`
- Убедитесь, что `allowMixedContent: true`

## 🎯 Следующие шаги

- [ ] Добавить лидерборд (PostgreSQL)
- [ ] Сохранять рекорды
- [ ] Добавить социальный sharing
- [ ] Интеграция с TON (опционально)
