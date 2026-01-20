# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the Taro React app (pages, components, services, utils, models).
  - Pages live under `src/pages/*` with matching `.tsx`, `.scss`, and `.config.ts` files.
  - Shared UI components are in `src/components/ui/` (PascalCase `.tsx`).
  - Data/services live in `src/services/`, models in `src/models/`, and helpers in `src/utils/`.
- `config/` holds environment-specific Taro config (`dev.ts`, `prod.ts`, `index.ts`).
- `types/` contains global type declarations.
- `dist/` is build output (generated).

## Build, Test, and Development Commands
- `npm run dev:weapp`: watch/build for WeChat Mini Program.
- `npm run build:weapp`: production build for WeChat Mini Program.
- `npm run dev:h5` / `npm run build:h5`: watch/build for H5 targets.
- `npm run dev:alipay` / `npm run build:alipay`: watch/build for Alipay.
- `npm run new`: scaffold Taro pages/components via the Taro CLI.
- `npm run install:ignore-engines`: install dependencies when Node engine checks block you.

## Coding Style & Naming Conventions
- TypeScript + React with Taro; styles are SCSS.
- Prefer 2-space indentation, single quotes, and no semicolons to match existing files.
- Components use PascalCase (`PrimaryButton.tsx`); utilities use camelCase (`format.ts`).
- Page files follow `index.tsx`, `index.scss`, `index.config.ts` within each page folder.
- Linting configs exist for ESLint and Stylelint; add scripts if you need automated checks.

## Testing Guidelines
- No test framework or scripts are currently configured.
- If you add tests, place them alongside modules or under a `tests/` folder and document how to run them.

## Commit & Pull Request Guidelines
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `chore:`), enforced by commitlint.
- PRs should include a clear description, link relevant issues, and include screenshots or recordings for UI changes.
- Keep PRs focused and update relevant docs or configs when behavior changes.

## Configuration Notes
- Taro app configuration lives in `project.config.json` and `src/app.config.ts`.
- Environment-specific settings go in `config/` and should avoid hard-coded secrets.

## Runtime & API Integration
- API base URL is defined in `src/config/api.ts` (`API_BASE_URL`). Set this per environment.
- All HTTP requests go through `src/services/request.ts` and expect `Result<T>`; success codes include `0` and `200`.
- Login flow is centralized in `src/services/authService.ts` and `src/pages/login/`.
  - Use `ensureLoginOrRedirect()` before protected pages (see `src/app.ts`, `src/pages/group/index.tsx`).
- WeChat requires legal domains for requests. In dev tools you can disable domain checks; production must whitelist domains in the WeChat console.

## UI System & Styling
- UI kit: Taroify (`@taroify/core`, `@taroify/icons`). Prefer component usage over hand-built UI.
- Import styles on-demand for each Taroify component (avoid full bundle where possible).
- Keep SCSS overrides scoped to page classes and tokens; avoid deep global overrides.

## Data & Storage
- Local storage keys live in `src/services/storage.ts` (if used by a feature).
- Group (多人记账) data and WebSocket helpers live in `src/services/groupService.ts` and `src/services/groupWs.ts`.
- `/groups/mine` is used for the group list; `/groups/final/{groupId}` is used for final (settled) detail rendering.

## Feature Flags / Staging Behavior
- Some features are intentionally hidden (e.g. 分摊人、同步到个人账本 in group record). Keep them off unless explicitly requested.
- When adding test data, provide a single toggle entry point so it can be disabled for release.

## Troubleshooting
- If `connectSocket` returns a Promise, await it before calling `.onMessage` / `.send` (handled in `groupWs.ts`).
- Sass warnings from dependencies (e.g. Taroify) are expected; avoid editing `node_modules`.
