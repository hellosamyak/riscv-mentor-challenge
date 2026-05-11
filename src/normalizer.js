/**
 * Normalizer for RISC-V extension names
 * Handles conversion between different naming conventions used in instr_dict.json and ISA manual
 *
 * Naming patterns:
 * - instr_dict.json: rv_i, rv_m, rv_a, rv32_i, rv64_i, rv_zba, rv32_zknd, etc.
 * - ISA manual: I, M, A, Zba, Zknd, RV32I, RV64I, RV128I, etc.
 */

class ExtensionNormalizer {
  constructor() {
    // Mapping of normalized forms to their variants
    this.canonicalMappings = this.buildCanonicalMappings();
    this.normalized = {};
  }

  /**
   * Build a comprehensive mapping of known extensions
   */
  buildCanonicalMappings() {
    const mappings = {};

    // Base ISAs
    const bases = [
      { formal: 'I', dict: 'rv_i', manual: 'RV32I', manual2: 'RV64I' },
      { formal: 'E', dict: 'rv_e', manual: 'RV32E', manual2: 'RV64E' },
    ];

    // Standard single-letter extensions
    const standards = ['M', 'A', 'F', 'D', 'Q', 'C', 'V', 'H', 'N'];

    // Multi-letter extensions (Z-prefix for user-level, S-prefix for system-level)
    const multiLetter = [
      'Zba', 'Zbb', 'Zbc', 'Zbs', // Bit manipulation
      'Zaamo', 'Zalrsc', 'Zacas', 'Zabha', 'Zawrs', // Atomics
      'Zca', 'Zcb', 'Zcd', 'Zcf', 'Zce', 'Zcmp', 'Zcmt', // Compressed
      'Zfh', 'Zfhmin', 'Zfa', 'Zfbfmin', 'Zfinx', 'Zdinx', 'Zqinx', // Floating-point
      'Zicbom', 'Zicbop', 'Zicboz', // Cache
      'Zicsr', 'Zifencei', 'Zihintntl', 'Zihintpause', // System
      'Zicond', 'Zimop', 'Zpm', 'Ztso', 'Zilsd', // Other integer
      'Zk', 'Zkn', 'Zks', 'Zkt', 'Zknd', 'Zkne', 'Zknh', 'Zkr', 'Zksed', 'Zksh', // Crypto
      'Zvk', 'Zvkb', 'Zvkg', 'Zvkn', 'Zvknc', 'Zvkng', 'Zvks', 'Zvksc', 'Zvksg', 'Zvkt', // Vector crypto
      'Sv32', 'Sv39', 'Sv48', 'Sv57', 'Svpbmt', 'Svnapot', 'Svinval', 'Svadu', // Supervisor memory
      'Sstc', 'Sscofpmf', 'Ssaia', 'Smaia', // Supervisor interrupt & counters
      'Smstateen', 'Smnpm', 'Smcdeleg', 'Smcntrpmf', 'Smctr', // Supervisor misc
      'Ssdbltrp', 'Smdbltrp', // Double trap
      'Smepmp', 'Ssccptr', 'Ssdbltrp', 'Ssstrict', // System security
      'Shcounterenw', 'Shgatpa', 'Shtvala', 'Shvsatpa', 'Shvstvala', 'Shvstvecd', // Hypervisor
      'Unpriv_cfi', 'Priv_cfi', // CFI
      'Zvfbfmin', 'Zvfbfwma', // Vector bfloat
      'Zalasr', 'Zama', 'Zars', 'Zic64b', 'Ziccrse', 'Ziccamoa', 'Ziccamoc', 'Ziccif', 'Zicclsm', // Other
      'Zfbfmin', 'Zbfloat16', // Bfloat16
      'Supm', 'Ssectrex', 'Ssectrex_impl', // Security extensions
    ];

    // Build mappings
    bases.forEach((base) => {
      const key = base.formal.toLowerCase();
      mappings[key] = {
        formal: base.formal,
        dict: [base.dict],
        manual: [base.manual, base.manual2],
      };
    });

    standards.forEach((ext) => {
      const key = ext.toLowerCase();
      mappings[key] = {
        formal: ext,
        dict: [`rv_${key}`],
        manual: [ext],
      };
    });

    multiLetter.forEach((ext) => {
      const lower = ext.toLowerCase();
      const dictForm = `rv_${lower}`;
      const rv32Form = `rv32_${lower}`;
      const rv64Form = `rv64_${lower}`;

      mappings[lower] = {
        formal: ext,
        dict: [dictForm, rv32Form, rv64Form],
        manual: [ext, `RV32I_${ext}`, `RV64I_${ext}`, `RV${ext}`],
      };
    });

    return mappings;
  }

  /**
   * Normalize an extension name to canonical form
   */
  normalize(extensionName) {
    if (!extensionName) return null;

    // Check cache
    if (this.normalized[extensionName]) {
      return this.normalized[extensionName];
    }

    const lower = extensionName.toLowerCase();

    // Check direct mapping
    if (this.canonicalMappings[lower]) {
      this.normalized[extensionName] = this.canonicalMappings[lower].formal;
      return this.canonicalMappings[lower].formal;
    }

    // Try pattern matching for complex names
    let canonical = this.tryPatternMatching(extensionName, lower);
    if (canonical) {
      this.normalized[extensionName] = canonical;
      return canonical;
    }

    // Fallback: return as-is but normalize casing
    canonical = this.normalizeByPattern(extensionName);
    this.normalized[extensionName] = canonical;
    return canonical;
  }

  /**
   * Try to match by pattern
   */
  tryPatternMatching(original, lower) {
    // Strip common prefixes like: rv, rv32, rv64, rv128 with or without underscore
    let stripped = lower.replace(/^rv(?:32|64|128)?_?/, '');

    if (this.canonicalMappings[stripped]) {
      return this.canonicalMappings[stripped].formal;
    }

    // Also try removing just the leading 'rv' or any digits after it
    stripped = lower.replace(/^rv/, '');
    stripped = stripped.replace(/^\d+_?/, '');
    if (this.canonicalMappings[stripped]) {
      return this.canonicalMappings[stripped].formal;
    }

    return null;
  }

  /**
   * Normalize by pattern (for unknowns)
   */
  normalizeByPattern(name) {
    if (!name) return null;

    // Remove rv/rv32/rv64/rv128 prefixes if present
    let result = String(name).toLowerCase().replace(/^rv(?:32|64|128)?_?/, '');

    // Convert underscores to dots for display
    result = result.replace(/_/g, '.');

    // Capitalize first letter of each segment
    result = result
      .split('.')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('.');

    return result;
  }

  /**
   * Get all variants of a normalized extension
   */
  getVariants(normalizedName) {
    const lower = normalizedName.toLowerCase();
    if (this.canonicalMappings[lower]) {
      return this.canonicalMappings[lower];
    }
    return null;
  }

  /**
   * Check if two extension names refer to the same extension
   */
  isSameExtension(ext1, ext2) {
    const norm1 = this.normalize(ext1);
    const norm2 = this.normalize(ext2);
    return norm1 && norm2 && norm1 === norm2;
  }

  /**
   * Get all canonical names
   */
  getCanonicalNames() {
    return Object.keys(this.canonicalMappings).map(
      (key) => this.canonicalMappings[key].formal
    );
  }
}

module.exports = ExtensionNormalizer;
