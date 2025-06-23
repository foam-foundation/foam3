/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2',
  name: 'Entity',

  documentation: `
    Virtual-DOM Entity.
    // TODO: Make both Entity and Element extend a common base-Model (Node?)
  `,

  properties: [
    {
      name: 'name',
      documentation: `
        // parser: seq(alphaChar, repeat0(wordChar)),
        // TODO(adamvy): This should be 'pattern' or 'regex', if those are ever
        // added.
      `,
      assertValue: function(nu) {
        if ( ! nu.match(/^[a-z#]\w*$/i) ) {
          throw new Error('Invalid Entity name: ' + nu);
        }
      }
    }
  ],

  methods: [
    function output(out) { out('&', this.name, ';'); },
    function toE() { return this; }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'DefaultValidator',

  documentation: 'Default Element validator.',

  axioms: [ foam.pattern.Singleton.create() ],

  methods: [
    function validateNodeName(name) {
      return true;
    },

    function validateAttributeName(name) {
      // TODO
    },

    function validateAttributeValue(value) {
      // TODO
    },

    function validateStyleName(name) {
      // TODO
    },

    function validateStyleValue(value) {
      // TODO
    },

    function sanitizeText(text) {
      if ( text === null || text === undefined ) return text;
      text = text.toString();
      if ( text.search(/[&<"']/) == -1 ) return text;
      return text.replace(/[&<"']/g, (m) => {
        switch ( m ) {
          case '&': return '&amp;';
          case '<': return '&lt;';
          case '"': return '&quot;';
          case "'": return '&#039';
        }
      });
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'ElementState',

  documentation: `
    Current lifecycle state of an Element.
    // TODO: Do we want the following method?
    // function detach() {},
  `,

  methods: [
    function el() {},
    function output(out) {},
    function load() {},
    function unload() {},
    function onRemove() {},
    function onSetClass() {},
    function onFocus() {},
    function onAddListener() {},
    function onRemoveListener() {},
    function onSetStyle() {},
    function onSetAttr() {},
    function onRemoveAttr() {},
    function onAddChildren() {},
    function onInsertChildren() {},
    function onReplaceChild() {},
    function onRemoveChild() {},
    function getBoundingClientRect() {
      return {
        left:   0,
        right:  0,
        bottom: 0,
        top:    0,
        width:  0,
        height: 0
      };
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'InitialElementState',
  extends: 'foam.u2.UnloadedElementState',

  documentation: 'Initial state of a newly created Element.',

  axioms: [ foam.pattern.Singleton.create() ],

  methods: [
    function el() {
      var self = this;
      return new Promise(function(resolve, reject) {
        self.sub('onload', () => resolve(self.el_()));
      });
    },
    function output(out) {
      let ret = this.render();
      Promise.resolve(ret).then(v => {
        if ( v != undefined ) {
          console.error('render() should not return a value, this may cause issues with slotted elements', this.cls_.id);
        }
      });
      this.state = this.OUTPUT;
      this.output_(out);
      return out;
    },
    function toString() { return 'INITIAL'; }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'OutputElementState',
  extends: 'foam.u2.ElementState',

  documentation: 'State of Element after it has been output to DOM, but not yet loaded.',

  methods: [
    function el() {
      var self = this;
      return new Promise(function(resolve, reject) {
        self.sub('onload', () => resolve(self.el_()));
      });
    },
    function output(out) {
      // TODO: raise a real error
      this.__context__.warn('ERROR: Duplicate output.');
      return this.UNLOADED.output.call(this, out);
    },
    function load() {
      if ( this.hasOwnProperty('elListeners') ) {
        var ls = this.elListeners;
        for ( var i = 0 ; i < ls.length ; i += 3 ) {
          this.addEventListener_(ls[i], ls[i+1], ls[i+2] || false);
        }
      }

      this.visitChildren('load');
      this.state = this.LOADED;
      if ( this.tabIndex ) this.setAttribute('tabindex', this.tabIndex);
      // Add a delay before setting the focus in case the DOM isn't visible yet.
      if ( this.focused ) this.el().then(el => el.focus());
      // Allows you to take the DOM element and map it back to a
      // foam.u2.Element object.  This is expensive when building
      // lots of DOM since it adds an extra DOM call per Element.
      // But you could use it to cut down on the number of listeners
      // in something like a table view by doing per table listeners
      // rather than per-row listeners and in the event finding the right
      // U2 view by walking the DOM tree and checking e_.
      // This could save more time than the work spent here adding e_ to each
      // DOM element.
      // this.el().e_ = this;
    },
    function unload() {
      this.state = this.UNLOADED;
      this.visitChildren('unload');
      this.detach();
    },
    function onSetClass() { throw new Error('Mutations not allowed in OUTPUT state.'); },
    function onFocus() { throw new Error('Mutations not allowed in OUTPUT state.'); },
    function onAddListener() { throw new Error('Mutations not allowed in OUTPUT state.'); },
    function onRemoveListener() { throw new Error('Mutations not allowed in OUTPUT state.'); },
    function onSetStyle() { throw new Error('Mutations not allowed in OUTPUT state.'); },
    function onSetAttr() { throw new Error('Mutations not allowed in OUTPUT state.'); },
    function onRemoveAttr() { throw new Error('Mutations not allowed in OUTPUT state.'); },
    function onAddChildren() { throw new Error('Mutations not allowed in OUTPUT state.'); },
    function onInsertChildren() { throw new Error('Mutations not allowed in OUTPUT state.'); },
    function onReplaceChild() { throw new Error('Mutations not allowed in OUTPUT state.'); },
    function onRemoveChild() { throw new Error('Mutations not allowed in OUTPUT state.'); },
    function toString() { return 'OUTPUT'; }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'LoadedElementState',
  extends: 'foam.u2.ElementState',

  documentation: 'State of an Element after it has been output to the DOM and loaded.',

  methods: [
    function el() {
      return Promise.resolve(this.el_());
    },

    function output(out) {
      this.__context__.warn('Duplicate output.');
      return this.UNLOADED.output.call(this, out);
    },
    function load() { this.__console__.warn('Duplicate load.'); },
    function unload() {
      if ( ! this.parentNode || this.parentNode.state === this.LOADED ) {
        var e = this.el_();
        if ( e ) e.remove();
      }

      this.state = this.UNLOADED;
      this.visitChildren('unload');
      this.detach();
    },
    function onRemove() { this.unload(); },
    function onSetClass(cls, enabled) {
      var e = this.el_();
      if ( e ) {
        e.classList[enabled ? 'add' : 'remove'](cls);
      } else {
        this.__context__.warn('Missing Element: ', this.id);
      }
    },
    function onFocus() {
      this.el_().focus();
    },
    function onAddListener(topic, listener, opt_args) {
      this.addEventListener_(topic, listener, opt_args);
    },
    function onRemoveListener(topic, listener) {
      this.addRemoveListener_(topic, listener);
    },
    function onSetStyle(key, value) {
      this.el_().style[key] = value;
    },
    function onSetAttr(key, value) {
      if ( this.PSEDO_ATTRIBUTES[key] ) {
        this.el_()[key] = value;
      } else {
        this.el_().setAttribute(key, value === true ? '' : value);
      }
    },
    function onRemoveAttr(key) {
      if ( this.PSEDO_ATTRIBUTES[key] ) {
        this.el_()[key] = '';
      } else {
        this.el_().removeAttribute(key);
      }
    },
    function onAddChildren() {
      var e = this.el_();
      if ( ! e ) {
        this.__context__.warn('Missing Element: ', this.id);
        return;
      }
      var out = this.createOutputStream();
      for ( var i = 0 ; i < arguments.length ; i++ ) {
        out(arguments[i]);
      }
      e.insertAdjacentHTML('beforeend', out);
      for ( var i = 0 ; i < arguments.length ; i++ ) {
        arguments[i].load && arguments[i].load();
      }
    },
    function onInsertChildren(children, reference, where) {
      var e = this.el_();
      if ( ! e ) {
        this.__context__.warn('Missing Element: ', this.id);
        return;
      }
      var out = this.createOutputStream();
      for ( var i = 0 ; i < children.length ; i++ ) {
        out(children[i]);
      }

      reference.el_().insertAdjacentHTML(where, out);

      // EXPERIMENTAL:
      // TODO(kgr): This causes some elements to get stuck in OUTPUT state
      // forever. It can be resurrected if that problem is fixed.
      // Load (mostly adding listeners) on the next frame
      // to allow the HTML to be shown more quickly.
      // this.__context__.window.setTimeout(function() {
      for ( var i = 0 ; i < children.length ; i++ ) {
        children[i].load && children[i].load();
      }
      // }, 33);
    },
    function onReplaceChild(oldE, newE) {
      var e = this.el_();
      if ( ! e ) {
        this.__context__.warn('Missing Element: ', this.id);
        return;
      }
      var out = this.createOutputStream();
      out(newE);
      oldE.el_().outerHTML = out.toString();
      newE.load && newE.load();
    },
    function onRemoveChild(child, index) {
      if ( typeof child === 'string' ) {
        var c = this.el_().childNodes;
        // Can happen of adjacent text nodes are merged
        if ( c.length > index ) {
          c[index].remove();
        }
      } else {
        child.remove();
      }
    },
    function getBoundingClientRect() {
      return this.el_().getBoundingClientRect();
    },
    function toString() { return 'LOADED'; }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'UnloadedElementState',
  extends: 'foam.u2.ElementState',

  documentation: 'State of an unloaded Element.',

  methods: [
    function el() {
      // A NOOP Promise that will never resolve
      return { then: function() {}, catch: function() {} };
    },
    function output(out) {
      this.__context__.warn('Outputting unloaded element can cause event/binding bugs.', this.cls_.id);
      this.state = this.OUTPUT;
      this.output_(out);
      return out;
    },
    function load() {
      this.__context__.warn('Must output before loading.');
    },
    function unload() {
    },
    function toString() { return 'UNLOADED'; }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'RenderSink',
  implements: [
    'foam.dao.Sink'
  ],

  documentation: `
    Any call to put, remove, or reset on this sink will:

      1. call the 'cleanup' method, then
      2. call the 'addRow' method on each object in the DAO.

    You must provide three things:

      1. the DAO,
      2. an implementation of the 'addRow' method, and
      3. an implementation of the 'cleanup' method.
  `,

  properties: [
    {
      class: 'foam.dao.DAOProperty',
      name: 'dao',
    },
    {
      class: 'Function',
      name: 'addRow',
      documentation: `Called on each object in the DAO.`
    },
    {
      class: 'Function',
      name: 'cleanup',
      documentation: `Called before addRow is applied to objects in the DAO.`
    },
    {
      class: 'Int',
      name: 'batch',
      documentation: `Used to check whether a paint should be performed or not.`
    },
    'comparator'
  ],

  methods: [
    function put(obj, s) {
      this.reset();
    },

    function remove(obj, s) {
      this.reset();
    },

    function reset() {
      this.paint();
    }
  ],

  listeners: [
    {
      name: 'paint',
      isFramed: true,
      code: function() {
        var batch = ++this.batch;
        var self  = this;

        if ( ! foam.dao.DAO.isInstance(this.dao) ) {
          throw new Error("You must set the 'dao' property of RenderSink.");
        }

        var dao = this.dao;
        this.dao.select().then(function(a) {
          // Check if this is a stale render
          if ( self.batch !== batch ) return;

          var objs = a.array;
          if ( self.comparator ) objs.sort(self.comparator.compare.bind(self.comparator));

          self.cleanup();
          for ( var i = 0 ; i < objs.length ; i++ ) {
            self.addRow(objs[i]);
          }
        });
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'Element',

  documentation: `
    Virtual-DOM Element. Root model for all U2 UI components.

    To insert a U2 Element into a regular DOM element, either:

    el.innerHTML = view.outerHTML;
    view.load();

    Or use a foam tag in your markup:

    <foam class="com.acme.mypackage.MyView"></foam>

    // TODO: Decide if we want this or not:
    // function XXXE(opt_nodeName // | DIV //) {
    //   // Create a new Element
    //   var Y = this.__subContext__;
    //
    //   // ???: Is this needed / a good idea?
    //   if ( this.data && ! Y.data ) Y = Y.createSubContext({ data: this.data });
    //
    //   // Some names have sub-Models registered for them.
    //   // Example 'input'
    //   var e = Y.elementForName(opt_nodeName);
    //
    //   if ( ! e ) {
    //     e = foam.u2.Element.create(null, Y);
    //     if ( opt_nodeName ) e.nodeName = opt_nodeName;
    //   }
    //
    //   return e;
    // },
`,

  requires: [
    {
      path: 'foam.lang.PromiseSlot',
      flags: ['js']
    },
    {
      path: 'foam.u2.ViewSpec',
      flags: ['js']
    },
    'foam.u2.AttrSlot',
    'foam.u2.Entity',
    'foam.u2.RenderSink',
    'foam.u2.Tooltip'
  ],

  imports: [
    'document',
    'elementValidator',
    'error',
    'framed',
    'getElementById',
    'translationService?'
  ],

  implements: [
    'foam.mlang.Expressions'
  ],

  topics: [
    'onload',
    'onunload'
  ],

  constants: [
    {
      // TODO: To replace ^ in future, to be compatible with U3
      name: 'CSS_SELF',
      value: '<<'
    },
    {
      name: 'CSS_CLASSNAME_PATTERN',
      factory: function() { return /^[a-z_-][a-z\d_-]*$/i; }
    },
    {
      documentation: `
        Psedo-attributes don't work consistently with setAttribute() so need to
        be set on the real DOM element directly.
      `,
      name: 'PSEDO_ATTRIBUTES',
      value: {
        value:   true,
        checked: true
      }
    },

    {
      name: 'DEFAULT_VALIDATOR',
      type: 'foam.u2.DefaultValidator',
      flags: ['js'],
      factory: function() { return foam.u2.DefaultValidator.create(); }
    },

    {
      documentation: `
        Initial state of an Element before it has been added to the DOM.
      `,
      name: 'INITIAL',
      type: 'foam.u2.InitialElementState',
      flags: ['js'],
      factory: function() {
        return foam.u2.InitialElementState.create();
      }
    },

    {
      documentation: `
        State of an Element after it has been output (to a String) but before it
        is loaded. This should be only a brief transitory state, as the Element
        should be loaded almost immediately after being output. It is an error
        to try and mutate the Element while in the OUTPUT state.
      `,
      name: 'OUTPUT',
      type: 'foam.u2.OutputElementState',
      flags: ['js'],
      factory: function() { return foam.u2.OutputElementState.create(); }
    },

    {
      documentation: `
        State of an Element after it has been loaded.
        A Loaded Element should be visible in the DOM.
      `,
      name: 'LOADED',
      type: 'foam.u2.LoadedElementState',
      flags: ['js'],
      factory: function() { return foam.u2.LoadedElementState.create(); }
    },

    {
      documentation: `
        State of an Element after it has been removed from the DOM.
        An unloaded Element can be re-added to the DOM.
      `,
      name: 'UNLOADED',
      type: 'foam.u2.UnloadedElementState',
      flags: ['js'],
      factory: function() { return foam.u2.UnloadedElementState.create(); }
    },

    // ???: Add DESTROYED State?

    {
      documentation: `TODO: Don't allow these as they lead to ambiguous markup.`,
      name: 'OPTIONAL_CLOSE_TAGS',
      value: {
        BODY: true,
        COLGROUP: true,
        DD: true,
        DT: true,
        HEAD: true,
        HTML: true,
        LI: true,
        OPTION: true,
        P: true,
        TBODY: true,
        TD: true,
        TFOOT: true,
        TH: true,
        THEAD: true,
        TR: true
      }
    },

    {
      documentation: `
        Element nodeName's that are self-closing.
        Used to generate valid HTML output.
        Used by ElementParser for valid HTML parsing.
      `,
      name: 'ILLEGAL_CLOSE_TAGS',
      value: {
        AREA: true,
        BASE: true,
        BASEFONT: true,
        BR: true,
        COL: true,
        FRAME: true,
        HR: true,
        IMG: true,
        INPUT: true,
        ISINDEX: true,
        LINK: true,
        META: true,
        PARAM: true
      }
    },

    {
      name: '__ID__',
      value: [ 1 ]
    },

    {
      name: 'NEXT_ID',
      flags: ['js'],
      value: function() {
        return this.__ID__[ 0 ]++;
      }
    },

    {
      documentation: `Keys which respond to keydown but not keypress`,
      name: 'KEYPRESS_CODES',
      value: { 8: true, 13: true, 27: true, 33: true, 34: true, 37: true, 38: true, 39: true, 40: true }
    },

    {
      name: 'NAMED_CODES',
      value: {
        '8':   'backspace',
        '13':  'enter',
        '27':  'esc',
        '37':  'left',
        '38':  'up',
        '39':  'right',
        '40':  'down',
        '127': 'del'
      }
    }
  ],

  messages: [
    {
      name: 'SELECT_BAD_USAGE',
      message: `You're using Element.select() wrong. The function passed to it must return an Element. Don't try to modify the view by side effects.`
    }
  ],

  properties: [
    {
      // TODO: class is needed to fix the Java build, but this shouldn't be building for Java anyway.
      class: 'Object',
      name: 'id',
      transient: true,
      factory: function() { return this.NEXT_ID(); }
    },
    {
      class: 'Enum',
      of: 'foam.u2.ControllerMode',
      name: 'controllerMode',
      factory: function() { return this.__context__.controllerMode || foam.u2.ControllerMode.CREATE; }
    },
    {
      name: 'state',
      class: 'Proxy',
      of: 'foam.u2.ElementState',
      flags: ['js'],
      transient: true,
      topics: [],
      delegates: foam.u2.ElementState.getOwnAxiomsByClass(foam.lang.Method).
        map(function(m) { return m.name; }),
      factory: function() { return this.INITIAL; },
      postSet: function(oldState, state) {
        if ( state === this.LOADED ) {
          this.pub('onload');
        } else if ( state === this.UNLOADED ) {
          this.pub('onunload');
        }
      }
    },
    {
      name: 'content',
      preSet: function(o, n) {
        // Prevent setting to 'this', which wouldn't change the behaviour.
        return n === this ? null : n ;
      }
    },
    {
      class: 'String',
      name: 'tooltip',
      postSet: function(o, n) {
        if ( n && ! o && this.state == this.LOADED ) this.initTooltip();
        return n;
      }
    },
    {
      name: 'parentNode',
      transient: true
    },
    {
      class: 'Boolean',
      name: 'shown',
      value: true,
      postSet: function(o, n) {
        if ( o === n ) return;
        if ( n ) {
          this.removeClass('foam-u2-Element-hidden');
        } else {
          this.addClass('foam-u2-Element-hidden');
        }
      }
    },
    {
      class: 'Proxy',
      of: 'foam.u2.DefaultValidator',
      name: 'validator',
      flags: ['js'],
      topics: [],
      factory: function() {
        return this.elementValidator$ ? this.elementValidator : this.DEFAULT_VALIDATOR;
      }
    },
    {
      name: 'nodeName',
      adapt: function(_, v) {
        // Convert to uppercase so that checks against OPTIONAL_CLOSE_TAGS
        // and ILLEGAL_CLOSE_TAGS work.
        return foam.String.toUpperCase(v);
      },
      value: 'DIV'
    },
    {
      name: 'attributeMap',
      documentation: 'Same information as "attributes", but in map form for faster lookup',
      transient: true,
      factory: function() { return {}; }
    },
    {
      name: 'attributes',
      documentation: 'Array of {name: ..., value: ...} attributes.',
      factory: function() { return []; },
      postSet: function(_, attrs) {
        this.attributeMap = {};
        for ( var i = 0 ; i < attrs.length ; i++ ) {
          this.attributeMap[attrs[i].name] = attrs[i];
        }
      }
    },
    {
      name: 'classes',
      documentation: 'CSS classes assigned to this Element. Stored as a map of true values.',
      factory: function() { return {}; }
    },
    {
      name: 'css',
      documentation: 'Styles added to this Element.',
      factory: function() { return {}; }
    },
    {
      name: 'childNodes',
      documentation: 'Children of this Element.',
      factory: function() { return []; }
    },
    {
      name: 'elListeners',
      documentation: 'DOM listeners of this Element. Stored as topic then listener.',
      factory: function() { return []; }
    },
    {
      name: 'children',
      documentation: 'Virtual property of non-String childNodes.',
      transient: true,
      getter: function() {
        return this.childNodes.filter(function(c) {
          return typeof c !== 'string';
        });
      }
    },
    {
      class: 'Boolean',
      name: 'focused',
      postSet: function(o, n) {
        if ( n ) this.onFocus();
      }
    },
    {
      name: 'outerHTML',
      transient: true,
      hidden: true,
      getter: function() {
        return this.output(this.createOutputStream()).toString();
      }
    },
    {
      name: 'innerHTML',
      transient: true,
      hidden: true,
      getter: function() {
        return this.outputInnerHTML(this.createOutputStream()).toString();
      }
    },
    {
      name: 'scrollHeight'
    },
    {
      class: 'Int',
      name: 'tabIndex',
    },
    {
      name: 'clickTarget_'
    },
    {
      name: '__subSubContext__',
      documentation:
        `Current subContext to use when creating children.
        Defaults to __subContext__ unless in a nested startContext().`,
      factory: function() { return this.__subContext__; }
    },
    'keyMap_'
  ],

  methods: [
    function replaceElement_(el) {
      el.outerHTML = this.outerHTML;
      this.load();
    },

    function detach() {
      this.SUPER();
      this.childNodes = [];
      this.children   = [];
    },

    function init() {
      /*
      if ( ! this.translationService )
        console.warn('Element ' + this.cls_.name + ' created with globalContext');
      */
      this.onDetach(this.visitChildren.bind(this, 'detach'));
    },

    function render() {
      /*
        Template method for adding addtion element initialization
        just before Element is output().
      */
      this.initTooltip();
      this.initKeyboardShortcuts();
    },

    async function observeScrollHeight() {
      // TODO: This should be handled by an onsub event when someone subscribes to
      // scroll height changes.
      var self = this;
      var observer = new MutationObserver(async function(mutations) {
        var el = await self.el();
        self.scrollHeight = el.scrollHeight;
      });
      var config = { attributes: true, childList: true, characterData: true };

      var e = await this.el();
      observer.observe(e, config);
      this.onunload.sub(function(s) {
        // might already be disconnected
        try { observer.disconnect(); } catch(x) {}
      });
      return this;
    },

    function evtToCharCode(evt) {
      /* Maps an event keycode to a string */
      var s = '';
      if ( evt.altKey   ) s += 'alt-';
      if ( evt.ctrlKey  ) s += 'ctrl-';
      if ( evt.shiftKey && evt.type === 'keydown' ) s += 'shift-';
      if ( evt.metaKey  ) s += 'meta-';
      s += evt.type === 'keydown' ?
          this.NAMED_CODES[evt.which] || String.fromCharCode(evt.which) :
          String.fromCharCode(evt.charCode);
      return s;
    },

    function initKeyMap_(keyMap, cls) {
      var keyMap;

      if ( ! cls.hasOwnProperty('keyMap__') ) {
        var count = 0;
        keyMap = {};

        var as = cls.getAxiomsByClass(foam.lang.Action);

        for ( var i = 0 ; i < as.length ; i++ ) {
          var a = as[i];

          for ( var j = 0 ; a.keyboardShortcuts && j < a.keyboardShortcuts.length ; j++, count++ ) {
            var key = a.keyboardShortcuts[j];

            // First, lookup named codes, then convert numbers to char codes,
            // otherwise, assume we have a single character string treated as
            // a character to be recognized.
            if ( this.NAMED_CODES[key] ) {
              key = this.NAMED_CODES[key];
            } else if ( typeof key === 'number' ) {
              key = String.fromCharCode(key);
            }

            keyMap[key] = a;// .maybeCall.bind(a, this.__subContext__, this);
            /*
            keyMap[key] = opt_value ?
              function() { a.maybeCall(this.__subContext__, opt_value.get()); } :
              a.maybeCall.bind(action, self.X, self) ;
            */
          }
        }

        if ( count == 0 ) keyMap = null;

        cls.keyMap__ = keyMap;
      } else {
        keyMap = cls.keyMap__;
      }

      if ( ! keyMap ) return null;

      var map = {};

      for ( var key in keyMap ) map[key] = keyMap[key].maybeCall.bind(keyMap[key], this.__subContext__, this);

      return map;
    },

    function initTooltip() {
      if ( this.tooltip ) {
        this.Tooltip.create({target: this, text$: this.tooltip$});
      } else if ( this.getAttribute('title') ) {
        this.Tooltip.create({target: this, text$: this.attrSlot('title')});
      }
    },

    function initKeyboardShortcuts() {
      /* Initializes keyboard shortcuts. */
      var keyMap = this.initKeyMap_(keyMap, this.cls_);

      //      if ( this.of ) count += this.initKeyMap_(keyMap, this.of);
      if ( keyMap ) {
        this.keyMap_ = keyMap;
        var target = this.parentNode || this;

        // Ensure that target is focusable, and therefore will capture keydown
        // and keypress events.
        target.tabIndex = target.tabIndex || 1;

        target.on('keydown',  this.onKeyboardShortcut);
        target.on('keypress', this.onKeyboardShortcut);
      }
    },

    function el_() {
      return this.elId_ || ( this.elId_ = this.getElementById(this.id) );
    },

    function findChildForEvent(e) {
      var src  = e.srcElement;
      var el   = this.el_();
      var cMap = {};
      var cs   = this.children;

      if ( ! el ) return;

      for ( var i = 0 ; i < cs.length ; i++ ) {
        var c = cs[i];
        cMap[c.id] = c;
      }

      while ( src !== el ) {
        var c = cMap[src.id];
        if ( c ) return c;
        src = src.parentElement;
      }
    },

    function E(opt_nodeName) {
      return this.__subSubContext__.E(opt_nodeName);
    },

    function attrSlot(opt_name, opt_event) {
      /* Convenience method for creating an AttrSlot's. */
      var args = { element: this };

      if ( opt_name  ) args.property = opt_name;
      if ( opt_event ) args.event    = opt_event;

      return this.AttrSlot.create(args);
    },

    function myClass(opt_extra) {
      // Use hasOwnProperty so that class doesn't inherit CSS classname
      // from ancestor FOAM class.
      var f = this.cls_.hasOwnProperty('myClass_') && this.cls_.myClass_;

      if ( ! f ) {
        var base = this.cls_.hasOwnProperty('CSS_CLASS') ?
          this.cls_.CSS_CLASS.split(/ +/) :
          foam.String.cssClassize(this.cls_.id).split(/ +/) ;

        f = this.cls_.myClass_ = foam.Function.memoize1(function(e) {
          return base.map(function(c) { return c + (e ? '-' + e : ''); }).join(' ');
        });
      }

      return f(opt_extra);
    },

    // TODO: what is this for?
    function instanceClass(opt_extra) {
      return this.myClass(this.id + '-' + opt_extra);
    },

    function visitChildren(methodName) {
      /*
        Call the named method on all children.
        Typically used to transition state of all children at once.
        Ex.: this.visitChildren('load');
      */
      var cs = this.childNodes;
      for ( var i = 0 ; i < cs.length ; i++ ) {
        var c = cs[i];
        c[methodName] && c[methodName].call(c);
      }
    },

    function focus() {
      this.focused = true;
      return this;
    },

    function blur() {
      this.focused = false;
      return this;
    },

    function show(opt_shown) {
      if ( opt_shown === undefined ) {
        this.shown = true;
      } else if ( foam.lang.Slot.isInstance(opt_shown) ) {
        this.onDetach(this.shown$.follow(opt_shown));
      } else {
        this.shown = opt_shown;
      }

      return this;
    },

    function hide(opt_hidden) {
      return this.show(
          opt_hidden === undefined              ? false :
          foam.lang.Slot.isInstance(opt_hidden) ? opt_hidden.map(function(s) { return ! s; }) :
          ! opt_hidden);
    },

    function setAttribute(name, value) {
      /*
        Set an Element attribute or property.

        If this model has a property named 'name' which has 'attribute: true',
        then the property will be updated with value.
        Otherwise, the DOM attribute will be set.

        Value can be either a string, a Value, or an Object.
        If Value is undefined, null or false, the attribute will be removed.
      */

      // TODO: type checking

      if ( name === 'tabindex' ) this.tabIndex = parseInt(value);

      // handle slot binding, ex.: data$: ...,
      // Remove if we add a props() method
      if ( name.endsWith('$') ) {
        this[name] = value;
        return;
      }

      var prop = this.cls_.getAxiomByName(name);

      if ( prop &&
           foam.lang.Property.isInstance(prop) &&
           prop.attribute )
      {
        if ( typeof value === 'string' ) {
          // TODO: remove check when all properties have fromString()
          this[name] = prop.fromString ? prop.fromString(value) : value;
        } else if ( foam.lang.Slot.isInstance(value) ) {
          this.onDetach(this.slot(name).follow(value));
        } else {
          this[name] = value;
        }
      } else {
        if ( value === undefined || value === null || value === false ) {
          this.removeAttribute(name);
          return this;
        }

        if ( foam.lang.Slot.isInstance(value) ) {
          this.slotAttr_(name, value);
        } else {
          foam.assert(foam.util.isPrimitive(value), 'Attribute value must be a primitive type.');

          var attr = this.getAttributeNode(name);

          if ( attr ) {
            attr.value = value;
          } else {
            attr = { name: name, value: value };
            this.attributes.push(attr);
            this.attributeMap[name] = attr;
          }

          this.onSetAttr(name, value);
        }
      }

      return this;
    },

    function removeAttribute(name) {
      /* Remove attribute named 'name'. */
      for ( var i = 0 ; i < this.attributes.length ; i++ ) {
        if ( this.attributes[i].name === name ) {
          this.attributes.splice(i, 1);
          delete this.attributeMap[name];
          this.onRemoveAttr(name);
          return;
        }
      }
    },

    function getAttributeNode(name) {
      /*
        Get {name: ..., value: ...} attributeNode associated
        with 'name', if exists.
      */
      return this.attributeMap[name];
    },

    function getAttribute(name) {
      // TODO: add support for other dynamic attributes also
      // TODO: don't lookup in real DOM if listener present
      if ( this.PSEDO_ATTRIBUTES[name] && this.el_() ) {
        var value = this.el_()[name];
        var attr  = this.getAttributeNode(name);

        if ( attr ) {
          attr.value = value;
        } else {
          attr = { name: name, value: value };
          this.attributes.push(attr);
          this.attributeMap[name] = attr;
        }

        return value;
      }

      /*
        Get value associated with attribute 'name',
        or undefined if attribute not set.
      */
      var attr = this.getAttributeNode(name);
      return attr && attr.value;
    },

    function appendChild(c) {
      // TODO: finish implementation
      this.childNodes.push(c);
    },

    function removeChild(c) {
      /* Remove a Child node (String or Element). */
      var cs = this.childNodes;
      for ( var i = 0 ; i < cs.length ; ++i ) {
        if ( cs[i] === c ) {
          cs.splice(i, 1);
          this.state.onRemoveChild.call(this, c, i);
          return;
        }
      }
    },

    function replaceChild(newE, oldE) {
      /* Replace current child oldE with newE. */
      var cs = this.childNodes;
      for ( var i = 0 ; i < cs.length ; ++i ) {
        if ( cs[i] === oldE ) {
          cs[i] = newE;
          newE.parentNode = this;
          this.state.onReplaceChild.call(this, oldE, newE);
          oldE.unload && oldE.unload();
          return;
        }
      }
    },

    function insertBefore(child, reference) {
      /* Insert a single child before the reference element. */
      return this.insertAt_(child, reference, true);
    },

    function insertAfter(child, reference) {
      /* Insert a single child after the reference element. */
      return this.insertAt_(child, reference, false);
    },

    function remove() {
      /*
        Remove this Element from its parent Element.
        Will transition to UNLOADED state.
      */
      this.onRemove();

      if ( this.parentNode ) {
        var cs = this.parentNode.childNodes;
        for ( var i = 0 ; i < cs.length ; i++ ) {
          if ( cs[i] === this ) {
            cs.splice(i, 1);
            return;
          }
        }
        this.parentNode = undefined;
      }

      this.detach();
    },

    function addEventListener(topic, listener, opt_args) {
      /* Add DOM listener. */
      this.elListeners.push(topic, listener, opt_args);
      this.onAddListener(topic, listener, opt_args);
    },

    function removeEventListener(topic, listener) {
      /* Remove DOM listener. */
      var ls = this.elListeners;
      for ( var i = 0 ; i < ls.length ; i += 3 ) {
        var t = ls[i], l = ls[i+1];
        if ( t === topic && l === listener ) {
          ls.splice(i, 3);
          this.onRemoveListener(topic, listener);
          return;
        }
      }
    },

    function setID(id) {
      /*
        Explicitly set Element's id.
        Normally id's are automatically assigned.
        Setting specific ID's hinders composability.
      */
      this.id = id;
      return this;
    },

    function entity(name) {
      /* Create and add a named entity. Ex. .entity('gt') */
      this.add(this.Entity.create({ name: name }));
      return this;
    },

    function nbsp() {
      return this.entity('nbsp');
    },

    function addClass(cls) { /* ...( Slot | String ) */
      if ( arguments.length > 1 ) {
        for ( let i = 0; i < arguments.length; i++ ) {
          this.addClass(arguments[i]);
        }
        return this;
      }
      /* Add a CSS cls to this Element. */
      var self = this;
      if ( cls === undefined ) {
        this.addClass_(null, this.myClass());
      } else if ( foam.lang.Slot.isInstance(cls) ) {
        var lastValue = null;
        var l = function() {
          var v = cls.get();
          self.addClass_(lastValue, v);
          lastValue = v;
        };
        this.onDetach(cls.dedup().sub(l));
        l();
      } else if ( typeof cls === 'string' ) {
        this.addClass_(null, cls);
      } else {
        this.error('cssClass type error. Must be Slot or String.');
      }

      return this;
    },

    function addClasses(a) {
      // Deprecated: Use Add class with multiple args
      console.warn('addClasses has been deprecated, use addClass instead');
      this.addClass(...a);
      return this;
    },

    function enableClass(cls, enabled, opt_negate) {
      /* Enable/disable a CSS class based on a boolean-ish dynamic value. */
      function negate(a, b) { return b ? ! a : a; }

      // TODO: add type checking
      if ( foam.lang.Slot.isInstance(enabled) ) {
        var self = this;
        var value = enabled;
        var l = function() { self.enableClass(cls, value.get(), opt_negate); };
        this.onDetach(value.dedup().sub(l));
        l();
      } else {
        enabled = negate(enabled, opt_negate);
        var parts = cls.split(' ');
        for ( var i = 0 ; i < parts.length ; i++ ) {
          this.classes[parts[i]] = enabled;
          this.onSetClass(parts[i], enabled);
        }
      }
      return this;
    },

    function removeClass(cls) {
      /* Remove specified CSS class. */
      if ( cls ) {
        delete this.classes[cls];
        this.onSetClass(cls, false);
      }
      return this;
    },

    function on(topic, listener, opt_args) {
      /* Shorter fluent version of addEventListener. Prefered method. */
      this.addEventListener(topic, listener, opt_args);
      return this;
    },

    function attr(key, value) {
      this.setAttribute(key, value);
      return this;
    },

    function attrs(map) {
      /* Set multiple attributes at once. */
      for ( var key in map ) this.setAttribute(key, map[key]);
      return this;
    },

    function style(map) {
      /*
        Set CSS styles.
        Map values can be Objects or dynamic Values.
      */
      for ( var key in map ) {
        var value = map[key];
        if ( foam.lang.Slot.isInstance(value) ) {
          this.slotStyle_(key, value);
        } else {
          this.style_(key, value);
        }
        // TODO: add type checking for this
      }

      return this;
    },

    function tag(spec, args, slot) {
      /* Create a new Element and add it as a child. Return this. */
      var c = this.createChild_(spec, args);
      this.add(c);
      if ( slot ) slot.set(c);
      return this;
    },

    function br() {
      return this.tag('br');
    },

    function startContext(map) {
      var m = {};
      Object.assign(m, map);
      m.__oldAddContext__ = this.__subSubContext__;
      this.__subSubContext__ = this.__subSubContext__.createSubContext(m);
      return this;
    },

    function endContext() {
      this.__subSubContext__ = this.__subSubContext__.__oldAddContext__;
      return this;
    },

    function createChild_(spec, args) {
      return foam.u2.ViewSpec.createView(spec, args, this, this.__subSubContext__);
    },

    function start(spec, args, slot) {
      /* Create a new Element and add it as a child. Return the child. */
      var c = this.createChild_(spec, args);
      this.add(c);

/*
      if ( this.content ) {
        this.add(c);
      } else {
        c.parentNode = this;
        this.childNodes.push(c);
        this.onAddChildren(c);
      }
      */

      if ( slot ) slot.set(c);
      return c;
    },

    function end() {
      /* Return this Element's parent. Used to terminate a start(). */
      return this.parentNode;
    },

    function translate(source, opt_default) {
      var translationService = this.translationService;
      if ( translationService ) {
        /* Add the translation of the supplied source to the Element as a String */
        let xmsgObj, translation;
        if ( foam.lang.Slot.isInstance(source) ) {
          translation = source.map(v => this.translationService.getTranslation(foam.locale, v, opt_default || v))
          xmsgObj = {source$: source, data$: translation };
        } else {
          translation = this.translationService.getTranslation(foam.locale, source, opt_default || source);
          xmsgObj = {source: source, data: translation };
        }
        if ( foam.xmsg ) {
          return this.tag({ ...xmsgObj, class: 'foam.i18n.InlineLocaleEditor', defaultText: opt_default });
        }
        return this.add(translation);
      }
      // console.warn('Missing Translation Service in ', this.cls_.name);
      if ( opt_default === undefined ) opt_default = source;
      return this.add(opt_default);
    },

    function add() {
      if ( this.content ) {
        this.content.add_(arguments, this);
      } else {
        this.add_(arguments, this);
      }
      return this;
    },

    function toE() { return this; },

    function react(fn, opt_self) {
      var slot = (opt_self || this).slot(fn);
      update = () => {
        this.removeAllChildren();
        slot.get();
      };
      update();
      slot.sub(update);
      return this;
    },

    function add_(cs, parentNode) {
      // Common case is one String, so optimize that case.
      if ( cs.length == 1 && typeof cs[0] === 'string' ) {
        var sanitized = this.sanitizeText(cs[0]);
        this.childNodes.push(sanitized);
        this.onAddChildren(sanitized);
        return this;
      }

      /* Add Children to this Element. */
      var es = [];
      // var Y = this.__subSubContext__;
      var Y = parentNode.__subSubContext__;
      for ( var i = 0 ; i < cs.length ; i++ ) {
        var c = cs[i];

        // Remove null values
        if ( c === undefined || c === null ) {
          // nop
        } else if ( c.addToE ) {
          var e = this.E();
          c.addToE(e);
          c = e;
          es.push(e);
        }  else if ( foam.Function.isInstance(c) ) {
          this.add_([(parentNode.__context__.data || parentNode).dynamic({code: c, self: this})], parentNode);
        } else if ( foam.lang.DynamicFunction.isInstance(c) ) {
          //this.add('TODO DYNAMIC FUNCTION');
          c.pre  = () => { this.removeAllChildren(); };
          c.self = this;
        } else if ( c.toE ) {
          var e = c.toE(null, Y);
          if ( foam.lang.Slot.isInstance(e) ) {
            var v = this.slotE_(e);
            if ( Array.isArray(v) ) {
              for ( var j = 0 ; j < v.length ; j++ ) {
                var u = v[j];
                es.push(u.toE ? u.toE(null, Y) : u);
              }
            } else {
              es.push(v.toE ? v.toE(null, Y) : v);
            }
          } else {
            es.push(e);
          }
        } else if ( Array.isArray(c) ) {
          for ( var j = 0 ; j < c.length ; j++ ) {
            var v = c[j];
            es.push(v.toE ? v.toE(null, Y) : v);
          }
        } else if ( c.then ) {
          this.add(this.PromiseSlot.create({ promise: c }));
        } else {
          // String or Number
          es.push(c);
        }
      }

      if ( es.length ) {
        for ( var i = 0 ; i < es.length ; i++ ) {
          if ( foam.u2.Element.isInstance(es[i]) ) {
            es[i].parentNode = parentNode;
          } else if ( es[i].cls_ && es[i].cls_.id === 'foam.u2.Entity' ) {
            // NOP
          } else {
            es[i] = this.sanitizeText(es[i]);
          }
        }

        this.childNodes.push.apply(this.childNodes, es);
        this.onAddChildren.apply(this, es);
      }

      return this;
    },

    function addBefore(reference) { /*, vargs */
      /* Add a variable number of children before the reference element. */
      var children = [];
      for ( var i = 1 ; i < arguments.length ; i++ ) {
        children.push(arguments[i]);
      }
      return this.insertAt_(children, reference, true);
    },

    function removeAllChildren() {
      /* Remove all of this Element's children. */
      var cs = this.childNodes;
      while ( cs.length ) {
        this.removeChild(cs[0]);
      }
      var e = this.el_();
      if ( e ) e.innerHTML = '';
      return this;
    },

    function setChildren(slot) {
      /**
         slot -- a Slot of an array of children which set this element's
         contents, replacing old children
      **/
      var l = function() {
        this.removeAllChildren();
        this.add.apply(this, slot.get());
      }.bind(this);

      this.onDetach(slot.sub(l));
      l();

      return this;
    },

    function repeat(s, e, f, opt_allowReverse) {
      if ( s <= e ) {
        for ( var i = s ; i <= e ; i++ ) {
          f.call(this, i);
        }
      } else if ( opt_allowReverse ) {
        for ( var i = s ; i >= e ; i-- ) {
          f.call(this, i);
        }
      }
      return this;
    },

    function daoSlot(dao, sink) {
      var slot = foam.dao.DAOSlot.create({
        dao: dao,
        sink: sink
      });

      this.onDetach(slot);

      return slot;
    },

    /**
     * Given a DAO and a function that maps from a record in that DAO to an
     * Element, call the function with each record as an argument and add the
     * returned elements to the view.
     * Will update the view whenever the contents of the DAO change.
     * @param {DAO<T>} dao The DAO to use as a data source
     * @param {T -> Element} f A function to be called on each record in the DAO. Should
     * return an Element that represents the view of the record passed to it.
     * @param {Boolean} update True if you'd like changes to each record to be put to
     * the DAO
     */
    function select(dao, f, update, opt_comparator) {
      // foam.Function.assertNotArrow(f); // TODO in U3

      var es   = {};
      var self = this;

      var listener = this.RenderSink.create({
        dao: dao,
        comparator: opt_comparator,
        addRow: function(o) {
          // No use adding new children if the parent has already been removed
          if ( self.state === foam.u2.Element.UNLOADED ) return;

          if ( update ) {
            o = o.clone();
            o.propertyChange.sub(function() {
              o.copyFrom(dao.put(o.clone()));
            });
          }

          self.startContext({data: o});

          var e = f.call(self, o);

          // By checking for undefined, f can still return null if it doesn't
          // want anything to be added.
          if ( e === undefined )
            this.__context__.warn(self.SELECT_BAD_USAGE);

          self.endContext();

          if ( es[o.id] ) {
            self.replaceChild(es[o.id], e);
          } else {
            self.add(e);
          }
          es[o.id] = e;
        },
        cleanup: function() {
          for ( var key in es ) {
            es[key] && es[key].remove();
          }

          es = {};
        }
      }, this);

      listener.paint();
      this.onDetach(dao.listen(listener));

      return this;
    },

    function call(f, args) {
      foam.Function.assertNotArrow(f);

      f.apply(this, args);

      return this;
    },

    function callIf(bool, f, args) {
      foam.Function.assertNotArrow(f);

      if ( bool ) f.apply(this, args);

      return this;
    },

    function callIfElse(bool, iff, elsef, args) {
      foam.Function.assertNotArrow(iff);
      foam.Function.assertNotArrow(elsef);

      (bool ? iff : elsef).apply(this, args);

      return this;
    },

    /**
     * Call the given function on each element in the array. In the function,
     * `this` will refer to the element.
     * @param {Array} array An array to loop over.
     * @param {Function} fn A function to call for each item in the given array.
     */
    function forEach(array, fn) {
      foam.Function.assertNotArrow(fn);

      if ( foam.lang.Slot.isInstance(array) ) {
        this.add(array.map(a => this.E().forEach(a, fn)));
      } else {
        array.forEach(fn.bind(this));
      }
      return this;
    },

    function outputInnerHTML(out) {
      var cs = this.childNodes;
      for ( var i = 0 ; i < cs.length ; i++ ) {
        out(cs[i]);
      }
      return out;
    },

    function createOutputStream() {
      /*
        Create an OutputStream.
        Suitable for providing to the output() method for
        serializing an Element hierarchy.
        Call toString() on the OutputStream to get output.
      */
      var buf = '';
      var Element = foam.u2.Element;
      var Entity  = this.Entity;
      var f = function templateOut(/* arguments */) {
        for ( var i = 0 ; i < arguments.length ; i++ ) {
          var o = arguments[i];
          if ( o === null || o === undefined ) {
            // NOP
          } else if ( typeof o === 'string' ) {
            buf += o;
          } else if ( typeof o === 'number' ) {
            buf += o;
          } else if ( Element.isInstance(o) || Entity.isInstance(o) ) {
            o.output(f);
          }
        }
      };

      f.toString = function() {
        return buf;
      };

      return f;
    },

    function write() {
      /* Write Element to document. */
      this.document.body.insertAdjacentHTML('beforeend', this.outerHTML);
      this.load();
      return this;
    },

    function toString() {
      return this.cls_.id + '(id=' + this.id + ', nodeName=' + this.nodeName + ', state=' + this.state + ')';
      /* Converts Element to HTML String without transitioning state. */
      /*
        TODO: put this somewhere useful for debugging
      var s = this.createOutputStream();
      this.output_(s);
      return s.toString();
      */
    },

    function insertAt_(children, reference, before) {
      // (Element[], Element, Boolean)

      var i = this.childNodes.indexOf(reference);

      if ( i === -1 ) {
        this.__context__.warn("Reference node isn't a child of this.");
        return this;
      }

      if ( ! Array.isArray(children) ) children = [ children ];

      var Y = this.__subSubContext__;
      children = children.map(e => {
        e = e.toE ? e.toE(null, Y) : e;
        e.parentNode = this;
        return e;
      });

      var index = before ? i : (i + 1);
      this.childNodes.splice.apply(this.childNodes, [index, 0].concat(children));

      this.state.onInsertChildren.call(
        this,
        children,
        reference,
        before ? 'beforebegin' : 'afterend');

      return this;
    },

    function addClass_(oldClass, newClass) {
      /* Replace oldClass with newClass. Called by cls(). */
      if ( oldClass === newClass ) return;
      if ( oldClass ) this.removeClass(oldClass);
      if ( newClass ) {
        if ( ! this.CSS_CLASSNAME_PATTERN.test(newClass) ) {
          console.log('!!!!!!!!!!!!!!!!!!! Invalid CSS ClassName: ', newClass);
          throw "Invalid CSS classname";
        }
        this.classes[newClass] = true;
        this.onSetClass(newClass, true);
      }
    },

    function slotAttr_(key, value) {
      /* Set an attribute based off of a dynamic Value. */
      var self = this;
      var l = function() { self.setAttribute(key, value.get()); };
      this.onDetach(value.dedup().sub(l));
      l();
    },

    function slotStyle_(key, v) {
      /* Set a CSS style based off of a dynamic Value. */
      var self = this;
      var l = function(value) { self.style_(key, v.get()); };
      this.onDetach(v.dedup().sub(l));
      l();
    },

    function style_(key, value) {
      /* Set a CSS style based off of a literal value. */
      this.css[key] = value;
      this.onSetStyle(key, value);
      return this;
    },

    function slotE_(slot) {
       this.onDetach(slot);
      // TODO: add same context capturing behviour to other slotXXX_() methods.
      /*
        Return an Element or an Array of Elements which are
        returned from the supplied dynamic Slot.
        The Element(s) are replaced when the Slot changes.
      */
      var self = this;
      var ctx  = this.__subSubContext__;

      function nextE() {
        // Run Slot in same subSubContext that it was created in.
        var oldCtx = self.__subSubContext__;
        self.__subSubContext__ = ctx;
        var e = slot.get();

        // Convert e or e[0] into a SPAN if needed,
        // So that it can be located later.
        if ( e === undefined || e === null || e === '' ) {
          e = self.E('span');
        } else if ( Array.isArray(e) ) {
          if ( e.length ) {
            if ( typeof e[0] === 'string' ) {
              e[0] = self.E('span').add(e[0]);
            }
          } else {
            e = self.E('span');
          }
        } else if ( ! foam.u2.Element.isInstance(e) ) {
          e = self.E('span').add(e);
        }

        self.__subSubContext__ = oldCtx;

        return e;
      }

      var e = nextE();
      var l = function() {
        if ( self.state !== self.LOADED ) {
          return;
        }
        var first = Array.isArray(e) ? e[0] : e;

        if ( first && first.state == first.INITIAL ) {
          // updated requested before initial element loaded
          // not a problem, just defer loading
          first.onload.sub(foam.events.oneTime(l));
          return;
        }

        var tmp = self.E();
        self.insertBefore(tmp, first);
        if ( Array.isArray(e) ) {
          for ( var i = 0 ; i < e.length ; i++ ) {
            e[i].remove();
          }
        } else {
          e.remove();
        }
        var e2 = nextE();
        self.insertBefore(e2, tmp);
        tmp.remove();
        e = e2;
      };

      this.onDetach(slot.framed().sub(l));

      return e;
    },

    function addEventListener_(topic, listener, opt_args) {
      var el = this.el_();
      el && el.addEventListener(topic, listener, opt_args || false);
    },

    function removeEventListener_(topic, listener) {
      var el = this.el_();
      el && el.removeEventListener(topic, listener);
    },

    function output_(out) {
      /** Output the element without transitioning to the OUTPUT state. **/
      out('<', this.nodeName);
      if ( this.id !== null ) out(' id="', this.id.replace ? this.id.replace(/"/g, "&quot;") : this.id, '"');

      var first = true;
      if ( this.hasOwnProperty('classes') ) {
        var cs = this.classes;
        for ( var key in cs ) {
          if ( ! cs[key] ) continue;
          if ( first ) {
            out(' class="');
            first = false;
          } else {
            out(' ');
          }
          out(key);
        }
        if ( ! first ) out('"');
      }

      if ( this.hasOwnProperty('css') ) {
        first = true;
        var cs = this.css;
        for ( var key in cs ) {
          var value = cs[key];

          if ( first ) {
            out(' style="');
            first = false;
          }
          out(key, ':', value, ';');
        }
        if ( ! first ) out('"');
      }

      if ( this.hasOwnProperty('attributes') ) {
        var as = this.attributes;
        for ( var i = 0 ; i < as.length ; i++ ) {
          var attr  = as[i];
          var name  = attr.name;
          var value = attr.value;

          if ( value !== false ) {
            out(' ', name, '="');
            out(foam.String.isInstance(value) ? value.replace(/"/g, '&quot;') : value);
            out('"');
          }
        }
      }

      if ( ! this.ILLEGAL_CLOSE_TAGS[this.nodeName] ) {
        var hasChildren = this.hasOwnProperty('childNodes') && this.childNodes.length;
        if ( hasChildren || ! this.OPTIONAL_CLOSE_TAGS[this.nodeName] ) {
          out('>');
          if ( hasChildren ) this.outputInnerHTML(out);
          out('</', this.nodeName);
        }
      }

      out('>');
    }
  ],

  listeners: [
    {
      name: 'onKeyboardShortcut',
      documentation: `
          Automatic mapping of keyboard events to $$DOC{ref:'Action'} trigger.
          To handle keyboard shortcuts, create and attach $$DOC{ref:'Action',usePlural:true}
          to your $$DOC{ref:'foam.ui.View'}.
      `,
      code: function(evt) {
        if ( evt.type === 'keydown' && ! this.KEYPRESS_CODES[evt.which] ) return;
        var action = this.keyMap_[this.evtToCharCode(evt)];
        if ( action ) {
          var ret = action();
          if ( ret ) {
            evt.preventDefault();
            evt.stopPropagation();
          }
        }
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'FObjectToERefinement',
  refines: 'foam.lang.FObject',
  methods: [
    function toE(args, X) {
      X = X || globalThis.ctrl || foam.__context__;
      return foam.u2.ViewSpec.createView(
        { class: 'foam.u2.DetailView', showActions: true, data: this },
        args, this, X);
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'PropertyViewRefinements',
  refines: 'foam.lang.Property',

  requires: [
    'foam.u2.TextField'
  ],

  properties: [
    {
      // If true, this property is treated as a psedo-U2 attribute.
      name: 'attribute',
      value: false
    },
    {
      class: 'String',
      name: 'placeholder'
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'view',
      value: { class: 'foam.u2.TextField' }
    },
    {
      name: 'visibility',
      adapt: function(o, n) { if ( foam.Object.isInstance(n) ) return foam.u2.DisplayMode.create(n); return foam.String.isInstance(n) ? foam.u2.DisplayMode[n] : n; },
      documentation: 'Exists for backwards compatability. You should set createVisibility, updateVisibility, or readVisibility instead. If this property is set, it will override the other three.'
    },
    {
      name: 'createVisibility',
      adapt: function(o, n) { if ( foam.Object.isInstance(n) ) return foam.u2.DisplayMode.create(n); return foam.String.isInstance(n) ? foam.u2.DisplayMode[n] : n; },
      documentation: 'The display mode for this property when the controller mode is CREATE.',
      factory: function() { return foam.u2.DisplayMode.RW; }
    },
    {
      name: 'readVisibility',
      adapt: function(o, n) { if ( foam.Object.isInstance(n) ) return foam.u2.DisplayMode.create(n); return foam.String.isInstance(n) ? foam.u2.DisplayMode[n] : n; },
      documentation: 'The display mode for this property when the controller mode is VIEW.',
      factory: function() { return foam.u2.DisplayMode.RO; }
    },
    {
      name: 'updateVisibility',
      adapt: function(o, n) { if ( foam.Object.isInstance(n) ) return foam.u2.DisplayMode.create(n); return foam.String.isInstance(n) ? foam.u2.DisplayMode[n] : n; },
      documentation: 'The display mode for this property when the controller mode is EDIT.',
      factory: function() { return foam.u2.DisplayMode.RW; }
    },
    {
      class: 'Boolean',
      name: 'validationTextVisible',
      documentation: "If true, validation text will be displayed below the input when it's in an invalid state.",
      value: true
    },
    {
      class: 'Boolean',
      name: 'validationStyleEnabled',
      documentation: 'If true, inputs will be styled when they are in an invalid state.',
      value: true
    },
    {
      class: 'Int',
      name: 'order',
      documentation: `
        The order to render the property in if rendering multiple properties.
      `,
      value: 0
    },
    {
      class: 'Boolean',
      name: 'onKey'
    },
    {
      // Experimental Code to make it easier to add underlying Property View
      // Without wrapping in a PropertyBorder
      name: '__',
      transient: true,
      getter: function() { return { __proto__: this, toE: this.toPropertyView }; }
    },
    {
      class: 'Boolean',
      name: 'reserveLabelSpace',
      documentation: 'Property to indicate if PropertyBorders need to reserve label space when label is empty'
    }
  ],

  methods: [
    function toE(args, X) {
      return this.toE_(args, X);
    },

    function toE_(args, X) {
      var e = this.createElFromSpec_(this.view, args, X);

      // e could be a Slot, so check if addClass exists
      e.addClass && e.addClass('property-' + this.name);

      return e;
    },

    function toPropertyView(args, X) {
      return this.createElFromSpec_({ class: 'foam.u2.PropertyBorder', prop: this }, args, X);
    },

    function createElFromSpec_(spec, args, X) {
      let el = foam.u2.ViewSpec.createView(spec, args, this, X.createSubContext({ prop: this }));

      if ( X.data$ && ! ( args && ( args.data || args.data$ ) ) ) {
        el.data$ = X.data$.dot(this.name);
      }

      el.fromProperty && el.fromProperty(this);

      return el;
    },

    function combineControllerModeAndVisibility_(data$, controllerMode$) {
      /**
        Create a VisibilitySlot which combines controllerMode and the mode specific visibility.
        Is used in createVisibilityFor(), which also combines permissions.
      **/

      const DisplayMode = foam.u2.DisplayMode;

      return foam.lang.ProxySlot.create({
        delegate$: controllerMode$.map(controllerMode => {
          var visibility = controllerMode.getVisibilityValue(this);

          // KGR: I'm not sure how this happens, but it does.
          // TODO: find out how/where.
          if ( foam.String.isInstance(visibility) )
            visibility = foam.u2.DisplayMode[visibility];

          if ( DisplayMode.isInstance(visibility) )
            return foam.lang.ConstantSlot.create({value: visibility});

          if ( foam.Function.isInstance(visibility) ) {
            var slot = foam.lang.ExpressionSlot.create({
              obj$: data$,
              // Disallow RW DisplayMode when in View Controller Mode
              code: visibility
            });

            // Call slot.args so its expression extracts args from visibility function
            slot.args;

            slot.code = function() {
              return controllerMode.restrictDisplayMode(visibility.apply(this, arguments));
            };

            return slot;
          }

          if ( foam.lang.Slot.isInstance(visibility) ) return visibility;

          throw new Error('Property.visibility must be set to one of the following: (1) a value of DisplayMode, (2) a function that returns a value of DisplayMode, or (3) a slot whose value is a value of DisplayMode. Property ' + this.name + ' was set to ' + visibility + ' instead.');
        })
      });
    },

    function createVisibilityFor(data$, controllerMode$) {
      /**
       * Return a slot of DisplayMode based on:
       *   * visibility
       *   * createVisibility
       *   * updateVisibility
       *   * readVisibility
       *   * readPermissionRequired
       *   * writePermissionRequired
       *
       * 'this' is a Property
       */
//      controllerMode$.sub(() => { debugger; /* I don't think this ever happens. KGR */ });

      var vis = this.combineControllerModeAndVisibility_(data$, controllerMode$)

      if ( ! this.readPermissionRequired && ! this.writePermissionRequired && ! this.updatePermissionRequired ) return vis;

      const DisplayMode = foam.u2.DisplayMode;

      var perm = this.slot(function(data, controllerMode) {
        if ( ! data || ! data.__subContext__.auth ) return DisplayMode.HIDDEN;
        var auth     = data.__subContext__.auth;
        var propName = this.name.toLowerCase();
        var clsName  = data.cls_.name.toLowerCase();
        var canRead  = this.readPermissionRequired === false;
        var allowCreate = this.writePermissionRequired === false && (this.updatePermissionRequired === false || controllerMode == 'CREATE');
        return auth.check(null, `${clsName}.rw.${propName}`)
          .then(function(rw) {
            if ( rw || allowCreate ) return DisplayMode.RW;
            if ( canRead           ) return DisplayMode.RO;
            return auth.check(null, `${clsName}.ro.${propName}`)
              .then((ro) => ro ? DisplayMode.RO : DisplayMode.HIDDEN);
          });
      }, data$, controllerMode$);

      return foam.lang.ArraySlot.create({slots: [vis, perm]}).map((arr) => {
        // The || HIDDEN is required because slot.map() above which returns
        // a promise will generate an intermediate null value.
        return arr[0].restrictDisplayMode(arr[1] || DisplayMode.HIDDEN)
      });
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'StringDisplayWidthRefinement',
  refines: 'foam.lang.String',
  requires: [ 'foam.u2.view.StringView' ],
  properties: [
    {
      class: 'Int',
      name: 'displayWidth',
      expression: function(width) { return width; }
    },
    [ 'view', { class: 'foam.u2.view.StringView' } ]
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'FormattedStringViewRefinement',
  refines: 'foam.lang.FormattedString',
  requires: [ 'foam.u2.FormattedTextField' ],
  properties: [
    {
      name: 'view',
      factory: function() {
        return {
          class: 'foam.u2.FormattedTextField',
          formatter: this.formatter,
          returnFormatted: false
        };
      }
    }
  ]
});

foam.CLASS({
  package: 'foam.u2',
  name: 'ArrayViewRefinement',
  refines: 'foam.lang.Array',
  requires: [ 'foam.u2.view.ArrayView' ],
  properties: [
    [ 'view', { class: 'foam.u2.view.ArrayView' } ]
  ]
});

foam.CLASS({
  package: 'foam.u2',
  name: 'EMailViewRefinement',
  refines: 'foam.lang.EMail',
  requires: [ 'foam.u2.view.StringView' ],
  properties: [
    {
      name: 'view',
      value: {
        class: 'foam.u2.view.StringView',
        writeView: { class: 'foam.u2.TextField', type: 'email' }
      }
    }
  ]
});

foam.CLASS({
  package: 'foam.u2',
  name: 'PhoneNumberViewRefinement',
  refines: 'foam.lang.PhoneNumber',
  requires: [ 'foam.u2.view.StringView' ],
  properties: [
    {
      name: 'view',
      value: {
        class: 'foam.u2.view.StringView',
        writeView: { class: 'foam.u2.view.PhoneNumberInputView' }
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'StringArrayViewRefinement',
  refines: 'foam.lang.StringArray',
  requires: [ 'foam.u2.view.StringArrayView' ],
  properties: [
    [ 'view', { class: 'foam.u2.view.StringArrayView' } ]
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'DateViewRefinement',
  refines: 'foam.lang.Date',
  requires: [ 'foam.u2.view.DateView' ],
  properties: [
    [ 'view', { class: 'foam.u2.view.DateView' } ]
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'DateTimeViewRefinement',
  refines: 'foam.lang.DateTime',
  requires: [ 'foam.u2.view.DateTimeView' ],
  properties: [
    [ 'view', { class: 'foam.u2.view.DateTimeView' } ]
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'TimeViewRefinement',
  refines: 'foam.lang.Time',
  requires: [ 'foam.u2.view.TimeView' ],
  properties: [
    [ 'view', { class: 'foam.u2.view.TimeView' } ]
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'FloatViewRefinement',
  refines: 'foam.lang.Float',
  requires: [ 'foam.u2.view.FloatView' ],
  properties: [
    [ 'displayWidth', 12 ],
    [ 'view', { class: 'foam.u2.view.FloatView' } ]
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'IntViewRefinement',
  refines: 'foam.lang.Int',
  requires: [ 'foam.u2.view.IntView' ],
  properties: [
    [ 'displayWidth', 10 ],
    [ 'view', { class: 'foam.u2.view.IntView' } ]
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'UnitValueViewRefinement',
  refines: 'foam.lang.UnitValue',
  requires: [ 'foam.u2.view.CurrencyView' ],
  properties: [
    [ 'displayWidth', 15 ],
    [ 'view', { class: 'foam.u2.view.CurrencyView', onKey: true } ]
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'BooleanViewRefinement',
  refines: 'foam.lang.Boolean',
  requires: [ 'foam.u2.CheckBox' ],
  properties: [
    {
      name: 'view',
      expression: function(label, checkboxLabelFormatter) {
        return {
          class: 'foam.u2.CheckBox',
          label: this.help,
          labelFormatter: checkboxLabelFormatter
        };
      }
    },
    {
      name: 'checkboxLabelFormatter'
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'ColorViewRefinement',
  refines: 'foam.lang.Color',
  requires: [
    'foam.u2.MultiView',
    'foam.u2.TextField',
    'foam.u2.view.ColorPicker',
    'foam.u2.view.ModeAltView',
    'foam.u2.view.ReadColorView'
  ],
  properties: [
    {
      name: 'view',
      value: {
        class: 'foam.u2.view.ModeAltView',
        readView: { class: 'foam.u2.view.ReadColorView' },
        writeView: {
          class: 'foam.u2.view.ColorEditView'
        }
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'FObjectPropertyViewRefinement',
  refines: 'foam.lang.FObjectProperty',
  requires: [ 'foam.u2.view.FObjectPropertyView' ],
  properties: [
    {
      name: 'view',
      value: { class: 'foam.u2.view.FObjectPropertyView' },
    },
    {
      name: 'validationTextVisible',
      documentation: `
        Hide FObjectProperty validation because their inner view should provide its
        own validation so having it on the outer view and the inner view is redundant
        and jarring.
      `,
      value: false
    },
    {
      name: 'validationStyleEnabled',
      value: false
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'FObjectArrayViewRefinement',
  refines: 'foam.lang.FObjectArray',
  properties: [
    {
      name: 'view',
      expression: function(of) {
        return {
          class: 'foam.u2.view.TitledArrayView',
          of: of
        };
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'MapViewRefinement',
  refines: 'foam.lang.Map',
  properties: [
    {
      name: 'view',
      value: { class: 'foam.u2.view.MapView' },
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'ClassViewRefinement',
  refines: 'foam.lang.Class',
  properties: [
    [ 'view', { class: 'foam.u2.ClassView' } ]
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'ReferenceViewRefinement',
  refines: 'foam.lang.Reference',
  requires: [ 'foam.u2.view.ReferencePropertyView' ],
  properties: [
    [ 'view', { class: 'foam.u2.view.ReferencePropertyView' } ]
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'EnumViewRefinement',
  refines: 'foam.lang.Enum',
  requires: [ 'foam.u2.view.EnumView' ],
  properties: [
    [ 'view', { class: 'foam.u2.view.EnumView' } ],
    [ 'tableCellView', function(obj) { return this.get(obj).label; } ]
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'ObjectViewRefinement',
  refines: 'foam.lang.Object',
  requires: [ 'foam.u2.view.AnyView' ],
  properties: [
    [ 'view', { class: 'foam.u2.view.AnyView' } ]
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'CodeViewRefinement',
  refines: 'foam.lang.Code',
  requires: [ 'foam.u2.view.CodeView' ],
  properties: [
    [ 'view', { class: 'foam.u2.view.CodeView' } ]
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'DurationViewRefinement',
  refines: 'foam.lang.Duration',
  requires: [
    'foam.u2.view.IntView',
    'foam.u2.view.TableCellFormatterReadView'
  ],
  properties: [
    [ 'view', {
      class: 'foam.u2.view.IntView',
      readView: { class: 'foam.u2.view.TableCellFormatterReadView' }
    } ]
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'PredicatePropertyRefinement',
  refines: 'foam.mlang.predicate.PredicateProperty',
  requires: [
    'foam.u2.view.FObjectPropertyView',
    'foam.u2.view.FObjectView'
  ],
  properties: [
    {
      name: 'view',
      value: {
        class: 'foam.u2.view.FObjectPropertyView',
        writeView: {
          class: 'foam.u2.view.FObjectView',
          of: 'foam.mlang.predicate.Predicate'
        }
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'ExprPropertyRefinement',
  refines: 'foam.mlang.ExprProperty',
  requires: [
    'foam.u2.view.FObjectPropertyView',
    'foam.u2.view.FObjectView'
  ],
  properties: [
    {
      name: 'view',
      value: {
        class: 'foam.u2.view.FObjectPropertyView',
        writeView: {
          class: 'foam.u2.view.FObjectView',
          of: 'foam.mlang.Expr'
        }
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'PasswordPropertyRefinement',
  refines: 'foam.lang.Password',
  requires: [
    'foam.u2.view.PasswordView'
  ],
  properties: [
    {
      name: 'view',
      value: {
        class: 'foam.u2.view.PasswordView',
        passwordIcon: true
      }
    }
  ]
});

foam.CLASS({
  package: 'foam.u2',
  name: 'ImageViewRefinement',
  refines: 'foam.lang.Image',
  requires: [ 'foam.u2.tag.Image' ],
  properties: [
    [ 'view', { class: 'foam.u2.tag.Image' } ]
  ]
});

foam.CLASS({
  package: 'foam.u2',
  name: 'View',
  extends: 'foam.u2.Element',

  documentation: `
    A View is an Element used to display data.
    // TODO: Should the following be properties?

    {
      type: 'Boolean',
      name: 'showValidation',
      documentation: 'Set to false if you want to ignore any ' +
          '$$DOC{ref:"Property.validate"} calls. On by default.',
      defaultValue: true
    },
    {
      type: 'String',
      name: 'validationError_',
      documentation: 'The actual error message. Null or the empty string ' +
          'when there is no error.',
    }
  `,

  exports: [ 'data' ],

  properties: [
    {
      name: 'data',
      attribute: true
    },
    // {
    //   class: 'String',
    //   name: 'error_'
    // },
    {
      class: 'Enum',
      of: 'foam.u2.DisplayMode',
      name: 'mode',
      attribute: true,
      postSet: function(_, mode) { this.updateMode_(mode); },
      expression: function(controllerMode) {
        return controllerMode === foam.u2.ControllerMode.VIEW ?
          foam.u2.DisplayMode.RO :
          foam.u2.DisplayMode.RW ;
      }
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.updateMode_(this.mode);
      // this.enableClass('error', this.error_$);
      this.setAttribute('title', this.error_$);
    },

    function updateMode_() {
      // Template method, to be implemented in sub-models
    },

    function fromProperty(p) {
      this.attr('name', p.name);
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'Controller',
  extends: 'foam.u2.Element',

  documentation: 'A Controller is an Element which exports itself as "data".',

  exports: [ 'as data' ]
});



foam.CLASS({
  package: 'foam.u2',
  name: 'Router',
  extends: 'foam.u2.Controller',
  mixins: [ 'foam.u2.memento.Memorable' ],

  exports: [ 'route' ],

  properties: [
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'ActionViewRefinement',
  refines: 'foam.lang.Action',

  requires: [
    'foam.u2.ActionView'
  ],

  properties: [
    {
      name: 'view',
      value: function(args, X) {
        return { class: 'foam.u2.ActionView', action: this };
      }
    }
  ],

  methods: [
    function toE(args, X) {
      var view = foam.u2.ViewSpec.createView(this.view, args, this, X);

      if ( X.data$ && ! ( args && ( args.data || args.data$ ) ) ) {
        view.data$ = X.data$;
      }

      return view;
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'TableColumns',

  documentation: 'Axiom for storing Table Columns information in Class. Unlike most Axioms, doesn\'t modify the Class, but is just used to store information.',

  properties: [
    [ 'name', 'tableColumns' ],
    'columns'
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'SearchColumns',

  documentation: 'Axiom for storing Table Search Columns information in Class. Unlike most Axioms, doesn\'t modify the Class, but is just used to store information.',

  properties: [
    [ 'name', 'searchColumns' ],
    'columns'
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'ModelU2Refinements',
  refines: 'foam.lang.Model',

  properties: [
    {
      class: 'String',
      name: 'css',
      postSet: function(_, code) {
        var css = foam.u2.CSS.create({code: code});
        css.name = css.name + '-' + this.id;
        this.axioms_.push(css);
      }
    },
    {
      class: 'Boolean',
      name: 'inheritCSS',
      value: true
    },
    {
      name: 'tableColumns',
      postSet: function(_, cs) {
        this.axioms_.push(foam.u2.TableColumns.create({columns: cs}));
      }
    },
    {
      name: 'searchColumns',
      postSet: function(_, cs) {
        this.axioms_.push(foam.u2.SearchColumns.create({columns: cs}));
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'HTMLValidator',
  extends: 'foam.u2.DefaultValidator',

  axioms: [ foam.pattern.Singleton.create() ],

  methods: [
    function sanitizeText(text) {
      // TODO: validate text
      return text;
    }
  ]
});


// An Element which does not escape HTML content
foam.CLASS({
  package: 'foam.u2',
  name: 'HTMLElement',
  extends: 'foam.u2.Element',

  requires: [ 'foam.u2.HTMLValidator' ],

  exports: [ 'validator as elementValidator' ],

  properties: [
    {
      class: 'Proxy',
      of: 'foam.u2.DefaultValidator',
      name: 'validator',
      factory: function() {
        // Note that HTMLValidator is a singleton so only one instance of
        // HTMLValidator should ever be created here.
        return this.HTMLValidator.create()
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'HTMLView',
//  extends: 'foam.u2.tag.TextArea',
  extends: 'foam.u2.HTMLElement',

  documentation: 'View for safely displaying HTML content.',

  css: `
    ^ { padding: 6px 0; }
  `,

  properties: [
    {
      name: 'data',
      attribute: true
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.addClass();

      this.add(this.data$);
    }
  ]
});
