export interface BloomParams {
  enabled: boolean;
  strength: number;
  radius: number;
  threshold: number;
  exposure: number;
}

/**
 * Computes calibrated UnrealBloomPass parameters for Vila Capivaras
 * depending on whether the scene is in daytime or sunset lighting mode,
 * and whether bloom is enabled.
 */
export function computeBloomParams(
  isSunset: boolean,
  bloomEnabled = true,
): BloomParams {
  if (!bloomEnabled) {
    return {
      enabled: false,
      strength: 0,
      radius: 0,
      threshold: 1.0,
      exposure: isSunset ? 1.0 : 1.05,
    };
  }

  if (isSunset) {
    // Warm architectural HDR glow on interior windows, street lamps, and backlit tenant signs
    return {
      enabled: true,
      strength: 0.48,
      radius: 0.45,
      threshold: 1.02,
      exposure: 1.02,
    };
  }

  // Daytime: crisp coastal sunlight with subtle HDR bloom on specular glass, water, and lamps
  return {
    enabled: true,
    strength: 0.22,
    radius: 0.32,
    threshold: 1.12,
    exposure: 1.06,
  };
}
