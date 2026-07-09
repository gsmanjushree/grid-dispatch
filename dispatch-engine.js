/**
 * GridDispatch Simulation & Dispatching Engine
 * Implements Localized Grid Indexing, Greedy Matcher, Local Batch Hungarian Matcher,
 * and Proactive Rebalancing Potential Fields.
 */

// --- HUNGARIAN ALGORITHM (MIN-COST BIPARTITE MATCHING) ---
// Solves minimum cost bipartite matching in O(V * E^2) / O(N^3) time.
// costMatrix size: N x M where N (rows) <= M (columns).
function solveHungarian(costMatrix) {
    const n = costMatrix.length;
    if (n === 0) return [];
    const m = costMatrix[0].length;
    
    // Potentials for rows (u) and columns (v)
    let u = new Array(n + 1).fill(0);
    let v = new Array(m + 1).fill(0);
    
    // p[j] stores the row index (1-based) matched with column j (1-based)
    let p = new Array(m + 1).fill(0);
    
    // way[j] stores backtracking links for augmenting paths
    let way = new Array(m + 1).fill(0);
    
    for (let i = 1; i <= n; i++) {
        p[0] = i;
        let j0 = 0;
        let minv = new Array(m + 1).fill(Infinity);
        let used = new Array(m + 1).fill(false);
        
        do {
            used[j0] = true;
            let i0 = p[j0];
            let delta = Infinity;
            let j1 = 0;
            
            for (let j = 1; j <= m; j++) {
                if (!used[j]) {
                    // costMatrix is 0-indexed, u & v potentials are 1-indexed
                    let cur = costMatrix[i0 - 1][j - 1] - u[i0] - v[j];
                    if (cur < minv[j]) {
                        minv[j] = cur;
                        way[j] = j0;
                    }
                    if (minv[j] < delta) {
                        delta = minv[j];
                        j1 = j;
                    }
                }
            }
            
            for (let j = 0; j <= m; j++) {
                if (used[j]) {
                    u[p[j]] += delta;
                    v[j] -= delta;
                } else {
                    minv[j] -= delta;
                }
            }
            j0 = j1;
        } while (p[j0] !== 0);
        
        // Augment the matching along the alternating path
        do {
            let j1 = way[j0];
            p[j0] = p[j1];
            j0 = j1;
        } while (j0 !== 0);
    }
    
    // Map 1-based results back to 0-based index matches
    let matches = new Array(n).fill(-1);
    for (let j = 1; j <= m; j++) {
        if (p[j] > 0) {
            matches[p[j] - 1] = j - 1;
        }
    }
    return matches;
}

// Wrapper to handle non-symmetric inputs (N > M or N <= M)
// Returns array of matched pairs: { commuterIndex, driverIndex }
function matchBipartite(commuters, drivers, distanceCalculator) {
    const n = commuters.length;
    const m = drivers.length;
    if (n === 0 || m === 0) return [];
    
    // Build cost matrix
    const matrix = [];
    if (n <= m) {
        // Normal matrix: Commuters (N) matched to Drivers (M)
        for (let i = 0; i < n; i++) {
            matrix[i] = [];
            for (let j = 0; j < m; j++) {
                matrix[i][j] = distanceCalculator(commuters[i], drivers[j]);
            }
        }
        const colMatches = solveHungarian(matrix);
        const pairs = [];
        for (let i = 0; i < n; i++) {
            if (colMatches[i] !== -1 && colMatches[i] < m) {
                pairs.push({ commuterIdx: i, driverIdx: colMatches[i] });
            }
        }
        return pairs;
    } else {
        // Transposed matrix: Drivers (M) matched to Commuters (N)
        for (let i = 0; i < m; i++) {
            matrix[i] = [];
            for (let j = 0; j < n; j++) {
                matrix[i][j] = distanceCalculator(commuters[j], drivers[i]);
            }
        }
        const colMatches = solveHungarian(matrix);
        const pairs = [];
        for (let i = 0; i < m; i++) {
            if (colMatches[i] !== -1 && colMatches[i] < n) {
                pairs.push({ commuterIdx: colMatches[i], driverIdx: i });
            }
        }
        return pairs;
    }
}


