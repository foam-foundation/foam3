/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Block',
  extends: 'foam.u2.Accordion',
  implements: [ 'foam.core.reflow.Flowable' ],

  mixins: [ 'foam.u2.StyleConfigurator' ],

  requires: [ 'foam.u2.WrapperNode' ],

  imports: [ 'data', 'showPrompts', 'addToScope', 'selected', 'graphFocus', 'graphMode', 'selectFromTree' ],

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
    .foam-core-reflow-Console-previewing ^preview-ancestor > ^toolbar {
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
      properties: ['flowName', 'cmd', /*'error',*/ 'shown']
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
      supportingLabel: 'Used to as the name for this block and as the variable name in the scope',
      // A validated property defaults its input to onKey (foam.u2.tag.Input.fromProperty),
      // which would commit a name per keystroke and fire postSet mid-word. Names are
      // committed whole.
      onKey: false,
      postSet: function(o, n) {
        // A block still being built has no Console above it yet.
        var root = this.flowRoot();
        if ( root.onBlockRenamed ) root.onBlockRenamed(this, o, n);
      },
      validateObj: function(flowName) {
        if ( ! flowName ) return;
        var root = this.flowRoot();
        if ( root.flattenFlow(root.flowChildren).filter(b => b.flowName === flowName).length > 1 )
          return 'Already used by another block.';
      }
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
      name: 'rendersOutput',
      documentation: `Whether this block puts something on screen: it is shown and
        its command rendered into 'out'. Commands that only compute (script,
        transform) call addValue(value, true) and leave 'out' empty.`,
      transient: true,
      hidden: true,
      getter: function() { return !! this.shown && this.out.childNodes.length > 0; }
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
      documentation: 'DEPRECATED: USE STYLE CONFIGURATOR INSTEAD.',
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
      documentation: `DEPRECATED: USE SYLE CONFIGURATOR INSTEAD.`,
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
      this.content.tag(foam.u2.borders.TitleBorder, { ...this.border }, self.borderEl_$);
      this.out = this.WrapperNode.create({ parentNode: this.content }, this);
      self.borderEl_.add(this.out);
      // Since border's properties will be copied over after in includeScript, set it here
      this.onDetach(this.border$.sub(() => {
        this.borderEl_.copyFrom(this.border);
        this.maybeMigrate();
      }));
    },

    function setTitle(title) {
      if ( this.borderEl_ ) {
        this.borderEl_.title = title;
      } else {
        this.border.title = title;
      }
    },

    function render() {
      this.on('click', this.onClick);
      this.addClass('block');
      this.enableClass(this.myClass('hidePrompts'), this.showPrompts$.not());
      // On the path of the selected block: it, its containers, or its children.
      this.enableClass('preview-path', this.selected$.map(s => this.isRelated_(s)));
      // A container of the selected block: shown for its layout, header hidden in the preview.
      this.enableClass(this.myClass('preview-ancestor'), this.selected$.map(s => !! s && s !== this && this.isRelated_(s) && ! this.isAncestorOf_(s, this)));
      this.title.add(this.flowName$);
      this.rightSection.tag(this.SHOW_IN_GRAPH, { label: '' });
      this.rightSection.tag(this.SHOW_IN_DOCUMENT, { label: '' });
      this.rightSection.tag(this.DEL, { label: ''});
      this.SUPER();
      this.initCSSProps(this.content);
      if ( ! this.padding_st )
        this.padding_st = '16px';
    },

    function isAncestorOf_(ancestor, block) {
      for ( var x = block ; x ; x = x.flowParent ) if ( x === ancestor ) return true;
      return false;
    },

    function isRelated_(other) {
      /** True when other is this block, one of its ancestors, or one of its descendants. */
      return !! other && ( this.isAncestorOf_(this, other) || this.isAncestorOf_(other, this) );
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
      name: 'showInGraph',
      label: 'Show in Graph',
      toolTip: 'Open the graph view focused on this block and its links',
      themeIcon: 'flow',
      buttonStyle: 'TERTIARY',
      size: 'SMALL',
      availablePermissions: [ 'reflow.graph' ],
      isAvailable: function(showPrompts, graphMode) { return !! showPrompts && ! graphMode; },
      code: function() {
        this.selected = this;
        this.graphFocus = this.flowName;
        this.graphMode = true;
      }
    },
    {
      name: 'showInDocument',
      label: 'Show in Document',
      toolTip: 'Back to the document, scrolled to this block',
      themeIcon: 'flow',
      buttonStyle: 'TERTIARY',
      size: 'SMALL',
      availablePermissions: [ 'reflow.graph' ],
      isAvailable: function(showPrompts, graphMode) { return !! showPrompts && !! graphMode; },
      code: function() {
        this.graphMode = false;
        this.selectFromTree(this);
      }
    },
    {
      name: 'del',
      label: 'Delete',
      themeIcon: 'close',
      buttonStyle: 'TERTIARY',
      size: 'SMALL',
      code: function() { this.flowRoot().deleteFlowChild(this); }
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
