import os
import requests
import json
import re
import io
import tempfile
from datetime import datetime, timedelta, timezone
from bs4 import BeautifulSoup
from flask import Flask, request, Response, stream_with_context, render_template_string, send_from_directory
from supertonic import TTS

app = Flask(__name__)

# ----------------------------------------------------
# INIT RENDERLIB
# ----------------------------------------------------
print("Loading RenderLib...")
try:
    from renderlib import RenderLib
    renderer = RenderLib()
    print("RenderLib loaded successfully!")
except ImportError as e:
    print(f"RenderLib not installed yet or error: {e}")
    renderer = None

# ----------------------------------------------------
# INIT TTS MODEL
# ----------------------------------------------------
print("Loading Supertonic TTS Model...")
try:
    tts = TTS(auto_download=True)
    print("TTS Model loaded successfully!")
except Exception as e:
    print(f"Error initializing TTS: {e}")
    tts = None

VOICES = ["M1", "M2", "M3", "M4", "M5", "F1", "F2", "F3", "F4", "F5"]
LANGUAGES = {
    "English": "en", "Korean": "ko", "Japanese": "ja", "Arabic": "ar",
    "Bulgarian": "bg", "Czech": "cs", "Danish": "da", "German": "de",
    "Greek": "el", "Spanish": "es", "Estonian": "et", "Finnish": "fi",
    "French": "fr", "Hindi": "hi", "Croatian": "hr", "Hungarian": "hu",
    "Indonesian": "id", "Italian": "it", "Lithuanian": "lt", "Latvian": "lv",
    "Dutch": "nl", "Polish": "pl", "Portuguese": "pt", "Romanian": "ro",
    "Russian": "ru", "Slovak": "sk", "Slovenian": "sl", "Swedish": "sv",
    "Turkish": "tr", "Ukrainian": "uk", "Vietnamese": "vi"
}

VOICE_STYLES_CACHE = {}

# ----------------------------------------------------
# HARDCODED MODEL CONFIGURATION (Directly in code)
# ----------------------------------------------------
NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "")   # Secrets se le raha hai
# Agar API key bhi hardcode karna ho toh upar wali line ko hata kar yah likhein:
# NVIDIA_API_KEY = "your_actual_api_key_here"

INVOKE_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
MODEL_ID = "mistralai/mistral-small-4-119b-2603"

# ----------------------------------------------------
# GPS REVERSE GEOCODING
# ----------------------------------------------------
def get_address_from_coords(lat, lon):
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}"
        headers = {'User-Agent': 'CODE_VED_AI_System_by_Divy_Patel'}
        response = requests.get(url, headers=headers, timeout=5)
        data = response.json()
        return data.get('display_name', f"Lat: {lat}, Lon: {lon}")
    except Exception as e:
        return f"Lat: {lat}, Lon: {lon}"

# ----------------------------------------------------
# SERPAPI GOOGLE SEARCH ENGINE
# ----------------------------------------------------
def web_search_scraper(query, num_results=5, user_address=None):
    results = []
    serpapi_key = os.environ.get("SERPAPI_KEY") 
    if not serpapi_key:
        return results

    search_query = query
    if user_address:
        local_keywords = ["near", "nearby", "distance", "time", "where"]
        if any(kw in query.lower() for kw in local_keywords):
            search_query = f"{query} near {user_address}"

    try:
        params = {"engine": "google", "q": search_query, "api_key": serpapi_key, "num": num_results, "hl": "en", "gl": "in"}
        response = requests.get("https://serpapi.com/search", params=params, timeout=10)
        data = response.json()
        
        if "organic_results" in data:
            for item in data["organic_results"]:
                title = item.get("title", "")
                link = item.get("link", "")
                snippet = item.get("snippet", "")
                if title and snippet:
                    results.append({"title": title, "link": link, "snippet": snippet})
    except Exception:
        pass
    return results

# ----------------------------------------------------
# RSS TECH NEWS SCRAPER
# ----------------------------------------------------
def get_live_web_data(query):
    url = f"https://news.google.com/rss/search?q={query}&hl=en&gl=IN&ceid=IN:en"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    tech_keywords = ["ai", "artificial intelligence", "smartphone", "mobile", "feature", "whatsapp", "google", "tech", "technology", "gadget", "apple", "nasa"]
    block_keywords = ["share news", "stock"]
    scraped_results = []
    
    try:
        response = requests.get(url, headers=headers, timeout=6)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")
            items = soup.find_all('item')
            for item in items:
                title = item.title.text if item.title else "No Title"
                title_lower = title.lower()
                
                if any(b_kw in title_lower for b_kw in block_keywords):
                    continue
                if any(t_kw in title_lower for t_kw in tech_keywords):
                    link = item.link.text if item.link else "#"
                    pub_date = item.pubdate.text if item.pubdate else ""
                    source = item.source.text if item.source else "Google News"
                    scraped_results.append({
                        "title": title,
                        "snippet": f"Published: {pub_date} | Source: {source}",
                        "link": link
                    })
                if len(scraped_results) >= 5:
                    break
    except Exception:
        pass
    return scraped_results

