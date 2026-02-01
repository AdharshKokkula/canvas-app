class RoomManager {
    constructor() {
        this.rooms = new Map();
    }

    createRoom(roomId) {
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, {
                id: roomId,
                users: new Map(),
                createdAt: Date.now()
            });
            console.log(`[RoomManager] Room created: ${roomId}`);
        }
        return this.rooms.get(roomId);
    }

    roomExists(roomId) {
        return this.rooms.has(roomId);
    }

    addUserToRoom(roomId, userData) {
        const room = this.rooms.get(roomId);
        if (room) {
            room.users.set(userData.id, {
                ...userData,
                joinedAt: Date.now()
            });
            console.log(`[RoomManager] User ${userData.username} added to room ${roomId}`);
        }
    }

    removeUserFromRoom(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (room) {
            const user = room.users.get(userId);
            room.users.delete(userId);
            console.log(`[RoomManager] User ${user?.username || userId} removed from room ${roomId}`);
        }
    }

    updateUserCursor(roomId, userId, position) {
        const room = this.rooms.get(roomId);
        if (room && room.users.has(userId)) {
            const user = room.users.get(userId);
            user.cursorPosition = position;
        }
    }

    getRoomUsers(roomId) {
        const room = this.rooms.get(roomId);
        if (room) {
            return Array.from(room.users.values());
        }
        return [];
    }

    getUser(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (room) {
            return room.users.get(userId);
        }
        return null;
    }

    deleteRoom(roomId) {
        this.rooms.delete(roomId);
        console.log(`[RoomManager] Room deleted: ${roomId}`);
    }

    getAllRooms() {
        return Array.from(this.rooms.keys());
    }

    getRoomStats(roomId) {
        const room = this.rooms.get(roomId);
        if (room) {
            return {
                id: roomId,
                userCount: room.users.size,
                createdAt: room.createdAt,
                uptime: Date.now() - room.createdAt
            };
        }
        return null;
    }
}

module.exports = { RoomManager };
