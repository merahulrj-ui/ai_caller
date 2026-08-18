# Telegram AI Personal Auto-Responder (Powered by Google Gemini)

Ye bot aapke personal Telegram account se connect hokar saamne wale se bilkul **real insaan ki tarah Hinglish me chat** karega aur full context/chat memory yaad rakhega.

---

## 📋 Features
- **Natural Persona:** Casual, cool, short Hinglish messages (bilkul real chatting style).
- **Full Chat Memory:** Pichli baatein yaad rakhta hai taaki conversation robotic na lage.
- **Human Typing Simulation:** Reply bhejne se pehle Telegram par "typing..." show karega aur 2-4 second wait karke bhejega.
- **Specific User Filter:** Aap chahein toh sirf us specific ladki ke username par set kar sakte hain taaki baaki doston ya family ko bot reply na kare.

---

## 🚀 Setup Steps

### Step 1: Dependencies Install Karein
Terminal ya Command Prompt me run karein:
```bash
cd telegram_ai_bot
pip install -r requirements.txt
```

---

### Step 2: API Keys Hasil Karein

1. **Telegram API ID & Hash:**
   - [my.telegram.org](https://my.telegram.org) par jayein.
   - Apna phone number daal kar login karein.
   - **API Development Tools** par click karein.
   - Koi bhi App Name daalkar **App api_id** aur **App api_hash** copy kar lein.

2. **Gemini API Key:**
   - [Google AI Studio](https://aistudio.google.com/app/apikey) par jayein aur **Create API Key** par click karein.

---

### Step 3: `.env` File Banayein
`telegram_ai_bot` folder me ek nayi `.env` file banayein (ya `.env.example` ko copy karke `.env` rename karein) aur apni details daalein:

```env
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=your_telegram_api_hash_here
GEMINI_API_KEY=your_gemini_api_key_here

# (Optional) Agar sirf us ladki se baat karwani hai, toh uska telegram username yahan likhein:
TARGET_USERNAME=ladki_ka_username
```

---

### Step 4: Bot Start Karein
```bash
python main.py
```

*Peheli baar run karne par Telegram aapse phone number aur OTP mangega (login session create karne ke liye). Uske baad ye automatically background me chalu rahega.*
