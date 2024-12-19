declare module "tree-sitter" {
  export default class Parser {
    setLanguage(language: any): void;
    parse(input: string): {
      rootNode: any;
    };
  }
}

declare module "tree-sitter-javascript" {
  const JavaScript: any;
  export default JavaScript;
}

declare module "tree-sitter-typescript" {
  const TypeScript: {
    typescript: any;
    tsx: any;
  };
  export default TypeScript;
}
