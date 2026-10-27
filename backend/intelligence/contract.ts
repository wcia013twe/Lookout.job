import {GRAPH_TOOL_DESCRIPTOR} from './evidence-graph.ts';
import {METADATA_TOOL,metadataTool,validateMetadataArgs} from './metadata.ts';
// One operation contract shared by MCP discovery and the HTTP-backed service.
export const INGEST_TOOL = 'ingest_demo_intelligence';
export const SEARCH_TOOL = 'search_demo_intelligence';
export const MIN_SEARCH_SIMILARITY = 0.3;
export const LIST_TOOL = 'list_demo_intelligence_reports';
export const DEMO_TOOLS = [
  {
    name: INGEST_TOOL,
    description: 'Run the configured local evaluation source: fixed fixtures or a server-selected local test account. Cleaned account records remain private with pending embeddings unless a real provider is configured. Counts describe saves, not publication approval.',
    inputSchema: {type: 'object', properties: {}, additionalProperties: false},
  },
  {
    name: LIST_TOOL,
    description: 'Inspect the configured local evaluation store: cleaned reports, references and embedding state. Account results are rechecked against current permitted source content before listing. Owner selection is server-controlled. Never returns raw source text or embedding values.',
    inputSchema: {
      type: 'object',
      properties: {limit: {type: 'integer', minimum: 1, maximum: 50}},
      additionalProperties: false,
    },
  },
  {
    name: SEARCH_TOOL,
    description: 'Search current permitted local intelligence using vector search (default) or hybrid keyword/vector rank fusion. Returns source references and cosine similarity (not confidence). No global access or generated answers.',
    inputSchema: {type:'object', properties:{mode:{type:'string',enum:['vector','hybrid']},query:{type:'string',minLength:1,maxLength:1000},limit:{type:'integer',minimum:1,maximum:20}},required:['query'],additionalProperties:false},
  },
  metadataTool,
  GRAPH_TOOL_DESCRIPTOR,
] as const;

export function validateDemoCall(operation: unknown, args: unknown = {}) {
  if(operation===METADATA_TOOL)return {operation,metadata:validateMetadataArgs(args),mode:'vector' as const,query:undefined,limit:undefined};
  if (operation !== INGEST_TOOL && operation !== LIST_TOOL && operation !== SEARCH_TOOL) throw Error('UNKNOWN_OPERATION');
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw Error('INVALID_ARGUMENT');
  const properties = DEMO_TOOLS.find(tool => tool.name === operation)!.inputSchema.properties;
  if (Object.keys(args).some(key => !Object.hasOwn(properties, key))) throw Error('UNKNOWN_ARGUMENT');
  const limit = 'limit' in args ? args.limit : undefined;
  const bounds = operation===SEARCH_TOOL ? DEMO_TOOLS[2].inputSchema.properties.limit : DEMO_TOOLS[1].inputSchema.properties.limit;
  if ('limit' in args && (typeof limit !== 'number' || !Number.isInteger(limit) || limit < bounds.minimum || limit > bounds.maximum)) {
    throw Error('INVALID_LIMIT');
  }
  const query = 'query' in args ? args.query : undefined;
  if(operation===SEARCH_TOOL&&(typeof query!=='string'||!query.trim()||query.length>1000))throw Error('INVALID_QUERY');
  const mode='mode' in args?args.mode:'vector';
  if(mode!=='vector'&&mode!=='hybrid')throw Error('INVALID_SEARCH_MODE');
  return {operation, metadata:undefined, mode:mode as 'vector'|'hybrid', limit: limit as number | undefined, query: typeof query==='string'?query.trim():undefined};
}

export type DemoCall = (operation: unknown, args?: unknown) => Promise<Record<string, unknown>>;
