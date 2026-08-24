import { setupErrorReporter } from './error-reporter.js';

const reporter = setupErrorReporter({
  appId: 'correspondence',
  appName: 'Korespondenční asistent',
  appVersion: '5.10.7',
  studioUrl: '/AI-Studio-GHRAB/',
  supportEmail: 'balaz@ghrabuvka.cz',
  guideUrl: '/AI-Studio-GHRAB/manualy/error-report.html',
  themeResolver: () => document.body.classList.contains('dark') ? 'dark' : 'light',
  launcherBottom: '82px',
  captureBottom: '104px',
});

export default reporter;
