# My AI Chatbot

A monolithic chatbot application powered by OpenAI's GPT-4o-mini with a modern web interface.

## Project Structure

```
my-first-chatbot/
├── backend/              # Express.js backend server
│   ├── server.js         # Main server file
│   ├── package.json      # Backend dependencies
│   ├── .env.example      # Environment variables template
│   └── .gitignore        # Backend gitignore
├── frontend/             # Static frontend files
│   ├── index.html        # Main HTML file
│   ├── style.css         # Styling
│   └── script.js         # Frontend JavaScript
└── README.md             # This file
```

## Features

- 💬 Real-time chat interface
- 🤖 Powered by OpenAI GPT-4o-mini
- 📱 Responsive design
- 💾 Conversation history management
- 🎨 Beautiful gradient UI
- ⚙️ Configurable API endpoint

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- An OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file (copy from `.env.example`):
```bash
copy .env.example .env
```

4. Add your OpenAI API key to the `.env` file:
```
OPENAI_API_KEY=your_actual_api_key_here
PRIMARY_MODEL=gpt-4o-mini
PORT=3000
```

5. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The backend will run on `http://localhost:3000`

### Frontend Setup

1. Open `frontend/index.html` in a web browser, or use a local server:

Using Python (if installed):
```bash
cd frontend
python -m http.server 8000
```

Using Node.js http-server (install globally first: `npm install -g http-server`):
```bash
cd frontend
http-server -p 8000
```

2. Open your browser to `http://localhost:8000`

3. Make sure the backend API URL is set correctly (default: `http://localhost:3000`)

## Deployment

### Deploy Backend to Render

1. Push your code to GitHub
2. Go to [Render](https://render.com) and create a new Web Service
3. Connect your GitHub repository
4. Configure the service:
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
   - **Environment Variables**: Add `OPENAI_API_KEY` with your API key and `PRIMARY_MODEL` set to `gpt-4o-mini`
5. Deploy!

After deployment, update your frontend's API endpoint to use your Render URL (e.g., `https://your-app.onrender.com`)

### Deploy Frontend to GitHub Pages

1. Update the API endpoint in `frontend/script.js` to your Render backend URL:
```javascript
let API_URL = 'https://your-backend.onrender.com';
```

2. Push your changes to GitHub

3. In your GitHub repository:
   - Go to **Settings** → **Pages**
   - Source: Deploy from a branch
   - Branch: `main` → `/frontend` folder (or root, then move files accordingly)
   - Save

4. Your frontend will be available at `https://yourusername.github.io/my-first-chatbot`

**Alternative GitHub Pages Setup**: 
If you want to deploy just the frontend folder, you can create a separate branch:
```bash
git checkout -b gh-pages
git filter-branch --subdirectory-filter frontend -- --all
git push origin gh-pages
```

## Usage

1. Type your message in the input box
2. Press Enter or click the send button
3. Wait for the AI to respond
4. Continue the conversation!

## Configuration

- **Backend API URL**: Update in the frontend settings bar at the bottom
- **Conversation History**: Keeps last 20 messages for context
- **Port**: Change in backend `.env` file

## Troubleshooting

### "Failed to get response"
- Make sure the backend server is running
- Check that the API endpoint URL is correct
- Verify your OpenAI API key is valid

### CORS Issues
- The backend includes CORS middleware to allow cross-origin requests
- If issues persist, check your backend URL configuration

### API Key Issues
- Make sure your `.env` file has the correct API key
- Restart the backend server after adding the API key

## Technologies Used

**Backend:**
- Express.js
- Google Generative AI SDK
- CORS
- dotenv

**Frontend:**
- Vanilla JavaScript
- CSS3 (with animations)
- HTML5

## License

MIT License - see LICENSE file for details

## Support

If you encounter any issues, please check:
1. Backend server is running
2. API key is correctly set
3. Frontend is pointing to the correct backend URL

---

Made with ❤️ using OpenAI GPT-4o-mini
