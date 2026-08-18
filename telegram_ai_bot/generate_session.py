import os
from dotenv import load_dotenv
from telethon.sync import TelegramClient
from telethon.sessions import StringSession

load_dotenv()

API_ID = int(os.getenv("TELEGRAM_API_ID", "31393771"))
API_HASH = os.getenv("TELEGRAM_API_HASH", "aa4d33aedee009f5baec4e0f3b5bf24a")

print("=" * 60)
print("🔑 Generating Telegram String Session for Cloud...")
print("=" * 60)

with TelegramClient(StringSession(), API_ID, API_HASH) as client:
    session_str = client.session.save()
    print("\n✅ AAPKI SESSION STRING READY HAI:\n")
    print(session_str)
    print("\n" + "=" * 60)
    print("Is string ko copy karke save kar lein, ye cloud me kaam aayegi.")
