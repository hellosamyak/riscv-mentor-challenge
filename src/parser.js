const fs = require('fs');
const path = require('path');

/**
 * Parser for RISC-V instruction dictionary
 * Reads instr_dict.json and provides structured access to instruction data
 */

class InstructionParser {
  constructor(dictPath) {
    this.dictPath = dictPath;
    this.instructions = {};
    this.extensionGroups = {};
    this.multiExtensionInstructions = [];
  }

  /**
   * Load and parse the instruction dictionary
   */
  parse() {
    try {
      const rawData = fs.readFileSync(this.dictPath, 'utf-8');
      this.instructions = JSON.parse(rawData);
      this.groupByExtension();
      this.findMultiExtensionInstructions();
      return true;
    } catch (error) {
      console.error(`Error parsing instruction dictionary: ${error.message}`);
      return false;
    }
  }

  /**
   * Group instructions by their extension tag(s)
   */
  groupByExtension() {
    this.extensionGroups = {};

    Object.entries(this.instructions).forEach(([mnemonic, data]) => {
      const extensions = data.extension || [];
      extensions.forEach((ext) => {
        if (!this.extensionGroups[ext]) {
          this.extensionGroups[ext] = [];
        }
        this.extensionGroups[ext].push({
          mnemonic: this.denormalizeMnemonic(mnemonic),
          encoding: data.encoding,
          variableFields: data.variable_fields || [],
          match: data.match,
          mask: data.mask,
        });
      });
    });
  }

  /**
   * Identify instructions that belong to more than one extension
   */
  findMultiExtensionInstructions() {
    this.multiExtensionInstructions = [];

    Object.entries(this.instructions).forEach(([mnemonic, data]) => {
      const extensions = data.extension || [];
      if (extensions.length > 1) {
        this.multiExtensionInstructions.push({
          mnemonic: this.denormalizeMnemonic(mnemonic),
          extensions,
          count: extensions.length,
        });
      }
    });

    // Sort by count (descending) then by mnemonic
    this.multiExtensionInstructions.sort(
      (a, b) => b.count - a.count || a.mnemonic.localeCompare(b.mnemonic)
    );
  }

  /**
   * Convert normalized mnemonic back to standard form
   * E.g., "add_uw" -> "ADD.UW", "sc_w" -> "SC.W"
   */
  denormalizeMnemonic(normalized) {
    return normalized
      .replace(/_/g, '.')
      .split('.')
      .map((part) => part.toUpperCase())
      .join('.');
  }

  /**
   * Get a summary table of extensions
   */
  getSummary() {
    const summary = [];

    Object.entries(this.extensionGroups)
      .sort(([extA], [extB]) => extA.localeCompare(extB))
      .forEach(([extension, instructions]) => {
        const exampleMnemonic =
          instructions.length > 0 ? instructions[0].mnemonic : 'N/A';
        summary.push({
          extension,
          instructionCount: instructions.length,
          exampleMnemonic,
        });
      });

    return summary;
  }

  /**
   * Get multi-extension instructions
   */
  getMultiExtensionInstructions() {
    return this.multiExtensionInstructions;
  }

  /**
   * Get all instructions in a specific extension
   */
  getInstructionsByExtension(extension) {
    return this.extensionGroups[extension] || [];
  }

  /**
   * Get all extensions
   */
  getExtensions() {
    const exts = Object.keys(this.extensionGroups);
    // Use localeCompare with numeric sorting for stable, human-friendly order
    return exts.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      totalInstructions: Object.keys(this.instructions).length,
      totalExtensions: Object.keys(this.extensionGroups).length,
      multiExtensionCount: this.multiExtensionInstructions.length,
    };
  }
}

module.exports = InstructionParser;
