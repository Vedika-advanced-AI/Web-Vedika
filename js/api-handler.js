// ==========================================================================
// CODE VED - API HANDLER & CORE LOGIC (Engineered by Divy Patel)
// ==========================================================================
import { State, DOM, UI } from './main.js';

export const Config = {
    API_ENDPOINT: "/api/chat",
    LOGO: "logo.png"
};

// ==========================================
// 1. ENVIRONMENT & GPS MANAGER
// ==========================================
export const EnvironmentManager = {
    init() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    State.location = { lat: position.coords.latitude, lon: position.coords.longitude };
                    console.log("GPS Location Fetched:", State.location);
                },
                (error) => console.warn("GPS Permission Denied or Unavailable.")
            );
        }
    }
};

// ==========================================
// 2. SEARCH & THINKING MANAGERS
// ==========================================
export const SearchManager = {
    toggle() {
        State.searchEnabled = !State.searchEnabled;
        const btn = document.getElementById('btnSearch');
        if (btn) {
            State.searchEnabled ? btn.classList.add('active') : btn.classList.remove('active');
            btn.style.color = State.searchEnabled ? 'var(--brand-accent)' : '';
        }
        console.log("Search Mode:", State.searchEnabled);
    }
};

export const ThinkingManager = {
    toggle() {
        State.thinkingMode = !State.thinkingMode;
        const btn = document.getElementById('btnThink');
        if (btn) {
            State.thinkingMode ? btn.classList.add('active') : btn.classList.remove('active');
            btn.style.color = State.thinkingMode ? '#10b981' : '';
        }
        console.log("Thinking Mode:", State.thinkingMode);
    }
};

// ==========================================
// 3. FILE SYSTEM (Attachments)
// ==========================================
export const FileSys = {
    triggerUpload(type) {
        if (type === 'image') document.getElementById('imgUpload').click();
        if (type === 'document') document.getElementById('docUpload').click();
    },
    handleFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        State.attachment = file;
        
        // UI में फाइल का नाम दिखाना
        const attachPreview = document.getElementById('attachPreview') || document.createElement('div');
        attachPreview.id = 'attachPreview';
        attachPreview.innerHTML = `📎 ${file.name} <button onclick="FileSys.clearFile()">❌</button>`;
        if(DOM.mainInput) DOM.mainInput.parentElement.appendChild(attachPreview);
        
        // अटैचमेंट मेनू बंद करना
        const menu = document.getElementById('attachMenu');
        if(menu) menu.classList.remove('active');
    },
    clearFile() {
        State.attachment = null;
        const preview = document.getElementById('attachPreview');
        if(preview) preview.remove();
        document.getElementById('imgUpload').value = '';
        document.getElementById('docUpload').value = '';
    }
};

// ==========================================
// 4. SPEECH TO TEXT (Mic)
// ==========================================
export const Speech = {
    recognition: null,
    isListening: false,
    init() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            
            this.recognition.onstart = () => {
                this.isListening = true;
                if(DOM.btnMic) {
                    DOM.btnMic.classList.add('active');
                    DOM.btnMic.style.color = 'red';
                }
            };
            
            this.recognition.onresult = (event) => {
                let text = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    text += event.results[i][0].transcript;
                }
                if(DOM.mainInput) DOM.mainInput.value = text;
            };
            
            this.recognition.onend = () => {
                this.isListening = false;
                if(DOM.btnMic) {
                    DOM.btnMic.classList.remove('active');
                    DOM.btnMic.style.color = '';
                }
            };
        }
    },
    toggle() {
        if (!this.recognition) this.init();
        if (!this.recognition) return alert("Speech recognition not supported in this browser.");
        
        if (this.isListening) {
            this.recognition.stop();
        } else {
            this.recognition.start();
        }
    }
};

