# 📱 Инструкция: Запуск в Telegram Mini App

## Вариант 1: Локальная разработка (туннель)

### Через ngrok (рекомендуется):

1. Установите ngrok:
```bash
npm install -g ngrok
```

2. Запустите игру:
```bash
npm run dev
```

3. В другом терминале создайте туннель:
```bash
ngrok http 3000
```

4. Скопируйте URL (например, `https://abc123.ngrok.io`)

### Через Cloudflare Tunnel:

```bash
npm install -g cloudflared
cloudflared tunnel --url http://localhost:3000
```

## Вариант 2: Деплой на хостинг

### Vercel (самый простой):

```bash
# Установите Vercel CLI
npm install -g vercel

# Задеплойте
vercel
```

### Netlify:

```bash
npm run build
# Загрузите папку dist на Netlify Drop
```

### GitHub Pages:

```bash
# Установите gh-pages
npm install -D gh-pages

# Добавьте в package.json:
# "scripts": { "deploy": "gh-pages -d dist" }

npm run build
npm run deploy
```

## Настройка Telegram бота

1. Откройте [@BotFather](https://t.me/BotFather)
2. Создайте бота: `/newbot`
3. Получите токен API

4. Создайте Web App:
   ```
   /newapp → выберите бота → вставьте URL
   ```

5. Готово! Ваш бот теперь имеет кнопку Web App

## Тестирование локально

1. Откройте в браузере: `http://localhost:3000`
2. Или через ngrok URL в Telegram (на телефоне)

## Для Android

После `npm run build`:

```bash
# Установите Capacitor
npm install @capacitor/core @capacitor/cli -g
npx cap init

# Добавьте Android
npx cap add android

# Синхронизируйте и откройте
npx cap sync
npx cap open android
```

В Android Studio: Build → Build APK(s)

## Важные примечания

- Telegram требует HTTPS для Mini Apps
- Локально используйте ngrok/Cloudflare
- Для продакшена — Vercel/Netlify
- Android требует подписанный APK для Google Play
