// ==========================================================================
// CODE VED - AUTHENTICATION & TTS LOGIC (Engineered by Divy Patel)
// ==========================================================================
import { State, UI, DOM } from './main.js';

// आपका Google Apps Script URL
const GAS_URL = "https://script.google.com/macros/s/AKfycbzNO3inVc33ImhfLyde-JjjK9ZlPckLBksqCnCzelfhcklX6mp8KW8vfPTW4oWJTCcN/exec";

// ==========================================
// 1. AUTHENTICATION MANAGER (Login/Register)
// ==========================================
export const Auth = {
    // कस्टम कन्फर्मेशन डायलॉग
    customConfirm(message) {
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
    },

    async handleLogout() { 
        const ok = await this.customConfirm("Are you sure you want to logout?"); 
        if (ok) { 
            localStorage.removeItem('codeved_user'); 
            localStorage.removeItem('codeved_name'); 
            location.reload(); 
        } 
    },
    
    async handleDeleteAccount() { 
        const ok = await this.customConfirm("Are you sure you want to permanently delete your account and all data?"); 
        if (ok) { 
            try {
                await fetch(GAS_URL, { 
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
    
    openModal() { document.getElementById('authModal').style.display = 'flex'; },
    closeModal() { document.getElementById('authModal').style.display = 'none'; },
    
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
            const res = await fetch(GAS_URL, { 
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
    },

    showAuthMsg(msg, isError = true) {
        const el = document.getElementById('authMsg'); 
        if(el) {
            el.innerText = msg; 
            el.style.color = isError ? '#ef4444' : '#10b981'; // Red or Green
            setTimeout(() => el.innerText = '', 4000);
        } else {
            alert(msg);
        }
    }
};

// ==========================================
// 2. TTS MANAGER (Supertonic Audio)
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
        "English": "en", "Hindi": "hi", "Spanish": "es", "French": "fr", "German": "de", "Japanese": "ja" 
        // आपके पुराने कोड में मौजूद बाकी भाषाएँ भी यहाँ सपोर्टेड हैं
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
                         .replace(/[\u{1F680}-\u{1F6FF}]/gu, '');
                         
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
        btnElement.innerHTML = `⏳ Preparing...`;
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
            
            btnElement.innerHTML = `<svg viewBox="0 0 24 24" class="icon" style="width:14px;height:14px;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon></svg> Listen`;
            btnElement.style.pointerEvents = 'auto';
        } catch(e) { 
            btnElement.innerHTML = `<span style="color:#ef4444;">⚠️ Error</span>`; 
            setTimeout(() => { btnElement.style.display = 'none'; }, 4000); 
        } finally { 
            this.preparingSet.delete(msgId); 
        }
    },
    
    play(msgId, btnElement) {
        const audioUrl = this.cache[msgId];
        if (!audioUrl) { 
            const contentEl = document.getElementById(`bot-content-${msgId}`);
            if(contentEl) this.autoPrepare(msgId, contentEl.innerText, btnElement); 
            return; 
        }
        
        if (this.isPlaying && this.currentMsgId === msgId) {
            if (this.currentAudio) { 
                this.currentAudio.pause(); 
                this.currentAudio.currentTime = 0; 
            }
            this.isPlaying = false; 
            this.currentMsgId = null;
            btnElement.innerHTML = `<svg viewBox="0 0 24 24" class="icon" style="width:14px;height:14px;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon></svg> Listen`;
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
        btnElement.innerHTML = `🔊 Playing...`;
        
        this.currentAudio = new Audio(audioUrl); 
        this.currentAudio.playbackRate = 1.15;
        
        this.currentAudio.onended = () => { 
            this.isPlaying = false; 
            this.currentMsgId = null; 
            btnElement.innerHTML = originalHTML; 
        };
        
        this.currentAudio.onerror = () => { 
            this.isPlaying = false; 
            this.currentMsgId = null; 
            btnElement.innerHTML = originalHTML; 
        };
        
        this.currentAudio.play();
    }
};

// HTML में सीधे कॉल (onclick) के लिए इन्हें window ऑब्जेक्ट में डालें
window.Auth = Auth;
window.TTSManager = TTSManager;
