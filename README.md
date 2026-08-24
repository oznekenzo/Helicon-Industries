# Helicon Industries

A manufacturing control tower prototype built on a synthetic event log. It reconstructs Job conditions, measures facility performance, and prioritizes evidence-backed Operational Issues that require a response.

## Product definition

- [Domain language](./CONTEXT.md)
- [Control Tower scope](./docs/control-tower-scope.md)
- [Manufacturing Event data contract](./docs/data-contract.md)

## Stack

- Next.js 16 with the App Router
- React 19
- TypeScript
- Tailwind CSS 4
- ESLint with recommended JSX accessibility rules
- Prettier
- pnpm

## Development

```bash
pnpm install
pnpm dev
```

Run all static checks:

```bash
pnpm check
```
