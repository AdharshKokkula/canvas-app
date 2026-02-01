# Real-Time Drawing Canvas

A multi-user drawing application where multiple people can draw simultaneously on a shared canvas. Features real-time synchronization, global undo/redo, live cursor tracking, and user management.

![Canvas](https://img.shields.io/badge/Node.js-18+-green) ![Socket.io](https://img.shields.io/badge/Socket.io-4.7-blue) ![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Features

### Drawing Tools
- 🖌️ **Brush Tool** - Smooth freehand drawing with quadratic curves
- 🧹 **Eraser Tool** - Erase with configurable width
- 🎨 **Multiple Colors** - Color picker + preset palette
- 📏 **Adjustable Stroke Width** - 1px to 50px range

### Real-Time Collaboration
- ⚡ **Live Sync** - See strokes appear as they're being drawn
- 👆 **Cursor Tracking** - See where other users are pointing
- 👥 **User Management** - Online users list with unique colors
- 🔔 **Activity Notifications** - Toast alerts for user actions

### Advanced Features
- ↩️ **Global Undo** - Any user can undo any stroke
- ↪️ **Global Redo** - Restore undone strokes
- 🗑️ **Clear Canvas** - Reset for everyone
- 💾 **History Sync** - New users get full canvas state

## 🚀 Installation & Setup

### Prerequisites
- Node.js v18 or higher
- npm or yarn

### Quick Start

1. **Clone/Navigate to project directory**
   ```bash
   cd canvas-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open in browser**
   ```
   http://localhost:3000
   ```

### Development Mode (with auto-reload)
```bash
npm run dev
```

## 🧪 Testing with Multiple Users

### Method 1: Multiple Browser Windows
1. Open `http://localhost:3000` in multiple browser windows
2. Enter different usernames for each window
3. Use the same room ID (or leave blank for "default")
4. Draw in one window and see it appear in others

### Method 2: Different Devices (Same Network)
1. Find your local IP address:
   - Windows: `ipconfig` → Look for IPv4 Address
   - Mac/Linux: `ifconfig` or `hostname -I`
2. Open `http://[YOUR_IP]:3000` on other devices
3. All devices can collaborate on the same canvas

### Method 3: Browser Incognito/Private Windows
- Open multiple incognito windows to simulate different users
- Each window acts as an independent user

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + Z` | Undo (global) |
| `Ctrl + Y` | Redo (global) |
| `B` | Select Brush tool |
| `E` | Select Eraser tool |

## 🏗️ Project Structure

```
canvas-app/
├── client/
│   ├── index.html      # Main UI structure
│   ├── style.css       # Premium dark theme styling
│   ├── canvas.js       # Canvas drawing logic (raw API)
│   ├── websocket.js    # WebSocket client
│   └── main.js         # Application entry point
├── server/
│   ├── server.js       # Express + Socket.io server
│   ├── rooms.js        # Room management
│   └── drawing-state.js # Global history & undo/redo
├── package.json
├── README.md           # This file
└── ARCHITECTURE.md     # Technical documentation
```

## 📋 Known Issues & Limitations

### Current Limitations
1. **No Persistence** - Canvas state is lost when server restarts
2. **No Authentication** - Users are identified only by name
3. **Single Canvas** - Each room has one shared canvas (no layers)
4. **Browser Support** - Tested on Chrome, Firefox, Edge (modern browsers)

### Potential Improvements
- Add database persistence (Redis/MongoDB)
- Implement user authentication
- Add shape tools (rectangle, circle, line)
- Add text tool
- Export canvas as image
- Add zoom/pan functionality
- Implement operational transform for conflict resolution
