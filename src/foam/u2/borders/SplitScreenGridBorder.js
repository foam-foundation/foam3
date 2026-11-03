/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.borders',
  name: 'SplitScreenGridBorder',
  extends: 'foam.u2.layout.Grid',

  imports: [
    'displayWidth'
  ],

  requires: [
    'foam.u2.layout.Grid',
    'foam.u2.layout.GUnit'
  ],

  css: `
    <<grid {
      grid-gap: clamp(1rem, 1.5vmax, 5rem);
      height: 100%;
    }
    
    /* vertically center the 2 sides of splitscreen */
    <<split-screen {
      display: flex;
      align-content: center;
      justify-content: center;
      align-items: center;
    }

    /* TODO: Remove this when U3 allows non-E() adds */
    <<split-screen > *{
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
    }
  `,

  properties: [
    'leftPanel',
    {
      name: 'columnsConfigLeft',
      documentation: 'Can be provided to customize how the columns respond to resize',
      flags: ['web'],
      value: {
        class: 'foam.u2.layout.GridColumns',
        columns: 12,
        lgColumns: 6,
        xlColumns: 6
      }
    },
    'rightPanel',
    {
      name: 'columnsConfigRight',
      documentation: 'Can be provided to customize how the columns respond to resize',
      flags: ['web'],
      value: {
        class: 'foam.u2.layout.GridColumns',
        columns: 12,
        lgColumns: 6,
        xlColumns: 6
      }
    },
  ],

  methods: [
    function init() {
      this.SUPER();
      this
        .addClass(this.myClass(), this.myClass('grid'))
          .start(this.GUnit, { columns: this.columnsConfigLeft })
            .addClass(this.myClass('split-screen'))
            .tag('', null, this.leftPanel$)
          .end()
          .start(this.GUnit, { columns: this.columnsConfigRight })
            .addClass(this.myClass('split-screen'))
            .tag('', null, this.rightPanel$)
          .end();
    }
  ]
});


