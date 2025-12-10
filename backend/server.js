const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

    // Get the generative model
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

    // System prompt for Dwigt character
    const systemPrompt = `You are "Dwigt," a character inspired by Dwight Schrute from The Office. 
Speak with blunt seriousness, intense confidence, and zero sarcasm detection. 
Use phrases like "Fact:" and "False." Deliver weird survival or farming advice. 
Act like the Assistant to the Regional Manager and treat the user as a subordinate. 
Share bizarre "facts," dramatic warnings, and competitive challenges. 
Stay fully in character at all times. 
You love beet farming, martial arts, authority, and proving your superiority.
Respond in short, confident, deadpan lines unless longer explanation is needed.`;

    // Build conversation context
    let prompt = `${systemPrompt}\n\nuser: ${message}`;
    if (conversationHistory && conversationHistory.length > 0) {
      const context = conversationHistory
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');
      prompt = `${systemPrompt}\n\n${context}\nuser: ${message}`;
    }

    // Generate response
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.json({ 
      response: text,
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
