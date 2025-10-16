"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  SorobanGenerator: () => SorobanGenerator,
  SorobanGeneratorBridge: () => SorobanGenerator2,
  default: () => SorobanGenerator,
  expressExample: () => expressExample
});
module.exports = __toCommonJS(src_exports);

// src/soroban-generator.ts
var import_child_process = require("child_process");
var path = __toESM(require("path"));
var fs = __toESM(require("fs/promises"));
var os = __toESM(require("os"));
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
        const version = (0, import_child_process.execSync)(`${cmd} --version`, { encoding: "utf8" });
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
      const childProcess = (0, import_child_process.spawn)(this.pythonPath, args, {
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
      (0, import_child_process.execSync)(`${this.pythonPath} --version`);
      checks.python = true;
    } catch {
    }
    try {
      (0, import_child_process.execSync)("typst --version");
      checks.typst = true;
    } catch {
    }
    try {
      (0, import_child_process.execSync)("qpdf --version");
      checks.qpdf = true;
    } catch {
    }
    return checks;
  }
};
async function expressExample() {
  const generator = new SorobanGenerator();
}

// src/soroban-generator-bridge.ts
var import_python_shell = require("python-shell");
var path2 = __toESM(require("path"));
var SorobanGenerator2 = class {
  pythonShell = null;
  projectRoot;
  constructor(projectRoot) {
    this.projectRoot = projectRoot || path2.join(__dirname, "../../");
  }
  /**
   * Initialize persistent Python process for better performance
   */
  async initialize() {
    if (this.pythonShell)
      return;
    this.pythonShell = new import_python_shell.PythonShell(path2.join("src", "bridge.py"), {
      mode: "json",
      pythonPath: "python3",
      pythonOptions: ["-u"],
      // Unbuffered
      scriptPath: this.projectRoot
    });
  }
  /**
   * Generate flashcards - clean function interface
   */
  async generate(config) {
    if (!this.pythonShell) {
      return new Promise((resolve, reject) => {
        const shell = new import_python_shell.PythonShell(path2.join("src", "bridge.py"), {
          mode: "json",
          pythonPath: "python3",
          scriptPath: this.projectRoot
        });
        shell.on("message", (message) => {
          if (message.error) {
            reject(new Error(message.error));
          } else {
            resolve(message);
          }
        });
        shell.on("error", (err) => {
          reject(err);
        });
        shell.send(config);
        shell.end((err, code, signal) => {
          if (err)
            reject(err);
        });
      });
    }
    return new Promise((resolve, reject) => {
      if (!this.pythonShell) {
        reject(new Error("Not initialized"));
        return;
      }
      const handler = (message) => {
        if (message.error) {
          reject(new Error(message.error));
        } else {
          resolve(message);
        }
        this.pythonShell?.removeListener("message", handler);
      };
      this.pythonShell.on("message", handler);
      this.pythonShell.send(config);
    });
  }
  /**
   * Generate and return as Buffer
   */
  async generateBuffer(config) {
    const result = await this.generate(config);
    return Buffer.from(result.pdf, "base64");
  }
  /**
   * Clean up Python process
   */
  async close() {
    if (this.pythonShell) {
      this.pythonShell.end(() => {
      });
      this.pythonShell = null;
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SorobanGenerator,
  SorobanGeneratorBridge,
  expressExample
});
