## Overview

Reflow is FOAM's **notebook-style interactive console** that enables creation of interactive documents, data analysis workflows, and visual programming environments<cite />. It provides a command-line interface where you can execute commands, visualize data, create reusable flows, and build interactive documents similar to Jupyter notebooks<cite />.

## Core Architecture

The system is built around three main components:

**1. Console** - The main controller (`foam.core.reflow.Console`) that manages execution context, scope variables, and flow state [2](#2-1) . It handles command parsing, execution, and output rendering.

**2. Flow Documents** - Persistent documents (`foam.core.reflow.Flow`) that store metadata, access control, and serialized scripts representing the document structure [3](#2-2) . Flows can be saved, loaded, and shared between users.

**3. Blocks** - Individual execution units that represent command executions with their output and nested child blocks [4](#2-3) . Each block is an accordion-style UI element that can contain output, configuration, and hierarchical nested blocks.

## Key Features

**Interactive Command Execution** - The console provides an extensible command system where commands are JavaScript functions or objects executed interactively [5](#2-4) . Built-in commands include:
- `help` - Display available commands
- `dao` - Create DAO prompt interface for data manipulation
- `upload` - Data upload interface supporting CSV, JSON, XML formats [6](#2-5)
- `flows` - List and manage saved flows
- `save`/`load` - Persist and restore flow documents

**Reactive Properties** - The system includes reactive detail views with dynamic formulas [7](#2-6) . Objects can have `reactions_` that automatically update properties based on formulas evaluated in the flow's scope context [8](#2-7) .

**Data Visualization** - Reflow includes DAO agents for visualizing data through charts and tables [9](#2-8) . The dashboard system provides bar charts, pie charts, and line charts with customizable colors and layouts [10](#2-9) .

**Hierarchical Structure** - The `Flowable` mixin provides hierarchical organization where blocks can contain nested child blocks [11](#2-10) . This enables complex document structures with collapsible sections and tree navigation [12](#2-11) .

**Scope Management** - The console maintains a combined scope of local and flow variables for command resolution [13](#2-12) . Commands can access and modify scope variables, enabling stateful interactive sessions.

## UI Components

The system includes several specialized UI components:
- **DynamicReflowComponents** - Searchable list of available commands [14](#2-13)
- **DynamicReflowData** - Collections and flows browser [15](#2-14)
- **DynamicReflowHelp** - Keyboard shortcuts reference [16](#2-15)
- **ReflowToolBar** - Toolbar controls for components, collections, flows, and help [17](#2-16)

## Notes

Reflow essentially provides an interactive programming environment within FOAM applications, similar to how Jupyter notebooks work for Python<cite />. It's particularly useful for data exploration, prototyping, and creating interactive documentation that combines code execution with rich output visualization<cite />. The system integrates deeply with FOAM's DAO system, allowing direct manipulation and visualization of data collections through the console interface<cite />.

Wiki pages you might want to explore:
- [Advanced Features and Extensions (kgrgreer/foam3)](/wiki/kgrgreer/foam3#7)

### Citations

**File:** src/foam/core/reflow/Console.js (L15-97)
```javascript
foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Flowable',

  topics: ['flowUpdated'],

  properties: [
    {
      name: 'flowParent',
      hidden: true,
      transient: true
    },
    {
      class: 'String',
      name: 'flowName',
      onKey: true
    },
    {
      class: 'Array',
      name: 'flowChildren',
      hidden: true
    },
    { name: 'value', hidden: true },
    {
      name: 'treeRowRenderer',
      hidden: true,
      value: function(e) { e.add(this.flowName$); }
    },
    {
      name: 'childType',
      hidden: true,
      transient: true,
      documentation: 'Default child type for this flowable',
      factory: function() { return this.cls_; }
    }
  ],

  methods: [
    function toSummary() {
      return this.flowName;
    },

    function createFlowChildName(prefix) {
      for ( var i = 1, name = prefix ; ; ) {
        name = prefix + i++;
        if ( ! this.findFlowChildByName(name) ) return name;
      }
    },

    function findFlowChildByName(n) {
      return this.flowChildren.find(c => {
        if ( c.flowName === n || (c.flowChildren?.length && c.findFlowChildByName(n)) )
          return true;
      });
    },

    function addFlowChild(f) {
      if ( f.deleted_ ) return;
      this.flowChildren$push(f);
      this.addFlowChild_ && this.addFlowChild_(f);
    },

    function removeFlowChild(f) {
      var index = this.flowChildren.indexOf(f);
      this.flowChildren = this.flowChildren.filter(c => c != f);
      this.removeFlowChild_ && this.removeFlowChild_(f);

      if ( this.selected === f ) {
        if ( this.flowChildren.length > 0 ) {
          var newIndex = Math.max(0, index - 1);
          this.selected = this.flowChildren[newIndex];
        } else {
          this.selected = null;
        }
      }
    },

    function removeAllFlowChildren() {
      this.removeFlowChild_ && this.flowChildren.forEach(c => this.removeFlowChild_(c));
      this.flowChildren = [];
    }
  ]
});
```

**File:** src/foam/core/reflow/Console.js (L395-616)
```javascript
  name: 'Block',
  extends: 'foam.u2.Accordion',

  requires: ['foam.u2.WrapperNode'],

  implements: [ 'foam.core.reflow.Flowable' ],

  imports: [ 'data', 'showPrompts', 'addToScope', 'selected' ],

  exports: [ 'addValue', 'log', 'out', 'as block' ],

  css: `
    ^ {
      padding: 4px;
    }
    ^:not(^hidePrompts) {
      border-bottom: 1px solid $borderLight;
    }
    ^output {
      overflow-x: auto;
    }
    ^hidePrompts ^toolbar {
      display: none;
    }
    ^prompt {
      display: flex;
      font-weight: bold;
      height: 20px;
      align-items: center;
    }
    ^ span .property-cmd { width: inherit; }
    ^ .foam-u2-TextField-cmd, ^ .foam-u2-ReadWriteView .foam-u2-TextField {
      border: none;
      height: 20px;
    }
    ^.block:hover:not(:has(.block:hover)) { background: $backgroundSecondary; }
    ^ .foam-u2-ReadWriteView { padding-right: 8px; }
    ^content {
      overflow-x: auto;
      width: 100%;
      height: fit-content;
      overflow-y: hidden;
      padding: 16px;
    }
    ^.expanded > ^toolbar {
      padding: 0 0 0.8rem 16px;
    }
    ^toolbar {
      padding: 16px;
    }
  `,

  sections: [
    {
      name: 'general',
      order: 100,
      properties: ['flowName', 'cmd']
    },
    {
      name: 'borderSettings',
      order: 200,
      properties: ['borderClass', 'border']
    }
  ],

  properties: [
    {
      name: 'flowName',
      reactive: false,
      label: 'Block Name',
      supportingLabel: 'Used to as the name for this block and as the variable name in the scope'
    },
    {
      class: 'String',
      name: 'cmd',
      visibility: 'RO',
      displayWidth: 80
    },
    [ 'value', null ],
    {
      name: 'out',
      hidden: true
    },
    {
      class: 'Class',
      name: 'borderClass',
      label: 'Border Type',
      factory: function() { return foam.u2.borders.NullBorder; },
      view: function(_,X) {
        // TODO: replace with strategizer
        // TODO: add a new card with title border that uses the foam.u2.borders.CardBorder
        // rather than foam.dashboard.view.Card
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
        // Dont save the class so that the ViewSpec doesnt convert to a view
        // The fromJSON should handle this but the scripts dont store the class
        // so parsing ignores all the fromJSON
        if ( n.class ) delete n.class;
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
    { name: 'togglerPosition', value: 'right', hidden: true },
    { name: 'expanded', value: true, hidden: true },
    {
      class: 'foam.u2.ViewSpec',
      name: 'configViewSpec',
      hidden: true,
      documentation: `Passed on to the ReactiveSectionedDetailView as config, see AbstractSectionedDetailView to learn more about configuring detail views`
    }
  ],

  methods: [
    function init() {
      let self = this;
      this.SUPER();
      this.content.tag(this.borderClass, { ...this.border }, self.borderEl_$);
      this.out = this.WrapperNode.create({ parentNode: this.content }, this);
      self.borderEl_.add(this.out);
    },
    function render() {
      this.on('click', this.onClick);
      this.addClass('block');
      this.enableClass(this.myClass('hidePrompts'), this.showPrompts$.not());
      this.title.add(this.flowName$);
      this.rightSection.tag(this.DEL, { label: ''});
      this.SUPER();
    },

    function addValue(o, skipOutput) {
      if ( ! skipOutput ) this.out.add(o);
      this.value = o;
    },

    function addFlowChild_(c) {
      this.addToScope(c);
      this.out.add(c);
    },

    function removeFlowChild_(c) {
      c.remove();
    },
    function log(...args) {
      if ( args.length == 0 ) return;
      if ( this.seen ) this.out.tag('br');
      this.seen = true;
      this.out.add(args.join(' '));
    },
    function outputJSON(json) {
      json.outputFObject_(this, this.cls_, [ this.FLOW_NAME, this.CMD, this.VALUE, this.FLOW_CHILDREN, this.REACTIONS_, this.BORDER_CLASS, this.BORDER ]);
    }
  ],

  actions: [
    {
      name: 'del',
      label: 'Delete',
      themeIcon: 'close',
      buttonStyle: 'TERTIARY',
      size: 'SMALL',
      code: function() {
        this.deleted_ = true;
        this.flowParent && this.flowParent.removeFlowChild(this);
      }
    }
  ],

  listeners: [
    {
      name: 'pubUpdate',
      on: ['this.propertyChange.borderClass', 'this.propertyChange.border'],
      code: function() {
        this.flowUpdated.pub();
      }
    },
    {
      name: 'replaceBorder',
      isFramed: true,
      on: ['this.propertyChange.borderClass'],
      code: function() {
        if ( ! this.WrapperNode.isInstance(this.out) ) return;
        let el = this.borderClass.create({...(this.border || {})}, this);
        this.out.moveTo(el);
        el.replaceElement_(this.borderEl_);
        this.borderEl_ = el;
      }
    },
    {
      name: 'onClick',
      code: function(e) {
        this.selected = this;
      }
    }
  ]
});

```

**File:** src/foam/core/reflow/Console.js (L830-885)
```javascript
foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Console',
  extends: 'foam.u2.Controller',

  implements: [ 'foam.core.reflow.Flowable' ],
  mixins: [ 'foam.u2.memento.Memorable' ],

  requires: [
    'foam.core.reflow.Flowable',
    'foam.core.reflow.ReflowHeader',
    'foam.core.reflow.ReactiveSectionedDetailView',
    'foam.core.reflow.ReflowConfigView',
    'foam.core.reflow.ReflowToolBar',
    'foam.core.reflow.ToolbarControl',
    'foam.core.reflow.Block',
    'foam.core.reflow.Flow',
    'foam.core.reflow.FlowMode',
    'foam.core.reflow.FlowableTree',
    'foam.core.reflow.Layout',
    'foam.dao.ArrayDAO',
    'foam.flow.Document',
    'foam.u2.Link'
  ],

  imports: [
    'commandDAO',
    'flowDAO',
    'params',
    'setTimeout',
    'toolbarControlDAO',
    'window',
    'showNav'
  ],

  exports: [
    'addToScope',
    'clearFlow',
    'createFlowChildName',
    'currentBlock',
    'eval_',
    'flowChildren',
    'scope',
    'localScope',
    'history_',
    'log',
    'mementoMgr',
    'moveFlowChild',
    'moveFlowChildAfter',
    'out',
    'save',
    'scrollToBottom',
    'selected',
    'showPrompts',
    'value as flow'
  ],
```

**File:** src/foam/core/reflow/Console.js (L1239-1344)
```javascript
    async function eval_(cmd, opt_ignoreSelect, ignoreHistory, flowParent) {
      /** opt_ignoreSelect if true, causes the evaled cmd to not become the selected block **/
      var self = this;
      flowParent = flowParent || this;

      cmd = cmd.trim();

      this.clearProperty('historyPosition');
      if ( ! cmd ) return;
      if ( ! ignoreHistory )
        this.addHistory(cmd);

      let blockType = flowParent?.childType || this.Block;

//      this.out.tag('br').start().show(self.showPrompts$).start('b').add('> ').end().add(cmd);
      var block = this.currentBlock = blockType.create({cmd: cmd, flowParent: flowParent}, flowParent);

      var innerScope = {
        // shell: this,
        block: block,
        eval_: this.eval_.bind(this),
        addValue: block.addValue.bind(block),
        log: block.log.bind(block),
        out: block.out, start: block.out.start.bind(block.out),
        tag: block.out.tag.bind(block.out)
      };

      // TODO: move into Block
      with ( this.localScope ) { with ( innerScope ) { with ( this.flowScope ) {
        let scope = { ...(this.scope || {} ), ...this.localScope };
        var r, arg;
        try {
          r = eval(cmd);
          if ( ! block.flowName ) {
            // For commands like 'cells(2,3)' pickout 'cells' as the block name
            var m = cmd.match(/^\s*([a-zA-Z][a-zA-Z0-9_\$]*)\(/);
            if ( m ) block.flowName = this.createFlowChildName(m[1]);
          }
        } catch (x) {
          var i = cmd.indexOf(' ');
          if ( i != -1 ) {
            arg = cmd.substring(i+1);
            cmd = cmd.substring(0,i);
            r = scope[cmd];
          } else {
            r = scope[cmd];
          }
          if ( r ) {
            block.flowName = this.createFlowChildName(cmd);
          } else {
            console.log(x);
            block.flowName = this.createFlowChildName('error');
            block.value = foam.lang.StringHolder.create({value: x.toString()});
            block.treeRowRenderer = function(e) {
              e.parentNode.addClass(self.myClass('error'));
              e.add(this.flowName);
            };
          }
        }

        // Name the block if it hasn't already been named
        if ( ! block.flowName ) block.flowName = this.createFlowChildName('a');

        if ( typeof r === 'function' ) {
          if ( ! block.flowName.startsWith(cmd) )
            block.flowName = this.createFlowChildName(cmd);
          r = arg ? r(arg) : r();
        }
        if ( r instanceof Promise ) {
          r = await r;
        }
      }}}

      // Re-set block in case the command changed currentBlock
      // block = this.currentBlock;

      flowParent.addFlowChild(block);

      if ( ! opt_ignoreSelect ) this.selected = block;

      if ( r ) {
        if ( foam.String.isInstance(r) ) {
          block.value = foam.lang.StringHolder.create({value: r});
          block.out.add(block.value.value$);
        } else if ( foam.Number.isInstance(r) ) {
          block.value = foam.lang.FloatHolder.create({value: r});
          block.out.add(block.value.value$);
        } else if ( foam.Boolean.isInstance(r) ) {
          block.value = foam.lang.BooleanHolder.create({value: r});
          block.out.add(block.value.value$);
        } else if ( foam.Date.isInstance(r) ) {
          block.value = foam.lang.DateTimeHolder.create({value: r});
          block.out.add(block.value.value$);
        } else {
          block.log(r);
        }
      }

      this.setTimeout(() => this.scrollToBottom(), 100);

      return block;
    },

    function addFlowChild_(c) {
      this.addToScope(c);
      this.out.add(c);
```

**File:** src/foam/core/reflow/Flow.js (L7-27)
```javascript
foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Flow',

  implements: [
    'foam.core.auth.Authorizable',
    'foam.core.auth.CreatedAware',
    'foam.core.auth.CreatedByAware',
    'foam.core.auth.LastModifiedAware',
    'foam.core.auth.LastModifiedByAware',
    'foam.core.auth.ServiceProviderAware'
  ],

  javaImports: [
    'foam.core.auth.AuthorizationException',
    'foam.core.auth.AuthService',
    'foam.core.auth.Subject',
    'foam.core.auth.User',
    'foam.lang.X',
    'foam.core.auth.AuthService',
    'java.util.Arrays'
```

**File:** src/foam/core/reflow/Upload.js (L101-142)
```javascript
foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Upload',

  implements: [ 'foam.mlang.Expressions' ],

  documentation: `
    Data upload component supporting file drag & drop or manual text input.
    Handles CSV, JSON, XML formats with auto-detection, column mapping,
    and bulk import to DAOs. Provides preview and progress tracking.

    When files are uploaded, their content is processed and moved to input.
    When input is manually cleared, uploadedFiles is cleared.
  `,

  requires: [
    'foam.dao.MDAO',
    'foam.lang.CountingSemaphore',
    'foam.lib.csv.CSVParser',
    'foam.core.reflow.ColumnParser',
    'foam.core.reflow.DAOHolder',
    'foam.core.reflow.Mapping',
    'foam.core.reflow.UploadAgent',
    'foam.parse.QueryParser',
    'foam.core.fs.fileDropZone.FileDropZone',
    'foam.core.fs.File'
  ],

  imports: [ 'currentBlock?', 'eval_?', 'setTimeout' ],

  exports: [
    'dao',
  ],

  constants: {
    SUPPORTED_FORMATS: {
      'text/csv': 'CSV',
      'application/json': 'JSON',
      'text/xml': 'XML',
      'text/plain': 'TXT'
    }
  },
```

**File:** src/foam/core/reflow/ReactiveDetailView.js (L7-40)
```javascript
foam.CLASS({
  package: 'foam.core.reflow',
  name: 'FObjectReactiveDetailViewRefinement',
  refines: 'FObject',

  properties: [
    {
      class: 'Map',
      generateJava: false,
      name: 'reactions_',
      searchable: false,
      hidden: true,
      shortName: 'r_',
      transient: true,
      factory: function() { return {}; },
      postSet: function(_, rs) {
        // Only start reactions if in the proper context
        if ( this.__context__.scope ) {
          for ( var key in rs ) {
            this.startReaction_(key, rs[key]);
          }
        }
        return rs;
      },
      isDefaultValue: function(v) {
        return Object.keys(v).length == 0;
      },
      toJSON: function(v) {
        var m = {};
        for ( key in v ) { m[key] = v[key].toString(); }

        return m;
      }
    }
```

**File:** src/foam/core/reflow/ReactiveDetailView.js (L44-73)
```javascript
    function addReaction(name, formula) {
      // TODO: stop any previous reaction
      this.reactions_[name] = formula;
      this.startReaction_(name, formula);
    },
    function startReaction_(name, formula) {
      // HACK: delay starting reaction in case we're loading a file
      // and dependent variables haven't loaded yet.
      window.setTimeout(function() {
        var self = this;
        var f;

        with ( this.__context__.scope ) {
          f = eval('(function() { return ' + formula + '})');
        }
        f.toString = function() { return formula; };

        var detached = false;
        self.onDetach(function() { detached = true; });
        var timer = function() {
          if ( detached ) return;
          if ( self.reactions_[name] !== f ) return;
          self[name] = f.call(self);
          self.__context__.requestAnimationFrame(timer);
        };

        this.reactions_[name] = f;
        timer();
      }.bind(this), 10);
    }
```

**File:** src/foam/core/reflow/AbstractDAOAgent.js (L328-361)
```javascript
/*
foam.CLASS({
  package: 'foam.core.reflow',
  name: 'TableDAOAgent',
  extends: 'foam.core.reflow.AbstractColumnAwareDAOAgent',

  methods: [
    function getSinkWithProjectionData(s) {
      s.columns = this.props;
      return s;
    },
    function getProjectionSink() { return foam.u2.mlang.Table.create({ columns: this.props }, this); },
    function getSink() { return foam.u2.mlang.Table.create({}, this); },
    function value(s) { return s; }
  ]
});
*/


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'CSVDAOAgent',
  extends: 'foam.core.reflow.AbstractColumnAwareDAOAgent',

  requires: [ 'foam.dao.CSVSink', 'foam.core.reflow.CopyFromBorder' ],

  methods: [
    function value(s) { return foam.lang.StringHolder.create({value: s.csv}); },
    function getSinkWithProjectionData(s) { return s; },
    function getProjectionSink() { return this.CSVSink.create({ of: this.of, props: this.props }); },
    function getSink() { return this.CSVSink.create({of: this.of}); },
    function addSinkToE(e, s) { e.start(this.CopyFromBorder).add(s); }
  ]
});
```

**File:** src/foam/core/reflow/dashboard/DashboardDAOAgents.js (L1-43)
```javascript
/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * Dashboard DAOAgents for FLOW Integration
 *
 * These agents adapt FOAM dashboard components to work with FLOW and DAOPrompt2.
 * They bridge the gap between FOAM's widget-based dashboard system and FLOW's
 * command-based interactive document system.
 */

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'ColorMappingMixin',

  documentation: 'Mixin providing centralized color management for charts with user control over color mappings',

  properties: [
    {
      class: 'StringArray',
      of: 'Color',
      name: 'colors',
      label: 'Chart Colors',
      view: {
        class: 'foam.u2.view.ArrayView',
        valueView: 'foam.u2.view.ColorEditView',
        defaultNewItem: foam.lang.Color.create()
      }
    }
  ],

  methods: [

    function addColorMappingToE(e) {
      // Helper method to add color controls to UI
      e.start('div').style({marginBottom: '10px'})
        .add('Colors: ', this.COLORS)
      .end();
    }
  ]
```

**File:** src/foam/core/reflow/FlowableTree.js (L7-97)
```javascript
foam.CLASS({
  package: 'foam.core.reflow',
  name: 'FlowableTree',
  extends: 'foam.u2.View',

  imports: [ 'moveFlowChild', 'moveFlowChildAfter' ],

  css: `
    ^ {
      width: 100%;
    }
    ^ table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      padding-top: 8px;
    }
    ^ table td {
      display: flex;
      justify-content: space-between;
      padding: 10px 8px;
      align-items: center;
      cursor: pointer;
      border: 1px solid $borderLight;
      border-radius: 4px;
      border-spacing: 0!important;
    }

    ^ table td .close button {
      padding: 4px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    ^selected {
      background: $backgroundTertiary;
      font-weight: 500;
    }
    ^left-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px;
      border-bottom: 1px solid $borderLight;
      font-weight: bold;
      font-size: 16px;
    }

    ^icon-holder {
      display: flex;
      justify-content: center;
      align-items: center;
    }
    ^element-row {
      padding: 10px;
    }
    ^element-row-content {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    ^element-row-icon {
      color: $textBrand;
    }
    td^moveTarget {
      background: rgba(0,0,0,0);
      border: none!important;
      width: 100%;
      height: 8px;
      padding: 0!important;
      margin: 0!important;
    }
    ^activeTarget {
      background: lightblue!important;
    }
  `,

  properties: [
    'selected',
    {
      class: 'Boolean',
      name: 'isMenuOpen',
      value: true
    }
  ],

  methods: [
    function renderClosed(e) {
```

**File:** src/foam/core/reflow/DynamicReflowComponents.js (L8-79)
```javascript
foam.CLASS({
  package: 'foam.core.reflow',
  name: 'DynamicReflowComponents',
  extends: 'foam.u2.View',

  requires: [
    'foam.core.reflow.CommandItemView'
  ],

  imports: [
    'commandDAO'
  ],

  css: `
    ^container {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    ^command-list {
      display: flex;
      flex-direction: column;
      gap: 5px;
      max-height: 200px;
      overflow-y: auto;
      padding-top: 10px;
    }
    ^header {
      font-size: 14px;
      font-weight: 600;
      border-bottom: 1px solid $borderLight;
      padding-bottom: 5px;
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'filterSearch',
      placeholder: 'Search...'
    },
    {
      name: 'commands',
      factory: function() { return []; }
    }
  ],

  methods: [
    async function render() {
      var self = this;
      const commandsSink = await this.commandDAO.select();
      this.commands = commandsSink.array;

      this.addClass()
        .start().addClass(this.myClass('container'))
          .start().addClass(this.myClass('header'))
            .add('Components')
          .end()
          .tag(this.FILTER_SEARCH, { data$: this.filterSearch$ })
          .add(this.dynamic(function(filterSearch, commands) {
            var search = (filterSearch || '').toLowerCase();
            var filtered = commands.filter(c =>
              !search || (c.description && c.description.toLowerCase().includes(search))
            );
            this.start().addClass(self.myClass('command-list'))
              .forEach(filtered, function(command) {
                if ( ! command.linkable ) return;
                this.start(self.CommandItemView, { data: self.data, command: command.id, description: command.description });
              })
          }))
        .end();
    }
```

**File:** src/foam/core/reflow/DynamicReflowData.js (L8-103)
```javascript
foam.CLASS({
  package: 'foam.core.reflow',
  name: 'DynamicReflowData',
  extends: 'foam.u2.View',

  requires: [
    'foam.u2.UnderlinedTabs',
    'foam.u2.Tab',
    'foam.core.boot.CSpec',
    'foam.core.reflow.CommandItemView'
  ],

  imports: [
    'AuthenticatedCSpecDAO as cSpecDAO',
    'flowDAO'
  ],

  css: `
    ^container {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    ^collection-list {
      display: flex;
      flex-direction: column;
      gap: 5px;
      max-height: 200px;
      overflow-y: auto;
      padding-top: 10px;
    }
    ^header {
      font-size: 14px;
      font-weight: 600;
      border-bottom: 1px solid $borderLight;
      padding-bottom: 5px;
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'filterSearch',
      onKey: true,
      placeholder: 'Search...'
    },
    {
      name: 'header',
      value: 'Collections'
    },
    {
      name: 'dataType',
      value: 'collections'
    },
    {
      name: 'collections',
      value: []
    }
  ],

  methods: [
    async function render() {
      var self = this;
      if ( this.dataType == 'collections' ) {
        const collectionsSink = await this.cSpecDAO.where(this.CSpec.DAOS).select();
        this.collections = collectionsSink.array;
      } else if ( this.dataType == 'flows' ) {
        const flowsSink = await this.flowDAO.select();
        this.collections = flowsSink.array;
      } else {
        this.collections = [];
      }

      this.addClass()
        .start().addClass(this.myClass('container'))
          .start().addClass(this.myClass('header'))
            .add(this.header)
          .end()
          .tag(this.FILTER_SEARCH, { data$: this.filterSearch$ })
          .add(this.dynamic(function(filterSearch, collections) {
            var search = (filterSearch || '').toLowerCase();
            var filtered = collections.filter(c =>
              !search || (c.name && c.name.toLowerCase().includes(search))
            );
            this.start().addClass(self.myClass('collection-list'))
              .forEach(filtered, function(collection) {
                if ( self.dataType == 'collections' ) {
                  this.start(self.CommandItemView, { data: self.data, command: 'dao '+collection.name, description: collection.name });
                } else if ( self.dataType == 'flows' ) {
                  this.start(self.CommandItemView, { data: self.data, command: 'load '+collection.name, description: collection.name });
                }
              })
            .end();
          }))
        .end();
    }
```

**File:** src/foam/core/reflow/DynamicReflowHelp.js (L8-97)
```javascript
foam.CLASS({
  package: 'foam.core.reflow',
  name: 'DynamicReflowHelp',
  extends: 'foam.u2.View',

  constants: {
    COMMANDS: [
      {
        command: 'ESC',
        description: 'Toggle Propmt Display'
      },
      {
        command: 'Up',
        description: 'Previous from History'
      },
      {
        command: 'Down',
        description: 'Next from History'
      },
      {
        command: 'CMD + K / CTRL + K',
        description: 'Clear Flow'
      },
      {
        command: 'CTRL + `',
        description: 'Focus Input'
      },
      {
        command: 'Shift-Up',
        description: 'Select next command'
      },
      {
        command: 'Shift-Down',
        description: 'Select previous command'
      }
    ]
  },

  css: `
    ^container {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 400px;
      overflow-y: auto;
    }
    ^header {
      padding: 10px;
      border-bottom: 1px solid $borderLight;
      font-size: 14px;
      font-weight: bold;
    }
    ^command-container {
      padding: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      font-size: 14px;
      cursor: pointer;
    }
    ^command-container:hover {
      background-color: $backgroundSecondary;
    }
  `,

  properties: [],

  methods: [
    async function render() {

      var self = this;
      this.addClass()
        .start().addClass(this.myClass('container'))
          .start().addClass(this.myClass('header'))
            .add('Shortcuts')
          .end()

          .forEach(this.COMMANDS, function(command) {
            this.start().addClass(self.myClass('command-container'))
              .start('span')
                .add(command.command)
              .end()
              .start('span')
                .add(command.description)
              .end()
            .end()
          })
        .end();
    }
```

**File:** src/foam/core/reflow/control/ComponentsControl.js (L7-90)
```javascript
foam.CLASS({
  package: 'foam.core.reflow.control',
  name: 'ComponentsControl',
  extends: 'foam.u2.Element',

  requires: [ 'foam.core.reflow.DynamicReflowComponents', 'foam.u2.ToggleActionView' ],
  imports: [ 'eval_' ],

  css: `
    ^promptHolder {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 10px;
      position: relative;
      max-height: 30px;
    }
    ^expanded-island {
      position: absolute;
      bottom: 100%;
      margin-bottom: 10px;
      background-color: $backgroundDefault;
      border: 1px solid $borderLight;
      box-shadow: 0 0 10px 0 $borderLight;
      padding: 10px;
      min-width: 300px;
    }
  `,

  properties: [
    'data',
    {
      class: 'Boolean',
      name: 'opened',
      value: false
    },
    {
      name: 'buttonLabel',
      class: 'String',
      value: 'Components'
    },
    {
      name: 'buttonIcon',
      class: 'String',
      value: 'plus'
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'spec',
      factory: function() {
        return { class: 'foam.core.reflow.DynamicReflowComponents' }
      }
    }
  ],

  methods: [
    function init() {
      this.SUPER();
      window.addEventListener('mousedown', this.handleClickOutside);
    },

    function render() {
      var self = this;
      this.start().addClass(this.myClass('promptHolder'))
        .add(this.dynamic(function(opened) {
          if (opened) {
            this.start().addClass(self.myClass('expanded-island'), self.myClass('holder'))
              .start(self.spec, { data: self.data })
              .end();
          }
        }))
        .start()
        .startContext({ data: this })
        .tag(this.ToggleActionView, {
          action: this.COMPONENTS,
          label$: self.buttonLabel$,
          buttonStyle: 'SECONDARY',
          themeIcon$: self.buttonIcon$,
          actionState$: self.opened$
        })
        .endContext()
        .end()
        .end();
    }
```
