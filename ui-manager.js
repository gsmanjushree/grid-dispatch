/**
 * GridDispatch UI Manager
 * Handles Canvas rendering, dashboard stats updates, interactive clicks,
 * sparkline drawing, and event bindings.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Instantiate engine
    const engine = new DispatchEngine();
    window.engine = engine; // Expose for globally triggered inline functions (like triggerSurge)
    
    // DOM Elements
    const canvas = document.getElementById('simulation-canvas');
    const ctx = canvas.getContext('2d');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const stepBtn = document.getElementById('step-btn');
    const resetBtn = document.getElementById('reset-btn');
    const simSpeedSlider = document.getElementById('sim-speed');
    const valSimSpeed = document.getElementById('val-sim-speed');
    const algoSelect = document.getElementById('algo-select');
    const algoInfo = document.getElementById('algo-info');
    
    // Hyperparameters
    const searchRadiusSlider = document.getElementById('param-search-radius');
    const valSearchRadius = document.getElementById('val-search-radius');
    const batchWindowSlider = document.getElementById('param-batch-window');
    const valBatchWindow = document.getElementById('val-batch-window');
    const rebalanceControlRow = document.getElementById('rebalance-intensity-control');
    const rebalanceRateSlider = document.getElementById('param-rebalance-rate');
    const valRebalanceRate = document.getElementById('val-rebalance-rate');
    
    // Demand / Supply densities
    const driverDensitySlider = document.getElementById('param-driver-density');
    const valDriverDensity = document.getElementById('val-driver-density');
    const demandRateSlider = document.getElementById('param-demand-rate');
    const valDemandRate = document.getElementById('val-demand-rate');
    
    // Floating map toggles
    const toggleHeatmapBtn = document.getElementById('toggle-heatmap-btn');
    const toggleGridlinesBtn = document.getElementById('toggle-gridlines-btn');
    const toggleVectorsBtn = document.getElementById('toggle-vectors-btn');
    
    // Surge buttons
    const surgeMetroBtn = document.getElementById('surge-metro-btn');
    const surgeOfficeBtn = document.getElementById('surge-office-btn');
    const surgeRandomBtn = document.getElementById('surge-random-btn');
    
    // Logs & Stats
    const consoleBox = document.getElementById('console-box');
    const clearLogsBtn = document.getElementById('clear-logs-btn');
    
    const statMatchRate = document.getElementById('stat-match-rate');
    const statAvgPickup = document.getElementById('stat-avg-pickup');
    const statUtilization = document.getElementById('stat-utilization');
    const statRevenue = document.getElementById('stat-revenue');
    const trendRevenue = document.getElementById('trend-revenue');
    const statQueueLength = document.getElementById('stat-queue-length');
    
    // Map Toggle flags
    let showHeatmap = true;
    let showGridlines = true;
    let showVectors = false;
    
    // Setup Canvas dimensions
    canvas.width = engine.width;
    canvas.height = engine.height;
    
    // --- ALGORITHM DESCRIPTIONS ---
    const algoDescriptions = {
        'greedy': '<strong>Greedy FCFS:</strong> Immediately matches waiting commuters to the nearest idle driver. High computational speed, but results in driver-side inefficiency (longer pickup times) and spatial supply deficits.',
        'batch-hungarian': '<strong>Localized Batch Hungarian:</strong> Waits for batch window interval, aggregates nearby drivers and commuters in local grid cells, and runs Hungarian optimization. Lowers pick-up distance and balances local queues.',
        'proactive-rebalance': '<strong>Proactive Rebalancing:</strong> Predicts upcoming demand deficits at major hubs and applies potential fields to guide idle drivers in neighboring cells toward those hubs. Solves supply depletion before it occurs.'
    };
    
    // --- INPUT EVENT LISTENERS ---
    
    playPauseBtn.addEventListener('click', () => {
        engine.running = !engine.running;
        playPauseBtn.textContent = engine.running ? '⏸ Pause' : '▶ Play';
        playPauseBtn.className = engine.running ? 'btn btn-secondary' : 'btn btn-primary';
    });
    
    stepBtn.addEventListener('click', () => {
        if (!engine.running) {
            engine.update();
            updateUI();
        }
    });
    
    resetBtn.addEventListener('click', () => {
        engine.resetSimulation();
        updateUI();
        if (engine.running) {
            engine.running = false;
            playPauseBtn.textContent = '▶ Play';
            playPauseBtn.className = 'btn btn-primary';
        }
    });
    
    simSpeedSlider.addEventListener('input', (e) => {
        engine.simSpeed = parseFloat(e.target.value);
        valSimSpeed.textContent = `${engine.simSpeed}x`;
    });
    
    algoSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        engine.algoType = val;
        algoInfo.innerHTML = algoDescriptions[val];
        
        // Show/hide rebalancing slider
        if (val === 'proactive-rebalance') {
            rebalanceControlRow.style.display = 'flex';
        } else {
            rebalanceControlRow.style.display = 'none';
        }
        engine.addLog('system', `Dispatch strategy set to: ${e.target.options[e.target.selectedIndex].text}`);
    });
    
    searchRadiusSlider.addEventListener('input', (e) => {
        engine.searchRadius = parseInt(e.target.value);
        valSearchRadius.textContent = `${engine.searchRadius} cell${engine.searchRadius > 1 ? 's' : ''}`;
    });
    
    batchWindowSlider.addEventListener('input', (e) => {
        engine.batchWindow = parseInt(e.target.value);
        valBatchWindow.textContent = `${engine.batchWindow}s`;
    });
    
    rebalanceRateSlider.addEventListener('input', (e) => {
        engine.rebalanceRate = parseFloat(e.target.value);
        valRebalanceRate.textContent = engine.rebalanceRate.toFixed(1);
    });
    
    driverDensitySlider.addEventListener('input', (e) => {
        valDriverDensity.textContent = e.target.value;
    });
    
    demandRateSlider.addEventListener('input', (e) => {
        engine.demandRate = parseInt(e.target.value);
        const rateLabel = engine.demandRate === 1 ? 'Low' : (engine.demandRate === 2 ? 'Medium' : 'High');
        valDemandRate.textContent = rateLabel;
    });
    
    // Canvas Toggle Buttons
    toggleHeatmapBtn.addEventListener('click', () => {
        showHeatmap = !showHeatmap;
        toggleHeatmapBtn.classList.toggle('active', showHeatmap);
    });
    
    toggleGridlinesBtn.addEventListener('click', () => {
        showGridlines = !showGridlines;
        toggleGridlinesBtn.classList.toggle('active', showGridlines);
    });
    
    toggleVectorsBtn.addEventListener('click', () => {
        showVectors = !showVectors;
        toggleVectorsBtn.classList.toggle('active', showVectors);
    });
    
    // Spawn Click Handlers (global mappings)
    window.triggerSurge = (type) => {
        engine.triggerSurge(type);
        updateUI();
    };
    
    surgeMetroBtn.addEventListener('click', () => triggerSurge('train-station'));
    surgeOfficeBtn.addEventListener('click', () => triggerSurge('office-hub'));
    surgeRandomBtn.addEventListener('click', () => triggerSurge('random-spikes'));
    
    clearLogsBtn.addEventListener('click', () => {
        consoleBox.innerHTML = '';
        engine.logs = [];
    });
    
    // Add Click-to-spawn on Canvas
    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        // Scale coordinate matching client-to-internal
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        // Spawn commuter directly at coordinate
        const gridX = Math.floor(x / engine.cellSize);
        const gridY = Math.floor(y / engine.cellSize);
        
        if (gridX >= 0 && gridX < engine.gridSize && gridY >= 0 && gridY < engine.gridSize) {
            // Find destination
            let destGridX, destGridY;
            do {
                destGridX = Math.floor(Math.random() * engine.gridSize);
                destGridY = Math.floor(Math.random() * engine.gridSize);
            } while (destGridX === gridX && destGridY === gridY);
            
            const newCommuter = {
                id: ++engine.metrics.totalCommuters,
                x: x,
                y: y,
                destX: (destGridX + 0.5) * engine.cellSize,
                destY: (destGridY + 0.5) * engine.cellSize,
                gridX: gridX,
                gridY: gridY,
                destGridX: destGridX,
                destGridY: destGridY,
                state: 'waiting',
                spawnTick: engine.ticks,
                matchTick: 0,
                waitingSeconds: 0,
                assignedDriver: null,
                stationName: 'User Tap'
            };
            
            engine.commuters.push(newCommuter);
            engine.rebuildGridIndex();
            engine.addLog('system', `📍 User spawned Commuter #${newCommuter.id} at grid cell (${gridX}, ${gridY})`);
            updateUI();
        }
    });
    
    // Log updates
    engine.onLogAdded = (log) => {
        const line = document.createElement('div');
        line.className = `log-line ${log.type}`;
        line.innerHTML = `<span class="time">[${log.timestamp}]</span> ${log.message}`;
        consoleBox.appendChild(line);
        consoleBox.scrollTop = consoleBox.scrollHeight;
    };
    
    // --- SPARKLINE DRAWER ---
    function drawSparkline(canvasId, data, maxVal) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctxS = canvas.getContext('2d');
        ctxS.clearRect(0, 0, canvas.width, canvas.height);
        if (data.length < 2) return;
        
        ctxS.beginPath();
        if (canvasId === 'sparkline-match-rate') ctxS.strokeStyle = '#00e6a0';
        else if (canvasId === 'sparkline-pickup') ctxS.strokeStyle = '#00b0ff';
        else if (canvasId === 'sparkline-utilization') ctxS.strokeStyle = '#ffb300';
        
        ctxS.lineWidth = 1.5;
        const dx = canvas.width / (data.length - 1);
        data.forEach((val, idx) => {
            const x = idx * dx;
            const normVal = maxVal === 0 ? 0.5 : (val / maxVal);
            const y = canvas.height - (normVal * (canvas.height - 4)) - 2;
            if (idx === 0) ctxS.moveTo(x, y);
            else ctxS.lineTo(x, y);
        });
        ctxS.stroke();
    }
    
    // --- UPDATE UI STATS DISPLAY ---
    function updateUI() {
        const total = engine.metrics.totalCommuters || 1;
        const matchRate = (engine.metrics.matchedCommuters / total) * 100;
        statMatchRate.textContent = `${matchRate.toFixed(1)}%`;
        
        const avgWait = engine.metrics.matchedCommuters > 0 ? (engine.metrics.totalWaitTime / engine.metrics.matchedCommuters) : 0;
        statAvgPickup.textContent = `${avgWait.toFixed(1)}s`;
        
        const busyDrivers = engine.drivers.filter(d => d.state !== 'idle').length;
        const util = (busyDrivers / engine.drivers.length) * 100;
        statUtilization.textContent = `${util.toFixed(1)}%`;
        
        statRevenue.textContent = `$${engine.metrics.revenue.toFixed(2)}`;
        
        const waitingQueue = engine.commuters.filter(c => c.state === 'waiting').length;
        statQueueLength.textContent = waitingQueue;
        
        // Calculate dynamic trend revenues
        const minutes = engine.ticks / (60 * 60);
        const ratePerMinute = minutes > 0 ? (engine.metrics.revenue / minutes) : 0;
        trendRevenue.textContent = `+$${ratePerMinute.toFixed(2)}/min`;
        
        // Draw sparklines
        drawSparkline('sparkline-match-rate', engine.metrics.history.matchRate, 100);
        drawSparkline('sparkline-pickup', engine.metrics.history.avgPickupTime, 12);
        drawSparkline('sparkline-utilization', engine.metrics.history.utilization, 100);
    }
    
    // --- CANVAS DRAWING LOOP ---
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 1. Draw Heatmap (Supply vs Demand Deficit)
        if (showHeatmap) {
            const deficits = engine.algoType === 'proactive-rebalance' ? engine.computeDemandDeficits() : null;
            
            for (let x = 0; x < engine.gridSize; x++) {
                for (let y = 0; y < engine.gridSize; y++) {
                    const key = `${x},${y}`;
                    
                    const cellCommuters = engine.gridCommuters[key]?.length || 0;
                    const cellDrivers = engine.gridDrivers[key]?.filter(d => d.state === 'idle').length || 0;
                    
                    let fillStyle = null;
                    
                    if (deficits) {
                        // In proactive mode, color based on calculated rebalancing deficits
                        const def = deficits[key];
                        if (def > 0) {
                            fillStyle = `rgba(255, 61, 0, ${Math.min(0.35, 0.08 * def)})`;
                        } else if (cellDrivers > 1) {
                            fillStyle = `rgba(0, 230, 160, ${Math.min(0.2, 0.05 * cellDrivers)})`;
                        }
                    } else {
                        // In normal mode, direct comparison
                        if (cellCommuters > cellDrivers) {
                            const ratio = Math.min(1.0, (cellCommuters - cellDrivers) / 5);
                            fillStyle = `rgba(255, 61, 0, ${0.1 + ratio * 0.25})`; // Red overlay for passenger backlog
                        } else if (cellDrivers > cellCommuters && cellDrivers > 1) {
                            const ratio = Math.min(1.0, (cellDrivers - cellCommuters) / 5);
                            fillStyle = `rgba(0, 230, 160, ${0.05 + ratio * 0.15})`; // Green overlay for driver clusters
                        }
                    }
                    
                    if (fillStyle) {
                        ctx.fillStyle = fillStyle;
                        ctx.fillRect(x * engine.cellSize, y * engine.cellSize, engine.cellSize, engine.cellSize);
                    }
                }
            }
        }
        
        // 2. Draw Gridlines
        if (showGridlines) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
            ctx.lineWidth = 1;
            
            // Verticals
            for (let x = 0; x <= engine.gridSize; x++) {
                ctx.beginPath();
                ctx.moveTo(x * engine.cellSize, 0);
                ctx.lineTo(x * engine.cellSize, canvas.height);
                ctx.stroke();
            }
            // Horizontals
            for (let y = 0; y <= engine.gridSize; y++) {
                ctx.beginPath();
                ctx.moveTo(0, y * engine.cellSize);
                ctx.lineTo(canvas.width, y * engine.cellSize);
                ctx.stroke();
                
                // Draw coordinate labels on the edges
                if (y < engine.gridSize) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                    ctx.font = '9px Outfit';
                    ctx.fillText(`C${y}`, 4, y * engine.cellSize + 12);
                    ctx.fillText(`R${y}`, y * engine.cellSize + 4, canvas.height - 4);
                }
            }
        }
        
        // 3. Draw Station hubs
        engine.stations.forEach(s => {
            const sx = (s.gridX + 0.5) * engine.cellSize;
            const sy = (s.gridY + 0.5) * engine.cellSize;
            
            // Hub Glow Ring
            const glowRadius = 25 + Math.sin(engine.ticks * 0.05) * 4;
            const grad = ctx.createRadialGradient(sx, sy, 5, sx, sy, glowRadius);
            grad.addColorStop(0, 'rgba(255, 87, 34, 0.25)');
            grad.addColorStop(1, 'rgba(255, 87, 34, 0)');
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sx, sy, glowRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Hub Center Dot
            ctx.fillStyle = '#ff5722';
            ctx.beginPath();
            ctx.arc(sx, sy, 6, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw Icon emoji
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(s.label, sx, sy - 15);
            
            // Draw label
            ctx.fillStyle = '#fff';
            ctx.font = '9px Outfit';
            ctx.fillText(s.name.split(' ')[0], sx, sy + 15);
        });
        
        // 4. Draw Commuters
        engine.commuters.forEach(c => {
            // Draw destination marker if hover/waiting
            if (c.state === 'waiting') {
                // Pulse effect
                ctx.strokeStyle = 'rgba(255, 179, 0, 0.4)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(c.x, c.y, 8 + Math.sin(engine.ticks * 0.1) * 3, 0, Math.PI * 2);
                ctx.stroke();
                
                // Commuter point
                ctx.fillStyle = '#ffb300';
                ctx.beginPath();
                ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        
        // 5. Draw Drivers & Dispatch paths
        engine.drivers.forEach(d => {
            // Draw path lines first
            if (d.state === 'dispatched' && d.target) {
                // Dotted dispatch pick-up line
                ctx.strokeStyle = '#00b0ff';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(d.x, d.y);
                ctx.lineTo(d.target.x, d.target.y);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // Drawing dynamic matched particle moving along line
                const dx = d.target.x - d.x;
                const dy = d.target.y - d.y;
                const dist = Math.hypot(dx, dy);
                const t = (engine.ticks % 40) / 40;
                const px = d.x + dx * t;
                const py = d.y + dy * t;
                ctx.fillStyle = '#00b0ff';
                ctx.beginPath();
                ctx.arc(px, py, 3, 0, Math.PI * 2);
                ctx.fill();
                
            } else if (d.state === 'busy' && d.target) {
                // Solid passenger delivery line
                ctx.strokeStyle = 'rgba(255, 61, 0, 0.35)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(d.x, d.y);
                ctx.lineTo(d.target.x, d.target.y);
                ctx.stroke();
                
                // Draw dest flag
                ctx.fillStyle = '#ff3d00';
                ctx.font = '10px sans-serif';
                ctx.fillText('🏁', d.target.x, d.target.y - 6);
            }
            
            // Draw rebalancing vectors
            if (showVectors && d.state === 'idle' && d.rebalanceVector) {
                ctx.strokeStyle = 'rgba(255, 152, 0, 0.7)';
                ctx.lineWidth = 1.5;
                
                const arrowLength = 15;
                const angle = Math.atan2(d.rebalanceVector.dy, d.rebalanceVector.dx);
                const ex = d.x + Math.cos(angle) * arrowLength;
                const ey = d.y + Math.sin(angle) * arrowLength;
                
                // Draw vector line
                ctx.beginPath();
                ctx.moveTo(d.x, d.y);
                ctx.lineTo(ex, ey);
                ctx.stroke();
                
                // Draw arrowhead
                ctx.fillStyle = 'rgba(255, 152, 0, 0.9)';
                ctx.beginPath();
                ctx.moveTo(ex, ey);
                ctx.lineTo(ex - 4 * Math.cos(angle - Math.PI / 6), ey - 4 * Math.sin(angle - Math.PI / 6));
                ctx.lineTo(ex - 4 * Math.cos(angle + Math.PI / 6), ey - 4 * Math.sin(angle + Math.PI / 6));
                ctx.fill();
            }
            
            // Draw Driver Icon
            let color = '#00e6a0'; // Idle
            if (d.state === 'dispatched') color = '#00b0ff';
            else if (d.state === 'busy') color = '#ff3d00';
            
            ctx.fillStyle = color;
            ctx.shadowBlur = d.state !== 'idle' ? 4 : 0;
            ctx.shadowColor = color;
            
            ctx.beginPath();
            ctx.arc(d.x, d.y, 4.5, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.shadowBlur = 0; // Reset shadow
            
            // Draw simple label representing status
            if (d.state === 'busy') {
                ctx.fillStyle = '#fff';
                ctx.font = '8px Outfit';
                ctx.fillText('🧍', d.x, d.y - 6);
            }
        });
    }
    
    // --- ANIMATION / SIMULATION TICK LOOP ---
    function tick() {
        if (engine.running) {
            engine.update();
        }
        draw();
        updateUI();
        requestAnimationFrame(tick);
    }
    
    // Kickstart drawing & UI update once
    draw();
    updateUI();
    // Start simulation animation loop
    tick();
});
