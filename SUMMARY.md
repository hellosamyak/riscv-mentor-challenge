RISC-V Instruction Set Explorer — Submission Summary

Files included

- `src/` : analysis code
  - `parser.js` : parses instr_dict.json and groups by extension
  - `normalizer.js` : normalizes extension names between sources
  - `crossReference.js` : scans the ISA manual and cross-references extensions
  - `graphGenerator.js` : builds extension relationship graphs
  - `index.js` : orchestration CLI (run analysis and write outputs)
- `tests/` : Jest unit tests (all pass)
- `riscv-extensions-landscape/src/instr_dict.json` : canonical instruction dictionary (source provided)
- `riscv-isa-manual/` : cloned ISA manual (AsciiDoc sources) — expected to be present locally
- `output/` : generated outputs (summary, crossreference, graph files)

How to reproduce

1. Ensure `riscv-extensions-landscape` and `riscv-isa-manual` folders are present in the project root.
2. Install dependencies: `npm install`.
3. Run tests: `npm test` (should pass).
4. Run the analysis: `node src/index.js` (or `npm start`). Outputs will appear in `output/`.

Generated sample outputs (already in this repo under `output/`):

- `output/summary.txt` — instruction counts grouped by extension
- `output/crossreference.txt` — matched and unmatched extension lists (normalized)
- `output/graph.txt` — ASCII relationship graph + top shared pairs

Notes

- Normalization and cross-referencing are heuristic; manual reconciliation may be required for edge-case names.
- Unit tests exercise the major parsing and normalization paths.