// --- CORE ENGINE DEFINITION ---
class DispatchEngine {
    constructor() {
        this.width = 650;
        this.height = 650;
        this.gridSize = 12;
        this.cellSize = this.width / this.gridSize;
        
        // Simulation parameters
        this.simSpeed = 1.0;
        this.algoType = 'greedy'; // greedy, batch-hungarian, proactive-rebalance
        this.searchRadius = 2; // K-ring
        this.batchWindow = 3.0; // Seconds
        this.rebalanceRate = 0.5; // Rebalancing force coefficient
        this.demandRate = 2; // 1 = Low, 2 = Medium, 3 = High
        
        // Entities
        this.drivers = [];
        this.commuters = [];
        this.stations = [];
        
        // Grid indices
        this.gridDrivers = {}; // key: 'i,j', val: Array of Drivers
        this.gridCommuters = {}; // key: 'i,j', val: Array of Commuters
        
        // State
        this.running = false;
        this.ticks = 0;
        this.lastBatchTick = 0;
        this.logs = [];
        
        // Metrics
        this.metrics = {
            totalCommuters: 0,
            matchedCommuters: 0,
            completedRides: 0,
            canceledCommuters: 0,
            totalWaitTime: 0, // seconds
            totalPickupDistance: 0, // grid units
            revenue: 0,
            rebalanceMiles: 0,
            history: {
                matchRate: [],
                avgPickupTime: [],
                utilization: []
            }
        };
        
        // Initialize entities
        this.initStations();
        this.resetSimulation();
    }
    
    initStations() {
        // High density transit nodes in the grid
        this.stations = [
            { id: 'metro-north', name: 'Central Metro Hub', gridX: 2, gridY: 2, label: '🚉', spawnWeight: 0.4 },
            { id: 'office-east', name: 'Business Tech Park', gridX: 9, gridY: 3, label: '🏢', spawnWeight: 0.35 },
            { id: 'dock-south', name: 'Ferry Terminal', gridX: 3, gridY: 9, label: '🚢', spawnWeight: 0.15 },
            { id: 'civic-center', name: 'Civic Plaza Station', gridX: 8, gridY: 9, label: '🏛️', spawnWeight: 0.1 }
        ];
    }
    
    resetSimulation() {
        this.drivers = [];
        this.commuters = [];
        this.ticks = 0;
        this.lastBatchTick = 0;
        this.logs = [];
        
        // Reset metrics
        this.metrics.totalCommuters = 0;
        this.metrics.matchedCommuters = 0;
        this.metrics.completedRides = 0;
        this.metrics.canceledCommuters = 0;
        this.metrics.totalWaitTime = 0;
        this.metrics.totalPickupDistance = 0;
        this.metrics.revenue = 0;
        this.metrics.rebalanceMiles = 0;
        this.metrics.history.matchRate = [];
        this.metrics.history.avgPickupTime = [];
        this.metrics.history.utilization = [];
        
        this.addLog('system', 'Simulation environment reset.');
        this.spawnInitialDrivers();
    }
    
    spawnInitialDrivers() {
        const count = parseInt(document.getElementById('param-driver-density')?.value || 35);
        for (let i = 0; i < count; i++) {
            // Distribute drivers across the grid
            const x = Math.random() * this.width;
            const y = Math.random() * this.height;
            this.drivers.push({
                id: i + 1,
                x: x,
                y: y,
                state: 'idle', // idle, dispatched, busy
                target: null, // commuter or coordinates
                assignedCommuter: null,
                speed: 1.8, // Base travel speed (pixels per tick)
                earnings: 0,
                driftAngle: Math.random() * Math.PI * 2,
                driftTicks: 0,
                // Track grid cell
                gridX: Math.floor(x / this.cellSize),
                gridY: Math.floor(y / this.cellSize)
            });
        }
        this.rebuildGridIndex();
    }
    
