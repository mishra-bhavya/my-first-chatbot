# Deployment Configuration

## Backend Deployment (Render)

### Steps:
1. Push your repository to GitHub
2. Sign up/Login to [Render](https://render.com)
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Configure:
   - **Name**: my-chatbot-backend (or your choice)
   - **Environment**: Node
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
   - **Plan**: Free (or your choice)

6. Add Environment Variable:
   - Key: `GEMINI_API_KEY`
   - Value: Your actual Gemini API key

7. Click "Create Web Service"

### After Deployment:
- Your backend URL will be: `https://your-service-name.onrender.com`
- Note this URL - you'll need it for the frontend

---

## Frontend Deployment (GitHub Pages)

### Option 1: Deploy from main branch /frontend folder

1. In your GitHub repository, go to **Settings** → **Pages**
2. Under "Build and deployment":
   - Source: Deploy from a branch
   - Branch: `main`
   - Folder: `/frontend` (if this option exists)
3. Click Save

**Note**: If the `/frontend` folder option isn't available, use Option 2 below.

### Option 2: Deploy frontend to root of gh-pages branch

1. Before deployment, update `frontend/script.js`:
   ```javascript
   let API_URL = 'https://your-backend.onrender.com'; // Your Render URL
   ```

2. Move frontend files to root:
   ```bash
   copy frontend\index.html .
   copy frontend\style.css .
   copy frontend\script.js .
   ```

3. Commit and push:
   ```bash
   git add .
   git commit -m "Prepare for GitHub Pages deployment"
   git push origin main
   ```

4. In GitHub Settings → Pages:
   - Source: Deploy from a branch
   - Branch: `main`
   - Folder: `/ (root)`
   - Save

### Option 3: Use gh-pages branch (recommended for keeping frontend separate)

1. Update the API URL in `frontend/script.js` to your Render backend URL

2. Create and push gh-pages branch:
   ```bash
   git checkout --orphan gh-pages
   git rm -rf .
   copy ..\frontend\* .
   git add .
   git commit -m "Deploy to GitHub Pages"
   git push origin gh-pages
   ```

3. In GitHub Settings → Pages:
   - Branch: `gh-pages`
   - Folder: `/ (root)`

### After Frontend Deployment:
- Your frontend will be available at: `https://yourusername.github.io/my-first-chatbot`
- Make sure to test the connection to your backend

---

## Post-Deployment Checklist

- [ ] Backend is running on Render
- [ ] Environment variable `GEMINI_API_KEY` is set in Render
- [ ] Frontend is deployed to GitHub Pages
- [ ] Frontend's `API_URL` points to your Render backend
- [ ] CORS is enabled in backend (already configured)
- [ ] Test the chatbot by sending a message

---

## Updating Your Deployment

### Backend Updates:
- Push changes to GitHub
- Render will automatically redeploy

### Frontend Updates:
- Update files in frontend folder
- Commit and push to the branch configured for GitHub Pages
- GitHub Pages will automatically rebuild

---

## Troubleshooting

### Issue: Frontend can't connect to backend
**Solution**: 
- Check that the API_URL in script.js matches your Render URL
- Verify CORS is enabled (it's already configured in server.js)
- Check Render logs for backend errors

### Issue: 502 Bad Gateway on Render
**Solution**:
- Check Render logs
- Verify GEMINI_API_KEY is set correctly
- Ensure npm install completed successfully

### Issue: GitHub Pages shows 404
**Solution**:
- Verify the correct branch and folder are selected
- Check that index.html exists in the deployed location
- Wait a few minutes for deployment to complete
