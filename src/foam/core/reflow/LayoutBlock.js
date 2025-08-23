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
  // Allows nesting layouts
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
    { name: 'border', hidden: true },
    { name: 'borderClass', hidden: true },
    {
      name: 'childType',
      factory: function() {
        return this.LayoutNode;
      }
    }
  ],
  methods: [
    function render() {
      let self = this;
      this.SUPER();
      this.addLayoutProps();
      this.
        addClass(self.myClass()).
        tag(this.ReflowToolBar);
      this.content.tag(this.Layout, {}, this.cmdHolder$);
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
