import type { CropGrowthStage, CropWaterCoefficient } from './models';
import seed from '../../data/wucols-kc.json';

interface SeedCrop {
  id: string;
  name: string;
  category?: string;
  aliases?: string[];
  kcByStage: Partial<Record<CropGrowthStage, number>>;
  allowableDepletion?: number;
  rootDepthIn?: number;
}

interface CropSeedFile {
  source: string;
  crops: SeedCrop[];
}

const seedFile = seed as CropSeedFile;

function toCoefficient(crop: SeedCrop): CropWaterCoefficient {
  const mid = crop.kcByStage.mid ?? crop.kcByStage.development ?? crop.kcByStage.initial ?? 0.9;
  return {
    cropId: crop.id,
    cropName: crop.name,
    category: crop.category,
    kc: mid,
    kcByStage: crop.kcByStage,
    allowableDepletion: crop.allowableDepletion,
    rootDepthIn: crop.rootDepthIn,
    source: 'WUCOLS',
  };
}

const byId = new Map<string, SeedCrop>(seedFile.crops.map((c) => [c.id, c]));

export function listCrops(): CropWaterCoefficient[] {
  return seedFile.crops.map(toCoefficient);
}

export function getCropById(id: string): CropWaterCoefficient | null {
  const crop = byId.get(id.toLowerCase());
  return crop ? toCoefficient(crop) : null;
}

/** Substring search across crop name, id, category, and aliases. */
export function searchCrops(query: string): CropWaterCoefficient[] {
  const q = query.trim().toLowerCase();
  if (!q) return listCrops();
  return seedFile.crops
    .filter((c) =>
      c.id.includes(q) ||
      c.name.toLowerCase().includes(q) ||
      (c.category ?? '').toLowerCase().includes(q) ||
      (c.aliases ?? []).some((a) => a.toLowerCase().includes(q)),
    )
    .map(toCoefficient);
}

/**
 * Resolve a crop coefficient from an id or free-text crop name. Exact id wins,
 * then exact name/alias, then best substring match. Returns null when nothing matches.
 */
export function findCoefficient(cropId?: string, cropName?: string): CropWaterCoefficient | null {
  if (cropId) {
    const byKey = getCropById(cropId);
    if (byKey) return byKey;
  }
  if (cropName) {
    const q = cropName.trim().toLowerCase();
    const exact = seedFile.crops.find(
      (c) => c.name.toLowerCase() === q || c.id === q || (c.aliases ?? []).some((a) => a.toLowerCase() === q),
    );
    if (exact) return toCoefficient(exact);
    const matches = searchCrops(q);
    if (matches.length > 0) return matches[0];
  }
  return null;
}

/** Crop coefficient for a specific growth stage (falls back to the representative Kc). */
export function coefficientForStage(crop: CropWaterCoefficient, stage: CropGrowthStage): number {
  return crop.kcByStage?.[stage] ?? crop.kc;
}
