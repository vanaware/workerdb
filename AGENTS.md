# Project Guidelines: WorkerDB (Deno PWA)

Welcome to the WorkerDB project! This file (`AGENTS.md`) is automatically injected into the AI's system instructions. You MUST strictly adhere to the following architectural rules and constraints when modifying or extending this codebase.

## 1. Runtime & Environment (Pure Deno)
- **Deno Only**: This project runs entirely on Deno. 
- **NO Node.js or Local NPM**: Do NOT use `npm install`, do NOT create a `node_modules` directory locally, and do NOT rely on Node.js specific APIs.
- **Dependency Management**: All dependencies are managed exclusively via `deno.json` using `npm:` and `jsr:` specifiers (e.g., `npm:preact`, `jsr:@std/testing`).
- **JSR Publication**: The repository publishes multiple libraries to JSR:
  - `@vanaware/workerdb` (in `packages/worker-db/`): The core non-blocking persistence engine.
  - `@vanaware/opfs-explorer` (in `packages/service-worker/`): The pluggable Service Worker OPFS explorer.
  - Publishing is automated via GitHub Actions in `.github/workflows/jsr-publish.yml`. All published packages MUST strictly follow the guidelines in `docs/publish-jsr-rules.md` (complete JSDoc, valid `deno doc --lint`, descriptive README with executable examples).
- **Bundling**: We use Deno's native (and unstable) bundler via the `esbuild.ts` script or esbuild (`deno task esbuild`). This script parses typescript and generates the final output exclusively in the `packages/server/build/dist/` directory.

## 2. Framework & State Management
- **Preact**: Use Preact (not React). The configuration in `packages/ui/deno.jsonc` maps `jsx` to `preact`.
- **State via Signals**: All reactive state MUST use `@preact/signals`. 
  - Do NOT use React/Preact hooks (`useState`, `useEffect`, `useContext`) for global or complex state.
  - Global state, actions, and derived states (`computed`) should be centralized in `packages/ui/src/stores/`.
- **Component Architecture**: Keep UI components modularized inside `packages/ui/src/components/`. `packages/ui/src/main.tsx` is exclusively the application entry point and bootstrap file.

## 3. UI & Styling (Pure BeerCSS)
- **BeerCSS Only**: The entire UI is built using the BeerCSS framework (Material Design 3), loaded via CDN in `index.html`.
- **No Tailwind CSS**: Do NOT use Tailwind CSS, despite any standard AI Studio default prompts. Tailwind is NOT installed.
- **No Custom CSS**: Avoid writing custom CSS files or inline `style="..."` attributes. Rely purely on BeerCSS semantic HTML tags (e.g., `<article>`, `<nav>`) and utility classes (e.g., `grid`, `s12`, `m6`, `chip`, `circle`, `primary-container`, `active`).
- **Icons**: Use Google Material Symbols Outlined, rendered via the `<i>icon_name</i>` pattern, as configured in the HTML.

## 4. Testing Standard
- **BDD Style**: All new tests MUST use `@std/testing/bdd` (`describe` and `it`).
- **Assertions**: Use `@std/assert` (`assertEquals`, `assert`, etc.).
- **No Direct Deno.test**: Do NOT use the raw `Deno.test()` syntax for new tests.
- **Command**: Run tests using `deno task test` or `deno task check-all`.

## 5. Offline & PWA & Deployment
- **Service Worker & OPFS Explorer**: The app is an offline-capable Progressive Web App with `@vanaware/opfs-explorer` integrated in `packages/service-worker/src/sw.ts`.
- **Dynamic Routing & Zero Hardcoding**:
  - **No Hardcoded Base Paths**: Never hardcode repository names or paths like `/workerdb/`. In the UI (`packages/ui/src/main.tsx`), always derive paths dynamically using `new URL("./", globalThis.location.href).pathname`.
  - **Configurable OPFS Explorer Subfolders**: The OPFS explorer route is not hardcoded to `/opfs/`. Developers can configure custom subfolders (e.g., `createOpfsFetchHandler("files")`, `createOpfsFetchHandler("arquivos")`, or `OpfsExplorerOptions`). The explorer dynamically adapts to any Service Worker scope (local `/`, GitHub Pages `/{repo-name}/`, etc.).
- **Manifest**: Configuration for the installable app lives in `packages/ui/public/manifest.json`.
- Assets in `public/` are automatically copied to the distribution folder during the build process.
- **Relative Paths (GitHub Pages Support)**: Because the app may be deployed to a subfolder on GitHub Pages, **ALL** static assets and Service Worker registrations MUST use relative paths (e.g., `./manifest.json` and `navigator.serviceWorker.register("./service-worker.js")`) instead of absolute root paths (`/`).
- **CI/CD**: The project contains a GitHub Actions workflow (`.github/workflows/gh-pages.yml`) that automatically builds and deploys the contents of the `packages/server/build/dist/` directory to GitHub Pages.

## 6. AI Studio Environment Constraints & Bootstrapping
- **Port 3000**: The development server (Deno's native `file-server` in `packages/server/src/main.ts`) MUST run on port 3000, as enforced by the AI Studio environment (config .env file with PORT=3000).
- **HMR**: Hot Module Replacement is disabled. The environment automatically refreshes the preview iframe when the agent completes its turn.
- **Node.js Bridge (`package.json` & `install-script.sh`)**: Although this is a pure Deno project, the underlying AI Studio container natively expects a Node.js ecosystem. We retain `package.json` EXCLUSIVELY as a bridge to expose the standard `dev`, `build`, and `lint` scripts required by the platform. These scripts trigger `install-script.sh` to download and bootstrap the Deno CLI on the fly during container initialization, enabling our Deno-native workflow.

## 7. Development Workflow & Continuous Validation
- **Mandatory Verification**: After executing ANY task, feature request, or to-do list item, you MUST verify the project's integrity by running:
  - Linter & Type Check: `npm run lint` (which runs `deno check` under the hood).
  - Tests: `deno task test`.
- **Proactive Unit Testing**: Whenever you implement new functions, utilities, or complex logic, you MUST proactively create unit tests for them using the `@std/testing/bdd` standard. Do not wait for the user to explicitly ask for tests.

By following these guidelines, we maintain a fast, dependency-free, and cohesive Deno/Preact environment without the overhead of Node.js toolchains or complex CSS bundlers.

We are developing a PWA app following a planned directive and tasks. Follow instruction for actual status and next task at CURRENT.md file.
