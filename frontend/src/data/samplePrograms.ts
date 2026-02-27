import { MemoryEvent, SampleProgramMap } from '../types';

function buildLeakedCacheEvents(): MemoryEvent[] {
  const e: MemoryEvent[] = [];
  let t = 0;
  e.push({ time: t++, action: 'alloc', id: 'config', size: 64, label: 'config' });
  for (let i = 0; i < 5; i++) {
    e.push({ time: t++, action: 'alloc', id: `buf_${i}`, size: 256, label: `buf[${i}]` });
    e.push({ time: t++, action: 'alloc', id: `cache_${i}`, size: 128, label: `cache[${i}]` });
    e.push({ time: t++, action: 'free', id: `buf_${i}` });
  }
  e.push({ time: t++, action: 'free', id: 'config' });
  e.push({ time: t++, action: 'end' });
  return e;
}

function buildCleanRAIIEvents(): MemoryEvent[] {
  const e: MemoryEvent[] = [];
  let t = 0;
  e.push({ time: t++, action: 'alloc', id: 'db', size: 256, label: 'db_conn' });
  e.push({ time: t++, action: 'alloc', id: 'pool', size: 128, label: 'thread_pool' });
  for (let i = 0; i < 4; i++) {
    e.push({ time: t++, action: 'alloc', id: `task_${i}`, size: 64, label: `task[${i}]` });
    e.push({ time: t++, action: 'alloc', id: `result_${i}`, size: 32, label: `result[${i}]` });
    e.push({ time: t++, action: 'free', id: `result_${i}` });
    e.push({ time: t++, action: 'free', id: `task_${i}` });
  }
  e.push({ time: t++, action: 'free', id: 'pool' });
  e.push({ time: t++, action: 'free', id: 'db' });
  e.push({ time: t++, action: 'end' });
  return e;
}

function buildEventListenerLeakEvents(): MemoryEvent[] {
  const e: MemoryEvent[] = [];
  let t = 0;
  e.push({ time: t++, action: 'alloc', id: 'appState', size: 64, label: 'appState (Map)' });
  for (let i = 0; i < 5; i++) {
    e.push({ time: t++, action: 'alloc', id: `widget_${i}`, size: 128, label: `widget[${i}]` });
    e.push({ time: t++, action: 'alloc', id: `handler_${i}`, size: 64, label: `handler[${i}] (closure)` });
  }
  e.push({ time: t++, action: 'free', id: 'appState' });
  e.push({ time: t++, action: 'end' });
  return e;
}

function buildDetachedDOMEvents(): MemoryEvent[] {
  const e: MemoryEvent[] = [];
  let t = 0;
  e.push({ time: t++, action: 'alloc', id: 'cache', size: 32, label: 'cache (obj)' });
  e.push({ time: t++, action: 'alloc', id: 'container', size: 32, label: 'container ref' });
  for (let i = 0; i < 4; i++) {
    e.push({ time: t++, action: 'alloc', id: `row_${i}`, size: 96, label: `row[${i}] (DOM)` });
    e.push({ time: t++, action: 'alloc', id: `data_${i}`, size: 256, label: `data[${i}]` });
    e.push({ time: t++, action: 'free', id: `data_${i}` });
  }
  e.push({ time: t++, action: 'free', id: 'container' });
  e.push({ time: t++, action: 'end' });
  return e;
}

function buildObservableLeakEvents(): MemoryEvent[] {
  const e: MemoryEvent[] = [];
  let t = 0;
  e.push({ time: t++, action: 'alloc', id: 'data', size: 64, label: 'data: DataStream' });
  e.push({ time: t++, action: 'alloc', id: 'subs', size: 32, label: 'subscriptions[]' });
  for (let i = 0; i < 4; i++) {
    e.push({ time: t++, action: 'alloc', id: `stream_${i}`, size: 128, label: `stream[${i}]` });
    e.push({ time: t++, action: 'alloc', id: `sub_${i}`, size: 48, label: `subscription[${i}]` });
  }
  e.push({ time: t++, action: 'free', id: 'subs' });
  e.push({ time: t++, action: 'free', id: 'data' });
  e.push({ time: t++, action: 'end' });
  return e;
}

