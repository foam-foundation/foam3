/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.detail',
  name: 'TabularSectionView',
  extends: 'foam.u2.detail.SectionView',
  description: `
    Render a section as an unstyled table.
  `,

  requires: [
    'foam.u2.detail.RowPropertyView'
  ],

  css: `
    ^ > .foam-u2-layout-Rows > .foam-u2-layout-Grid {
      grid-row-gap: 0 !important;
    }
    ^ > ^rows > ^grid > div {
      padding: 1rem;
    }
    ^ > ^rows > ^grid > div:nth-child(even of :not(.foam-u2-Element-hidden)) {
      background: $backgroundSecondary;
    }
  `,

  properties: [
    ['hideActions', true],
    {
      name: 'config',
      expression: function(section){
        var newPropOverrides = {};

        section.properties.forEach(prop => {
          newPropOverrides[prop.name] = { gridColumns: 12 } 
        })
    
        return newPropOverrides;
      }
    }
  ],

  methods: [
    function init () {
      const x = this.__context__.createSubContext();
      x.register(this.RowPropertyView, 'foam.u2.PropertyBorder');
      this.__context__ = x;
    }
  ]
});
