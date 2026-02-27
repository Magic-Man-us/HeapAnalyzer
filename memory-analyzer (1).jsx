import { useState, useEffect, useRef, useMemo } from "react";

const SAMPLE_PROGRAMS = {
  Rust: {
    "Rust — Leaked Cache": {
      lang: "Rust", description: "Cache allocated in loop but never freed",
      code: `fn process_requests() {
    let config = Box::new(Config::default());  // 64B on heap

    for i in 0..5 {
        let buf = Vec::<u8>::with_capacity(256);  // request buffer
        let cache = Box::new(HashMap::new());     // temp cache — 128B
        process(&buf, &cache);
        drop(buf);                                // buf freed ✓
        // cache never dropped! ✗ LEAK
    }

    drop(config);                                 // config freed ✓
}`,
      events: (() => {
        const e = []; let t = 0;
        e.push({ time: t++, action: "alloc", id: "config", size: 64, label: "config" });
        for (let i = 0; i < 5; i++) {
          e.push({ time: t++, action: "alloc", id: `buf_${i}`, size: 256, label: `buf[${i}]` });
          e.push({ time: t++, action: "alloc", id: `cache_${i}`, size: 128, label: `cache[${i}]` });
          e.push({ time: t++, action: "free", id: `buf_${i}` });
        }
        e.push({ time: t++, action: "free", id: "config" });
        e.push({ time: t++, action: "end" });
        return e;
      })(),
    },
    "Rust — Double Free": {
      lang: "Rust", description: "Unsafe code causes use-after-free",
      code: `fn shared_resource() {
    let shared = Box::new([0u8; 512]);
    let raw = Box::into_raw(shared);

    // Module A frees via raw pointer
    unsafe {
        process_a(&*raw);
        let _ = Box::from_raw(raw);       // first free ✓
    }

    // Module B still holds raw ptr — dangling!
    unsafe {
        process_b(&*raw);                 // USE-AFTER-FREE
        let _ = Box::from_raw(raw);       // DOUBLE FREE ✗
    }
}`,
      events: [
        { time: 0, action: "alloc", id: "shared", size: 512, label: "shared" },
        { time: 1, action: "alloc", id: "raw_a", size: 8, label: "raw_ptr (A)" },
        { time: 2, action: "alloc", id: "raw_b", size: 8, label: "raw_ptr (B)" },
        { time: 3, action: "free", id: "shared" },
        { time: 4, action: "free", id: "raw_a" },
        { time: 5, action: "free", id: "raw_b" },
        { time: 6, action: "double_free", id: "shared" },
        { time: 7, action: "end" },
      ],
    },
    "Rust — Clean RAII": {
      lang: "Rust", description: "All resources properly scoped — no leaks",
      code: `fn clean_program() {
    let db = Connection::open("app.db")?;     // 256B
    let pool = ThreadPool::new(4);            // 128B

    for i in 0..4 {
        let task = Task::new(i);              // 64B
        let result = pool.execute(&task)?;    // 32B
        println!("Result: {:?}", result);
        // result dropped at end of scope ✓
        // task dropped at end of scope ✓
    }

    // pool dropped ✓
    // db dropped ✓
}`,
      events: (() => {
        const e = []; let t = 0;
        e.push({ time: t++, action: "alloc", id: "db", size: 256, label: "db_conn" });
        e.push({ time: t++, action: "alloc", id: "pool", size: 128, label: "thread_pool" });
        for (let i = 0; i < 4; i++) {
          e.push({ time: t++, action: "alloc", id: `task_${i}`, size: 64, label: `task[${i}]` });
          e.push({ time: t++, action: "alloc", id: `result_${i}`, size: 32, label: `result[${i}]` });
          e.push({ time: t++, action: "free", id: `result_${i}` });
          e.push({ time: t++, action: "free", id: `task_${i}` });
        }
        e.push({ time: t++, action: "free", id: "pool" });
        e.push({ time: t++, action: "free", id: "db" });
        e.push({ time: t++, action: "end" });
        return e;
      })(),
    },
  },
  JavaScript: {
    "JS — Event Listener Leak": {
      lang: "JavaScript", description: "Event listeners keep references alive, preventing GC",
      code: `function setupWidgets() {
    const appState = new Map();              // 64B shared state

    for (let i = 0; i < 5; i++) {
        const widget = document.createElement("div");  // 128B
        const handler = (e) => {                       // 64B closure
            appState.set(i, e.target.value);
            // closure captures widget — prevents GC!
        };
        widget.addEventListener("click", handler);
        document.body.appendChild(widget);

        // widget removed from DOM...
        document.body.removeChild(widget);
        // ...but handler still references it! ✗ LEAK
    }

    appState.clear();                        // state freed ✓
}`,
      events: (() => {
        const e = []; let t = 0;
        e.push({ time: t++, action: "alloc", id: "appState", size: 64, label: "appState (Map)" });
        for (let i = 0; i < 5; i++) {
          e.push({ time: t++, action: "alloc", id: `widget_${i}`, size: 128, label: `widget[${i}]` });
          e.push({ time: t++, action: "alloc", id: `handler_${i}`, size: 64, label: `handler[${i}] (closure)` });
        }
        e.push({ time: t++, action: "free", id: "appState" });
        e.push({ time: t++, action: "end" });
        return e;
      })(),
    },
    "JS — Detached DOM Nodes": {
      lang: "JavaScript", description: "References to removed DOM nodes prevent GC",
      code: `const cache = {};

function renderList(items) {
    const container = document.getElementById("list");  // 32B ref

    items.forEach((item, i) => {
        const row = document.createElement("tr");       // 96B
        const data = fetchDetails(item);                // 256B
        row.innerHTML = data.html;
        container.appendChild(row);

        cache[\`row_\${i}\`] = row;   // cached ref prevents GC ✗
    });

    container.innerHTML = "";       // clear DOM ✓
    // but cache still holds refs! ✗ LEAK
}`,
      events: (() => {
        const e = []; let t = 0;
        e.push({ time: t++, action: "alloc", id: "cache", size: 32, label: "cache (obj)" });
        e.push({ time: t++, action: "alloc", id: "container", size: 32, label: "container ref" });
        for (let i = 0; i < 4; i++) {
          e.push({ time: t++, action: "alloc", id: `row_${i}`, size: 96, label: `row[${i}] (DOM)` });
          e.push({ time: t++, action: "alloc", id: `data_${i}`, size: 256, label: `data[${i}]` });
          e.push({ time: t++, action: "free", id: `data_${i}` });
        }
        e.push({ time: t++, action: "free", id: "container" });
        e.push({ time: t++, action: "end" });
        return e;
      })(),
    },
  },
  TypeScript: {
    "TS — Observable Leak": {
      lang: "TypeScript", description: "Subscriptions not unsubscribed leak in RxJS",
      code: `class DashboardComponent implements OnInit, OnDestroy {
    private data: DataStream;                    // 64B
    private subscriptions: Subscription[] = [];  // 32B

    ngOnInit(): void {
        // Each subscribe creates a retained callback
        for (let i = 0; i < 4; i++) {
            const sub = this.dataService
                .getStream(i)                    // 128B stream
                .subscribe((val: Update) => {    // 48B subscription
                    this.data = val;
                });
            // Forgot to push to subscriptions array! ✗
            // this.subscriptions.push(sub);
        }
    }

    ngOnDestroy(): void {
        // Only unsubscribes tracked subs (empty!)
        this.subscriptions.forEach(s => s.unsubscribe());
        this.data = null;                        // freed ✓
    }
}`,
      events: (() => {
        const e = []; let t = 0;
        e.push({ time: t++, action: "alloc", id: "data", size: 64, label: "data: DataStream" });
        e.push({ time: t++, action: "alloc", id: "subs", size: 32, label: "subscriptions[]" });
        for (let i = 0; i < 4; i++) {
          e.push({ time: t++, action: "alloc", id: `stream_${i}`, size: 128, label: `stream[${i}]` });
          e.push({ time: t++, action: "alloc", id: `sub_${i}`, size: 48, label: `subscription[${i}]` });
        }
        e.push({ time: t++, action: "free", id: "subs" });
        e.push({ time: t++, action: "free", id: "data" });
        e.push({ time: t++, action: "end" });
        return e;
      })(),
    },
    "TS — Clean Reactive": {
      lang: "TypeScript", description: "All subscriptions managed with takeUntil",
      code: `class DashboardComponent implements OnInit, OnDestroy {
    private destroy$ = new Subject<void>();      // 16B
    private data: DataStream;                    // 64B

    ngOnInit(): void {
        for (let i = 0; i < 4; i++) {
            this.dataService
                .getStream(i)                    // 128B stream
                .pipe(takeUntil(this.destroy$))  // auto-unsub ✓
                .subscribe((val) => {            // 48B sub
                    this.data = val;
                });
        }
    }

    ngOnDestroy(): void {
        this.destroy$.next();     // triggers all unsubscribes ✓
        this.destroy$.complete(); // freed ✓
        this.data = null;         // freed ✓
    }
}`,
      events: (() => {
        const e = []; let t = 0;
        e.push({ time: t++, action: "alloc", id: "destroy$", size: 16, label: "destroy$ (Subject)" });
        e.push({ time: t++, action: "alloc", id: "data", size: 64, label: "data: DataStream" });
        for (let i = 0; i < 4; i++) {
          e.push({ time: t++, action: "alloc", id: `stream_${i}`, size: 128, label: `stream[${i}]` });
          e.push({ time: t++, action: "alloc", id: `sub_${i}`, size: 48, label: `sub[${i}]` });
        }
        for (let i = 0; i < 4; i++) {
          e.push({ time: t++, action: "free", id: `sub_${i}` });
          e.push({ time: t++, action: "free", id: `stream_${i}` });
        }
        e.push({ time: t++, action: "free", id: "data" });
        e.push({ time: t++, action: "free", id: "destroy$" });
        e.push({ time: t++, action: "end" });
        return e;
      })(),
    },
  },
  Go: {
    "Go — Goroutine Leak": {
      lang: "Go", description: "Goroutines blocked on channels never consumed",
      code: `func processJobs() {
    results := make(chan Result, 2)  // buffered chan — 64B

    for i := 0; i < 6; i++ {
        buf := make([]byte, 256)    // job buffer
        go func(id int) {           // 48B goroutine stack
            res := compute(buf)
            results <- res          // BLOCKS if buffer full!
            // goroutine never returns ✗ LEAK
        }(i)
    }

    // Only consume 2 results — 4 goroutines stuck!
    r1 := <-results
    r2 := <-results
    fmt.Println(r1, r2)
    close(results)                  // chan freed ✓
}`,
      events: (() => {
        const e = []; let t = 0;
        e.push({ time: t++, action: "alloc", id: "results_ch", size: 64, label: "results (chan)" });
        for (let i = 0; i < 6; i++) {
          e.push({ time: t++, action: "alloc", id: `buf_${i}`, size: 256, label: `buf[${i}]` });
          e.push({ time: t++, action: "alloc", id: `goroutine_${i}`, size: 48, label: `goroutine[${i}]` });
        }
        e.push({ time: t++, action: "free", id: "buf_0" });
        e.push({ time: t++, action: "free", id: "goroutine_0" });
        e.push({ time: t++, action: "free", id: "buf_1" });
        e.push({ time: t++, action: "free", id: "goroutine_1" });
        e.push({ time: t++, action: "free", id: "results_ch" });
        e.push({ time: t++, action: "end" });
        return e;
      })(),
    },
    "Go — Unbounded Slice": {
      lang: "Go", description: "Slice append grows backing array without bound",
      code: `func aggregateMetrics(stream <-chan Metric) {
    history := make([]Metric, 0)     // 32B header

    for metric := range stream {     // 8 metrics arrive
        entry := Metric{             // 128B each
            Time:  time.Now(),
            Value: metric.Value,
        }
        history = append(history, entry)

        if len(history) > 4 {
            // re-slice but old backing array retained!
            history = history[len(history)-4:]
            // underlying cap never shrinks ✗
        }
    }
    // history goes out of scope ✓
}`,
      events: (() => {
        const e = []; let t = 0;
        e.push({ time: t++, action: "alloc", id: "history_hdr", size: 32, label: "history (slice hdr)" });
        for (let i = 0; i < 8; i++) {
          e.push({ time: t++, action: "alloc", id: `entry_${i}`, size: 128, label: `entry[${i}]` });
          if (i > 4) e.push({ time: t++, action: "free", id: `entry_${i - 4}` });
        }
        e.push({ time: t++, action: "free", id: "history_hdr" });
        e.push({ time: t++, action: "end" });
        return e;
      })(),
    },
  },
  Python: {
    "Python — Circular Refs": {
      lang: "Python", description: "Circular refs with __del__ prevent GC",
      code: `class Node:
    def __init__(self, name: str):
        self.name = name              # 32B
        self.data = bytearray(256)    # 256B payload
        self.peer: "Node | None" = None

    def __del__(self):
        print(f"Cleaning {self.name}")  # prevent GC cycle!

def build_graph():
    nodes = []
    for i in range(4):
        node = Node(f"node_{i}")       # 288B each
        if nodes:
            node.peer = nodes[-1]      # forward ref
            nodes[-1].peer = node      # back ref → CYCLE
        nodes.append(node)

    nodes.clear()                      # remove list refs ✓
    # but circular refs + __del__ prevent GC! ✗ LEAK
    gc.collect()                       # even explicit GC fails`,
      events: (() => {
        const e = []; let t = 0;
        e.push({ time: t++, action: "alloc", id: "nodes_list", size: 32, label: "nodes (list)" });
        for (let i = 0; i < 4; i++) {
          e.push({ time: t++, action: "alloc", id: `node_${i}`, size: 288, label: `Node("node_${i}")` });
        }
        e.push({ time: t++, action: "free", id: "nodes_list" });
        e.push({ time: t++, action: "end" });
        return e;
      })(),
    },
    "Python — Context Mgr OK": {
      lang: "Python", description: "Resources properly managed with context managers",
      code: `def process_files(paths: list[str]) -> None:
    results: list[str] = []           # 32B

    for path in paths:                # 4 files
        with open(path) as f:         # 128B file handle
            buf = f.read()            # 256B buffer
            results.append(parse(buf))
            # buf eligible for GC ✓
        # f.__exit__ called → fd closed ✓

    with db.connection() as conn:     # 128B conn
        conn.executemany(
            "INSERT INTO data VALUES (?)",
            results,
        )
    # conn.__exit__ → released ✓
    # results goes out of scope ✓`,
      events: (() => {
        const e = []; let t = 0;
        e.push({ time: t++, action: "alloc", id: "results", size: 32, label: "results (list)" });
        for (let i = 0; i < 4; i++) {
          e.push({ time: t++, action: "alloc", id: `fh_${i}`, size: 128, label: `file_handle[${i}]` });
          e.push({ time: t++, action: "alloc", id: `buf_${i}`, size: 256, label: `buf[${i}]` });
          e.push({ time: t++, action: "free", id: `buf_${i}` });
          e.push({ time: t++, action: "free", id: `fh_${i}` });
        }
        e.push({ time: t++, action: "alloc", id: "conn", size: 128, label: "db_conn" });
        e.push({ time: t++, action: "free", id: "conn" });
        e.push({ time: t++, action: "free", id: "results" });
        e.push({ time: t++, action: "end" });
        return e;
      })(),
    },
  },
};