    rebuildGridIndex() {
        // Clear grid indices
        this.gridDrivers = {};
        this.gridCommuters = {};
        
        for (let x = 0; x < this.gridSize; x++) {
            for (let y = 0; y < this.gridSize; y++) {
                const key = `${x},${y}`;
                this.gridDrivers[key] = [];
                this.gridCommuters[key] = [];
            }
        }
        
        // Index drivers
        this.drivers.forEach(d => {
            d.gridX = Math.floor(d.x / this.cellSize);
            d.gridY = Math.floor(d.y / this.cellSize);
            // Bound checks
            d.gridX = Math.max(0, Math.min(this.gridSize - 1, d.gridX));
            d.gridY = Math.max(0, Math.min(this.gridSize - 1, d.gridY));
            const key = `${d.gridX},${d.gridY}`;
            this.gridDrivers[key].push(d);
        });
        
        // Index commuters
        this.commuters.forEach(c => {
            if (c.state === 'waiting') {
                c.gridX = Math.floor(c.x / this.cellSize);
                c.gridY = Math.floor(c.y / this.cellSize);
                c.gridX = Math.max(0, Math.min(this.gridSize - 1, c.gridX));
                c.gridY = Math.max(0, Math.min(this.gridSize - 1, c.gridY));
                const key = `${c.gridX},${c.gridY}`;
                this.gridCommuters[key].push(c);
            }
        });
    }
    
    addLog(type, message) {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        this.logs.unshift({ timestamp, type, message });
        if (this.logs.length > 50) this.logs.pop();
        
        // Trigger console callback if configured
        if (this.onLogAdded) {
            this.onLogAdded(this.logs[0]);
        }
    }
    
    spawnCommuter(stationId = null) {
        let startX, startY, startStation = null;
        
        if (stationId) {
            startStation = this.stations.find(s => s.id === stationId);
        } else {
            // Spawn at one of the stations with weights, or occasionally randomly
            if (Math.random() < 0.85) {
                const r = Math.random();
                let sum = 0;
                for (const s of this.stations) {
                    sum += s.spawnWeight;
                    if (r <= sum) {
                        startStation = s;
                        break;
                    }
                }
            }
        }
        
        if (startStation) {
            // Center cell coords with some jitter (commuters stand around the hub)
            startX = (startStation.gridX + 0.3 + Math.random() * 0.4) * this.cellSize;
            startY = (startStation.gridY + 0.3 + Math.random() * 0.4) * this.cellSize;
        } else {
            // Random grid cell
            startX = Math.random() * this.width;
            startY = Math.random() * this.height;
        }
        
        // Destination is a random grid cell, at least 3-4 cells away to simulate a real trip
        let destGridX, destGridY;
        const startGridX = Math.floor(startX / this.cellSize);
        const startGridY = Math.floor(startY / this.cellSize);
        
        do {
            destGridX = Math.floor(Math.random() * this.gridSize);
            destGridY = Math.floor(Math.random() * this.gridSize);
        } while (Math.abs(destGridX - startGridX) + Math.abs(destGridY - startGridY) < 3);
        
        const destX = (destGridX + 0.5) * this.cellSize;
        const destY = (destGridY + 0.5) * this.cellSize;
        
        const newCommuter = {
            id: ++this.metrics.totalCommuters,
            x: startX,
            y: startY,
            destX: destX,
            destY: destY,
            gridX: startGridX,
            gridY: startGridY,
            destGridX: destGridX,
            destGridY: destGridY,
            state: 'waiting', // waiting, matched, picked-up
            spawnTick: this.ticks,
            matchTick: 0,
            waitingSeconds: 0,
            assignedDriver: null,
            stationName: startStation ? startStation.name : 'Street'
        };
        
        this.commuters.push(newCommuter);
        
        const key = `${startGridX},${startGridY}`;
        if (!this.gridCommuters[key]) this.gridCommuters[key] = [];
        this.gridCommuters[key].push(newCommuter);
    }
    
