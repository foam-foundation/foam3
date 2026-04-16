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

  methods: [
    async function execute() {
      let txt       = await (await fetch('service/health?format=json')).text();
      let health    = JSON.parse(txt);
      let appConfig = this.appConfig;
      let realUser  = this.subject.realUser;
      let user      = this.subject.user;
      let flow      = this.flow;
      let group     = this.group;
      let theme     = this.theme;

      // Display the health information
      this.out.start('div').style({
        'font-family': 'monospace',
        'white-space': 'pre'
      }).add(`
System Information:
------------------------------------
Flow:            ${flow.name || 'Untitled'} v${flow.version}
Hostname:        ${health.hostname}
Application:     ${health.appName}
Version:         ${health.version}
Address:         ${window.location.origin}
Port:            ${health.port}
User Agent:      ${navigator.userAgent}
Projects:        ${appConfig.pom}
Flags:           ${appConfig.flags}
Effective User   (${user.id}) ${user.toSummary()}
Real User        (${realUser.id}) ${realUser.toSummary()}
Group:           ${group.toSummary()}
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
      `).end();
    }
  ]
});
