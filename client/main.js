class CanvasApp {
    constructor() {
        this.canvas = null;
        this.ws = null;
        this.users = new Map();
        this.cursors = new Map();

        this.init();
    }

    init() {
        this.setupJoinModal();
    }

    setupJoinModal() {
        const joinBtn = document.getElementById('joinButton');
        const usernameInput = document.getElementById('usernameInput');
        const roomInput = document.getElementById('roomInput');

        joinBtn.addEventListener('click', () => this.handleJoin());
        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleJoin();
        });
        roomInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleJoin();
        });

        usernameInput.focus();
    }

    handleJoin() {
        const username = document.getElementById('usernameInput').value.trim() || 'Anonymous';
        const roomId = document.getElementById('roomInput').value.trim() || 'default';

        document.getElementById('joinModal').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');

        this.initializeApp(username, roomId);
    }

    initializeApp(username, roomId) {
        this.canvas = new CanvasManager();
        this.ws = new WebSocketManager();

        this.setupCanvasCallbacks();
        this.setupWebSocketCallbacks();
        this.setupUIControls();
        this.setupKeyboardShortcuts();

        this.ws.connect();

        setTimeout(() => {
            if (this.ws.isConnected()) {
                this.ws.joinRoom(roomId, username);
            } else {
                const checkConnection = setInterval(() => {
                    if (this.ws.isConnected()) {
                        this.ws.joinRoom(roomId, username);
                        clearInterval(checkConnection);
                    }
                }, 100);
            }
        }, 100);
    }

    setupCanvasCallbacks() {
        this.canvas.onStrokeStart = (data) => {
            this.ws.sendDrawingStart(data);
        };

        this.canvas.onStrokeStep = (data) => {
            this.ws.sendDrawingStep(data);
        };

        this.canvas.onStrokeEnd = (data) => {
            this.ws.sendDrawingEnd(data);
        };

        this.canvas.onCursorMove = (position) => {
            this.ws.sendCursorMove(position);
        };
    }

    setupWebSocketCallbacks() {
        this.ws.onConnect = () => {
            this.updateConnectionStatus(true);
        };

        this.ws.onDisconnect = () => {
            this.updateConnectionStatus(false);
        };

        this.ws.onRoomJoined = (data) => {
            document.getElementById('roomName').textContent = data.roomId;
            this.updateCurrentUser(data.user);
            data.users.forEach(user => this.addUser(user));
            if (data.drawingHistory && data.drawingHistory.length > 0) {
                this.canvas.setStrokes(data.drawingHistory);
            }
            this.updateHistoryCount();
            this.showToast('Connected', `Joined room: ${data.roomId}`, '🎨');
        };

        this.ws.onUserJoined = (data) => {
            this.addUser(data.user);
            this.showToast('User Joined', `${data.user.username} joined`, '👋');
        };

        this.ws.onUserLeft = (data) => {
            this.removeUser(data.userId);
            this.removeCursor(data.userId);
            this.showToast('User Left', `${data.username} left`, '👋');
        };

        this.ws.onDrawingStart = (data) => {
            this.canvas.remoteStrokeStart(data);
        };

        this.ws.onDrawingStep = (data) => {
            this.canvas.remoteStrokeStep(data);
        };

        this.ws.onStrokeComplete = (data) => {
            this.canvas.remoteStrokeComplete(data.stroke);
            this.updateHistoryCount();
            this.addActivity(data.stroke.username, data.stroke.userColor, 'drew');
        };

        this.ws.onCursorUpdate = (data) => {
            this.updateRemoteCursor(data);
        };

        this.ws.onUndoPerformed = (data) => {
            this.canvas.handleUndo(data.historyIndex);
            this.updateHistoryCount();
            this.showToast('Undo', `${data.initiatedBy} undid a stroke`, '↩️');
        };

        this.ws.onRedoPerformed = (data) => {
            this.canvas.handleRedo(data.redoneStroke);
            this.updateHistoryCount();
            this.showToast('Redo', `${data.initiatedBy} redid a stroke`, '↪️');
        };

        this.ws.onCanvasCleared = (data) => {
            // Clear all canvas drawings
            this.canvas.clearAll();

            // Clear activity history
            this.clearActivityList();

            // Update stroke count display
            this.updateHistoryCount();

            // Show notification
            this.showToast('Canvas Cleared', `${data.initiatedBy} cleared the canvas`, '🗑️');
        };
    }

    setupUIControls() {
        // Tool buttons
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.canvas.setTool(btn.dataset.tool);
            });
        });

        // Color picker
        const colorPicker = document.getElementById('colorPicker');
        const colorPreview = document.getElementById('colorPreview');
        colorPicker.addEventListener('input', (e) => {
            this.canvas.setColor(e.target.value);
            colorPreview.style.background = e.target.value;
            document.querySelectorAll('.color-preset').forEach(p => p.classList.remove('active'));
        });

        // Color presets
        document.querySelectorAll('.color-preset').forEach(preset => {
            preset.addEventListener('click', () => {
                const color = preset.dataset.color;
                this.canvas.setColor(color);
                colorPicker.value = color;
                colorPreview.style.background = color;
                document.querySelectorAll('.color-preset').forEach(p => p.classList.remove('active'));
                preset.classList.add('active');
            });
        });

        // Stroke width
        const strokeWidth = document.getElementById('strokeWidth');
        const strokeWidthValue = document.getElementById('strokeWidthValue');
        strokeWidth.addEventListener('input', (e) => {
            this.canvas.setStrokeWidth(e.target.value);
            strokeWidthValue.textContent = e.target.value + 'px';
        });

        // Undo/Redo buttons
        document.getElementById('undoBtn').addEventListener('click', () => this.ws.requestUndo());
        document.getElementById('redoBtn').addEventListener('click', () => this.ws.requestRedo());

        // Clear button
        document.getElementById('clearBtn').addEventListener('click', () => {
            if (confirm('Clear the canvas for everyone?')) {
                this.ws.requestClearCanvas();
            }
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;

            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                this.ws.requestUndo();
            } else if (e.ctrlKey && e.key === 'y') {
                e.preventDefault();
                this.ws.requestRedo();
            } else if (e.key === 'b') {
                document.getElementById('brushTool').click();
            } else if (e.key === 'e') {
                document.getElementById('eraserTool').click();
            }
        });
    }

    updateConnectionStatus(connected) {
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-text');
        if (connected) {
            statusDot.classList.add('connected');
            statusText.textContent = 'Connected';
        } else {
            statusDot.classList.remove('connected');
            statusText.textContent = 'Disconnected';
        }
    }

    updateCurrentUser(user) {
        const avatar = document.getElementById('currentUserAvatar');
        const name = document.getElementById('currentUserName');
        avatar.textContent = user.username.charAt(0).toUpperCase();
        avatar.style.background = user.color;
        name.textContent = user.username + ' (You)';
    }

    addUser(user) {
        this.users.set(user.id, user);
        this.renderUsersList();
    }

    removeUser(userId) {
        this.users.delete(userId);
        this.renderUsersList();
    }

    renderUsersList() {
        const list = document.getElementById('usersList');
        const count = document.getElementById('userCount');
        list.innerHTML = '';
        count.textContent = this.users.size;

        const currentUserId = this.ws.getUserData()?.id;

        this.users.forEach(user => {
            const isCurrentUser = user.id === currentUserId;
            const item = document.createElement('div');
            item.className = 'user-item' + (isCurrentUser ? ' current-user-item' : '');
            item.innerHTML = `
                <div class="user-avatar" style="background: ${user.color}">${user.username.charAt(0).toUpperCase()}</div>
                <div class="user-info">
                    <div class="user-name">${user.username}${isCurrentUser ? ' (You)' : ''}</div>
                    <div class="user-status">Online</div>
                </div>
            `;
            list.appendChild(item);
        });
    }

    updateRemoteCursor(data) {
        let cursor = this.cursors.get(data.userId);

        if (!cursor) {
            cursor = document.createElement('div');
            cursor.className = 'remote-cursor';
            cursor.innerHTML = `
                <div class="cursor-pointer" style="color: ${data.color}"></div>
                <div class="cursor-label" style="background: ${data.color}"><span>${data.username}</span></div>
            `;
            document.getElementById('cursorsLayer').appendChild(cursor);
            this.cursors.set(data.userId, cursor);
        }

        cursor.style.transform = `translate(${data.position.x}px, ${data.position.y}px)`;
    }

    removeCursor(userId) {
        const cursor = this.cursors.get(userId);
        if (cursor) {
            cursor.remove();
            this.cursors.delete(userId);
        }
    }

    updateHistoryCount() {
        const count = this.canvas.getStrokeCount();
        document.getElementById('historyCount').textContent = count + ' stroke' + (count !== 1 ? 's' : '');
    }

    addActivity(username, color, action) {
        const list = document.getElementById('activityList');
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `<span class="user-color" style="background: ${color}"></span>${username} ${action}`;
        list.insertBefore(item, list.firstChild);
        if (list.children.length > 10) list.removeChild(list.lastChild);
    }

    clearActivityList() {
        const list = document.getElementById('activityList');
        list.innerHTML = '';
        console.log('[App] Activity list cleared');
    }

    showToast(title, message, icon = '📢') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CanvasApp();
});
