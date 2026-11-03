/**
* @license
* Copyright 2024 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.core.notification',
  name: 'NotificationSettingCitationView',
  extends: 'foam.u2.borders.CardBorder',

  axioms: [foam.pattern.Faceted.create()],

  imports: ['subject'],

  properties: [
    'label',
    {
      name: 'data',
      class: 'Boolean',
      attribute: true,
      factory: function() {
        return this.setting_.enabled;
      },
      postSet: function(o, n) {
        if ( o == n ) return;
        var setting = this.setting_;
        if ( setting.owner != this.subject.user.id ) {
          setting = this.setting_.clone();
          setting.id = undefined;
        }
        setting.enabled = n;
        setting.owner = this.subject.user.id;
        setting.spid = this.subject.user.spid;
        this.controllerMode = 'VIEW';
        this.subject.user.notificationSettings.put(setting).then((s) => {
          this.setting_.copyFrom(s);
          this.controllerMode = 'EDIT';
        });
      }
    },
    'setting_',
    {
      class: 'Class',
      name: 'of',
      factory: function() {
        return this.setting_.cls_;
      }
    }
  ],
  css: `
    << {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 2rem;
    }
    <<:not(:disabled) {
      cursor: pointer;
    }
  `,
  methods: [
    function render() {
      this
        .addClass()
        .on('click', this.toggleData)
        .call(this.addContent)
        .startContext({ data: this })
        .start(this.DATA).style({ 'flex-shrink': 0 }).end()
        .endContext();
    },
    function addContent() {
      this.start().addClass('p-semiBold').add(this.label).end();
    },
    function updateMode_(mode) {
      var disabled = mode === foam.u2.DisplayMode.RO || mode === foam.u2.DisplayMode.DISABLED;
      this.setAttribute('disabled', disabled);
    }
  ],
  listeners: [
    function toggleData(e) {
      if ( this.getAttribute('disabled') || e.target.nodeName == 'INPUT' ) return;
      this.data = ! this.data;
    }
  ]
});
