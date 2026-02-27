export type MemoryAction = 'alloc' | 'free' | 'double_free' | 'end';

export type BlockStatus = 'active' | 'freed' | 'leaked' | 'double_free';

export type Language = 'Rust' | 'JavaScript' | 'TypeScript' | 'Go' | 'Python';

export interface MemoryEvent {
  time: number;
  action: MemoryAction;
  id?: string;
  size?: number;
  label?: string;
}

export interface MemoryBlock {
  id: string;
  label: string;
  size: number;
  status: BlockStatus;
}

export interface SampleProgram {
  lang: string;
  description: string;
  code: string;
  events: MemoryEvent[];
}

export interface HeapSnapshot {
  total: number;
  leaked: number;
}

export interface MemoryStats {
  currentHeap: number;
  peakMem: number;
  leakedBytes: number;
  leakedCount: number;
  freedCount: number;
  activeCount: number;
  doubleFreeCount: number;
  totalOps: number;
}

export interface Verdict {
  text: string;
  color: string;
  icon: string;
}

export interface AnalysisResult {
  blocks: MemoryBlock[];
  snapshots: HeapSnapshot[];
  stats: MemoryStats;
}

export type SampleProgramMap = Record<string, Record<string, SampleProgram>>;

// Sandbox types

export type SandboxLanguage = 'JavaScript' | 'Python';

export type AppMode = 'samples' | 'sandbox';

export type SandboxStatus = 'idle' | 'running' | 'loading-pyodide' | 'success' | 'error' | 'timeout';

export interface SandboxState {
  status: SandboxStatus;
  events: MemoryEvent[];
  stdout: string;
  stderr: string;
  error: string | null;
}

export interface WorkerRunMessage {
  type: 'run';
  language: SandboxLanguage;
  code: string;
}

export interface WorkerResultMessage {
  type: 'result';
  events: MemoryEvent[];
  stdout: string;
  stderr: string;
}

export interface WorkerErrorMessage {
  type: 'error';
  error: string;
  stdout: string;
  stderr: string;
}

export interface WorkerStatusMessage {
  type: 'status';
  status: 'loading-pyodide';
}

export type WorkerOutMessage = WorkerResultMessage | WorkerErrorMessage | WorkerStatusMessage;
