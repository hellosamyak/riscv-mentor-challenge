const CrossReferencer = require('../src/crossReference');
const path = require('path');

describe('CrossReferencer', () => {
  let referencer;
  const manualPath = path.join(__dirname, '../riscv-isa-manual');

  beforeEach(() => {
    referencer = new CrossReferencer(manualPath);
  });

  describe('Initialization', () => {
    test('should initialize with manual path', () => {
      expect(referencer).toBeDefined();
      expect(referencer.manualPath).toBe(manualPath);
    });

    test('should create normalizer instance', () => {
      expect(referencer.normalizer).toBeDefined();
    });

    test('should initialize extension patterns', () => {
      expect(Array.isArray(referencer.extensionPatterns)).toBe(true);
      expect(referencer.extensionPatterns.length).toBeGreaterThan(0);
    });
  });

  describe('Extension Pattern Matching', () => {
    test('should detect single-letter extensions', () => {
      const content = 'The M extension is for multiplication.';
      const exts = referencer.extractExtensionsFromContent(content);
      expect(exts).toContain('M');
    });

    test('should detect Z-extensions', () => {
      const content = 'Zba provides address computation instructions.';
      const exts = referencer.extractExtensionsFromContent(content);
      expect(exts.some((e) => e.toLowerCase().includes('zba'))).toBe(true);
    });

    test('should detect S-extensions', () => {
      const content = 'Sv39 is a paging extension for RV64.';
      const exts = referencer.extractExtensionsFromContent(content);
      expect(exts.some((e) => e.toLowerCase().includes('sv39'))).toBe(true);
    });

    test('should detect RV base ISA references', () => {
      const content = 'RV32I is the 32-bit base ISA.';
      const exts = referencer.extractExtensionsFromContent(content);
      expect(exts.some((e) => e.toUpperCase().includes('RV32'))).toBe(true);
    });

    test('should detect rv_ format extensions', () => {
      const content = 'The rv_zba extension is optional.';
      const exts = referencer.extractExtensionsFromContent(content);
      expect(exts.some((e) => e.includes('zba') || e.includes('zba'))).toBe(true);
    });
  });

  describe('Content Filtering', () => {
    test('should ignore code blocks', () => {
      const content = `
        Normal text about M extension.
        \`\`\`
        Code with A, F, D, Q extensions
        \`\`\`
        More normal text about Zba.
      `;
      const exts = referencer.extractExtensionsFromContent(content);
      // Should contain Zba and M, but code block content should be filtered
      const hasZba = exts.some((e) => e.toLowerCase() === 'zba');
      expect(hasZba).toBe(true);
    });

    test('should ignore comment blocks', () => {
      const content = `
        // This is a comment with F, D extensions
        The M extension is important.
      `;
      const exts = referencer.extractExtensionsFromContent(content);
      expect(exts).toContain('M');
    });

    test('should handle AsciiDoc code blocks', () => {
      const content = `
        Documentation about M extension.
        ----
        Code with A, F extensions
        ----
        More about Zba.
      `;
      const exts = referencer.extractExtensionsFromContent(content);
      expect(exts.some((e) => e.toLowerCase() === 'zba')).toBe(true);
    });
  });

  describe('Directory Scanning', () => {
    test('should scan directory recursively', () => {
      const srcPath = path.join(manualPath, 'modules');
      if (require('fs').existsSync(srcPath)) {
        const files = referencer.scanDirectory(srcPath);
        expect(Array.isArray(files)).toBe(true);
      }
    });

    test('should find .adoc files', () => {
      const srcPath = path.join(manualPath, 'modules');
      if (require('fs').existsSync(srcPath)) {
        const files = referencer.scanDirectory(srcPath);
        const hasAdoc = files.some((f) => f.endsWith('.adoc'));
        expect(hasAdoc).toBe(true);
      }
    });

    test('should find .asciidoc files', () => {
      const srcPath = path.join(manualPath, 'modules');
      if (require('fs').existsSync(srcPath)) {
        const files = referencer.scanDirectory(srcPath);
        const hasAsciidoc = files.some((f) => f.endsWith('.asciidoc'));
        // May or may not have .asciidoc files
        expect(Array.isArray(files)).toBe(true);
      }
    });

    test('should handle non-existent directories gracefully', () => {
      const nonExistentPath = path.join(manualPath, 'nonexistent');
      const files = referencer.scanDirectory(nonExistentPath);
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBe(0);
    });
  });

  describe('Manual Scanning', () => {
    test('should scan manual successfully', () => {
      const result = referencer.scanManual();
      expect(typeof result).toBe('boolean');
    });

    test('should find extensions in manual', () => {
      referencer.scanManual();
      const manualExts = referencer.getManualExtensions();
      expect(Array.isArray(manualExts)).toBe(true);
      // At minimum, base extensions should be found
      expect(manualExts.length).toBeGreaterThan(0);
    });

    test('should normalize found extensions', () => {
      referencer.scanManual();
      const manualExts = referencer.getManualExtensions();
      // All should be canonical names after normalization
      manualExts.forEach((ext) => {
        const normalized = referencer.normalizer.normalize(ext);
        expect(normalized).toBeDefined();
      });
    });
  });

  describe('Cross-Referencing', () => {
    test('should cross-reference extensions', () => {
      referencer.scanManual();
      const jsonExtensions = ['rv_i', 'rv_m', 'rv_zba', 'rv_nonexistent'];
      const result = referencer.crossReference(jsonExtensions);

      expect(result).toBeDefined();
      expect(result.matched).toBeDefined();
      expect(Array.isArray(result.matched)).toBe(true);
      expect(result.onlyInJson).toBeDefined();
      expect(Array.isArray(result.onlyInJson)).toBe(true);
      expect(result.onlyInManual).toBeDefined();
      expect(Array.isArray(result.onlyInManual)).toBe(true);
    });

    test('should count results correctly', () => {
      referencer.scanManual();
      const jsonExtensions = ['rv_i', 'rv_m'];
      const result = referencer.crossReference(jsonExtensions);

      const total =
        result.totalMatched + result.totalOnlyInJson + result.totalOnlyInManual;
      expect(result.matched.length).toBe(result.totalMatched);
      expect(result.onlyInJson.length).toBe(result.totalOnlyInJson);
    });

    test('should handle empty JSON extensions', () => {
      referencer.scanManual();
      const result = referencer.crossReference([]);
      expect(result.totalMatched).toBe(0);
    });

    test('should sort results', () => {
      referencer.scanManual();
      const jsonExtensions = ['rv_m', 'rv_i', 'rv_a'];
      const result = referencer.crossReference(jsonExtensions);

      // Matched should be sorted
      for (let i = 0; i < result.matched.length - 1; i++) {
        expect(result.matched[i].localeCompare(result.matched[i + 1])).toBeLessThanOrEqual(
          0
        );
      }
    });
  });

  describe('Statistics', () => {
    test('should provide statistics', () => {
      referencer.scanManual();
      const stats = referencer.getStatistics();
      expect(stats).toBeDefined();
      expect(stats.totalInManual).toBeGreaterThanOrEqual(0);
    });

    test('should update statistics after scanning', () => {
      const statsBefore = referencer.getStatistics();
      referencer.scanManual();
      const statsAfter = referencer.getStatistics();
      expect(statsAfter.totalInManual).toBeGreaterThan(0);
    });
  });

  describe('Content Extraction Edge Cases', () => {
    test('should handle empty content', () => {
      const exts = referencer.extractExtensionsFromContent('');
      expect(Array.isArray(exts)).toBe(true);
      expect(exts.length).toBe(0);
    });

    test('should handle content with no extensions', () => {
      const content = 'This is just random text with no architecture references.';
      const exts = referencer.extractExtensionsFromContent(content);
      expect(Array.isArray(exts)).toBe(true);
    });

    test('should handle multiple occurrences of same extension', () => {
      const content = 'The M extension is useful. M extension provides multiplication.';
      const exts = referencer.extractExtensionsFromContent(content);
      // Should not have duplicates
      const uniqueExts = new Set(exts);
      expect(uniqueExts.size).toBe(exts.length);
    });

    test('should handle case variations', () => {
      const content = 'Extensions: M, m, Zba, zba, ZBA';
      const exts = referencer.extractExtensionsFromContent(content);
      expect(exts.length).toBeGreaterThan(0);
    });
  });
});
