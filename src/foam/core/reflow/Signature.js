/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'SignatureView',
  extends: 'foam.u2.View',

  css: `
    ^ .foam-u2-ActionView {
      margin-left: 24px;
      height: 24px;
    }
  `,

  methods: [
    function render() {
      this.
        addClass().
        add(this.data.label$, ' Signature: ').
        start('span').
          show(this.data.signor$).
          style({border: '3px solid black', padding: '0 3px' }).
          add(this.data.signor$).
        end().
        add(' ', this.data.timestamp$.map(ts => ts ? '' + ts : ''), ' ')
        .start('span').style({color: 'red'}).add(this.data.prerequisite$).end().
        add(this.data.SIGN, this.data.UNSIGN);
      // TODO: I don't know why the timestamp$.map is required
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Signature',

  imports: [ 'auth?', 'subject' ],

  properties: [
    {
      class: 'String',
      name: 'label',
      visibility: function(signed) {
        return signed ? foam.u2.DisplayMode.RO : foam.u2.DisplayMode.RW;
      }
    },
    {
      class: 'Boolean',
      name: 'signed',
      visibility: 'RO'
    },
    {
      class: 'String',
      name: 'signor',
      visibility: 'RO'
    },
    {
      class: 'DateTime',
      name: 'timestamp',
      visibility: 'RO'
    },
    {
      class: 'String',
      name: 'prerequisite',
      visibility: function(signed) {
        return signed ? foam.u2.DisplayMode.RO : foam.u2.DisplayMode.RW;
      }
    },
    {
      class: 'String',
      name: 'permission',
      trim: true,
      postSet: function(o, n) {
        this.checkPermission();
      },
      visibility: function(signed) {
        return signed ? foam.u2.DisplayMode.RO : foam.u2.DisplayMode.RW;
      }
    },
    {
      class: 'Boolean',
      name: 'permissionGranted',
      hidden: true,
      value: true
    }
  ],

  methods: [
    function addToE(e) {
      e.tag(foam.core.reflow.SignatureView, {data: this});
    }
  ],

  listeners: [
    {
      name: 'checkPermission',
      isIdled: true,
      delay: 250,
      code: async function() {
        let p = this.permission;

        if ( ! p || ! this.auth ) {
          this.permissionGranted = true;
        } else {
          this.permissionGranted = false;
          this.permissionGranted = await this.auth.check(null, this.permission);
        }
      }
    }
  ],

  actions: [
    {
      name: 'sign',
      isAvailable: function(signed, prerequisite, permissionGranted) { return ! signed && ! prerequisite && permissionGranted; },
      code: function() {
        this.signor    = this.subject.realUser.toSummary();
        this.timestamp = new Date();
        this.signed    = true;
      }
    },
    {
      name: 'unsign',
      isAvailable: function(signed) { return signed; },
      code: function() {
        this.signor = this.timestamp = this.signed = undefined;
      }
    }
  ]
});
