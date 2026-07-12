// ==========================================================================
// CODE VED - MAIN JAVASCRIPT HUB (Engineered by Divy Patel)
// ==========================================================================

// 0. IMPORTS (यहीं पर आपका मुख्य फिक्स है - दूसरी फाइलों से कनेक्शन)
import { Chat } from './api-handler.js';
import { Auth } from './auth-tts.js';

// 1. GLOBAL STATE MANAGEMENT (पुराने प्रोजेक्ट के सभी फीचर्स सुरक्षित)
export const State = {
    user: localStorage.getItem('codeved_user') || null,
    name: localStorage.getItem('codeved_name') || null,
    guestCount: parseInt(localStorage.getItem('codeved_guest') || '0', 10) || 0,
    attachment: null,
    isProcessing: false,
    history: [],
    currentThreadId: null,
    currentTitle: null,
    abortController: null,
    location: null,
    weatherContext: null,
    thinkingMode: false,
    thinkingEffort: "medium",
    searchEnabled: false,
    lastUserMessage: null
};

// 2. DOM ELEMENTS CACHING (परफॉरमेंस के लिए)
export const DOM = {
    sidebar: document.getElementById('sidebar'),
    openSidebarBtn: document.getElementById('openSidebar'),
    closeSidebarBtn: document.getElementById('closeSidebar'),
    mobileOverlay: document.getElementById('mobileOverlay'),
    
    mainInput: document.getElementById('mainInput'),
    btnTools: document.getElementById('btnTools'),
    btnMic: document.getElementById('btnMic'),
    btnSend: document.getElementById('btnSend'),
    
    welcomeScreen: document.getElementById('welcomeScreen'),
    chatMessages: document.getElementById('chatMessages'),
    
    uAv: document.getElementById('uAv'),
    uName: document.getElementById('uName'),
    uSub: document.getElementById('uSub'),
    btnLoginRegister: document.getElementById('btnLoginRegister')
};

// 3. UI UTILITIES
export const UI = {
    escape(s) { 
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); 
    },
    autoGrowInput() {
        if(!DOM.mainInput) return;
        DOM.mainInput.style.height = 'auto'; 
        DOM.mainInput.style.height = Math.min(DOM.mainInput.scrollHeight, 180) + 'px';
    },
    scrollToBottom(force = false) {
        if (!DOM.chatMessages) return;
        const container = DOM.chatMessages.parentElement; 
        if (force || this.autoScroll) { 
            container.scrollTop = container.scrollHeight; 
        } 
    },
    updateWelcomeScreen() {
        if(DOM.welcomeScreen) {
            DOM.welcomeScreen.style.display = State.history.length === 0 ? 'flex' : 'none';
        }
    }
};

// ग्लोबल स्कोप के लिए UI को एक्सपोज़ करें (ताकि HTML में लिखे onclick काम करें)
window.UI = UI;

// 4. EVENT LISTENERS SETUP
function setupEventListeners() {
    if(DOM.mainInput) {
        DOM.mainInput.addEventListener('input', UI.autoGrowInput);
        
        // Enter दबाने पर मैसेज सेंड करना (Shift+Enter से नई लाइन)
        DOM.mainInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                Chat.handleSend(); // <-- फिक्स: असली फंक्शन एक्टिवेट किया गया है
            }
        });
    }

    if(DOM.btnSend) {
        DOM.btnSend.addEventListener('click', () => {
            Chat.handleSend(); // <-- फिक्स: असली फंक्शन एक्टिवेट किया गया है
        });
    }
}

// 5. APP INITIALIZATION
window.addEventListener('DOMContentLoaded', () => {
    console.log("CODE VED UI Initialized.");
    setupEventListeners();
    
    // डेस्कटॉप पर साइडबार को डिफ़ॉल्ट रूप से खुला रखना
    if(window.innerWidth > 900 && DOM.sidebar) {
        DOM.sidebar.classList.remove('collapsed');
    }
    
    // अगर यूज़र लॉग इन है, तो उसका डेटा सेट करना
    if (State.user) {
        const dispName = State.name || State.user.split('@')[0];
        if(DOM.uAv) DOM.uAv.innerText = dispName.charAt(0).toUpperCase();
        if(DOM.uName) DOM.uName.innerText = dispName;
        if(DOM.uSub) DOM.uSub.innerText = State.user;
        if(DOM.btnLoginRegister) DOM.btnLoginRegister.innerText = "Logout";
    }
});
