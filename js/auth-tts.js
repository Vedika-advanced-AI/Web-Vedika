// ==========================================================================
// CODE VED - AUTHENTICATION & TTS LOGIC (Engineered by Divy Patel)
// ==========================================================================
import { State, UI } from './main.js';

// आपका Google Apps Script URL
const Config = {
    GAS_URL: "https://script.google.com/macros/s/AKfycbzNO3inVc33ImhfLyde-JjjK9ZlPckLBksqCnCzelfhcklX6mp8KW8vfPTW4oWJTCcN/exec"
};

// ==========================================
// 0. CUSTOM CONFIRM BOX
// ==========================================
export function customConfirm(message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('customConfirmOverlay');
        const msgEl = document.getElementById('customConfirmMsg');
        const cancelBtn = document.getElementById('customConfirmCancel');
        const okBtn = document.getElementById('customConfirmOk');
        
        if(!overlay) return resolve(confirm(message)); // फॉलबैक

        msgEl.textContent = message;
        overlay.style.display = 'flex';
        
        function cleanup() { 
            overlay.style.display = 'none'; 
            cancelBtn.removeEventListener('click', onCancel); 
            okBtn.removeEventListener('click', onOk); 
        }
        
        function onCancel() { cleanup(); resolve(false); }
        function onOk() { cleanup(); resolve(true); }
        
        cancelBtn.addEventListener('click', onCancel);
        okBtn.addEventListener('click', onOk);
    });
}
window.customConfirm = customConfirm;

