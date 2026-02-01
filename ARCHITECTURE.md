# Architecture Documentation

## Overview

This document describes the technical architecture of the Canvas application, including data flow, WebSocket protocol, undo/redo strategy, and performance optimizations.

---

## 1. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT A (Drawing)                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │ Mouse Event  │───▶│ CanvasManager│───▶│  WebSocket   │                  │
│  │   Handler    │    │ (Drawing)    │    │   Client     │                  │
│  └──────────────┘    └──────────────┘    └──────┬───────┘                  │
└──────────────────────────────────────────────────┼──────────────────────────┘
                                                   │
                                                   ▼
                    ┌──────────────────────────────────────────────────────┐
                    │                    SERVER                             │
                    │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │
                    │  │   Socket.io │  │ RoomManager │  │ DrawingState │  │
                    │  │   Handler   │──│   (Users)   │──│  (History)   │  │
                    │  └─────────────┘  └─────────────┘  └──────────────┘  │
                    └──────────────────────────────────────────────────────┘
                                                   │
                    ┌──────────────────────────────┼──────────────────────┐
                    │                              ▼                       │
┌──────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT B (Receiving)                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │  WebSocket   │───▶│ CanvasManager│───▶│   Canvas     │                   │
│  │   Client     │    │ (Remote Draw)│    │   (Render)   │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Steps

1. **User A starts drawing** → Mouse event captured
2. **CanvasManager** draws to preview canvas & extracts coordinates
3. **WebSocket sends** `drawing_start` event to server
4. **Server broadcasts** to all other clients in room
5. **Client B receives** and renders to preview canvas
6. **User A moves mouse** → `drawing_step` events sent (high frequency)
7. **User A releases mouse** → `drawing_end` with complete stroke
8. **Server adds to history** and broadcasts `stroke_complete`
9. **All clients** transfer stroke from preview to main canvas

---

## 2. WebSocket Protocol

### Event Types

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join_room` | `{ roomId, username }` | Join/create a room |
| `drawing_start` | `{ id, point, color, width, tool }` | Start a new stroke |
| `drawing_step` | `{ strokeId, point }` | Add point to current stroke |
| `drawing_end` | `{ strokeId, points, color, width, tool }` | Complete stroke |
| `cursor_move` | `{ position: { x, y } }` | Cursor position update |
| `undo_request` | - | Request global undo |
| `redo_request` | - | Request global redo |
| `clear_canvas` | - | Clear canvas for all |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `room_joined` | `{ roomId, user, users, drawingHistory, historyIndex }` | Joined room with state |
| `user_joined` | `{ user, users }` | New user joined |
| `user_left` | `{ userId, username, users }` | User disconnected |
| `drawing_start` | `{ id, userId, point, color, width, tool }` | Remote stroke started |
| `drawing_step` | `{ strokeId, userId, point }` | Remote stroke point |
| `stroke_complete` | `{ stroke, historyIndex }` | Stroke finalized |
| `cursor_update` | `{ userId, username, color, position }` | Remote cursor moved |
| `undo_performed` | `{ initiatedBy, historyIndex, undoneStroke }` | Global undo executed |
| `redo_performed` | `{ initiatedBy, historyIndex, redoneStroke }` | Global redo executed |
| `canvas_cleared` | `{ initiatedBy }` | Canvas cleared |

### Message Formats

```javascript
// Stroke Object
{
  id: "stroke_1706543210123_a1b2c3d4e",
  userId: "socket_id_here",
  username: "Alice",
  userColor: "#FF6B6B",
  points: [{ x: 100, y: 150 }, { x: 102, y: 153 }, ...],
  color: "#4ECDC4",
  width: 5,
  tool: "brush",
  timestamp: 1706543210123
}

// Point Object
{ x: 100.5, y: 200.3 }
```

---

## 3. Undo/Redo Strategy

### Global History Model

The undo/redo system is **truly global** - any user can undo any other user's stroke. This is implemented using a **stack-based model with pointer**.

```
History Array: [Stroke1, Stroke2, Stroke3, Stroke4, Stroke5]
                                          ▲
                                    historyIndex = 3

After UNDO:
History Array: [Stroke1, Stroke2, Stroke3, Stroke4, Stroke5]
                                ▲
                          historyIndex = 2

After REDO:
History Array: [Stroke1, Stroke2, Stroke3, Stroke4, Stroke5]
                                          ▲
                                    historyIndex = 3

After NEW STROKE (truncates future):
History Array: [Stroke1, Stroke2, Stroke3, NewStroke]
                                              ▲
                                        historyIndex = 3
