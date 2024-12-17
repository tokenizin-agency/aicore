#!/usr/bin/env node

import { readdirSync, readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import { execSync } from "child_process";

/**
 * Represents information about a symbol (function or class) found in the code
 * @interface SymbolInfo
 * @property {string} name - The name of the symbol
 * @property {string} kind - The type of the symbol ('function' or 'class')
 */
interface SymbolInfo {
  name: string;
  kind: string;
}

/**
 * Represents information about an import statement found in the code
 * @interface ImportInfo
 * @property {string} source - The source module of the import statement
 * @property {string[]} specifiers - Array of imported specifiers
 */
interface ImportInfo {
  source: string;
  specifiers?: string[];
}

/**
 * Represents information about a file and its contained symbols
 * @interface FileInfo
 * @property {string} file - The path to the file relative to ROOT_DIR
 * @property {SymbolInfo[]} symbols - Array of symbols found in the file
 * @property {ImportInfo[]} imports - Array of import statements found in the file
 * @property {boolean} hasJsx - Indicates if the file contains JSX elements
 */
interface FileInfo {
  file: string;
  symbols?: SymbolInfo[];
  imports?: (string | ImportInfo)[];
  hasJsx?: boolean;
}

const IGNORE_DIRS = new Set(["node_modules", ".git"]);
const ROOT_DIR = ".";

const jsParser = new Parser();
jsParser.setLanguage(JavaScript);

const tsParser = new Parser();
tsParser.setLanguage(TypeScript.tsx);

/**
 * Recursively finds all JavaScript files (.js and .jsx) in a directory and its subdirectories
 * @param {string} dir - The directory to start searching from
 * @yields {string} Paths to JavaScript files relative to ROOT_DIR
 */
function* getJSFiles(dir: string): Generator<string> {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* getJSFiles(fullPath);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if ([".js", ".jsx", ".ts", ".tsx"].includes(ext)) {
        yield fullPath;
      }
    }
  }
}

/**
 * Parses a JavaScript file and extracts information about functions and classes
 * @param {string} filePath - Path to the JavaScript file to parse
 * @returns {FileInfo} Information about the file and its contained symbols
 */
function parseFile(filePath: string): FileInfo {
  const content = readFileSync(filePath, "utf8");
  const ext = extname(filePath).toLowerCase();
  const parser = [".ts", ".tsx"].includes(ext) ? tsParser : jsParser;
  const tree = parser.parse(content);
  const rootNode = tree.rootNode;
  const symbols: SymbolInfo[] = [];
  const imports: (string | ImportInfo)[] = [];
  let hasJsx = false;

  /**
   * Process a node in the AST to extract symbol information
   * @param {any} node - The AST node to process
   */
  function processNode(node: any) {
    switch (node.type) {
      case "function_declaration":
        const funcName = node.children.find(
          (n: any) => n.type === "identifier"
        )?.text;
        if (funcName) {
          symbols.push({ name: funcName, kind: "function" });
        }
        break;

      case "lexical_declaration":
        const declarator = node.children.find(
          (n: any) => n.type === "variable_declarator"
        );
        if (declarator) {
          const name = declarator.children.find(
            (n: any) => n.type === "identifier"
          )?.text;
          const value = declarator.children.find(
            (n: any) => n.type === "arrow_function" || n.type === "function"
          );
          if (name && value) {
            symbols.push({ name, kind: "function" });
          }
        }
        break;

      case "export_statement":
        const declaration = node.children.find((n: any) =>
          [
            "lexical_declaration",
            "function_declaration",
            "class_declaration",
          ].includes(n.type)
        );
        if (declaration) {
          processNode(declaration);
        }
        break;

      case "class_declaration":
        const className = node.children.find(
          (n: any) => n.type === "identifier"
        )?.text;
        if (className) {
          symbols.push({ name: className, kind: "class" });
        }
        break;

      case "import_statement":
        const source = node.children
          .find((n: any) => n.type === "string")
          ?.text?.slice(1, -1);
        if (source) {
          const specifiers = node.children
            .filter((n: any) => n.type === "import_specifier")
            .map(
              (spec: any) =>
                spec.children.find((n: any) => n.type === "identifier")?.text
            )
            .filter(Boolean);
          if (specifiers.length > 0) {
            imports.push({ source, specifiers });
          } else {
            imports.push(source);
          }
        }
        break;

      case "call_expression":
        if (node.children[0]?.text === "require") {
          const arg = node.children[1]?.children[0];
          if (arg?.type === "string") {
            imports.push(arg.text.slice(1, -1));
          }
        }
        break;

      case "jsx_element":
      case "jsx_self_closing_element":
      case "jsx_fragment":
        hasJsx = true;
        break;
    }

    // Recursively check children for JSX
    if (!hasJsx) {
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
          processNode(child);
        }
      }
    }
  }

  // Process all top-level nodes
  processNode(rootNode);

  const result: FileInfo = { file: filePath };
  if (symbols.length > 0) result.symbols = symbols;
  if (imports.length > 0) result.imports = imports;
  if (hasJsx) result.hasJsx = true;

  return result;
}

/**
 * Gets Git repository information if available
 * @returns {Object} Git repository metadata
 */
function getGitInfo() {
  try {
    // Check if git repo exists first
    execSync("git rev-parse --git-dir", { stdio: "ignore" });

    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    const remoteUrl = execSync("git config --get remote.origin.url", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    const lastCommit = execSync("git log -1 --format=%H", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    const authorName = execSync("git config user.name", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    const authorEmail = execSync("git config user.email", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();

    return {
      branch,
      remoteUrl,
      lastCommit,
      author: { name: authorName, email: authorEmail },
    };
  } catch {
    return null;
  }
}

/**
 * Gets package.json content if available
 * @returns {Object|null} Package.json content or null
 */
function getPackageJson() {
  try {
    const packagePath = join(ROOT_DIR, "package.json");
    return existsSync(packagePath)
      ? JSON.parse(readFileSync(packagePath, "utf8"))
      : null;
  } catch {
    return null;
  }
}

// Process all JavaScript files and collect results
const results: FileInfo[] = [];
let hasReactFiles = false;

for (const file of getJSFiles(ROOT_DIR)) {
  const fileInfo = parseFile(file);
  const hasContent =
    (fileInfo.symbols && fileInfo.symbols.length > 0) ||
    (fileInfo.imports && fileInfo.imports.length > 0);

  if (hasContent) {
    results.push(fileInfo);
    if (
      fileInfo.hasJsx ||
      fileInfo.imports?.some((imp) =>
        typeof imp === "string"
          ? imp.includes("react")
          : imp.source.includes("react")
      )
    ) {
      hasReactFiles = true;
    }
  }
}

// Create final output with project metadata
const output = {
  timestamp: new Date().toISOString(),
  project: {
    git: getGitInfo(),
    package: getPackageJson(),
    hasReact: hasReactFiles,
    files: results,
  },
};

// Output results as minified JSON wrapped in markdown
// console.log("```json");
process.stdout.write(JSON.stringify(output));
// console.log("```");
