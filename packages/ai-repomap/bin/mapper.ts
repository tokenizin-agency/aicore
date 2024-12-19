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
 * @property {string[]} properties - The properties defined in the class
 * @property {string[]} methods - The methods defined in the class
 * @property {string} extends - The name of the superclass if any
 */
interface SymbolInfo {
  name: string;
  kind: string;
  properties?: string[];
  methods?: string[];
  extends?: string;
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
 * @property {string[]} jsxElements - Array of custom JSX element names used in the file
 */
interface FileInfo {
  file: string;
  symbols?: SymbolInfo[];
  imports?: (string | ImportInfo)[];
  hasJsx?: boolean;
  jsxElements?: string[];
}

const IGNORE_DIRS = new Set(["node_modules", ".git"]);
const ROOT_DIR = ".";
const WEB_ELEMENTS = new Set([
  "div",
  "span",
  "p",
  "a",
  "button",
  "input",
  "form",
  "img",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "table",
  "tr",
  "td",
  "th",
  "nav",
  "header",
  "footer",
  "main",
  "section",
  "article",
  "aside",
  "label",
  "select",
  "option",
  "textarea",
  "br",
  "hr",
  "canvas",
  "svg",
  "path",
  "circle",
  "rect",
  "video",
  "audio",
  "source",
  "iframe",
  "script",
  "style",
  "link",
  "meta",
  "title",
  "head",
  "body",
  "html",
]);

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
  const jsxElements = new Set<string>();

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
          const classInfo: SymbolInfo = { name: className, kind: "class" };

          // Get superclass if exists
          const heritage = node.children.find(
            (n: any) => n.type === "class_heritage"
          );
          if (heritage) {
            const superclass = heritage.children
              .find((n: any) => n.type === "extends_clause")
              ?.children.find((n: any) => n.type === "identifier")?.text;
            if (superclass) {
              classInfo.extends = superclass;
            }
          }

          // Get class body
          const body = node.children.find((n: any) => n.type === "class_body");
          if (body) {
            const properties: string[] = [];
            const methods: string[] = [];

            // Process class members
            for (let i = 0; i < body.childCount; i++) {
              const member = body.child(i);
              if (!member) continue;

              switch (member.type) {
                case "method_definition":
                  const methodName = member.children.find(
                    (n: any) => n.type === "property_identifier"
                  )?.text;
                  if (methodName) methods.push(methodName);
                  break;

                case "public_field_definition":
                case "private_field_definition":
                  const fieldName = member.children.find(
                    (n: any) => n.type === "property_identifier"
                  )?.text;
                  if (fieldName) properties.push(fieldName);
                  break;

                case "class_declaration":
                  // Recursively process nested classes
                  processNode(member);
                  break;
              }
            }

            if (properties.length > 0) classInfo.properties = properties;
            if (methods.length > 0) classInfo.methods = methods;
          }

          symbols.push(classInfo);
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
        hasJsx = true;
        const elementName = node.children[0]?.children[0]?.text;
        if (elementName && !WEB_ELEMENTS.has(elementName.toLowerCase())) {
          jsxElements.add(elementName);
        }
        break;

      case "jsx_self_closing_element":
        hasJsx = true;
        const selfClosingName = node.children[0]?.text;
        if (
          selfClosingName &&
          !WEB_ELEMENTS.has(selfClosingName.toLowerCase())
        ) {
          jsxElements.add(selfClosingName);
        }
        break;

      case "jsx_fragment":
        hasJsx = true;
        break;
    }

    // Recursively check children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        processNode(child);
      }
    }
  }

  // Process all top-level nodes
  processNode(rootNode);

  const result: FileInfo = { file: filePath };
  if (symbols.length > 0) result.symbols = symbols;
  if (imports.length > 0) result.imports = imports;
  if (hasJsx) {
    result.hasJsx = true;
    if (jsxElements.size > 0) {
      result.jsxElements = Array.from(jsxElements);
    }
  }

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
const allCustomElements = new Set<string>();

for (const file of getJSFiles(ROOT_DIR)) {
  const fileInfo = parseFile(file);
  const hasContent =
    (fileInfo.symbols && fileInfo.symbols.length > 0) ||
    (fileInfo.imports && fileInfo.imports.length > 0) ||
    (fileInfo.jsxElements && fileInfo.jsxElements.length > 0);

  if (hasContent) {
    results.push(fileInfo);
    if (fileInfo.jsxElements) {
      fileInfo.jsxElements.forEach((element) => allCustomElements.add(element));
    }
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
    customJsxElements: Array.from(allCustomElements),
    files: results,
  },
};

// Output results as minified JSON
process.stdout.write(JSON.stringify(output));
