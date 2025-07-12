/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Bugs:
//  - Command.execute_ Action doesn't work in TableView because it has the wrong Context
//  - shows extra line between blocks

// Features:
//  - put current user in Context, use in Signature
//  ? how are Commands different than flows?
// ???: Would it be better to have compose rather than mixing Flowable?

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Flowable',

  properties: [
    {
      name: 'flowParent',
      transient: true
    },
    {
      class: 'String',
      name: 'flowName'
    },
    {
      class: 'List',
      name: 'flowChildren',
      transient: true
    },
    { name: 'value' }
  ],

  methods: [
    function createFlowChildName(prefix) {
      for ( var i = 1, name = prefix ; ; ) {
        name = prefix + i++;
        if ( ! this.findFlowChildByName(name) ) return name;
      }
    },

    function findFlowChildByName(n) {
      return this.flowChildren.find(c => c.flowName === n);
    },

    function addFlowChild(f) {
      if ( f.deleted_ ) return;
      this.flowChildren = this.flowChildren.concat([f]);
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


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ReflowHeader',
  extends: 'foam.u2.View',

  requires: [
    'foam.u2.dialog.ConfirmationModal',
    'foam.log.LogLevel'
  ],

  imports: [
    'stack',
    'notify'
  ],

  messages: [
    { name: 'PROVIDE_NAME', message: 'Please provide a name to save your Flow' },
  ],

  css: `
    ^navigator {
      display: flex;
      align-items: center;
      gap: 5px;
      color: $grey700;
      font-weight: bold;
    }
    ^header-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    ^chevron {
       color: $grey700;
    }
    ^title input {
      border: none;
      color: $black;
    }
    ^header-actions {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    ^save-text {
      color: $grey700;
    }
  `,

  properties: [
    'showPrompts'
  ],

  methods: [
    function render() {
      let self = this;
      this.addClass()
        .start().addClass(this.myClass('header-container'))
          .start().addClass(this.myClass('navigator'))
            // .tag(this.HOME)
            // .start(foam.u2.tag.Image, {
            //   glyph: 'rightChevron',
            //   embedSVG: true
            // }).addClass(this.myClass('chevron')).end()
            .startContext({data: this})
              .tag(this.REFLOWS)
            .endContext()
            .start(foam.u2.tag.Image, {
              glyph: 'rightChevron',
              embedSVG: true
            }).addClass(this.myClass('chevron')).end()
            .start('span').addClass(this.myClass('title')).add(this.data.FLOW_NAME).end()
          .end()

          .start().addClass(this.myClass('header-actions'))
            .startContext({ data: this.data.mementoMgr })
              .tag(this.data.mementoMgr.BACK)
              .tag(this.data.mementoMgr.FORTH)
            .endContext()
            .startContext({data: this})
              .tag(this.CANCEL)
              .tag(this.SAVE)
              .tag(this.RESET)
              .tag(this.EDIT)
            .endContext()
            // callIf(this.data.showPrompts$, function() {
            //   this.start().addClass(self.myClass('save-text'))
            //     .add('The Flow is saved automatically')
            //   .end();
            // })
          .end()
        .end();
    }
  ],

  actions: [
    // {
    //   name: 'home',
    //   label: '',
    //   buttonStyle: foam.u2.ButtonStyle.TERTIARY,
    //   themeIcon: 'home',
    //   size: 'SMALL',
    //   code: function(X) {
    //     X.pushDefaultMenu()
    //   }
    // },
    {
      name: 'reflows',
      label: 'Reflows',
      buttonStyle: foam.u2.ButtonStyle.LINK,
      size: 'SMALL',
      code: function(X) {
        X.routeTo('flows');
      }
    },
    {
      name: 'edit',
      label: 'Edit View',
      buttonStyle: foam.u2.ButtonStyle.SECONDARY,
      size: 'SMALL',
      isAvailable: function(showPrompts) {
        return ! showPrompts;
      },
      code: function() {
        this.data.showPrompts = true;
      }
    },
    {
      name: 'cancel',
      label: 'Cancel',
      buttonStyle: foam.u2.ButtonStyle.SECONDARY,
      size: 'SMALL',
      isAvailable: function(showPrompts) {
        return showPrompts;
      },
      code: function() {
        var flow = this.data.value;

        flow.name     = '';
        this.mementoMgr.clear();
        flow.version  = undefined;
        flow.revision = undefined;

        this.data.showPrompts = false;

      }
    },
    {
      name: 'save',
      label: 'Save',
      buttonStyle: foam.u2.ButtonStyle.PRIMARY,
      size: 'SMALL',
      isAvailable: function(showPrompts) {
        return showPrompts;
      },
      code: function() {
        if ( this.data.flowName && this.data.flowName !== '' ) {
          this.data.eval_(`save ${this.data.flowName}`);
          this.data.showPrompts = false;
        } else {
          // Using error message instead of disabling the save button to provide users feedback on why it’s not working.
          this.notify(this.PROVIDE_NAME, '', this.LogLevel.ERROR, true);
        }
      }
    },
    {
      name: 'confirmReset',
      label: 'Yes, Confirm',
      buttonStyle: foam.u2.ButtonStyle.PRIMARY,
      size: 'SMALL',
      isAvailable: function(showPrompts) {
        return showPrompts;
      },
      code: function() {
        this.data.eval_('clear');
        var flow = this.data.value;

        flow.name     = '';
        this.mementoMgr.clear();
        flow.version  = undefined;
        flow.revision = undefined;
      }
    },
    {
      name: 'reset',
      label: 'New',
      buttonStyle: foam.u2.ButtonStyle.TERTIARY,
      size: 'SMALL',
      isAvailable: function(showPrompts) {
        return showPrompts;
      },
      code: function() {
        let confirmationModal = this.ConfirmationModal.create({
          title: `Unsaved changes will be lost, are you sure you want a New Reflow page?`,
          primaryAction: this.CONFIRM_RESET,
          showCancel: true,
          modalStyle: 'DESTRUCTIVE',
          data: this
        });
        this.add(confirmationModal);
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'FlowableTree',
  extends: 'foam.u2.View',

  css: `
    ^ {
      width: 100%;
    }
    ^ table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 10px;
    }
    ^ table td {
      display: flex;
      justify-content: space-between;
      padding: 10px 8px;
      align-items: center;
      cursor: pointer;
      border: 1px solid $borderLight;
      border-radius: 4px;
    }

    ^ table td .close button {
      padding: 4px;
    }

    ^selected {
      background: $backgroundTertiary;
      font-weight: 500;
    }
    ^error {
      background: $backgroundDestructiveTertiary;
      color: $textDestructive;
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
      color: $primary500;
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
      var self = this;
      e.start().addClass(this.myClass('icon-holder'))
          .startContext({ data: this })
            .tag(this.MENU_CONTROL)
          .endContext()
        .end();
    },

    function renderOpened(e) {
      e.start().addClass(this.myClass('left-container'))
        .start().addClass(this.myClass('left-header'))
          .start('span').add('Contents').end()
          .startContext({ data: this })
            .tag(this.MENU_CONTROL)
          .endContext()
        .end()
        .start('table')
          .attr('cellpadding', '4')
          .call(this.branch, [this, this.data, 0])
        .end();
    },

    function render() {
      var self = this;
      this.addClass();
      this.add(this.dynamic(function(isMenuOpen) {
        if (isMenuOpen) {
          self.renderOpened(this);
        } else {
          self.renderClosed(this);
        }
      }))
    },

    function branch(self, data, depth) {
      this.add(data.dynamic(function (flowName) {
        this.start('tr').
          on('click', () => self.selected = data).
          on('dblclick', () => data.expanded = ! data.expanded).
          start('td').
            addClass(self.myClass('element-row')).
            enableClass(self.myClass('error'), flowName.startsWith('error')).
            style({'marginLeft': (depth * 12) + 'px'}).
            enableClass(self.myClass('selected'), self.selected$.map(s => s === data)).
            start().
              addClass(self.myClass('element-row-content')).
              callIfElse(data.cmd && data?.cmd?.includes('dao'), function() {
                this.start(foam.u2.tag.Image, {
                  glyph: 'grid',
                  embedSVG: true
                }).addClass(self.myClass('element-row-icon')).end()
              }, function() {
                this.start(foam.u2.tag.Image, {
                  glyph: 'rectangle',
                  embedSVG: true
                }).addClass(self.myClass('element-row-icon')).end()
              }).
              callIfElse(flowName, function() { this.add(flowName); }, function() { this.start('i').add('Unnamed'); }).
            end().
            callIf(data.flowParent, function() {
              this.start().addClass('close').startContext({ data: data }).tag(self.CLOSE).endContext().end();
            }).
          end();
      }));
      this.add(data.dynamic(function (flowChildren) {
        this.forEach(flowChildren, d => {
          this.call(self.branch, [self, d, depth+1]);
        });
      }))
    }
  ],

  actions: [
    {
      name: 'close',
      label: '',
      themeIcon: 'close',
      buttonStyle: 'TERTIARY',
      size: 'SMALL',
      code: function() { this.flowParent.removeFlowChild(this); }
    },
    {
      name: 'menuControl',
      label: '',
      ariaLabel: 'Open/Close Menu',
      themeIcon: 'sidebar',
      buttonStyle: 'TERTIARY',
      size: 'SMALL',
      code: function() {
        this.isMenuOpen = ! this.isMenuOpen;
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Block',
  extends: 'foam.u2.Accordion',

  mixins: [ 'foam.core.reflow.Flowable' ],

  imports: [ 'data', 'showPrompts' ],

  exports: [ 'addValue', 'log', 'out', 'as block' ],

  css: `
    ^ {
      padding: 4px;
    }
    ^:not(^hidePrompts) {
      border-top: 1px solid #999;
      padding: 8px 16px;
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
    ^:hover { background: $backgroundSecondary; }
    ^ .foam-u2-ReadWriteView { padding-right: 8px; }
    ^content {
      overflow-x: auto;
      width: 100%;
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'cmd',
      displayWidth: 80
    },
    [ 'value', null ],
    {
      name: 'out',
      getter: function() {
        return this.content;
      }
    },
    [ 'togglerPosition', 'left' ],
    [ 'expanded', true ],
    {
      class: 'foam.u2.ViewSpec',
      name: 'configViewSpec',
      documentation: `Passed on to the ReactiveSectionedDetailView as config, see AbstractSectionedDetailView to learn more about configuring detail views`
    }
  ],

  methods: [
    function render() {
      this.on('click', this.onClick);
      this.enableClass(this.myClass('hidePrompts'), this.showPrompts$.not());
      this.title.
        on('click', (e) => { e.stopPropagation();  e.preventDefault(); }).
        on('dblclick', (e) => { e.stopPropagation();  e.preventDefault(); }).
        start('span')
          .addClass(this.myClass('prompt')).start(foam.u2.ReadWriteView, {data$: this.flowName$})
        .end()
        .add(' = ')
        .add(this.CMD);
      this.rightSection.tag(this.DEL);
      this.SUPER();
    },

    function addValue(o, skipOutput) {
      if ( ! skipOutput ) this.out.add(o);
      this.value = o;
    },

    function log(...args) {
      if ( args.length == 0 ) return;
      if ( this.seen ) this.out.tag('br');
      this.seen = true;
      this.out.add(args.join(' '));
    },

    function outputJSON(json) {
      json.outputFObject_(this, this.cls_, [ this.FLOW_NAME, this.CMD, this.VALUE ]);
    }
  ],

  actions: [
    {
      name: 'del',
      label: '',
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
      name: 'onClick',
      code: function() {
        this.data.selected = this;
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Layout',
  extends: 'foam.u2.Element',

  css: `
    ^ {
      display: grid;
      grid-template-rows: max-content;
      height: 100%;
      min-height: 100vh;
    }
    ^flex-container {
      display: flex;
      flex-direction: row;
      overflow: auto;
    }
    ^header {
      padding: 10px;
      height: fit-content;
      max-height: 64px;
      background-color: $white;
      border-bottom: 1px solid $grey200;
    }
    ^l {
      padding: 4px;
      background-color: $white;
      width: 15%;
      border-right: 1px solid $grey200;
    }
    ^middle-holder {
      padding: 16px 16px 0 16px;
      width: 100%;
      background-color: $grey100;
      overflow: auto;
      flex: 1 1 50%;
    }
    ^m {
       border: 2px dashed $grey200;
       overflow-x: auto;
       background-color: $white;
    }
    ^r {
      overflow-y: auto;
      width: 30%;
      background-color: $white;
      transition: width 0.1s;
    }
    ^resize-handle {
      width: 6px;
      cursor: ew-resize;
      background: $primary100;
      height: 100%;
      z-index: 10;
    }

    ^r .foam-core-reflow-SinkView, .foam-u2-view-IntView {
      width: 100%;
    }

    ^ .foam-u2-RangeView-skip {
      width: 100%;
    }

    ^menuClosed {
     width: fit-content;
    }

    ^r .foam-u2-view-TitledArrayView-value-view-container {
      border: 1px solid $grey200;
      padding: 10px;
      border-radius: 4px;
    }
    ^r .foam-u2-PropertyBorder-select {
      padding: 5px;
      background-color: $grey200;
      border-radius: 4px;
      gap: 10px;
    }
    ^r .foam-u2-PropertyBorder-view {
      width: 100%;
    }
    ^r .foam-core-reflow-PropertyListView {
      justify-content: space-between;
    }
    @media (min-width: /*%DISPLAYWIDTH.XL%*/ 1280px ) {
      ^middle-holder {
        padding: 24px 24px 0 24px;
      }
    }
  `,

  properties: [
    'showLeft',
    'showRight',
    'showHeader',
    'isMenuOpen',
    'left',
    'middle',
    'right',
    'header',
    {
      class: 'Int',
      name: 'rightWidth',
      value: 300
    }
  ],

  methods: [
    function render() {
      var self = this;
      this.
        addClass().
        start('div', {}, this.header$).addClass(this.myClass('header')).show(this.showHeader$).end().
        start().addClass(this.myClass('flex-container')).
          start('div', {}, this.left$)
            .addClass(this.myClass('l'))
            .enableClass(this.myClass('menuClosed'), this.isMenuOpen$.map(open => !open))
            .show(this.showLeft$)
          .end().
          start().addClass(this.myClass('middle-holder'))
            .start('div', {}, this.middle$).addClass(this.myClass('m')).end()
          .end()
          // --- Resize handle ---
          .start('div')
            .addClass(this.myClass('resize-handle'))
            .on('mousedown', this.onResizeStart)
          .end()
          // --- Right sidebar ---
          .start('div', {}, this.right$)
            .addClass(this.myClass('r'))
            .style({ width: this.rightWidth$.map(w => w + 'px') })
            .show(this.showRight$)
          .end()
        .end();
    },
  ],
  listeners: [
    function onResizeStart(e) {
      var self = this;
      var startX = e.clientX;
      var startWidth = this.rightWidth;

      function onMouseMove(e) {
        var newWidth = startWidth - (e.clientX - startX);
        newWidth = Math.max(200, Math.min(newWidth, 1000));
        self.rightWidth = newWidth;
      }

      function onMouseUp() {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      }

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
  ]

});


foam.ENUM({
  package: 'foam.core.reflow',
  name: 'FlowMode',
  values: [ 'EDIT', 'VIEW', 'RO', 'CONSOLE' ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Console',
  extends: 'foam.u2.Controller',

  mixins: [ 'foam.core.reflow.Flowable', 'foam.u2.memento.Memorable' ],

  requires: [
    'foam.core.reflow.ReflowHeader',
    'foam.core.reflow.ReactiveSectionedDetailView',
    'foam.core.reflow.RightSidebarOutputView',
    'foam.core.reflow.ReflowToolBar',
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
    'scope?',
    'setTimeout',
    'toolbarControlDAO',
    'window',
    'showNav'
  ],

  exports: [
    'clearFlow',
    'createFlowChildName',
    'currentBlock',
    'eval_',
    'flowChildren',
    'flowScope as scope',
    'history_',
    'log',
    'out',
    'save',
    'scrollToBottom',
    'selected',
    'showPrompts',
    'value as flow'
  ],

  css: `
    ^ {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      position: relative;
      align-items: center;
      justify-content: center;
    }
    ^input-field {
      position: relative;
      margin-block-end: 0;
      display: inline-flex;
      width: 100%;
      align-items: center;
      position: sticky;
      bottom: 0;
      padding: 10px 8px;
    }
    ^input-field, ^input-field ^input {
      background: $backgroundSecondary;
    }
    ^output {
      flex: 1;
      overflow: auto;
      text-align: left;
      width: 100%
    }
    ^input-field .property-input {
      border: none !important;
    }
    ^ .foam-u2-view-ValueView {
      min-width: 220px;
    }
    .foam-core-reflow-Layout-l { overflow-y: auto; }
    ^ .foam-u2-ProgressView { width: 600px; }
    ^rightBar-title {
      border-bottom: 1px solid $borderLight;
      padding: 8px 16px;
    }
    ^rightBar {
      display: flex;
      flex-direction: column;

    }


  `,

  properties: [
    {
      class: 'String',
      name: 'route',
      memorable: true,
      postSet: async function(o, n) {
        if ( ! this.out ) return;
        if ( n !== this.flowName ) {
          this.clearFlow();
          if ( n ) {
            await this.eval_('preLoad');
            await this.eval_(`load("${n}")`);
            this.flowName = n;
            this.selected = this.currentBlock;
          }
        }
      }
    },
    {
      class: 'String',
      name: 'flowName',
      onKey: true,
      postSet: function(o, n) {
        this.route = n;
      }
    },
    {
      class: 'String',
      name: 'input',
      view: {
        class: 'foam.u2.TextField', // Avoids ModeAltView focus() issue
        autocomplete: 'off',
        onKey: false
      },
    },
    'input_', // Element pointer
    {
      name: 'out'
    },
    {
      class: 'Enum',
      of: 'foam.core.reflow.FlowMode',
      name: 'flowMode',
      factory: function() { return this.FlowMode.EDIT; },
      memorable: true
    },
    {
      name: 'showPrompts',
      value: true,
      expression: function(flowMode) {
        return flowMode === this.FlowMode.EDIT;
      },
      preSet: function(_, n) { return n === 'false' ? '' : n; },
      memorable: true
    },
    {
      name: 'showInput',
      value: true,
      preSet: function(_, n) { return n === 'false' ? '' : n; },
      expression: function(flowMode) {
        return flowMode != this.FlowMode.VIEW && flowMode != this.FlowMode.RO;
      },
      memorable: true
    },
    {
      class: 'StringArray',
      name: 'history_',
      factory: function() {
        try {
          return JSON.parse(this.window.localStorage[this.historyKey()]);
        } catch (x) {
        }
        return [];
      }
    },
    {
      class: 'Int',
      name: 'historyLength',
      value: 50
    },
    {
      class: 'Int',
      name: 'historyPosition',
      value: 0
    },
    {
      name: 'localScope',
      // TODO: contains commands, so maybe commandScope would be a better name
      factory: function() {
        return {
          this:   this,
          output: this.out // TODO: used?
        };
      }
    },
    {
      name: 'flowScope',
      factory: function() { return {}; }
    },
    'currentBlock',
    {
      name: 'selected',
      postSet: function(o, n) {
        if ( o === n ) return;
        this.selectedValue = n ? n.value : null;
        if (n && n.element_) {
          n.element_.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      },
      factory: function() { return this; }
    },
    {
      name: 'selectedValue'
    },
    {
      name: 'value',
      // The Console's Flow Value, which is the Flow object it is saved as
      factory: function() { return this.Flow.create(); }
    },
    {
      class: 'FObjectProperty',
      name: 'mementoMgr',
      factory: function() {
        return foam.memento.MementoMgr.create({memento$: this.value.script$, position$: this.value.revision$});
      }
    }
  ],

  methods: [
    async function includeFlow(name) {
      if ( ! name ) return;
      var flow = await this.flowDAO.find(name);

      if ( flow ) {
        await this.includeScript(flow.script);
      }
    },

    async function includeScript(script) {
      if ( ! script ) return;

      var cs = foam.json.parseString(script, this.__subContext__);

      for ( var i = 0 ; i < cs.length ; i++ ) {
        var c = cs[i];

        await this.eval_(c.cmd);

        this.currentBlock.flowName = c.flowName;

        if ( this.currentBlock.value && c.value ) {
          if ( c.value.clone ) c.value = c.value.clone(this.__subContext__);
          this.currentBlock.value.copyFrom(c.value);
        }

        await this.currentBlock.value?.onLoad?.();
      }

      // Call postLoad after all blocks have executed
      await this.eval_('postLoad');
    },

    function clearFlow() {
      this.removeAllFlowChildren();

      // Select the top-level FLOW object after clearing
      this.selected = this.value;
    },

    function historyKey() {
      return this.cls_.id + '_HISTORY';
    },

    async function render() {
      foam.u2.table.UnstyledTableView.SELECTED_COLUMN_NAMES.memorable = false;
      foam.u2.table.TableView.SELECTED_COLUMN_NAMES.memorable = false;

      let oldShowNav = this.showNav;
      this.showNav = false;
      this.onDetach(() => { this.showNav = oldShowNav;})
      this.SUPER();

      var self = this;

      // Add listener to restore navigation when leaving reflow
      this.onDetach(() => {
        this.showNav = true;
      });

      this.flowName$.sub(() => this.refreshFlowScope());
      this.value$.sub(() => this.refreshFlowScope());


      globalThis.shell = this; // for debugging

      // Doesn't work for some reason. Gets detached when new flow loaded
      // Replaced with postSet
      // this.selectedValue$.follow(this.selected$.dot('value'));

      // Add commands to localScope
      var cmds = await this.commandDAO.select();

      cmds.array.forEach(c => {
        this.localScope[c.id] = (...args) => {
          var cmd = c.clone(this.currentBlock);
          return cmd.execute.apply(cmd, args);
        }
      });

      // If this.value.script changes
      //   update this.flowChildren
      //   clearFlow()
      //   rebuild flow
      // If flowChildren changes
      //   update this.value.script

      this.value.script$.sub(this.onScriptChange);

      this.flowChildren$.sub(this.onFlowChildrenChange);

      var layout = this.start(this.Layout);

      layout.showLeft$  = this.showPrompts$;
      layout.showRight$ = this.showPrompts$;
      layout.showHeader = true;
      layout.left.tag(this.FlowableTree, {data: this, selected$: this.selected$, isMenuOpen$: layout.isMenuOpen$});
      layout.middle.call(this.renderSelf, [this]);
      layout.right.addClass(self.myClass('rightBar')).add(this.dynamic(function(selectedValue, selected$configViewSpec) {
        this.start().addClass(self.myClass('rightBar-title'), 'h400')
          .add('Flow Properties')
        .end()
        .tag(self.ReactiveSectionedDetailView, {
          of: selectedValue?.cls_.id ?? '',
          ...(selected$configViewSpec || {}),
          data: selectedValue,
          showActions: true,
          showHeader: true
        });
      }));

      layout.header.add(this.dynamic(function(showPrompts) {
        this.tag(self.ReflowHeader, {data: self, showPrompts: showPrompts, resetFlow: self.clearFlow});
      }));

      this.flowName$ = this.value.name$;

      if ( this.route ) this.ROUTE.postSet.call(this, '', this.route);
    },

    function renderToolbar(self) {
      this.select(self.toolbarControlDAO, function(c) {
        this.tag({class: c.view});
      });
    },

    function renderSelf(self) {
      this.
        addClass(self.myClass()).
        start('div', null, self.out$)
          .addClass(self.myClass('output')).end().
          start('span').
            show(self.showInput$).
            addClass(self.myClass('input-field')).
            start('b').style({ display: 'flex', 'white-space': 'pre'}).
              call(self.renderToolbar, [self]).
              add(' >').
            end().
            start(self.INPUT, null, self.input_$).
              addClass(self.myClass('input')).
              on('keyup', e => { if ( e.key == 'Enter' || e.keyCode == 13 ) self.onInput(); }).
            end().
//            tag(self.ON_INPUT).
          end().
          start(self.ReflowToolBar, { data: self }).show(self.showPrompts$).end().
        end();


        // These observers might cause scroll issues later when queries in the console can be edited
        // In that case there should be an explicit flag to only do the scroll when the query is submitted
      // from the main console input
      /*
        const resizeObserver = new ResizeObserver(this.scrollToBottom.bind(this));
        var observer = new MutationObserver(function(mutations) {
          for (const record of mutations) {
            for (const addedNode of record.addedNodes) {
              if ( addedNode.nodeType === Node.ELEMENT_NODE )
                resizeObserver.observe(addedNode);
            }
            for (const removedNode of record.removedNodes) {
              if ( removedNode.nodeType === Node.ELEMENT_NODE )
                resizeObserver.unobserve(removedNode);
            }
            if (record.target.childNodes.length === 0) {
              resizeObserver.disconnect();
              observer.disconnect();
            }
          }
        });
        var config = { attributes: true, childList: true, characterData: true };

        observer.observe(this.out.element_, config);
        this.onDetach(() => observer.disconnect());
        this.setTimeout(this.focusInput.bind(this), 500)
        */
    },

    function log(...args) {
      this.currentBlock.log.apply(this.currentBlock, args);
    },

    function scrollToBottom() {
      if ( this.U3 ) {
        this.out.element_.scrollTop = this.out.element_.scrollHeight;
      }
    },

    function addHistory(cmd) {
      if ( cmd.startsWith('history') || cmd.startsWith('help') || cmd === 'save' ) return;

      // avoid adjacent duplicates
      if ( cmd == this.history_[this.history_.length-1] ) return;

      this.history_.push(cmd);

      while ( this.history_.length > this.historyLength ) this.history_.shift();

      this.window.localStorage[this.historyKey()] = foam.json.stringify(this.history_);
    },

    function refreshFlowScope() {
      var s = this.flowScope;

      // Remove old bindings
      for ( var x in s )
        if ( s.hasOwnProperty(x) )
          delete s[x];

      // Add binding for this
      s[this.flowName] = this.value;

      // Add bindings for children
      this.flowChildren.forEach(c => {
        if ( c.value ) {
          s[c.flowName] = foam.lang.Holder.isInstance(c.value) ? c.value.value : c.value;
        }
      });
    },

    async function eval_(cmd, opt_ignoreSelect) {
      /** opt_ignoreSelect if true, causes the evaled cmd to not become the selected  block **/
      var self = this;

      cmd = cmd.trim();

      this.clearProperty('historyPosition');
      if ( ! cmd ) return;
      this.addHistory(cmd);

//      this.out.tag('br').start().show(self.showPrompts$).start('b').add('> ').end().add(cmd);
      var block = this.currentBlock = this.Block.create({cmd: cmd, flowParent: this});

      var innerScope = {
        // shell: this,
        eval_: this.eval_.bind(this),
        addValue: block.addValue.bind(block),
        log: block.log.bind(block),
        out: block.out, start: block.out.start.bind(block.out),
        tag: block.out.tag.bind(block.out)
      };

      // TODO: move into Block
      with ( this.scope || {} ) { with ( this.localScope ) { with ( innerScope ) { with ( this.flowScope ) {
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
      }}}}

      this.addFlowChild(block);

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

      this.input_.focus();

      /*
      this.setTimeout(() => this.scrollToBottom(), 16);
      this.setTimeout(() => this.scrollToBottom(), 32);
      this.setTimeout(() => this.scrollToBottom(), 64);
      */
      this.setTimeout(() => this.scrollToBottom(), 100);

      return block;
    },

    function addFlowChild_(c) {
      this.refreshFlowScope();
      c.flowName$.sub(() => this.refreshFlowScope());
      c.value$.sub(() => this.refreshFlowScope());
      this.out.add(c);
    },

    function removeFlowChild_(c) {
      c.remove();
    },

    function save() {
      // This is a hackish solution to the bug that the memento is saved before
      // the last block's name is set. Ideally the block would be named before
      // being added to the flowChildren. Alternatively, the mementoStr could never
      // be created until just before you save, but updating it for every update
      // will make it easy to implement undo/redo in the future.
      var flow = this.value;

      this.generateScript();
      flow.version++;
      this.mementoMgr.clear();
      flow.flowDAO.put(this.value).then(ret => this.value.copyFrom(ret));
    },

    function setSelectedIndex(i) {
      if ( i == -1 || i >= this.flowChildren.length ) {
        this.selected = this;
      } else {
        this.selected = this.flowChildren[i];
      }
    },

    function generateScript() {
      var json = foam.json.Outputter.create({
        pretty: true,
        strict: true,
        formatDatesAsNumbers: false,
        outputDefaultValues: false,
        useShortNames: false,
        propertyPredicate: function(_, p) { return p.name === 'reactions_' || ( ! p.externalTransient && ! p.networkTransient ); }
      });

      this.value.script = json.stringify(this.flowChildren);
    },

    function maybeRegenScript() {
//      if ( this.feedback_ ) return;
      this.feedback_ = true;
      try {
        this.generateScript();
      } finally {
        this.feedback_ = false;
      }
    }
  ],

  actions: [
    {
      name: 'helpKey',
      isAvailable: function(input_) {
          if ( this.flowMode === this.FlowMode.READONLY ) {
          return false;
        }
        return input_.element_ === document.activeElement;
      },
      code: function() { this.help(); },
      keyboardShortcuts: [ 'f1' ]
    },
    {
      name: 'focusInput',
      code: function() { this.input_.focus(); },
      keyboardShortcuts: [ 'ctrl-`' ]
    },
    {
      name: 'toggleMode',
      // You can do this.showPrompts = true|false; from flow scripts
      // You can do this.showInput = true|false; from flow scripts
      code: function() {
        if ( this.flowMode !== this.FlowMode.READONLY ) {
          this.flowMode = { EDIT: this.FlowMode.VIEW, VIEW: this.FlowMode.CONSOLE, CONSOLE: this.FlowMode.EDIT }[this.flowMode.name];
        }
      },
      keyboardShortcuts: [ 'escape' ]
    },
    {
      name: 'stepUpHistory',
      isAvailable: function(input_) { return input_.element_ == document.activeElement; },
      code: function() {
        this.historyPosition = foam.Number.clamp(0, this.historyPosition+1, this.history_.length);
        this.input = this.history_[this.history_.length - this.historyPosition] ?? '';
      },
      keyboardShortcuts: [ 'arrowup' ]
    },
    {
      name: 'stepDownHistory',
      isAvailable: function(input_) { return input_.element_ == document.activeElement; },
      code: function() {
        this.historyPosition--;
        this.input = this.history_[this.history_.length - this.historyPosition] ?? '';
      },
      keyboardShortcuts: [ 'arrowdown' ]
    },
    {
      name: 'onInput',
      label: '',
      themeIcon: 'next',
      size: 'SMALL',
      buttonStyle: 'TEXT',
      code: function() {
        var input = this.input;
        this.input = '';
        this.eval_(input);
      },
      // Using 'enter' keyboard shortcut doesn't work because it prevents newlines in
      // text areas on the screen.
      // keyboardShortcuts: [ 'enter' ]
    },
    {
      name: 'clear',
      code: function() {
        this.clearFlow();
        this.focusInput();
        this.flowName = '';
      },
      keyboardShortcuts: [ 'meta-k', 'ctrl-k' ]
    },
    {
      name: 'selectionUp',
      keyboardShortcuts: [ 'shift-arrowup' ],
      isAvailable: function(input_) { return input_.element_ == document.activeElement; },
      code: function() {
        var i = this.flowChildren.findIndex(o => o === this.selected);
        this.setSelectedIndex(i == -1 ? this.flowChildren.length-1 : i-1);
      }
    },
    {
      name: 'selectionDown',
      keyboardShortcuts: [ 'shift-arrowdown' ],
      isAvailable: function(input_) { return input_.element_ == document.activeElement; },
      code: function() {
        var i = this.flowChildren.findIndex(o => o === this.selected);
        this.setSelectedIndex(i+1);
      }
    }
  ],

  listeners: [
    {
      name: 'onClick',
      // TODO: introduce a merge delay so that cut&paste still works
      // but a better solution might be to wait for a keypress then set the focus
      // and copy the key
      isMerged: true,
      mergeDelay: 600,
      code: function() { this.input_.focus(); }
    },
    {
      name: 'onScriptChange',
      code: async function() {
        if ( this.feedback_ ) return;
        this.feedback_ = true;
        try {
          var currentBlockName = (this.selected || this).flowName;

          this.clearFlow();

          var script = this.value.script;
          await this.includeScript(script);

          this.selected = ( currentBlockName == this.flowName ) ?
            this :
            ( this.findFlowChildByName(currentBlockName) || this );
        } finally {
          this.feedback_ = false;
        }
      }
    },
    {
      name: 'onFlowChildrenChange',
      isMerged: true,
      delay: 250,
      code: function() {
// if ( this.feedback_ ) return;
        if ( this.flowChildrenSub_ ) this.flowChildrenSub_.detach();
        this.flowChildrenSub_ = foam.lang.FObject.create();
        this.flowChildren.forEach(c => {
          if ( c.value )
            this.flowChildrenSub_.onDetach(c.value.sub(this.onFlowChildChange));
        });

        this.maybeRegenScript();
      }
    },
    {
      name: 'onFlowChildChange',
      isMerged: true,
      delay: 2000,
      code: function() {
// if ( this.feedback_ ) return;
       this.maybeRegenScript();
      }
    }
  ]
});
