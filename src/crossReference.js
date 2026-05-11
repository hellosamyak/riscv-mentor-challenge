const fs = require('fs');
const path = require('path');
const ExtensionNormalizer = require('./normalizer');

/**
 * Cross-references extensions between instr_dict.json and RISC-V ISA manual
 * Scans AsciiDoc source files for extension references
 */

class CrossReferencer {
  constructor(manualPath) {
    this.manualPath = manualPath;
    this.normalizer = new ExtensionNormalizer();
    this.manualExtensions = new Set();
    this.extensionPatterns = [];
    this.buildExtensionPatterns();
  }

  /**
   * Build regex patterns for detecting extension references in AsciiDoc files
   */
  buildExtensionPatterns() {
    const canonical = this.normalizer.getCanonicalNames();

    // Patterns to search for in AsciiDoc
    this.extensionPatterns = [
      // Single letter extensions: RV32I, RV64I, M, A, F, D, etc.
      /\b(?:RV\d*)?([IMAFDQCVHN])\b(?![a-z])/g,
      // Z-extensions: Zba, Zbb, Zicsr, etc.
      /\b(Z[a-z0-9]+)\b/gi,
      // S-extensions: Sv39, Sstc, Smstateen, etc.
      /\b(S[a-z0-9]+)\b/gi,
      // H-extensions: Hypervisor
      /\b(H)\b(?![a-z])/g,
      // RV32/RV64/RV128 base ISA references
      /\b(RV(?:32|64|128)(?:[IE])?)\b/g,
      // rv_ format (from instr_dict.json): rv_i, rv_zba, etc.
      /\b(rv_[a-z0-9_]+)\b/gi,
    ];
  }

  /**
   * Recursively scan a directory for AsciiDoc files
   */
  scanDirectory(directory) {
    const files = [];

    try {
      const entries = fs.readdirSync(directory, { withFileTypes: true });

      entries.forEach((entry) => {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          files.push(...this.scanDirectory(fullPath));
        } else if (
          entry.isFile() &&
          (entry.name.endsWith('.adoc') || entry.name.endsWith('.asciidoc'))
        ) {
          files.push(fullPath);
        }
      });
    } catch (error) {
      console.error(`Error scanning directory ${directory}: ${error.message}`);
    }

    return files;
  }

  /**
   * Extract extension references from AsciiDoc content
   */
  extractExtensionsFromContent(content) {
    const extensions = new Set();

    // Remove AsciiDoc comments (// ...)
    let cleanContent = content.replace(/\/\/.*$/gm, '');

    // Remove code blocks
    cleanContent = cleanContent.replace(/```[\s\S]*?```/g, '');
    cleanContent = cleanContent.replace(/----[\s\S]*?----/g, '');

    // Search for extension patterns
    const patterns = [
      // Single letter extensions: RV32I, RV64I, M, A, F, D, etc.
      /\b(?:RV\d*)?([IMAFDQCVH])\b(?![a-z])/g,
      // Z-extensions: Zba, Zicsr, etc.
      /\b(Z[a-z0-9_]+)\b/gi,
      // S-extensions: Sv39, Sstc, Smstateen, etc.
      /\b(S[a-z0-9_]+)\b/gi,
      // H-extensions: Hypervisor
      /\b(H)\b(?![a-z])/g,
      // RV32/RV64 base ISA references
      /\b(RV(?:32|64|128)(?:[IE])?)\b/g,
      // rv_ format (from instr_dict.json): rv_i, rv_zba, etc.
      /\b(rv_[a-z0-9_]+)\b/gi,
    ];

    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(cleanContent)) !== null) {
        const ext = match[1];
        if (ext && ext.length > 0) {
          extensions.add(ext);
        }
      }
    });

    return Array.from(extensions);
  }

  /**
   * Scan the ISA manual for extension references
   */
  scanManual() {
    const srcPath = path.join(this.manualPath, 'modules');

    if (!fs.existsSync(srcPath)) {
      console.error(`ISA manual path not found: ${srcPath}`);
      return false;
    }

    const adocFiles = this.scanDirectory(srcPath);
    console.log(`Found ${adocFiles.length} AsciiDoc files in ISA manual`);

    adocFiles.forEach((filePath) => {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const foundExtensions = this.extractExtensionsFromContent(content);
        const canonicalNames = this.normalizer.getCanonicalNames();

        foundExtensions.forEach((ext) => {
          const normalized = this.normalizer.normalize(ext);
          if (normalized && canonicalNames.includes(normalized)) {
            this.manualExtensions.add(normalized);
          }
        });
      } catch (error) {
        console.error(`Error reading file ${filePath}: ${error.message}`);
      }
    });

    return true;
  }

  /**
   * Cross-reference extensions between manual and instr_dict
   */
  crossReference(jsonExtensions) {
    const jsonNormalized = new Set();
    const unmatchedJson = [];
    const unmatchedManual = [];

    // Normalize all JSON extensions
    jsonExtensions.forEach((ext) => {
      const normalized = this.normalizer.normalize(ext);
      if (normalized) {
        jsonNormalized.add(normalized);
      } else {
        unmatchedJson.push(ext);
      }
    });

    // Find matched extensions
    const matched = Array.from(jsonNormalized).filter((ext) =>
      this.manualExtensions.has(ext)
    );

    // Find unmatched in JSON
    jsonNormalized.forEach((ext) => {
      if (!this.manualExtensions.has(ext)) {
        unmatchedJson.push(ext);
      }
    });

    // Find unmatched in manual
    this.manualExtensions.forEach((ext) => {
      if (!jsonNormalized.has(ext)) {
        unmatchedManual.push(ext);
      }
    });

    return {
      matched: matched.sort(),
      onlyInJson: unmatchedJson.sort(),
      onlyInManual: unmatchedManual.sort(),
      totalMatched: matched.length,
      totalOnlyInJson: unmatchedJson.length,
      totalOnlyInManual: unmatchedManual.length,
    };
  }

  /**
   * Get all extensions found in the manual
   */
  getManualExtensions() {
    return Array.from(this.manualExtensions).sort();
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      totalInManual: this.manualExtensions.size,
    };
  }
}

module.exports = CrossReferencer;
