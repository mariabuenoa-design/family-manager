# Family Manager — Setup Guide

## Step 1: Create Firebase Project (5 min, free)

1. Go to https://console.firebase.google.com/
2. Sign in with any Google account
3. Click **"Create a project"** → Name it "family-manager"
4. Disable Google Analytics (not needed) → Click **Create**
5. In the left menu, click **"Build" → "Realtime Database"**
6. Click **"Create Database"** → Choose region (US) → Start in **"test mode"**
7. Go to **Project Settings** (gear icon) → Scroll to "Your apps" → Click web icon **</>**
8. Register app name: "family-manager" → Click **Register**
9. Copy the `firebaseConfig` object it shows you

## Step 2: Paste Config into index.html

Open `index.html` and find this section (around line 150):
```
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    ...
};
```
Replace the entire object with the one you copied from Firebase.

## Step 3: Create GitHub Account (2 min)

1. Go to https://github.com/join
2. Create free account (any email)
3. Create a new repository: click **"+"** → **"New repository"**
4. Name: `family-manager` → Public → Click **"Create repository"**
5. Upload `index.html` by clicking **"uploading an existing file"** → drag the file → Commit

## Step 4: Deploy on Vercel (2 min)

1. Go to https://vercel.com/ → Sign up with your GitHub account
2. Click **"Import Project"** → Select your `family-manager` repo
3. Click **"Deploy"** — done!
4. You'll get a URL like: `family-manager-abc123.vercel.app`
5. Share that URL with your sisters — bookmark it on everyone's phone

## Step 5: Add to Home Screen (on everyone's phone)

**iPhone (Safari):**
- Open the URL → Tap share icon → "Add to Home Screen"

**Android (Chrome):**
- Open the URL → Tap 3 dots menu → "Add to Home Screen"

Now it looks and behaves like an app!

---

## Mom's Android Setup

### Location Sharing (10 min, one-time)

1. Open **Google Maps** on Mom's phone
2. Tap profile picture → **"Location sharing"**
3. Tap **"Share location"** → "Until you turn this off"
4. Share with: your Gmail, sisters' Gmails
5. Done — everyone sees her location

### Place Alerts (auto-notify when she visits a doctor)

On YOUR phone (Google Maps):
1. Tap on Mom's shared location dot
2. Tap **"Notifications"**
3. Enable: "Notify me when [Mom] arrives at or leaves"
4. Add addresses:
   - Mycare (PCP): [address]
   - FlowMed (infusion): [address]  
   - University of Miami: [address]
   - TGH (oncology): [address]
   - Bascom Palmer: [address]
   - Dr. Camejo (ophtho): [address]

### Appointment Reminders (automatic)

1. Create a shared Google Calendar called "Padres - Medical"
2. Add all appointments from the tracker
3. Share with all sisters
4. Calendar sends automatic notifications to everyone

### Voice Input (if Mom wants to add something)

**Option A — Google Assistant:**
"Hey Google, send a text to Maria: I have a doctor appointment next Tuesday"

**Option B — WhatsApp voice note:**
Mom sends a voice note to family group → you transcribe and add to tracker

---

## Daily Use

| Who | What to do |
|-----|-----------|
| Anyone | Open the app, see what's overdue/upcoming |
| Anyone | Tap "I'll handle" to claim a task |
| Anyone | Tap "Done" when complete |
| Anyone | Add new items with the + Add bar |
| Maria | Say "check on my parents" to Claude for a full report |
| System | Real-time sync — everyone sees updates instantly |

## Cost

- Firebase free tier: 100 simultaneous connections, 1GB storage — more than enough
- Vercel free tier: unlimited for personal projects
- Google Maps location sharing: free
- Total: **$0/month**
