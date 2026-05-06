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
  imports: ['eval_'],

  properties: [
    'name',
    'shortName',
    'description',
    'ofId',
    'uploadAvailable',
    [ 'nodeName', 'tr' ]
  ],

  methods: [
    function render() {
      this.addClass();
      this.
        start('td').attr('align', 'left').
          start(this.Button, { buttonStyle: 'BLACK', themeIcon: 'plus', size: 'SMALL' }).on('click', this.addFn).end().
        end().
        start('td').attr('align', 'left').
          show(this.uploadAvailable).
          start(this.Button, { buttonStyle: 'BLACK', themeIcon: 'upload', size: 'SMALL' }).on('click', this.uplFn).end().
        end().
        start('td').attr('align', 'left').
          start(this.Button).add('describe'/*this.ofId*/).on('click', this.desFn).end().
        end().
        start('td').attr('align', 'left').
          start(this.Button).add('api').on('click', this.apiFn).end().
        end().
        start('th').attr('align', 'left').
        start(this.Button, { buttonStyle: 'LINK', size: 'SMALL'}).addClass(this.myClass('name-btn')).add(this.shortName).on('click', this.daoFn).end().
        end().
        start('td').attr('align', 'left').
          style({
            textWrapMode: 'nowrap',
            overflow: 'hidden',
            paddingRight: '8px',
          }).add(this.description).
        end();
    }
  ],

  listeners: [
    {
      name: 'addFn',
      code: function() {
        this.eval_(`add ${this.shortName}`);
      }
    },
    {
      name: 'uplFn',
      code: function() {
        this.eval_(`upload ${this.shortName}`);
      }
    },
    {
      name: 'daoFn',
      code: function() {
        this.eval_(`dao ${this.shortName}`);
      }
    },
    {
      name: 'desFn',
      code: function() {
        this.eval_('describe(' + this.ofId + ')');
      }
    },
    {
      name: 'apiFn',
      code: function() {
        this.eval_('api("' + this.name + '")');
      }
    }
  ]
});
