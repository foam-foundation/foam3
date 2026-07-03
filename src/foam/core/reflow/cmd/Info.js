/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Info',
  extends: 'foam.core.reflow.cmd.Command',

  imports: [ 'appConfig', 'flow', 'group', 'subject', 'theme' ],

  properties: [
    [ 'description', 'Display system information' ]
  ],

  static: [
    {
      name: 'buildText',
      documentation: `Build the system-information text from a context. Shared so other
        features (e.g. the perf block's Copy report) can append the same info.`,
      code: async function(x) {
        var txt       = await (await fetch('service/health?format=json')).text();
        var health    = JSON.parse(txt);
        var appConfig = x.appConfig || {};
        var subject   = x.subject || {};
        var realUser  = subject.realUser || {};
        var user      = subject.user || {};
        var flow      = x.flow || {};
        var group     = x.group;
        var theme     = x.theme || {};
        var sum       = function(o) { return o && o.toSummary ? o.toSummary() : ''; };

        return `
System Information:
------------------------------------
Flow:            ${flow.name || 'Untitled'} v${flow.version || ''}
Hostname:        ${health.hostname}
Application:     ${health.appName}
Version:         ${health.version}
Address:         ${window.location.origin}
Port:            ${health.port}
Processors:      ${health.availableProcessors}
Runtime:         ${health.runtime}
User Agent:      ${navigator.userAgent}
Projects:        ${appConfig.pom}
Flags:           ${appConfig.flags}
Effective User   (${user.id}) ${sum(user)}
Real User        (${realUser.id}) ${sum(realUser)}
Group:           ${sum(group)}
SPID:            ${user.spid}
Theme:           ${theme.id}
Timezone:        ${Intl.DateTimeFormat().resolvedOptions().timeZone}
Locale:          ${foam.locale}
Status:          ${foam.core.app.HealthStatus.forOrdinal(health.status).label}
Mode:            ${foam.core.app.Mode.forOrdinal(health.mode).label}
Current Time:    ${new Date().toISOString()}
Boot Time:       ${new Date(health.bootTime).toISOString()}
Uptime:          ${foam.lang.Duration.duration(health.upTime, 3)}
Memory Max:      ${(health.memoryMax / 1024 / 1024).toFixed(1)} MB
Memory Total:    ${(health.memoryTotal / 1024 / 1024).toFixed(1)} MB
Memory Free:     ${(health.memoryFree / 1024 / 1024).toFixed(1)} MB
Memory Used:     ${(health.memoryUsed / 1024 / 1024).toFixed(1)} MB
Memory Used %:   ${health.memoryUsedPercent.toFixed(1)}%
Client Memory:   ${navigator.deviceMemory} GB
Active Alarms:   ${health.alarms}
`;
      }
    }
  ],

  methods: [
    async function execute() {
      var text = await this.cls_.buildText(this.__context__);
      this.out.start('div').style({
        'font-family': 'monospace',
        'white-space': 'pre'
      }).add(text).end();
    }
  ]
});
