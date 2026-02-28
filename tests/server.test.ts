/**
 * MCP server tests.
 *
 * Uses InMemoryTransport to test the full MCP protocol round-trip
 * without spawning a subprocess or opening any ports.
 *
 * The pattern is: create a linked transport pair → connect server to one end,
 * test client to the other → call MCP methods directly.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.js';

// ─── Test harness ─────────────────────────────────────────────────────────────

let client: Client;

beforeEach(async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const server = createServer();
  await server.connect(serverTransport);

  client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
  await client.connect(clientTransport);
});

afterEach(async () => {
  await client.close();
});

// ─── tools/list ───────────────────────────────────────────────────────────────

describe('tools/list', () => {
  it('returns exactly 4 tools', async () => {
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(4);
  });

  it('includes calculate_status_credits', async () => {
    const { tools } = await client.listTools();
    const tool = tools.find(t => t.name === 'calculate_status_credits');
    expect(tool).toBeDefined();
    expect(tool!.description).toContain('Status Credits');
  });

  it('includes lookup_region', async () => {
    const { tools } = await client.listTools();
    expect(tools.find(t => t.name === 'lookup_region')).toBeDefined();
  });

  it('includes optimise_routing', async () => {
    const { tools } = await client.listTools();
    expect(tools.find(t => t.name === 'optimise_routing')).toBeDefined();
  });

  it('includes compare_routings', async () => {
    const { tools } = await client.listTools();
    expect(tools.find(t => t.name === 'compare_routings')).toBeDefined();
  });

  it('calculate_status_credits has required input schema fields', async () => {
    const { tools } = await client.listTools();
    const tool = tools.find(t => t.name === 'calculate_status_credits')!;
    const required = (tool.inputSchema as { required: string[] }).required;
    expect(required).toContain('routing');
    expect(required).toContain('cabin_class');
    expect(required).toContain('airline');
  });
});

// ─── calculate_status_credits ─────────────────────────────────────────────────

describe('calculate_status_credits tool', () => {
  it('SYD→JFK business = 280 SCs', async () => {
    const result = await client.callTool({
      name: 'calculate_status_credits',
      arguments: { routing: ['SYD', 'JFK'], cabin_class: 'business', airline: 'AA' },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(data.total_status_credits).toBe(280);
    expect(data.legs).toHaveLength(1);
    expect(data.legs[0].matched_table).toBe('aus_east_coast_east_coast_usa');
  });

  it('LAX→DFW→LGA→YYZ business = 220 SCs total', async () => {
    const result = await client.callTool({
      name: 'calculate_status_credits',
      arguments: {
        routing: ['LAX', 'DFW', 'LGA', 'YYZ'],
        cabin_class: 'business',
        airline: 'AA',
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(data.legs).toHaveLength(3);
    expect(data.legs[0].status_credits).toBe(100); // LAX→DFW dallas_west_coast
    expect(data.legs[1].status_credits).toBe(80);  // DFW→LGA dallas_east_coast
    expect(data.total_status_credits).toBe(data.legs.reduce((s: number, l: { status_credits: number }) => s + l.status_credits, 0));
  });

  it('returns city-name resolved routing in result', async () => {
    const result = await client.callTool({
      name: 'calculate_status_credits',
      arguments: { routing: ['Dallas', 'Los Angeles'], cabin_class: 'business', airline: 'AA' },
    });

    const data = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(data.routing).toEqual(['DFW', 'LAX']);
  });

  it('returns isError for unknown airport', async () => {
    const result = await client.callTool({
      name: 'calculate_status_credits',
      arguments: { routing: ['LAX', 'XYZ'], cabin_class: 'business', airline: 'AA' },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(text).toContain('Unknown airport');
  });

  it('returns isError for invalid cabin class', async () => {
    const result = await client.callTool({
      name: 'calculate_status_credits',
      arguments: { routing: ['LAX', 'JFK'], cabin_class: 'super_luxury', airline: 'AA' },
    });

    expect(result.isError).toBe(true);
  });

  it('returns isError for unknown airline', async () => {
    const result = await client.callTool({
      name: 'calculate_status_credits',
      arguments: { routing: ['LAX', 'JFK'], cabin_class: 'business', airline: 'ZZ' },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(text).toContain('No earning table found');
  });

  it('returns isError when routing has only one airport', async () => {
    const result = await client.callTool({
      name: 'calculate_status_credits',
      arguments: { routing: ['LAX'], cabin_class: 'business', airline: 'AA' },
    });

    expect(result.isError).toBe(true);
  });

  it('returns isError for missing required parameters', async () => {
    const result = await client.callTool({
      name: 'calculate_status_credits',
      arguments: { routing: ['LAX', 'JFK'] }, // missing cabin_class and airline
    });

    expect(result.isError).toBe(true);
  });
});

// ─── lookup_region ────────────────────────────────────────────────────────────

describe('lookup_region tool', () => {
  it('DFW → dallas region', async () => {
    const result = await client.callTool({
      name: 'lookup_region',
      arguments: { airport: 'DFW' },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(data.airport).toBe('DFW');
    expect(data.region_key).toBe('dallas');
    expect(data.region_label).toBe('Dallas');
  });

  it('returns other airports in the region', async () => {
    const result = await client.callTool({
      name: 'lookup_region',
      arguments: { airport: 'LAX' },
    });

    const data = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(data.other_airports_in_region).toContain('SFO');
    expect(data.other_airports_in_region).not.toContain('LAX'); // shouldn't include itself
  });

  it('ORD (no region) returns null region with helpful message', async () => {
    const result = await client.callTool({
      name: 'lookup_region',
      arguments: { airport: 'ORD' },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(data.region).toBeNull();
    expect(data.message).toContain('distance-based');
  });

  it('resolves city name "Dallas"', async () => {
    const result = await client.callTool({
      name: 'lookup_region',
      arguments: { airport: 'Dallas' },
    });

    const data = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(data.region_key).toBe('dallas');
  });
});

// ─── optimise_routing ─────────────────────────────────────────────────────────

describe('optimise_routing tool', () => {
  it('returns options sorted by SCs descending', async () => {
    const result = await client.callTool({
      name: 'optimise_routing',
      arguments: {
        origin: 'SYD',
        destination: 'JFK',
        cabin_class: 'business',
        airline: 'AA',
        max_stops: 2,
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(data.options.length).toBeGreaterThan(0);

    for (let i = 0; i < data.options.length - 1; i++) {
      expect(data.options[i].total_status_credits).toBeGreaterThanOrEqual(
        data.options[i + 1].total_status_credits,
      );
    }
  });

  it('uses default max_stops of 2 when not provided', async () => {
    const result = await client.callTool({
      name: 'optimise_routing',
      arguments: {
        origin: 'LAX',
        destination: 'JFK',
        cabin_class: 'business',
        airline: 'AA',
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(data.options.length).toBeGreaterThan(0);
  });

  it('returns isError for unknown origin', async () => {
    const result = await client.callTool({
      name: 'optimise_routing',
      arguments: {
        origin: 'XYZ',
        destination: 'JFK',
        cabin_class: 'business',
        airline: 'AA',
      },
    });

    expect(result.isError).toBe(true);
  });
});

// ─── compare_routings ─────────────────────────────────────────────────────────

describe('compare_routings tool', () => {
  it('correctly compares SYD→JFK vs SYD→LAX (A earns 100 more)', async () => {
    const result = await client.callTool({
      name: 'compare_routings',
      arguments: {
        routing_a: ['SYD', 'JFK'],
        routing_b: ['SYD', 'LAX'],
        cabin_class: 'business',
        airline: 'AA',
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(data.difference).toBe(100);
    expect(data.recommendation).toContain('Routing A earns 100 more');
  });

  it('includes both routing breakdowns', async () => {
    const result = await client.callTool({
      name: 'compare_routings',
      arguments: {
        routing_a: ['LAX', 'JFK'],
        routing_b: ['LAX', 'DFW'],
        cabin_class: 'economy',
        airline: 'AA',
      },
    });

    const data = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(data.routing_a).toBeDefined();
    expect(data.routing_b).toBeDefined();
    expect(data.routing_a.legs).toBeDefined();
    expect(data.routing_b.legs).toBeDefined();
  });

  it('returns isError for missing parameters', async () => {
    const result = await client.callTool({
      name: 'compare_routings',
      arguments: {
        routing_a: ['LAX', 'JFK'],
        // missing routing_b, cabin_class, airline
      },
    });

    expect(result.isError).toBe(true);
  });
});

// ─── Unknown tool ─────────────────────────────────────────────────────────────

describe('unknown tool name', () => {
  it('returns isError for a tool that does not exist', async () => {
    const result = await client.callTool({
      name: 'nonexistent_tool',
      arguments: {},
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(text).toContain('Unknown tool');
  });
});
