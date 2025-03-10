import os
import re
import json
import asyncio
from telethon import TelegramClient, events
from telegram import Bot

# Konfigurasi API Telegram
api_id = "21283826"
api_hash = "c6b9bf0c57759399df65073d99703794"
bot_token = "7909056570:AAGywB5MnDSBr9maDFmB9prMTek7O5x7EK8"  # Masukkan token bot Anda

# Inisialisasi Bot Telegram
bot = Bot(token=bot_token)

# Baca data transaksi
with open('./transaction_data.json', 'r') as f:
    transaction_data = json.load(f)

user_id = transaction_data["userId"]
number = transaction_data["number"]
session_path = f"./app/session/{user_id}/{number}.session"

async def otp_reader():
    session_path = f"./app/session/{user_id}/{number}.session"
    client = TelegramClient(session_path, api_id, api_hash)
    try:
        # Koneksi ke Telegram
        await client.connect()

        # Cek apakah user sudah login
        if not await client.is_user_authorized():
            await bot.send_message(chat_id=user_id, text="Sesi Telegram belum terhubung. Pastikan Anda sudah login di aplikasi Telegram.")
            return

        print(f"Connected to {number} for user {user_id}")

        @client.on(events.NewMessage)
        async def otp_handler(event):
            # Deteksi pesan masuk
            print(f"New message: {event.raw_text}")
            otp_match = re.search(r'\b\d{5,6}\b', event.raw_text)
            if otp_match:
                otp_code = otp_match.group(0)
                await bot.send_message(chat_id=user_id, text=f"OTP diterima: {otp_code}")

        # Bot tetap berjalan untuk membaca pesan
        await client.run_until_disconnected()

    except Exception as e:
        await bot.send_message(chat_id=user_id, text=f"Terjadi kesalahan: {str(e)}")
        print(f"Error: {str(e)}")

    finally:
        # Pastikan sesi ditutup saat selesai
        await client.disconnect()
        print(f"Disconnected from {number}")

if __name__ == "__main__":
    asyncio.run(otp_reader())