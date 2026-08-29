import { setupErrorReporter } from './error-reporter.js';

const reporter = setupErrorReporter({
  appId: 'correspondence',
  appName: 'Korespondenční asistent',
  appVersion: '5.10.14',
  studioUrl: '/ai-studio/',
  supportEmail: 'balaz@ghrabuvka.cz',
  guideUrl: '/ai-studio/manualy/error-report.html',
  themeResolver: () => document.body.classList.contains('dark') ? 'dark' : 'light',
  launcherBottom: '82px',
  captureBottom: '104px',
});

export default reporter;
