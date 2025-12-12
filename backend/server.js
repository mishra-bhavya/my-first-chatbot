const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

//Middleware: CORS configuration
const allowedOrigins = [
  'https://mishra-bhavya.github.io',  // GitHub Pages (root)
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

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Model configuration
const PRIMARY_MODEL = process.env.PRIMARY_MODEL || 'gpt-4o-mini';

// Helper function: Generate with retry using OpenAI
async function generateWithRetry(messages, maxRetries = 3) {
  let attempt = 0;
  let backoffDelay = 1000; // Start with 1 second
  let lastError = null;

  console.log(`Using OpenAI model: ${PRIMARY_MODEL}`);

  // Try primary model only
  while (attempt < maxRetries) {
    try {
      const completion = await openai.chat.completions.create({
        model: PRIMARY_MODEL,
        messages: messages,
        temperature: 0.7,
        max_tokens: 500
      });
      
      console.log(`✅ Success on attempt ${attempt + 1}`);
      return { text: completion.choices[0].message.content, success: true };
    } catch (error) {
      attempt++;
      lastError = error;
      console.error(`❌ Attempt ${attempt} failed:`, error.message);
      
      // Check if it's a retryable error (503, 429, 500)
      const isRetryable = error.status === 503 || error.status === 429 || error.status === 500;
      
      if (isRetryable && attempt < maxRetries) {
        console.log(`⏳ Retrying in ${backoffDelay}ms... (${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        backoffDelay *= 2; // Exponential backoff: 1s, 2s, 4s
      } else if (!isRetryable) {
        // Not a retryable error (invalid API key, invalid model, etc.), throw immediately
        console.error(`🚨 Non-retryable error, throwing immediately`);
        throw error;
      }
    }
  }

  // All retries exhausted - throw the last error
  console.error(`💥 Failed after ${maxRetries} attempts`);
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

    // Build messages array for OpenAI
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach(msg => {
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        });
      });
    }

    // Add current user message
    messages.push({ role: 'user', content: message });

    // Generate response with retry
    const result = await generateWithRetry(messages);

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
