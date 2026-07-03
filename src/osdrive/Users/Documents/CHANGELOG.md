# Changelog Apr 25, 2026 - Jun 19, 2026

All notable changes to CheetahOS are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres loosely to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Reconstructed from the project's development history (April–June 2026). Grouped by
> area rather than strictly chronologically.

## [Unreleased]

### Build, Tooling & Deployment

- Dockerized the project (`Dockerfile`, `docker-compose.yml`, `nginx.conf`) for containerized serving.
- Resolved local setup blockers: npm script execution policy, `ng` command not found, and npm exit-handler errors.
- Upgraded Angular 19 → 21; fixed `Cannot find module '@angular/cdk/drag-drop'` type resolution.
- Fixed the `"buffer" has been externalized for browser compatibility` runtime error (browser `Buffer` access).
- Added a production build pipeline outputting to `prod_deployment`; fixed `<base href>` / asset 404s for server deployment.
- Configured production deployment to a **GitHub Pages project site** (sub-path hosting under `/cheetahos.github.io/`). The full sub-path is injected as `baseHref` at build time only, so local `dev`/`serve` keeps `<base href="/">`.
- Registered an Angular **service worker** (`ngsw-worker.js`, emitted only by the production build) driven by `ngsw-config.json` for app-shell and asset caching; `SwUpdate` handles `VERSION_READY` without forcing a page reload.

### Performance & Memory

- Added script/style unload logic so dynamically loaded libraries (e.g. Marked.js) are cleared from memory.
- Hunted and fixed memory leaks causing >1 GB RAM usage:
  - Taskbar preview screenshots were never freed (captured in `ngAfterViewInit` and retained) — the primary culprit.
  - `WindowComponent` (primary/secondary) was not cleaned up when apps closed.
  - Fixed `removeProcessPreviewImage` cleanup and reduced screenshot capture resolution.
- Reviewed and hardened `process.handler.service.ts`.

#### Static-hosting boot load optimization

Profiling a deployed (GitHub Pages) boot revealed ~**101 MB** transferred across ~**2047 requests** before the desktop was usable. Two independent root causes were fixed without changing app behavior.

- **Stop downloading bytes you don't need yet (byte axis):**
  - Directory listing no longer eagerly downloads media: `getFileInfo` gates content loading, and deferred content is hydrated on open via `hydrateFileContentIfNeeded`.
  - Media now streams via a direct URL + HTTP range requests instead of being read whole into memory; a blob read remains as a fallback. This dropped the transfer from ~101 MB to ~**1.4 MB**.
- **Stop issuing a network request per file (request-count axis):**
  - The build (`make_http_index.js`) now bakes each file's **byte size** into `osdrive.json` (folders stay objects, files become numbers), so BrowserFS can answer `stat()` from memory instead of forcing a network `HEAD` per file.
  - `browserfs.js` `FileIndex.fromListing` reads the baked size into the file's stat; it stays backward compatible with legacy `null` entries.
  - The search indexer (`file.indexer.services.ts`) skips `.url` shortcuts **before** any I/O, so it no longer `GET`s every shortcut just to discard it.
  - Deferred `calculateUsedStorage()` off the boot path and made it lazy (`getUsedStorageAsync`) with guarded incremental deltas, removing the second full-drive boot walk.
  - Net effect: both boot walks became zero-network (pure in-memory), collapsing boot to only what is actually rendered (app shell + `osdrive.json` + visible icons). File sizes in Explorer/properties are now populated for free.
- **Image loading hints (above/below the fold):**
  - File-explorer icon-view and details-view images use `loading="lazy"` + `decoding="async"`.
  - Above-the-fold desktop icons use `decoding="async"` only (no lazy, so they paint immediately).

#### Sub-path hosting correctness fixes (post-deploy)

