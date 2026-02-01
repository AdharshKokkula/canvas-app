class DrawingStateManager {
    constructor() {
        this.roomStates = new Map();
        this.MAX_HISTORY_LENGTH = 500;
    }

    initializeRoom(roomId) {
        this.roomStates.set(roomId, {
            history: [],
            historyIndex: -1,
            createdAt: Date.now(),
            lastModified: Date.now()
        });
        console.log(`[DrawingState] Initialized room: ${roomId}`);
    }

    addStroke(roomId, stroke) {
        const state = this.roomStates.get(roomId);
        if (!state) {
            console.error(`[DrawingState] Room not found: ${roomId}`);
            return;
        }

        if (state.historyIndex < state.history.length - 1) {
            state.history = state.history.slice(0, state.historyIndex + 1);
            console.log(`[DrawingState] Truncated future history at index ${state.historyIndex}`);
        }

        state.history.push({
            ...stroke,
            addedAt: Date.now()
        });
        state.historyIndex = state.history.length - 1;
        state.lastModified = Date.now();

        if (state.history.length > this.MAX_HISTORY_LENGTH) {
            const removeCount = state.history.length - this.MAX_HISTORY_LENGTH;
            state.history = state.history.slice(removeCount);
            state.historyIndex -= removeCount;
            console.log(`[DrawingState] Trimmed old history, removed ${removeCount} strokes`);
        }

        console.log(`[DrawingState] Stroke added. Room ${roomId}, index: ${state.historyIndex}, total: ${state.history.length}`);
    }

    undo(roomId) {
        const state = this.roomStates.get(roomId);
        if (!state) {
            return { success: false, reason: 'Room not found' };
        }

        if (state.historyIndex < 0) {
            return { success: false, reason: 'Nothing to undo' };
        }
        const undoneStroke = state.history[state.historyIndex];

        state.historyIndex--;
        state.lastModified = Date.now();

        console.log(`[DrawingState] UNDO performed. Room ${roomId}, new index: ${state.historyIndex}`);

        return {
            success: true,
            historyIndex: state.historyIndex,
            undoneStroke: undoneStroke
        };
    }

    redo(roomId) {
        const state = this.roomStates.get(roomId);
        if (!state) {
            return { success: false, reason: 'Room not found' };
        }

        if (state.historyIndex >= state.history.length - 1) {
            return { success: false, reason: 'Nothing to redo' };
        }
        state.historyIndex++;

        const redoneStroke = state.history[state.historyIndex];
        state.lastModified = Date.now();

        console.log(`[DrawingState] REDO performed. Room ${roomId}, new index: ${state.historyIndex}`);

        return {
            success: true,
            historyIndex: state.historyIndex,
            redoneStroke: redoneStroke
        };
    }

    getHistory(roomId) {
        const state = this.roomStates.get(roomId);
        if (!state) {
            return [];
        }
        return state.history.slice(0, state.historyIndex + 1);
    }

    getHistoryIndex(roomId) {
        const state = this.roomStates.get(roomId);
        return state ? state.historyIndex : -1;
    }

    clearHistory(roomId) {
        const state = this.roomStates.get(roomId);
        if (state) {
            state.history = [];
            state.historyIndex = -1;
            state.lastModified = Date.now();
            console.log(`[DrawingState] History cleared for room: ${roomId}`);
        }
    }

    deleteRoom(roomId) {
        this.roomStates.delete(roomId);
        console.log(`[DrawingState] Room state deleted: ${roomId}`);
    }

    getStats(roomId) {
        const state = this.roomStates.get(roomId);
        if (!state) {
            return null;
        }
        return {
            totalStrokes: state.history.length,
            currentIndex: state.historyIndex,
            activeStrokes: state.historyIndex + 1,
            undoAvailable: state.historyIndex >= 0,
            redoAvailable: state.historyIndex < state.history.length - 1,
            createdAt: state.createdAt,
            lastModified: state.lastModified
        };
    }
}

module.exports = { DrawingStateManager };
