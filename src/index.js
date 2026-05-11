#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const InstructionParser = require('./parser');
const CrossReferencer = require('./crossReference');
const GraphGenerator = require('./graphGenerator');

/**
 * Main orchestration script for RISC-V Instruction Set Explorer
 * Completes Tier 1, Tier 2, and Tier 3 tasks
 */

class RiscVExplorer {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.outputDir = path.join(this.projectRoot, 'output');
    this.instrDictPath = path.join(
      this.projectRoot,
      'riscv-extensions-landscape',
      'src',
      'instr_dict.json'
    );
    this.manualPath = path.join(this.projectRoot, 'riscv-isa-manual');

    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Tier 1: Parse instruction set
   */
  async tier1() {
    console.log('\n===== TIER 1: INSTRUCTION SET PARSING =====\n');

    const parser = new InstructionParser(this.instrDictPath);

    if (!parser.parse()) {
      console.error('Failed to parse instruction dictionary');
      return null;
    }

    const summary = parser.getSummary();
    const stats = parser.getStatistics();
    const multiExt = parser.getMultiExtensionInstructions();

    console.log(`Parsed ${stats.totalInstructions} instructions`);
    console.log(`Found ${stats.totalExtensions} unique extensions`);
    console.log(`${stats.multiExtensionCount} instructions belong to multiple extensions\n`);

    // Generate summary table
    let summaryOutput =
      'INSTRUCTION SET SUMMARY\n' +
      '========================\n\n' +
      'Extension Tag | Instruction Count | Example Mnemonic\n' +
      '------ | ------ | ------\n';

    summary.forEach((entry) => {
      summaryOutput += `${entry.extension} | ${entry.instructionCount} | ${entry.exampleMnemonic}\n`;
    });

    summaryOutput += `\n\nTOTAL SUMMARY\n`;
    summaryOutput += `=============\n`;
    summaryOutput += `Total Unique Instructions: ${stats.totalInstructions}\n`;
    summaryOutput += `Total Extensions: ${stats.totalExtensions}\n`;
    summaryOutput += `Instructions with Multiple Extensions: ${stats.multiExtensionCount}\n`;

    // Multi-extension instructions
    summaryOutput += `\n\nINSTRUCTIONS WITH MULTIPLE EXTENSIONS\n`;
    summaryOutput += `====================================\n`;
    summaryOutput += `Mnemonic | Extension Count | Extensions\n`;
    summaryOutput += `------ | ------ | ------\n`;

    multiExt.slice(0, 50).forEach((entry) => {
      summaryOutput += `${entry.mnemonic} | ${entry.count} | ${entry.extensions.join(', ')}\n`;
    });

    if (multiExt.length > 50) {
      summaryOutput += `\n... and ${multiExt.length - 50} more\n`;
    }

    // Save summary
    fs.writeFileSync(path.join(this.outputDir, 'summary.txt'), summaryOutput);
    console.log('Summary saved to output/summary.txt\n');

    return { parser, summary, stats, multiExt };
  }

  /**
   * Tier 2: Cross-reference with ISA manual
   */
  async tier2(parser) {
    console.log('===== TIER 2: CROSS-REFERENCE WITH ISA MANUAL =====\n');

    const referencer = new CrossReferencer(this.manualPath);

    console.log('Scanning ISA manual for extension references...');
    if (!referencer.scanManual()) {
      console.error('Failed to scan ISA manual');
      return null;
    }

    const manualStats = referencer.getStatistics();
    console.log(`Found ${manualStats.totalInManual} unique extensions in ISA manual\n`);

    // Get all extensions from parser
    const jsonExtensions = parser.getExtensions();

    // Cross-reference
    const crossRefResult = referencer.crossReference(jsonExtensions);

    let crossRefOutput =
      'CROSS-REFERENCE RESULTS\n' +
      '======================\n\n' +
      `Scanning instr_dict.json: ${jsonExtensions.length} extensions\n` +
      `Scanning ISA manual: ${manualStats.totalInManual} extensions\n\n` +
      `Matched Extensions: ${crossRefResult.totalMatched}\n` +
      `Only in JSON: ${crossRefResult.totalOnlyInJson}\n` +
      `Only in Manual: ${crossRefResult.totalOnlyInManual}\n\n`;

    crossRefOutput += `MATCHED EXTENSIONS (${crossRefResult.matched.length})\n`;
    crossRefOutput += `====================\n`;
    crossRefOutput += crossRefResult.matched.join(', ') + '\n\n';

    crossRefOutput += `EXTENSIONS ONLY IN instr_dict.json (${crossRefResult.onlyInJson.length})\n`;
    crossRefOutput += `=====================================\n`;
    crossRefOutput +=
      crossRefResult.onlyInJson.slice(0, 30).join(', ') +
      (crossRefResult.onlyInJson.length > 30
        ? `\n... and ${crossRefResult.onlyInJson.length - 30} more`
        : '') +
      '\n\n';

    crossRefOutput += `EXTENSIONS ONLY IN ISA MANUAL (${crossRefResult.onlyInManual.length})\n`;
    crossRefOutput += `==================================\n`;
    crossRefOutput +=
      crossRefResult.onlyInManual.slice(0, 30).join(', ') +
      (crossRefResult.onlyInManual.length > 30
        ? `\n... and ${crossRefResult.onlyInManual.length - 30} more`
        : '') +
      '\n';

    fs.writeFileSync(path.join(this.outputDir, 'crossreference.txt'), crossRefOutput);
    console.log('Cross-reference saved to output/crossreference.txt\n');

    return crossRefResult;
  }

