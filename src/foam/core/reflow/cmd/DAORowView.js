  /**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'DAORowView',
  extends: 'foam.u2.View',

  requires: [
    'foam.u2.tag.Button',
  ],

  css: `
    ^ .foam-u2-tag-Button svg {
      color: $black!important;
    }
    ^name-btn {
      color: $black!important;
    }
    ^desc-cell {
      min-width: 300px;
    }
  `,

  properties: [
    'shortName',
    'description',
    'ofId',
    'uploadAvailable'
  ],

  methods: [
    function render() {
      this.addClass();
      this.start('tr').
        start('td').attr('align', 'left').
        start(this.Button, { buttonStyle: 'TEXT', themeIcon: 'plus', size: 'SMALL' }).on('click', this.addFn).end().
        end().
        start('td').attr('align', 'left').
        show(this.uploadAvailable).
        start(this.Button, { buttonStyle: 'TEXT', themeIcon: 'upload', size: 'SMALL' }).on('click', this.uplFn).end().
        end().
        start('th').addClass(this.myClass('desc-cell')).attr('align', 'left').
        start(this.Button, { buttonStyle: 'LINK', size: 'SMALL'}).addClass(this.myClass('name-btn')).add(this.shortName).on('click', this.daoFn).end().
        end().
        start('td').addClass(this.myClass('desc-cell')).attr('align', 'left').
        start(this.Button).add(this.ofId).on('click', this.desFn).end().
        end().
        start('td').attr('align', 'left').
        style({
          textWrapMode: 'nowrap',
          overflow: 'hidden',
          paddingRight: '8px',
        }).add(this.description).
        end().
        end();
    }
  ],

  listeners: [
    {
      name: 'addFn',
      code: function() {
        this.data.eval_('add ' + this.shortName);
      }
    },
    {
      name: 'uplFn',
      code: function() {
        this.data.eval_('upload ' + this.shortName);
      }
    },
    {
      name: 'daoFn',
      code: function() {
        this.data.eval_('dao ' + this.shortName);
      }
    },
    {
      name: 'desFn',
      code: function() {
        this.data.eval_('describe(' + this.ofId + ')');
      }
    }
  ]
});