    // Spawn a wave of commuters for surge stress test
    triggerSurge(type) {
        if (type === 'train-station') {
            const count = 10 + Math.floor(Math.random() * 6);
            for (let i = 0; i < count; i++) this.spawnCommuter('metro-north');
            this.addLog('surge', `🔥 METRO ARRIVAL SURGE: ${count} commuters spawned at Central Metro Hub!`);
        } else if (type === 'office-hub') {
            const count = 8 + Math.floor(Math.random() * 5);
            for (let i = 0; i < count; i++) this.spawnCommuter('office-east');
            this.addLog('surge', `🔥 SHIFT END SURGE: ${count} commuters spawned at Business Tech Park!`);
        } else {
            // Random spikes across several cells
            const count = 12;
            for (let i = 0; i < count; i++) this.spawnCommuter();
            this.addLog('surge', `⚡ RANDOM SPIKES: ${count} commuters generated across the grid.`);
        }
        this.rebuildGridIndex();
    }
    
    // Get cells in K-Ring around (cx, cy)
    getCellsInKRing(cx, cy, k) {
        const cells = [];
        for (let dx = -k; dx <= k; dx++) {
            for (let dy = -k; dy <= k; dy++) {
                // Manhattan distance ring check
                if (Math.abs(dx) + Math.abs(dy) <= k) {
                    const nx = cx + dx;
                    const ny = cy + dy;
                    if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize) {
                        cells.push({ x: nx, y: ny, key: `${nx},${ny}` });
                    }
                }
            }
        }
        return cells;
    }
    
    // Dispatch Matching: Greedy FCFS
    runGreedyMatching() {
        // Iterate through all waiting commuters, FCFS matching
        this.commuters.forEach(c => {
            if (c.state !== 'waiting') return;
            
            let bestDriver = null;
            let bestDist = Infinity;
            
            // Search in K-Ring
            const cells = this.getCellsInKRing(c.gridX, c.gridY, this.searchRadius);
            cells.forEach(cell => {
                const idleDrivers = this.gridDrivers[cell.key]?.filter(d => d.state === 'idle') || [];
                idleDrivers.forEach(d => {
                    const dist = Math.hypot(d.x - c.x, d.y - c.y);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestDriver = d;
                    }
                });
            });
            
            // If match is found, assign
            if (bestDriver) {
                this.executeMatch(c, bestDriver);
            }
        });
    }
    
    // Dispatch Matching: Localized Batch matching using Kuhn-Munkres
    runBatchHungarianMatching() {
        const matchedDrivers = new Set();
        const matchedCommuters = new Set();
        
        // Loop over grid cells containing stations first, then outer cells
        // This is a common priority heuristic in localized grid dispatching
        const priorityKeys = [];
        this.stations.forEach(s => {
            priorityKeys.push(`${s.gridX},${s.gridY}`);
        });
        
        for (let x = 0; x < this.gridSize; x++) {
            for (let y = 0; y < this.gridSize; y++) {
                const key = `${x},${y}`;
                if (!priorityKeys.includes(key)) {
                    priorityKeys.push(key);
                }
            }
        }
        
        priorityKeys.forEach(cellKey => {
            const [cx, cy] = cellKey.split(',').map(Number);
            
            // Get waiting commuters in this specific cell
            const cellCommuters = this.gridCommuters[cellKey]?.filter(c => c.state === 'waiting' && !matchedCommuters.has(c)) || [];
            if (cellCommuters.length === 0) return;
            
            // Gather available drivers in the search radius (K-ring) around this cell
            const searchCells = this.getCellsInKRing(cx, cy, this.searchRadius);
            const localDrivers = [];
            
            searchCells.forEach(sc => {
                const idleDrivers = this.gridDrivers[sc.key]?.filter(d => d.state === 'idle' && !matchedDrivers.has(d)) || [];
                localDrivers.push(...idleDrivers);
            });
            
            if (localDrivers.length === 0) return;
            
            // Distance calculator helper
            const distCalc = (commuter, driver) => Math.hypot(commuter.x - driver.x, commuter.y - driver.y);
            
            // Run localized Hungarian matching
            const pairs = matchBipartite(cellCommuters, localDrivers, distCalc);
            
            pairs.forEach(pair => {
                const commuter = cellCommuters[pair.commuterIdx];
                const driver = localDrivers[pair.driverIdx];
                
                this.executeMatch(commuter, driver);
                
                matchedDrivers.add(driver);
                matchedCommuters.add(commuter);
            });
        });
    }
    
    executeMatch(commuter, driver) {
        commuter.state = 'matched';
        commuter.matchTick = this.ticks;
        commuter.assignedDriver = driver;
        
        driver.state = 'dispatched';
        driver.target = commuter;
        driver.assignedCommuter = commuter;
        
        // Record pickup metrics
        const dist = Math.hypot(driver.x - commuter.x, driver.y - commuter.y) / this.cellSize;
        const wait = (this.ticks - commuter.spawnTick) / 60; // 60 FPS assumed
        
        this.metrics.matchedCommuters++;
        this.metrics.totalWaitTime += wait;
        this.metrics.totalPickupDistance += dist;
        
        this.addLog('match', `Matched Driver #${driver.id} to Commuter #${commuter.id} (${commuter.stationName}, dist: ${dist.toFixed(1)} cells).`);
    }
    
    // Predict Demand / Deficit for Proactive Rebalancing
    computeDemandDeficits() {
        const deficits = {};
        for (let x = 0; x < this.gridSize; x++) {
            for (let y = 0; y < this.gridSize; y++) {
                deficits[`${x},${y}`] = 0;
            }
        }
        
        // Station cells have continuous base demand + surge predictions
        this.stations.forEach(s => {
            const key = `${s.gridX},${s.gridY}`;
            const waiting = this.gridCommuters[key]?.filter(c => c.state === 'waiting').length || 0;
            
            // Predictive element: assume recurring incoming demand at hubs
            // E.g., Metro Hub generates 3 predicted commuters continuously
            const predictedIncoming = s.id === 'metro-north' ? 4 : (s.id === 'office-east' ? 3 : 1);
            
            // Supply: idle drivers in cell + drivers dispatched to this cell
            const currentSupply = (this.gridDrivers[key]?.filter(d => d.state === 'idle').length || 0) +
                                  this.drivers.filter(d => d.state === 'dispatched' && d.target.gridX === s.gridX && d.target.gridY === s.gridY).length;
                                  
            const deficit = Math.max(0, (waiting + predictedIncoming) - currentSupply);
            deficits[key] = deficit;
        });
        
        return deficits;
    }
    
    // Proactive drift calculations
    applyRebalancingDrift(driver) {
        const deficits = this.computeDemandDeficits();
        let netFx = 0;
        let netFy = 0;
        
        // Sum vector pulls of all stations with deficits
        this.stations.forEach(s => {
            const key = `${s.gridX},${s.gridY}`;
            const deficit = deficits[key];
            if (deficit <= 0) return;
            
            // Calculate distance to station center
            const sX = (s.gridX + 0.5) * this.cellSize;
            const sY = (s.gridY + 0.5) * this.cellSize;
            
            const dx = sX - driver.x;
            const dy = sY - driver.y;
            const dist = Math.hypot(dx, dy);
            
            // Exert gravitational force: Force proportional to deficit, inversely proportional to distance squared
            if (dist > 15 && dist < this.cellSize * (this.searchRadius + 1.5)) {
                // Gravity coefficient
                const force = (deficit * 18) / (dist * dist);
                netFx += (dx / dist) * force;
                netFy += (dy / dist) * force;
            }
        });
        
        // Apply force to drift if non-negligible
        const netForce = Math.hypot(netFx, netFy);
        if (netForce > 0.05) {
            const moveAngle = Math.atan2(netFy, netFx);
            // Move driver towards rebalance target (slower than actual travel speed)
            const driftSpeed = driver.speed * 0.35 * this.rebalanceRate;
            
            driver.x += Math.cos(moveAngle) * driftSpeed * this.simSpeed;
            driver.y += Math.sin(moveAngle) * driftSpeed * this.simSpeed;
            
            // Constrain to grid boundaries
            driver.x = Math.max(10, Math.min(this.width - 10, driver.x));
            driver.y = Math.max(10, Math.min(this.height - 10, driver.y));
            
            // Metrics accumulation
            this.metrics.rebalanceMiles += (driftSpeed * this.simSpeed) / this.cellSize;
            
            // Store drift vector for UI rendering
            driver.rebalanceVector = { dx: Math.cos(moveAngle) * 15, dy: Math.sin(moveAngle) * 15 };
        } else {
            driver.rebalanceVector = null;
        }
    }
    
    // Core update loop (runs ~60 times a second if speed = 1.0)
    update() {
        const actualTicks = Math.round(this.simSpeed);
        // Loop multiple times in a single frame to accelerate simulation speed
        for (let t = 0; t < Math.max(1, actualTicks); t++) {
            this.ticks++;
            
            // --- 1. Entity Spawner ---
            // Spawn commuters based on demand rate setting
            // Low: 1 in 280 ticks, Medium: 1 in 140 ticks, High: 1 in 70 ticks
            const spawnInterval = this.demandRate === 1 ? 280 : (this.demandRate === 2 ? 140 : 70);
            if (this.ticks % spawnInterval === 0 && Math.random() < 0.8) {
                this.spawnCommuter();
                this.rebuildGridIndex();
            }
            
            // --- 2. Update Commuter Statuses ---
            for (let i = this.commuters.length - 1; i >= 0; i--) {
                const c = this.commuters[i];
                if (c.state === 'waiting') {
                    c.waitingSeconds = (this.ticks - c.spawnTick) / 60;
                    
                    // Commuters cancel after 90 seconds of waiting
                    if (c.waitingSeconds > 90) {
                        this.metrics.canceledCommuters++;
                        this.commuters.splice(i, 1);
                        this.addLog('system', `❌ Commuter #${c.id} canceled after waiting 90s.`);
                    }
                }
            }
            
            // --- 3. Update Driver State Machines ---
            this.drivers.forEach(d => {
                if (d.state === 'idle') {
                    // Apply proactive rebalancing if algorithm calls for it
                    if (this.algoType === 'proactive-rebalance') {
                        this.applyRebalancingDrift(d);
                    } else {
                        d.rebalanceVector = null;
                    }
                    
                    // Gentle idle drift / patrol movement
                    if (d.driftTicks <= 0) {
                        d.driftAngle = Math.random() * Math.PI * 2;
                        d.driftTicks = 60 + Math.floor(Math.random() * 120);
                    }
                    d.driftTicks--;
                    
                    // Float forward
                    d.x += Math.cos(d.driftAngle) * 0.25 * this.simSpeed;
                    d.y += Math.sin(d.driftAngle) * 0.25 * this.simSpeed;
                    
                    // Bounce off boundaries
                    if (d.x < 15 || d.x > this.width - 15) d.driftAngle = Math.PI - d.driftAngle;
                    if (d.y < 15 || d.y > this.height - 15) d.driftAngle = -d.driftAngle;
                    
                } else if (d.state === 'dispatched') {
                    const c = d.assignedCommuter;
                    // If target was somehow removed or canceled
                    if (!this.commuters.includes(c)) {
                        d.state = 'idle';
                        d.target = null;
                        d.assignedCommuter = null;
                        return;
                    }
                    
                    // Move towards commuter
                    const dx = c.x - d.x;
                    const dy = c.y - d.y;
                    const dist = Math.hypot(dx, dy);
                    
                    if (dist < 4) {
                        // Driver picked up the commuter!
                        c.state = 'picked-up';
                        d.state = 'busy';
                        d.target = { x: c.destX, y: c.destY };
                        this.addLog('system', `🚖 Driver #${d.id} picked up Commuter #${c.id}. En route.`);
                    } else {
                        const step = d.speed;
                        d.x += (dx / dist) * step;
                        d.y += (dy / dist) * step;
                    }
                    
                } else if (d.state === 'busy') {
                    const c = d.assignedCommuter;
                    const target = d.target;
                    
                    // Move towards ride destination
                    const dx = target.x - d.x;
                    const dy = target.y - d.y;
                    const dist = Math.hypot(dx, dy);
                    
                    if (dist < 4) {
                        // Ride Completed!
                        const fare = 5.0 + Math.round((Math.hypot(c.x - c.destX, c.y - c.destY) / this.cellSize) * 1.5 * 10) / 10;
                        d.earnings += fare * 0.8; // 80% to driver
                        this.metrics.revenue += fare;
                        this.metrics.completedRides++;
                        
                        this.addLog('system', `🏁 Commuter #${c.id} arrived at destination. Fare: $${fare.toFixed(2)}. Driver earnings: +$${(fare * 0.8).toFixed(2)}`);
                        
                        // Remove completed commuter
                        const cIdx = this.commuters.indexOf(c);
                        if (cIdx !== -1) this.commuters.splice(cIdx, 1);
                        
                        d.state = 'idle';
                        d.target = null;
                        d.assignedCommuter = null;
                    } else {
                        const step = d.speed * 1.2; // Move slightly faster with passenger
                        d.x += (dx / dist) * step;
                        d.y += (dy / dist) * step;
                        // Animate commuter carried along
                        if (c) {
                            c.x = d.x;
                            c.y = d.y;
                        }
                    }
                }
            });
            
            // Rebuild spatial index
            this.rebuildGridIndex();
            
            // --- 4. Dispatch Solver Trigger ---
            if (this.algoType === 'greedy') {
                this.runGreedyMatching();
            } else {
                // Batch windows (e.g. 180 ticks for a 3-second window at 60 FPS)
                const batchThreshold = Math.max(60, this.batchWindow * 60);
                if (this.ticks - this.lastBatchTick >= batchThreshold) {
                    this.addLog('system', `⏱ Batch Match Epoch triggered.`);
                    this.runBatchHungarianMatching();
                    this.lastBatchTick = this.ticks;
                }
            }
            
            // --- 5. Periodically record Metrics history (every 5 seconds) ---
            if (this.ticks % 300 === 0) {
                this.recordHistoryMetrics();
            }
        }
    }
    
    recordHistoryMetrics() {
        // Match rate
        const total = this.metrics.totalCommuters || 1;
        const rate = (this.metrics.matchedCommuters / total) * 100;
        this.metrics.history.matchRate.push(rate);
        if (this.metrics.history.matchRate.length > 20) this.metrics.history.matchRate.shift();
        
        // Avg pickup distance/time
        const avgWait = this.metrics.matchedCommuters > 0 ? (this.metrics.totalWaitTime / this.metrics.matchedCommuters) : 0;
        this.metrics.history.avgPickupTime.push(avgWait);
        if (this.metrics.history.avgPickupTime.length > 20) this.metrics.history.avgPickupTime.shift();
        
        // Driver utilization
        const busyCount = this.drivers.filter(d => d.state !== 'idle').length;
        const util = (busyCount / this.drivers.length) * 100;
        this.metrics.history.utilization.push(util);
        if (this.metrics.history.utilization.length > 20) this.metrics.history.utilization.shift();
    }
}
window.DispatchEngine = DispatchEngine;