// ==========================================
// 5. MAIN CHAT ENGINE
// ==========================================
export const Chat = {
    async handleSend() {
        if (State.isProcessing) return;
        const text = DOM.mainInput ? DOM.mainInput.value.trim() : '';
        
        if (!text && !State.attachment) return;

        // UI रिसेट करें
        if(DOM.mainInput) {
            DOM.mainInput.value = '';
            DOM.mainInput.style.height = 'auto';
        }
        if(DOM.welcomeScreen) DOM.welcomeScreen.style.display = 'none';

        // यूज़र का मैसेज रेंडर करें
        let attachUI = '';
        if (State.attachment) attachUI = `<div class="attachment-chip">📎 ${State.attachment.name}</div>`;
        this.renderUser(text, attachUI);
        
        // स्टेट अपडेट
        State.history.push({ role: 'user', content: text });
        State.isProcessing = true;
        
        // बॉट का डमी UI रेंडर करें (जहाँ रिस्पॉन्स स्ट्रीम होगा)
        const msgId = Date.now().toString();
        const botObj = this.renderBot(msgId);
        
        try {
            // API Call (स्ट्रीमिंग के साथ)
            const payload = {
                message: text,
                history: State.history.slice(-6), // पिछले 6 मैसेज की हिस्ट्री
                search: State.searchEnabled,
                thinking: State.thinkingMode,
                location: State.location
            };

            const response = await fetch(Config.API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("Server disconnected");

            // स्ट्रीम रीडर
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let fullText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                
                for (let line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.replace('data: ', '').trim();
                        if (dataStr === '[DONE]') break;
                        try {
                            const json = JSON.parse(dataStr);
                            if (json.choices && json.choices[0].delta.content) {
                                fullText += json.choices[0].delta.content;
                                botObj.contentDiv.innerHTML = UI.escape(fullText); // रियल-टाइम रेंडर
                            }
                        } catch(e) {}
                    }
                }
            }

            State.history.push({ role: 'assistant', content: fullText });
            
            // TTS (Listen Button) एक्टिवेट करना
            if (window.TTSManager && botObj.listenBtn && fullText.trim().length > 0) {
                window.TTSManager.autoPrepare(msgId, fullText, botObj.listenBtn);
            }

        } catch (error) {
            botObj.contentDiv.innerHTML += `<br><span style="color:var(--brand-danger);">⚠️ ${error.message}</span>`;
        } finally {
            State.isProcessing = false;
            FileSys.clearFile(); // फाइल क्लियर करें
            UI.scrollToBottom(true);
        }
    },

    renderUser(text, attachUI) {
        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper user';
        wrapper.innerHTML = `<div class="user-message">${attachUI}${UI.escape(text)}</div>`;
        DOM.chatMessages.appendChild(wrapper);
        UI.scrollToBottom(true);
    },

    renderBot(msgId) {
        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper bot';
        
        const listenIcon = `<svg viewBox="0 0 24 24" class="icon" style="width:14px;height:14px;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon></svg> Listen`;
        const copyIcon = `<svg viewBox="0 0 24 24" class="icon" style="width:14px;height:14px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy`;
        
        wrapper.innerHTML = `
            <div class="bot-message">
                <div class="bot-content" id="bot-content-${msgId}">
                    <span class="loading-dots">Thinking...</span>
                </div>
                <div class="bot-actions">
                    <button class="action-btn" onclick="navigator.clipboard.writeText(document.getElementById('bot-content-${msgId}').innerText)">${copyIcon}</button>
                    <button class="action-btn" id="listen-${msgId}" onclick="TTSManager.play('${msgId}', this)" style="display:none;">${listenIcon}</button>
                </div>
            </div>
        `;
        DOM.chatMessages.appendChild(wrapper);
        UI.scrollToBottom(true);
        
        return {
            contentDiv: wrapper.querySelector('.bot-content'),
            listenBtn: wrapper.querySelector(`#listen-${msgId}`)
        };
    }
};

// ==========================================
// 6. HISTORY MANAGER (Sidebar)
// ==========================================
export const HistoryManager = {
    load() {
        // पुरानी हिस्ट्री लोड करने का असली लॉजिक
        console.log("History Loaded.");
    }
};

// ==========================================
// 7. GLOBAL EXPORT (CRITICAL FIX)
// ==========================================
// यह हिस्सा बहुत ज़रूरी है ताकि आपके HTML के "onclick" एट्रिब्यूट्स काम करें।
window.EnvironmentManager = EnvironmentManager;
window.SearchManager = SearchManager;
window.ThinkingManager = ThinkingManager;
window.FileSys = FileSys;
window.Speech = Speech;
window.HistoryManager = HistoryManager;
window.Chat = Chat;

// शुरुआत में GPS चेक करें
window.addEventListener('DOMContentLoaded', () => {
    EnvironmentManager.init();
});
