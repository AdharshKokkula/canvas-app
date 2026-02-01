const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { RoomManager } = require('./rooms');
const { DrawingStateManager } = require('./drawing-state');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    // Optimize for real-time drawing
    pingTimeout: 60000,
    pingInterval: 25000
});

app.use(express.static(path.join(__dirname, '../client')));

const roomManager = new RoomManager();
const drawingStateManager = new DrawingStateManager();

// User color palette
const USER_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8B500', '#00CED1', '#FF69B4', '#32CD32', '#FF4500'
];


io.on('connection', (socket) => {
    console.log(`[Server] User connected: ${socket.id}`);

    let currentRoom = null;
    let userData = null;

    socket.on('join_room', (data) => {
        const { roomId, username } = data;
        currentRoom = roomId || 'default';

        if (!roomManager.roomExists(currentRoom)) {
            roomManager.createRoom(currentRoom);
            drawingStateManager.initializeRoom(currentRoom);
        }

        const roomUsers = roomManager.getRoomUsers(currentRoom);
        const colorIndex = roomUsers.length % USER_COLORS.length;

        userData = {
            id: socket.id,
            username: username || `User_${socket.id.slice(0, 4)}`,
            color: USER_COLORS[colorIndex],
            cursorPosition: { x: 0, y: 0 }
        };

        socket.join(currentRoom);
        roomManager.addUserToRoom(currentRoom, userData);

        socket.emit('room_joined', {
            roomId: currentRoom,
            user: userData,
            users: roomManager.getRoomUsers(currentRoom),
            drawingHistory: drawingStateManager.getHistory(currentRoom),
            historyIndex: drawingStateManager.getHistoryIndex(currentRoom)
        });

        socket.to(currentRoom).emit('user_joined', {
            user: userData,
            users: roomManager.getRoomUsers(currentRoom)
        });

        console.log(`[Server] ${userData.username} joined room: ${currentRoom}`);
    });

    socket.on('drawing_start', (data) => {
        if (!currentRoom || !userData) return;

        const strokeData = {
            id: data.id,
            userId: socket.id,
            username: userData.username,
            userColor: userData.color,
            points: [data.point],
            color: data.color,
            width: data.width,
            tool: data.tool,
            timestamp: Date.now()
        };

        socket.to(currentRoom).emit('drawing_start', {
            ...strokeData,
            userId: socket.id
        });
    });

    socket.on('drawing_step', (data) => {
        if (!currentRoom || !userData) return;

        socket.to(currentRoom).emit('drawing_step', {
            strokeId: data.strokeId,
            userId: socket.id,
            point: data.point
        });
    });


    socket.on('drawing_end', (data) => {
        if (!currentRoom || !userData) return;

        const completeStroke = {
            id: data.strokeId,
            userId: socket.id,
            username: userData.username,
            userColor: userData.color,
            points: data.points,
            color: data.color,
            width: data.width,
            tool: data.tool,
            timestamp: Date.now()
        };

        drawingStateManager.addStroke(currentRoom, completeStroke);

        // Notify room about completed stroke with history index
        io.to(currentRoom).emit('stroke_complete', {
            stroke: completeStroke,
            historyIndex: drawingStateManager.getHistoryIndex(currentRoom)
        });

        console.log(`[Server] Stroke completed by ${userData.username}, history index: ${drawingStateManager.getHistoryIndex(currentRoom)}`);
    });

    // Handle cursor position updates
    socket.on('cursor_move', (data) => {
        if (!currentRoom || !userData) return;

        userData.cursorPosition = data.position;
        roomManager.updateUserCursor(currentRoom, socket.id, data.position);

        // Broadcast cursor position to others
        socket.to(currentRoom).emit('cursor_update', {
            userId: socket.id,
            username: userData.username,
            color: userData.color,
            position: data.position
        });
    });

    // Handle GLOBAL UNDO request
    socket.on('undo_request', () => {
        if (!currentRoom) return;

        const result = drawingStateManager.undo(currentRoom);

        if (result.success) {
            io.to(currentRoom).emit('undo_performed', {
                initiatedBy: userData.username,
                historyIndex: result.historyIndex,
                undoneStroke: result.undoneStroke
            });

            console.log(`[Server] UNDO by ${userData.username}, new index: ${result.historyIndex}`);
        } else {
            socket.emit('undo_failed', { reason: 'Nothing to undo' });
        }
    });

    // Handle GLOBAL REDO request
    socket.on('redo_request', () => {
        if (!currentRoom) return;

        const result = drawingStateManager.redo(currentRoom);

        if (result.success) {
            io.to(currentRoom).emit('redo_performed', {
                initiatedBy: userData.username,
                historyIndex: result.historyIndex,
                redoneStroke: result.redoneStroke
            });

            console.log(`[Server] REDO by ${userData.username}, new index: ${result.historyIndex}`);
        } else {
            socket.emit('redo_failed', { reason: 'Nothing to redo' });
        }
    });

    // Handle canvas clear request
    socket.on('clear_canvas', () => {
        if (!currentRoom || !userData) return;
        drawingStateManager.clearHistory(currentRoom);
        io.to(currentRoom).emit('canvas_cleared', {
            initiatedBy: userData.username,
            timestamp: Date.now(),
            historyIndex: -1  // Confirm history is empty
        });

        console.log(`[Server] Canvas cleared by ${userData.username} in room: ${currentRoom}`);
    });

    socket.on('disconnect', () => {
        if (currentRoom && userData) {
            roomManager.removeUserFromRoom(currentRoom, socket.id);

            socket.to(currentRoom).emit('user_left', {
                userId: socket.id,
                username: userData.username,
                users: roomManager.getRoomUsers(currentRoom)
            });

            console.log(`[Server] ${userData.username} left room: ${currentRoom}`);

            if (roomManager.getRoomUsers(currentRoom).length === 0) {
                roomManager.deleteRoom(currentRoom);
                drawingStateManager.deleteRoom(currentRoom);
                console.log(`[Server] Room ${currentRoom} deleted (empty)`);
            }
        }

        console.log(`[Server] User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = { app, io };
