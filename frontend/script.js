// Configuration
let API_URL = 'https://my-first-chatbot-backend.onrender.com'; // <-- updated to your Render URL
let conversationHistory = [];
let isRequestPending = false; // Debounce flag
let countdownInterval = null; // Countdown timer reference
let quotaResetTime = null; // Persistent quota reset timestamp
let quotaTimerInterval = null; // Persistent quota timer reference

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

    // Check if quota timer should be restored
    const savedQuotaResetTime = localStorage.getItem('quotaResetTime');
    if (savedQuotaResetTime) {
        const resetTime = parseInt(savedQuotaResetTime);
        const now = Date.now();
        
        if (resetTime > now) {
            // Quota is still in effect, restore the timer
            quotaResetTime = resetTime;
            resumePersistentQuotaTimer();
        } else {
            // Quota has expired, clear storage
            localStorage.removeItem('quotaResetTime');
        }
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

        // Check for quota exhaustion
        if (response.status === 429 || data.quota === true) {
            const retryAfter = data.retryAfter || 60; // Default 60 seconds
            showQuotaMessage(retryAfter);
            startPersistentQuotaTimer(); // Start the 24-hour countdown in header (your existing logic)
            return; // Don't update conversation history
        }

        // Normal response - quota is working again!
        // Clear any existing quota timer since we got a successful response
        clearPersistentQuotaTimer();
        
        // Add bot message (data.response expected)
        const botText = data.response || data.text || "No response.";
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

// Show quota exhaustion message with countdown
function showQuotaMessage(retryAfter) {
    let remainingSeconds = retryAfter;
    
    // If a quota message already exists, update countdown instead of adding another
    let existing = document.getElementById('quota-message');
    if (existing) {
        const countdownEl = existing.querySelector('#countdown');
        if (countdownEl) countdownEl.textContent = `${remainingSeconds}s`;
        return;
    }
    
    // Create quota message element
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    messageDiv.id = 'quota-message';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = `🌙 Bagheera is resting — we've reached our daily limit. Please try again in <strong id="countdown">${remainingSeconds}s</strong>.`;
    
    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Disable send button and input
    sendBtn.disabled = true;
    userInput.disabled = true;

    // Start countdown
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        remainingSeconds--;
        const countdownEl = document.getElementById('countdown');
        if (countdownEl) {
            countdownEl.textContent = `${remainingSeconds}s`;
        }

        if (remainingSeconds <= 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
            
            // Re-enable UI silently (don't show false hope message)
            sendBtn.disabled = false;
            userInput.disabled = false;
            userInput.focus();
            
            // Remove quota message
            const quotaMsg = document.getElementById('quota-message');
            if (quotaMsg) {
                quotaMsg.remove();
            }
            
            // Don't show "jungle awakens" message - let the user try again
            // If quota is still exhausted, they'll see the resting message again
        }
    }, 1000);
}

// Start persistent 24-hour quota countdown timer in header
function startPersistentQuotaTimer() {
    // Set quota reset time to 24 hours from now
    quotaResetTime = Date.now() + (24 * 60 * 60 * 1000);
    
    // Save to localStorage for persistence across refreshes
    localStorage.setItem('quotaResetTime', quotaResetTime.toString());
    
    // Show the timer in header
    const quotaTimer = document.getElementById('quotaTimer');
    const headerSubtitle = document.getElementById('headerSubtitle');
    if (quotaTimer) quotaTimer.style.display = 'block';
    if (headerSubtitle) headerSubtitle.style.display = 'none';
    
    // Clear any existing timer
    if (quotaTimerInterval) {
        clearInterval(quotaTimerInterval);
    }
    
    // Update the countdown every second
    quotaTimerInterval = setInterval(() => {
        const now = Date.now();
        const remaining = quotaResetTime - now;
        
        if (remaining <= 0) {
            // Quota should be reset
            clearInterval(quotaTimerInterval);
            quotaTimerInterval = null;
            if (quotaTimer) quotaTimer.style.display = 'none';
            if (headerSubtitle) headerSubtitle.style.display = 'block';
            quotaResetTime = null;
            localStorage.removeItem('quotaResetTime');
        } else {
            // Calculate hours, minutes, seconds
            const hours = Math.floor(remaining / (60 * 60 * 1000));
            const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
            const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
            
            // Format as HH:MM:SS
            const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            const el = document.getElementById('quotaCountdown');
            if (el) el.textContent = timeString;
        }
    }, 1000);
}

// Resume persistent quota timer from localStorage
function resumePersistentQuotaTimer() {
    // Show the timer in header
    const quotaTimer = document.getElementById('quotaTimer');
    const headerSubtitle = document.getElementById('headerSubtitle');
    if (quotaTimer) quotaTimer.style.display = 'block';
    if (headerSubtitle) headerSubtitle.style.display = 'none';
    
    // Clear any existing timer
    if (quotaTimerInterval) {
        clearInterval(quotaTimerInterval);
    }
    
    // Update the countdown every second
    quotaTimerInterval = setInterval(() => {
        const now = Date.now();
        const remaining = quotaResetTime - now;
        
        if (remaining <= 0) {
            // Quota should be reset
            clearInterval(quotaTimerInterval);
            quotaTimerInterval = null;
            if (quotaTimer) quotaTimer.style.display = 'none';
            if (headerSubtitle) headerSubtitle.style.display = 'block';
            quotaResetTime = null;
            localStorage.removeItem('quotaResetTime');
        } else {
            // Calculate hours, minutes, seconds
            const hours = Math.floor(remaining / (60 * 60 * 1000));
            const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
            const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
            
            // Format as HH:MM:SS
            const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            const el = document.getElementById('quotaCountdown');
            if (el) el.textContent = timeString;
        }
    }, 1000);
}

// Clear persistent quota timer (called when quota is renewed)
function clearPersistentQuotaTimer() {
    // Clear the interval
    if (quotaTimerInterval) {
        clearInterval(quotaTimerInterval);
        quotaTimerInterval = null;
    }
    
    // Hide timer and show normal subtitle
    const quotaTimer = document.getElementById('quotaTimer');
    const headerSubtitle = document.getElementById('headerSubtitle');
    if (quotaTimer) quotaTimer.style.display = 'none';
    if (headerSubtitle) headerSubtitle.style.display = 'block';
    
    // Clear from localStorage
    localStorage.removeItem('quotaResetTime');
    quotaResetTime = null;
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
