// Configuration
let API_URL = 'http://localhost:3000';
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

    // Auto-resize textarea
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

    // Send button click
    sendBtn.addEventListener('click', sendMessage);

    // Update API endpoint
    apiEndpoint.addEventListener('change', () => {
        API_URL = apiEndpoint.value;
        localStorage.setItem('apiEndpoint', API_URL);
    });
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
        // Send request to backend
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

        const data = await response.json();

        // Remove typing indicator
        removeTypingIndicator(typingId);

        // Check for quota exhaustion
        if (response.status === 429 || data.quota === true) {
            const retryAfter = data.retryAfter || 60; // Default 60 seconds
            showQuotaMessage(retryAfter);
            startPersistentQuotaTimer(); // Start the 24-hour countdown in header
            return; // Don't update conversation history
        }

        // Normal response - add bot message
        addMessage(data.response, 'bot');

        // Update conversation history
        conversationHistory.push(
            { role: 'user', content: message },
            { role: 'assistant', content: data.response }
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
        isRequestPending = false; // Release debounce flag
        if (!sendBtn.disabled) {
            sendBtn.disabled = false;
            userInput.focus();
        }
    }
}

// Show quota exhaustion message with countdown
function showQuotaMessage(retryAfter) {
    let remainingSeconds = retryAfter;
    
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
    countdownInterval = setInterval(() => {
        remainingSeconds--;
        const countdownEl = document.getElementById('countdown');
        if (countdownEl) {
            countdownEl.textContent = `${remainingSeconds}s`;
        }

        if (remainingSeconds <= 0) {
            clearInterval(countdownInterval);
            
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
    quotaTimer.style.display = 'block';
    headerSubtitle.style.display = 'none';
    
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
            quotaTimer.style.display = 'none';
            headerSubtitle.style.display = 'block';
            quotaResetTime = null;
            localStorage.removeItem('quotaResetTime');
        } else {
            // Calculate hours, minutes, seconds
            const hours = Math.floor(remaining / (60 * 60 * 1000));
            const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
            const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
            
            // Format as HH:MM:SS
            const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            document.getElementById('quotaCountdown').textContent = timeString;
        }
    }, 1000);
}

// Resume persistent quota timer from localStorage
function resumePersistentQuotaTimer() {
    // Show the timer in header
    const quotaTimer = document.getElementById('quotaTimer');
    const headerSubtitle = document.getElementById('headerSubtitle');
    quotaTimer.style.display = 'block';
    headerSubtitle.style.display = 'none';
    
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
            quotaTimer.style.display = 'none';
            headerSubtitle.style.display = 'block';
            quotaResetTime = null;
            localStorage.removeItem('quotaResetTime');
        } else {
            // Calculate hours, minutes, seconds
            const hours = Math.floor(remaining / (60 * 60 * 1000));
            const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
            const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
            
            // Format as HH:MM:SS
            const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            document.getElementById('quotaCountdown').textContent = timeString;
        }
    }, 1000);
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
