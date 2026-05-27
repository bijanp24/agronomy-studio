export type LlmProvider = 'mock' | 'openai' | 'gemini';

export interface QueryRequest {
  question: string;
  provider: LlmProvider;
}

export interface QueryColumn {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
}

export interface QueryResultRow {
  [key: string]: unknown;
}

export interface QueryResponse {
  question: string;
  sql: string;
  summary: string;
  columns: QueryColumn[];
  rows: QueryResultRow[];
  rowCount: number;
  executionMs: number;
  cached: boolean;
}

export interface QueryHistoryEntry {
  question: string;
  timestamp: string;
  rowCount: number;
}

export interface CacheStatus {
  tables: CacheTableStatus[];
  lastFullSync: string;
  healthy: boolean;
}

export interface CacheTableStatus {
  table: string;
  rowCount: number;
  lastSync: string;
  stale: boolean;
}
