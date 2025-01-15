#!/usr/bin/env node

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import { execSync } from 'child_process';

/**
 * Represents information about a symbol (function or class) found in the code
 * @interface SymbolInfo
 * @property {string} name - The name of the symbol
 * @property {string} kind - The type of the symbol ('function' or 'class')
 * @property {string[]} properties - The properties defined in the class
 * @property {string[]} methods - The methods defined in the class
 * @property {string} extends - The name of the superclass if any
 * @property {boolean} isWidget - For Flutter widgets
 * @property {boolean} isStateful - For Flutter stateful widgets
 * @property {boolean} isStateless - For Flutter stateless widgets
 * @property {string} androidComponent - For Android components (Activity, Fragment, etc.)
 * @property {string} stateManagement - Tracks state management solution used
 * @property {boolean} hasTests - Indicates if tests exist
 * @property {string[]} annotations - Tracks important Dart annotations
 * @property {string[]} dependencies - Tracks package dependencies
 */
interface SymbolInfo {
  name: string;
  kind: string;
  properties?: string[];
  methods?: string[];
  extends?: string;
  isWidget?: boolean; // For Flutter widgets
  isStateful?: boolean; // For Flutter stateful widgets
  isStateless?: boolean; // For Flutter stateless widgets
  androidComponent?: string; // For Android components (Activity, Fragment, etc.)
  stateManagement?: string; // Added: tracks state management solution used
  hasTests?: boolean; // Added: indicates if tests exist
  annotations?: string[]; // Added: tracks important Dart annotations
  dependencies?: string[]; // Added: tracks package dependencies
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
 * @property {boolean} isDartFile - Indicates if the file is a Dart file
 * @property {boolean} isFlutterFile - Indicates if the file is a Flutter file
 * @property {boolean} isAndroidFile - Indicates if the file is an Android file
 * @property {Object} androidManifest - Android manifest metadata
 * @property {boolean} isTestFile - Indicates if the file is a test
 * @property {boolean} hasWidgetTests - Indicates if the file contains widget tests
 * @property {string} statePattern - Dominant state management pattern
 */
interface FileInfo {
  file: string;
  symbols?: SymbolInfo[];
  imports?: (string | ImportInfo)[];
  hasJsx?: boolean;
  jsxElements?: string[];
  isDartFile?: boolean;
  isFlutterFile?: boolean;
  isAndroidFile?: boolean;
  androidManifest?: {
    package?: string;
    components?: string[];
  };
  isTestFile?: boolean; // Added: indicates if file is a test
  hasWidgetTests?: boolean; // Added: indicates if file contains widget tests
  statePattern?: string; // Added: dominant state management pattern
}

const IGNORE_DIRS = new Set(['node_modules', '.git', 'build', '.dart_tool', '.pub-cache']);
const ROOT_DIR = '.';

// Add Flutter/Dart specific elements
const FLUTTER_WIDGETS = new Set([
  // Core Widgets
  'Widget',
  'StatelessWidget',
  'StatefulWidget',
  // Material Components
  'MaterialApp',
  'Scaffold',
  'AppBar',
  'Container',
  'Row',
  'Column',
  'Text',
  'ListView',
  'Stack',
  'Card',
  'ListTile',
  'FloatingActionButton',
  'BottomNavigationBar',
  'Drawer',
  'SnackBar',
  'AlertDialog',
  'TextField',
  'ElevatedButton',
  'TextButton',
  'IconButton',
  'OutlinedButton',
  // Layout Widgets
  'Padding',
  'Center',
  'Align',
  'SizedBox',
  'Expanded',
  'Flexible',
  'Wrap',
  'GridView',
  'CustomScrollView',
  'SingleChildScrollView',
  // Navigation
  'Navigator',
  'Route',
  'MaterialPageRoute',
  'CupertinoPageRoute',
  // State Management
  'ChangeNotifier',
  'ValueNotifier',
  'StreamBuilder',
  'FutureBuilder',
  // Animation
  'AnimationController',
  'Animation',
  'Tween',
  'AnimatedBuilder',
  // Async
  'FutureBuilder',
  'StreamBuilder',
  // Gestures
  'GestureDetector',
  'InkWell',
  'DragTarget',
  'Draggable',
  // Media
  'Image',
  'Icon',
  'AssetImage',
  'NetworkImage',
]);

// Add common Dart/Flutter patterns
const DART_PATTERNS = {
  stateManagement: new Set([
    'ChangeNotifier',
    'ValueNotifier',
    'StreamController',
    'BehaviorSubject',
    'Store',
    'Cubit',
    'Bloc',
    'StateNotifier',
    'ChangeNotifierProvider',
    'Provider',
    'GetxController',
    'MobXStore',
    'Riverpod',
  ]),
  testing: new Set([
    'test',
    'testWidgets',
    'group',
    'setUp',
    'tearDown',
    'expect',
    'tester',
    'WidgetTester',
    'MockClient',
  ]),
  annotations: new Set([
    '@immutable',
    '@required',
    '@override',
    '@visibleForTesting',
    '@protected',
    '@mustCallSuper',
    '@factory',
    '@HiveType',
    '@JsonSerializable',
  ]),
};

// Add Android specific components
const ANDROID_COMPONENTS = new Set([
  'Activity',
  'Fragment',
  'Service',
  'BroadcastReceiver',
  'ContentProvider',
  'Application',
]);

const WEB_ELEMENTS = new Set([
  'div',
  'span',
  'p',
  'a',
  'button',
  'input',
  'form',
  'img',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'table',
  'tr',
  'td',
  'th',
  'nav',
  'header',
  'footer',
  'main',
  'section',
  'article',
  'aside',
  'label',
  'select',
  'option',
  'textarea',
  'br',
  'hr',
  'canvas',
  'svg',
  'path',
  'circle',
  'rect',
  'video',
  'audio',
  'source',
  'iframe',
  'script',
  'style',
  'link',
  'meta',
  'title',
  'head',
  'body',
  'html',
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
      if (['.js', '.jsx', '.ts', '.tsx', '.dart', '.java', '.kt', '.xml'].includes(ext)) {
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
  const content = readFileSync(filePath, 'utf8');
  const ext = extname(filePath).toLowerCase();
  const parser = ['.ts', '.tsx'].includes(ext) ? tsParser : jsParser;
  const fileInfo: FileInfo = {
    file: filePath,
    symbols: [],
    imports: [],
    isDartFile: ext === '.dart',
    isFlutterFile: ext === '.dart' && content.includes('package:flutter'),
    isAndroidFile: ['.java', '.kt', '.xml'].includes(ext),
  };

  // Handle Android manifest files
  if (filePath.endsWith('AndroidManifest.xml')) {
    fileInfo.androidManifest = parseAndroidManifest(content);
    return fileInfo;
  }

  // Handle Dart/Flutter files
  if (fileInfo.isDartFile) {
    return parseDartFile(filePath, content, fileInfo);
  }

  // Handle Android Java/Kotlin files
  if (fileInfo.isAndroidFile && ext !== '.xml') {
    return parseAndroidFile(filePath, content, fileInfo);
  }

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
      case 'function_declaration':
        const funcName = node.children.find((n: any) => n.type === 'identifier')?.text;
        if (funcName) {
          symbols.push({ name: funcName, kind: 'function' });
        }
        break;

      case 'lexical_declaration':
        const declarator = node.children.find((n: any) => n.type === 'variable_declarator');
        if (declarator) {
          const name = declarator.children.find((n: any) => n.type === 'identifier')?.text;
          const value = declarator.children.find(
            (n: any) => n.type === 'arrow_function' || n.type === 'function'
          );
          if (name && value) {
            symbols.push({ name, kind: 'function' });
          }
        }
        break;

      case 'export_statement':
        const declaration = node.children.find((n: any) =>
          ['lexical_declaration', 'function_declaration', 'class_declaration'].includes(n.type)
        );
        if (declaration) {
          processNode(declaration);
        }
        break;

      case 'class_declaration':
        const className = node.children.find((n: any) => n.type === 'identifier')?.text;

        if (className) {
          const classInfo: SymbolInfo = { name: className, kind: 'class' };

          // Get superclass if exists
          const heritage = node.children.find((n: any) => n.type === 'class_heritage');
          if (heritage) {
            const superclass = heritage.children
              .find((n: any) => n.type === 'extends_clause')
              ?.children.find((n: any) => n.type === 'identifier')?.text;
            if (superclass) {
              classInfo.extends = superclass;
            }
          }

          // Get class body
          const body = node.children.find((n: any) => n.type === 'class_body');
          if (body) {
            const properties: string[] = [];
            const methods: string[] = [];

            // Process class members
            for (let i = 0; i < body.childCount; i++) {
              const member = body.child(i);
              if (!member) continue;

              switch (member.type) {
                case 'method_definition':
                  const methodName = member.children.find(
                    (n: any) => n.type === 'property_identifier'
                  )?.text;
                  if (methodName) methods.push(methodName);
                  break;

                case 'public_field_definition':
                case 'private_field_definition':
                  const fieldName = member.children.find(
                    (n: any) => n.type === 'property_identifier'
                  )?.text;
                  if (fieldName) properties.push(fieldName);
                  break;

                case 'class_declaration':
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

      case 'import_statement':
        const source = node.children.find((n: any) => n.type === 'string')?.text?.slice(1, -1);
        if (source) {
          const specifiers = node.children
            .filter((n: any) => n.type === 'import_specifier')
            .map((spec: any) => spec.children.find((n: any) => n.type === 'identifier')?.text)
            .filter(Boolean);
          if (specifiers.length > 0) {
            imports.push({ source, specifiers });
          } else {
            imports.push(source);
          }
        }
        break;

      case 'call_expression':
        if (node.children[0]?.text === 'require') {
          const arg = node.children[1]?.children[0];
          if (arg?.type === 'string') {
            imports.push(arg.text.slice(1, -1));
          }
        }
        break;

      case 'jsx_element':
        hasJsx = true;
        const elementName = node.children[0]?.children[0]?.text;
        if (elementName && !WEB_ELEMENTS.has(elementName.toLowerCase())) {
          jsxElements.add(elementName);
        }
        break;

      case 'jsx_self_closing_element':
        hasJsx = true;
        const selfClosingName = node.children[0]?.text;
        if (selfClosingName && !WEB_ELEMENTS.has(selfClosingName.toLowerCase())) {
          jsxElements.add(selfClosingName);
        }
        break;

      case 'jsx_fragment':
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

  if (symbols.length > 0) fileInfo.symbols = symbols;
  if (imports.length > 0) fileInfo.imports = imports;
  if (hasJsx) {
    fileInfo.hasJsx = true;
    if (jsxElements.size > 0) {
      fileInfo.jsxElements = Array.from(jsxElements);
    }
  }

  return fileInfo;
}

function parseDartFile(filePath: string, content: string, fileInfo: FileInfo): FileInfo {
  // Update file type detection
  fileInfo.isTestFile = filePath.includes('_test.dart') || filePath.includes('.test.dart');
  fileInfo.hasWidgetTests = content.includes('testWidgets(') || content.includes('WidgetTester');

  // Basic regex-based parsing for Dart files
  const classRegex =
    /class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+(\w+))?(?:\s+with\s+([^{]+))?/g;
  const annotationRegex = /@([a-zA-Z]+)/g;
  let match;

  while ((match = classRegex.exec(content)) !== null) {
    const [_, className, extendsClass, implementsClass, mixins] = match;
    const isWidget =
      FLUTTER_WIDGETS.has(extendsClass || '') ||
      content.includes(`class ${className} extends StatelessWidget`) ||
      content.includes(`class ${className} extends StatefulWidget`);
    const isStateless = content.includes(`class ${className} extends StatelessWidget`);
    const isStateful = content.includes(`class ${className} extends StatefulWidget`);

    // Detect state management pattern
    const stateManagement = Array.from(DART_PATTERNS.stateManagement).find(
      (pattern) => content.includes(pattern) || (extendsClass && extendsClass.includes(pattern))
    );

    // Collect annotations
    const annotations: string[] = [];
    let annotationMatch;
    while ((annotationMatch = annotationRegex.exec(content)) !== null) {
      if (DART_PATTERNS.annotations.has(`@${annotationMatch[1]}`)) {
        annotations.push(`@${annotationMatch[1]}`);
      }
    }

    fileInfo.symbols?.push({
      name: className,
      kind: 'class',
      extends: extendsClass,
      isWidget,
      isStateless,
      isStateful,
      stateManagement,
      annotations: annotations.length > 0 ? annotations : undefined,
      dependencies: getDartDependencies(content),
    });
  }

  // Parse imports and update state pattern
  const importRegex = /import\s+['"]([^'"]+)['"]/g;
  const statePatterns = new Set<string>();

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    fileInfo.imports?.push({ source: importPath, specifiers: [] });

    // Detect state management from imports
    if (importPath.includes('provider')) statePatterns.add('Provider');
    if (importPath.includes('bloc')) statePatterns.add('BLoC');
    if (importPath.includes('get')) statePatterns.add('GetX');
    if (importPath.includes('mobx')) statePatterns.add('MobX');
    if (importPath.includes('riverpod')) statePatterns.add('Riverpod');
  }

  if (statePatterns.size > 0) {
    fileInfo.statePattern = Array.from(statePatterns).join(', ');
  }

  return fileInfo;
}

function getDartDependencies(content: string): string[] {
  const deps = new Set<string>();
  const importRegex = /import\s+['"]package:([^\/'"]+)/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    deps.add(match[1]);
  }

  return Array.from(deps);
}

function parseAndroidFile(filePath: string, content: string, fileInfo: FileInfo): FileInfo {
  // Basic regex-based parsing for Android files
  const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?/g;
  let match;

  while ((match = classRegex.exec(content)) !== null) {
    const [_, className, extendsClass] = match;
    const androidComponent = ANDROID_COMPONENTS.has(extendsClass || '') ? extendsClass : undefined;

    fileInfo.symbols?.push({
      name: className,
      kind: 'class',
      extends: extendsClass,
      androidComponent,
    });
  }

  return fileInfo;
}

function parseAndroidManifest(content: string): { package?: string; components?: string[] } {
  const result = {
    package: undefined as string | undefined,
    components: [] as string[],
  };

  // Basic XML parsing for manifest
  const packageMatch = content.match(/package="([^"]+)"/);
  if (packageMatch) {
    result.package = packageMatch[1];
  }

  // Find Android components
  const componentRegex = /android:name="([^"]+)"/g;
  let match;
  while ((match = componentRegex.exec(content)) !== null) {
    result.components.push(match[1]);
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
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });

    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    const remoteUrl = execSync('git config --get remote.origin.url', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    const lastCommit = execSync('git log -1 --format=%H', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    const authorName = execSync('git config user.name', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    const authorEmail = execSync('git config user.email', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
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
    const packagePath = join(ROOT_DIR, 'package.json');
    return existsSync(packagePath) ? JSON.parse(readFileSync(packagePath, 'utf8')) : null;
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
        typeof imp === 'string' ? imp.includes('react') : imp.source.includes('react')
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
