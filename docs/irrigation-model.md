# Irrigation Model

The gateway computes an `IrrigationRecommendation` using a FAO-56 style
soil-water-balance approach. The implementation lives in
`netlify/lib/irrigation.ts` (`computeIrrigation`).

## Inputs

| Input | Source | Units |
|-------|--------|-------|
| Reference ET (ETo) | CIMIS (`cimis.ts`) | in/day |
| Crop coefficient (Kc) | WUCOLS seed (`crop.ts`, mid-season) | dimensionless |
| Available water capacity (AWC) | NRCS SSURGO (`soil.ts`) | in water / in soil |
| Root-zone depth | crop seed, fallback to soil | in |
| Management allowable depletion (MAD) | crop seed | fraction 0–1 |
| System efficiency | request (default 0.85) | fraction 0–1 |
| Forecast rain | Open-Meteo (`fret.ts`) | in |
| Heat risk | forecast max temp ≥ 100 °F | boolean |

## Equations

```
CropET            = ETo × Kc
TAW (total)       = AWC × RootZoneDepth
RAW (readily)     = TAW × MAD
NetIrrigation     = max(0, RAW − EffectiveRain)
GrossIrrigation   = NetIrrigation ÷ SystemEfficiency
IntervalDays      = round(RAW ÷ CropET)         (clamped 1–30)
```

- **Net irrigation** refills the readily available water that the crop can
  deplete before stress, less any forecast rainfall credited over the interval.
- **Gross irrigation** grosses the net depth up by the system's application
  efficiency (drip ≈ 0.90, micro-sprinkler ≈ 0.85, sprinkler ≈ 0.75).
- **Interval** is how long CropET takes to deplete RAW.

## Confidence

Confidence starts from the data sources: if any of ETo, soil, or crop come from
a `placeholder`/`estimate` source it is reported as `low`; otherwise `high`. It
is downgraded one step when heat-risk inputs are unknown.

## Worked example

ETo = 0.25 in/day, Kc = 0.90, AWC = 0.15, root zone = 24 in, MAD = 0.50,
efficiency = 0.85, no rain:

```
CropET          = 0.225 in/day
TAW             = 3.6 in
RAW             = 1.8 in
NetIrrigation   = 1.8 in
GrossIrrigation = 2.12 in
Interval        = round(1.8 / 0.225) = 8 days
```

See `netlify/lib/__tests__/irrigation.test.ts` for the executable version.
