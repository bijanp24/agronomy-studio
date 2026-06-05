// ---------------------------------------------------------------------------
// AI Orchestration Layer for Spatial Learning Blocks
//
// ARCHITECTURE PRINCIPLE (non-negotiable):
//   The AI layer interprets user intent and explains deterministic results.
//   It does NOT compute field measurements, acreage, slope, application rates,
//   or any safety-critical value. All numbers come from deterministic services.
//
// Flow:
//   User asks question
//     → AI classifies intent → selects blockId + calculationPlan
//     → Deterministic spatial service computes result
//     → AI explains result in plain English
//     → App shows map layer, formula, simulation, recommendation
//
// See docs/learning-blocks.md and docs/ai-orchestration.md.
// ---------------------------------------------------------------------------

import type { BlockId } from './learning';

// ---------------------------------------------------------------------------
// Structured action schema — what the AI layer outputs
// ---------------------------------------------------------------------------

export type OrchestrationIntent =
  | 'explain_boundary_area'
  | 'explain_terrain_flow'
  | 'explain_waterlogging'
  | 'explain_runoff_risk'
  | 'explain_slope'
  | 'explain_carrying_capacity'
  | 'explain_predator_prey'
  | 'explain_logistic_growth'
  | 'compare_scenarios'
  | 'generate_quiz'
  | 'unknown';

export type ExplanationLevel = 'beginner' | 'intermediate' | 'advanced';

export type CalculationStep =
  | 'calculateArea'
  | 'calculatePerimeter'
  | 'calculateSlope'
  | 'estimateFlowDirection'
  | 'identifyPoolingZones'
  | 'identifyRunoffZones'
  | 'simulateLogisticGrowth'
  | 'simulateLotkaVolterra';

/** Structured output the AI orchestration layer produces. */
export interface OrchestrationAction {
  intent: OrchestrationIntent;
  blockId: BlockId | null;
  requiredLayers: string[];
  calculationPlan: CalculationStep[];
  explanationLevel: ExplanationLevel;
  /** Natural-language context the AI extracted from the user's question. */
  extractedContext: Record<string, string>;
}

