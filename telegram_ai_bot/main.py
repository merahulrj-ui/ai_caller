import os
import sys
import json
import random
import asyncio
from dotenv import load_dotenv
from telethon import TelegramClient, events
from google import genai
from google.genai import types

# Fix standard output encoding
try:
    sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
    sys.stderr.reconfigure(encoding="utf-8", line_buffering=True)
except Exception:
    pass

load_dotenv()

API_ID = os.getenv("TELEGRAM_API_ID")
API_HASH = os.getenv("TELEGRAM_API_HASH")
GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
TARGET_USERNAME = "l_hartley99"

# Waterfall Fallback Models
FALLBACK_MODELS = [
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-2.5-flash-lite",
    "gemini-flash-latest",
    "gemini-2.5-pro",
    "gemini-pro-latest"
]

# Load personal profile context
profile_context = ""
profile_path = os.path.join(os.path.dirname(__file__), "my_profile.json")
if os.path.exists(profile_path):
    try:
        with open(profile_path, "r", encoding="utf-8") as f:
            profile_data = json.load(f)
            profile_context = f"\nUser Background Info (Aapke baare me details):\n{json.dumps(profile_data, indent=2, ensure_ascii=False)}\n"
    except Exception as e:
        print(f"[Warning] loading profile: {e}")

SYSTEM_INSTRUCTION = f"""
Aap ek real young boy/man ki tarah baat kar rahe hain. 
Aapka nature chill, cool, witty, smart aur friendly hai.
{profile_context}
Important Rules & Behavior:
1. STRICT NAME RULE: Kabhi bhi apna naam mat bolo ya reveal mat karo (Do NOT mention your name).
2. PROFESSION: Aap strictly "Software Engineer / Developer" ke roop me kaam karte ho.
3. Language: Natural casual Hinglish (jaise Indians Telegram/WhatsApp par chat karte hain). E.g. "haan batao", "kya chal raha hai", "arre nahi yaar", "haha sahi hai", "kuch nahi bas chill".
4. Message Length: Short and crisp rakho (1-2 sentences maximum, typical messaging style). Long essays ya paragraphs bilkul mat likho.
5. Tone: Real insaan jaisa sound karo. AI, chatbot, assistant ya formal customer support jaisi baatein bilkul mat karo.
6. Answering Questions (Jo bhi wo puchhe):
   - Agar wo puchhe "Kya kar rahe ho?" / "Khana khaya?": Natural jawab do jaise "Bas abhi coding/work se free hua, tum batao kya chal raha hai" ya "Haan khaya, tumne?".
   - Agar wo photo ya call maange: Smartly handle karo jaise "Abhi camera shakal dikhane jaisi nahi hai haha" ya "Abhi thoda busy hu, text par hi batao".
   - Agar wo flirt ya masti kare: Witty, playful aur smart reaction do.
7. Punctuation: Real chatting jaisi natural rakho, over-formal grammar mat use karo.
"""

user_histories = {}
ai_client = genai.Client(api_key=GEMINI_KEY)

def generate_ai_reply(user_id, user_text):
    """Multi-model waterfall generator"""
    if user_id not in user_histories:
        user_histories[user_id] = []
    history = user_histories[user_id]
    
    contents = []
    for item in history[-10:]:
        role = "user" if item["role"] == "user" else "model"
        contents.append(types.Content(
            role=role,
            parts=[types.Part.from_text(text=item["text"])]
        ))
    
    contents.append(types.Content(
        role="user",
        parts=[types.Part.from_text(text=user_text)]
    ))

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        temperature=0.8,
    )

    for model_name in FALLBACK_MODELS:
        try:
            print(f"[AI] Trying {model_name}...")
            response = ai_client.models.generate_content(
                model=model_name,
                contents=contents,
                config=config
            )
            if response and response.text:
                reply_text = response.text.strip()
                history.append({"role": "user", "text": user_text})
                history.append({"role": "model", "text": reply_text})
                print(f"[AI Success] Used: {model_name}")
                return reply_text
        except Exception as e:
            print(f"[AI Fallback] {model_name} failed: {e}")
            continue

    return "Haan sun raha hu, network slow chal raha hai, tum batao?"

client = None
if API_ID and API_HASH:
    client = TelegramClient("personal_ai_session", int(API_ID), API_HASH)

    @client.on(events.NewMessage(incoming=True))
    async def on_new_message(event):
        if not event.is_private:
            return

        sender = await event.get_sender()
        sender_id = event.sender_id
        sender_username = (getattr(sender, "username", "") or "").lower().lstrip("@")
        sender_name = getattr(sender, "first_name", "Friend")

        # Strictly only reply to @l_hartley99
        if sender_username != TARGET_USERNAME and str(sender_id) != TARGET_USERNAME:
            return

        msg_text = event.message.text
        if not msg_text or not msg_text.strip():
            return

        print(f"\n[DM from @{TARGET_USERNAME}] ({sender_name}): {msg_text}")

        try:
            await event.mark_read()
            await asyncio.sleep(random.uniform(1.5, 3.0))

            async with client.action(event.chat_id, "typing"):
                reply_text = generate_ai_reply(sender_id, msg_text)
                await asyncio.sleep(random.uniform(1.0, 2.0))

            await event.reply(reply_text)
            print(f"[AI Replied to @{TARGET_USERNAME}]: {reply_text}")

        except Exception as e:
            print(f"[Error]: {e}")

async def main():
    print("=" * 60)
    print(f"Targeting specific user: @{TARGET_USERNAME}")
    print("=" * 60)
    await client.start()
    print(f"\n[LIVE] Listening for messages strictly from @{TARGET_USERNAME}...")
    await client.run_until_disconnected()

if __name__ == "__main__":
    if not API_ID or not API_HASH:
        print("[Error] Please set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env first to connect to your personal Telegram account!")
    else:
        asyncio.run(main())
