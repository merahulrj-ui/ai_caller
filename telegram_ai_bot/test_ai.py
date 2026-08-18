import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

key = os.getenv("GEMINI_API_KEY")
print("Key length:", len(key) if key else 0)

client = genai.Client(api_key=key)

# Test with fast models
for model_name in ["gemini-2.5-flash-lite", "gemini-3.6-flash", "gemini-3.7-flash", "gemini-flash-latest"]:
    try:
        print(f"Testing model: {model_name}...")
        chat = client.chats.create(
            model=model_name,
            config=types.GenerateContentConfig(
                system_instruction="Aap Hinglish me casual baat karte ho. 1 line me reply karo.",
                temperature=0.7
            )
        )
        response = chat.send_message("Hey, kya chal raha hai?")
        print(f"✅ Success with {model_name}!")
        print("Reply:", response.text)
        break
    except Exception as e:
        print(f"❌ Error with {model_name}: {e}")