- Added a `toAbsoluteOsdriveUrl` helper and updated `getDirectFileUrl` to anchor osdrive media URLs to `<base href>` via `document.baseURI`, so Howler/Video.js don't re-resolve relative paths against the origin root (fixed 404s under sub-path hosting).
- Fixed audio and video `.url`-shortcut playback: the legacy `checkForExt` branch returned a root-absolute `/osdrive/...` path that 404'd on the project sub-path.
- Served the Video.js stylesheet on demand from `osdrive/Program-Files/Videojs/video-js.min.css` (added the file the player dynamically loads; removed the now-redundant global CSS bundle).

### Responsive Windows (major effort)

- Reworked the primary window to be responsive to its content, and content responsive to window resize
  (corner/edge `rzHandles` dragging now grows inner content).
- Made the following apps responsive without breaking functionality or styling:
  audio player, chatter, video player, terminal, settings, task manager, boids, markdown viewer,
  particle flow, PDF viewer, warping starfield, title, code editor, file explorer, text editor, photo viewer.
- Fixed window height (`vh - 40px`) and `.main-desktop` `100vh` sizing issues.
- Fixed SiriWave sizing/blurriness on load and resize in the audio player; restored play and title display.
- Cleaned up and unified `minimizeWindow` / `maximizeWindow` (consistent min-width/height; correct restore position; closed the ~40px bottom gap on maximize).
- Fixed apps "floating up" a few pixels into the primary window on terminal/chatter/texteditor actions.
- Fixed the text-editor status bar not rendering its contents.

### Window Component Refactor

- Split the ~920-line god component into focused controllers (close/lifecycle, mouse/drag, subscription wiring) for primary and secondary windows.
- Made `WindowStyleHelper` non-singleton to avoid shared mutable state across windows.
- Fixed focus handoff: closing/hiding the focused window now focuses the next visible window.
- Centralized window-related types in one place.

### Desktop

- Split the desktop god class into pure controllers/handlers (e.g. `DesktopBackgroundController`/`Handler` for Vanta lifecycle, pictures, and color cycling).
- Improved background color cycling: more varied/dazzling cross-fades while dialing back harsh, washed-out colors; consolidated color math into `color.ts` (`interpolateHexColor`, HSL→RGB helpers).
- Fixed background picture not scaling to fit the desktop.
- Fixed faint/barely-visible drag-image clones when lasso-dragging multiple icons (Chromium & Firefox).
- Fixed "align icons to grid" to only align (not move) icons.
- Fixed icon rename issues: stray textbox/label after clicking empty space, multi-line cursor/backspace behavior, and 2-line clamp not expanding to full text on select/refresh.
- Fixed lasso not appearing intermittently.
- Made the desktop keyboard-navigable.

### File Explorer

- Implemented a batch of correctness fixes across the component; isolated state so multiple file-explorer instances don't affect each other.
- Fixed navigation/listing of mounted zip files.
- Made the nav-path display responsive to window width.
- Details view: fixed selection highlighting (including click-on-empty-space), column resize, ellipsis behavior, image centering, text clipping, and highlight alignment vs other columns.
- Fixed icon-view/details-view footer highlight state.
- Made the file explorer keyboard-navigable.
- Reviewed and ported fixes to the older (more ambitious) file-explorer variant.

### File Service & File Indexing

- Reviewed file indexing for correctness; implemented 9 fixes with detailed explanatory comments.
- Fixed screenshot capture crash (`Cannot read properties of undefined (reading 'addNotify')`).
- Fixed file-explorer not refreshing after a folder is zipped, and issues copying a zipped file to the desktop.
- Fixed blank `onlyRecommends` / `onlyRecents` lists after the indexer rework.
- Added `updateFileAsync`; removed the `jszip` dependency.
- **File service correctness fixes:**
  - Removed shared mutable duplicate-handling state (`_isDuplicate`/`_generatedName`) that corrupted indexer paths under concurrency; handlers now return the final path.
  - Fixed `moveHandlerAsync` building wrong destination paths for sibling subfolders (now tracks `{src, dest}` tuples).
  - Honored `CONCURRENCY_LIMIT` across recursion via a single shared semaphore.
  - Fixed `Promise.allSettled` failure detection swallowing rejections.
  - Added collision retry (`IncrementFileName`) to `moveFileAsync`.
  - Fixed `initBrowserFsAsync` double-resolve, `renameURLFiles` trailing space, `isFileInUse` substring false positives, `DecrementFileName` misclassifying user-named files, and missing `return`s in `isDirectory`/`readDirectory`/`countFolderItems`.
