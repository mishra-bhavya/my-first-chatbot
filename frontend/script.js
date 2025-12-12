// Configuration
let API_URL = 'https://my-first-chatbot-backend.onrender.com';
let conversationHistory = [];
let isRequestPending = false; // Debounce flag

// DOM Elements
const chatContainer = document.getElementById('chatContainer');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const apiEndpoint = document.getElementById('apiEndpoint');
const ambienceToggle = document.getElementById('ambienceToggle');

// Jungle ambience audio
let jungleAudio = null;
let ambienceEnabled = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Load saved API endpoint
    const savedEndpoint = localStorage.getItem('apiEndpoint');
    if (savedEndpoint) {
        apiEndpoint.value = savedEndpoint;
        API_URL = savedEndpoint;
    } else {
        // show the default endpoint in the input if the element exists
        if (apiEndpoint) apiEndpoint.value = API_URL;
    }

    // Initialize jungle ambience (placeholder URL - replace with actual audio file)
    jungleAudio = new Audio('https://www.soundjay.com/nature/sounds/rain-03.mp3'); // Placeholder
    jungleAudio.loop = true;
    jungleAudio.volume = 0.3;

    // Ambience toggle handler
    if (ambienceToggle) {
        ambienceToggle.addEventListener('click', () => {
            ambienceEnabled = !ambienceEnabled;
            if (ambienceEnabled) {
                jungleAudio.play().catch(e => console.log('Audio play failed:', e));
                ambienceToggle.classList.add('active');
                ambienceToggle.textContent = '🌙 Jungle Ambience On';
            } else {
                jungleAudio.pause();
                ambienceToggle.classList.remove('active');
                ambienceToggle.textContent = '🌙 Enable Jungle Ambience';
            }
        });
    }

    // Auto-resize textarea
    if (userInput) {
        userInput.addEventListener('input', () => {
            userInput.style.height = 'auto';
            userInput.style.height = userInput.scrollHeight + 'px';
        });

        // Send message on Enter (Shift+Enter for new line)
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // Send button click
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);

    // Update API endpoint input (optional)
    if (apiEndpoint) {
        apiEndpoint.addEventListener('change', () => {
            API_URL = apiEndpoint.value;
            localStorage.setItem('apiEndpoint', API_URL);
        });
    }
});

// Send message to chatbot
async function sendMessage() {
    const message = userInput.value.trim();
    
    if (!message || isRequestPending) return; // Debounce: prevent double-clicks

    // Set request pending flag
    isRequestPending = true;

    // Add user message to chat
    addMessage(message, 'user');
    
    // Clear input
    userInput.value = '';
    userInput.style.height = 'auto';

    // Disable send button
    sendBtn.disabled = true;

    // Show typing indicator
    const typingId = showTypingIndicator();

    try {
        // Send request to backend (NOTE: hitting your Render URL /chat)
        const response = await fetch(`${API_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                conversationHistory: conversationHistory
            })
        });

        // If server didn't return JSON or had a network error, this will throw
        const data = await response.json();

        // Remove typing indicator
        removeTypingIndicator(typingId);

        // Check for errors from backend
        if (data.error) {
            showError(`${data.error}${data.details ? ': ' + data.details : ''}`);
            return;
        }

        // Add bot message
        const botText = data.response || "";
        if (!botText) {
            showError('Received empty response from backend. Please try again.');
            return;
        }
        addMessage(botText, 'bot');

        // Update conversation history
        conversationHistory.push(
            { role: 'user', content: message },
            { role: 'assistant', content: botText }
        );

        // Keep only last 10 messages in history to avoid context length issues
        if (conversationHistory.length > 20) {
            conversationHistory = conversationHistory.slice(-20);
        }

    } catch (error) {
        console.error('Error:', error);
        removeTypingIndicator(typingId);
        
        showError(`Failed to get response. Please check if the backend is running at ${API_URL}`);
    } finally {
        // Release debounce flag
        isRequestPending = false;

        // If a quota message is visible, keep UI disabled until countdown ends.
        const quotaMsg = document.getElementById('quota-message');
        if (!quotaMsg) {
            // Normal case: re-enable UI
            sendBtn.disabled = false;
            userInput.disabled = false;
            userInput.focus();
        } else {
            // There is a quota message active; do not re-enable UI here.
            // The quota countdown handler will re-enable the UI when time is up.
        }
    }
}

// Add message to chat container
function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = text;
    
    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Remove welcome message if it exists
    const welcomeMessage = chatContainer.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
}

// Show typing indicator
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot';
    typingDiv.id = 'typing-indicator';
    
    const indicatorDiv = document.createElement('div');
    indicatorDiv.className = 'typing-indicator';
    indicatorDiv.innerHTML = '<span></span><span></span><span></span>';
    
    typingDiv.appendChild(indicatorDiv);
    chatContainer.appendChild(typingDiv);
    
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    return 'typing-indicator';
}

// Remove typing indicator
function removeTypingIndicator(id) {
    const typingIndicator = document.getElementById(id);
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    chatContainer.appendChild(errorDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}