function buildCleanReactiveEvents(): MemoryEvent[] {
  const e: MemoryEvent[] = [];
  let t = 0;
  e.push({ time: t++, action: 'alloc', id: 'destroy$', size: 16, label: 'destroy$ (Subject)' });
  e.push({ time: t++, action: 'alloc', id: 'data', size: 64, label: 'data: DataStream' });
  for (let i = 0; i < 4; i++) {
    e.push({ time: t++, action: 'alloc', id: `stream_${i}`, size: 128, label: `stream[${i}]` });
    e.push({ time: t++, action: 'alloc', id: `sub_${i}`, size: 48, label: `sub[${i}]` });
  }
  for (let i = 0; i < 4; i++) {
    e.push({ time: t++, action: 'free', id: `sub_${i}` });
    e.push({ time: t++, action: 'free', id: `stream_${i}` });
  }
  e.push({ time: t++, action: 'free', id: 'data' });
  e.push({ time: t++, action: 'free', id: 'destroy$' });
  e.push({ time: t++, action: 'end' });
  return e;
}

function buildGoroutineLeakEvents(): MemoryEvent[] {
  const e: MemoryEvent[] = [];
  let t = 0;
  e.push({ time: t++, action: 'alloc', id: 'results', size: 32, label: 'results (chan)' });
  for (let i = 0; i < 5; i++) {
    e.push({ time: t++, action: 'alloc', id: `g_${i}`, size: 128, label: `goroutine[${i}]` });
    e.push({ time: t++, action: 'alloc', id: `buf_${i}`, size: 64, label: `buf[${i}]` });
  }
  e.push({ time: t++, action: 'free', id: 'g_0' });
  e.push({ time: t++, action: 'free', id: 'buf_0' });
  e.push({ time: t++, action: 'free', id: 'results' });
  e.push({ time: t++, action: 'end' });
  return e;
}

function buildUnboundedSliceEvents(): MemoryEvent[] {
  const e: MemoryEvent[] = [];
  let t = 0;
  e.push({ time: t++, action: 'alloc', id: 'slice', size: 64, label: 'data (slice)' });
  for (let i = 0; i < 6; i++) {
    e.push({ time: t++, action: 'alloc', id: `elem_${i}`, size: 128 * (i + 1), label: `batch[${i}] (${128 * (i + 1)}B)` });
    if (i > 0) e.push({ time: t++, action: 'free', id: `elem_${i - 1}` });
  }
  e.push({ time: t++, action: 'end' });
  return e;
}

function buildCircularRefEvents(): MemoryEvent[] {
  const e: MemoryEvent[] = [];
  let t = 0;
  e.push({ time: t++, action: 'alloc', id: 'nodes', size: 32, label: 'nodes (list)' });
  for (let i = 0; i < 4; i++) {
    e.push({ time: t++, action: 'alloc', id: `node_${i}`, size: 128, label: `Node(${i})` });
  }
  e.push({ time: t++, action: 'alloc', id: 'cycle_ref', size: 16, label: 'cycle: 3→0' });
  e.push({ time: t++, action: 'free', id: 'nodes' });
  e.push({ time: t++, action: 'end' });
  return e;
}

function buildContextManagerEvents(): MemoryEvent[] {
  const e: MemoryEvent[] = [];
  let t = 0;
  e.push({ time: t++, action: 'alloc', id: 'conn', size: 256, label: 'db_conn' });
  e.push({ time: t++, action: 'alloc', id: 'cursor', size: 64, label: 'cursor' });
  for (let i = 0; i < 3; i++) {
    e.push({ time: t++, action: 'alloc', id: `row_${i}`, size: 48, label: `row[${i}]` });
    e.push({ time: t++, action: 'free', id: `row_${i}` });
  }
  e.push({ time: t++, action: 'free', id: 'cursor' });
  e.push({ time: t++, action: 'free', id: 'conn' });
  e.push({ time: t++, action: 'end' });
  return e;
}

