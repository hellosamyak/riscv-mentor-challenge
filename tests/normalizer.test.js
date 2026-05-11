const ExtensionNormalizer = require('../src/normalizer');

describe('ExtensionNormalizer - Detailed Tests', () => {
  let normalizer;

  beforeEach(() => {
    normalizer = new ExtensionNormalizer();
  });

  describe('Base ISA Normalization', () => {
    test('should normalize RV32I variants', () => {
      expect(normalizer.normalize('rv_i')).toBe('I');
      expect(normalizer.normalize('RV32I')).toBe('I');
      expect(normalizer.normalize('I')).toBe('I');
    });

    test('should normalize RV64I variants', () => {
      expect(normalizer.normalize('RV64I')).toBe('I');
      expect(normalizer.normalize('rv64_i')).toBe('I');
    });

    test('should normalize E extension', () => {
      expect(normalizer.normalize('rv_e')).toBe('E');
      expect(normalizer.normalize('RV32E')).toBe('E');
    });
  });

  describe('Standard Extension Normalization', () => {
    test('should normalize single-letter extensions', () => {
      expect(normalizer.normalize('M')).toBe('M');
      expect(normalizer.normalize('rv_m')).toBe('M');
      expect(normalizer.normalize('m')).toBe('M');
      expect(normalizer.normalize('RV_M')).toBe('M');
    });

    test('should normalize atomic extensions', () => {
      expect(normalizer.normalize('A')).toBe('A');
      expect(normalizer.normalize('rv_a')).toBe('A');
    });

    test('should normalize floating-point extensions', () => {
      expect(normalizer.normalize('F')).toBe('F');
      expect(normalizer.normalize('D')).toBe('D');
      expect(normalizer.normalize('Q')).toBe('Q');
      expect(normalizer.normalize('H')).toBe('H');
    });

    test('should normalize vector extension', () => {
      expect(normalizer.normalize('V')).toBe('V');
      expect(normalizer.normalize('rv_v')).toBe('V');
    });
  });

  describe('Z-Extension Normalization', () => {
    test('should normalize bit manipulation extensions', () => {
      expect(normalizer.normalize('Zba')).toBe('Zba');
      expect(normalizer.normalize('rv_zba')).toBe('Zba');
      expect(normalizer.normalize('ZBA')).toBe('Zba');
      expect(normalizer.normalize('rv32_zba')).toBe('Zba');
      expect(normalizer.normalize('rv64_zba')).toBe('Zba');
    });

    test('should normalize atomics extensions', () => {
      expect(normalizer.normalize('Zaamo')).toBe('Zaamo');
      expect(normalizer.normalize('Zalrsc')).toBe('Zalrsc');
      expect(normalizer.normalize('Zacas')).toBe('Zacas');
    });

    test('should normalize compressed extensions', () => {
      expect(normalizer.normalize('C')).toBe('C');
      expect(normalizer.normalize('Zca')).toBe('Zca');
      expect(normalizer.normalize('Zcb')).toBe('Zcb');
    });

    test('should normalize cryptography extensions', () => {
      expect(normalizer.normalize('Zk')).toBe('Zk');
      expect(normalizer.normalize('Zkn')).toBe('Zkn');
      expect(normalizer.normalize('Zks')).toBe('Zks');
      expect(normalizer.normalize('Zknd')).toBe('Zknd');
    });

    test('should normalize system extensions', () => {
      expect(normalizer.normalize('Zicsr')).toBe('Zicsr');
      expect(normalizer.normalize('Zifencei')).toBe('Zifencei');
      expect(normalizer.normalize('Zihintpause')).toBe('Zihintpause');
    });
  });

  describe('S-Extension Normalization', () => {
    test('should normalize supervisor memory extensions', () => {
      expect(normalizer.normalize('Sv39')).toBe('Sv39');
      expect(normalizer.normalize('Sv48')).toBe('Sv48');
      expect(normalizer.normalize('Svpbmt')).toBe('Svpbmt');
    });

    test('should normalize supervisor interrupt extensions', () => {
      expect(normalizer.normalize('Sstc')).toBe('Sstc');
      expect(normalizer.normalize('Sscofpmf')).toBe('Sscofpmf');
    });
  });

  describe('Equivalence Testing', () => {
    test('should recognize equivalent extensions', () => {
      expect(normalizer.isSameExtension('rv_zba', 'Zba')).toBe(true);
      expect(normalizer.isSameExtension('rv_m', 'M')).toBe(true);
      expect(normalizer.isSameExtension('I', 'rv32_i')).toBe(true);
      expect(normalizer.isSameExtension('ZBA', 'rv_zba')).toBe(true);
    });

    test('should recognize different extensions', () => {
      expect(normalizer.isSameExtension('rv_zba', 'Zbb')).toBe(false);
      expect(normalizer.isSameExtension('M', 'F')).toBe(false);
      expect(normalizer.isSameExtension('Zk', 'Zkn')).toBe(false);
    });
  });

  describe('Caching', () => {
    test('should cache normalization results', () => {
      const result1 = normalizer.normalize('rv_zba');
      const result2 = normalizer.normalize('rv_zba');
      expect(result1).toBe(result2);
      expect(normalizer.normalized['rv_zba']).toBe('Zba');
    });

    test('should handle multiple cache entries', () => {
      normalizer.normalize('rv_zba');
      normalizer.normalize('Zba');
      normalizer.normalize('M');
      expect(Object.keys(normalizer.normalized).length).toBeGreaterThan(0);
    });
  });

  describe('Canonical Names', () => {
    test('should return all canonical names', () => {
      const canonical = normalizer.getCanonicalNames();
      expect(Array.isArray(canonical)).toBe(true);
      expect(canonical.length).toBeGreaterThan(100); // Should have many extensions
      expect(canonical).toContain('I');
      expect(canonical).toContain('M');
      expect(canonical).toContain('Zba');
      expect(canonical).toContain('Sv39');
    });

    test('canonical names should be unique', () => {
      const canonical = normalizer.getCanonicalNames();
      const unique = new Set(canonical);
      expect(unique.size).toBe(canonical.length);
    });
  });

  describe('Variant Retrieval', () => {
    test('should get variants for known extension', () => {
      const variants = normalizer.getVariants('zba');
      expect(variants).toBeDefined();
      expect(variants.formal).toBe('Zba');
      expect(Array.isArray(variants.dict)).toBe(true);
      expect(variants.dict).toContain('rv_zba');
    });

    test('should return null for unknown extension', () => {
      const variants = normalizer.getVariants('unknown_ext_xyz');
      expect(variants).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    test('should handle null input', () => {
      expect(normalizer.normalize(null)).toBeNull();
    });

    test('should handle empty string', () => {
      const result = normalizer.normalize('');
      expect(result).toBeDefined();
    });

    test('should handle mixed case properly', () => {
      expect(normalizer.normalize('Rv_Zba')).toBe('Zba');
      expect(normalizer.normalize('RV_ZBA')).toBe('Zba');
    });

    test('should handle extensions with numbers', () => {
      expect(normalizer.normalize('Zicsr')).toBe('Zicsr');
      expect(normalizer.normalize('Zifencei')).toBe('Zifencei');
    });
  });
});
