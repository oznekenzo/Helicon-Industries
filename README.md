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
cp .env.example .env
pnpm dev
```

The application requires `BASIC_AUTH_USERNAME` and `BASIC_AUTH_PASSWORD` in
every environment. Requests fail closed when either value is missing.

Run all static checks:

```bash
pnpm check
```

## Deployment

The existing Vercel project is `helicon-industries`. Configure
`BASIC_AUTH_USERNAME`, `BASIC_AUTH_PASSWORD`, and the pooled `DATABASE_URL` for
both Preview and Production. `DIRECT_DATABASE_URL` is only for local migrations
and must not be added to the deployed application.

```bash
vercel link --project helicon-industries
vercel
vercel --prod
```

Verify that each deployment returns `401 Unauthorized` without credentials and
loads normally with the configured Basic Auth username and password.