const LANG_COLORS = { Rust: "#f97316", JavaScript: "#facc15", TypeScript: "#3b82f6", Go: "#06b6d4", Python: "#a78bfa" };
const STATUS_COLORS = { active: "#22d3ee", freed: "#4ade80", leaked: "#f87171", double_free: "#fbbf24" };
const STATUS_BG = {
  active: "rgba(34,211,238,0.12)", freed: "rgba(74,222,128,0.08)",
  leaked: "rgba(248,113,113,0.15)", double_free: "rgba(251,191,36,0.15)",
};

function MemoryBlock({ block, maxSize, isNew }) {
  const widthPct = Math.max(20, (block.size / maxSize) * 100);
  const color = STATUS_COLORS[block.status] || STATUS_COLORS.active;
  const bg = STATUS_BG[block.status] || STATUS_BG.active;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "6px 0",
      animation: isNew ? "slideIn 0.35s cubic-bezier(0.16,1,0.3,1)" : undefined,
      opacity: block.status === "freed" ? 0.3 : 1, transition: "opacity 0.4s ease",
    }}>
      <div style={{
        width: 160, fontSize: 11, fontFamily: "'IBM Plex Mono',monospace",
        color, textAlign: "right", flexShrink: 0, overflow: "hidden",
        textOverflow: "ellipsis", whiteSpace: "nowrap",
      }} title={block.label}>{block.label}</div>
      <div style={{ flex: 1, position: "relative", height: 26 }}>
        <div style={{
          position: "absolute", left: 0, top: 0, height: "100%", width: `${widthPct}%`,
          background: bg, border: `1px solid ${color}`, borderRadius: 3,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 8px", boxSizing: "border-box", transition: "width 0.3s ease",
          ...(block.status === "leaked" ? {
            boxShadow: "0 0 12px rgba(248,113,113,0.3),inset 0 0 20px rgba(248,113,113,0.05)", borderStyle: "dashed",
          } : block.status === "double_free" ? {
            boxShadow: "0 0 12px rgba(251,191,36,0.3)", animation: "pulse 1s infinite",
          } : {}),
        }}>
          <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono',monospace", color, opacity: 0.8 }}>{block.size}B</span>
          <span style={{ fontSize: 9, fontFamily: "'IBM Plex Mono',monospace", color, opacity: 0.6, textTransform: "uppercase", letterSpacing: 1 }}>
            {block.status === "double_free" ? "DOUBLE FREE!" : block.status}
          </span>
        </div>
      </div>
    </div>
  );
}

