# PPB Designs
## Site Guide — Your website and data

### The good news
Your PPB Designs tracker is already set up and cloud-synced.  
This guide explains where to log in, where data is stored, how to back up, and what to do if anything breaks.

---

## 1) Your Website Address
- **URL:** `https://stephrawlingscreations.ie/PPBDesigns.html` *(confirm this is your live URL)*
- Bookmark this URL.

---

## 2) How to Log In
1. Go to your PPB Designs URL above
2. Click **Sign in with Google**
3. Use one of the allowed login emails:
   - `ppbdesigns1@gmail.com`
   - `stephrawlingscreations@gmail.com` *(admin/support access)*

---

## 3) Where Your Data Lives
Your app data is stored in Firebase (Google service), not just in the browser.

- **Firebase project:** `ppb-designs`
- **Firebase Auth domain:** `ppb-designs.firebaseapp.com`
- **Realtime Database:** `https://ppb-designs-default-rtdb.europe-west1.firebasedatabase.app`
- **Storage bucket:** `ppb-designs.firebasestorage.app`
- **Firebase console:** `https://console.firebase.google.com`
- **Current data structure:** `users/{uid}/...`

---

## 4) Where the Site Is Hosted
- **Current deployment source:** `PPBDesigns.html` in your main site project
- **Likely host:** main site hosting for `stephrawlingscreations.ie`
- **Hosting account owner:** `Steph Rawlings` *(confirm)*

> If you later move PPB to its own host account (Netlify/Firebase Hosting), update this section.

---

## 5) Backing Up Your Data
Do this regularly (recommended: monthly).

1. Log into PPB Designs
2. Click the **Backup** button in the top bar
3. In the backup modal, click **Export**
4. Save the file (`PPBDesigns-backup-YYYY-MM-DD.json`) somewhere safe:
   - OneDrive
   - email copy to yourself
   - optional USB copy

### Restore steps
1. Open PPB Designs
2. Click **Backup**
3. In restore/import, choose your saved backup JSON
4. Confirm restore (this replaces current data)

---

## 6) If the Site Stops Working
Your Firebase data should still be safe.

1. Contact a developer (or use this project guide)
2. Use the latest `PPBDesigns.html` file from your project backup
3. Redeploy the file to your hosting account
4. Sign in again with approved Google account

---

## 7) Deployment Source
### Single-file deployment
- **Main file name:** `PPBDesigns.html`
- **Repo/project path:** `StringArtStudio/Working Version/PPBDesigns.html`
- **Backup copy location:** `[add your OneDrive backup path here]`

### GitHub
- **Repository:** `https://github.com/stephrawlingscreations-lab/stringartstudio`
- **Default branch:** `main`

---

## 8) Domain Details
- **Custom domain in use:** `No` (uses main site path URL)
- **Live route:** `/PPBDesigns.html`
- **Robots:** blocked from indexing via `robots.txt` (`Disallow: /PPBDesigns.html`)

---

## 9) Ownership Summary
- **Website/project owner:** `Steph Rawlings`
- **Firebase owner:** `Steph Rawlings` *(and/or PPB account owner if transferred)*
- **Primary business login:** `ppbdesigns1@gmail.com`
- **Admin/support login:** `stephrawlingscreations@gmail.com`

---

## 10) Support Notes
- **Current support contact:** Steph Rawlings
- **Support includes:** bug fixes, updates, and backup support (as agreed)
- **Important:** keep monthly backup exports even with auto-sync enabled

---

## Quick Reference
- **Site URL:** `https://stephrawlingscreations.ie/PPBDesigns.html`
- **Primary login email:** `ppbdesigns1@gmail.com`
- **Firebase project:** `ppb-designs`
- **Backup button location:** top bar in PPB Designs app
- **Date updated:** `04/05/2026`

