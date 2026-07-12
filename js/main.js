// ==========================================================================
// CODE VED - MAIN JAVASCRIPT HUB (Engineered by Divy Patel)
// ==========================================================================

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

// 3. UI CONTROLLER (यूज़र इंटरफेस के फंक्शन)
export const UI = {
    autoScroll: true,
    
    // साइडबार को मोबाइल और डेस्कटॉप पर कंट्रोल करना
    toggleSidebar() {
        DOM.sidebar.classList.toggle('collapsed');
        if (window.innerWidth <= 900) {
            const isCollapsed = DOM.sidebar.classList.contains('collapsed');
            DOM.mobileOverlay.style.display = isCollapsed ? 'none' : 'block';
        }
    },

    // टाइप करते समय टेक्स्ट बॉक्स का साइज़ अपने आप बढ़ाना
    autoGrowInput() {
        DOM.mainInput.style.height = 'auto';
        DOM.mainInput.style.height = Math.min(DOM.mainInput.scrollHeight, 200) + 'px';
    },

    // चैट में सबसे नीचे स्क्रॉल करना
    scrollToBottom(force = false) {
        if (force || this.autoScroll) {
            const container = document.querySelector('.chat-thread-container');
            if(container) {
                container.scrollTop = container.scrollHeight;
            }
        }
    },

    // वेलकम स्क्रीन को हटाकर चैट थ्रेड दिखाना
    updateWelcomeScreen() {
        if (State.history.length === 0) {
            DOM.welcomeScreen.classList.remove('hidden');
            DOM.chatMessages.classList.add('hidden');
        } else {
            DOM.welcomeScreen.classList.add('hidden');
            DOM.chatMessages.classList.remove('hidden');
        }
    },

    // HTML एस्केप फंक्शन (सिक्योरिटी के लिए)
    escape(s) { 
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); 
    }
};

// 4. EVENT LISTENERS SETUP
function setupEventListeners() {
    // साइडबार इवेंट्स
    DOM.openSidebarBtn?.addEventListener('click', UI.toggleSidebar);
    DOM.closeSidebarBtn?.addEventListener('click', UI.toggleSidebar);
    DOM.mobileOverlay?.addEventListener('click', UI.toggleSidebar);
    
    // इनपुट बॉक्स इवेंट्स
    DOM.mainInput?.addEventListener('input', UI.autoGrowInput);
    
    // Enter दबाने पर मैसेज सेंड करना (Shift+Enter से नई लाइन)
    DOM.mainInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            // Chat.handleSend(); <-- यह फंक्शन हम api-handler.js में बनाएंगे
            console.log("Send Triggered! (API Handler will take over)");
        }
    });

    DOM.btnSend?.addEventListener('click', () => {
        // Chat.handleSend(); <-- यह फंक्शन हम api-handler.js में बनाएंगे
        console.log("Send Button Clicked!");
    });
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
    } else {
        if(DOM.uSub) DOM.uSub.innerText = `Queries: ${State.guestCount}/10`;
    }
});

// ग्लोबल स्कोप में एक्सपोज़ करें (ताकि HTML में onclick काम कर सके)
window.UI = UI;
window.State = State;