/** Full result returned to the caller — action + the AI's explanation text. */
export interface OrchestrationResult {
  query: string;
  action: OrchestrationAction;
  explanation: string;
  disclaimer: string;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Intent classification — deterministic keyword rules (LLM stub below)
// ---------------------------------------------------------------------------

interface IntentRule {
  intent: OrchestrationIntent;
  blockId: BlockId | null;
  keywords: string[];
  calculationPlan: CalculationStep[];
  requiredLayers: string[];
}

const INTENT_RULES: IntentRule[] = [
  {
    intent: 'explain_waterlogging',
    blockId: 'terrain-flow',
    keywords: ['waterlog', 'waterlogged', 'wet corner', 'standing water', 'pooling', 'pool', 'drainage problem'],
    calculationPlan: ['calculateSlope', 'estimateFlowDirection', 'identifyPoolingZones'],
    requiredLayers: ['field-boundary', 'terrain', 'soil', 'weather'],
  },
  {
    intent: 'explain_runoff_risk',
    blockId: 'terrain-flow',
    keywords: ['runoff', 'erosion', 'topsoil loss', 'steep', 'slope problem', 'wash away'],
    calculationPlan: ['calculateSlope', 'estimateFlowDirection', 'identifyRunoffZones'],
    requiredLayers: ['field-boundary', 'terrain'],
  },
  {
    intent: 'explain_slope',
    blockId: 'terrain-flow',
    keywords: ['slope', 'gradient', 'elevation', 'elevation change', 'hillside', 'grade'],
    calculationPlan: ['calculateSlope', 'estimateFlowDirection'],
    requiredLayers: ['field-boundary', 'terrain'],
  },
  {
    intent: 'explain_terrain_flow',
    blockId: 'terrain-flow',
    keywords: ['terrain', 'flow', 'water movement', 'drainage', 'downhill'],
    calculationPlan: ['calculateSlope', 'estimateFlowDirection', 'identifyPoolingZones', 'identifyRunoffZones'],
    requiredLayers: ['field-boundary', 'terrain'],
  },
  {
    intent: 'explain_boundary_area',
    blockId: 'boundary-area',
    keywords: ['area', 'acreage', 'acres', 'hectares', 'size', 'perimeter', 'boundary', 'how big', 'field size'],
    calculationPlan: ['calculateArea', 'calculatePerimeter'],
    requiredLayers: ['field-boundary'],
  },
  {
    intent: 'explain_logistic_growth',
    blockId: 'carrying-capacity',
    keywords: ['logistic', 'logistic growth', 's-curve', 'population growth', 'growth rate'],
    calculationPlan: ['simulateLogisticGrowth'],
    requiredLayers: ['crop'],
  },
  {
    intent: 'explain_predator_prey',
    blockId: 'carrying-capacity',
    keywords: ['predator', 'prey', 'lotka', 'volterra', 'pest', 'beneficial insect', 'oscillat'],
    calculationPlan: ['simulateLotkaVolterra'],
    requiredLayers: ['crop'],
  },
  {
    intent: 'explain_carrying_capacity',
    blockId: 'carrying-capacity',
    keywords: ['carrying capacity', 'sustainable', 'maximum population', 'resource limit', 'stocking rate'],
    calculationPlan: ['simulateLogisticGrowth'],
    requiredLayers: ['crop'],
  },
];

export function classifyOrchestrationIntent(query: string): IntentRule {
  const q = ` ${query.toLowerCase()} `;
  for (const rule of INTENT_RULES) {
    if (rule.keywords.some((kw) => q.includes(kw))) return rule;
  }
  return {
    intent: 'unknown',
    blockId: null,
    keywords: [],
    calculationPlan: [],
    requiredLayers: [],
  };
}

function inferExplanationLevel(query: string): ExplanationLevel {
  const q = query.toLowerCase();
  if (q.includes('formula') || q.includes('equation') || q.includes('calcul') || q.includes('math')) return 'intermediate';
  if (q.includes('algorithm') || q.includes('derivation') || q.includes('model')) return 'advanced';
  return 'beginner';
}

// ---------------------------------------------------------------------------
// LLM stub — real OpenAI/Gemini calls drop in here later.
// Must NEVER compute field measurements or return fabricated numbers.
// ---------------------------------------------------------------------------

async function callLlmStub(_query: string, _action: OrchestrationAction): Promise<string | null> {
  // Future: pass action + deterministic result to LLM for a plain-English explanation.
  return null;
}

// ---------------------------------------------------------------------------
// Explanation templates (used when LLM stub returns null)
// ---------------------------------------------------------------------------

const EXPLANATION_TEMPLATES: Record<OrchestrationIntent, string> = {
  explain_waterlogging:
    'Water collects in low-lying areas where all neighbouring terrain is higher — these are pooling zones. ' +
    'The terrain flow block calculates slope and flow direction to identify them. ' +
    'The deterministic calculation (not AI) locates these zones precisely; I can explain what the numbers mean.',
  explain_runoff_risk:
    'Runoff risk increases where slope exceeds a threshold (typically 3%). ' +
    'Steep areas lose water quickly, reducing infiltration and increasing erosion risk. ' +
    'The spatial engine measures actual slope from the elevation grid.',
  explain_slope:
    'Slope is calculated as the elevation change divided by the horizontal distance, expressed as a percentage. ' +
    'A 1% slope means 1 metre of vertical drop per 100 metres of horizontal distance. ' +
    'The spatial engine computes this deterministically from your elevation data.',
  explain_terrain_flow:
    'Water flows from high to low elevation along the path of steepest descent. ' +
    'The D8 algorithm identifies flow direction by finding the lowest of 8 neighbours at each grid cell. ' +
    'Pooling zones occur at local minima; runoff zones occur where slope exceeds the threshold.',
  explain_boundary_area:
    'Field area is calculated using the shoelace formula applied to projected coordinates. ' +
    'Perimeter is the sum of haversine distances between consecutive boundary vertices. ' +
    'All acreage and perimeter values are computed deterministically — not estimated by AI.',
  explain_logistic_growth:
    'Logistic growth starts fast when the population is small and resources are plentiful, ' +
    'then slows as N approaches K (carrying capacity). The growth rate dN/dt = rN(1-N/K) ' +
    'equals zero when N = K.',
  explain_predator_prey:
    'Predator and prey populations cycle: more prey → more predators → fewer prey → fewer predators. ' +
    'The Lotka-Volterra equations capture this oscillation. With the right parameters, populations ' +
    'can reach a stable cycle rather than crashing.',
  explain_carrying_capacity:
    'Carrying capacity K is the maximum sustainable population given available resources. ' +
    'Exceeding K consistently leads to resource depletion and population decline. ' +
    'Use logistic growth simulations to find sustainable stocking or planting densities.',
  compare_scenarios:
    'To compare scenarios, run the deterministic calculation for each set of inputs and compare ' +
    'the computed values. The AI layer can explain the differences once the numbers are available.',
  generate_quiz:
    'Quiz questions for this block are included in the learning content schema. ' +
    'Select a block and use the Practice Question section to test your understanding.',
  unknown:
    'I could not determine a specific learning block for that question. ' +
    'Try asking about field area, slope, terrain drainage, or population dynamics.',
};

// ---------------------------------------------------------------------------
// Main orchestration entry point
// ---------------------------------------------------------------------------

export interface AiOrchestrationOptions {
  explanationLevel?: ExplanationLevel;
}

/** Classify a user question, build an action plan, and return an explanation. */
export async function orchestrate(
  query: string,
  options: AiOrchestrationOptions = {},
): Promise<OrchestrationResult> {
  const rule = classifyOrchestrationIntent(query);
  const level = options.explanationLevel ?? inferExplanationLevel(query);

  const action: OrchestrationAction = {
    intent: rule.intent,
    blockId: rule.blockId,
    requiredLayers: rule.requiredLayers,
    calculationPlan: rule.calculationPlan,
    explanationLevel: level,
    extractedContext: {},
  };

  const llmExplanation = await callLlmStub(query, action);
  const explanation =
    llmExplanation ?? EXPLANATION_TEMPLATES[rule.intent] ?? EXPLANATION_TEMPLATES.unknown;

  return {
    query,
    action,
    explanation,
    disclaimer:
      'This explanation comes from the AI layer. ' +
      'All numeric values (area, slope, population) are computed by deterministic services and are not estimated by AI.',
    confidence: rule.intent === 'unknown' ? 0.2 : 0.75,
  };
}

// ---------------------------------------------------------------------------
// Example flow: "Why is this lower corner getting waterlogged?"
// ---------------------------------------------------------------------------
//
// 1. User asks: "Why is this lower corner getting waterlogged?"
//
// 2. classifyOrchestrationIntent() matches keyword "waterlogged" → intent = "explain_waterlogging"
//
// 3. OrchestrationAction produced:
//    {
//      "intent": "explain_waterlogging",
//      "blockId": "terrain-flow",
//      "requiredLayers": ["field-boundary", "terrain", "soil", "weather"],
//      "calculationPlan": ["calculateSlope", "estimateFlowDirection", "identifyPoolingZones"],
//      "explanationLevel": "beginner"
//    }
//
// 4. App routes to the terrain-flow block, calls spatial.ts::calculateTerrainFlow()
//    with the field's elevation grid (deterministic, tested math owns the numbers).
//
// 5. calculateTerrainFlow() returns pooling zones, slope values, flow directions.
//
// 6. The AI layer (or template) explains: "Water collects here because all surrounding
//    terrain is higher. The spatial engine identified N pooling zone(s) based on your
//    elevation data. This is a structural drainage issue — consider a French drain or
//    raised bed in this zone."
//
// 7. App renders map layer (pooling zones highlighted), formula view, and recommendation.
