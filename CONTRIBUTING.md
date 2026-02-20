# Contributing to Snaplark

Thanks for your interest in contributing! 🎉

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/snaplark.git`
3. Create a branch: `git checkout -b feat/your-feature`
4. Make your changes
5. Run tests: `cargo test` (Rust) and `npm run build` (frontend)
6. Commit with a descriptive message
7. Push and open a Pull Request

## Development Setup

```bash
npm install
npm run tauri dev
```

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation
- `refactor:` — Code refactoring
- `test:` — Tests
- `ci:` — CI/CD changes
- `chore:` — Maintenance

## Code Style

- **Rust:** Follow `rustfmt` defaults. Run `cargo fmt` before committing.
- **TypeScript:** Follow the existing style. Use TypeScript strict mode.
- **Components:** Functional components with hooks.

## Reporting Issues

Use GitHub Issues. Include:
- OS version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
