# Testing / build guidance for agents

- When running a Quartz build to verify a change (e.g. `npx quartz build`), use
  `test_content` as the content directory, not `content`.
  `content` has ~15,800+ files and takes a very long time to build;
  `test_content` is a small fixture set meant for exactly this purpose.

  ```
  npx quartz build -d test_content -o <scratch-output-dir>
  ```

- Only build against `content` when the task specifically requires validating
  against real/full site content (e.g. checking a specific existing page, or a
  final pre-deploy sanity check the user explicitly asks for).
