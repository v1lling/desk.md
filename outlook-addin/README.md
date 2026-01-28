# Orbit Outlook Add-in

Opens emails from Outlook in the Orbit desktop app for AI-assisted workflows.

## How It Works

1. Click "Open in Orbit" button in Outlook ribbon
2. Add-in extracts email data (subject, from, body, etc.)
3. Opens `orbit://email?data={base64}` deep link
4. Orbit app receives the email and opens it in a new tab

## Development Setup

### Prerequisites

- Orbit desktop app installed in `/Applications` (macOS)
- Node.js 18+
- Outlook (desktop or web)

### Run Locally

```bash
cd outlook-addin
npm install

# Install SSL certificates (required once)
npm run certs

# Validate manifest
npm run validate

# Start HTTPS server
npm run dev
# Serves add-in at https://localhost:3000
```

### Sideload in Outlook

#### Outlook on the Web
1. Go to https://outlook.office.com
2. Click Settings (gear icon) → View all Outlook settings
3. Go to Mail → Customize actions → Add-ins
4. Click "My add-ins" → "Add a custom add-in" → "Add from file"
5. Select the `manifest.xml` file

#### Outlook Desktop (Windows)
1. Open Outlook
2. File → Manage Add-ins (opens browser)
3. Click "My add-ins" → "Add a custom add-in" → "Add from file"
4. Select the `manifest.xml` file

#### Outlook Desktop (Mac)
1. Open Outlook
2. Go to Home tab → Get Add-ins → My add-ins
3. Click "+ Add a custom add-in" → "Add from file"
4. Select the `manifest.xml` file

### Trust the orbit:// Protocol

On first use, you may need to allow the `orbit://` protocol:

**macOS**: The Orbit app must be built and installed in /Applications for the protocol to work.

**Windows**: You may see a security prompt asking to open the Orbit app.

## Files

| File | Purpose |
|------|---------|
| `manifest.xml` | Office Add-in manifest (defines capabilities, UI) |
| `src/commands.html` | Host page for ribbon button commands |
| `src/commands.js` | Button click handler - extracts email, opens deep link |
| `src/taskpane.html` | Optional taskpane UI |
| `src/taskpane.js` | Taskpane logic |

## Production Deployment

For production use:

1. Host the add-in files on HTTPS (Azure, Vercel, etc.)
2. Update URLs in `manifest.xml` to point to hosted location
3. Add proper icons (16x16, 32x32, 80x80 PNG)
4. Publish via Microsoft AppSource or deploy to organization

## Troubleshooting

### "orbit://" link doesn't work
- Make sure Orbit.app is installed in /Applications (macOS)
- Try building Orbit with `npm run tauri build -- --debug` first
- Check if the deep link works manually: `open "orbit://email?data=..."`

### Add-in doesn't appear in Outlook
- Clear Outlook cache and restart
- Check browser console for errors (Outlook web)
- Verify manifest.xml is valid XML

### Email body is empty
- Check Office.js permissions in manifest
- Ensure `ReadItem` permission is granted
