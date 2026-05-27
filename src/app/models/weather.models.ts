export interface AtmosphericSnapshot {
  precip1Hour: number;
  precipRate: number;
  pressureAltimeter: number;
  relativeHumidity: number;
  windSpeed: number;
  temperature: number;
  uvIndex: number;
  cloudCoverPhrase: string;
}

export interface EntropyReading {
  atmospheric: AtmosphericSnapshot;
  entropy: number;
  vector: number[];
  timestamp: string;
  location: string;
}

export interface EntropyStats {
  count: number;
  meanEntropy: number;
  varianceEntropy: number;
}

export interface EntropyHistory {
  records: EntropyReading[];
  stats: EntropyStats;
}
