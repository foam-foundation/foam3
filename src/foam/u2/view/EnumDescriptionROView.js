/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'EnumDescriptionROView',
  extends: 'foam.u2.View',
  documentation: 'View for displaying Enum values with descriptions',
  requires: ['foam.u2.borders.CardBorder'],
  exports: ['controllerMode'],
  css: `
    ^card.foam-u2-borders-CardBorder {
      position: relative;
      display: flex;
      padding: 1.6rem 1.2rem;
      flex-direction: column;
      align-items: flex-start;
      gap: 2.4rem;
      border-radius: 0.8rem;
      border: none;
    }
    ^statusLabel {
      display: flex;
      align-items: center;
      gap: 0.4em;
    }
    ^hr {
      position: absolute;
      top: 4.9rem;
      height: 0.1rem;
      width: 100%;
      left: 0;
    }
  `,
  properties: [
    {
      name: 'controllerMode',
      value: 'VIEW'
    },
    {
      class: 'Map',
      name: 'descriptionOverrides',
      description: 'Provide override view for descriptions of enum values, useful to show U2 views instead of text'
    }
  ],
  methods: [
    function render() {
      let self = this;
      this
        .addClass()
        .start(this.CardBorder)
          .addClass(this.myClass('card'))
          .style({ background: this.data$.dot('background').map(v => this.setColor(v)) })
          .start().addClass(this.myClass('statusLabel')).start().addClass('h600').add('Status: ').end().tag(this.data$.map(v => v?.LABEL)).end()
          .start().style({ background: this.data$.dot('color').map(v => this.setColor(v)) }).addClass(this.myClass('hr')).end()
          .add(this.slot(function(data, descriptionOverrides) {
            let e = this.E().style({ display: 'contents' });
            if ( self.descriptionOverrides[data] ) {
              e.tag(self.descriptionOverrides[data]);
            } else {
              e.add(this.data?.DESCRIPTION);
            }
            return e;
          }))
        .end();
    }
  ],
  listeners: [
    {
      name: 'setColor',
      code: function(token) {
        if ( ! token ) return '';
        return foam.CSS.returnTokenValue(token, this.cls_, this.__subContext__);
      }
    },
  ]
});
