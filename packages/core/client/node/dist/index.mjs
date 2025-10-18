// src/soroban-generator.ts
import { spawn, execSync } from "child_process";
import * as path from "path";
import * as fs from "fs/promises";
import * as os from "os";
var SorobanGenerator = class {
  pythonPath;
  generatorPath;
  projectRoot;
  constructor(projectRoot) {
    this.pythonPath = this.findPython();
    this.projectRoot = projectRoot || path.join(__dirname, "../../");
    this.generatorPath = path.join(this.projectRoot, "src", "generate.py");
  }
  findPython() {
    const pythonCommands = ["python3", "python"];
    for (const cmd of pythonCommands) {
      try {
        const version = execSync(`${cmd} --version`, { encoding: "utf8" });
        if (version.includes("Python 3")) {
          return cmd;
        }
      } catch {
      }
    }
    throw new Error("Python 3 not found. Please install Python 3.");
  }
  /**
   * Generate flashcards and return PDF as Buffer
   */
  async generate(config) {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "soroban-"));
    const outputPath = path.join(tempDir, "flashcards.pdf");
    try {
      const args = [
        this.generatorPath,
        "--output",
        outputPath,
        "--range",
        config.range
      ];
      if (config.step)
        args.push("--step", config.step.toString());
      if (config.cardsPerPage)
        args.push("--cards-per-page", config.cardsPerPage.toString());
      if (config.paperSize)
        args.push("--paper-size", config.paperSize);
      if (config.orientation)
        args.push("--orientation", config.orientation);
      if (config.gutter)
        args.push("--gutter", config.gutter);
      if (config.shuffle)
        args.push("--shuffle");
      if (config.seed !== void 0)
        args.push("--seed", config.seed.toString());
      if (config.showCutMarks)
        args.push("--cut-marks");
      if (config.showRegistration)
        args.push("--registration");
      if (config.fontFamily)
        args.push("--font-family", config.fontFamily);
      if (config.fontSize)
        args.push("--font-size", config.fontSize);
      if (config.columns !== void 0)
        args.push("--columns", config.columns.toString());
      if (config.showEmptyColumns)
        args.push("--show-empty-columns");
      if (config.hideInactiveBeads)
        args.push("--hide-inactive-beads");
      if (config.beadShape)
        args.push("--bead-shape", config.beadShape);
      if (config.colorScheme)
        args.push("--color-scheme", config.colorScheme);
      if (config.coloredNumerals)
        args.push("--colored-numerals");
      if (config.scaleFactor !== void 0)
        args.push("--scale-factor", config.scaleFactor.toString());
      if (config.margins) {
        const m = config.margins;
        const marginStr = `${m.top || "0.5in"},${m.right || "0.5in"},${m.bottom || "0.5in"},${m.left || "0.5in"}`;
        args.push("--margins", marginStr);
      }
      await this.executePython(args);
      const pdfBuffer = await fs.readFile(outputPath);
      return pdfBuffer;
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
  /**
   * Generate flashcards and save to file
   */
  async generateToFile(config, outputPath) {
    const pdfBuffer = await this.generate(config);
    await fs.writeFile(outputPath, pdfBuffer);
  }
  /**
   * Generate flashcards and return as base64 string
   */
  async generateBase64(config) {
    const pdfBuffer = await this.generate(config);
    return pdfBuffer.toString("base64");
  }
  executePython(args) {
    return new Promise((resolve, reject) => {
      const childProcess = spawn(this.pythonPath, args, {
        cwd: this.projectRoot,
        env: { ...process.env, PYTHONPATH: this.projectRoot }
      });
      let stderr = "";
      childProcess.stderr.on("data", (data) => {
        stderr += data.toString();
      });
      childProcess.on("close", (code) => {
        if (code !== 0) {
          reject(
            new Error(`Python process failed with code ${code}: ${stderr}`)
          );
        } else {
          resolve();
        }
      });
      childProcess.on("error", (err) => {
        reject(new Error(`Failed to start Python process: ${err.message}`));
      });
    });
  }
  /**
   * Check if all dependencies are installed
   */
  async checkDependencies() {
    const checks = {
      python: false,
      typst: false,
      qpdf: false
    };
    try {
      execSync(`${this.pythonPath} --version`);
      checks.python = true;
    } catch {
    }
    try {
      execSync("typst --version");
      checks.typst = true;
    } catch {
    }
    try {
      execSync("qpdf --version");
      checks.qpdf = true;
    } catch {
    }
    return checks;
  }
};
async function expressExample() {
  const generator = new SorobanGenerator();
}
export {
  SorobanGenerator,
  SorobanGenerator as default,
  expressExample
};
