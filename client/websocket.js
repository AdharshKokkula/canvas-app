class WebSocketManager {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.roomId = null;
        this.userData = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;

        // Callbacks
        this.onConnect = null;
        this.onDisconnect = null;
        this.onRoomJoined = null;
        this.onUserJoined = null;
        this.onUserLeft = null;
        this.onDrawingStart = null;
        this.onDrawingStep = null;
        this.onStrokeComplete = null;
        this.onCursorUpdate = null;
        this.onUndoPerformed = null;
        this.onRedoPerformed = null;
        this.onCanvasCleared = null;
    }

    connect() {
        const serverUrl = window.location.origin;
        console.log(`[WebSocket] Connecting to ${serverUrl}...`);

        this.socket = io(serverUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: this.maxReconnectAttempts
        });

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.socket.on('connect', () => {
            console.log('[WebSocket] Connected!');
            this.connected = true;
            this.reconnectAttempts = 0;
            if (this.onConnect) this.onConnect();
        });

        this.socket.on('disconnect', (reason) => {
            console.log(`[WebSocket] Disconnected: ${reason}`);
            this.connected = false;
            if (this.onDisconnect) this.onDisconnect(reason);
        });

        this.socket.on('connect_error', (error) => {
            console.error('[WebSocket] Connection error:', error);
            this.reconnectAttempts++;
        });

        this.socket.on('room_joined', (data) => {
            console.log('[WebSocket] Joined room:', data.roomId);
            this.roomId = data.roomId;
            this.userData = data.user;
            if (this.onRoomJoined) this.onRoomJoined(data);
        });

        this.socket.on('user_joined', (data) => {
            console.log('[WebSocket] User joined:', data.user.username);
            if (this.onUserJoined) this.onUserJoined(data);
        });

        this.socket.on('user_left', (data) => {
            console.log('[WebSocket] User left:', data.username);
            if (this.onUserLeft) this.onUserLeft(data);
        });

        this.socket.on('drawing_start', (data) => {
            if (this.onDrawingStart) this.onDrawingStart(data);
        });

        this.socket.on('drawing_step', (data) => {
            if (this.onDrawingStep) this.onDrawingStep(data);
        });

        this.socket.on('stroke_complete', (data) => {
            if (this.onStrokeComplete) this.onStrokeComplete(data);
        });

        this.socket.on('cursor_update', (data) => {
            if (this.onCursorUpdate) this.onCursorUpdate(data);
        });

        this.socket.on('undo_performed', (data) => {
            console.log('[WebSocket] Undo performed by:', data.initiatedBy);
            if (this.onUndoPerformed) this.onUndoPerformed(data);
        });

        this.socket.on('redo_performed', (data) => {
            console.log('[WebSocket] Redo performed by:', data.initiatedBy);
            if (this.onRedoPerformed) this.onRedoPerformed(data);
        });

        this.socket.on('canvas_cleared', (data) => {
            console.log('[WebSocket] Canvas cleared by:', data.initiatedBy);
            if (this.onCanvasCleared) this.onCanvasCleared(data);
        });

        this.socket.on('undo_failed', (data) => {
            console.log('[WebSocket] Undo failed:', data.reason);
        });

        this.socket.on('redo_failed', (data) => {
            console.log('[WebSocket] Redo failed:', data.reason);
        });
    }

    joinRoom(roomId, username) {
        if (!this.socket) return;
        this.socket.emit('join_room', { roomId, username });
    }

    sendDrawingStart(data) {
        if (!this.socket || !this.connected) return;
        this.socket.emit('drawing_start', data);
    }

    sendDrawingStep(data) {
        if (!this.socket || !this.connected) return;
        this.socket.emit('drawing_step', data);
    }

    sendDrawingEnd(data) {
        if (!this.socket || !this.connected) return;
        this.socket.emit('drawing_end', data);
    }

    sendCursorMove(position) {
        if (!this.socket || !this.connected) return;
        this.socket.emit('cursor_move', { position });
    }

    requestUndo() {
        if (!this.socket || !this.connected) return;
        this.socket.emit('undo_request');
    }

    requestRedo() {
        if (!this.socket || !this.connected) return;
        this.socket.emit('redo_request');
    }

    requestClearCanvas() {
        if (!this.socket || !this.connected) return;
        this.socket.emit('clear_canvas');
    }

    isConnected() {
        return this.connected;
    }

    getUserData() {
        return this.userData;
    }

    getRoomId() {
        return this.roomId;
    }
}

window.WebSocketManager = WebSocketManager;
