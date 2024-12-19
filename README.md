# 🤖 Tokenizin

<div align="center">

[![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-cc00ff.svg?style=for-the-badge&logo=pnpm)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/tokenizin-agency/tokenizin/ci.yml?branch=main&style=for-the-badge&label=CI)](https://github.com/tokenizin-agency/tokenizin/actions/workflows/ci.yml)
[![CodeQL](https://img.shields.io/github/actions/workflow/status/tokenizin-agency/tokenizin/codeql.yml?branch=main&style=for-the-badge&label=CodeQL)](https://github.com/tokenizin-agency/tokenizin/actions/workflows/codeql.yml)

</div>

A powerful monorepo of AI development tools designed to enhance your coding workflow. Built with TypeScript and modern best practices.

## 🚀 Features

- **Repository Analysis**: Deep analysis of JavaScript/TypeScript codebases
- **AI-Ready Output**: Structured JSON output perfect for LLM consumption
- **Fast & Efficient**: Built with performance in mind
- **TypeScript Support**: First-class TypeScript support with full type definitions

## 📦 Packages

| Package | Description | Version |
|---------|-------------|---------|
| [@tokenizin/ai-repomap](./packages/ai-repomap/) | Repository analyzer for AI tools | [![npm](https://img.shields.io/npm/v/@tokenizin/ai-repomap.svg?style=flat-square)](https://www.npmjs.com/package/@tokenizin/ai-repomap) |
| [@tokenizin/config](./packages/config/) | Shared configurations for TypeScript, ESLint, and Prettier | [![private](https://img.shields.io/badge/private-true-red.svg?style=flat-square)]() |

## 🛠️ Development

### Prerequisites

- Node.js >= 18
- pnpm >= 8

### Getting Started

```bash
# Clone the repository
git clone https://github.com/tokenizin-agency/tokenizin.git
cd tokenizin

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Available Scripts

```bash
# Build all packages
pnpm build

# Run tests
pnpm test

# Run linting
pnpm lint

# Format code
pnpm format

# Create a changeset
pnpm changeset

# Release packages
pnpm release
```

## 📖 Usage

### Repository Mapping

```bash
# Install globally
npm install -g @tokenizin/ai-repomap

# Run in any repository
tokenizin-repomap
```

The tool will analyze your repository and output a detailed JSON structure containing:
- File structure
- Function and class definitions
- Import/export relationships
- JSX usage detection
- Git metadata

## 🤝 Security

Please see our [Security Policy](./SECURITY.md) for reporting vulnerabilities.

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [tree-sitter](https://tree-sitter.github.io/tree-sitter/) for powerful code parsing
- The TypeScript team for an amazing language
- The pnpm team for efficient package management

---

<div align="center">
Made with ❤️ by the Tokenizin team
</div>
