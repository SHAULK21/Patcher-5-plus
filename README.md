# 🛴 Xiaomi Electric Scooter 5 Plus — Firmware Studio & Patcher

[![Streamlit App](https://static.streamlit.io/badges/streamlit_badge_black_white.svg)](https://share.streamlit.io)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Hardware](https://img.shields.io/badge/Target-Brightway%20MCU%20(ES32)-red.svg)](#)

Интерактивный конфигуратор и дизассемблерный патчер прошивки для электросамоката **Xiaomi Electric Scooter 5 Plus** (контроллер **Brightway SZMC-ES-02664-LQ** на базе микроконтроллера **ES32 / ARM Cortex-M4**).

Подготовлен для развертывания на **GitHub** и мгновенного хостинга в **Streamlit Community Cloud**.

---

## ⚡ Быстрый старт (Хостинг на Streamlit Cloud)

### Способ 1: Запуск на Streamlit Community Cloud
1. Сделайте **Fork** или создайте новый репозиторий на GitHub с файлами из этой папки.
2. Перейдите на [share.streamlit.io](https://share.streamlit.io) и авторизуйтесь через GitHub.
3. Нажмите **"New app"** -> Выберите ваш репозиторий -> Укажите основной файл: `streamlit_app.py`.
4. Нажмите **"Deploy"**! Ваше веб-приложение станет доступно публично через пару секунд.

### Способ 2: Локальный запуск на компьютере
```bash
# Клонируйте репозиторий
git clone https://github.com/your-username/xiaomi-5plus-firmware-patcher.git
cd xiaomi-5plus-firmware-patcher

# Установите зависимости
pip install -r requirements.txt

# Запустите веб-интерфейс Streamlit
streamlit run streamlit_app.py
```
Приложение откроется по адресу: `http://localhost:8501`.

---

## 🔬 Что патчится в прошивке (Реальные адреса ARM Thumb-2)

Патчер работает напрямую с дампом памяти Flash ROM размером **125,371 байт**:

| Смещение | Инструкция в стоке | Патч (Пример 35 км/ч) | Описание |
|---|---|---|---|
| `0x00005C76` | `78 7A` (`LDRB r0, [r7, #9]`) | `23 20` (`MOVS r0, #35`) | **Ограничение скорости Sport** — замена чтения структуры константой |
| `0x00005C9E` | `78 7B` (`LDRB r0, [r7, #11]`) | `00 20` (`MOVS r0, #0`) | **Отключение KERS (Свободный накат 0A)** |
| `0x00005C74` | `AB 49 78 7A 08 80` | *Сигнатура проверки* | Контрольная сигнатура Thumb-2 перед внесением изменений |

---

## ⚠️ ВАЖНО: Предотвращение бутлупа (Anti-Brick Protocol)

> **НЕ ШЕЙТЕ МОДИФИЦИРОВАННЫЙ .BIN ЧЕРЕЗ ОФИЦИАЛЬНОЕ ПРИЛОЖЕНИЕ ИЛИ СТАНДАРТНЫЙ BLUETOOTH OTA!**

1. **Заводской загрузчик (Bootloader)** контроллера Brightway при старте верифицирует целостность Flash ROM (по контрольной сумме или цифровой подписи сертификата в конце файла `0x01E900`).
2. При изменении байтов контрольная сумма меняется, и штатный загрузчик может уйти в **Bootloop (вечную перезагрузку / отказ запуска)**.
3. **Безопасная прошивка возможна только через программатор ST-Link v2 / J-Link** по интерфейсу **SWD**:
   * Разберите деку и найдите на плате контроллера 4 контакта: `SWDIO`, `SWCLK`, `GND`, `3.3V`.
   * **ОБЯЗАТЕЛЬНО сохраните полный заводской дамп чипа** перед любой записью:
     ```bash
     openocd -f interface/stlink.cfg -f target/stm32f1x.cfg -c "init; reset halt; dump_image stock_backup.bin 0x08000000 0x20000; exit"
     ```
   * Имея `stock_backup.bin`, вы всегда сможете восстановить самокат за 1 минуту при любой ошибке.

---

## 📂 Структура репозитория
```
.
├── streamlit_app.py        # Основное веб-приложение Streamlit
├── requirements.txt        # Python-зависимости (streamlit, altair, numpy)
├── .streamlit/
│   └── config.toml         # Тёмная тема и настройки сервера Streamlit
├── README.md               # Документация и инструкция
└── .gitignore              # Исключения Git
```
