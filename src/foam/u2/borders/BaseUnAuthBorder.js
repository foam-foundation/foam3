/**
* @license
* Copyright 2024 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.borders',
  name: 'BaseUnAuthBorder',
  extends: 'foam.u2.borders.SplitScreenGridBorder',
  documentation: 'Border that can be used by unauthenticated views to display marketing materials, other themes can create their own or use this one',

  imports: ['theme', 'loginVariables','loginView?'],

  css: `
    << .cover-img-block1 {
      align-items: center;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      flex-wrap: nowrap;
    }
    <<image-one {
      height: auto;
      padding: 4rem;
    }
    <<grid {
      grid-gap: 0;
    }
    <<split-screen {
      position: relative;
      padding-right: 2rem;
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'imgPath',
      expression: function(loginVariables) {
        return loginVariables.imgPath || (this.theme?.largeLogo || this.theme?.logo);
      }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'leftView',
      documentation: 'Allows using U2 views as left half of the login page, takes precedence over imgPath',
      factory: function() {
        return this.loginView?.leftView;
      }
    },
    'split',
    {
      name: 'columnsConfigRight',
      value: {
        class: 'foam.u2.layout.GridColumns',
        columns: 6,
        lgColumns: 5,
        xlColumns: 5
      }
    },
    {
      name: 'columnsConfigLeft',
      value: {
        class: 'foam.u2.layout.GridColumns',
        columns: 6,
        lgColumns: 7,
        xlColumns: 7
      }
    }
  ],

  methods: [
    function init() {
      let self = this;
      if ( ! this.imgPath && ! this.leftView ) {
        this.tag('', {}, this.content$);
        return;
      }
      // RENDER EVERYTHING ONTO PAGE
      this
        .addClass(this.myClass(), this.myClass('grid'))
        .start(this.GUnit, { columns: this.columnsConfigLeft })
          .addClass(this.myClass('split-screen'))
          .call(function() {
            if ( ! self.leftView ) {
              this
                .addClass('cover-img-block1')
                .start('img')
                  .addClass(self.myClass('image-one'))
                  .attr('src', self.imgPath$)
                .end();
            } else {
              this.tag(self.leftView);
            }
          })
        .end()
        .start(this.GUnit, { columns: this.columnsConfigRight })
          .addClass(this.myClass('split-screen'))
          .tag('', null, this.content$)
        .end();
    }
  ]
});