function HeapChart({ snapshots, allSnapshots }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || snapshots.length === 0) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width, h = rect.height;
    const pad = { top: 16, right: 12, bottom: 24, left: 44 };
    const plotW = w - pad.left - pad.right, plotH = h - pad.top - pad.bottom;
    ctx.clearRect(0, 0, w, h);
    const maxHeap = Math.max(...allSnapshots.map(s => s.total), 128);
    ctx.strokeStyle = "rgba(148,163,184,0.08)"; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (plotH / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
    }
    ctx.fillStyle = "rgba(148,163,184,0.35)"; ctx.font = "9px 'IBM Plex Mono',monospace"; ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) ctx.fillText(`${Math.round((maxHeap / 4) * (4 - i))}B`, pad.left - 6, pad.top + (plotH / 4) * i + 3);
    if (snapshots.length > 1) {
      const stepX = plotW / Math.max(allSnapshots.length - 1, 1);
      ctx.beginPath(); ctx.moveTo(pad.left, pad.top + plotH);
      snapshots.forEach((s, i) => ctx.lineTo(pad.left + i * stepX, pad.top + plotH - (s.total / maxHeap) * plotH));
      ctx.lineTo(pad.left + (snapshots.length - 1) * stepX, pad.top + plotH); ctx.closePath();
      const g = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
      g.addColorStop(0, "rgba(34,211,238,0.2)"); g.addColorStop(1, "rgba(34,211,238,0.01)");
      ctx.fillStyle = g; ctx.fill();
      ctx.beginPath();
      snapshots.forEach((s, i) => { const x = pad.left + i * stepX, y = pad.top + plotH - (s.total / maxHeap) * plotH; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
      ctx.strokeStyle = "#22d3ee"; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad.left, pad.top + plotH);
      snapshots.forEach((s, i) => ctx.lineTo(pad.left + i * stepX, pad.top + plotH - (s.leaked / maxHeap) * plotH));
      ctx.lineTo(pad.left + (snapshots.length - 1) * stepX, pad.top + plotH); ctx.closePath();
      const lg = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
      lg.addColorStop(0, "rgba(248,113,113,0.3)"); lg.addColorStop(1, "rgba(248,113,113,0.02)");
      ctx.fillStyle = lg; ctx.fill();
      const last = snapshots[snapshots.length - 1];
      const cx = pad.left + (snapshots.length - 1) * stepX, cy = pad.top + plotH - (last.total / maxHeap) * plotH;
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fillStyle = "#22d3ee"; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.strokeStyle = "rgba(34,211,238,0.35)"; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.fillStyle = "rgba(148,163,184,0.25)"; ctx.font = "8px 'IBM Plex Mono',monospace"; ctx.textAlign = "center";
    ctx.fillText("TIME →", w / 2, h - 3);
  }, [snapshots, allSnapshots]);
  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />;
}

