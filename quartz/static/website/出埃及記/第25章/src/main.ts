import './styles.css';
import { AppShell } from './components/AppShell';
import { PerformanceRecorder, type PerformanceAssetSource, type PerformanceRecorderApi } from './diagnostics/PerformanceRecorder';

const diagnostics = { errors: [] as string[], unhandledRejections: [] as string[], consoleErrors: [] as string[], consoleWarnings: [] as string[] };
(window as Window & { __TABERNACLE_DIAGNOSTICS__?: typeof diagnostics }).__TABERNACLE_DIAGNOSTICS__ = diagnostics;
const syncDiagnostics = (): void => {
  document.documentElement.dataset.runtimeErrors = String(diagnostics.errors.length + diagnostics.unhandledRejections.length + diagnostics.consoleErrors.length);
  document.documentElement.dataset.runtimeWarnings = String(diagnostics.consoleWarnings.length);
};
const originalConsoleError = console.error.bind(console);
const originalConsoleWarn = console.warn.bind(console);
console.error = (...values: unknown[]): void => { diagnostics.consoleErrors.push(values.map(String).join(' ')); syncDiagnostics(); originalConsoleError(...values); };
console.warn = (...values: unknown[]): void => { diagnostics.consoleWarnings.push(values.map(String).join(' ')); syncDiagnostics(); originalConsoleWarn(...values); };
window.addEventListener('error', (event) => { diagnostics.errors.push(event.message); syncDiagnostics(); });
window.addEventListener('unhandledrejection', (event) => { diagnostics.unhandledRejections.push(String(event.reason)); syncDiagnostics(); });
syncDiagnostics();

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing #app root.');

const shell = new AppShell(root);
const { AppKernel } = await import('./app/AppKernel');
const app = new AppKernel(shell.canvas);
const performanceRecorder = new PerformanceRecorder(app.scene.context.renderer, shell.canvas, {
  profile: app.getAssetState().profile,
  buildHash: getBuildHash(),
  assets: app.data.assets.assets.map((asset): PerformanceAssetSource => ({
    id: asset.id,
    loadedUrl: new URL(asset.url, window.location.href).toString(),
    sourceFile: asset.sourceFile,
    processedFile: asset.processedFile,
    runtimeFile: asset.runtimeFile,
    sha256: asset.sha256,
    ...(asset.derivedHash ? { derivedHash: asset.derivedHash } : {}),
  })),
  activeAssetIds: app.getAssetState().activeAssetIds,
  getProfile: () => app.getAssetState().profile,
  getActiveAssetIds: () => app.getAssetState().activeAssetIds,
  getNetworkState: () => readNetworkState(),
});
app.setPerformanceRecorder(performanceRecorder);
(window as Window & { __TABERNACLE_PERFORMANCE__?: PerformanceRecorderApi }).__TABERNACLE_PERFORMANCE__ = performanceRecorder;
shell.bind(app);
app.start();

window.addEventListener('beforeunload', () => { shell.dispose(); app.dispose(); }, { once: true });

function getBuildHash(): string | null {
  const script = [...document.scripts].map((item) => item.src).find((src) => src.includes('/assets/'));
  return script?.match(/-([A-Za-z0-9]{8,})\.js(?:$|\?)/)?.[1] ?? null;
}

function readNetworkState(): string {
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
  return connection ? `${connection.effectiveType ?? 'unknown'}${connection.saveData ? ',save-data' : ''}` : 'unavailable';
}
