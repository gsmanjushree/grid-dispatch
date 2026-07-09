# ⚡ Localized Grid Dispatching Simulator

An interactive web-based simulator and mathematical dashboard demonstrating a **Localized Grid Dispatching Algorithm** tailored for micro-mobility ride aggregators (e.g., bike/scooter-sharing services).

**🌐 Live Demo**: [https://grid-dispatch.netlify.app](https://grid-dispatch.netlify.app)

This project models and visualizes how modern ride-hailing networks solve the matching and rebalancing problems at scale, comparing **Greedy First-Come-First-Served (FCFS)** matching, **Localized Bipartite Hungarian Optimization**, and **Proactive Potential-Field Rebalancing**.

---

## 🚀 Key Features

* **Spatial Grid Partitioning**: Divides a 2D city coordinate plane into a $12 \times 12$ cell grid, indexing drivers and commuters dynamically to restrict the computational search space.
* **Localized Batch Bipartite Matching**: Implements a native, dependency-free **Kuhn-Munkres (Hungarian) Solver** in JavaScript to compute optimal matching pairs within a search ring (K-Ring) every $T$ seconds.
* **Proactive Potential-Field Rebalancing**: Calculates supply-demand deficits at high-density hubs and pulls idle drivers toward predicted demand centers using simulated virtual gravity.
* **Real-time Metrics Dashboard**: Monitors Match Rate %, Average Pick-up wait times, Driver fleet utilization, and Total Revenue with live-updated sparkline charts.
* **Interactive Spawning & Surges**: Allows manual commuter spawning on canvas click, alongside preset surge triggers representing **Metro Train Arrivals**, **Business Shift-End Exits**, and random spikes.

---

## 🛠️ System Architecture

The simulator is built entirely with vanilla web technologies to ensure lightweight, high-performance, 60fps canvas rendering without heavy library overhead.

```
grid-dispatch/
│
├── index.html          # HTML5 layout structure, controls, and math documentation
├── style.css           # Premium dark-theme styling & glassmorphism layout
├── dispatch-engine.js  # Core physics loop, grid indexing, and matching algorithms
├── ui-manager.js       # Canvas drawing loop, event listeners, and sparkline charts
└── README.md           # Documentation and execution guide
```

---

## 🧠 Core Mathematics & Algorithms

### 1. Spatial Grid Indexing & Complexity Reduction
In global matching, solving maximum bipartite matching for $N$ drivers and $M$ commuters has a time complexity of $\mathcal{O}((N+M)^3)$. For thousands of active entities, running this globally every second is computationally impossible.

**Solution**: By partitioning the city space into cells $G_{i,j}$, matching is isolated to local neighborhoods. For a station cell $G_{i,j}$, we define a local search ring $R_K$ of radius $K$:
* **Demand Set**: $D_{\text{local}} \subset G_{i,j}$
* **Supply Set**: $S_{\text{local}} \subset \bigcup_{(u,v) \in R_K} G_{u,v}$

The solver is restricted to these small subsets ($N_{\text{local}}, M_{\text{local}} \ll 50$), making the matching phase virtually instantaneous.

---

### 2. Localized Batch Bipartite Matching
Rather than greedy matching immediately on request (which creates suboptimal matches and long travel times), the engine accumulates requests over a batch window ($T$ seconds) and builds a local cost matrix $C$:

$$C_{r,d} = \text{Distance}(r, d) + \alpha \cdot \text{WaitTime}(r)$$

The Hungarian matcher finds the assignment set $X_{r,d} \in \{0, 1\}$ that minimizes:

$$\min \sum_{r,d} C_{r,d} X_{r,d} \quad \text{subject to} \quad \sum_d X_{r,d} \le 1, \quad \sum_r X_{r,d} \le 1$$

---

### 3. Proactive Rebalancing Potential Fields
To prevent commuter hubs from running out of drivers, the engine calculates the demand-supply deficit at high-density hubs. A gravitational vector $\vec{F}$ is exerted on idle drivers in nearby cells:

$$\vec{F}(G_{u,v}) = \sum_{(i,j) \in \mathcal{N}} \frac{\hat{D}_{i,j} - S_{i,j}}{\text{Distance}((u,v), (i,j))^2} \vec{u}$$

Where:
* $\hat{D}_{i,j}$ is the predicted incoming demand.
* $S_{i,j}$ is the current idle/dispatched driver supply.
* $\vec{u}$ is the unit vector pointing from the driver to the hub.

Idle drivers receive a micro-incentive to drift along the field vector $\vec{F}$ towards these hubs before passenger surges occur.

---

## 🏁 Getting Started & Running Locally

Since the project uses pure vanilla HTML5/JS/CSS, it runs locally without any build steps or packaging tools.

### Option 1: Double-Click
Simply double-click the `index.html` file to open it directly in any modern browser.

### Option 2: Running via a Local HTTP Server (Recommended)
Running through a local web server is recommended for testing local networking and performance metrics.

1. Navigate to the directory:
   ```bash
   cd grid-dispatch
   ```
2. Start a simple static web server (e.g., using python, node, or http-server):
   ```bash
   # Using Python 3
   python -m http.server 8080

   # OR using Node.js
   npx http-server -p 8080
   ```
3. Open your browser and navigate to: **[http://localhost:8080](http://localhost:8080)**

---

## 🕹️ Interactive Simulator Guide

Once the page loads, try the following flow:
1. Click **Play** (or press Space) to start the simulator. By default, it runs **Greedy FCFS**.
2. Click **🚉 Metro Arrival** in the sidebar. This spawns a wave of 15 commuters at the Central Hub. Watch how drivers are assigned.
3. Switch the algorithm to **Localized Batch (Hungarian)**. Adjust the **Batch Window** to `3s` and the **Search Radius** to `2 cells`.
4. Trigger the Metro Arrival surge again. Notice how the matching lines become parallel and compact (signifying optimal assignment) instead of chaotic and intersecting.
5. Switch to **Proactive Rebalancing** and toggle the **Vectors** button on the map. Faint orange arrows will draw rebalancing paths showing idle drivers migrating to high-density stations ahead of arrivals.
6. Click anywhere on the map grid to manually spawn a customer at a specific cell and watch the nearest driver accept the dispatch.
