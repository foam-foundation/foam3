/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'LayoutUtils',
  sections: [
    {
      name: 'layoutSettings',
      isAvailable: function() {
        return this.__context__.layout;
      },
      order: 400,
      subtitle: "Settings for this block in it's current layout",
      properties: ['gridColumns', 'flexContainerType', 'flexValue']
    },
    {
      name: 'borderSettings',
      isAvailable: function() {
        return foam.core.reflow.LayoutBlock.isInstance(this);
      }
    }
  ],
  methods: [
    function outputJSON(json) {
      json.outputFObject_(this, this.cls_, [
        this.FLOW_NAME,
        this.CMD,
        this.VALUE,
        this.FLOW_CHILDREN,
        this.REACTIONS_,
        this.BORDER_CLASS,
        this.BORDER,
        this.GRID_COLUMNS,
        this.FLEX_CONTAINER_TYPE,
        this.FLEX_VALUE
      ]);
    }
  ],
  listeners: [
    {
      name: 'pubUpdate',
      on: ['border', 'borderClass', 'gridColumns', 'flexContainerType', 'flexValue'].map(v => `this.propertyChange.${v}`),
      code: function() {
        this.flowUpdated.pub();
      }
    }
  ]
})

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'LayoutBlock',
  extends: 'foam.core.reflow.Block',
  mixins: ['foam.u2.layouts.LayoutChild', 'foam.core.reflow.LayoutUtils'],


  imports: [ 'eval_ as importedEval', 'block', 'data as importedData'],
  exports: [
    'out',
    'eval_',
    'cmdHolder as layout'
  ],
  requires: [
    'foam.core.reflow.ReflowToolBar',
    'foam.core.reflow.LayoutNode',
    'foam.u2.layout.Layout'
  ],

  css: `
    ^ {
      padding: 0;
      overflow: hidden;
    }
    ^content {
      padding: 0;
    }
  `,
  properties: [
    {
      __copyFrom__: 'foam.core.reflow.Console.INPUT',
      hidden: true
    },
    {
      name: 'cmdHolder',
      hidden: true
    },
    {
      name: 'out',
      getter: function() {
        return this.cmdHolder;
      }
    },
    {
      class: 'Class',
      name: 'borderClass',
      label: 'Border Type',
      factory: function() { return foam.u2.borders.NullBorder; },
      view: function(_,X) {
        return {
          class: 'foam.u2.view.ChoiceView',
          choices: [
            [foam.u2.borders.NullBorder, 'None'],
            [foam.u2.borders.CardBorder, 'Card'],
            [foam.u2.borders.BackgroundCard, 'Background'],
            [foam.u2.borders.SpacingBorder, 'Padding'],
            [foam.dashboard.view.CardWrapper, 'Card with Title']
          ]
        };
      }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'border',
      label: 'Border Properties',
      factory: function() { return {}; },
      preSet: function(_, n) {
        if ( n && n.class ) delete n.class;
        return n;
      },
      view: function (_, X) {
        return {
          class: 'foam.u2.view.ViewConfiguratorView',
          data_$: X.data$.dot('borderEl_'),
          allowClassChange: false
        };
      }
    },
    {
      name: 'borderEl_',
      hidden: true
    },
    {
      name: 'childType',
      factory: function() {
        return this.LayoutNode;
      }
    }
  ],
  methods: [
    function init() {
      this.SUPER();
      this.content.tag(this.borderClass, { ...(this.border || {}) }, this.borderEl_$);
    },
    function render() {
      let self = this;
      this.SUPER();
      this.addLayoutProps();
      this.
        addClass(self.myClass()).
        tag(this.ReflowToolBar);

      this.borderEl_.tag(this.Layout, {}, this.cmdHolder$);
      let sub = () => {
        this.addValue(this.cmdHolder, true);
      };
      this.cmdHolder$.sub(sub);
      sub();
    },
    function eval_(...args){
      if ( ! args[3] || args[3] == this.flowParent )
        args[3] = this;
      return this.importedEval(...args);
    }
  ],
  listeners: [
    {
      name: 'replaceBorder',
      isFramed: true,
      on: ['this.propertyChange.borderClass'],
      code: function() {
        let el = this.borderClass.create({ ...(this.border || {}) }, this);
        if ( this.borderEl_ ) {
          el.replaceElement_(this.borderEl_);
        } else {
          this.content.add(el);
        }
        this.borderEl_ = el;
        this.borderEl_.tag(this.Layout, {}, this.cmdHolder$);
      }
    },
    {
      name: 'onInput',
      code: function() {
        var input = this.input;
        this.input = '';
        this.eval_(input);
      }
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'LayoutNode',
  extends: 'foam.core.reflow.Block',
  mixins: ['foam.u2.layouts.LayoutChild', 'foam.core.reflow.LayoutUtils'],
  css: `
    ^ {
      overflow: hidden;
    }
  `,
  methods: [
    function render() {
      this.addLayoutProps();
      this.SUPER();
    }
  ]
});
