# PPB Designs
## Owner Guide — Website, Data, and Backup

**Prepared:** 04/05/2026  
**Purpose:** This guide explains where PPB Designs is hosted, how to log in, how to back up data, and what to do if the site ever needs to be restored.

---

## 1) Website Address
- **Primary URL:** `https://stephrawlingscreations.ie/PPBDesigns.html` *(confirm this is your live URL)*
- Bookmark this link.

---

## 2) Login Access
1. Open the URL above  
2. Click **Sign in with Google**  
3. Use an approved email:
   - `ppbdesigns1@gmail.com` (business login)
   - `stephrawlingscreations@gmail.com` (admin/support)

---

## 3) Data Storage (Firebase)
All business data is cloud-synced in Firebase.

- **Firebase project:** `ppb-designs`
- **Auth domain:** `ppb-designs.firebaseapp.com`
- **Realtime DB:** `https://ppb-designs-default-rtdb.europe-west1.firebasedatabase.app`
- **Storage bucket:** `ppb-designs.firebasestorage.app`
- **Console:** [https://console.firebase.google.com](https://console.firebase.google.com)
- **Data path pattern:** `users/{uid}/...`

---

## 4) Hosting / Deployment
- App file: `PPBDesigns.html`
- Current source project: `StringArtStudio/Working Version/PPBDesigns.html`
- Current repo: [https://github.com/stephrawlingscreations-lab/stringartstudio](https://github.com/stephrawlingscreations-lab/stringartstudio)

> This app is currently delivered as a single-file app route under the main site.

---

## 5) Backup Procedure (Monthly minimum)
1. Log into PPB Designs  
2. Click **Backup** (top bar)  
3. Click **Export** in the backup modal  
4. Save the `.json` file somewhere safe:
   - OneDrive
   - local computer folder
   - optional email copy to yourself

### Restore Procedure
1. Open PPB Designs  
2. Click **Backup**  
3. Choose restore/import option  
4. Select the backup `.json` file  
5. Confirm restore

---

## 6) If the Site Stops Working
Your Firebase data should still be safe.

1. Contact support/developer  
2. Use latest `PPBDesigns.html` source  
3. Redeploy file to hosting  
4. Sign in and confirm data loads

---

## 7) Domain / Indexing Notes
- Route path: `/PPBDesigns.html`
- Current robots setting blocks indexing for this page
- No dedicated standalone custom domain currently in use

---

## 8) Ownership Summary
- **Business login:** `ppbdesigns1@gmail.com`
- **Admin/support:** `stephrawlingscreations@gmail.com`
- **Project owner:** Steph Rawlings *(confirm if transferring ownership later)*

---

## 9) Support Notes
- Keep monthly backups even with cloud sync enabled.
- Store at least one backup outside the browser/device.
- After major updates, export a fresh backup immediately.

---

## Quick Reference
- **Site:** `https://stephrawlingscreations.ie/PPBDesigns.html`
- **Firebase Project:** `ppb-designs`
- **Backup button:** Top bar inside app
- **Primary login:** `ppbdesigns1@gmail.com`

