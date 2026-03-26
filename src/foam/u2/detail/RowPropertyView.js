/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.detail',
  name: 'RowPropertyView',
  extends: 'foam.u2.PropertyBorder',
  mixins: ['foam.u2.layout.ContainerWidth'],
  requires: ['foam.u2.ControllerMode'],

  documentation: `
    View a property's columnLabel and value in a single row. The table cell formatter
    will be used to render the value.
  `,

  imports: ['objData'],
  css: `
    ^row {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      gap: 2rem;
      align-items: center;
    }
    ^label{
      display: inherit;
      flex-basis: 50%;
      font-weight: normal;
    }
    ^body{
      flex-shrink: 2;
      font-family: monospace;
    }
    ^ > .note {
      white-space: pre;
      width: 100%;
      text-align: center;
    }
  `,

  properties: [
    'prop',
    'isRow_'
  ],

  methods: [
    function render() {
      const self = this;
      const sup = this.SUPER;
      this.initContainer();
      if ( this.__context__.controllerMode$ )
        this.controllerMode$.follow(this.__context__.controllerMode$);
      this.isRow_$ = this.inlineSize$.map(v => v > foam.u2.layout.DisplayWidth.XS.minWidth);
      // dynamic is implemented manually and not through add() here as the sup.call() will always add to "this" element and
      // not to the dynamic node. Hence removal has to be performed on this element.
      // Hijack prop label and view and replace them with the table-esque variant
      let label = self.prop.columnLabel;
      this.config = { label: label };
      this.dynamic(function(isRow_, mode) {
        this.removeAllChildren();
        switch ( mode ) {
          case self.ControllerMode.CREATE:
          case self.ControllerMode.EDIT:
            sup.call(self);
            break;
          case self.ControllerMode.VIEW:
            this.enableClass(self.myClass('row'), isRow_);
            if ( ! isRow_ ) {
              sup.call(self);
            } else {
              this
                .start()
                  .add(label).show(label)
                  .addClass(self.myClass('label'))
                .end()
                .add(self.slot(function(data, objData) {
                  const el = self.E();
                  const prop = self.prop;
                  prop.tableCellFormatter.format(
                    el,
                    prop.f ? prop.f(self.objData || self.data) : null,
                    self.objData || self.data,
                    prop
                  );
                  return el.addClass(self.myClass('body'))
                }));
            }
            break;
          default:
            console.warn('Unrecognized mode: ' + mode);
        }
      }, this.isRow_$, this.controllerMode$);
    }
  ]
});
