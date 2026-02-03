# Installation Guide (Mac)

**No Terminal Required!** This tool uses simple double-click launchers.

---

## Prerequisites

You need **Node.js** installed on your Mac.

### Check if Node.js is installed:
Open Terminal and run:
```bash
node --version
```

If you see a version like `v18.x.x` or higher, you're ready!

If not, download from: **https://nodejs.org** (get the LTS version)

---

## Installation (One Time Only)

1. **Double-click:** `install.sh`
2. **Wait for:** "Installation successful!" message
3. **Done!** 🎉

### Mac Security Note
If you see "install.sh can't be opened because it is from an unidentified developer":

1. Go to **System Preferences** → **Security & Privacy**
2. Click **"Open Anyway"** next to the blocked message
3. Click **"Open"** in the confirmation dialog

---

## Using the Tool

### Start the Tool
**Double-click:** `START - Blueshift Tool.command`

- A Terminal window will open (keep it open!)
- Your browser opens automatically to the tool
- Ready to use!

### Stop the Tool
**Double-click:** `STOP - Blueshift Tool.command`

---

## Step-by-Step Usage

Once your browser opens:

### 1. Enter API Configuration
- **API Key:** Get from Blueshift → Account Settings → API Keys (User API Key)
- **Region:** Select US or EU

### 2. Upload CSV File
- Drag and drop your CSV file
- Or click to browse
- Check "CSV file has headers" if first row has column names
- Preview shows first 5 rows

### 3. Configure Options
- **Column:** Select which column has the identifiers
- **Identifier Type:** Choose email, customer_id, device_id, or cookie
- **Delete All:** Optional - delete all matching profiles (up to 50)

### 4. Start Processing
- Click "Start Batch Delete"
- Confirm the deletion
- Watch real-time progress
- See live log of successes/failures

### 5. Review Results
- Summary statistics
- Download failed records (if any)
- Download full log
- Click "Start New Batch" for another file

---

## Getting Your Blueshift API Key

1. Log into your Blueshift account
2. Go to **Account Settings** → **API Keys**
3. Copy your **User API Key** (NOT the Event API Key)
4. Paste into the web interface

**Important:** API keys are **never stored** - enter each session.

---

## CSV File Format

Your CSV should look like:
```csv
email,name,status
user1@example.com,John Doe,inactive
user2@example.com,Jane Smith,inactive
```

- Headers in first row (recommended)
- One column with customer identifiers
- Any additional columns are fine (ignored)

See `customers.csv.example` for a sample file.

---

## Troubleshooting

### Port 3000 Already in Use
Another instance is running. Stop it first:
- Double-click `STOP - Blueshift Tool.command`

Or use a different port:
```bash
PORT=3001 npm start
```
Then open: http://localhost:3001

### Browser Doesn't Open Automatically
Manually open: **http://localhost:3000**

### "Node.js is not installed"
Download Node.js from: **https://nodejs.org** (LTS version)

### Cannot find module 'express'
Run the installer again:
- Double-click `install.sh`

### Mac Security Warning
See "Mac Security Note" section above

### Terminal Window Closes Immediately
This usually means an error occurred. Try:
1. Open Terminal manually
2. Navigate to the tool folder: `cd /path/to/blueshift-api-test`
3. Run: `npm start`
4. Check for error messages

---

## Important Security Notes

✅ **API keys never stored** - Only in memory during use
✅ **Runs locally** - No shared server
✅ **Files auto-deleted** - Uploads cleaned after processing
✅ **Logs are local** - Saved in `logs/` folder on your Mac

---

## Advanced: Command Line Usage

If you prefer using Terminal:

```bash
# Start
npm start

# Stop
Press Ctrl+C
```

---

## Getting Updates

When a new version is shared:

1. Stop the tool (if running)
2. Replace the folder with the new version
3. Run `install.sh` again
4. Start using the new version

---

## Files You'll Use

- **First time:** `install.sh`
- **Every time:** `START - Blueshift Tool.command`
- **When done:** `STOP - Blueshift Tool.command`
- **Visual help:** `LAUNCHER.html`
- **This guide:** `INSTALL.md`
- **Quick start:** `START HERE.md`

---

## Need More Help?

1. Open `LAUNCHER.html` for visual guide
2. See `START HERE.md` for quick reference
3. Contact your team administrator

---

**Ready to get started?** Double-click `install.sh`!
