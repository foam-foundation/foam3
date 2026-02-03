/* eslint-disable no-with */
/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Bugs:
//  - Command.execute_ Action doesn't work in TableView because it has the wrong Context

// Features:
//  ? how are Commands different than flows?
// ???: Would it be better to have compose rather than mixing Flowable?
// TODO: user-select: none; to avoid cut&paste when not appropriate

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
    function detachFlowChild(c) {
      // Helper function to properly detach a flow child
      // Detach the block's value first (e.g., Script, etc.)
      if ( c.value && c.value.detach ) {
        c.value.detach();
      }
      // Then detach the block wrapper itself
      if ( c.detach ) {
        c.detach();
      }
    },

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
      let findEl = inputArr => {
        if ( ! inputArr?.length ) return;
        for ( v of inputArr ) {
          if ( ! v ) continue;
          if ( v.flowName === n ) {
            return v;
          }
          let ret = findEl(v.flowChildren);
          if ( ret ) return ret;
        }
      };
      return findEl(this.flowChildren);
    },

    function addFlowChild(f) {
      if ( f.deleted_ ) return;
      f.flowParent = this;
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
        this.flowChildren.forEach(c => {
          this.removeFlowChild_(c);
          this.detachFlowChild(c);
        });
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
    'foam.log.LogLevel',
    'foam.u2.view.OverlayActionListView',
    'foam.core.reflow.FlowMode',
  ],

  imports: [
    'mementoMgr',
    'notify',
    'stack'
  ],

  messages: [
    { name: 'PROVIDE_NAME', message: 'Please provide a name to save your Flow' },
  ],

  css: `
    ^navigator {
      display: flex;
      align-items: center;
      color: $textSecondary;
      gap: 4px;
    }
    ^header-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    ^chevron {
      color: $textSecondary;
    }
    ^title input {
      border: none;
      color: $textDefault;
    }
    ^title .foam-u2-TextInputCSS::placeholder {
      color: $textDefault;
      opacity: 1;
    }
    ^header-actions {
      display: flex;
      gap: 5px;
      align-items: center;
    }
    ^save-text {
      color: $textSecondary;
    }
    ^ .foam-u2-view-OverlayActionListView {
      color: $textDefault;
    }

    ^separator {
      display: inline-block;
      width: 1px;
      height: 30px;
      background: $backgroundTertiary;
      margin: 0 8px;
    }

    ^name::placeholder {
      font-style: italic;
    }
  `,

  properties: [
    'showPrompts'
  ],

  methods: [
    function render() {
      let self = this;
      // Hide HOME button in limited edit console mode
      const isLimitedEditConsole = this.data.flowMode.isLimitedEditMode && this.data.flowMode.showsPrompts;

      var fullVersion = this.data.value.dynamic(function(version, revision) {
        this.add(`v${version}.${revision}`);
      });

      this.addClass()
        .start()
          .addClass(this.myClass('header-container'))
          .start().addClass(this.myClass('navigator'))
            .callIf(! isLimitedEditConsole, function() {
              this.tag(self.HOME);
            })
            .start(foam.u2.tag.Image, {
              glyph: 'rightChevron',
              embedSVG: true
            }).addClass(this.myClass('chevron')).end()
            .start('span').addClass(this.myClass('title'))
              .start({
                class: 'foam.u2.TextField',
                data$: this.data.value.name$,
                placeholder: 'Unnamed',
                onKey: false
              })
                .addClass(this.myClass('name'))
              .end()
            .end()
            .start().add(fullVersion).end()
          .end()

          .start().addClass(this.myClass('header-actions'))
            .startContext({ data: this })
              .tag(this.UNDO)
              .tag(this.REDO)
            .endContext()
            .start('span').addClass(this.myClass('separator')).end()
            .startContext({data: this})
              .tag(this.SAVE)
              .tag(this.OverlayActionListView, {
                label: 'More',
                data: isLimitedEditConsole ? [this.CANCEL] : [this.RESET, this.CANCEL, this.CLEAR],
                obj: this,
                buttonStyle: 'SECONDARY',
                size: 'SMALL',
                themeIcon: 'dropdown',
                isIconAfter: true,
                showDropdownIcon: false,
                horizontal: false
              })
              .start('span').addClass(this.myClass('separator')).end()
              .tag(this.FULL_SCREEN, { themeIcon$: self.data.flowMode$.map(c => c.fullscreenIcon) })
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
    {
      name: 'home',
      label: '',
      buttonStyle: foam.u2.ButtonStyle.TERTIARY,
      themeIcon: 'boldHome',
      size: 'SMALL',
      code: function(X) {
        this.showNav = true;
        X.pushDefaultMenu();
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
        var target = this.data.flowMode.getToggleTarget();
        if ( target ) {
          this.data.flowMode = target;
        }
        this.data.showPrompts = true;
      }
    },
    {
      name: 'cancel',
      label: 'Undo Changes',
      buttonStyle: foam.u2.ButtonStyle.SECONDARY,
      size: 'SMALL',
      themeIcon: 'close',
      isEnabled: function(data$value$revision) {
        return data$value$revision;
      },
      confirmationView: function(X, data) {
        return data.ConfirmationModal.create({
          primaryAction: this.clone().copyFrom({ label: 'Yes, Confirm' }),
          data: data,
          modalStyle: 'DESTRUCTIVE',
          title: 'Undo Changes',
          maxWidth: '35vw',
          closeable: false
        }).add('This will remove all unsaved changes made to the document.')
      },
      code: function() {
        this.mementoMgr.undoAll();
      }
    },
    {
      name: 'save',
      label: 'Save',
      buttonStyle: foam.u2.ButtonStyle.PRIMARY,
      size: 'SMALL',
      isEnabled: function(data$flowErrors_, data$isLoading_) {
        return ! data$flowErrors_ && ! data$isLoading_;
      },
      isAvailable: function(showPrompts) {
        return showPrompts;
      },
      code: function() {
        if ( this.data.value.name ) {
          return this.data.eval_(`save ${this.data.value.name}`);
        } else {
          // Using error message instead of disabling the save button to provide users feedback on why it’s not working.
          this.notify(this.PROVIDE_NAME, '', this.LogLevel.ERROR, true);
        }
      }
    },
    {
      name: 'clear',
      label: 'Clear Document',
      buttonStyle: foam.u2.ButtonStyle.SECONDARY,
      size: 'SMALL',
      themeIcon: 'trash',
      confirmationView: function(X, data) {
        return data.ConfirmationModal.create({
          primaryAction: this.clone().copyFrom({ label: 'Yes, Confirm' }),
          data: data,
          modalStyle: 'DESTRUCTIVE',
          title: 'Clear Document',
          maxWidth: '35vw',
          closeable: false
        }).add('This will remove all content from the document.')
      },
      code: function() {
        this.data.eval_('clear');
      }
    },
    {
      name: 'reset',
      label: 'Start a New Flow',
      buttonStyle: foam.u2.ButtonStyle.TERTIARY,
      size: 'SMALL',
      themeIcon: 'plus',
      isAvailable: function(showPrompts) {
        return showPrompts;
      },
      confirmationView: function(X, data) {
        return data.ConfirmationModal.create({
          primaryAction: this.clone().copyFrom({ label: 'Yes, Confirm' }),
          data: data,
          modalStyle: 'DESTRUCTIVE',
          title: 'Start a New Flow',
          maxWidth: '35vw',
          closeable: false
        }).add('Unsaved changes will be lost. Are you sure you want to start a new Flow?');
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
      name: 'undo',
      label: '',
      help: 'Undo',
      buttonStyle: 'BLACK',
      themeIcon: 'redo',
      isEnabled: function(data$mementoMgr$stackSize_, data$isLoading_) {
        return !! data$mementoMgr$stackSize_ && ! data$isLoading_;
      },
      code: function() {
        this.data.mementoMgr.back();
      }
    },
    {
      name: 'redo',
      label: '',
      help: 'Redo',
      buttonStyle: 'BLACK',
      themeIcon: 'undo',
      isEnabled: function(data$mementoMgr$redoSize_, data$isLoading_) {
        return !! data$mementoMgr$redoSize_ && ! data$isLoading_;
      },
      code: function() {
        this.data.mementoMgr.forth();
      }
    },
    {
      name: 'fullScreen',
      toolTip: 'Toggle Presentation Mode / ESC',
      label: '',
      buttonStyle: foam.u2.ButtonStyle.SECONDARY,
      isAvailable: function(data$flowMode) {
        return data$flowMode.showsFullscreenButton;
      },
      code: function() {
        var target = this.data.flowMode.getToggleTarget();
        if ( target ) {
          this.data.flowMode = target;
        }
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'LimitEditHeader',
  extends: 'foam.u2.View',

  requires: [
    'foam.core.reflow.FlowMode'
  ],

  css: `
    ^container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }
    ^title {
      font-weight: $font-medium;
      color: $textDefault;
    }
  `,

  methods: [
    function render() {
      var self = this;
      this.
        addClass().
        add(this.slot(function(flow, permission) {
          var e = self.E().start().addClass(self.myClass('container'));

          if ( permission ) {
            var action = self.EDIT_LIMITED.clone();
            action.availablePermissions = [ permission ];
            action.availablePermissionsSlot_ = null; // reset permission cache

            e.startContext({ data: self })
              .tag(action)
            .endContext();
          }

          return e.end();
        }, this.data.value$, this.data.value$.dot('limitedEditPermission')))
        ;
    }
  ],

  actions: [
    {
      name: 'editLimited',
      label: 'Edit',
      buttonStyle: foam.u2.ButtonStyle.PRIMARY,
      size: 'SMALL',
      code: function() {
        this.data.flowMode = this.FlowMode.LIMIT_EDIT_CONSOLE;
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Block',
  extends: 'foam.u2.Accordion',
  implements: [ 'foam.core.reflow.Flowable' ],

  requires: ['foam.u2.WrapperNode'],

  mixins: [ 'foam.u2.StyleConfigurator' ],

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
    div.foam-core-reflow-Console-CONSOLE ^.block:hover:not(:has(.block:hover)) {
      background: $backgroundSecondary; }
    }
    ^ .foam-u2-ReadWriteView { padding-right: 8px; }
    ^content {
      overflow-x: auto;
      width: 100%;
      height: fit-content;
      overflow-y: hidden;
    }
    ^.expanded > ^toolbar {
      padding: 0 0 0.8rem 16px;
    }
    ^content:has(> .foam-u2-Element-hidden) {
      display: none;
    }
    ^hidePrompts:has(> ^content > .foam-u2-Element-hidden) {
      display: none;
    }
  `,

  sections: [
    {
      name: 'general',
      order: 100,
      properties: ['flowName', 'cmd', 'shown']
    },
    {
      name: 'titleSettings',
      order: 200,
      properties: ['border']
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
      class: 'Boolean',
      name: 'shown',
      hidden: false
    },
    {
      class: 'Boolean',
      name: 'allowLimitedEdit',
      documentation: 'When true, Block configuration remains accessible in LIMIT_EDIT_CONSOLE mode.'
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'border',
      label: 'Border Properties',
      documentation: `DEPRECATED: USE STYLE CONFIGURATOR INSTEAD.`,
      label: '',
      factory: function() { return {}; },
      preSet: function(_, n) {
        // Dont save the class so that the ViewSpec doesn't convert to a view
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
      class: 'Class',
      name: 'borderClass',
      hidden: true,
      label: 'Border Type',
      documentation: `DEPRECATED: USE STYLE CONFIGURATOR INSTEAD.`,
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
    function setTitle(title) {
      if ( this.borderEl_ ) {
        this.borderEl_.title = title;
      } else {
        this.border.title = title;
      }
    },
    function init() {
      let self = this;
      this.SUPER();
      this.content.tag(foam.u2.borders.TitleBorder, { ...this.border }, self.borderEl_$);
      this.out = this.WrapperNode.create({ parentNode: this.content }, this);
      self.borderEl_.add(this.out);
      // Since border's properties will be copied over after in includeScript, set it here
      this.onDetach(this.border$.sub(() => {
        this.borderEl_.copyFrom(this.border);
        this.maybeMigrate();
      }));
    },

    function render() {
      this.on('click', this.onClick);
      this.addClass('block');
      this.enableClass(this.myClass('hidePrompts'), this.showPrompts$.not());
      this.title.add(this.flowName$);
      this.rightSection.tag(this.DEL, { label: ''});
      this.SUPER();
      this.initCSSProps(this.content);
      if ( ! this.padding_st )
        this.padding_st = '16px';
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
      json.outputFObject_(this, this.cls_, [
        this.FLOW_NAME, this.CMD, this.VALUE, this.FLOW_CHILDREN, this.REACTIONS_, this.ALLOW_LIMITED_EDIT, this.BORDER,
        this.SHOWN, ...foam.u2.StyleConfigurator.getAxiomsByClass(foam.lang.Property).filter(p => ! p.hidden && ! p.transient)
      ]);
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
    function maybeMigrate() {
      // Legacy support
      if ( this.borderClass && this.borderClass !== foam.u2.borders.TitleBorder ) {
        switch ( this.borderClass ) {
          case foam.u2.borders.CardBorder:
            this.border_st = 'solid 1px $borderDefault';
            this.padding_st = '16px';
            break;
          case foam.u2.borders.BackgroundCard:
            this.background_st = this.border.backgroundColor || '$backgroundSecondary';
            this.padding_st = this.border.padding || '2.4rem';
            break;
          case foam.u2.borders.SpacingBorder:
            this.padding_st = this.border.padding || '1rem';
            break;
        }
        // After migration clear the borderClass so it is never run again on this block;
        this.borderClass = null;
      }
    },
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
      code: function() {
        if ( ! this.WrapperNode.isInstance(this.out) ) return;
        let el = foam.u2.borders.TitleBorder.create({...(this.border || {})}, this);
        this.borderEl_.parentNode.add(el);
        this.out.moveTo(el);
        this.borderEl_.remove();
        this.borderEl_ = el;
      }
    },
    {
      name: 'onClick',
      code: function(e) {
        this.selected = this;
        e.stopPropagation();
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Layout',
  extends: 'foam.u2.Element',

  imports: [
    'window'
  ],

  css: `
    ^ {
      display: grid;
      grid-template-rows: max-content minmax(0, 1fr);
      height: 100%;
      min-height: -webkit-fill-available;
    }
    ^flex-container {
      display: flex;
      flex-direction: row;
      overflow: auto;
      grid-row: 2;
      height: auto;
      min-height: 0;
    }
    ^header {
      padding: 5px 24px;
      height: fit-content;
      max-height: 64px;
      background-color: $backgroundDefault;
      border-bottom: 1px solid $borderLight;
    }
    ^l {
      padding: 4px;
      background-color: $backgroundDefault;
      width: 15%;
      border-right: 1px solid $borderLight;
      flex: 0 0 auto;
      overflow-y: auto;
    }
    ^middle-holder {
      padding: 16px 16px 0 16px;
      width: 100%;
      background-color: $backgroundTertiary;
      overflow: auto;
      flex: 3 1 50%;
    }
    ^m {
      border: 2px dashed $borderLight;
      overflow-x: auto;
      background-color: $backgroundDefault;
    }
    ^r {
      overflow-y: auto;
      width: 40%;
      background-color: $backgroundDefault;
      flex: 0 0 auto;
    }
    ^resize-handle {
      width: 2px;
      cursor: ew-resize;
      background: $borderLight;
      height: 100%;
      z-index: 10;
    }
    ^resize-handle:hover, ^resize-handle:active {
      background: $backgroundBrandSecondary;
    }

    ^r .foam-core-reflow-SinkView, ^r .foam-u2-view-IntView {
      width: 100%;
    }

    ^ .foam-u2-RangeView-skip {
      width: 100%;
    }

    ^menuClosed {
     width: 60px!important;
     transition: width 0.2s cubic-bezier(0.4,0,0.2,1);
    }

    ^r .foam-u2-PropertyBorder-select {
      padding: 5px;
      background-color: $backgroundTertiary;
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

  constants: [
    {
      type: 'Int',
      name: 'MIN_SIDEBAR_WIDTH_FALLBACK',
      value: 280
    }
  ],

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
      factory: function() {
        var saved = this.window.localStorage['foam.reflow.layout.rightWidth'];
        return saved ? parseInt(saved) : 550;
      },
      postSet: function(_, n) {
        this.window.localStorage['foam.reflow.layout.rightWidth'] = n;
      }
    },
    {
      class: 'Int',
      name: 'leftWidth',
      factory: function() {
        var saved = this.window.localStorage['foam.reflow.layout.leftWidth'];
        return saved ? parseInt(saved) : 300;
      },
      postSet: function(_, n) {
        this.window.localStorage['foam.reflow.layout.leftWidth'] = n;
      }
    },
    'oldX_', 'oldWidth_'
  ],

  methods: [
    function render() {
      var self = this;
      this.
        addClass().
        start('div', {}, this.header$).addClass(this.myClass('header')).show(this.showHeader$).end().
        start().addClass(this.myClass('flex-container')).
          start('div', {}, this.left$).
            addClass(this.myClass('l')).
            enableClass(this.myClass('menuClosed'), this.isMenuOpen$.map(open => !open)).
            show(this.showLeft$).
            style({ width: this.leftWidth$.map(w => w + 'px') }).
          end().
          start('div').
            addClass(this.myClass('resize-handle')).
            attrs({ draggable: 'true', 'data-side': 'left' }).
            on('dragstart', self.dragStart.bind(self)).
            on('drag', self.drag.bind(self)).
            on('dragend', self.dragEnd.bind(self)).
          end().
          start().addClass(this.myClass('middle-holder')).
            start('div', {}, this.middle$).addClass(this.myClass('m')).end().
          end().
          // --- Resize handle ---
          start('div').
            addClass(this.myClass('resize-handle')).
            attrs({ draggable: 'true', 'data-side': 'right' }).
            on('dragstart', self.dragStart.bind(self)).
            on('drag', self.drag.bind(self)).
            on('dragend', self.dragEnd.bind(self)).
          end().
          // --- Right sidebar ---
          start('div', {}, this.right$).
            addClass(this.myClass('r')).
            style({ width: this.rightWidth$.map(w => w + 'px') }).
            show(this.showRight$).
          end().
        end();
    }
  ],

  listeners: [
     {
      name: 'dragStart',
      code: function(evt) {
        evt.dataTransfer.effectAllowed = 'none';
        evt.dataTransfer.dropEffect = 'none';
        let dragImg_ = document.createElement('img');
        dragImg_.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
        evt.dataTransfer.setDragImage(dragImg_, 0, 0);
        var sidebarName = evt.target.dataset.side + 'Width';
        this.oldX_ = evt.clientX;
        this.oldWidth_ = this[sidebarName] || this.MIN_SIDEBAR_WIDTH_FALLBACK;
      }
    },
    {
      name: 'drag',
      code: function(evt) {
        evt.preventDefault();
        var sidebarName = evt.target.dataset.side + 'Width';
        if ( ! sidebarName || event.clientX == 0 ) return;
        var w = evt.clientX - this.oldX_;
        if ( sidebarName == 'leftWidth' ) {
          w = this.oldWidth_ + w;
        } else {
          w = this.oldWidth_ - w;
        }
        if ( w > this.MIN_SIDEBAR_WIDTH_FALLBACK ) {
          this[sidebarName] = w;
        }
      }
    },
    {
      name: 'dragEnd',
      code: function(evt) {
        this.drag(evt);
      }
    }
  ]
});


foam.ENUM({
  package: 'foam.core.reflow',
  name: 'FlowMode',

  documentation: 'Defines the display and interaction mode for Flow/Console views.',

  properties: [
    {
      class: 'Boolean',
      name: 'showsPrompts',
      documentation: 'Whether to show UI prompts, sidebars, and editing UI'
    },
    {
      class: 'Boolean',
      name: 'showsHeader',
      documentation: 'Whether to show the header bar'
    },
    {
      class: 'Boolean',
      name: 'autoscrollEnabled',
      documentation: 'Whether to auto-scroll to bottom after command execution'
    },
    {
      class: 'Boolean',
      name: 'autosaveEnabled',
      documentation: 'Whether to auto-save script changes to localStorage'
    },
    {
      class: 'Boolean',
      name: 'allowsEscapeToggle',
      documentation: 'Whether ESC key can toggle presentation mode'
    },
    {
      class: 'Boolean',
      name: 'showsFullscreenButton',
      documentation: 'Whether to show the fullscreen/minimize toggle button'
    },
    {
      class: 'String',
      name: 'fullscreenIcon',
      documentation: 'Icon name for fullscreen button (fullScreen or minimize)'
    },
    {
      class: 'Boolean',
      name: 'isLimitedEditMode',
      documentation: 'Whether this is a limited edit mode variant'
    },
    {
      class: 'Boolean',
      name: 'checksAutosave',
      documentation: 'Whether to check for and prompt about autosaved scripts'
    },
    {
      class: 'Boolean',
      name: 'showsHelpKey',
      documentation: 'Whether F1 help key is available'
    },
    {
      class: 'Boolean',
      name: 'forceNavHide',
      documentation: 'Whether to force hiding the app navigation bars',
    },
    {
      name: 'getToggleTarget',
      documentation: 'Returns the FlowMode to switch to when toggling, null if toggle not allowed',
      value: function() { return null; }
    }
  ],

  values: [
    {
      name: 'CONSOLE',
      label: 'Console',
      showsPrompts: true,
      showsHeader: true,
      autoscrollEnabled: true,
      autosaveEnabled: true,
      allowsEscapeToggle: true,
      showsFullscreenButton: true,
      fullscreenIcon: 'fullScreen',
      isLimitedEditMode: false,
      checksAutosave: true,
      showsHelpKey: true,
      forceNavHide: true,
      getToggleTarget: function() { return foam.core.reflow.FlowMode.PRESENTATION; }
    },
    {
      name: 'PRESENTATION',
      label: 'Presentation',
      showsPrompts: false,
      showsHeader: true,
      autoscrollEnabled: true,
      autosaveEnabled: true,
      allowsEscapeToggle: true,
      showsFullscreenButton: true,
      fullscreenIcon: 'minimize',
      isLimitedEditMode: false,
      checksAutosave: true,
      showsHelpKey: false,
      forceNavHide: true,
      getToggleTarget: function() { return foam.core.reflow.FlowMode.CONSOLE; }
    },
    {
      name: 'PRESENTATION_ONLY',
      label: 'Presentation Only',
      showsPrompts: false,
      showsHeader: false,
      autoscrollEnabled: false,
      autosaveEnabled: false,
      allowsEscapeToggle: false,
      showsFullscreenButton: false,
      fullscreenIcon: 'minimize',
      isLimitedEditMode: false,
      checksAutosave: false,
      showsHelpKey: false,
      getToggleTarget: function() { return null; }
    },
    {
      name: 'LIMIT_EDIT',
      label: 'Limited Edit',
      showsPrompts: false,
      showsHeader: true,
      autoscrollEnabled: false,
      autosaveEnabled: false,
      allowsEscapeToggle: false,
      showsFullscreenButton: false,
      fullscreenIcon: 'minimize',
      isLimitedEditMode: true,
      checksAutosave: true,
      showsHelpKey: false,
      getToggleTarget: function() { return foam.core.reflow.FlowMode.LIMIT_EDIT_CONSOLE; }
    },
    {
      name: 'LIMIT_EDIT_CONSOLE',
      label: 'Limited Edit Console',
      showsPrompts: true,
      showsHeader: true,
      autoscrollEnabled: true,
      autosaveEnabled: true,
      allowsEscapeToggle: true,
      showsFullscreenButton: true,
      fullscreenIcon: 'fullScreen',
      isLimitedEditMode: true,
      checksAutosave: true,
      showsHelpKey: false,
      forceNavHide: true,
      getToggleTarget: function() { return foam.core.reflow.FlowMode.LIMIT_EDIT; }
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Console',
  extends: 'foam.u2.Controller',

  implements: [ 'foam.core.reflow.Flowable' ],
  mixins: [ 'foam.u2.memento.Memorable' ],

  documentation: `
    If you want to embed FLOWs in regular U3 views without all of the editing UI, you can do it like this:
    requires: [ 'foam.core.reflow.Console' ]
    ...
    this.add(self.Console.create({route: 'name of flow to load', flowMode: foam.core.reflow.FlowMode.PRESENTATION_ONLY});
  `,
  requires: [
    'foam.core.reflow.Flowable',
    'foam.core.reflow.ReflowHeader',
    'foam.core.reflow.ReactiveSectionedDetailView',
    'foam.core.reflow.ReflowConfigView',
    'foam.core.reflow.ReflowToolBar',
    'foam.core.reflow.ToolbarControl',
    'foam.core.reflow.Block',
    'foam.core.reflow.Flow',
    'foam.core.reflow.LimitEditHeader',
    'foam.core.reflow.FlowMode',
    'foam.core.reflow.FlowableTree',
    'foam.core.reflow.Layout',
    'foam.dao.ArrayDAO',
    'foam.flow.Document',
    'foam.u2.Link',
    'foam.u2.dialog.ConfirmationModal'
  ],

  imports: [
    'commandDAO',
    'flowDAO',
    'params',
    'setTimeout',
    'toolbarControlDAO',
    'window',
    'showNav',
    'isMenuOpen'
  ],

  constants: [
    {
      type: 'String',
      name: 'AUTOSAVED_SCRIPT_PREFIX',
      value: 'foam.reflow.autosavedscript'
    }
  ],

  exports: [
    'addToScope',
    'clearFlow',
    'copyChild',
    'createFlowChildName',
    'currentBlock',
    'eval_',
    'flowChildren',
    'history_',
    'localScope',
    'log',
    'mementoMgr',
    'moveFlowChild',
    'moveFlowChildAfter',
    'out',
    'save',
    'scope',
    'scrollToBottom',
    'selected',
    'selectFromTree',
    'showPrompts',
    'value as flow'
  ],

  css: `
    ^ {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: -webkit-fill-available;
      position: relative;
      align-items: center;
      justify-content: center;
    }
    ^output {
      flex: 1;
      overflow: auto;
      text-align: left;
      width: 100%;
      position: relative;
    }
    ^error {
      background: $backgroundDestructiveTertiary!important;
      color: $textDestructive;
    }
    ^loading-indicator {
      position: absolute;
      top: 200px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 32px;
      background: $backgroundDefault;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      z-index: 1000;
      width: 400px;
      max-width: 90%;
      justify-content: center;
    }
    ^loading-header {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    ^loading-indicator .foam-u2-ProgressView {
      width: 100%;
    }
    ^loading-text {
      color: $textDefault;
      font-size: 16px;
      font-weight: $font-medium;
      text-align: center;
    }
    ^loading-progress {
      color: $textSecondary;
      font-size: 14px;
      text-align: center;
    }
  `,

  properties: [
    {
      name: 'childType',
      factory: function() {
        return this.Block;
      }
    },
    {
      name: 'scope',
      getter: function() {
        return {...this.localScope, ...this.flowScope};
      }
    },
    {
      class: 'Enum',
      of: 'foam.core.reflow.FlowMode',
      name: 'flowMode',
      value: 'CONSOLE',
      memorable: true
    },
    {
      class: 'String',
      name: 'route',
      memorable: true,
      postSet: async function(o, n) {
        if ( ! this.out ) return;
        if ( n !== this.value.name ) {
          this.clearFlow();
          if ( n ) {
            // Check for autosaved script before loading
            var autosaveLoaded = await this.checkForAutosavedScript(n);
            // Only load from database if autosave wasn't loaded
            if ( ! autosaveLoaded ) {
              await this.eval_(`load("${n}")`);
            }
            this.value.name = n;
            this.selected = this.currentBlock;
          }
        }
      }
    },
    {
      class: 'String',
      name: 'flowName',
      value: 'flow',
      getter: function() { return 'flow'; }
    },
    {
      class: 'String',
      name: 'input',
      view: {
        class: 'foam.u2.TextField', // Avoids ModeAltView focus() issue
        autocomplete: 'off',
        onKey: false
      }
    },
    'input_', // Element pointer
    {
      name: 'out'
    },
    {
      // class: 'Boolean',
      name: 'showPrompts',
      value: true,
      expression: function(flowMode) {
        return flowMode.showsPrompts;
      },
      preSet: function(_, n) { return n === 'false' ? '' : n; },
//      memorable: true // use flowMode
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
      class: 'Boolean',
      name: 'isLoading_',
      hidden: true,
      transient: true
    },
    {
      class: 'Boolean',
      name: 'isLoadingMinimized_',
      hidden: true,
      transient: true,
      value: false
    },
    {
      class: 'Int',
      name: 'loadingProgress_',
      hidden: true,
      transient: true,
      value: 0
    },
    {
      class: 'Int',
      name: 'totalBlocks_',
      hidden: true,
      transient: true,
      value: 0
    },
    {
      class: 'Int',
      name: 'loadingPercentage_',
      hidden: true,
      transient: true,
      value: 0,
      documentation: 'Progress percentage (0-100) for the loading indicator'
    },
    {
      name: 'selected',
      factory: function() { return this; }
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
    },
    'flowErrors_'
  ],

  methods: [
    function getAutosaveKey(scriptName) {
      // Include script name in the key to prevent tabs from overwriting each other
      // Handle unnamed scripts with a separate key
      scriptName = scriptName || this.value.name || '_unnamed';
      return this.AUTOSAVED_SCRIPT_PREFIX + ':' + scriptName;
    },

    function clearAutosave(scriptName) {
      this.window.localStorage.removeItem(this.getAutosaveKey(scriptName));
    },

    function loadAutosaveData(scriptName) {
      var key = this.getAutosaveKey(scriptName);
      var dataStr = this.window.localStorage[key];
      if ( ! dataStr ) return null;

      try {
        return JSON.parse(dataStr);
      } catch (e) {
        this.clearAutosave(scriptName);
        return null;
      }
    },

    async function copyChild(childName) {
      // Make a copy of a flow child
      var c = this.findFlowChildByName(childName);
      if ( c ) {
        await this.eval_(c.cmd);
        this.currentBlock.value.copyFrom(c.value);
      }
    },

    async function includeFlow(name) {
      if ( ! name ) return;
      var flow = await this.flowDAO.find(name);

      if ( flow ) {
        await this.includeScript(flow.script);
      }
    },

    async function includeScript(script, parent, skipParse) {
      var ctx = parent?.__subContext__ || this.__subContext__;
      if ( ! script ) return;
      var cs = skipParse ?
        script :
        foam.json.parseString(script, ctx);

      // Count total blocks for progress tracking (only at top level)
      if ( ! parent ) {
        this.totalBlocks_ = this.countBlocks(cs);
        this.loadingProgress_ = 0;
      }

      for ( var i = 0 ; i < cs.length ; i++ ) {
        var c = cs[i];

        // Update progress counter for all blocks (including nested)
        this.loadingProgress_++;
        this.loadingPercentage_ = Math.round((this.loadingProgress_ / this.totalBlocks_) * 100);

        await ctx.eval_(c.cmd, undefined, undefined, parent);

        let args = { ...c };
        if ( args.value )
          delete args.value;
        // Don't copy flowChildren as they'll be processed separately
        if ( args.flowChildren )
          delete args.flowChildren;
        this.currentBlock.copyFrom(args);

        if ( this.currentBlock.value && c.value ) {
          // if ( c.value.clone ) c.value = c.value.clone(ctx);
          this.currentBlock.value.copyFrom(c.value);
        }

        // Wrap onLoad in try-catch to prevent errors in one block from stopping other blocks
        try {
          await this.currentBlock.value?.onLoad?.();
        } catch (error) {
          console.error('Error loading block:', this.currentBlock.flowName, error);
          // Continue processing other blocks even if this one failed
        }

        if ( c.flowChildren ) {
          await this.includeScript(c.flowChildren, this.currentBlock, true);
        }
      }
      if ( ! parent ){
        await this.eval_('postLoad', null, true);
      }
    },

    function countBlocks(blocks) {
      if ( ! blocks || ! blocks.length ) return 0;
      var count = blocks.length;
      blocks.forEach(b => {
        if ( b.flowChildren ) {
          count += this.countBlocks(b.flowChildren);
        }
      });
      return count;
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
      let oldIsMenuOpen = this.isMenuOpen;
      foam.u2.table.UnstyledTableView.SELECTED_COLUMN_NAMES.memorable = false;
      foam.u2.table.TableView.SELECTED_COLUMN_NAMES.memorable = false;

      // Add the Mode as a CSS Class so we can adjust stying based on the mode
      this.addClass(this.flowMode$.map(m => {
        this.myClass(m.toString());
        this.showNav = m.forceNavHide ? false : this.showNav;
      }));

      this.isMenuOpen = false;
      this.onDetach(() => {
        this.showNav = true;
        this.isMenuOpen = oldIsMenuOpen;
        // Detach all flow children when closing the flow page
        this.flowChildren.forEach(c => this.detachFlowChild(c));
      });
      this.SUPER();

      var self = this;
      this.value.name$.sub(this.onScriptNameChange);
      this.value.name$.sub(() => this.route = this.value.name);

      // Does this ever happen?
      this.value$.sub(() => this.refreshFlowScope());

      this.flowErrors_$.follow(this.value.errors_$);

      globalThis.shell = this; // for debugging

      // Add commands to localScope
      var cmds = await this.commandDAO.select();

      cmds.array.forEach(c => {
        this.localScope[c.id] = async (...args) => {
          var cmd = c.clone(this.currentBlock);
          return await cmd.execute.apply(cmd, args);
        }
      });

      // If this.value.script changes
      //   update this.flowChildren
      //   clearFlow()
      //   rebuild flow
      // If flowChildren changes
      //   update this.value.script

      this.value.script$.sub(this.onScriptChange);
      this.onScriptChange();
      var layout = this.start(this.Layout);

      layout.showLeft$   = this.showPrompts$;
      layout.showRight$  = this.showPrompts$;
      layout.showHeader$ = this.flowMode$.map(m => m.showsHeader);
      layout.middle.call(this.renderSelf, [this]);

      let setupEditMode = () => {
        this.deepSub(this.onFlowChildrenChange, [this.FLOW_CHILDREN, this.VALUE]);
        layout.left.tag(this.FlowableTree, {data: this, selected$: this.selected$, isMenuOpen$: layout.isMenuOpen$});
        layout.right.tag(this.ReflowConfigView, { data$: this.selected$, flowMode$: this.flowMode$});
      };

      if ( this.showPrompts ) {
        setupEditMode();
      } else {
        let sub = this.showPrompts$.sub(() => {
          if ( this.showPrompts ) {
            sub.detach();
            setupEditMode();
          }
        });
      }

      layout.header.add(this.dynamic(function(flowMode, showPrompts) {
        if ( flowMode.isLimitedEditMode && ! flowMode.showsPrompts ) {
          this.tag(self.LimitEditHeader, { data: self });
        } else {
          this.tag(self.ReflowHeader, {data: self, showPrompts: showPrompts, resetFlow: self.clearFlow});
        }
      }, self.flowMode$, self.showPrompts$));

      await this.eval_('preLoad', null, true);

      if ( this.route ) {
        await this.ROUTE.postSet.call(this, '', this.route);
      }
    },

    function renderSelf(self) {
      this.
        addClass(self.myClass()).
        start('div', null, self.out$)
          .addClass(self.myClass('output')).
        end().
        // Add loading indicator overlay
        add(self.dynamic(function(isLoading_, isLoadingMinimized_) {
          if ( isLoading_ && ! isLoadingMinimized_ ) {
            this.start()
              .addClass(self.myClass('loading-indicator'))
              .start().addClass(self.myClass('loading-header'))
                .start().addClass(self.myClass('loading-text'))
                  .add('Loading Flow...')
                .end()
                .tag(self.MINIMIZE_LOADING)
              .end()
              .start().addClass(self.myClass('loading-progress'))
                .add(self.loadingProgress_$.map(function(progress) {
                  if ( self.totalBlocks_ > 0 ) {
                    return `Loading block ${progress} of ${self.totalBlocks_}`;
                  }
                  return 'Preparing flow...';
                }))
              .end()
              .tag(foam.u2.ProgressView, { data$: self.loadingPercentage_$ })
            .end();
          }
        }, self.isLoading_$, self.isLoadingMinimized_$)).
        tag(self.ReflowToolBar);

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
      this.out.element_.scrollTop = this.out.element_.scrollHeight;
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
      let s = this.flowScope;

      // Remove old bindings
      for ( var x in s )
        if ( s.hasOwnProperty(x) )
          delete s[x];

      s.flow = this.value;
      let addBindings = (flow) => {
        flow.flowChildren.forEach(c => {
          // Add shortname bindings for DAO children
          if ( c.value && c.flowName.endsWith('DAO') ) {
            s[c.flowName.substring(0, c.flowName.length-3)] = foam.lang.Holder.isInstance(c.value) ? c.value.value : c.value;
          }
          // Add bindings for children
          if ( c.value ) {
            s[c.flowName] = foam.lang.Holder.isInstance(c.value) ? c.value.value : c.value || c.value;
          }
          s[c.flowName + '$block'] = c;
          if ( this.Flowable.isInstance(c) ) addBindings(c);
        });
      };
      addBindings(this);
    },

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
            block.flowName = m ? m[1] : 'a';
            // Make sure we aren't duplicating an existing name;
            block.flowName = this.createFlowChildName(block.flowName);
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

      // Don't auto-scroll in presentation-style modes
      if ( this.flowMode.autoscrollEnabled ) {
        this.setTimeout(() => this.scrollToBottom(), 100);
      }

      return block;
    },

    function addFlowChild_(c) {
      this.addToScope(c);
      this.out.add(c);
    },

    function addToScope(c) {
      this.refreshFlowScope();
      c.flowName$.sub(() => this.refreshFlowScope());
      c.value$.sub(() => this.refreshFlowScope());
    },

    function removeFlowChild_(c) {
      this.detachFlowChild(c);
      c.remove();
    },

    function moveFlowChild(childName, parent) {
      // TODO: prevent cycles
      console.log('moveFlowChild', childName, parent.flowName);
      var child = this.findFlowChildByName(childName);
      child.flowParent.removeFlowChild(child);
      // Can not use addFlowChild here as the child is detached in the above remove call, this casues cascade of issues when adding a detached child
      // Better to just push into parent flow children manually and rebuild the script, the script rebuild will build all children in correct context
      // parent.addFlowChild(child);
      parent.flowChildren.push(child);
      this.generateScript();
    },

    function moveFlowChildAfter(childName, target) {
      var findPos = (n, arr) => {
        for ( var i = 0 ; i < arr.length ; i++ ) {
          if ( arr[i] === n ) return i+1;
        }
        return 0;
      };
      console.log('moveFlowChildAfter', childName, target.flowName);

      let child = this.findFlowChildByName(childName);
      let targetFlow = target === this ? this : target.flowParent;
      if ( child == targetFlow ) return;
      // Remove from old position
      console.log('removing', i);
      child.flowParent.removeFlowChild(child);

      // Can not use addFlowChild here as the child is detached in the above remove call, this casues cascade of issues when adding a detached child
      // Better to just push into parent flow children manually and rebuild the script, the script rebuild will build all children in correct context
      let children = [...targetFlow.flowChildren];
      i = findPos(target, children);
      console.log('inserting', i);
      children.splice(i, 0, child);

      targetFlow.flowChildren = children;
      this.generateScript();
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

      // Clear autosave after successful save since changes are now persisted
      return flow.flowDAO.put(this.value).then(ret => {
        this.value.copyFrom(ret);
        this.clearAutosave();
        return ret;
      });
    },

    function setSelectedIndex(i) {
      if ( i == -1 || i >= this.flowChildren.length ) {
        this.selected = this;
      } else {
        this.selected = this.flowChildren[i];
      }
    },

    function selectFromTree(block) {
      /**
       * Select a block from the tree view and scroll it into view.
       * When selecting from the tree, we want to scroll because the block
       * may not be visible. When clicking directly on a block in the center
       * view, no scroll is needed since the block was already visible.
       **/
      this.selected = block;
      // Block scroll during loading to prevent jumping while content is being built
      if ( this.isLoading_ ) return;
      if ( block && block.element_ ) {
        block.element_.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      // console.log('******************** script', this.value.script);
    },

    function maybeRegenScript() {
//      if ( this.feedback_ ) return;
      this.feedback_ = true;
      try {
        this.generateScript();
      } finally {
        this.feedback_ = false;
      }
    },

    async function checkForAutosavedScript(scriptName) {
      // Don't retrieve autosave for unnamed flows or in modes that don't check autosave
      if ( ! scriptName || ! this.flowMode.checksAutosave ) return false;

      // Guard against being called multiple times for the same script
      if ( this.checkingAutosaveFor_ === scriptName ) return false;
      this.checkingAutosaveFor_ = scriptName;

      var autosaveData = this.loadAutosaveData(scriptName);
      if ( ! autosaveData || ! autosaveData.script ) {
        this.checkingAutosaveFor_ = null;
        return false;
      }

      // Check if autosave differs from current script
      if ( autosaveData.script === this.value.script ) {
        // Autosave matches current - no need to prompt
        this.checkingAutosaveFor_ = null;
        return false;
      }

      // Check if we have a saved version in the database
      var savedFlow = null;
      if ( scriptName ) {
        try {
          savedFlow = await this.flowDAO.find(scriptName);
        } catch (e) {
          // Flow doesn't exist in database yet
        }
      }

      // If autosave matches the saved version, no need to prompt
      if ( savedFlow && autosaveData.script === savedFlow.script ) {
        this.clearAutosave();
        this.checkingAutosaveFor_ = null;
        return false;
      }

      // Autosave is different from both current and saved - prompt user
      var self = this;
      return new Promise((resolve) => {
        var modal = self.ConfirmationModal.create({
          title: 'Unsaved Changes Detected',
          modalStyle: 'WARN',
          maxWidth: '35vw',
          closeable: false,
          primaryAction: foam.lang.Action.create({
            name: 'load',
            label: 'Load Changes',
            code: function() {
              self.value.script = autosaveData.script;
              self.clearAutosave(scriptName);
              self.checkingAutosaveFor_ = null;
              resolve(true);  // Return true - autosave was loaded
            }
          }),
          secondaryAction: foam.lang.Action.create({
            name: 'discard',
            label: 'Discard',
            code: function() {
              self.clearAutosave(scriptName);
              self.checkingAutosaveFor_ = null;
              resolve(false);  // Return false - autosave was discarded
            }
          })
        });

        modal.add('There are unsaved changes. Do you want to load them?');
        self.add(modal);
      });
    }
  ],

  actions: [
    {
      name: 'helpKey',
      isAvailable: function(flowMode, input_) {
        return flowMode.showsHelpKey && input_.element_ === document.activeElement;
      },
      code: function() { this.eval_('help'); },
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
      code: function() {
        // Check if escape toggle is allowed for this mode
        if ( ! this.flowMode.allowsEscapeToggle ) return;

        var target = this.flowMode.getToggleTarget();
        if ( target ) {
          this.flowMode = target;
        }

        // After toggleMode is executed the app may no longer have focus so thee
        // keyboard shortcut won't work. Set focus to something so if you user presses escape again
        // they can toggle back.
        setTimeout(() => {
          var focusable = this.el_().querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
          var firstFocusable = focusable[1];
          firstFocusable.focus();
        }, 16);
      },
      keyboardShortcuts: [ 'escape' ]
    },
    {
      name: 'minimizeLoading',
      buttonStyle: foam.u2.ButtonStyle.SECONDARY,
      size: 'SMALL',
      themeIcon: 'minus',
      label: '',
      code: function() {
        this.isLoadingMinimized_ = true;
      }
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
      name: 'onScriptNameChange',
      code: function(_, __, ___, evt) {
        // evt contains: { instance_, obj, prop, oldValue }
        var oldValue = evt.oldValue;
        var newValue = this.value.name;

        // When script name changes, check if there's existing autosave for new name
        if ( oldValue === newValue ) return;
        if ( ! this.flowMode.checksAutosave ) return;

        // Don't show modal during initial load - checkForAutosavedScript handles that
        if ( this.isLoading_ || this.checkingAutosaveFor_ ) return;

        // Check if the new name has existing autosave data that differs from current
        var existingData = this.loadAutosaveData(newValue);

        if ( existingData && existingData.script !== this.value.script ) {
          // There's already autosaved data for the new name that differs from current
          var self = this;
          var modal = this.ConfirmationModal.create({
            title: 'Existing Unsaved Changes',
            modalStyle: 'WARN',
            maxWidth: '35vw',
            closeable: false,
            primaryAction: foam.lang.Action.create({
              name: 'load',
              label: 'Load Changes',
              code: function() {
                self.value.script = existingData.script;
              }
            }),
            secondaryAction: foam.lang.Action.create({
              name: 'overwrite',
              label: 'Keep Current',
              code: function() {
                // Keep current changes - autosave will naturally update with current script
              }
            })
          });

          modal.add('The script name "' + newValue + '" already has different unsaved changes. Load those changes, or keep your current changes?');
          this.add(modal);
        }

        // Clean up old autosave entries (from intermediate typing states)
        if ( oldValue ) {
          this.clearAutosave(oldValue);
        }
      }
    },
    {
      name: 'onInput',
      code: function() {
        var input = this.input;
        this.input = '';
        this.eval_(input);
      }
    },
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
        this.isLoading_ = true;
        try {
          var currentBlockName = (this.selected || this).flowName;

          this.clearFlow();

          var script = this.value.script;
          await this.includeScript(script);

          this.selected = ( currentBlockName == this.flowName ) ?
            this :
            ( this.findFlowChildByName(currentBlockName) || this );
          this.value.loadComplete.pub();
        } finally {
          this.feedback_ = false;
          this.isLoading_ = false;



          // Reset progress counters
          this.loadingProgress_ = 0;
          this.totalBlocks_ = 0;
          this.loadingPercentage_ = 0;
        }
      }
    },
    {
      name: 'onFlowChildrenChange',
      isMerged: true,
      delay: 500,
      code: function() {
        this.maybeRegenScript();
        this.saveScriptToLocalStorage();
      }
    },
    {
      name: 'saveScriptToLocalStorage',
      isMerged: true,
      delay: 250,
      code: function() {
        // Don't auto-save in modes that don't support autosave
        if ( ! this.flowMode.autosaveEnabled ) return;

        if ( ! this.value || ! this.value.script ) return;

        // Don't save unnamed flows to local storage
        if ( ! this.value.name ) return;

        // Only autosave if there are unsaved changes (revision > 0)
        if ( this.value.revision > 0 ) {
          var autosaveData = {
            script: this.value.script
          };
          this.window.localStorage[this.getAutosaveKey()] = JSON.stringify(autosaveData);
        } else {
          // No unsaved changes - clear autosave
          this.clearAutosave();
        }
      }
    }
  ]
});