```

### Key Design Decisions

1. **Pointer-based, not deletion-based**
   - Undo moves the pointer back, doesn't delete strokes
   - Enables redo by moving pointer forward
   - Strokes are only truly deleted when new stroke is added after undo

2. **Server is source of truth**
   - All undo/redo requests go through server
   - Server broadcasts new historyIndex to all clients
   - Clients redraw based on server's history

3. **Complete redraw on undo**
   - After undo, canvas is cleared and redrawn
   - All strokes up to historyIndex are rendered
   - Ensures consistency across clients

### Why This Approach

- **Simplicity**: Linear history is easier to reason about
- **Consistency**: All clients guaranteed to have same view
- **Fairness**: Any user can undo recent actions (team cleanup)

### Alternative Considered

**Operation Transform (OT)** or **CRDT** for conflict-free editing:
- More complex implementation
- Better for document editing
- Overkill for drawing where visual result is acceptable

---

## 4. Performance Decisions

### 1. Dual Canvas Architecture

```
┌─────────────────────────────────────────┐
│           Main Canvas                    │  ← Persistent strokes
│  (Completed strokes only)               │
├─────────────────────────────────────────┤
│         Preview Canvas                   │  ← Current stroke (ephemeral)
│  (Transparent, current stroke)          │
└─────────────────────────────────────────┘
```

**Why**: Separating completed vs in-progress drawing avoids expensive full redraws during active drawing. Only preview canvas updates during mouse move.

### 2. RequestAnimationFrame Batching

```javascript
// Instead of drawing on every mousemove:
pendingPoints.push(point);

// Animation loop batches:
requestAnimationFrame(() => {
  if (pendingPoints.length > 0) {
    drawPoints(pendingPoints);
    pendingPoints = [];
  }
});
```

**Why**: Mouse events fire at 60-120Hz. Drawing at display refresh rate (60fps) is sufficient and reduces CPU load.

### 3. Quadratic Curve Smoothing

```javascript
// Instead of lineTo (jagged):
ctx.lineTo(points[i].x, points[i].y);

// We use quadraticCurveTo (smooth):
const midX = (points[i].x + points[i+1].x) / 2;
const midY = (points[i].y + points[i+1].y) / 2;
ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
```

**Why**: Creates natural-looking curves without needing to capture more points or process higher frequency events.

### 4. High DPI Support

```javascript
const dpr = window.devicePixelRatio || 1;
canvas.width = displayWidth * dpr;
canvas.height = displayHeight * dpr;
ctx.scale(dpr, dpr);
```

**Why**: Ensures crisp lines on high-resolution displays (Retina, 4K) without blurring.

### 5. Network Optimization

- **Immediate broadcast**: `drawing_step` events sent without batching for real-time feel
- **No acknowledgment waiting**: Fire-and-forget for drawing steps (UDP-like behavior over WebSocket)
- **Complete stroke sent at end**: Full point array sent with `drawing_end` for persistence

### 6. History Management

```javascript
const MAX_HISTORY_LENGTH = 500;

if (history.length > MAX_HISTORY_LENGTH) {
  history = history.slice(removeCount);
}
```

**Why**: Prevents memory growth in long sessions. Old strokes are pruned from history (cannot undo beyond limit).

---

## 5. Conflict Handling

### Simultaneous Drawing (Same Area)

**Strategy**: Last-Write-Wins with Visual Merge

When two users draw on the same area:
1. Both strokes are added to history in arrival order
2. Both strokes are visible (layered on top of each other)
3. Timestamps ensure consistent ordering across clients

```
User A draws: ───────────────►
User B draws:      ╲──────────────►
Result:      ───────╲╲────────────► (both visible)
```

**Rationale**: For drawing applications, overlapping strokes typically create acceptable visual output. Unlike text documents, there's no "conflict" - both contributions are valid.

### Race Conditions

#### Scenario: Undo During Active Drawing

```
Time →
User A:  [drawing...] [drawing_end]
                                    Server: adds to history
User B:        [undo_request]       Server: processes undo
                                    Both clients: redraw
```

**Resolution**: Server processes events sequentially. Undo always operates on completed strokes only.

#### Scenario: Network Partition

When a client loses connection:
1. Local drawing continues (optimistic updates)
2. On reconnect, client receives full state from server
3. Client redraws to match server state (may lose local unsent strokes)

**Trade-off**: Simplicity over perfect offline support. Full offline support would require CRDT implementation.

---

## 6. Component Responsibilities

### Server Components

| Component | Responsibility |
|-----------|----------------|
| `server.js` | Socket.io server, event routing, initialization |
| `rooms.js` | Room creation, user tracking, room lifecycle |
| `drawing-state.js` | Global history, undo/redo logic, state management |

### Client Components

| Component | Responsibility |
|-----------|----------------|
| `canvas.js` | Drawing engine, coordinate handling, rendering |
| `websocket.js` | Socket.io client, event handling, reconnection |
| `main.js` | UI controls, event binding, component orchestration |

---

## 7. Security Considerations

### Current Implementation
- No authentication (room access by ID only)
- No rate limiting
- No input validation/sanitization

### Recommended for Production
1. Add JWT authentication
2. Rate limit drawing events (per user, per second)
3. Validate point coordinates (within canvas bounds)
4. Sanitize usernames
5. Add room passwords or invite links
6. Implement HTTPS for WebSocket connections

---

## 8. Scalability Path

### Current Limits
- Single Node.js process
- In-memory state (lost on restart)
- ~100 concurrent users per room (estimated)

### Scaling Strategy

1. **Horizontal Scaling**
   - Use Redis adapter for Socket.io
   - Multiple Node.js instances behind load balancer
   - Sticky sessions for WebSocket connections

2. **State Persistence**
   - Redis for active session state
   - MongoDB/PostgreSQL for long-term storage
   - Event sourcing for replay capability

3. **CDN for Static Assets**
   - Serve HTML/CSS/JS from CDN
   - Only WebSocket traffic to origin server

---

*Architecture Version: 1.0*
*Last Updated: January 2026*
