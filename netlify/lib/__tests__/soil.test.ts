import { describe, it, expect, vi, afterEach } from 'vitest';
import { getSoilProfile, querySda } from '../soil';

function jsonOk(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
}

const muaggattTable = {
  Table: [
    ['mukey', 'muname', 'aws0150wta', 'drclassdcd', 'hydgrpdcd', 'brockdepmin'],
    ['461994', 'Hanford sandy loam, 0 to 2 percent slopes', '22.5', 'Well drained', 'B', null],
  ],
};

const textureTable = {
  Table: [
    ['compname', 'comppct_r', 'texdesc'],
    ['Hanford', '85', 'sandy loam'],
  ],
};

describe('querySda', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reshapes the column-name table into keyed rows', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonOk(muaggattTable)));
    const rows = await querySda('SELECT 1');
    expect(rows).toHaveLength(1);
    expect(rows[0].muname).toContain('Hanford');
    expect(rows[0].hydgrpdcd).toBe('B');
  });

  it('returns empty array when no data rows', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonOk({ Table: [['mukey']] })));
    expect(await querySda('SELECT 1')).toEqual([]);
  });
});

describe('getSoilProfile', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('normalizes muaggatt + texture into a soil profile (cm -> in/in)', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => jsonOk(muaggattTable))
      .mockImplementationOnce(() => jsonOk(textureTable));
    vi.stubGlobal('fetch', fetchMock);

    const profile = await getSoilProfile({ latitude: 36.34, longitude: -120.11 });
    expect(profile).not.toBeNull();
    // 22.5 cm water / 150 cm soil = 0.15 in/in
    expect(profile!.availableWaterCapacity).toBeCloseTo(0.15, 3);
    expect(profile!.drainageClass).toBe('Well drained');
    expect(profile!.hydrologicGroup).toBe('B');
    expect(profile!.texture).toBe('sandy loam');
    expect(profile!.componentName).toBe('Hanford');
    // null bedrock -> default 150 cm -> ~59.06 in
    expect(profile!.rootZoneDepthIn).toBeCloseTo(59.1, 1);
  });

  it('still returns a profile when the texture lookup fails', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => jsonOk(muaggattTable))
      .mockImplementationOnce(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) } as Response));
    vi.stubGlobal('fetch', fetchMock);

    const profile = await getSoilProfile({ latitude: 36.34, longitude: -120.11 });
    expect(profile?.texture).toBeUndefined();
    expect(profile?.availableWaterCapacity).toBeCloseTo(0.15, 3);
  });

  it('returns null when SDA has no map unit', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonOk({ Table: [] })));
    expect(await getSoilProfile({ latitude: 0, longitude: 0 })).toBeNull();
  });
});
