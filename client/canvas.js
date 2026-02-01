class CanvasManager {
    constructor() {
        this.mainCanvas = document.getElementById('mainCanvas');
        this.previewCanvas = document.getElementById('previewCanvas');
        this.mainCtx = this.mainCanvas.getContext('2d');
        this.previewCtx = this.previewCanvas.getContext('2d');

        this.width = 0;
        this.height = 0;
        this.dpr = 1;
        this.isDrawing = false;
        this.currentStroke = null;
        this.currentTool = 'brush';
        this.currentColor = '#FF6B6B';
        this.strokeWidth = 5;

        this.animationFrameId = null;
        this.pendingPoints = [];
        this.lastPoint = null;
        this.strokes = [];
        this.remoteStrokes = new Map();

        this.onStrokeStart = null;
        this.onStrokeStep = null;
        this.onStrokeEnd = null;
        this.onCursorMove = null;

        this.init();
    }

    init() {
        this.resizeCanvas();
        this.setupEventListeners();
        window.addEventListener('resize', () => this.resizeCanvas());

        this.mainCanvas.classList.add('tool-brush');

        console.log('[Canvas] Initialized');
    }

    resizeCanvas() {
        const container = document.getElementById('canvasContainer');
        const rect = container.getBoundingClientRect();
        this.dpr = window.devicePixelRatio || 1;

        // Store display dimensions
        this.displayWidth = rect.width;
        this.displayHeight = rect.height;

        // Set canvas internal resolution
        this.width = Math.floor(rect.width * this.dpr);
        this.height = Math.floor(rect.height * this.dpr);

        // Set display size via CSS
        this.mainCanvas.style.width = rect.width + 'px';
        this.mainCanvas.style.height = rect.height + 'px';
        this.previewCanvas.style.width = rect.width + 'px';
        this.previewCanvas.style.height = rect.height + 'px';

        // Set actual canvas buffer size
        this.mainCanvas.width = this.width;
        this.mainCanvas.height = this.height;
        this.previewCanvas.width = this.width;
        this.previewCanvas.height = this.height;

        // Reset and apply scaling transform
        this.mainCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.previewCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        // Redraw all strokes after resize
        this.redrawAll();

        console.log(`[Canvas] Resized to ${rect.width}x${rect.height} (DPR: ${this.dpr})`);
    }

    setupEventListeners() {
        const canvas = this.mainCanvas;

        // Mouse events
        canvas.addEventListener('mousedown', (e) => this.handlePointerDown(e));
        canvas.addEventListener('mousemove', (e) => this.handlePointerMove(e));
        canvas.addEventListener('mouseup', (e) => this.handlePointerUp(e));
        canvas.addEventListener('mouseleave', (e) => this.handlePointerUp(e));

        // Touch events
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handlePointerDown(e.touches[0]);
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handlePointerMove(e.touches[0]);
        }, { passive: false });

        canvas.addEventListener('touchend', (e) => this.handlePointerUp(e));
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    getCanvasCoordinates(event) {
        const rect = this.mainCanvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

    handlePointerDown(event) {
        const point = this.getCanvasCoordinates(event);
        this.isDrawing = true;
        this.lastPoint = point;

        const strokeId = `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        this.currentStroke = {
            id: strokeId,
            points: [point],
            color: this.currentTool === 'eraser' ? '#FFFFFF' : this.currentColor,
            width: this.currentTool === 'eraser' ? this.strokeWidth * 3 : this.strokeWidth,
            tool: this.currentTool
        };

        // Draw initial point
        this.drawPoint(this.previewCtx, point, this.currentStroke.color, this.currentStroke.width);

        if (this.onStrokeStart) {
            this.onStrokeStart({
                id: strokeId,
                point: point,
                color: this.currentStroke.color,
                width: this.currentStroke.width,
                tool: this.currentTool
            });
        }

        this.startAnimationLoop();
    }

    handlePointerMove(event) {
        const point = this.getCanvasCoordinates(event);
        if (this.onCursorMove) this.onCursorMove(point);
        if (!this.isDrawing || !this.currentStroke) return;

        this.pendingPoints.push(point);
        this.currentStroke.points.push(point);

        if (this.onStrokeStep) {
            this.onStrokeStep({ strokeId: this.currentStroke.id, point: point });
        }
        this.lastPoint = point;
    }

    handlePointerUp(event) {
        if (!this.isDrawing || !this.currentStroke) return;
        this.isDrawing = false;
        this.stopAnimationLoop();

        // Transfer to main canvas even for single point
        if (this.currentStroke.points.length >= 1) {
            this.drawStrokeToMain(this.currentStroke);

            if (this.onStrokeEnd) {
                this.onStrokeEnd({
                    strokeId: this.currentStroke.id,
                    points: this.currentStroke.points,
                    color: this.currentStroke.color,
                    width: this.currentStroke.width,
                    tool: this.currentStroke.tool
                });
            }
        }

        this.clearPreview();
        this.currentStroke = null;
        this.pendingPoints = [];
        this.lastPoint = null;
    }

    startAnimationLoop() {
        const draw = () => {
            if (!this.isDrawing) return;
            if (this.pendingPoints.length > 0) {
                this.drawPreviewSegments();
                this.pendingPoints = [];
            }
            this.animationFrameId = requestAnimationFrame(draw);
        };
        this.animationFrameId = requestAnimationFrame(draw);
    }

    stopAnimationLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    drawPreviewSegments() {
        if (!this.currentStroke || this.currentStroke.points.length < 1) return;
        this.clearPreview();

        if (this.currentStroke.points.length === 1) {
            this.drawPoint(this.previewCtx, this.currentStroke.points[0], this.currentStroke.color, this.currentStroke.width);
        } else {
            this.drawSmoothPath(this.previewCtx, this.currentStroke.points, this.currentStroke.color, this.currentStroke.width);
        }
    }

    drawPoint(ctx, point, color, width) {
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(point.x, point.y, width / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    drawSmoothPath(ctx, points, color, width) {
        if (points.length < 1) return;

        if (points.length === 1) {
            this.drawPoint(ctx, points[0], color, width);
            return;
        }

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.moveTo(points[0].x, points[0].y);

        if (points.length === 2) {
            ctx.lineTo(points[1].x, points[1].y);
        } else {
            for (let i = 1; i < points.length - 1; i++) {
                const xc = (points[i].x + points[i + 1].x) / 2;
                const yc = (points[i].y + points[i + 1].y) / 2;
                ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
            }
            ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        }
        ctx.stroke();
    }

    drawStrokeToMain(stroke) {
        if (stroke.points.length === 1) {
            this.drawPoint(this.mainCtx, stroke.points[0], stroke.color, stroke.width);
        } else {
            this.drawSmoothPath(this.mainCtx, stroke.points, stroke.color, stroke.width);
        }
    }

    clearPreview() {
        this.previewCtx.save();
        this.previewCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.previewCtx.clearRect(0, 0, this.width, this.height);
        this.previewCtx.restore();
    }

    clearMain() {
        this.mainCtx.save();
        this.mainCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.mainCtx.fillStyle = '#FFFFFF';
        this.mainCtx.fillRect(0, 0, this.width, this.height);
        this.mainCtx.restore();
    }

    redrawAll() {
        this.clearMain();
        for (const stroke of this.strokes) {
            this.drawStrokeToMain(stroke);
        }
        for (const [, stroke] of this.remoteStrokes) {
            this.drawStrokeToMain(stroke);
        }
    }

    setStrokes(strokes) {
        this.strokes = strokes;
        this.redrawAll();
        console.log(`[Canvas] Loaded ${strokes.length} strokes`);
    }

    addStroke(stroke) {
        this.strokes.push(stroke);
        this.drawStrokeToMain(stroke);
    }

    handleUndo(historyIndex) {
        this.strokes = this.strokes.slice(0, historyIndex + 1);
        this.redrawAll();
        console.log(`[Canvas] Undo - now showing ${this.strokes.length} strokes`);
    }

    handleRedo(stroke) {
        this.strokes.push(stroke);
        this.drawStrokeToMain(stroke);
        console.log(`[Canvas] Redo - now showing ${this.strokes.length} strokes`);
    }

    clearAll() {
        // Stop any active drawing
        if (this.isDrawing) {
            this.isDrawing = false;
            this.stopAnimationLoop();
        }

        // Clear all stroke data
        this.strokes = [];
        this.remoteStrokes.clear();
        this.currentStroke = null;
        this.pendingPoints = [];
        this.lastPoint = null;

        // Clear both canvases
        this.clearMain();
        this.clearPreview();

        console.log('[Canvas] Cleared all drawings and state');
    }

    remoteStrokeStart(data) {
        this.remoteStrokes.set(data.id, {
            id: data.id,
            userId: data.userId,
            points: data.points || [data.point || { x: 0, y: 0 }],
            color: data.color,
            width: data.width,
            tool: data.tool
        });
    }

    remoteStrokeStep(data) {
        const stroke = this.remoteStrokes.get(data.strokeId);
        if (stroke) {
            stroke.points.push(data.point);
            // Clear and redraw preview for smooth remote drawing
            this.clearPreview();
            for (const [, s] of this.remoteStrokes) {
                if (s.points.length === 1) {
                    this.drawPoint(this.previewCtx, s.points[0], s.color, s.width);
                } else {
                    this.drawSmoothPath(this.previewCtx, s.points, s.color, s.width);
                }
            }
            // Also draw current local stroke if drawing
            if (this.currentStroke && this.currentStroke.points.length > 0) {
                if (this.currentStroke.points.length === 1) {
                    this.drawPoint(this.previewCtx, this.currentStroke.points[0], this.currentStroke.color, this.currentStroke.width);
                } else {
                    this.drawSmoothPath(this.previewCtx, this.currentStroke.points, this.currentStroke.color, this.currentStroke.width);
                }
            }
        }
    }

    remoteStrokeComplete(stroke) {
        this.remoteStrokes.delete(stroke.id);
        this.strokes.push(stroke);
        this.clearPreview();
        this.drawStrokeToMain(stroke);
    }

    setTool(tool) {
        this.currentTool = tool;

        // Update canvas cursor based on tool
        this.mainCanvas.classList.remove('tool-brush', 'tool-eraser');
        this.mainCanvas.classList.add(`tool-${tool}`);

        console.log(`[Canvas] Tool: ${tool}`);
    }

    setColor(color) {
        this.currentColor = color;
        console.log(`[Canvas] Color: ${color}`);
    }

    setStrokeWidth(width) {
        this.strokeWidth = parseInt(width);
        console.log(`[Canvas] Width: ${width}`);
    }

    getStrokeCount() {
        return this.strokes.length;
    }
}

window.CanvasManager = CanvasManager;