function EventLog({ events, currentStep }) {
  const logRef = useRef(null);
  const vis = events.slice(0, currentStep + 1).filter(e => e.action !== "end");
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [currentStep]);
  const icon = a => ({ alloc: "█+", free: "█−", double_free: "⚠!" }[a] || "··");
  const clr = a => ({ alloc: "#22d3ee", free: "#4ade80", double_free: "#fbbf24" }[a] || "#94a3b8");
  return (
    <div ref={logRef} style={{ height: "100%", overflowY: "auto", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, lineHeight: 1.75, padding: "6px 10px", scrollBehavior: "smooth" }}>
      {vis.map((e, i) => (
        <div key={i} style={{ color: clr(e.action), opacity: i === vis.length - 1 ? 1 : 0.55, display: "flex", gap: 6 }}>
          <span style={{ opacity: 0.4, width: 24, textAlign: "right" }}>{String(e.time).padStart(3, "0")}</span>
          <span style={{ width: 22 }}>{icon(e.action)}</span>
          <span>{e.action === "alloc" ? `alloc(${e.size}, "${e.label}") → 0x${(0x7f000000 + i * 0x100).toString(16)}` : e.action === "free" ? `free(${e.id})` : `DOUBLE_FREE(${e.id}) ← USE-AFTER-FREE`}</span>
        </div>
      ))}
      {vis.length === 0 && <div style={{ color: "#475569", fontStyle: "italic", padding: 8 }}>Press ▶ to begin analysis...</div>}
    </div>
  );
}

