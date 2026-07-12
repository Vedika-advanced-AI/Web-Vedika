// ==========================================================================
// CODE VED - API HANDLER & CHAT LOGIC (Engineered by Divy Patel)
// ==========================================================================
import { State, DOM, UI } from './main.js';

// कॉन्फ़िगरेशन (आपके पुराने app.py के अनुसार)
export const Config = {
    API_ENDPOINT: "/api/chat",
    LOGO: "logo.png" // आपका लोकल लोगो
};

export const Chat = {
    // 1. यूज़र का मैसेज UI में रेंडर करना
    renderUser(text, attachUI = '') {
        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper';
        wrapper.innerHTML = `
            <div class="user-message">
                ${attachUI}
                ${text ? UI.escape(text) : ''}
            </div>
        `;
        DOM.chatMessages.appendChild(wrapper);
        UI.scrollToBottom(true);
    },

    // 2. एआई (बॉट) का खाली ढांचा तैयार करना (स्ट्रीमिंग के लिए)
    renderBot(msgId) {
        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper';
        
        // कॉपी और लिसन बटन (आपके पुराने फीचर्स सुरक्षित हैं)
        const listenIcon = `<svg viewBox="0 0 24 24" class="icon"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
        const copyIcon = `<svg viewBox="0 0 24 24" class="icon"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
        
        wrapper.innerHTML = `
        <div class="bot-message">
            <div class="bot-avatar"><img src="${Config.LOGO}" alt="CODE VED"></div>
            <div class="flex-1 min-w-0">
                <div class="bot-content" id="bot-content-${msgId}"></div>
                <div class="flex gap-2 mt-3 opacity-0 hover:opacity-100 transition-opacity" style="opacity: 1;"> <button class="action-btn text-xs flex items-center gap-1 text-slate-500 hover:text-slate-800" id="listen-btn-${msgId}" onclick="TTSManager.play('${msgId}', this)" style="display:none;">${listenIcon} Listen</button>
                    <button class="action-btn text-xs flex items-center gap-1 text-slate-500 hover:text-slate-800" onclick="Chat.copyMsg('${msgId}')">${copyIcon} Copy</button>
                </div>
            </div>
        </div>`;
        
        DOM.chatMessages.appendChild(wrapper);
        UI.scrollToBottom();
        
        return { 
            contentDiv: document.getElementById(`bot-content-${msgId}`), 
            listenBtn: document.getElementById(`listen-btn-${msgId}`) 
        };
    },

    // 3. थिंकिंग बॉक्स को छिपाना और मार्कडाउन/मैथ को रेंडर करना
    parseAndRender(fullText, isProcessing, container) {
        // स्ट्रीमिंग के दौरान थिंकिंग टैग्स को नार्मलाइज़ करना
        let normalizedText = fullText
            .replace(/<\|channel\|>thought\s*<\|channel\|>/gi, "<think>\n")
            .replace(/<\|channel\|>answer\s*<\|channel\|>/gi, "\n</think>\n")
            .replace(/<\|im_start\|>thought/gi, "<think>\n")
            .replace(/<\|im_end\|>/gi, "\n</think>\n");

        const thinkRegex = /<think>([\s\S]*?)(?:<\/think>|$)/i;
        const thinkMatch = normalizedText.match(thinkRegex);
        let finalHtml = '';

        // थिंकिंग प्रोसेस को कोलैप्सेबल बॉक्स में डालना
        if (thinkMatch) {
            finalHtml += `
            <details class="qwen-think-box" ${isProcessing ? 'open' : ''}>
                <summary>
                    <svg viewBox="0 0 24 24" class="icon" style="width:14px;height:14px;"><polyline points="9 18 15 12 9 6"></polyline></svg> 
                    Thinking Process
                </summary>
                <div class="qwen-think-content">${marked.parse(thinkMatch[1].trim())}</div>
            </details>`;
        }

        // मेन टेक्स्ट (थिंकिंग हटाकर)
        let mainText = normalizedText.replace(thinkRegex, '').trim();

        if (mainText) {
            // मैथ पार्सिंग (पुराना लॉजिक)
            const { text: safeText, mathBlocks } = Chat.preprocessMath(mainText);
            let parsedHtml = marked.parse(safeText);
            parsedHtml = Chat.postprocessMath(parsedHtml, mathBlocks);
            finalHtml += `<div class="tex2jax_process">${parsedHtml}</div>`;
        }

        if (isProcessing) {
            finalHtml += `<span class="inline-block w-2 h-4 ml-1 bg-indigo-500 animate-pulse"></span>`; // ब्लिंकिंग कर्सर
        }
        
        container.innerHTML = finalHtml;
        
        // मैथजैक और मेरमेड रेंडरिंग कॉल
        if (window.MathJax && !isProcessing) {
            try { MathJax.typesetPromise([container]).catch(console.error); } catch (e) {}
        }
    },

    // 4. मैसेज कॉपी करना (थिंकिंग बॉक्स हटाकर)
    copyMsg(id) {
        const el = document.getElementById(`bot-content-${id}`);
        const clone = el.cloneNode(true);
        const thinkBox = clone.querySelector('.qwen-think-box');
        if (thinkBox) thinkBox.remove();
        
        navigator.clipboard.writeText(clone.innerText).then(() => {
            console.log("Copied successfully!");
        });
    },

    // 5. मैथमैटिक्स (LaTeX) प्री-प्रोसेसिंग
    preprocessMath(text) {
        let mathBlocks = {};
        let mathCounter = 0;
        function replacer(match) {
            const id = `MATHBLOCKPLACEHOLDER${mathCounter}ENDPLACEHOLDER`;
            mathBlocks[id] = match;
            mathCounter++;
            return id;
        }
        text = text.replace(/\$\$([\s\S]+?)\$\$/g, replacer);
        text = text.replace(/\\\[([\s\S]+?)\\\]/g, replacer);
        text = text.replace(/\$((?:\\.|[^$\\])+?)\$/g, replacer);
        text = text.replace(/\\\(([\s\S]+?)\\\)/g, replacer);
        return { text, mathBlocks };
    },

    postprocessMath(html, mathBlocks) {
        for (const [id, mathStr] of Object.entries(mathBlocks)) {
            html = html.split(id).join(mathStr);
        }
        return html;
    },

    // 6. मुख्य API सेंड लॉजिक (Streaming)
    async handleSend() {
        if(State.isProcessing) return;
        
        const text = DOM.mainInput.value.trim();
        if(!text && !State.attachment) return;
        
        State.isProcessing = true; 
        
        // UI अपडेट्स (बटन डिसेबल करना, इनपुट खाली करना)
        DOM.mainInput.value = ''; 
        DOM.mainInput.style.height = 'auto'; 
        UI.updateWelcomeScreen();
        
        let payloadStr = text;
        let attachUI = '';
        let mediaArray = [];
        
        // अटैचमेंट लॉजिक
        if(State.attachment) {
            if(State.attachment.type === 'text') {
                payloadStr = `[File attached: ${State.attachment.name}]\n\n---DATA---\n${State.attachment.data}\n---END DATA---\n\nUser: ${text}`;
                attachUI = `<div class="text-sm font-semibold mb-2 p-2 bg-slate-100 rounded-lg">📄 ${State.attachment.name}</div>`;
            } else {
                mediaArray.push(State.attachment); 
                attachUI = `<div class="mb-2"><img src="data:image/jpeg;base64,${State.attachment.data}" class="w-32 rounded-lg border border-slate-200"></div>`;
            }
        }
        
        // यूज़र मैसेज रेंडर करें
        Chat.renderUser(text, attachUI);
        State.history.push({ role: 'user', content: payloadStr }); 
        
        // अटैचमेंट डिस्कार्ड करें
        State.attachment = null;
        document.getElementById('attachmentsArea').innerHTML = ''; // UI क्लियर
        
        // बॉट का खाली कंटेनर रेंडर करें
        const msgId = Date.now().toString(); 
        const botObj = Chat.renderBot(msgId);
        Chat.parseAndRender("...", true, botObj.contentDiv);
        
        State.abortController = new AbortController();
        let fullText = "";
        
        try {
            // API कॉल (आपके app.py बैकएंड पर)
            const res = await fetch(Config.API_ENDPOINT, {
                method: 'POST', 
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ 
                    message: payloadStr, 
                    attachments: mediaArray, 
                    is_search: State.searchEnabled, 
                    location: State.location, 
                    thinking_mode: State.thinkingMode, 
                    thinking_effort: State.thinkingEffort, 
                    history: State.history 
                }),
                signal: State.abortController.signal
            });
            
            if(!res.ok) throw new Error(`Server error (${res.status})`);
            
            // स्ट्रीमिंग लॉजिक
            const reader = res.body.getReader(); 
            const decoder = new TextDecoder(); 
            let buffer = '';
            
            while(true) {
                const {done, value} = await reader.read();
                if(done) break;
                
                buffer += decoder.decode(value, {stream: true});
                const lines = buffer.split('\n'); 
                buffer = lines.pop();
                
                for(let line of lines) {
                    if(line.startsWith('data: ')) {
                        const dataStr = line.substring(6).trim();
                        if(dataStr === '[DONE]') continue;
                        
                        try {
                            const json = JSON.parse(dataStr);
                            if (json.error) { 
                                botObj.contentDiv.innerHTML += `<br><span class="text-red-500">⚠️ ${UI.escape(json.error)}</span>`; 
                                return; 
                            }
                            if(json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content) {
                                fullText += json.choices[0].delta.content;
                            }
                        } catch(e) {}
                        
                        // रियल-टाइम रेंडरिंग
                        Chat.parseAndRender(fullText, true, botObj.contentDiv);
                    }
                }
            }
            
            // फाइनल रेंडरिंग (बिना कर्सर के)
            Chat.parseAndRender(fullText, false, botObj.contentDiv);
            State.history.push({ role: 'assistant', content: fullText });
            
        } catch(e) {
            if (e.name !== 'AbortError') {
                botObj.contentDiv.innerHTML += `<br><span class="text-red-500">⚠️ ${UI.escape(e.message || 'Connection Offline.')}</span>`;
            }
        } finally {
            State.isProcessing = false; 
            if (UI.autoScroll) UI.scrollToBottom();
            
            // अगर TTS उपलब्ध है तो ऑडियो प्रिपेयर करें
            if(window.TTSManager && botObj.listenBtn && fullText.trim().length > 0) {
                window.TTSManager.autoPrepare(msgId, fullText, botObj.listenBtn);
            }
        }
    }
};

// ग्लोबल स्कोप में एक्सपोज़ करें
window.Chat = Chat;
