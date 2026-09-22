/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ticket',
  name: 'SummaryCard',
  extends: 'foam.u2.View',

  documentation: 'Cards for summary views',

  css: `
    ^ {
      display: inline-block;
      width: 145px;
      background:$backgroundDefault;
      height: 100px;
      vertical-align: top;
      margin-left: 6px;
      border-radius: 3px;
      overflow: hidden;
      border: 3px solid $backgroundDefault;
    }
    ^ .label {
      color: $textDefault;
      position: relative;
      top: 35;
      left: 10;
      padding: 3px 7px;
      display: inline;
    }
    ^ .count {
      position: relative;
      top: 20;
      left: 20;
    }
  `,

  properties: [
    'count',
    'status'
  ],

  methods: [
    function render(){
      var self = this;
      this
        .addClass(this.myClass())
          .start().addClass('md-text-light', 'count').add(this.count$).end()
          .start()
            .addClass(this.status)
            .addClass('p-label-light', 'label')
            .addClass('special-status-tag')
            .add(this.status)
          .end()
        .end();
    },
  ]
});
