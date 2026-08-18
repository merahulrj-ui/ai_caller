import os
import sys
import json
import random
import time
import asyncio
import logging
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from dotenv import load_dotenv
from telethon import TelegramClient, events
from telethon.sessions import StringSession
from google import genai
from google.genai import types

# --- DUMMY WEB SERVER FOR RENDER (FREE TIER) ---
class DummyHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        self.wfile.write(b"Bot is alive and running!")

def run_server():
    port = int(os.environ.get("PORT", 10000))
    server_address = ('0.0.0.0', port)
    httpd = HTTPServer(server_address, DummyHandler)
    httpd.serve_forever()

server_thread = threading.Thread(target=run_server)
server_thread.daemon = True
server_thread.start()
# -----------------------------------------------

load_dotenv()

API_ID = int(os.getenv("TELEGRAM_API_ID", "31393771"))
API_HASH = os.getenv("TELEGRAM_API_HASH", "aa4d33aedee009f5baec4e0f3b5bf24a")
STRING_SESSION = os.getenv("TELEGRAM_STRING_SESSION", "")
GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
TARGET_USERNAME = os.getenv("TARGET_USERNAME", "l_hartley99").lower().lstrip("@")

FALLBACK_MODELS = [
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-2.5-flash-lite",
    "gemini-flash-latest",
    "gemini-2.5-pro",
    "gemini-pro-latest"
]

# Load profile
profile_context = ""
profile_path = os.path.join(os.path.dirname(__file__), "my_profile.json")
if os.path.exists(profile_path):
    try:
        with open(profile_path, "r", encoding="utf-8") as f:
            profile_data = json.load(f)
            profile_context = f"\nUser Background Info:\n{json.dumps(profile_data, indent=2, ensure_ascii=False)}\n"
    except Exception as e:
        print(f"[Warning] {e}")

SYSTEM_INSTRUCTION = f"""
Aap ek real young boy/man ki tarah baat kar rahe hain. 
Aapka nature chill, cool, witty, smart aur friendly hai.
{profile_context}
Important Rules & Behavior:
1. STRICT NAME RULE: Kabhi bhi apna naam mat bolo ya reveal mat karo (Do NOT mention your name).
2. PROFESSION: Aap strictly "Software Engineer / Developer" ke roop me kaam karte ho.
3. Language Matching: ALWAYS match her language! Agar wo English me text kare, to natural casual Indian-style English me reply karo (jaise Indian youth/college students chat karte hain, e.g. "yeah bro", "sounds good", "nothing much, you tell"). Agar wo Hinglish me text kare, to natural casual Hinglish me reply karo. Keep it very natural and cool.
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
            response = ai_client.models.generate_content(
                model=model_name,
                contents=contents,
                config=config
            )
            if response and response.text:
                reply_text = response.text.strip()
                history.append({"role": "user", "text": user_text})
                history.append({"role": "model", "text": reply_text})
                print(f"[Cloud AI Success] Used {model_name} for @{TARGET_USERNAME}")
                return reply_text
        except Exception as e:
            print(f"[Cloud Fallback] {model_name} failed: {e}")
            continue

    return "Haan sun raha hu, network slow chal raha hai, tum batao?"

client = TelegramClient(StringSession(STRING_SESSION), API_ID, API_HASH)

@client.on(events.NewMessage(incoming=True))
async def on_new_message(event):
    if not event.is_private:
        return

    sender = await event.get_sender()
    sender_id = event.sender_id
    sender_username = (getattr(sender, "username", "") or "").lower().lstrip("@")
    sender_name = getattr(sender, "first_name", "Friend")

    # Strictly only reply to target
    if sender_username != TARGET_USERNAME and str(sender_id) != TARGET_USERNAME:
        return

    msg_text = event.message.text
    if not msg_text or not msg_text.strip():
        return

    print(f"\n[Cloud DM from @{TARGET_USERNAME}] ({sender_name}): {msg_text}")

    try:
        await event.mark_read()
        await asyncio.sleep(random.uniform(1.5, 3.0))

        async with client.action(event.chat_id, "typing"):
            reply_text = generate_ai_reply(sender_id, msg_text)
            await asyncio.sleep(random.uniform(1.0, 2.0))

        await event.reply(reply_text)
        print(f"[Cloud Replied]: {reply_text}")

    except Exception as e:
        print(f"[Error]: {e}")

async def main():
    print("=" * 60)
    print(f"[START] Cloud Auto-Responder 24/7 Running for @{TARGET_USERNAME}")
    print("=" * 60)
    await client.start()
    print("[LIVE 24/7] Connected to personal Telegram session!")
    await client.run_until_disconnected()

if __name__ == "__main__":
    if not STRING_SESSION:
        print("❌ Error: TELEGRAM_STRING_SESSION is missing in environment variables!")
        sys.exit(1)
    asyncio.run(main())
