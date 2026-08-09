import { setupErrorReporter } from './error-reporter.js';

const deployment = globalThis.__GHRAB_DEPLOYMENT_CONFIG__;
const reporterStudioUrl = deployment?.studioBaseUrl || '/AI-Studio-GHRAB/';
const reporterStudioBase = new URL(reporterStudioUrl, document.baseURI);
const reporterGuideUrl = deployment?.access?.guideUrl || new URL('manualy/error-report.html', reporterStudioBase).href;

const reporter = setupErrorReporter({
  appId: 'differentiator',
  appName: 'Diferenciátor',
  appVersion: '1.3.12',
  studioUrl: reporterStudioUrl,
  supportEmail: 'balaz@ghrabuvka.cz',
  guideUrl: reporterGuideUrl,
  themeResolver: () => document.body.classList.contains('dark') ? 'dark' : 'light',
  launcherBottom: '82px',
  captureBottom: '104px',
});

export default reporter;