// ==========================================
// 1. AUTHENTICATION MANAGER (Login/Register)
// ==========================================
export const Auth = {
    // UI Helpers for Auth (Self-contained)
    showAuthMsg(msg, isError = true) {
        const el = document.getElementById('authMsg'); 
        if(!el) return;
        el.innerText = msg; 
        el.style.color = isError ? 'var(--brand-danger)' : 'var(--brand-success)';
        setTimeout(() => el.innerText = '', 4000);
    },
    
    updateUserInfo(name, email) {
        if (name) { 
            State.name = name; 
            localStorage.setItem('codeved_name', name); 
        }
        const dispName = State.name || email.split('@')[0];
        if(document.getElementById('uAv')) document.getElementById('uAv').innerText = dispName.charAt(0).toUpperCase();
        if(document.getElementById('uName')) document.getElementById('uName').innerText = dispName;
        if(document.getElementById('uSub')) document.getElementById('uSub').innerText = email;
        if(document.getElementById('btnLogout')) document.getElementById('btnLogout').style.display = 'flex';
        if(document.getElementById('btnDeleteAcc')) document.getElementById('btnDeleteAcc').style.display = 'flex';
        if(document.getElementById('btnLoginRegister')) document.getElementById('btnLoginRegister').style.display = 'none';
        if(document.getElementById('welcomeTitle')) document.getElementById('welcomeTitle').innerHTML = `Hello, ${dispName}!<br>How can I help you today?`;
    },

    init() {
        if (State.user) { 
            this.updateUserInfo(State.name, State.user); 
            if(window.HistoryManager) window.HistoryManager.syncAllChats(); 
        } else {
            if(document.getElementById('uAv')) document.getElementById('uAv').innerText = "G"; 
            if(document.getElementById('uName')) document.getElementById('uName').innerText = "Guest Mode"; 
            if(document.getElementById('uSub')) document.getElementById('uSub').innerText = `Queries: ${State.guestCount}/10`;
            if(document.getElementById('btnLogout')) document.getElementById('btnLogout').style.display = 'none'; 
            if(document.getElementById('btnDeleteAcc')) document.getElementById('btnDeleteAcc').style.display = 'none'; 
            if(document.getElementById('btnLoginRegister')) document.getElementById('btnLoginRegister').style.display = 'inline-flex';
            if(document.getElementById('welcomeTitle')) document.getElementById('welcomeTitle').innerHTML = `Hello, Guest!<br>How can I help you today?`;
        }
    },
    
    async handleLogout() { 
        const ok = await customConfirm("Are you sure you want to logout?"); 
        if (ok) { 
            localStorage.removeItem('codeved_user'); 
            localStorage.removeItem('codeved_name'); 
            location.reload(); 
        } 
    },
    
    async handleDeleteAccount() { 
        const ok = await customConfirm("Are you sure you want to permanently delete your account and all data?"); 
        if (ok) { 
            try {
                await fetch(Config.GAS_URL, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: "delete_account", email: State.user }) 
                });
            } catch(e) {
                console.error("Account delete error:", e);
            } finally {
                localStorage.removeItem('codeved_user'); 
                localStorage.removeItem('codeved_name'); 
                location.reload(); 
            }
        } 
    },
    
    openModal() { 
        document.getElementById('authModal').style.display = 'flex'; 
    },
    
    closeModal() { 
        document.getElementById('authModal').style.display = 'none'; 
    },
    
    switchTab(tab) {
        document.getElementById('tabLogin').classList.remove('active'); 
        document.getElementById('tabRegister').classList.remove('active');
        document.getElementById('flowLogin').style.display = 'none'; 
        document.getElementById('flowRegister').style.display = 'none';
        
        if (tab === 'login') { 
            document.getElementById('tabLogin').classList.add('active'); 
            document.getElementById('flowLogin').style.display = 'block'; 
        } else { 
            document.getElementById('tabRegister').classList.add('active'); 
            document.getElementById('flowRegister').style.display = 'block'; 
        }
    },
    
    switchPhase(from, to) { 
        document.getElementById(from).classList.remove('active'); 
        document.getElementById(to).classList.add('active'); 
    },
    
    async process(action) {
        let payload = { action: action }; 
        let btnId = '';
        
        if (action === 'register_send_otp') {
            payload.name = document.getElementById('regName').value.trim(); 
            payload.email = document.getElementById('regEmail').value.trim();
            payload.phone = "0000000000"; 
            payload.organization = "CODE VED";
            if (!payload.name || !payload.email) return this.showAuthMsg("Details missing."); 
            btnId = 'btnRegOtp';
        } else if (action === 'login_send_otp') {
            payload.email = document.getElementById('logEmail').value.trim();
            if (!payload.email) return this.showAuthMsg("Email required."); 
            btnId = 'btnLogOtp';
        } else if (action === 'register_verify' || action === 'login_verify') {
            payload.email = document.getElementById(action === 'register_verify' ? 'regEmail' : 'logEmail').value.trim();
            payload.otp = document.getElementById(action === 'register_verify' ? 'regOtp' : 'logOtp').value.trim();
            if (!payload.otp) return this.showAuthMsg("OTP required."); 
            btnId = action === 'register_verify' ? 'btnRegVerify' : 'btnLogVerify';
        }
        
        const btn = document.getElementById(btnId); 
        const originalText = btn.innerText;
        btn.disabled = true; 
        btn.innerText = "Wait...";
        
        try {
            const res = await fetch(Config.GAS_URL, { 
                method: 'POST', 
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload) 
            });
            
            const textResponse = await res.text();
            let data;
            try {
                data = JSON.parse(textResponse);
            } catch (parseErr) {
                this.showAuthMsg("Invalid response from server. Network error.");
                btn.disabled = false; 
                btn.innerText = originalText;
                return;
            }
            
            if (data.status === 'success') {
                this.showAuthMsg(data.message, false);
                if (action === 'register_send_otp') {
                    this.switchPhase('regPhase1', 'regPhase2');
                } else if (action === 'login_send_otp') {
                    this.switchPhase('loginPhase1', 'loginPhase2');
                } else { 
                    localStorage.setItem('codeved_user', payload.email); 
                    if (data.user && data.user.name) {
                        localStorage.setItem('codeved_name', data.user.name); 
                    }
                    location.reload(); 
                }
            } else {
                this.showAuthMsg(data.message);
            }
        } catch (e) { 
            this.showAuthMsg("Network Error. Please try again."); 
        }
        
        btn.disabled = false; 
        btn.innerText = originalText;
    }
};

