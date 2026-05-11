const InstructionParser = require('../src/parser');
const ExtensionNormalizer = require('../src/normalizer');
const CrossReferencer = require('../src/crossReference');
const GraphGenerator = require('../src/graphGenerator');

/**
 * Comprehensive test suite for RISC-V Instruction Set Explorer
 * Run with: npm test
 */

describe('InstructionParser', () => {
  let parser;

  beforeEach(() => {
    const path = require('path');
    const dictPath = path.join(__dirname, '../riscv-extensions-landscape/src/instr_dict.json');
    parser = new InstructionParser(dictPath);
  });

  test('should initialize correctly', () => {
    expect(parser).toBeDefined();
    expect(parser.dictPath).toBeDefined();
  });

  test('should parse instruction dictionary', () => {
    const result = parser.parse();
    expect(result).toBe(true);
    expect(parser.instructions).toBeDefined();
  });

  test('should group instructions by extension', () => {
    parser.parse();
    const groups = parser.extensionGroups;
    expect(groups).toBeDefined();
    expect(Object.keys(groups).length).toBeGreaterThan(0);
  });

  test('should identify multi-extension instructions', () => {
    parser.parse();
    const multiExt = parser.getMultiExtensionInstructions();
    expect(Array.isArray(multiExt)).toBe(true);
    expect(multiExt.length).toBeGreaterThanOrEqual(0);

    // Verify structure
    if (multiExt.length > 0) {
      const first = multiExt[0];
      expect(first.mnemonic).toBeDefined();
      expect(first.extensions).toBeDefined();
      expect(Array.isArray(first.extensions)).toBe(true);
      expect(first.extensions.length).toBeGreaterThan(1);
    }
  });

  test('should return correct statistics', () => {
    parser.parse();
    const stats = parser.getStatistics();
    expect(stats.totalInstructions).toBeGreaterThan(0);
    expect(stats.totalExtensions).toBeGreaterThan(0);
    expect(stats.multiExtensionCount).toBeGreaterThanOrEqual(0);
  });

  test('should denormalize mnemonics correctly', () => {
    expect(parser.denormalizeMnemonic('add')).toBe('ADD');
    expect(parser.denormalizeMnemonic('add_uw')).toBe('ADD.UW');
    expect(parser.denormalizeMnemonic('sc_w')).toBe('SC.W');
    expect(parser.denormalizeMnemonic('aes32dsi')).toBe('AES32DSI');
  });

  test('should get summary with correct structure', () => {
    parser.parse();
    const summary = parser.getSummary();
    expect(Array.isArray(summary)).toBe(true);
    expect(summary.length).toBeGreaterThan(0);

    const first = summary[0];
    expect(first.extension).toBeDefined();
    expect(first.instructionCount).toBeGreaterThan(0);
    expect(first.exampleMnemonic).toBeDefined();
  });

  test('should get extensions sorted', () => {
    parser.parse();
    const exts = parser.getExtensions();
    expect(Array.isArray(exts)).toBe(true);
    expect(exts.length).toBeGreaterThan(0);
    // Check if sorted
    for (let i = 0; i < exts.length - 1; i++) {
      expect(exts[i].localeCompare(exts[i + 1])).toBeLessThanOrEqual(0);
    }
  });
});

