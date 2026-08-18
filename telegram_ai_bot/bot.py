import os
import sys
import json
import random
import asyncio
from dotenv import load_dotenv
from telegram import Update
from telegram.constants import ChatAction
from telegram.ext import (
    ApplicationBuilder,
    ContextTypes,
    MessageHandler,
    CommandHandler,
    filters
)
from google import genai
from google.genai import types

# Fix standard output encoding and buffering for Windows terminals
try:
    sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
    sys.stderr.reconfigure(encoding="utf-8", line_buffering=True)
except Exception:
    pass

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "8856414987:AAFGMdYN-tPZHrIIVxPaV_FK8g1Jct5G04E")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Waterfall Fallback Models (Ek fail hoga to turant dusra, fir teesra chalega)
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

# Store per-user message history: {user_id: [{"role": "user"|"model", "text": "..."}]}
user_histories = {}
ai_client = None

def get_history(user_id):
    if user_id not in user_histories:
        user_histories[user_id] = []
    return user_histories[user_id]

def generate_ai_reply(user_id, user_text):
    """Waterfall AI generator: Tries models in sequence until one succeeds"""
    global ai_client
    history = get_history(user_id)
    
    # Format contents for Gemini API
    contents = []
    for item in history[-10:]: # Keep last 10 messages for rich context
        role = "user" if item["role"] == "user" else "model"
        contents.append(types.Content(
            role=role,
            parts=[types.Part.from_text(text=item["text"])]
        ))
    
    # Append the current incoming user message
    contents.append(types.Content(
        role="user",
        parts=[types.Part.from_text(text=user_text)]
    ))

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        temperature=0.8,
    )

    last_error = None
    # Waterfall trial through all available models
    for model_name in FALLBACK_MODELS:
        try:
            print(f"[AI] Trying model: {model_name}...")
            response = ai_client.models.generate_content(
                model=model_name,
                contents=contents,
                config=config
            )
            if response and response.text:
                reply_text = response.text.strip()
                # Save to history
                history.append({"role": "user", "text": user_text})
                history.append({"role": "model", "text": reply_text})
                print(f"[AI Success] Used: {model_name}")
                return reply_text
        except Exception as e:
            print(f"[AI Fallback] {model_name} failed: {e}. Trying next model...")
            last_error = e
            continue

    print(f"[AI Fatal Error] All models failed! Last error: {last_error}")
    return "Haan sun raha hu, thoda sa network slow hai, tum batao?"

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command"""
    user_id = update.effective_user.id
    user_histories[user_id] = []
    await update.message.reply_text("Hey, kya chal raha hai?")

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle all incoming text messages"""
    if not update.message or not update.message.text:
        return

    user_text = update.message.text.strip()
    user_id = update.effective_user.id
    user_name = update.effective_user.first_name or "Friend"
    chat_id = update.effective_chat.id

    print(f"\n[Incoming Message] from {user_name} ({user_id}): {user_text}")

    try:
        # Show typing indicator
        await context.bot.send_chat_action(chat_id=chat_id, action=ChatAction.TYPING)
        
        # Natural typing delay (1.5 to 3.0 seconds)
        await asyncio.sleep(random.uniform(1.5, 3.0))

        # Generate response using multi-model waterfall
        reply_text = generate_ai_reply(user_id, user_text)

        # Send response
        await update.message.reply_text(reply_text)
        print(f"[AI Replied]: {reply_text}")

    except Exception as e:
        print(f"[Telegram Error]: {e}")
        await update.message.reply_text("Haan batao?")

def main():
    global ai_client
    print("=" * 60)
    print("Starting Telegram AI Bot: @naughtybri_bot")
    print(f"Loaded Waterfall Fallback Models: {', '.join(FALLBACK_MODELS)}")
    print("=" * 60)

    ai_client = genai.Client(api_key=GEMINI_API_KEY)
    print("[OK] Gemini AI Client initialized!")

    app = ApplicationBuilder().token(TELEGRAM_BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    print("\n[LIVE] BOT IS NOW ONLINE AND LISTENING FOR MESSAGES!")
    print("Telegram par @naughtybri_bot open karke check karein...\n")
    app.run_polling()

if __name__ == "__main__":
    main()