export const SAMPLE_PROGRAMS: SampleProgramMap = {
  Rust: {
    'Rust — Leaked Cache': {
      lang: 'Rust',
      description: 'Cache allocated in loop but never freed',
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
      events: buildLeakedCacheEvents(),
    },
    'Rust — Double Free': {
      lang: 'Rust',
      description: 'Unsafe code causes use-after-free',
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
        { time: 0, action: 'alloc', id: 'shared', size: 512, label: 'shared' },
        { time: 1, action: 'alloc', id: 'raw_a', size: 8, label: 'raw_ptr (A)' },
        { time: 2, action: 'alloc', id: 'raw_b', size: 8, label: 'raw_ptr (B)' },
        { time: 3, action: 'free', id: 'shared' },
        { time: 4, action: 'free', id: 'raw_a' },
        { time: 5, action: 'free', id: 'raw_b' },
        { time: 6, action: 'double_free', id: 'shared' },
        { time: 7, action: 'end' },
      ],
    },
    'Rust — Clean RAII': {
      lang: 'Rust',
      description: 'All resources properly scoped — no leaks',
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
      events: buildCleanRAIIEvents(),
    },
  },
  JavaScript: {
    'JS — Event Listener Leak': {
      lang: 'JavaScript',
      description: 'Event listeners keep references alive, preventing GC',
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
      events: buildEventListenerLeakEvents(),
    },
    'JS — Detached DOM Nodes': {
      lang: 'JavaScript',
      description: 'References to removed DOM nodes prevent GC',
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
      events: buildDetachedDOMEvents(),
    },
  },
  TypeScript: {
    'TS — Observable Leak': {
      lang: 'TypeScript',
      description: 'Subscriptions not unsubscribed leak in RxJS',
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
      events: buildObservableLeakEvents(),
    },
    'TS — Clean Reactive': {
      lang: 'TypeScript',
      description: 'All subscriptions managed with takeUntil',
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
      events: buildCleanReactiveEvents(),
    },
  },
  Go: {
    'Go — Goroutine Leak': {
      lang: 'Go',
      description: 'Goroutines blocked on channel — never return',
      code: `func processAll(items []Item) []Result {
    results := make(chan Result)       // 32B channel

    for i, item := range items[:5] {
        go func(id int, it Item) {     // 128B goroutine stack
            buf := make([]byte, 64)    // 64B temp buffer
            result := process(it, buf)
            results <- result          // blocks if nobody reads!
        }(i, item)
    }

    // Only read ONE result — rest blocked forever!
    first := <-results
    return []Result{first}
    // 4 goroutines leaked! ✗ LEAK
}`,
      events: buildGoroutineLeakEvents(),
    },
    'Go — Unbounded Slice': {
      lang: 'Go',
      description: 'Slice backing array never shrinks',
      code: `func collector() {
    data := make([]Metric, 0, 64)      // 64B initial

    for i := 0; i < 6; i++ {
        batch := fetchBatch(i)          // growing batches
        data = append(data, batch...)   // backing array grows

        // "Shrink" by reslicing — but cap never shrinks!
        if len(data) > 100 {
            data = data[len(data)-10:]  // keeps last 10
            // backing array still holds all memory ✗
        }
    }
    // Final len: 10, but cap: huge ✗ LEAK
}`,
      events: buildUnboundedSliceEvents(),
    },
  },
  Python: {
    'Python — Circular References': {
      lang: 'Python',
      description: 'Cycles with __del__ prevent garbage collection',
      code: `class Node:
    def __init__(self, val):
        self.val = val            # 128B per node
        self.next = None
    def __del__(self):
        print(f"Freeing {self.val}")  # prevent GC cycle collection

def build_cycle():
    nodes = []                     # 32B list
    for i in range(4):
        nodes.append(Node(i))      # 128B each
        if i > 0:
            nodes[i-1].next = nodes[i]

    nodes[-1].next = nodes[0]      # cycle! 3→0
    del nodes                      # list freed ✓
    # but cycle prevents GC! ✗ LEAK (due to __del__)`,
      events: buildCircularRefEvents(),
    },
    'Python — Context Manager OK': {
      lang: 'Python',
      description: 'Resources properly managed with context manager',
      code: `def query_database(sql: str):
    with connect("db.sqlite") as conn:  # 256B — auto-close ✓
        cursor = conn.cursor()          # 64B

        for i, row in enumerate(cursor.execute(sql)):
            data = process(row)         # 48B temp
            yield data                  # freed after yield ✓

        # cursor closed at end of block ✓
    # conn.__exit__ called ✓ — freed`,
      events: buildContextManagerEvents(),
    },
  },
};