  /**
   * Tier 3: Generate graphs and relationships
   */
  async tier3(parser) {
    console.log('===== TIER 3: BONUS - EXTENSION RELATIONSHIPS =====\n');

    const extensionGroups = {};
    const extensions = parser.getExtensions();

    extensions.forEach((ext) => {
      extensionGroups[ext] = parser.getInstructionsByExtension(ext);
    });

    const graphGen = new GraphGenerator(extensionGroups);
    graphGen.buildGraph();

    // ASCII graph
    const asciiGraph = graphGen.generateAsciiGraph(20);
    console.log(asciiGraph);

    // Statistics
    const graphStats = graphGen.getStatistics();
    console.log('GRAPH STATISTICS');
    console.log('================');
    console.log(`Total Extensions: ${graphStats.totalExtensions}`);
    console.log(`Total Connections: ${graphStats.totalConnections}`);
    console.log(`Average Degree: ${graphStats.avgDegree}`);
    console.log(`Max Degree: ${graphStats.maxDegree}`);
    console.log(`Min Degree: ${graphStats.minDegree}`);
    console.log(`Isolated Extensions: ${graphStats.isolatedExtensions}`);
    if (graphStats.mostConnected) {
      console.log(
        `Most Connected: ${graphStats.mostConnected.extension} (${graphStats.mostConnected.connections} connections)\n`
      );
    }

    // Save ASCII graph
    let graphOutput = asciiGraph;

    graphOutput += `\nTOP EXTENSION PAIRS WITH SHARED INSTRUCTIONS\n`;
    graphOutput += `=============================================\n\n`;

    const topPairs = graphGen.getTopSharedPairs(30);
    graphOutput += `Extension 1 | Extension 2 | Shared Instructions\n`;
    graphOutput += `------ | ------ | ------\n`;

    topPairs.forEach((pair) => {
      graphOutput += `${pair.ext1} | ${pair.ext2} | ${pair.sharedInstructions}\n`;
    });

    fs.writeFileSync(path.join(this.outputDir, 'graph.txt'), graphOutput);
    console.log('Graph saved to output/graph.txt');

    // Save GraphML
    const graphml = graphGen.generateGraphML();
    fs.writeFileSync(path.join(this.outputDir, 'graph.graphml'), graphml);
    console.log('GraphML saved to output/graph.graphml');

    // Save Mermaid diagram
    const mermaid = graphGen.generateMermaidDiagram(20);
    fs.writeFileSync(path.join(this.outputDir, 'graph.mermaid'), mermaid);
    console.log('Mermaid diagram saved to output/graph.mermaid\n');

    return { graphGen, graphStats, topPairs };
  }

  /**
   * Run the complete analysis
   */
  async run() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║  RISC-V INSTRUCTION SET EXPLORER - ANALYSIS TOOL      ║');
    console.log('╚════════════════════════════════════════════════════════╝');

    try {
      // Tier 1
      const tier1Result = await this.tier1();
      if (!tier1Result) return;

      // Tier 2
      const tier2Result = await this.tier2(tier1Result.parser);
      if (!tier2Result) return;

      // Tier 3
      const tier3Result = await this.tier3(tier1Result.parser);

      // Final summary
      console.log('╔════════════════════════════════════════════════════════╗');
      console.log('║  ANALYSIS COMPLETE                                     ║');
      console.log('╚════════════════════════════════════════════════════════╝');
      console.log('\nOutput files generated:');
      console.log('  - output/summary.txt (Tier 1: Instruction Summary)');
      console.log('  - output/crossreference.txt (Tier 2: Cross-Reference Results)');
      console.log('  - output/graph.txt (Tier 3: Extension Relationships)');
      console.log('  - output/graph.graphml (Tier 3: GraphML Format)');
      console.log('  - output/graph.mermaid (Tier 3: Mermaid Diagram)\n');
    } catch (error) {
      console.error('Error during analysis:', error);
      process.exit(1);
    }
  }
}

// Run if executed directly
if (require.main === module) {
  const explorer = new RiscVExplorer();
  explorer.run().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = RiscVExplorer;
