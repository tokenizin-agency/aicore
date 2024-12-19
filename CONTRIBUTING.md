# Contributing to Tokenizin

First off, thanks for taking the time to contribute! 🎉

## Development Process

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Install dependencies (`pnpm install`)
4. Make your changes
5. Run tests (`pnpm test`)
6. Run linting (`pnpm lint`)
7. Create a [changeset](https://github.com/changesets/changesets) (`pnpm changeset`)
8. Commit your changes (`git commit -am 'feat: add amazing feature'`)
9. Push to the branch (`git push origin feature/amazing-feature`)
10. Open a Pull Request

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools

## Development Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run linting
pnpm lint

# Format code
pnpm format
```

## Project Structure

```
.
├── packages/           # Package directory
│   └── ai-repomap/    # Repository analyzer package
├── .github/           # GitHub configuration
├── .husky/           # Git hooks
└── ...
```

## Pull Request Process

1. Update the README.md with details of changes if needed
2. Add a changeset describing your changes
3. Update any examples if needed
4. The PR will be merged once you have the sign-off of at least one maintainer

## Questions?

Feel free to open an issue for any questions or concerns! 