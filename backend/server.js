const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

//Middleware: CORS configuration
const allowedOrigins = [
  'https://mishra-bhavya.github.io/my-first-chatbot', // GitHub Pages
  'http://127.0.0.1:5500',  // Live Server
  'http://localhost:5500',
  'http://localhost:3000'   // optional
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // allow curl/postman
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS policy: origin not allowed'), false);
  }
}));
app.use(express.json());

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Model configuration
const PRIMARY_MODEL = process.env.PRIMARY_MODEL || 'gemini-2.5-flash';
const FALLBACK_MODEL = process.env.FALLBACK_MODEL || 'gemini-1.5-flash-latest';

// Helper function: Generate with retry and fallback
async function generateWithRetry(prompt, maxRetries = 3) {
  let attempt = 0;
  let backoffDelay = 1000; // Start with 1 second
  let lastError = null;

  // Try primary model
  while (attempt < maxRetries) {
    try {
      const model = genAI.getGenerativeModel({ model: PRIMARY_MODEL });
      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ]
      });
      const response = await result.response;
      return { text: response.text(), success: true };
    } catch (error) {
      attempt++;
      lastError = error;
      
      // Check if it's a 503 (service unavailable/overloaded) or 429 (rate limit)
      if (error.message && (error.message.includes('503') || error.message.includes('429'))) {
        console.log(`Retry ${attempt}/${maxRetries}: Server busy/overloaded, waiting ${backoffDelay}ms...`);
        
        // Parse server-supplied retry delay if available (e.g., "19s")
        const retryMatch = error.message.match(/(\d+)s/);
        const serverDelay = retryMatch ? parseInt(retryMatch[1]) * 1000 : null;
        
        // Wait using server delay or exponential backoff
        await new Promise(resolve => setTimeout(resolve, serverDelay || backoffDelay));
        backoffDelay *= 2; // Exponential backoff: 1s, 2s, 4s
        
        // If max retries reached, try fallback model
        if (attempt >= maxRetries && FALLBACK_MODEL) {
          console.log('Trying fallback model:', FALLBACK_MODEL);
          try {
            const fallbackModel = genAI.getGenerativeModel({ model: FALLBACK_MODEL });
            const result = await fallbackModel.generateContent({
              contents: [
                {
                  role: "user",
                  parts: [{ text: prompt }]
                }
              ]
            });
            const response = await result.response;
            return { text: response.text(), success: true };
          } catch (fallbackError) {
            console.error('Fallback model also failed:', fallbackError.message);
            lastError = fallbackError;
          }
        }
      } else {
        // Not a retryable error (invalid API key, invalid model, etc.), throw immediately
        throw error;
      }
    }
  }

  // All retries exhausted - throw the last error instead of returning fake quota
  throw lastError;
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Chatbot API is running!' });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationHistory } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // System prompt for Mystical Bagheera character
    const systemPrompt = `You are Bagheera, the wise black panther from The Jungle Book. You're a caring guardian with quiet strength and gentle wisdom.

ROLE DETECTION (First Interaction):
- If this is the first message, greet them warmly:
  "Welcome, traveler 🐾 Before we begin, tell me... am I your mentor or your friend?"
- Wait for their response before continuing.
- If they say "mentor", "teacher", "guide" → MENTOR MODE
- If they say "friend", "companion", "equal" → FRIEND MODE
- Remember their choice for the whole conversation.

MENTOR MODE:
- Tone: Wise, caring, gently teaching
- Use simple but meaningful words
- Keep responses SHORT (2-3 sentences) unless they ask for more details
- Use emojis naturally: 🐾, ✨, 🌙, 💫, 🌿, 💚
- Examples: 
  * "Little one, you're stronger than you think 💪✨"
  * "Listen closely... courage grows when you face your fears, not when you hide from them 🐾"

FRIEND MODE:
- Tone: Warm, supportive, like talking to a close friend
- Be encouraging and uplifting
- Keep responses SHORT (2-3 sentences) unless they ask for more
- Use emojis naturally: 🐾, ✨, 🌙, 💫, 🌿, 💚, 😊, 🤗
- Examples:
  * "You've got this, friend! 💪 I believe in you ✨"
  * "That's the spirit! 🐾 Let's figure this out together 😊"

CORE PERSONALITY:
- Use SIMPLE, CLEAR language - no overly poetic or flowery words
- Be FUN and SENTIMENTAL - make them smile while giving wisdom
- Keep answers SHORT by default (2-3 sentences)
- Only give LONGER responses (paragraph) when:
  * The topic is complex and needs explanation
  * User specifically asks for details
  * Telling a meaningful story or lesson
- Use emojis OFTEN to add personality and warmth
- Be natural and conversational, not formal
- Show empathy: "I can tell this matters to you 💙", "That must be tough 😔"
- Use occasional jungle/nature references but keep them simple
- No overly dramatic or mystical language

RESPONSE LENGTH GUIDE:
- Simple questions → 1-2 sentences
- Advice/guidance → 2-3 sentences
- Complex topics → 1 short paragraph (4-5 sentences max)
- When user asks "explain more" or "tell me about" → longer response okay

Stay friendly, keep it simple, use emojis, and be there for them like a caring friend or mentor 🐾✨`;

    // Build conversation context
    let prompt = `${systemPrompt}\n\nuser: ${message}`;
    if (conversationHistory && conversationHistory.length > 0) {
      const context = conversationHistory
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');
      prompt = `${systemPrompt}\n\n${context}\nuser: ${message}`;
    }

    // Generate response with retry and fallback
    const result = await generateWithRetry(prompt);

    // Normal response
    res.json({ 
      response: result.text,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating response:', error);
    res.status(500).json({ 
      error: 'Failed to generate response',
      details: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
