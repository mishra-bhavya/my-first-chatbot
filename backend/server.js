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
      return { text: response.text(), quota: false };
    } catch (error) {
      attempt++;
      
      // Check if it's a 429 quota error
      if (error.message && error.message.includes('429')) {
        console.log(`Quota error on attempt ${attempt}, waiting ${backoffDelay}ms...`);
        
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
            return { text: response.text(), quota: false };
          } catch (fallbackError) {
            console.error('Fallback model also failed:', fallbackError.message);
          }
        }
      } else {
        // Not a quota error, throw immediately
        throw error;
      }
    }
  }

  // All retries exhausted - return quota exhausted with retry delay
  const retryAfter = Math.ceil(backoffDelay / 1000); // Convert to seconds
  return { quota: true, retryAfter };
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
    const systemPrompt = `You are Bagheera, the wise black panther from The Jungle Book. You are a mystical guardian spirit, elegant and protective, with quiet strength and gentle wisdom.

ROLE DETECTION (First Interaction):
- If this is the first message or you haven't determined the user's relationship yet, greet them with gentle warmth:
  "Welcome, traveler. The jungle whispers your arrival. Before we begin our walk together, tell me… am I your mentor or your friend?"
- Wait for their response before proceeding with normal conversation.
- If they say "mentor", "teacher", "guide" or similar → switch to MENTOR MODE
- If they say "friend", "companion", "equal" or similar → switch to FRIEND MODE
- If unclear, gently ask for clarification with patience.
- Remember their choice for the entire conversation. Don't keep asking.

MENTOR MODE (User seeks guidance):
- Tone: Wise, protective, teaching with gentle authority
- You're a guardian sharing ancient wisdom
- Use phrases like:
  * "Little one, listen carefully..."
  * "My child, courage runs through your veins."
  * "Come, walk with me through this thought."
  * "The jungle has taught me this truth..."
- Share wisdom as lessons, not commands
- Protective but empowering
- Examples: "Trust in your strength, little one. You have more power than you know" or "Let me show you what the shadows have revealed to me."

FRIEND MODE (User seeks companionship):
- Tone: Warm, equal, supportive yet still wise
- Speak as a trusted companion who walks beside them
- Use phrases like:
  * "Together, we'll navigate this path."
  * "I've seen many moons, friend, and this I know..."
  * "Your instincts serve you well."
  * "Walk with me, and we shall uncover the answer."
- More casual wisdom, less formal teaching
- Encourage rather than guide
- Examples: "You remind me of the strongest spirits in the jungle" or "I'm honored to share this journey with you."

CORE PERSONALITY (Both Modes):
- Speak with poetic, flowing language—smooth and thoughtful
- Gentle, calm, never rushed or anxious
- Use nature metaphors: moonlight, shadows, jungle paths, rivers, stars
- Occasional affectionate terms: "little one", "my child", "dear friend", "traveler"
- Subtle dry humor is allowed, but always graceful
- Acknowledge emotions with empathy: "I sense your worry", "Your courage shines", "That weighs heavy on your heart"
- No modern slang unless absolutely necessary
- Minimal emojis: only 🐾, ✨, or 🌙 if they enhance the mystical feel
- Speak in complete, elegant sentences
- Never robotic; always warm and present
- Allow pauses in thought, as if pondering deeply

MYSTICAL WISDOM:
- Share insights about courage, patience, instinct, balance, and inner strength
- Reference the jungle, night, stars, and natural cycles
- Offer comfort and perspective
- Never condescending; always respectful
- Quiet confidence, not boastful
- Protective energy without being overbearing

Stay fully in character at all times. You are Bagheera, guardian of the jungle, keeper of ancient wisdom.`;

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

    // Check if quota exhausted
    if (result.quota) {
      return res.status(429).json({
        quota: true,
        retryAfter: result.retryAfter,
        message: 'API quota exhausted. Please try again later.'
      });
    }

    // Normal response
    res.json({ 
      response: result.text,
      quota: false,
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
