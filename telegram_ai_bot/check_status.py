import os
import asyncio
from dotenv import load_dotenv
from telethon import TelegramClient

load_dotenv()

API_ID = int(os.getenv("TELEGRAM_API_ID", "31393771"))
API_HASH = os.getenv("TELEGRAM_API_HASH", "aa4d33aedee009f5baec4e0f3b5bf24a")

async def main():
    client = TelegramClient("personal_ai_session", API_ID, API_HASH)
    await client.connect()
    if not await client.is_user_authorized():
        print("STATUS: NOT_AUTHORIZED (Login needed)")
        await client.disconnect()
        return

    me = await client.get_me()
    print("STATUS: AUTHORIZED")
    print(f"Name: {me.first_name}")
    print(f"Username: @{me.username}")
    print(f"Is Bot Account: {getattr(me, 'bot', False)}")
    print(f"Phone: {getattr(me, 'phone', 'N/A')}")
    await client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
