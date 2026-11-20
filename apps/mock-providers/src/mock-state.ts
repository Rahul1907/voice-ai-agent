export interface RecordedRequest {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  headers: Record<string, unknown>;
  body?: unknown;
  query?: unknown;
}

export interface FailureRule {
  endpoint: string;
  status: number;
  times: number;
}

export class MockState {
  private requests: RecordedRequest[] = [];
  private failureRules: FailureRule[] = [];
  private sttQueue: string[] = [];
  private llmQueue: string[] = [];

  recordRequest(req: {
    method: string;
    url: string;
    headers: Record<string, unknown>;
    body?: unknown;
    query?: unknown;
  }): RecordedRequest {
    const recorded: RecordedRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      query: req.query,
    };
    this.requests.push(recorded);
    return recorded;
  }

  getRequests(endpoint?: string): RecordedRequest[] {
    if (!endpoint) return [...this.requests];
    return this.requests.filter((r) => r.url.includes(endpoint));
  }

  injectFailure(endpoint: string, status: number, times: number): void {
    // Remove existing rule for same endpoint if any
    this.failureRules = this.failureRules.filter((r) => r.endpoint !== endpoint);
    if (times > 0) {
      this.failureRules.push({ endpoint, status, times });
    }
  }

  checkFailure(url: string): number | null {
    for (let i = 0; i < this.failureRules.length; i++) {
      const rule = this.failureRules[i];
      if (!rule) continue;
      if (url.includes(rule.endpoint) && rule.times > 0) {
        rule.times -= 1;
        const status = rule.status;
        if (rule.times <= 0) {
          this.failureRules.splice(i, 1);
        }
        return status;
      }
    }
    return null;
  }

  enqueueSTT(texts: string[]): void {
    this.sttQueue.push(...texts);
  }

  dequeueSTT(): string {
    if (this.sttQueue.length > 0) {
      return this.sttQueue.shift()!;
    }
    return 'Hello, can you hear me?';
  }

  enqueueLLM(replies: string[]): void {
    this.llmQueue.push(...replies);
  }

  dequeueLLM(): string | null {
    if (this.llmQueue.length > 0) {
      return this.llmQueue.shift()!;
    }
    return null;
  }

  reset(): void {
    this.requests = [];
    this.failureRules = [];
    this.sttQueue = [];
    this.llmQueue = [];
  }
}

export const mockState = new MockState();