- **File service performance:**
  - Merged triple tree traversal into a single scan; one `stat` per entry; parallelized directory walks.
  - Made `recalculateUsedStorage` incremental instead of full-drive rescans.
  - Moved zip/unzip work off the main thread / streamed it; deduplicated parent-folder creation on unzip.
  - Per-operation `AbortController` (keyed by `dialogPId`); cached `TextDecoder`; revoked blob URLs to stop unbounded growth; cheaper encoding probe.
- Resilient directory listing (per-file `try/catch`), longest-match mount-point selection, and assorted hygiene/naming cleanups.

### Terminal

- Reviewed and simplified the terminal with bug, style, performance, and security fixes.
- Reworked the brittle tab-completion state machine.
- Added live/verbose command output: streaming updates for `download`, `cp -v`, `mv -v`, `rm -v`; switched download to a stream reader (fixed 0 KB downloads).
- Added the `sysmetric` terminal command backed by the new system-metric service.
- Added `terminalCommand` (renamed from `commandID`).

### Lock Screen, Login & Startup

- Fixed the volume icon showing the wrong image (`medium`/`error`) after reload while locked/unlocked.
- Made Clippy reliably stop on lock-screen activation and animate more smoothly on close.
- Fixed the shutdown background not turning blue when shutting down from the lock screen.
- Fixed the auth form briefly flashing on auto-lock.
- Fixed the auto-lock timer firing before the configured timeout.
- Fixed lock-screen audio and startup sound not playing.

### App Reviews & Refactors

Systematic "do not break functionality, add ample comments" reviews fixing bugs, design, and style across:
process handler, app directory, search, taskbar previews, dialog, taskbar, menu, properties, cheetah,
volume control, power on/off, start menu, settings, chatter service, system-metric service, task manager,
system tray, session-management service, and defaults service.

Notable per-app changes:
- **Search:** fixed folders appearing in best-match when filtered out; added keyboard navigation and lock-screen reset on activity.
- **Start menu:** keyboard navigation, dynamic fluent-effect script loading, and resolved navigation contention with the desktop.
- **Task manager:** moved/polished the context menu into the shared menu component; fixed min view, context-menu dismissal, and End Task button positioning/visibility.
- **Properties / Cheetah / Volume / Power:** correctness fixes, dead-code removal, info-icon hover timing fix, and a one-time "not optimized for mobile" banner using `getOS`/`getBrowser`.
- **Taskbar entries:** fixed pinned-icon width in unmerged mode when the app isn't running.
- **Taskbar previews:** restored `setCloseBtnColor` behavior lost in refactor.
- **Chatter service:** enforced a single instance, removed `providedIn: 'root'`, and wired up fetch-prior-messages.

### New Apps

- **Run app** (`runsystem`): Windows 10–style Run dialog in the secondary window with a dropdown of recent commands.
- **Clipboard app**: Windows 10–style clipboard history in the secondary window, summoned with `Ctrl + Shift + V`; respects `DEFAULT_CLIP_BOARD_STATE` for store-on-cut/copy.

### Settings App

- Implemented Storage, About, Notifications, and Applications (Apps & features) views from design mockups, reusing the system/personalization view patterns.

### Documentation & Licensing

- Reworded the license to sound more legal.
- Added a Development Assistance section to `Users/Documents/Credits.md`, then expanded it to credit GitHub Copilot for the full scope of recent work (build/tooling/deployment, performance & memory, responsive windows, refactors, new apps, settings, and docs/licensing); kept the `src` and `prod_deployment` copies in sync.
- Added this changelog.