// ==========================================
// 2. TEXT-TO-SPEECH (TTS) MANAGER
// ==========================================
export const TTSManager = {
    cache: {}, 
    currentAudio: null, 
    selectedVoice: "M2", 
    selectedLanguage: "English", 
    isPlaying: false, 
    currentMsgId: null, 
    currentBtnElement: null, 
    preparingSet: new Set(),
    
    voiceMap: { 
        "M1": "Aarav", "M2": "Kabir", "M3": "Vihaan", "M4": "Advik", "M5": "Rohan", 
        "F1": "Priya", "F2": "Ananya", "F3": "Diya", "F4": "Sneha", "F5": "Kavya" 
    },
    
    languageMap: { 
        "English": "en", "Korean": "ko", "Japanese": "ja", "Arabic": "ar", "Bulgarian": "bg", 
        "Czech": "cs", "Danish": "da", "German": "de", "Greek": "el", "Spanish": "es", 
        "Estonian": "et", "Finnish": "fi", "French": "fr", "Hindi": "hi", "Croatian": "hr", 
        "Hungarian": "hu", "Indonesian": "id", "Italian": "it", "Lithuanian": "lt", "Latvian": "lv", 
        "Dutch": "nl", "Polish": "pl", "Portuguese": "pt", "Romanian": "ro", "Russian": "ru", 
        "Slovak": "sk", "Slovenian": "sl", "Swedish": "sv", "Turkish": "tr", "Ukrainian": "uk", 
        "Vietnamese": "vi" 
    },
    
    initUI() {
        const list = document.getElementById('voiceOptionsList'); 
        if(!list) return;
        list.innerHTML = '';
        
        for (const [code, name] of Object.entries(this.voiceMap)) {
            const isSelected = code === this.selectedVoice ? 'selected' : '';
            const checkIcon = isSelected ? `<svg style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>` : `<div></div>`;
            list.innerHTML += `<div class="dropdown-item ${isSelected}" onclick="TTSManager.setVoice('${code}')"><span>${name}</span>${checkIcon}</div>`;
        }
        
        const langList = document.getElementById('languageOptionsList'); 
        if(langList) {
            langList.innerHTML = '';
            for (const [name, code] of Object.entries(this.languageMap)) {
                const isSelected = name === this.selectedLanguage ? 'selected' : '';
                const checkIcon = isSelected ? `<svg style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>` : `<div></div>`;
                langList.innerHTML += `<div class="dropdown-item ${isSelected}" onclick="TTSManager.setLanguage('${name}')"><span>${name}</span>${checkIcon}</div>`;
            }
        }
    },
    
    toggleMenu() { 
        document.getElementById('voiceMenu').classList.toggle('active'); 
        if(document.getElementById('attachMenu')) document.getElementById('attachMenu').classList.remove('active'); 
        if(document.getElementById('thinkMenu')) document.getElementById('thinkMenu').classList.remove('active'); 
    },
    
    setVoice(code) { 
        Object.values(this.cache).forEach(url => URL.revokeObjectURL(url)); 
        this.cache = {}; 
        this.selectedVoice = code; 
        this.initUI(); 
        document.getElementById('voiceMenu').classList.remove('active'); 
    },
    
    setLanguage(name) { 
        Object.values(this.cache).forEach(url => URL.revokeObjectURL(url)); 
        this.cache = {}; 
        this.selectedLanguage = name; 
        this.initUI(); 
        document.getElementById('voiceMenu').classList.remove('active'); 
    },
    
    cleanTextForTTS(text) {
        let cleaned = text.replace(/\u0060{3}[\s\S]*?\u0060{3}/g, '')
                          .replace(/\u0060[^\u0060]*\u0060/g, '')
                          .replace(/<think>[\s\S]*?<\/think>/gi, '')
                          .replace(/https?:\/\/[^\s]+/g, '')
                          .replace(/[*_#\u0060~>]/g, '')
                          .replace(/<[^>]*>/g, '')
                          .replace(/\s+/g, ' ')
                          .trim();
                          
        cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]/gu, '')
                         .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
                         .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
                         .replace(/[\u{2600}-\u{26FF}]/gu, '')
                         .replace(/[\u{2700}-\u{27BF}]/gu, '');
                         
        if (cleaned.length > 1500) {
            cleaned = cleaned.substring(0, 1500) + '...'; 
        }
        return cleaned;
    },
    
    async autoPrepare(msgId, fullText, btnElement) {
        if (this.preparingSet.has(msgId)) return;
        
        const cleanText = this.cleanTextForTTS(fullText); 
        if (!cleanText) { 
            btnElement.style.display = 'none'; 
            return; 
        }
        
        this.preparingSet.add(msgId);
        btnElement.style.display = 'flex'; 
        btnElement.innerHTML = `<svg class="spin-icon" style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg> Preparing...`;
        btnElement.style.pointerEvents = 'none';
        
        try {
            const response = await fetch('/api/tts', { 
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify({ 
                    text: cleanText, 
                    voice: this.selectedVoice, 
                    language_name: this.selectedLanguage 
                }) 
            });
            
            if (!response.ok) throw new Error('TTS service unavailable');
            
            const blob = await response.blob(); 
            this.cache[msgId] = URL.createObjectURL(blob);
            
            btnElement.innerHTML = `<svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg> Listen`;
            btnElement.style.pointerEvents = 'auto';
        } catch(e) { 
            btnElement.innerHTML = `<span style="color:var(--brand-danger);">⚠️ ${e.message}</span>`; 
            setTimeout(() => { btnElement.style.display = 'none'; }, 4000); 
        } finally { 
            this.preparingSet.delete(msgId); 
        }
    },
    
    play(msgId, btnElement) {
        const audioUrl = this.cache[msgId];
        if (!audioUrl) { 
            this.autoPrepare(msgId, document.getElementById(`bot-content-${msgId}`).innerText, btnElement); 
            return; 
        }
        
        if (this.isPlaying && this.currentMsgId === msgId) {
            if (this.currentAudio) { 
                this.currentAudio.pause(); 
                this.currentAudio.currentTime = 0; 
            }
            this.isPlaying = false; 
            this.currentMsgId = null;
            btnElement.innerHTML = `<svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg> Listen`;
            btnElement.style.background = ''; 
            return;
        }
        
        if (this.currentAudio) { 
            this.currentAudio.pause(); 
            this.currentAudio.currentTime = 0; 
        }
        
        this.isPlaying = true; 
        this.currentMsgId = msgId; 
        this.currentBtnElement = btnElement;
        
        const originalHTML = btnElement.innerHTML;
        btnElement.innerHTML = `<svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> Playing...`;
        btnElement.style.background = 'rgba(211, 227, 253, 0.9)';
        
        this.currentAudio = new Audio(audioUrl); 
        this.currentAudio.playbackRate = 1.15;
        
        this.currentAudio.onended = () => { 
            this.isPlaying = false; 
            this.currentMsgId = null; 
            btnElement.innerHTML = originalHTML; 
            btnElement.style.background = ''; 
        };
        
        this.currentAudio.onerror = () => { 
            this.isPlaying = false; 
            this.currentMsgId = null; 
            btnElement.innerHTML = originalHTML; 
            btnElement.style.background = ''; 
        };
        
        this.currentAudio.play();
    }
};

// ==========================================
// 3. EXPORT TO GLOBAL WINDOW OBJECT (CRITICAL FIX)
// ==========================================
window.Auth = Auth;
window.TTSManager = TTSManager;