# ----------------------------------------------------
# HOME ROUTE
# ----------------------------------------------------
@app.route('/')
def home():
    try:
        with open('index.html', 'r', encoding='utf-8') as f:
            return render_template_string(f.read())
    except Exception as e:
        return f"<h1>System Error</h1><p>index.html missing: {str(e)}</p>"

# ----------------------------------------------------
# NEW ROUTES FOR MODULAR FRONTEND
# ----------------------------------------------------
# 1. CSS फाइलों को लोड करने के लिए
@app.route('/css/<path:filename>')
def serve_css(filename):
    return send_from_directory('css', filename)

# 2. JavaScript फाइलों को लोड करने के लिए
@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory('js', filename)

# 3. लोगो (logo.png) और अन्य रूट फाइलों को लोड करने के लिए
@app.route('/<path:filename>')
def serve_root_files(filename):
    return send_from_directory('.', filename)

# ----------------------------------------------------
# RENDERLIB API ENDPOINT
# ----------------------------------------------------
@app.route('/api/render', methods=['POST'])
def render_content():
    if renderer is None:
        return Response(json.dumps({"error": "RenderLib is not available on the server."}), status=500, mimetype='application/json')
        
    data = request.get_json() or {}
    subject = data.get("subject", "math")
    method = data.get("method", "to_latex")
    args = data.get("args", [])
    kwargs = data.get("kwargs", {})
    
    expression = data.get("expression")
    if expression and not args:
        args = [expression]
        
    try:
        result = renderer.render(subject, method, *args, **kwargs)
        return Response(json.dumps({"result": result}), mimetype='application/json')
    except Exception as e:
        return Response(json.dumps({"error": f"RenderLib Error: {str(e)}"}), status=500, mimetype='application/json')

