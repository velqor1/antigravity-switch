<div align="center">
  <img src="branding/app-icon.png" width="96" height="96" alt="AntiGravity Switch icon" />
  <h1>AntiGravity Switch</h1>
  <p>Десктопный и консольный менеджер аккаунтов Antigravity с мониторингом квот, статистикой расхода и быстрым переключением.</p>
  <p>
    <a href="https://github.com/velqor1/antigravity-switch/releases/latest"><strong>Скачать Release v1.0</strong></a>
    ·
    <a href="#возможности">Возможности</a>
    ·
    <a href="#установка-windows">Установка</a>
    ·
    <a href="#сборка-из-исходников">Сборка</a>
  </p>
</div>

## Возможности

- **Управление аккаунтами** — добавление через Google OAuth, refresh-токен или локальный импорт, заметки, перетаскивание порядка, отключение и экспорт/перенос профилей.
- **Актуальные квоты и история циклов** — отображение остатка и времени сброса по окнам `5H` и `Weekly` для актуальных моделей (`Gemini 3.1 Pro`, `Gemini 3 Flash`, `Claude 4.6 Sonnet/Opus`, `GPT-OSS`), журнал циклов и оценка стоимости расхода.
- **Быстрое и автоматическое переключение** — смена активного аккаунта в один клик для Antigravity Desktop App, CLI (`agy`), IDE и расширения VS Code, плюс опциональное автопереключение при падении квоты.
- **Обновлённый интерфейс** — тёмная графитовая тема без лишнего визуального шума, собственная безрамочная шапка окна, пружинные анимации, полная локализация (`RU` / `EN` / `ZH`) и быстрая мини-панель в системном трее.
- **Консольный клиент** — утилита `agy-switch.exe` для управления аккаунтами и политиками прямо из терминала с общей локальной базой.

## Установка (Windows)

1. Откройте раздел **[Releases](https://github.com/velqor1/antigravity-switch/releases/latest)** и скачайте архив `agy-switch-v1.0-windows-x64.zip`.
2. Распакуйте в удобную папку и запустите `agy-switch-desktop.exe` (для терминала — `agy-switch.exe`).

> Все аккаунты и настройки хранятся только локально в `%USERPROFILE%\.antigravity_tools\`.

## Стек

- **Desktop / Backend:** Tauri v2, Rust
- **Frontend:** React, TypeScript, Tailwind CSS, Motion (`motion/react`), Zustand, i18next

## Сборка из исходников

Требования: **Node.js 20+**, **Rust (MSVC на Windows)**, **Visual Studio Build Tools 2022**, **LLVM (`LIBCLANG_PATH`)**.

Для встроенного Google OAuth при сборке из исходников задайте переменные окружения `ANTIGRAVITY_OAUTH_CLIENT_ID` и `ANTIGRAVITY_OAUTH_CLIENT_SECRET` (или передайте их во время запуска).

```bash
npm install
npm run build
npm run tauri build -- --no-bundle -- --locked
```

Готовые бинарники появятся в `src-tauri/target/release/`:
- `agy-switch-desktop.exe` — графическое приложение
- `agy-switch.exe` — консольный интерфейс

## Основа и лицензия

Проект основан на [anglee0323/agy-switch](https://github.com/anglee0323/agy-switch) и доработан:
- переработан дизайн в тёмной графитовой палитре с новой иконкой и анимациями;
- добавлена собственная безрамочная верхняя панель окна для Windows;
- добавлена полная русская локализация и обновлён набор отслеживаемых моделей по умолчанию.

Распространяется под лицензией **[CC BY-NC-SA 4.0](LICENSE)**.
