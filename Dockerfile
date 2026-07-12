# हल्का और तेज़ Python 3.10 बेस इमेज
FROM python:3.10-slim

# सिस्टम डिपेंडेंसी इंस्टॉल करें (Git गिटहब पैकेजेस के लिए और FFmpeg ऑडियो प्रोसेसिंग के लिए)
RUN apt-get update && apt-get install -y \
    git \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# कंटेनर के अंदर वर्किंग डायरेक्टरी सेट करें
WORKDIR /app

# पहले requirements.txt कॉपी करें (ताकि डॉकर कैश का फायदा मिल सके)
COPY requirements.txt .

# पाइथन पैकेजेस इंस्टॉल करें
RUN pip install --no-cache-dir -r requirements.txt

# अब बाकी का सारा कोड (HTML, CSS, JS, app.py, logo.png) कॉपी करें
COPY . .

# Flask ऐप जिस पोर्ट पर चल रहा है (app.py में 7860 दिया है), उसे एक्सपोज़ करें
EXPOSE 7860

# ऐप को रन करने की कमांड
CMD ["python", "app.py"]
