# Frontend Structure

The frontend uses a `src/` based Next.js App Router layout.

```text
src/
  app/
    [...slug]/page.tsx        Dynamic route entry for command-center pages
    globals.css               Global design system and layout styles
    layout.tsx                Root app shell metadata
    not-found.tsx             Route fallback
    page.tsx                  Redirect to dashboard
  features/
    command-center/
      components/
        command-center-page.tsx
      config/
        navigation.ts
```

## Conventions

- Keep route files in `src/app`.
- Keep domain-specific UI, data, and configuration inside `src/features/<feature-name>`.
- Use `@/*` imports from `src/*`.
- Add future reusable UI primitives under `src/components/ui`.
- Add cross-feature utilities under `src/lib`.
- Keep deployment and operations notes under `docs`.
