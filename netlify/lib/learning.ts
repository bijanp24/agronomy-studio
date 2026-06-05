// ---------------------------------------------------------------------------
// Spatial learning-block domain types — provider-neutral, vendor-agnostic.
// See docs/learning-blocks.md for the full architecture note.
// ---------------------------------------------------------------------------

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export interface LearningBlockInput {
  name: string;
  description: string;
  unit: string;
  required?: boolean;
}

export interface LearningBlockOutput {
  name: string;
  description: string;
  unit: string;
}

export interface RecommendationRule {
  condition: string;
  recommendation: string;
}

export interface LearningBlock {
  id: string;
  title: string;
  concept: string;
  formula?: string;
  inputs: LearningBlockInput[];
  outputs: LearningBlockOutput[];
  mapLayers: string[];
  simulationSteps?: string[];
  recommendationRules?: RecommendationRule[];
  difficultyLevel: DifficultyLevel;
  tags?: string[];
}

// ---------------------------------------------------------------------------
// FieldLayer — provider-neutral map/field layer model.
// External providers (Google Maps, ESRI, USDA, local GeoJSON) are adapted
// into this model via thin adapter functions. No vendor name appears here.
// ---------------------------------------------------------------------------

export type FieldLayerType =
  | 'boundary'
  | 'terrain'
  | 'soil'
  | 'weather'
  | 'crop'
  | 'operations'
  | 'yield'
  | 'custom';

export interface FieldLayerGeometry {
  type: string;
  coordinates: unknown;
}

export interface FieldLayer {
  id: string;
  name: string;
  type: FieldLayerType;
  geometry?: FieldLayerGeometry;
  attributes: Record<string, unknown>;
  /** Human-readable provider name, e.g. "local-demo", "NRCS SSURGO". */
  source?: string;
  /** ISO 8601 timestamp when the layer data was captured or generated. */
  timestamp?: string;
}

// ---------------------------------------------------------------------------
// LearningModeContent — rich educational content attached to a block.
// ---------------------------------------------------------------------------

export interface QuizQuestion {
  question: string;
  answer: string;
  choices?: string[];
}

export interface LearningModeContent {
  blockId: string;
  beginnerExplanation: string;
  /** Markdown with formula notation. */
  formulaView: string;
  /** Short description of what the map layer shows. */
  mapView?: string;
  simulationView?: string;
  quizQuestions?: QuizQuestion[];
  recommendationExplanation?: string;
}

// ---------------------------------------------------------------------------
// LearningBlockResult — computed output returned by a spatial calculation.
// ---------------------------------------------------------------------------

export interface LearningBlockResult {
  blockId: string;
  computed: Record<string, number>;
  outputLayers: FieldLayer[];
  explanation?: string;
  warning?: string;
}

// ---------------------------------------------------------------------------
// Block registry helpers
// ---------------------------------------------------------------------------

/** Catalogue of all registered block IDs. Extend as new blocks are added. */
export const BLOCK_IDS = [
  'boundary-area',
  'terrain-flow',
  'carrying-capacity',
] as const;

export type BlockId = (typeof BLOCK_IDS)[number];
