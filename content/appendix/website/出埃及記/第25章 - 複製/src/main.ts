import './styles.css';
import { AppShell } from './components/AppShell';

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
shell.bind(app);
app.start();

window.addEventListener('beforeunload', () => { shell.dispose(); app.dispose(); }, { once: true });
