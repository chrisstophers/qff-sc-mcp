import { describe, it, expect, beforeAll } from 'vitest';

// ─── Test helpers ──────────────────────────────────────────────────────────────

let handler: (req: Request) => Promise<Response>;

beforeAll(async () => {
  // Dynamic import so vitest picks up the module after globals are ready.
  // The handler uses Web API globals (Request, Response) — available in Node 20+.
  const mod = await import('../api/mcp.js');
  handler = mod.default as (req: Request) => Promise<Response>;
});

function post(body: unknown): Request {
  return new Request('http://localhost/api/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function call(body: unknown): Promise<{ status: number; data: unknown }> {
  const res = await handler(post(body));
  const data = await res.json();
  return { status: res.status, data };
}

// ─── CORS ─────────────────────────────────────────────────────────────────────

describe('CORS', () => {
  it('OPTIONS preflight returns 204 with CORS headers', async () => {
    const req = new Request('http://localhost/api/mcp', { method: 'OPTIONS' });
    const res = await handler(req);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('POST responses include CORS headers', async () => {
    const res = await handler(
      post({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    );
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('X-Powered-By')).toContain('qff-sc-mcp');
  });

  it('non-POST returns 405', async () => {
    const req = new Request('http://localhost/api/mcp', { method: 'GET' });
    const res = await handler(req);
    expect(res.status).toBe(405);
  });
});

// ─── JSON-RPC validation ───────────────────────────────────────────────────────

describe('JSON-RPC validation', () => {
  it('invalid JSON returns parse error (-32700)', async () => {
    const req = new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{{{',
    });
    const res = await handler(req);
    const data = await res.json() as { error: { code: number } };
    expect(data.error.code).toBe(-32700);
  });

  it('wrong jsonrpc version returns -32600', async () => {
    const { data } = await call({ jsonrpc: '1.0', id: 1, method: 'tools/list' });
    const d = data as { error: { code: number } };
    expect(d.error.code).toBe(-32600);
  });

  it('unknown method returns -32601', async () => {
    const { data } = await call({ jsonrpc: '2.0', id: 1, method: 'not/a/method' });
    const d = data as { error: { code: number; message: string } };
    expect(d.error.code).toBe(-32601);
    expect(d.error.message).toContain('not/a/method');
  });
});

// ─── initialize ───────────────────────────────────────────────────────────────

describe('initialize', () => {
  it('returns protocol version and server info', async () => {
    const { data } = await call({ jsonrpc: '2.0', id: 1, method: 'initialize' });
    const d = data as { result: { protocolVersion: string; serverInfo: { name: string } } };
    expect(d.result.protocolVersion).toBe('2024-11-05');
    expect(d.result.serverInfo.name).toBe('qff-sc-mcp');
    expect(d.result.capabilities).toEqual({ tools: {} });
  });

  it('echoes back the request id', async () => {
    const { data } = await call({ jsonrpc: '2.0', id: 42, method: 'initialize' });
    expect((data as { id: number }).id).toBe(42);
  });
});

// ─── notifications/initialized ────────────────────────────────────────────────

describe('notifications/initialized', () => {
  it('returns 202 with no body', async () => {
    const res = await handler(
      post({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    );
    expect(res.status).toBe(202);
  });
});

// ─── tools/list ───────────────────────────────────────────────────────────────

describe('tools/list', () => {
  it('returns exactly 4 tools', async () => {
    const { data } = await call({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const tools = (data as { result: { tools: { name: string }[] } }).result.tools;
    expect(tools).toHaveLength(4);
  });

  it('includes all expected tool names', async () => {
    const { data } = await call({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const names = (data as { result: { tools: { name: string }[] } }).result.tools.map(t => t.name);
    expect(names).toContain('calculate_status_credits');
    expect(names).toContain('lookup_region');
    expect(names).toContain('optimise_routing');
    expect(names).toContain('compare_routings');
  });

  it('each tool has a name, description, and inputSchema', async () => {
    const { data } = await call({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const tools = (data as { result: { tools: { name: string; description: string; inputSchema: unknown }[] } }).result.tools;
    for (const tool of tools) {
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
      expect(tool.inputSchema).toBeDefined();
    }
  });

  it('result is identical over HTTP vs from TOOLS constant', async () => {
    const { TOOLS } = await import('../src/tool-handlers.js');
    const { data } = await call({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const httpTools = (data as { result: { tools: unknown[] } }).result.tools;
    expect(httpTools).toEqual(TOOLS);
  });
});

// ─── tools/call — calculate_status_credits ────────────────────────────────────

describe('tools/call calculate_status_credits', () => {
  it('LAX→DFW→LGA→YYZ business = 220 SCs', async () => {
    const { data } = await call({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'calculate_status_credits',
        arguments: {
          routing: ['LAX', 'DFW', 'LGA', 'YYZ'],
          cabin_class: 'business',
          airline: 'AA',
        },
      },
    });
    const d = data as { result: { content: { text: string }[]; isError?: boolean } };
    expect(d.result.isError).toBeFalsy();
    const result = JSON.parse(d.result.content[0].text) as { total_status_credits: number };
    expect(result.total_status_credits).toBe(220);
  });

  it('SYD→LAX business = 180 SCs', async () => {
    const { data } = await call({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'calculate_status_credits',
        arguments: { routing: ['SYD', 'LAX'], cabin_class: 'business', airline: 'AA' },
      },
    });
    const result = JSON.parse(
      (data as { result: { content: { text: string }[] } }).result.content[0].text,
    ) as { total_status_credits: number };
    expect(result.total_status_credits).toBe(180);
  });

  it('unknown airport returns isError: true', async () => {
    const { data } = await call({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'calculate_status_credits',
        arguments: { routing: ['XYZ', 'LAX'], cabin_class: 'business', airline: 'AA' },
      },
    });
    const d = data as { result: { isError: boolean } };
    expect(d.result.isError).toBe(true);
  });
});

// ─── tools/call — lookup_region ───────────────────────────────────────────────

describe('tools/call lookup_region', () => {
  it('DFW → dallas', async () => {
    const { data } = await call({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'lookup_region', arguments: { airport: 'DFW' } },
    });
    const text = (data as { result: { content: { text: string }[] } }).result.content[0].text;
    expect(text.toLowerCase()).toContain('dallas');
  });
});

// ─── tools/call — optimise_routing ────────────────────────────────────────────

describe('tools/call optimise_routing', () => {
  it('SYD→JFK returns options sorted by SCs descending', async () => {
    const { data } = await call({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'optimise_routing',
        arguments: {
          origin: 'SYD',
          destination: 'JFK',
          cabin_class: 'business',
          airline: 'AA',
          max_stops: 2,
          top_n: 5,
        },
      },
    });
    const result = JSON.parse(
      (data as { result: { content: { text: string }[] } }).result.content[0].text,
    ) as { options: { total_status_credits: number }[] };

    expect(result.options.length).toBeGreaterThan(0);
    for (let i = 0; i < result.options.length - 1; i++) {
      expect(result.options[i].total_status_credits).toBeGreaterThanOrEqual(
        result.options[i + 1].total_status_credits,
      );
    }
  });
});

// ─── tools/call — compare_routings ────────────────────────────────────────────

describe('tools/call compare_routings', () => {
  it('SYD-LAX-JFK vs SYD-DFW-JFK — same SCs, positive or zero difference', async () => {
    const { data } = await call({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'compare_routings',
        arguments: {
          routing_a: ['SYD', 'LAX', 'JFK'],
          routing_b: ['SYD', 'DFW', 'JFK'],
          cabin_class: 'business',
          airline: 'AA',
        },
      },
    });
    const result = JSON.parse(
      (data as { result: { content: { text: string }[] } }).result.content[0].text,
    ) as { routing_a: { total_status_credits: number }; routing_b: { total_status_credits: number } };
    // Both are 280 SCs (180+100 vs 200+80)
    expect(result.routing_a.total_status_credits).toBe(280);
    expect(result.routing_b.total_status_credits).toBe(280);
  });
});

// ─── tools/call — error cases ─────────────────────────────────────────────────

describe('tools/call error handling', () => {
  it('unknown tool name returns isError: true', async () => {
    const { data } = await call({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'not_a_real_tool', arguments: {} },
    });
    const d = data as { result: { isError: boolean } };
    expect(d.result.isError).toBe(true);
  });

  it('HTTP response is always 200 even when tool errors (JSON-RPC convention)', async () => {
    const { status } = await call({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'not_a_real_tool', arguments: {} },
    });
    expect(status).toBe(200);
  });
});
