# RISC-V Instruction Set Explorer

This repository contains a CLI tool that completes the RISC-V Mentorship Coding Challenge (Tiers 1–3).

Summary

- Tier 1: Parse `instr_dict.json` and group instructions by extension; produce a summary table and list multi-extension instructions.
- Tier 2: Scan the local `riscv-isa-manual` AsciiDoc sources, normalize extension names, and cross-reference them with the JSON catalog.
- Tier 3 (bonus): Generate a relationship graph showing extensions that share instructions (ASCII, GraphML, Mermaid).

Repository layout

- `src/` — implementation modules and CLI
  - `parser.js`, `normalizer.js`, `crossReference.js`, `graphGenerator.js`, `index.js`
- `tests/` — Jest unit tests (all passing)
- `riscv-extensions-landscape/src/instr_dict.json` — canonical instruction dictionary (sourced from the landscape repo)
- `riscv-isa-manual/` — cloned RISC-V ISA manual (AsciiDoc sources) — expected to be present locally
- `output/` — generated output files after running the analysis

Prerequisites

- Node.js 16+ and npm

Install

```bash
cd riscv-instruction-set-explorer
npm install
```

Run unit tests

```bash
npm test
```

Run the analysis (generate outputs)

```bash
# from project root
node src/index.js
# or via npm start
npm start
```

Generated outputs (in `output/`)

- `summary.txt` — Tier 1: extension counts and multi-extension list
- `crossreference.txt` — Tier 2: matched vs only-in-JSON vs only-in-manual lists
- `graph.txt` — Tier 3: ASCII relationship graph + top shared pairs
- `graph.graphml` — GraphML for visualization tools
- `graph.mermaid` — Mermaid diagram

Sample output excerpt (top of `output/summary.txt`):

```
INSTRUCTION SET SUMMARY
========================

Extension Tag | Instruction Count | Example Mnemonic
------ | ------ | ------
rv_a | 11 | AMOADD.W
rv_c | 23 | C.ADD
rv_c_d | 4 | C.FLD
rv_d | 26 | FADD.D
rv_d_zfa | 8 | FCVTMOD.W.D
```

Implementation notes and assumptions

- The tool expects both `riscv-extensions-landscape` and `riscv-isa-manual` directories to be present under the project root. You mentioned these repos are already cloned.
- `src/normalizer.js` implements a normalization mapping that handles common `rv_*` and `RV32I`/`RV64I` naming variants; it can be extended for additional variants.
- The cross-reference step normalizes tokens extracted from AsciiDoc and filters them to known canonical names to reduce false positives (e.g., headings or author names being misinterpreted).
- `graphlib` is used by `src/graphGenerator.js` to construct graphs; keep the dependency if you want graph outputs.