export default function MemoryAnalyzer() {
  const [selectedLang, setSelectedLang] = useState("Rust");
  const [selectedProgram, setSelectedProgram] = useState(Object.keys(SAMPLE_PROGRAMS["Rust"])[0]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(600);
  const [newBlockIds, setNewBlockIds] = useState(new Set());
  const intervalRef = useRef(null);

  const program = SAMPLE_PROGRAMS[selectedLang][selectedProgram];
  const events = program.events;
  const totalSteps = events.length;

  const { blocks, snapshots, stats } = useMemo(() => {
    const bm = new Map(); const snaps = []; let peak = 0;
    for (let i = 0; i <= Math.min(currentStep, events.length - 1); i++) {
      const e = events[i];
      if (e.action === "alloc") bm.set(e.id, { id: e.id, label: e.label, size: e.size, status: "active" });
      else if (e.action === "free" && bm.has(e.id)) bm.get(e.id).status = "freed";
      else if (e.action === "double_free" && bm.has(e.id)) bm.get(e.id).status = "double_free";
      else if (e.action === "end") bm.forEach(b => { if (b.status === "active") b.status = "leaked"; });
      const act = [...bm.values()].filter(b => b.status === "active" || b.status === "leaked");
      const tot = act.reduce((s, b) => s + b.size, 0);
      const lk = [...bm.values()].filter(b => b.status === "leaked").reduce((s, b) => s + b.size, 0);
      peak = Math.max(peak, tot); snaps.push({ total: tot, leaked: lk });
    }
    const all = [...bm.values()];
    const a = all.filter(b => b.status === "active"), l = all.filter(b => b.status === "leaked");
    const f = all.filter(b => b.status === "freed"), d = all.filter(b => b.status === "double_free");
    return { blocks: all, snapshots: snaps, stats: {
      currentHeap: a.reduce((s, b) => s + b.size, 0) + l.reduce((s, b) => s + b.size, 0),
      peakMem: peak, leakedBytes: l.reduce((s, b) => s + b.size, 0),
      leakedCount: l.length, freedCount: f.length, activeCount: a.length,
      doubleFreeCount: d.length, totalOps: Math.min(currentStep + 1, events.length),
    }};
  }, [currentStep, events]);

  const maxBlockSize = useMemo(() => Math.max(...events.filter(e => e.action === "alloc").map(e => e.size), 1), [events]);

  const allSnapshots = useMemo(() => {
    const bm = new Map(); const sn = [];
    for (const ev of events) {
      if (ev.action === "alloc") bm.set(ev.id, { ...ev, status: "active" });
      else if (ev.action === "free" && bm.has(ev.id)) bm.get(ev.id).status = "freed";
      else if (ev.action === "end") bm.forEach(b => { if (b.status === "active") b.status = "leaked"; });
      const act = [...bm.values()].filter(b => b.status === "active" || b.status === "leaked");
      sn.push({ total: act.reduce((s, b) => s + b.size, 0), leaked: [...bm.values()].filter(b => b.status === "leaked").reduce((s, b) => s + b.size, 0) });
    }
    return sn;
  }, [events]);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentStep(prev => {
          const next = prev + 1;
          if (next >= totalSteps) { setIsPlaying(false); return totalSteps - 1; }
          const ev = events[next];
          if (ev?.action === "alloc") {
            setNewBlockIds(s => new Set([...s, ev.id]));
            setTimeout(() => setNewBlockIds(s => { const ns = new Set(s); ns.delete(ev.id); return ns; }), 400);
          }
          return next;
        });
      }, speed);
    }
    return () => clearInterval(intervalRef.current);
  }, [isPlaying, speed, totalSteps, events]);

  const reset = () => { setIsPlaying(false); setCurrentStep(-1); setNewBlockIds(new Set()); };
  const changeLang = (lang) => { setSelectedLang(lang); setSelectedProgram(Object.keys(SAMPLE_PROGRAMS[lang])[0]); reset(); };
  const changeProg = (name) => { setSelectedProgram(name); reset(); };
  const step = () => {
    setIsPlaying(false);
    setCurrentStep(prev => {
      const next = prev + 1; if (next >= totalSteps) return prev;
      const ev = events[next];
      if (ev?.action === "alloc") {
        setNewBlockIds(s => new Set([...s, ev.id]));
        setTimeout(() => setNewBlockIds(s => { const ns = new Set(s); ns.delete(ev.id); return ns; }), 400);
      }
      return next;
    });
  };

  const verdict = currentStep >= totalSteps - 1
    ? stats.doubleFreeCount > 0 ? { text: "DOUBLE FREE DETECTED", color: "#fbbf24", icon: "⚠" }
    : stats.leakedCount > 0 ? { text: `LEAK: ${stats.leakedBytes}B IN ${stats.leakedCount} BLOCK(S)`, color: "#f87171", icon: "✗" }
    : { text: "ALL CLEAR — NO LEAKS", color: "#4ade80", icon: "✓" } : null;

  const lc = LANG_COLORS[selectedLang] || "#22d3ee";
  const [showExport, setShowExport] = useState(false);

  // ─── Export Functions ───────────────────────────────────────────────────

  const downloadFile = (content, filename, mime) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const getTimestamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  const exportJSON = () => {
    const data = {
      meta: { tool: "Heap Analyzer v2.0", exported: new Date().toISOString(), language: selectedLang, scenario: selectedProgram },
      source: program.code,
      events: events.map(e => ({ ...e })),
      blocks: blocks.map(b => ({ id: b.id, label: b.label, size: b.size, status: b.status })),
      stats: { ...stats, verdict: verdict?.text || "INCOMPLETE" },
      snapshots: snapshots.map((s, i) => ({ step: i, heapBytes: s.total, leakedBytes: s.leaked })),
    };
    downloadFile(JSON.stringify(data, null, 2), `heap-analysis-${selectedLang.toLowerCase()}-${getTimestamp()}.json`, "application/json");
    setShowExport(false);
  };

  const exportMarkdown = () => {
    const v = verdict?.text || "Analysis incomplete — run to end";
    const leakedBlocks = blocks.filter(b => b.status === "leaked");
    const dfBlocks = blocks.filter(b => b.status === "double_free");
    let md = `# Heap Analysis Report\n\n`;
    md += `**Language:** ${selectedLang}  \n**Scenario:** ${selectedProgram}  \n**Generated:** ${new Date().toISOString()}  \n\n`;
    md += `## Verdict\n\n\`${v}\`\n\n`;
    md += `## Statistics\n\n`;
    md += `| Metric | Value |\n|--------|-------|\n`;
    md += `| Current Heap | ${stats.currentHeap}B |\n`;
    md += `| Peak Memory | ${stats.peakMem}B |\n`;
    md += `| Active Blocks | ${stats.activeCount} |\n`;
    md += `| Freed Blocks | ${stats.freedCount} |\n`;
    md += `| Leaked Blocks | ${stats.leakedCount} (${stats.leakedBytes}B) |\n`;
    md += `| Double Frees | ${stats.doubleFreeCount} |\n`;
    md += `| Total Ops | ${stats.totalOps}/${events.length} |\n\n`;
    if (leakedBlocks.length > 0) {
      md += `## Leaked Allocations\n\n`;
      leakedBlocks.forEach(b => { md += `- **${b.label}** — ${b.size}B (never freed)\n`; });
      md += `\n`;
    }
    if (dfBlocks.length > 0) {
      md += `## Double Free Violations\n\n`;
      dfBlocks.forEach(b => { md += `- **${b.label}** — ${b.size}B (freed multiple times)\n`; });
      md += `\n`;
    }
    md += `## Source Code\n\n\`\`\`${selectedLang.toLowerCase()}\n${program.code}\n\`\`\`\n\n`;
    md += `## Event Trace\n\n`;
    md += `| Time | Action | Details |\n|------|--------|---------|\n`;
    events.filter(e => e.action !== "end").forEach(e => {
      md += `| ${String(e.time).padStart(3, "0")} | ${e.action.toUpperCase()} | ${e.action === "alloc" ? `${e.label} (${e.size}B)` : e.id} |\n`;
    });
    downloadFile(md, `heap-analysis-${selectedLang.toLowerCase()}-${getTimestamp()}.md`, "text/markdown");
    setShowExport(false);
  };

  const exportHTML = () => {
    const v = verdict?.text || "Analysis incomplete";
    const vColor = verdict?.color || "#94a3b8";
    const leakedBlocks = blocks.filter(b => b.status === "leaked");
    const dfBlocks = blocks.filter(b => b.status === "double_free");
    const activeBlocks = blocks.filter(b => b.status === "active");
    const freedBlocks = blocks.filter(b => b.status === "freed");

    const escapeHtml = (s) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

    const codeLines = program.code.split("\n").map((line, i) => {
      const leak = /LEAK|never freed|never dropped|prevents GC|never returns|never shrinks/.test(line);
      const df = /DOUBLE FREE|USE-AFTER-FREE|dangling/.test(line);
      const cls = leak ? "line-leak" : df ? "line-df" : "";
      return `<div class="code-line ${cls}"><span class="ln">${i + 1}</span>${escapeHtml(line)}</div>`;
    }).join("\n");

    const blockRows = (arr, status) => arr.map(b =>
      `<tr><td><span class="status-dot status-${status}"></span>${escapeHtml(b.label)}</td><td>${b.size}B</td><td class="status-${status}">${status.toUpperCase()}</td></tr>`
    ).join("\n");

    const eventRows = events.filter(e => e.action !== "end").map(e =>
      `<tr class="evt-${e.action}"><td>${String(e.time).padStart(3, "0")}</td><td>${e.action.toUpperCase()}</td><td>${e.action === "alloc" ? `${escapeHtml(e.label)} (${e.size}B)` : escapeHtml(e.id)}</td></tr>`
    ).join("\n");

    const snapData = JSON.stringify(snapshots.map(s => s.total));
    const leakData = JSON.stringify(snapshots.map(s => s.leaked));

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Heap Analysis — ${escapeHtml(selectedProgram)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0e17; color: #e2e8f0; font-family: 'IBM Plex Mono', monospace; padding: 32px; max-width: 1200px; margin: 0 auto; }
  h1 { font-size: 18px; font-weight: 600; letter-spacing: 3px; color: #22d3ee; text-transform: uppercase; margin-bottom: 4px; }
  .meta { font-size: 11px; color: #475569; margin-bottom: 24px; }
  .meta span { margin-right: 16px; }
  .meta .lang { color: ${LANG_COLORS[selectedLang]}; font-weight: 600; }
  .verdict { display: inline-block; padding: 8px 20px; border-radius: 4px; border: 1px solid ${vColor}; background: ${vColor}18; color: ${vColor}; font-size: 13px; font-weight: 600; letter-spacing: 1px; margin-bottom: 28px; }
  .section-title { font-size: 10px; letter-spacing: 2px; color: #475569; text-transform: uppercase; margin: 24px 0 10px; padding-bottom: 6px; border-bottom: 1px solid rgba(34,211,238,0.1); }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .stat-card { background: rgba(34,211,238,0.04); border: 1px solid rgba(34,211,238,0.1); border-radius: 6px; padding: 12px; }
  .stat-card .label { font-size: 8px; letter-spacing: 2px; color: #475569; text-transform: uppercase; }
  .stat-card .value { font-size: 20px; font-weight: 600; color: #22d3ee; margin-top: 2px; }
  .stat-card .value.peak { color: #818cf8; }
  .stat-card .value.freed { color: #4ade80; }
  .stat-card .value.leaked { color: #f87171; }
  .stat-card .value.warn { color: #fbbf24; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
  @media (max-width: 800px) { .two-col { grid-template-columns: 1fr; } }
  .code-block { background: rgba(0,0,0,0.3); border: 1px solid rgba(34,211,238,0.08); border-radius: 6px; padding: 16px; overflow-x: auto; font-size: 12px; line-height: 1.7; }
  .code-line { white-space: pre; }
  .code-line .ln { display: inline-block; width: 28px; text-align: right; margin-right: 16px; color: #1e293b; user-select: none; font-size: 10px; }
  .line-leak { background: rgba(248,113,113,0.06); border-left: 2px solid rgba(248,113,113,0.5); color: #f87171; }
  .line-df { background: rgba(251,191,36,0.06); border-left: 2px solid rgba(251,191,36,0.5); color: #fbbf24; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; font-size: 9px; letter-spacing: 1px; color: #475569; text-transform: uppercase; padding: 6px 10px; border-bottom: 1px solid rgba(34,211,238,0.1); }
  td { padding: 5px 10px; border-bottom: 1px solid rgba(34,211,238,0.05); }
  .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 8px; vertical-align: middle; }
  .status-active, .status-dot.status-active { color: #22d3ee; background: #22d3ee; }
  .status-freed, .status-dot.status-freed { color: #4ade80; background: #4ade80; }
  .status-leaked, .status-dot.status-leaked { color: #f87171; background: #f87171; }
  .status-double_free, .status-dot.status-double_free { color: #fbbf24; background: #fbbf24; }
  .evt-alloc td { color: #22d3ee; }
  .evt-free td { color: #4ade80; }
  .evt-double_free td { color: #fbbf24; }
  .table-wrap { background: rgba(0,0,0,0.2); border: 1px solid rgba(34,211,238,0.08); border-radius: 6px; padding: 12px; overflow-x: auto; }
  canvas { width: 100%; height: 180px; display: block; margin-bottom: 8px; }
  .chart-wrap { background: rgba(0,0,0,0.2); border: 1px solid rgba(34,211,238,0.08); border-radius: 6px; padding: 12px 12px 4px; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(34,211,238,0.08); font-size: 9px; color: #334155; text-align: center; }
</style>
</head>
<body>
  <h1>⬡ Heap Analysis Report</h1>
  <div class="meta">
    <span class="lang">${escapeHtml(selectedLang)}</span>
    <span>${escapeHtml(selectedProgram)}</span>
    <span>${new Date().toLocaleString()}</span>
  </div>
  <div class="verdict">${verdict?.icon || "○"} ${escapeHtml(v)}</div>

  <div class="section-title">Statistics</div>
  <div class="stats-grid">
    <div class="stat-card"><div class="label">Current Heap</div><div class="value">${stats.currentHeap}B</div></div>
    <div class="stat-card"><div class="label">Peak Memory</div><div class="value peak">${stats.peakMem}B</div></div>
    <div class="stat-card"><div class="label">Active</div><div class="value">${stats.activeCount}</div></div>
    <div class="stat-card"><div class="label">Freed</div><div class="value freed">${stats.freedCount}</div></div>
    <div class="stat-card"><div class="label">Leaked</div><div class="value leaked">${stats.leakedCount} (${stats.leakedBytes}B)</div></div>
    <div class="stat-card"><div class="label">Double Frees</div><div class="value warn">${stats.doubleFreeCount}</div></div>
  </div>

  <div class="section-title">Heap Over Time</div>
  <div class="chart-wrap"><canvas id="heapChart"></canvas></div>

  <div class="two-col">
    <div>
      <div class="section-title">Source Code</div>
      <div class="code-block">${codeLines}</div>
    </div>
    <div>
      <div class="section-title">Memory Blocks (${blocks.length})</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Block</th><th>Size</th><th>Status</th></tr></thead>
          <tbody>
            ${blockRows(leakedBlocks, "leaked")}
            ${blockRows(dfBlocks, "double_free")}
            ${blockRows(activeBlocks, "active")}
            ${blockRows(freedBlocks, "freed")}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="section-title">Event Trace (${events.filter(e=>e.action!=="end").length} ops)</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Time</th><th>Action</th><th>Details</th></tr></thead>
      <tbody>${eventRows}</tbody>
    </table>
  </div>

  <div class="footer">Generated by Heap Analyzer v2.0 • ${escapeHtml(selectedLang)} • ${new Date().toISOString()}</div>

  <script>
    const data = ${snapData};
    const leakD = ${leakData};
    const canvas = document.getElementById("heapChart");
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    function draw() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      const w = rect.width, h = rect.height;
      const pad = { top: 16, right: 12, bottom: 24, left: 48 };
      const pw = w - pad.left - pad.right, ph = h - pad.top - pad.bottom;
      const mx = Math.max(...data, 128);
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(148,163,184,0.08)"; ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) { const y = pad.top + (ph/4)*i; ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(w-pad.right,y); ctx.stroke(); }
      ctx.fillStyle = "rgba(148,163,184,0.35)"; ctx.font = "9px 'IBM Plex Mono',monospace"; ctx.textAlign = "right";
      for (let i = 0; i <= 4; i++) ctx.fillText(Math.round((mx/4)*(4-i))+"B", pad.left-6, pad.top+(ph/4)*i+3);
      if (data.length > 1) {
        const sx = pw / (data.length - 1);
        ctx.beginPath(); ctx.moveTo(pad.left, pad.top+ph);
        data.forEach((v,i) => ctx.lineTo(pad.left+i*sx, pad.top+ph-(v/mx)*ph));
        ctx.lineTo(pad.left+(data.length-1)*sx, pad.top+ph); ctx.closePath();
        const g = ctx.createLinearGradient(0,pad.top,0,pad.top+ph);
        g.addColorStop(0,"rgba(34,211,238,0.2)"); g.addColorStop(1,"rgba(34,211,238,0.01)");
        ctx.fillStyle = g; ctx.fill();
        ctx.beginPath(); data.forEach((v,i) => { const x=pad.left+i*sx, y=pad.top+ph-(v/mx)*ph; i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
        ctx.strokeStyle = "#22d3ee"; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pad.left, pad.top+ph);
        leakD.forEach((v,i) => ctx.lineTo(pad.left+i*sx, pad.top+ph-(v/mx)*ph));
        ctx.lineTo(pad.left+(leakD.length-1)*sx, pad.top+ph); ctx.closePath();
        const lg = ctx.createLinearGradient(0,pad.top,0,pad.top+ph);
        lg.addColorStop(0,"rgba(248,113,113,0.3)"); lg.addColorStop(1,"rgba(248,113,113,0.02)");
        ctx.fillStyle = lg; ctx.fill();
      }
      ctx.fillStyle="rgba(148,163,184,0.25)"; ctx.font="8px 'IBM Plex Mono',monospace"; ctx.textAlign="center";
      ctx.fillText("TIME →", w/2, h-3);
    }
    draw(); window.addEventListener("resize", () => { ctx.setTransform(1,0,0,1,0,0); draw(); });
  </script>
</body>
</html>`;
    downloadFile(html, `heap-analysis-${selectedLang.toLowerCase()}-${getTimestamp()}.html`, "text/html");
    setShowExport(false);
  };

  // Syntax highlight helpers
  const isAllocKw = (line) => /alloc|new |make\(|createElement|Box::new|Vec::|with_capacity|HashMap::new|open\(|bytearray|Node\(|Metric\{|getStream|Subject|connection\(\)/.test(line);
  const isFreeKw = (line) => /free|drop|close|\.clear\(\)|unsubscribe|__exit__|removeChild|\.next\(\)|\.complete\(\)/.test(line);
  const isLeakComment = (line) => /LEAK|never freed|never dropped|prevents GC|never returns|never shrinks/.test(line);
  const isDFComment = (line) => /DOUBLE FREE|USE-AFTER-FREE|dangling/.test(line);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e17", color: "#e2e8f0", fontFamily: "'IBM Plex Mono','Fira Code',monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&display=swap');
        @keyframes slideIn { from { transform: translateX(-12px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(34,211,238,0.2); border-radius: 2px; }
      `}</style>

      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 100, background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px)" }} />

      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(34,211,238,0.15)", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(34,211,238,0.02)", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: isPlaying ? "#22d3ee" : "#475569", boxShadow: isPlaying ? "0 0 12px rgba(34,211,238,0.6)" : "none", transition: "all 0.3s" }} />
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: 3, color: "#22d3ee", textTransform: "uppercase" }}>HEAP ANALYZER</span>
          <span style={{ fontSize: 9, color: "#475569", letterSpacing: 1 }}>v2.0</span>
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {Object.keys(SAMPLE_PROGRAMS).map(lang => (
            <button key={lang} onClick={() => changeLang(lang)} style={{
              padding: "5px 14px", fontSize: 10, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 0.5, borderRadius: 3, cursor: "pointer", transition: "all 0.2s",
              background: selectedLang === lang ? `${LANG_COLORS[lang]}20` : "transparent",
              border: `1px solid ${selectedLang === lang ? `${LANG_COLORS[lang]}66` : "rgba(148,163,184,0.1)"}`,
              color: selectedLang === lang ? LANG_COLORS[lang] : "#4a5568", fontWeight: selectedLang === lang ? 600 : 400,
            }}>{lang}</button>
          ))}
        </div>
      </div>

      {/* Scenario tabs */}
      <div style={{ padding: "6px 20px", borderBottom: "1px solid rgba(34,211,238,0.08)", display: "flex", gap: 4, background: "rgba(0,0,0,0.15)", overflowX: "auto" }}>
        {Object.keys(SAMPLE_PROGRAMS[selectedLang]).map(name => {
          const short = name.replace(/^(Rust|JS|TS|Go|Python) — /, "");
          return (
            <button key={name} onClick={() => changeProg(name)} style={{
              padding: "4px 12px", fontSize: 10, fontFamily: "'IBM Plex Mono',monospace",
              background: selectedProgram === name ? `${lc}15` : "transparent",
              border: `1px solid ${selectedProgram === name ? `${lc}40` : "rgba(148,163,184,0.08)"}`,
              color: selectedProgram === name ? lc : "#64748b", borderRadius: 3, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
            }}>{short}</button>
          );
        })}
        <span style={{ fontSize: 10, color: "#334155", padding: "4px 8px", fontStyle: "italic", flexShrink: 0 }}>{program.description}</span>
      </div>

      {/* Main layout: column with top 50/50 row + full-width bottom */}
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 93px)" }}>

        {/* TOP ROW: Source (50%) | Stats + Blocks (50%) */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* LEFT: Source — 50% */}
          <div style={{ width: "50%", borderRight: `1px solid ${lc}22`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={{ padding: "8px 16px", borderBottom: `1px solid ${lc}15`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: lc }} />
                <span style={{ fontSize: 10, letterSpacing: 2, color: lc, textTransform: "uppercase", fontWeight: 600 }}>{program.lang} Source</span>
              </div>
            </div>
            <pre style={{ flex: 1, margin: 0, padding: 20, fontSize: 12.5, lineHeight: 1.75, color: "#94a3b8", overflow: "auto", background: "rgba(0,0,0,0.25)", tabSize: 4 }}>
              {program.code.split("\n").map((line, i) => {
                const leak = isLeakComment(line);
                const df = isDFComment(line);
                const alloc = !leak && !df && isAllocKw(line);
                const free = !leak && !df && isFreeKw(line);
                const comment = line.trimStart().startsWith("//") || line.trimStart().startsWith("#");
                return (
                  <div key={i} style={{
                    display: "flex", margin: "0 -20px", padding: "0 20px",
                    background: leak ? "rgba(248,113,113,0.06)" : df ? "rgba(251,191,36,0.06)" : "transparent",
                    borderLeft: leak ? "2px solid rgba(248,113,113,0.5)" : df ? "2px solid rgba(251,191,36,0.5)" : "2px solid transparent",
                  }}>
                    <span style={{ width: 32, textAlign: "right", marginRight: 20, color: "#1e293b", userSelect: "none", fontSize: 10, lineHeight: "inherit" }}>{i + 1}</span>
                    <span style={{ color: leak ? "#f87171" : df ? "#fbbf24" : comment ? "#475569" : alloc ? lc : free ? "#4ade80" : "#94a3b8" }}>{line}</span>
                  </div>
                );
              })}
            </pre>
          </div>

          {/* RIGHT: Stats + Blocks — 50% */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Stats */}
            <div style={{ padding: "8px 16px", borderBottom: "1px solid rgba(34,211,238,0.08)", display: "flex", gap: 20, alignItems: "center", background: "rgba(0,0,0,0.15)", flexWrap: "wrap" }}>
              {[
                { l: "HEAP", v: `${stats.currentHeap}B`, c: "#22d3ee" }, { l: "PEAK", v: `${stats.peakMem}B`, c: "#818cf8" },
                { l: "ACTIVE", v: stats.activeCount, c: "#22d3ee" }, { l: "FREED", v: stats.freedCount, c: "#4ade80" },
                { l: "LEAKED", v: stats.leakedCount, c: stats.leakedCount > 0 ? "#f87171" : "#475569" },
                { l: "OPS", v: `${stats.totalOps}/${events.length}`, c: "#475569" },
              ].map(s => (
                <div key={s.l} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <span style={{ fontSize: 8, letterSpacing: 2, color: "#475569", textTransform: "uppercase" }}>{s.l}</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: s.c, fontFamily: "'IBM Plex Mono',monospace" }}>{s.v}</span>
                </div>
              ))}
              {verdict && (
                <div style={{
                  marginLeft: "auto", padding: "4px 12px", borderRadius: 4, border: `1px solid ${verdict.color}`,
                  background: `${verdict.color}11`, color: verdict.color, fontSize: 10, fontWeight: 600, letterSpacing: 1,
                  animation: "fadeIn 0.4s ease", display: "flex", gap: 6, alignItems: "center",
                }}><span style={{ fontSize: 13 }}>{verdict.icon}</span>{verdict.text}</div>
              )}
            </div>

            {/* Blocks */}
            <div style={{ flex: 1, overflow: "auto", padding: "10px 16px" }}>
              <div style={{ fontSize: 8, letterSpacing: 2, color: "#334155", textTransform: "uppercase", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                <span>Heap Blocks</span>
                <div style={{ display: "flex", gap: 12 }}>
                  {[{ l: "Active", c: STATUS_COLORS.active }, { l: "Freed", c: STATUS_COLORS.freed }, { l: "Leaked", c: STATUS_COLORS.leaked }, { l: "Double Free", c: STATUS_COLORS.double_free }].map(x => (
                    <span key={x.l} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 2, background: x.c, opacity: 0.7 }} />{x.l}
                    </span>
                  ))}
                </div>
              </div>
              {blocks.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 100, color: "#1e293b", fontSize: 11, border: "1px dashed rgba(34,211,238,0.1)", borderRadius: 6 }}>
                  ← Press ▶ to begin memory analysis
                </div>
              ) : blocks.sort((a, b) => ({ leaked: 0, double_free: 1, active: 2, freed: 3 }[a.status] ?? 9) - ({ leaked: 0, double_free: 1, active: 2, freed: 3 }[b.status] ?? 9))
                .map(b => <MemoryBlock key={b.id} block={b} maxSize={maxBlockSize} isNew={newBlockIds.has(b.id)} />)}
            </div>
          </div>
        </div>

        {/* BOTTOM: Full-width Chart + Log */}
        <div style={{ borderTop: "1px solid rgba(34,211,238,0.12)", display: "flex", height: 190, flexShrink: 0 }}>
          <div style={{ flex: 1, borderRight: "1px solid rgba(34,211,238,0.08)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "5px 10px", borderBottom: "1px solid rgba(34,211,238,0.06)", fontSize: 8, letterSpacing: 2, color: "#334155", textTransform: "uppercase" }}>Heap Over Time</div>
            <div style={{ flex: 1 }}><HeapChart snapshots={snapshots} allSnapshots={allSnapshots} /></div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "5px 10px", borderBottom: "1px solid rgba(34,211,238,0.06)", fontSize: 8, letterSpacing: 2, color: "#334155", textTransform: "uppercase" }}>Event Log</div>
            <EventLog events={events} currentStep={currentStep} />
          </div>
        </div>

        {/* BOTTOM: Full-width Controls */}
        <div style={{ padding: "8px 16px", borderTop: "1px solid rgba(34,211,238,0.15)", display: "flex", alignItems: "center", gap: 10, background: "rgba(0,0,0,0.2)", flexShrink: 0 }}>
          <button onClick={() => { if (currentStep >= totalSteps - 1) { reset(); setTimeout(() => setIsPlaying(true), 50); } else setIsPlaying(!isPlaying); }} style={{
            width: 34, height: 34, borderRadius: "50%", border: "1px solid rgba(34,211,238,0.4)",
            background: isPlaying ? "rgba(34,211,238,0.15)" : "transparent", color: "#22d3ee", fontSize: 13,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
          }}>{isPlaying ? "⏸" : "▶"}</button>
          <button onClick={reset} style={{ padding: "5px 12px", border: "1px solid rgba(148,163,184,0.15)", background: "transparent", color: "#64748b", fontSize: 10, fontFamily: "'IBM Plex Mono',monospace", borderRadius: 3, cursor: "pointer" }}>Reset</button>
          <button onClick={step} disabled={currentStep >= totalSteps - 1} style={{
            padding: "5px 12px", border: "1px solid rgba(148,163,184,0.15)", background: "transparent",
            color: currentStep >= totalSteps - 1 ? "#1e293b" : "#64748b", fontSize: 10, fontFamily: "'IBM Plex Mono',monospace", borderRadius: 3, cursor: currentStep >= totalSteps - 1 ? "default" : "pointer",
          }}>Step →</button>
          <div style={{ flex: 1 }}>
            <input type="range" min={-1} max={totalSteps - 1} value={currentStep} onChange={e => { setIsPlaying(false); setCurrentStep(parseInt(e.target.value)); }}
              style={{ width: "100%", height: 3, appearance: "none", background: `linear-gradient(to right, ${lc} ${((currentStep + 1) / totalSteps) * 100}%, #1e293b ${((currentStep + 1) / totalSteps) * 100}%)`, borderRadius: 2, outline: "none", cursor: "pointer" }} />
          </div>
          <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
            <span style={{ fontSize: 8, color: "#334155", letterSpacing: 1 }}>SPD</span>
            {[{ l: "1×", v: 800 }, { l: "2×", v: 400 }, { l: "4×", v: 200 }].map(s => (
              <button key={s.l} onClick={() => setSpeed(s.v)} style={{
                padding: "3px 7px", fontSize: 10, fontFamily: "'IBM Plex Mono',monospace",
                background: speed === s.v ? `${lc}20` : "transparent", border: `1px solid ${speed === s.v ? `${lc}50` : "rgba(148,163,184,0.1)"}`,
                color: speed === s.v ? lc : "#475569", borderRadius: 3, cursor: "pointer",
              }}>{s.l}</button>
            ))}
          </div>

          {/* Export dropdown */}
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowExport(!showExport)} style={{
              padding: "5px 12px", fontSize: 10, fontFamily: "'IBM Plex Mono',monospace",
              background: showExport ? "rgba(74,222,128,0.15)" : "transparent",
              border: `1px solid ${showExport ? "rgba(74,222,128,0.4)" : "rgba(148,163,184,0.15)"}`,
              color: showExport ? "#4ade80" : "#64748b", borderRadius: 3, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5, letterSpacing: 0.5,
            }}>
              ⬡ Export {showExport ? "▴" : "▾"}
            </button>
            {showExport && (
              <div style={{
                position: "absolute", bottom: "calc(100% + 6px)", right: 0, zIndex: 200,
                background: "#111827", border: "1px solid rgba(34,211,238,0.15)", borderRadius: 6,
                padding: 4, minWidth: 180, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                animation: "fadeIn 0.2s ease",
              }}>
                {[
                  { label: "HTML Report", desc: "Standalone page with chart", icon: "◉", fn: exportHTML, color: "#22d3ee" },
                  { label: "Markdown", desc: "Text report with tables", icon: "◇", fn: exportMarkdown, color: "#a78bfa" },
                  { label: "JSON Data", desc: "Raw events & blocks", icon: "{ }", fn: exportJSON, color: "#4ade80" },
                ].map(opt => (
                  <button key={opt.label} onClick={opt.fn} style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    padding: "8px 12px", background: "transparent", border: "none",
                    color: "#e2e8f0", cursor: "pointer", borderRadius: 4, textAlign: "left",
                    fontFamily: "'IBM Plex Mono',monospace", transition: "background 0.15s",
                  }} onMouseEnter={e => e.currentTarget.style.background = "rgba(34,211,238,0.08)"}
                     onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <span style={{ color: opt.color, fontSize: 12, width: 20, textAlign: "center", flexShrink: 0 }}>{opt.icon}</span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 500 }}>{opt.label}</div>
                      <div style={{ fontSize: 9, color: "#475569" }}>{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