# ----------------------------------------------------
# CHAT API ENDPOINT (Hardcoded Model & URL)
# ----------------------------------------------------
@app.route('/api/chat', methods=['POST'])
def chat():
    if not NVIDIA_API_KEY:
        return Response(json.dumps({"error": "Configuration Error: NVIDIA_API_KEY is missing."}), mimetype='application/json', status=500)

    data = request.get_json() or {}
    user_message = data.get("message", "")
    attachments = data.get("attachments", []) 
    is_search = data.get("is_search", False)
    history = data.get("history", []) 
    location = data.get("location") 
    user_address = None
    max_tokens = data.get("max_tokens", 4096)
    
    ist_time = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    current_date = ist_time.strftime("%A, %d %B %Y, %I:%M %p IST")

    thinking_mode = data.get("thinking_mode", False)
    thinking_effort = data.get("thinking_effort", "medium")
    
    thinking_instruction = ""
    if thinking_mode:
        thinking_instruction = f"\n[CRITICAL INSTRUCTION: THINKING MODE ENABLED - Effort: {thinking_effort}]\nYou MUST format your reasoning exactly inside <think> and </think> HTML tags."

    location_instruction = ""
    if location and location.get('lat') and location.get('lng'):
        user_address = get_address_from_coords(location['lat'], location['lng'])
        location_instruction = f"\n[USER REAL-TIME LOCATION: {user_address}]"

    system_prompt = f"""[CRITICAL IDENTITY OVERRIDE]
Name: CODE VED
Creator/Engineer: Divy Patel
Current Time: {current_date}.{location_instruction}{thinking_instruction}

You are "Code Ved," an expert AI software engineering and technical consultant. Your goal is to provide precise, clean, and highly optimized code solutions, architectural advice, and technical explanations.
Operational Guidelines:
Technical Accuracy: Provide code that follows industry best practices, is secure, and includes necessary comments for clarity.
Efficiency: Prioritize performance, scalability, and maintainability in all architectural suggestions.
Clarity & Structure: Break down complex problems into logical steps. Use code blocks for snippets and markdown tables for comparing technical approaches.
Debugging Mindset: When provided with errors, analyze the root cause before offering the fix, and explain why the solution works.
Language & Tone: Maintain a professional, objective, and helpful tone. Be direct and concise, avoiding unnecessary fluff.
Constraints:
Always provide context-aware code; if multiple languages or frameworks are applicable, suggest the best fit with reasoning.
Ensure all code snippets are complete, syntactically correct, and follow the latest stable versions of the requested technologies.
If a user request is ambiguous, ask for necessary technical specifications before proceeding to ensure the output meets the requirements.
Formatting Standards:
Use standard Markdown for all responses.
Use LaTeX for any mathematical notations or algorithmic complexity analysis (e.g., Big O notation).
For complex architectural patterns, describe the flow clearly using structured lists.
"""

    if is_search:
        search_context = ""
        scraped_data = web_search_scraper(user_message, user_address=user_address)
        news_data = get_live_web_data(user_message)
        if scraped_data:
            search_context += "\n\n--- [LIVE GOOGLE SEARCH] ---\n"
            for idx, res in enumerate(scraped_data):
                search_context += f"{idx+1}. {res['title']}: {res['snippet']} (URL: {res['link']})\n"
        if news_data:
            search_context += "\n--- [LIVE TECH NEWS] ---\n"
            for idx, res in enumerate(news_data):
                search_context += f"{idx+1}. {res['title']}: {res['snippet']} (URL: {res['link']})\n"
        if search_context:
            user_message = f"{user_message}\n{search_context}\n[COMMAND: Base your final answer strictly on the facts provided above.]"

    messages = [{"role": "system", "content": system_prompt}]

    for msg in history:
        if msg == history[-1] and msg.get("role") == "user":
            continue
        role = msg.get("role", "user")
        if role not in ["system", "user", "assistant"]:
            role = "user"
        content = msg.get("content", "")
        if isinstance(content, list):
            text_parts = [item["text"] for item in content if item.get("type") == "text"]
            content = " ".join(text_parts)
        if "Gemma" in content or "DeepMind" in content or "Google" in content:
            continue
        if content:
            messages.append({"role": role, "content": str(content)})

    if attachments:
        content_payload = [{"type": "text", "text": user_message}]
        for att in attachments:
            att_type = att.get("type")
            b64_data = att.get("data")
            if att_type == "image":
                content_payload.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_data}"}})
        messages.append({"role": "user", "content": content_payload})
    else:
        messages.append({"role": "user", "content": user_message})

    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}", 
        "Accept": "text/event-stream",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": MODEL_ID,
        "messages": messages,
        "max_tokens": 128000,
        "temperature": 1.0,
        "top_p": 0.95,
        "stream": True
    }

    try:
        response = requests.post(INVOKE_URL, headers=headers, json=payload, stream=True, timeout=60)
        if response.status_code != 200:
            err_text = response.text[:200]
            err_msg = json.dumps({"error": f"API Error {response.status_code}: {err_text}"})
            return Response(f"data: {err_msg}\n\n", mimetype='text/event-stream')

        def generate():
            for line in response.iter_lines():
                if line:
                    decoded = line.decode("utf-8")
                    if decoded.startswith("data: ") and "[DONE]" not in decoded:
                        try:
                            data_json = json.loads(decoded[6:])
                            if "choices" in data_json and len(data_json["choices"]) > 0:
                                delta = data_json["choices"][0].get("delta", {})
                                if "content" in delta and delta["content"]:
                                    content = delta["content"]
                                    content = content.replace("<|channel|>thought <|channel|>", "<think>\n")
                                    content = content.replace("<|channel|>answer <|channel|>", "\n</think>\n")
                                    delta["content"] = content
                            yield "data: " + json.dumps(data_json) + "\n\n"
                        except Exception:
                            yield decoded + "\n\n"
                    else:
                        yield decoded + "\n\n"
                        
        return Response(stream_with_context(generate()), mimetype='text/event-stream')
    except Exception as e:
        err_msg = json.dumps({"error": str(e)})
        return Response(f"data: {err_msg}\n\n", mimetype='text/event-stream')

# ----------------------------------------------------
# TTS DIRECT API ENDPOINT
# ----------------------------------------------------
@app.route('/api/tts', methods=['POST'])
def generate_tts():
    if tts is None:
        return Response(json.dumps({"error": "TTS model failed to load on server."}), status=500, mimetype='application/json')
    
    data = request.get_json() or {}
    text = data.get("text", "")
    voice = data.get("voice", "M2")
    language_name = data.get("language_name", "English")
    
    if not text.strip():
        return Response(json.dumps({"error": "Text is empty."}), status=400, mimetype='application/json')

    try:
        lang_code = LANGUAGES.get(language_name, "en")
        if voice not in VOICE_STYLES_CACHE:
            VOICE_STYLES_CACHE[voice] = tts.get_voice_style(voice_name=voice)
        style = VOICE_STYLES_CACHE[voice]
        if style is None:
            return Response(json.dumps({"error": f"Voice '{voice}' not available."}), status=400, mimetype='application/json')
        
        wav, duration = tts.synthesize(text, voice_style=style, lang=lang_code)
        
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
            tmp_path = tmp_file.name
        tts.save_audio(wav, tmp_path)
        
        with open(tmp_path, 'rb') as f:
            audio_data = f.read()
        os.unlink(tmp_path)
        
        return Response(audio_data, mimetype="audio/wav")
    except Exception as e:
        print(f"TTS Synthesis Error: {e}")
        return Response(json.dumps({"error": f"TTS synthesis failed: {str(e)}"}), status=500, mimetype='application/json')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=7860)
