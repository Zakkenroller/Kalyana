# Kalyana — Deployment Guide

## What you need
- A GitHub account (you have one)
- A Netlify account (you have one)
- Your Anthropic API key (you have one)

---

## Step 1 — Create a GitHub Repository

1. Go to https://github.com/new
2. Name it **kalyana** (or anything you like)
3. Set it to **Private**
4. Click **Create repository**
5. On the next page, click **uploading an existing file**
6. Drag the entire contents of the `kalyana` folder into the upload area
   - Make sure you upload ALL files including the folders `src/` and `netlify/`
7. Click **Commit changes**

---

## Step 2 — Connect Netlify to GitHub

1. Go to https://app.netlify.com
2. Click **Add new site** → **Import an existing project**
3. Click **GitHub**
4. Authorize Netlify if prompted
5. Find and select your **kalyana** repository
6. Netlify will auto-detect the settings from `netlify.toml`. You don't need to change anything.
7. Click **Deploy site**

Netlify will build the project. This takes about 60 seconds. You'll see a deploy log.

---

## Step 3 — Add Your API Key

This is the most important step. Without it, the app won't work.

1. In Netlify, go to your site dashboard
2. Click **Site configuration** → **Environment variables**
3. Click **Add a variable**
4. Key: `ANTHROPIC_API_KEY`
5. Value: paste your Anthropic API key (starts with `sk-ant-...`)
6. Click **Save**
7. Go to **Deploys** and click **Trigger deploy** → **Deploy site**

---

## Step 4 — Open on Your Phone

1. In Netlify, find your site URL (something like `https://luminous-mochi-123abc.netlify.app`)
2. You can rename this under **Domain management** → **Options** → **Edit site name**
3. Open the URL in Safari on your iPhone
4. Tap the **Share** button → **Add to Home Screen**
5. It will open full-screen like a native app

---

## Updating the App

When you want to make changes (e.g. after editing the system prompt):

1. Edit the files on your computer
2. Go to your GitHub repository
3. Click the file you want to update → click the pencil icon to edit → save
   OR drag new files into the repository
4. Netlify will automatically redeploy within 60 seconds

---

## Your conversation history

Conversations are stored on your device (in the browser's localStorage). They persist across sessions on the same device and browser. They are not stored on any server.

To start fresh: tap the ↺ button in the top right corner of the app.

---

## Troubleshooting

**"Something went wrong"** → Your API key may not be set correctly. Double-check Step 3.

**Blank screen** → Check the Netlify deploy log for build errors.

**App not updating** → Hard-refresh the page (hold Shift and click reload on desktop; on iPhone, close and reopen Safari).

---

*Kalyana v1.0 · Personal instance*
