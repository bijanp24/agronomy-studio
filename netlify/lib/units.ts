// Unit-conversion helpers shared across services. Upstream providers report a
// mix of metric and imperial; the platform normalizes to imperial agronomy
// conventions (inches of water, degrees F).

export function mmToInches(mm: number): number {
  return mm / 25.4;
}

export function inchesToMm(inches: number): number {
  return inches * 25.4;
}

export function cmToInches(cm: number): number {
  return cm / 2.54;
}

export function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

export function fahrenheitToCelsius(f: number): number {
  return ((f - 32) * 5) / 9;
}

/** Round to a fixed number of decimal places (default 3). */
export function round(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
