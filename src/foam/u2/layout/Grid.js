/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.layout',
  name: 'Grid',
  extends: 'foam.u2.View',

  mixins: [ 'foam.u2.layout.ContainerWidth' ],

  documentation: 'A grid of responsive elements',

  requires: [ 'foam.u2.layout.GUnit' ],

  imports: [ 'data? as importedData' ],

  css: `
    ^ {
      display: grid;
      grid-gap: 24px 12px;
    }
  `,

  methods: [
    function init() {
      // Override the behaviour of 'foam.u2.View' by exporting the __context__'s
      // data as 'data' instead of this view's data. We do this because we don't
      // want this view to change the context data, which child views might want to
      // access.
      if ( this.importedData )
        this.data$ = this.importedData$;
      this.SUPER();
    },
    async function render() {
      this.SUPER();
      this.addClass();
      this.initContainer();
      this.style(
        { 'grid-template-columns': this.containerWidth$.map(dw => {
            dw = dw || foam.u2.layout.DisplayWidth.XL;
            return `repeat(${dw.cols}, 1fr)`;
          })
        }
      );
    },

    function add_() {
      this.SUPER(...arguments);
      this.resizeChildren();
      return this;
    }
  ],

  listeners: [
    {
      name: 'resizeChildren',
      on: ['this.propertyChange.containerWidth', 'this.propertyChange.mode'],
      isFramed: true,
      code: function() {
        if ( ! this.U3 )
          if ( this.state == this.OUTPUT ) return;

        this.shown = false;
        this.children.forEach(ret => {
          var cols = 12, width = 12;
          if ( this.containerWidth ) {
            cols = this.containerWidth.cols;
            let propCols;
            if ( this.GUnit.isInstance(ret) ) {
              propCols = (this.__subContext__.controllerMode == 'EDIT' ? ret.rwColumns : ret.columns)[`${this.containerWidth.name.toLowerCase()}Columns`];
            }
            width = Math.min(propCols || cols, cols);
          }

          ret.style({
            'grid-column': `span ${width}`
          });
        });
        this.shown = true;
      }
    }
  ]
});
