/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification',
  name: 'NotificationSettingsView',
  extends: 'foam.u2.View',

  documentation: 'Settings / Personal View',

  implements: [
    'foam.mlang.Expressions',
  ],

  imports: [
    'subject',
    'stack'
  ],

  requires: [
    'foam.core.notification.Notification',
    'foam.core.notification.NotificationSettingCitationView'
  ],

  messages: [
    { name: 'TITLE', message: 'Notification Preferences' },
  ],

  css: `
    << {
      display: flex;
      flex-direction:column;
      gap: 1rem;
    }
  `,

  properties: [
    {
      name: 'settingsMap',
      class: 'Map'
    },
    {
      // TODO: Add topics
      // name: 'topicsMap',
      // class: 'Map'
    },
    {
      name: 'relevant',
      class: 'StringArray',
      documentation: `Notification settings which are potentially relevant to end users.
Or a hack to filter out slack and google.
This is only necessary when global settings exist that are not used or relevant to the spid.`,
      hidden: true,
      transient: true,
      factory: function() {
        return ['NotificationSetting', 'EmailSetting', 'PushSetting', 'SMSSetting'];
      }
    }
  ],

  methods: [
    async function render() {
      let self = this;
      this.stack?.setCompact(true, this);
      this.stack?.setTitle(this.TITLE, this);
      await this.getImpliedNotificationSettings();
      let label = foam.core.notification.NotificationSetting.model_.label;
      let keys = Object.keys(this.settingsMap).sort((a, b) => {
        return a == label ? -1 : (b == label ? 1 : 0); 
      });
      this
        .addClass()
        .forEach(keys, function(label) {
          let setting = self.settingsMap[label];
          this.tag(self.NotificationSettingCitationView, { label: label, setting_: setting, of: setting?.cls_ });
        });
    }
  ],

  listeners: [
    {
      name: 'getImpliedNotificationSettings',
      code: async function() {
        var map = await this.subject.user.getImpliedNotificationSettings(this.__subContext__, false);
        for ( const key in map ) {
          var value = map[key];
          if ( ! this.relevant.includes(value.cls_.name) ) {
            delete map[key];
          }
        }
        this.settingsMap = map;
      }
    }
  ]
});