describe('ExtensionNormalizer', () => {
  let normalizer;

  beforeEach(() => {
    normalizer = new ExtensionNormalizer();
  });

  test('should initialize correctly', () => {
    expect(normalizer).toBeDefined();
    expect(normalizer.canonicalMappings).toBeDefined();
  });

  test('should normalize base extensions', () => {
    expect(normalizer.normalize('rv_i')).toBe('I');
    expect(normalizer.normalize('RV32I')).toBe('I');
    expect(normalizer.normalize('I')).toBe('I');
  });

  test('should normalize standard extensions', () => {
    expect(normalizer.normalize('rv_m')).toBe('M');
    expect(normalizer.normalize('M')).toBe('M');
    expect(normalizer.normalize('rv_a')).toBe('A');
  });

  test('should normalize Z-extensions', () => {
    const zba = normalizer.normalize('rv_zba');
    expect(zba).toBe('Zba');

    const zba2 = normalizer.normalize('Zba');
    expect(zba2).toBe('Zba');

    const zicsr = normalizer.normalize('rv_zicsr');
    expect(zicsr).toBe('Zicsr');
  });

  test('should handle case-insensitive normalization', () => {
    expect(normalizer.normalize('ZBA')).toBe('Zba');
    expect(normalizer.normalize('ZICSR')).toBe('Zicsr');
    expect(normalizer.normalize('M')).toBe('M');
  });

  test('should check if extensions are the same', () => {
    expect(normalizer.isSameExtension('rv_zba', 'Zba')).toBe(true);
    expect(normalizer.isSameExtension('M', 'rv_m')).toBe(true);
    expect(normalizer.isSameExtension('rv_zba', 'Zbb')).toBe(false);
  });

  test('should get all canonical names', () => {
    const canonical = normalizer.getCanonicalNames();
    expect(Array.isArray(canonical)).toBe(true);
    expect(canonical.length).toBeGreaterThan(0);
    expect(canonical).toContain('I');
    expect(canonical).toContain('M');
  });

  test('should get variants for known extensions', () => {
    const variants = normalizer.getVariants('m');
    expect(variants).toBeDefined();
    expect(variants.formal).toBe('M');
    expect(Array.isArray(variants.dict)).toBe(true);
  });

  test('should normalize unknown extensions gracefully', () => {
    const result = normalizer.normalize('SomeUnknownExt');
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('CrossReferencer', () => {
  let referencer;

  beforeEach(() => {
    const path = require('path');
    const manualPath = path.join(__dirname, '../riscv-isa-manual');
    referencer = new CrossReferencer(manualPath);
  });

  test('should initialize correctly', () => {
    expect(referencer).toBeDefined();
    expect(referencer.normalizer).toBeDefined();
    expect(referencer.extensionPatterns.length).toBeGreaterThan(0);
  });

  test('should extract extensions from content', () => {
    const content = 'The RV32I base ISA includes M, A, and F extensions. Zba is optional.';
    const exts = referencer.extractExtensionsFromContent(content);
    expect(Array.isArray(exts)).toBe(true);
    expect(exts.length).toBeGreaterThan(0);
  });

  test('should filter out code blocks', () => {
    const content = `
      Some documentation about extensions.
      \`\`\`
      This is code with F, D, Q extensions
      \`\`\`
      More text about Zba extension.
    `;
    const exts = referencer.extractExtensionsFromContent(content);
    expect(exts).toContain('Zba');
    // Code block content should be largely ignored
  });

  test('should scan directory', () => {
    const path = require('path');
    const testDir = path.join(__dirname, '../riscv-isa-manual/modules');
    const files = referencer.scanDirectory(testDir);
    expect(Array.isArray(files)).toBe(true);
    // At least some .adoc files should exist
    expect(files.some((f) => f.endsWith('.adoc'))).toBe(true);
  });
});

describe('GraphGenerator', () => {
  let graphGen;

  beforeEach(() => {
    const testExtensions = {
      rv_i: [
        { mnemonic: 'ADD', encoding: '...', variableFields: [], match: '0x33', mask: '0x...' },
        { mnemonic: 'ADDI', encoding: '...', variableFields: [], match: '0x13', mask: '0x...' },
      ],
      rv_m: [
        { mnemonic: 'ADD', encoding: '...', variableFields: [], match: '0x33', mask: '0x...' },
        { mnemonic: 'MUL', encoding: '...', variableFields: [], match: '0x123', mask: '0x...' },
      ],
      rv_a: [
        { mnemonic: 'SC.W', encoding: '...', variableFields: [], match: '0x456', mask: '0x...' },
      ],
    };

    graphGen = new GraphGenerator(testExtensions);
  });

  test('should initialize correctly', () => {
    expect(graphGen).toBeDefined();
    expect(graphGen.extensionGroups).toBeDefined();
  });

  test('should build graph correctly', () => {
    graphGen.buildGraph();
    const graph = graphGen.graph;
    expect(graph).toBeDefined();
    expect(graph.nodeCount()).toBeGreaterThan(0);
  });

  test('should find shared instructions', () => {
    graphGen.findSharedInstructions();
    expect(graphGen.sharedInstructions).toBeDefined();
    // rv_i and rv_m share ADD instruction
    expect(Object.keys(graphGen.sharedInstructions).length).toBeGreaterThan(0);
  });

  test('should identify most connected extensions', () => {
    graphGen.buildGraph();
    const mostConnected = graphGen.getMostConnected(2);
    expect(Array.isArray(mostConnected)).toBe(true);
    if (mostConnected.length > 0) {
      expect(mostConnected[0].extension).toBeDefined();
      expect(mostConnected[0].connections).toBeGreaterThanOrEqual(0);
    }
  });

  test('should generate ASCII graph', () => {
    graphGen.buildGraph();
    const ascii = graphGen.generateAsciiGraph();
    expect(typeof ascii).toBe('string');
    expect(ascii.length).toBeGreaterThan(0);
  });

  test('should generate GraphML', () => {
    graphGen.buildGraph();
    const graphml = graphGen.generateGraphML();
    expect(typeof graphml).toBe('string');
    expect(graphml).toContain('<?xml');
    expect(graphml).toContain('</graphml>');
  });

  test('should generate Mermaid diagram', () => {
    graphGen.buildGraph();
    const mermaid = graphGen.generateMermaidDiagram();
    expect(typeof mermaid).toBe('string');
    expect(mermaid).toContain('graph');
  });

  test('should get graph statistics', () => {
    graphGen.buildGraph();
    const stats = graphGen.getStatistics();
    expect(stats.totalExtensions).toBe(3);
    expect(stats.avgDegree).toBeDefined();
    expect(stats.maxDegree).toBeGreaterThanOrEqual(0);
  });

  test('should get top shared pairs', () => {
    graphGen.buildGraph();
    const topPairs = graphGen.getTopSharedPairs(5);
    expect(Array.isArray(topPairs)).toBe(true);
    if (topPairs.length > 0) {
      expect(topPairs[0].ext1).toBeDefined();
      expect(topPairs[0].ext2).toBeDefined();
      expect(topPairs[0].sharedInstructions).toBeGreaterThan(0);
    }
  });
});

describe('Integration Tests', () => {
  test('parser and normalizer work together', () => {
    const path = require('path');
    const parser = new InstructionParser(
      path.join(__dirname, '../riscv-extensions-landscape/src/instr_dict.json')
    );
    const normalizer = new ExtensionNormalizer();

    parser.parse();
    const extensions = parser.getExtensions();

    // All extensions should normalize to something
    extensions.forEach((ext) => {
      const normalized = normalizer.normalize(ext);
      expect(normalized).toBeDefined();
      expect(normalized.length).toBeGreaterThan(0);
    });
  });

  test('parser and graph generator work together', () => {
    const path = require('path');
    const parser = new InstructionParser(
      path.join(__dirname, '../riscv-extensions-landscape/src/instr_dict.json')
    );

    parser.parse();
    const extensionGroups = {};
    const extensions = parser.getExtensions();

    extensions.forEach((ext) => {
      extensionGroups[ext] = parser.getInstructionsByExtension(ext);
    });

    const graphGen = new GraphGenerator(extensionGroups);
    graphGen.buildGraph();

    const stats = graphGen.getStatistics();
    expect(stats.totalExtensions).toBe(extensions.length);
  });
});
