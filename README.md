# GolfLink

A golf tee time booking app that shows handicaps, recommends tees, and matches you with similar players.

## Quick Deploy to Render (Free)

### Step 1: Create a GitHub Account
1. Go to https://github.com and click **Sign Up**
2. Enter your email, create a password, pick a username
3. Verify your email

### Step 2: Upload This Code to GitHub
1. On GitHub, click the **+** button (top right) → **New repository**
2. Name it `golflink`
3. Keep it **Public** (required for free Render hosting)
4. Click **Create repository**
5. On the next page, click **uploading an existing file**
6. Drag and drop ALL the files from this folder into the upload area
7. Click **Commit changes**

### Step 3: Create a Render Account
1. Go to https://render.com
2. Click **Get Started for Free**
3. Sign up with your GitHub account (easiest option)

### Step 4: Deploy the App
1. In Render, click **New** → **Web Service**
2. Connect your GitHub account if prompted
3. Find and select your `golflink` repository
4. Configure these settings:
   - **Name**: `golflink` (this becomes your URL)
   - **Region**: Oregon (US West)
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. Click **Create Web Service**
6. Wait 3-5 minutes for it to build and deploy

### Step 5: Open Your App
- Render gives you a URL like: `https://golflink.onrender.com`
- Open that URL on your phone — no Perplexity banner, just your app
- Add it to your home screen for the full app experience

## Tech Stack
- React + TypeScript + Tailwind CSS + shadcn/ui
- Express.js backend
- In-memory data storage (resets on restart)
