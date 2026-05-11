const Graph = require('graphlib').Graph;

/**
 * Graph generator for RISC-V extension relationships
 * Creates graphs showing which extensions share instructions
 */

class GraphGenerator {
  constructor(extensionGroups) {
    this.extensionGroups = extensionGroups;
    this.graph = new Graph();
    this.sharedInstructions = {};
  }

  /**
   * Build a graph where edges connect extensions that share instructions
   */
  buildGraph() {
    // Add all extensions as nodes
    Object.keys(this.extensionGroups).forEach((ext) => {
      this.graph.setNode(ext, { label: ext });
    });

    // Find shared instructions
    this.findSharedInstructions();

    // Add edges for shared instructions
    const processedPairs = new Set();

    Object.entries(this.sharedInstructions).forEach(([pair, count]) => {
      if (!processedPairs.has(pair)) {
        const [ext1, ext2] = pair.split('|');
        this.graph.setEdge(ext1, ext2, {
          label: count,
          weight: count,
        });
        processedPairs.add(pair);
        processedPairs.add(`${ext2}|${ext1}`);
      }
    });

    return this.graph;
  }

  /**
   * Find instructions shared between extensions
   */
  findSharedInstructions() {
    const instructionToExtensions = {};

    // Build inverse mapping: instruction -> extensions
    Object.entries(this.extensionGroups).forEach(([ext, instructions]) => {
      instructions.forEach((instr) => {
        if (!instructionToExtensions[instr.mnemonic]) {
          instructionToExtensions[instr.mnemonic] = [];
        }
        instructionToExtensions[instr.mnemonic].push(ext);
      });
    });

    // Find shared instructions
    Object.entries(instructionToExtensions).forEach(([mnemonic, exts]) => {
      if (exts.length > 1) {
        // Multiple extensions share this instruction
        for (let i = 0; i < exts.length; i++) {
          for (let j = i + 1; j < exts.length; j++) {
            const [ext1, ext2] =
              exts[i] < exts[j] ? [exts[i], exts[j]] : [exts[j], exts[i]];
            const pairKey = `${ext1}|${ext2}`;

            if (!this.sharedInstructions[pairKey]) {
              this.sharedInstructions[pairKey] = 0;
            }
            this.sharedInstructions[pairKey]++;
          }
        }
      }
    });
  }

  /**
   * Get extensions with the most connections
   */
  getMostConnected(limit = 10) {
    const connectionCounts = {};

    this.graph.nodes().forEach((node) => {
      connectionCounts[node] = this.graph.neighbors(node).length;
    });

    return Object.entries(connectionCounts)
      .sort(([, countA], [, countB]) => countB - countA)
      .slice(0, limit)
      .map(([ext, count]) => ({ extension: ext, connections: count }));
  }

  /**
   * Generate a text-based ASCII representation of the graph
   * Shows top extensions and their relationships
   */
  generateAsciiGraph(maxNodes = 15) {
    const nodes = this.graph.nodes();
    if (nodes.length === 0) return 'No extensions found.';

    // Find nodes with most connections
    const nodeConnections = nodes.map((node) => ({
      node,
      degree: this.graph.neighbors(node).length,
    }));

    const topNodes = nodeConnections
      .sort((a, b) => b.degree - a.degree)
      .slice(0, maxNodes)
      .map((n) => n.node);

    // Build ASCII representation
    let output = 'EXTENSION RELATIONSHIP GRAPH\n';
    output += '=============================\n\n';
    output += `Top ${Math.min(maxNodes, topNodes.length)} most connected extensions:\n\n`;

    topNodes.forEach((node, index) => {
      const neighbors = this.graph.neighbors(node);
      const degree = neighbors.length;
      output += `${index + 1}. ${node} (${degree} connections)\n`;

      if (neighbors.length > 0) {
        neighbors.slice(0, 5).forEach((neighbor) => {
          const sharedCount = this.graph.edge(node, neighbor)?.weight || 0;
          output += `   ├─ ${neighbor} (${sharedCount} shared)\n`;
        });

        if (neighbors.length > 5) {
          output += `   └─ ... and ${neighbors.length - 5} more\n`;
        }
      }

      output += '\n';
    });

    return output;
  }

  /**
   * Generate GraphML format for visualization in external tools
   */
  generateGraphML() {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n';
    xml += '  <graph edgedefault="undirected">\n';

    // Add nodes
    this.graph.nodes().forEach((node) => {
      xml += `    <node id="${this.escapeXml(node)}" />\n`;
    });

    // Add edges
    this.graph.edges().forEach((edge) => {
      const weight = this.graph.edge(edge)?.weight || 1;
      xml += `    <edge source="${this.escapeXml(edge.v)}" target="${this.escapeXml(edge.w)}" weight="${weight}" />\n`;
    });

    xml += '  </graph>\n';
    xml += '</graphml>\n';

    return xml;
  }

  /**
   * Generate Mermaid diagram format
   */
  generateMermaidDiagram(maxNodes = 15) {
    const nodes = this.graph.nodes();
    if (nodes.length === 0) return '';

    // Find nodes with most connections
    const nodeConnections = nodes.map((node) => ({
      node,
      degree: this.graph.neighbors(node).length,
    }));

    const topNodes = nodeConnections
      .sort((a, b) => b.degree - a.degree)
      .slice(0, maxNodes)
      .map((n) => n.node);

    const topNodesSet = new Set(topNodes);

    let mermaid = 'graph TD\n';

    // Add edges between top nodes
    const processedEdges = new Set();

    topNodes.forEach((node) => {
      const neighbors = this.graph.neighbors(node);
      neighbors.forEach((neighbor) => {
        if (topNodesSet.has(neighbor)) {
          const edgeKey = [node, neighbor].sort().join('|');
          if (!processedEdges.has(edgeKey)) {
            const weight = this.graph.edge(node, neighbor)?.weight || 1;
            mermaid += `  ${this.sanitizeId(node)} -->|${weight}| ${this.sanitizeId(neighbor)}\n`;
            processedEdges.add(edgeKey);
          }
        }
      });
    });

    return mermaid;
  }

  /**
   * Get detailed statistics about the graph
   */
  getStatistics() {
    const nodes = this.graph.nodes();
    const edges = this.graph.edges();

    const degrees = nodes.map((n) => this.graph.neighbors(n).length);

    return {
      totalExtensions: nodes.length,
      totalConnections: edges.length,
      avgDegree: (degrees.reduce((a, b) => a + b, 0) / nodes.length).toFixed(2),
      maxDegree: Math.max(...degrees),
      minDegree: Math.min(...degrees),
      isolatedExtensions: degrees.filter((d) => d === 0).length,
      mostConnected: this.getMostConnected(1)[0],
    };
  }

  /**
   * Get pairs of extensions with most shared instructions
   */
  getTopSharedPairs(limit = 20) {
    return Object.entries(this.sharedInstructions)
      .map(([pair, count]) => {
        const [ext1, ext2] = pair.split('|');
        return { ext1, ext2, sharedInstructions: count };
      })
      .sort((a, b) => b.sharedInstructions - a.sharedInstructions)
      .slice(0, limit);
  }

  /**
   * Escape XML special characters
   */
  escapeXml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Sanitize ID for Mermaid diagrams
   */
  sanitizeId(str) {
    return String(str)
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^(\d)/, 'ext_$1');
  }
}

module.exports = GraphGenerator;
