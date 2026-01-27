/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// U3 is now the default, to use U2 instead:
// either include ?u3=true in URL or include "setFlags: { u3: true }" in your POM.

// You can determine if your code is running in U3 with:
// foam.u2.Element.U3, which will eval to true if you are.

/*
TODO:
 - Remove use of E() and replace with create-ing axiom to add same behaviour.
 - start('leftPanel') should work for locating pre-existing named spaces
 - Don't generate .java and remove need for flags: ['js'].
*/

/*
PORTING U2 to U3:
  - when setting nodeName value, set to lower-case
    ie. ['nodeName', 'DIV'] -> ['nodeName', 'div']
  - move init() rendering code to render()
  - remove use of this.sub('onload')
  - replace unload() with remove()
  - replace this.sub('onunload') with this.onDetach()
  - el() is now synchronous instead of returning a Promise
  - the Element.state property no longer exists
  - innerHTML and outerHTML have been removed
  - replace ^ in CSS (which has meaning in CSS) with <<
  - ILLEGAL_CLOSE_TAGS and OPTIONAL_CLOSE_TAGS have been removed
  - this.addClass(this.myClass()) is the same as this.addClass()
  - automatic ID generation has been removed
  - replace use of slots that return elements with functions that add them
  - remove daoSlot() method
  -    TODO: https://github.com/foam-framework/foam2/search?q=daoSlot
  - remove cssClass() (use addClass() instead
  -    TODO: https://github.com/foam-framework/foam2/search?q=cssClass
  - callOn removed
  - remove entity() support
  - remove addBefore()
  - remove insertAt_()
  - remove insertBefore() (put back)
  - remove insertAfter()
  - remove slotE_()
  - remove initTooltip
  - removed use of SPAN tags for dynamic slot content by using reference to TextNode
  - NEXT_ID() removed. Use new Object().$UID instead. (all done)
  - onAddChildren() no longer supported
  - setChildren(slot) replace with this.add(function())


.add(this.slot(function(a, b, c) { return this.E().start()...; }));
becomes:
.add(function(a, b, c) { this.start()...; });

  TODO:
  - fromProperty() doesn't make sense since you need to create the view first
    a 'property' property would work better
  - Is it faster if we don't add child to parent until we call end()?
  - consistently use _ for all internal properties and methods
  - ??? remove removeChild() appendChild()
  - ??? replace replaceChild() with replace() on Node
  - ??? replace E() with custom Element constructor
  - Replace TableCellFormatters with Elements
  - ??? Replace toE() with toNode/toView/to???
  - you can use views directly instead of ViewSpecs? (probably not, wrong context)
  - could we get rid of subSubContext be updating subContext?
  - Move CSS code out and share with U2
*/

foam.CLASS({
  package: 'foam.u2',
  name: 'Node',

  imports: [ 'document' ],

  properties: [ 'element_' ],

  constants: { U3: true },

  methods: [
    function toE() { return this; },

    function isLiteral(o) {
      return foam.String.isInstance(o) || foam.Number.isInstance(o) || foam.Boolean.isInstance(o) || foam.Date.isInstance(o);
    },

    function remove() {
      this.element_.remove();
      this.detach();
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'Text',
  extends: 'foam.u2.Node',

  documentation: 'U3 Text Node',

  properties: [
    { class: 'String', name: 'text' },
    {
      name: 'element_',
      factory: function() { return this.document.createTextNode(this.text); }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'SlotNode',
  extends: 'foam.u2.Node',

  // TODO: store the proxy node instead of element_ so it can be properly detached

  properties: [
    {
      name: 'slot_',
      preSet: function(o, n) {
        return n.framed();
      }
    },
    {
      name: 'node',
      factory: function() { return foam.u2.Text.create({text: 'filler'}, this); }
    },
    {
      name: 'element_',
      // Create a placeholder to insert into the right location, to be replaced
      // by slot value.
      getter: function() { return this.node.element_; }
    }
  ],

  methods: [
    function detach() {
      if ( this.slot_ ) this.slot_.detach();
      this.SUPER();
      this.element_ = null;
    },

    function load() {
      this.onDetach(this.slot_.sub(this.update));
      this.update();
    },

    function style(map) {
      this.node.style && this.node.style(map);
    }
  ],

  listeners: [
    {
      name: 'update',
      code: function() {
        var update_ = val => {
          var n;

          if ( val === undefined || val === null ) {
            n = foam.u2.Text.create({}, this);
          } else if ( this.isLiteral(val) ) {
            n = foam.u2.Text.create({text: '' + val}, this);
          } else if ( foam.u2.Element.isInstance(val) ) {
            n = val;
          } else if ( foam.Array.isInstance(val) ) {
            n = foam.u2.Element.create({nodeName:'span'}, this);
            n.add.apply(n, val);
          } else if ( foam.lang.Slot.isInstance(val) ) {
            n = this.cls_.create({ slot_: val });
          } else if ( val.then ) {
            val.then(n => update_(n));
            return;
          } /* else if ( foam.lang.FObject.isInstance(val) ) {
            n = foam.u2.DetailView.create({data: val}, this);
          } */ else if ( val.toE ) {
            n = val.toE({}, this);
          } else {
            console.log('Unknown slot type: ', typeof val);
            debugger;
          }

          this.element_.parentNode.replaceChild(n.element_, this.element_);
          n.parentNode = this.parentNode;
          n.load && n.load();
          var old = this.node;
          this.node = n;
          old.detach();
        };

        update_(this.slot_.get());
      }
    }
  ]
});

foam.CLASS({
  package: 'foam.u2',
  name: 'WrapperNode',
  extends: 'foam.u2.Element',
  documentation: `Special kind of node that can move itself and it's children between elements without causing rerenders
  Uses the same fake element behaviour as FunctionNode but is not dynamic.
  `,
  properties: [
    {
      name: 'id',
      factory: function() {
        return 'wrapper' + foam.next$UID();
      }
    },
    {
      name: 'element_',
      factory: function() { return this.document.createComment(this.id); }
    },
    {
      name: 'endElement_',
      hidden: true,
      transient: true,
      factory: function() { return this.document.createComment('/' + this.id); }
    },
    { class: 'Array', name: 'nodesToMove_', hidden: true }
  ],
  methods: [
    function moveTo(e) {
      this.nodesToMove_ = [];
      if ( this.parentNode )
        this.parentNode.childNodes = this.parentNode.childNodes.filter(v => v !== this);
      this.parentNode = e;
      // This is extremely important as otherwise the wrapper might detach with old parents
      this.clearPrivate_('listeners');
      for ( let el = this.element_.nextSibling;
        el != this.endElement_; el = el.nextSibling ) {
        this.nodesToMove_.push(el);
      }
      e.add(this);
    },
    function render() {
      if ( ! this.parentNode ) { this.detach(); return; }
      this.element_.parentNode.appendChild(this.endElement_);
      this.nodesToMove_.forEach(v => this.appendChild_(v));
      this.nodesToMove_ = undefined;
    },

    // Append 'children' before /dynamic comment
    function appendChild_(c) {
      if ( ! this.endElement_.parentNode ) { this.detach(); return; }
      this.endElement_.parentNode.insertBefore(c, this.endElement_);
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'FunctionNode',
  extends: 'foam.u2.Element',

  // Creates a fake element between two comments containing 'dynamic' and '/dynamic'.
  // appendChild_() inserts the child before the 'end' tag.
  // This lets dynamic content to be inserted without adding an extra wrapping
  // element which would interfere in some circumstances (ie. table/tr, selection/option).

  properties: [
    'fn', // a foam.lang.DynamicFunction
    {
      name: 'element_',
      factory: function() { return this.document.createComment('dynamic'); }
    },
    {
      name: 'endElement_',
      factory: function() { return this.document.createComment('/dynamic'); }
    },
    {
      class: 'Boolean',
      name: 'requiresRemoval'
    }
  ],

  methods: [
    function maybeRemovePreviousChildren() {
      if ( ! this.requiresRemoval ) return;
      this.requiresRemoval = false;

      for ( var i = 0 ; i < this.childNodes.length ; i++ )
        this.childNodes[i].detach();
      this.childNodes = [];

      var element_ = this.element_, endElement_ = this.endElement_;
      for ( var n ; ( n = element_.nextSibling ) && n !== endElement_ ; )
        try { n.remove(); } catch (x) { debugger; }
    },

    function render() {
      if ( ! this.parentNode ) { this.detach(); return; }
      this.parentNode.appendChild_(this.endElement_);
      this.fn.self = this;

      // Before rendering, remove all children between dynamic and /dynamic
      this.fn.pre = () => {
        this.requiresRemoval = true;
        //        this.maybeRemovePreviousChildren();
      };

      this.fn.post = () => {
        this.maybeRemovePreviousChildren();
      };

      this.onDetach(this.fn);
    },

    function addChild_(c, parentNode) {
      this.maybeRemovePreviousChildren();
      this.SUPER(c, parentNode);
    },

    // Append 'children' before /dynamic comment
    function appendChild_(c) {
      if ( ! this.endElement_.parentNode ) { this.detach(); return; }
      this.endElement_.parentNode.insertBefore(c, this.endElement_);
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'DAOSelectNode',
  extends: 'foam.u2.FunctionNode',
  implements: [ 'foam.dao.Sink' ],

  properties: [
    'dao',
    'code',
    {
      class: 'Int',
      name: 'batch',
      documentation: 'Used to check whether a paint should be performed or not.'
    },
    {
      class: 'Array',
      name: 'data_'
    },
    {
      name: 'fn',
      factory: function() {
        var self = this;
        return this.dynamic(function(data_) {
          data_.forEach(d => {
            var e = this.code.call(this, d);
            if ( e ) {
              // TODO: remove after port from U2 to U3
              console.log('Deprecated use of select({return E}). Just do self.start() instead in DAOSelectNode.', this.code);
              this.tag(e);
            }
          })
        });
      }
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.onDetach(this.dao.listen(this));
    },
    function put()    { this.update(); },
    function remove() { this.update(); },
    function reset()  { this.update(); }
  ],

  listeners: [
    {
      name: 'update',
      isFramed: true,
      code: function() {
        var batch = ++this.batch;
        this.dao.select().then(data => {
          if ( this.isDetached() || this.batch !== batch ) return;
          this.data_ = data.array;
        });
      }
    }
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
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'Element',
  extends: 'foam.u2.Node',

  mixins: [ 'foam.lang.Fluent' ],

  documentation: `
    DOM API Element. Root model for all U3 UI components.

    To insert a U3 Element into a regular DOM element, either:

    Add to the end of the imported document:

      el.write();

    Append to the end of a specified parent element:

      parentElement.appendChild(el.element_);
      el.load();

    Or use a foam tag in your markup:

    <foam class="com.acme.mypackage.MyView"></foam>
`,

  requires: [
    'foam.lang.PromiseSlot',
    'foam.u2.AttrSlot',
    'foam.u2.Entity',
    'foam.u2.RenderSink',
    'foam.u2.Tooltip',
    'foam.u2.ViewSpec'
  ],

  imports: [
    //'elementValidator',
    'framed',
    'getElementById',
    'translationService?'
  ],

  // TODO: this is relatively expensive for how little it is used
  // Try to find a cheaper way.
  exports: [
    'namespace'
  ],

  implements: [
    'foam.mlang.Expressions'
  ],

  constants: [
    {
      // TODO: document
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
      name: 'NAMED_CODES',
      value: {
        '8':   'backspace',
        '13':  'enter',
        '27':  'escape',
        '37':  'arrowleft',
        '38':  'arrowup',
        '39':  'arrowright',
        '40':  'arrowdown',
        '112': 'f1',
        '127': 'delete'
      }
    }
  ],

  messages: [
    {
      name: 'SELECT_BAD_USAGE',
      message: "You're using Element.select() wrong. The function passed to it must return an Element. Don't try to modify the view by side effects."
    }
  ],

  properties: [
    {
      name: 'element_',
      transient: true,
      hidden: true,
      copyValueFrom: () => { return true; },
      factory: function() {
        var ret = this.namespace ?
          this.document.createElementNS(this.namespace, this.nodeName) :
          this.document.createElement(this.nodeName);
        if ( this.hasOwnProperty('id') ) ret.id = this.id;
        return ret;
      }
    },
    {
      class: 'String',
      name: 'id',
      hidden: true,
      postSet: function(o,n) {
        if ( this.hasOwnProperty('element_') ) {
          this.element_.id = n;
        }
      }
    },
    {
      class: 'Enum',
      of: 'foam.u2.ControllerMode',
      name: 'controllerMode',
      hidden: true,
      factory: function() { return this.__context__.controllerMode || foam.u2.ControllerMode.CREATE; }
    },
    {
      name: 'content',
      hidden: true,
      transient: true,
      preSet: function(o, n) {
        // Prevent setting to 'this', which wouldn't change the behaviour.
        return n === this ? null : n ;
      }
    },
    {
      class: 'String',
      name: 'tooltip',
      attribute: true,
      hidden: true,
      postSet: function(o, n) {
        if ( n && ! o ) {
          this.Tooltip.create({target: this, text$: this.tooltip$});
        }
        return n;
      }
    },
    {
      class: 'String',
      name: 'extraStyle',
      hidden: true
    },
    {
      name: 'parentNode',
      transient: true,
      hidden: true,
      postSet: function(o, n) { n.onDetach(this); }
    },
    {
      class: 'Boolean',
      name: 'shown',
      hidden: true,
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
    /*
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
    */
    {
      name: 'nodeName',
      hidden: true,
      adapt: function(_, v) { return foam.String.toLowerCase(v); },
      value: 'div'
    },
    {
      class: 'String',
      name: 'namespace',
      hidden: true,
      factory: function() {
        return this.__context__['namespace'] || (this.nodeName === 'svg' ? 'http://www.w3.org/2000/svg' : '');
      }
    },
    {
      name: 'classes',
      documentation: 'CSS classes assigned to this Element. Stored as a map of true values.',
      transient: true,
      hidden: true,
      factory: function() { return {}; }
    },
    {
      class: 'Map',
      name: 'css',
      transient: true,
      hidden: true,
      documentation: 'Styles added to this Element.',
      factory: function() { return {}; }
    },
    {
      name: 'childNodes',
      documentation: 'Children of this Element.',
      transient: true,
      hidden: true,
      factory: function() { return []; }
    },
    {
      name: 'children',
      documentation: 'Virtual property of non-String childNodes.',
      transient: true,
      hidden: true,
      getter: function() {
        return this.childNodes.filter(function(c) {
          return typeof c !== 'string';
        });
      }
    },
    {
      class: 'Boolean',
      name: 'focused',
      hidden: true,
      postSet: function(o, n) {
        if ( n ) this.element_.focus();
      }
    },
    {
      name: 'scrollHeight',
      hidden: true
    },
    {
      class: 'Int',
      name: 'tabIndex',
      hidden: true,
      postSet: function(o, n) {
        this.element_.setAttribute('tabindex', n);
      }
    },
    {
      name: 'clickTarget_',
      hidden: true
    },
    {
      name: '__subSubContext__',
      transient: true,
      hidden: true,
      documentation:
        `Current subContext to use when creating children.
        Defaults to __subContext__ unless in a nested startContext().`,
      factory: function() { return this.__subContext__; }
    },
    {
      name: 'keyMap_',
      hidden: true
    },
    {
      // TODO: remove after port from U2 to U3
      name: 'onload',
      transient: true,
      hidden: true,
      factory: function() {
        return { sub: function(f) {
          console.warn('Deprecated us of ELement.onload.sub().');
          window.setTimeout(f, 16);
        } };
      }
    }
  ],

  methods: [
    function init() {
      this.SUPER();
      this.onDetach(this.visitChildren.bind(this, 'detach'));
    },

    function detach() {
      this.SUPER();
      this.childNodes = [];
      this.children   = [];
      this.private_ = this.parentNode = this.__subSubContext__ = this.instance_.subContext__ = undefined;
    },

    // from state

    function replaceElement_(el) {
      el.parentNode.replaceChild(this.element_, el);
    },

    // TODO: for backward compatibility with U2, remove when all code ported
    function el() {
      return Promise.resolve(this.el_());
    },

    function slotE_(slot) {
      return foam.u2.SlotNode.create({slot_: slot}, this);
    },

    function load() {
      // Needed for OverlayDropdown which overrides add(), but shouldn't.
      // TODO: Fix OverlayDropdown to use content$ and then remove this.
      var customAdd = this.add != foam.u2.Element.prototype.add;
      // disable adding to content$ during render()
      if ( ! customAdd ) this.add = function() { return this.add_(arguments, this); }
      this.initKeyboardShortcuts();
      this.render();
      if ( ! customAdd ) this.add = foam.u2.Element.prototype.add;

      // Is also called in postSet of focused property, but if DOM not added
      // to document yet, then that doesn't work, so try again now.
      if ( this.focused ) this.element_.focus();
    },

    function remove() {
      if ( this.parentNode ) {
        // parent will remove from DOM and detach
        this.parentNode.removeChild(this);
      } else {
        this.SUPER();
      }
    },

    function getBoundingClientRect() {
      return this.element_.getBoundingClientRect();
    },

    function render() {
      // TODO: maybe a better approach would be to add a customizer() function which
      // could call style() or anything else? KGR
      if ( this.extraStyle ) this.style(this.extraStyle);
    },

    function mutationObserver(fn, config = { attributes: true, childList: true, characterData: true, subtree: true }) {
      var observer = new MutationObserver(fn);
      observer.observe(this.element_, config);
      this.onDetach(() => observer.disconnect());
      return this;
    },

    function resizeObserver(fn, config = { box: 'content-box' }) {
      var observer = new ResizeObserver(fn);
      observer.observe(this.element_, config);
      this.onDetach(() => observer.disconnect());
      return this;
    },

    function observeScrollHeight() {
      // TODO: This should be handled by an onsub event when someone subscribes to
      // scroll height changes.
      var self = this;
      this.mutationObserver(() => {
        self.scrollHeight = self.element_.scrollHeight;
      });
      return this;
    },

    function evtToCharCode(evt) {
      if ( ! evt.key ) return '';

      /* Maps an event keycode to a string */
      var s = '';
      if ( evt.altKey   ) s += 'alt-';
      if ( evt.ctrlKey  ) s += 'ctrl-';
      if ( evt.shiftKey && evt.type === 'keydown' ) s += 'shift-';
      if ( evt.metaKey  ) s += 'meta-';
      s += evt.key.toLowerCase() || this.NAMED_CODES[evt.keyCode];
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

      for ( var key in keyMap )
        map[key] = keyMap[key].maybeCall.bind(keyMap[key], this.__subContext__, this);

      return map;
    },

    function initKeyboardShortcuts() {
      /* Initializes keyboard shortcuts. */
      var keyMap = this.initKeyMap_(keyMap, this.cls_);

      // if ( this.of ) count += this.initKeyMap_(keyMap, this.of);
      if ( keyMap ) {
        this.keyMap_ = keyMap;
        // TODO Checking a concrete type like FunctionNode here seems wrong.
        var target = (this.parentNode && !foam.u2.FunctionNode.isInstance(this.parentNode)) ? this.parentNode : this;

        // Ensure that target is focusable, and therefore will capture keydown
        // and keypress events.
        target.tabIndex = target.tabIndex || 1;

        target.on('keydown',  this.onKeyboardShortcut);
        target.on('keypress', this.onKeyboardShortcut);
      }
    },

    function el_() {
      return this.element_;
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

          if ( this.PSEDO_ATTRIBUTES[name] ) {
            this.element_[name] = value;
          } else {
            this.element_.setAttribute(name, value === true ? '' : value);
          }
        }
      }

      if ( name === 'title' && ! this.tooltip && value ) {
        this.Tooltip.create({target: this, text$: this.attrSlot('title')});
      }

      return this;
    },

    function removeAttribute(name) {
      if ( this.PSEDO_ATTRIBUTES[name] ) {
        this.element_[name] = '';
      } else {
        this.element_.removeAttribute(name);
      }
      return this;
    },

    function getAttribute(name) {
      if ( this.PSEDO_ATTRIBUTES[name] ) {
        return this.element_[name];
      }

      /*
        Get value associated with attribute 'name',
        or undefined if attribute not set.
      */
      var attr = this.element_.getAttributeNode(name);
      return attr && attr.value;
    },

    function appendChild_(c) {
      this.element_.appendChild(c);
    },

    function removeChild(c) {
      // TODO: set c.parentNode to undefined ?
      /* Remove a Child node (String or Element). */
      var cs = this.childNodes;
      for ( var i = 0 ; i < cs.length ; i++ ) {
        if ( cs[i] === c ) {
          cs.splice(i, 1);
          if ( typeof c === 'string' ) {
            this.element_.childNodes[i].remove();
          } else {
            c.element_.remove();
            c.detach();
          }
          break;
        }
      }
      return this;
    },

    function replaceChild(newE, oldE) {
      /* Replace current child oldE with newE. */
      var cs = this.childNodes;
      for ( var i = 0 ; i < cs.length ; ++i ) {
        if ( cs[i] === oldE ) {
          cs[i] = newE;
          newE.parentNode = this;
          oldE.element_.parentNode.replaceChild(newE.element_, oldE.element_);
//          oldE.element_.outerHTML = '<' + this.nodeName + '></' + this.nodeName + '>';
          newE.load && newE.load();
          oldE.remove();
          return;
        }
      }
    },

    function addEventListener(topic, listener, opt_options) {
      this.element_.addEventListener(topic, listener, opt_options || false);
    },

    function removeEventListener(topic, listener) {
      this.element_.removeEventListener(topic, listener);
    },

    function setID(id) {
      /* Explicitly set Element's id. */
      this.id = this.element_.id = id;
      return this;
    },

    function nbsp() {
      return this.add('\xa0');
    },

    function addClass(cls) { /* ...( Slot | String ) */
      if ( arguments.length > 1 ) {
        for ( let i = 0 ; i < arguments.length ; i++ ) {
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
          if ( ! this.element_.classList ) {
            console.warn("Can't set class of document fragments.");
          } else {
            if ( enabled ) {
              this.element_.classList.add(parts[i]);
            } else {
              this.element_.classList.remove(parts[i]);
            }
          }
        }
      }
      return this;
    },

    function removeClass(cls) {
      /* Remove specified CSS class. */
      if ( cls ) {
        delete this.classes[cls];
        this.element_.classList.remove(cls);
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

    function createChild_(spec, args, disableWarning) {
      return foam.u2.ViewSpec.createView(spec, args, this, this.__subSubContext__, disableWarning);
    },

    function start(spec, args, slot, disableWarning) {
      /* Create a new Element and add it as a child. Return the child. */
      var c = this.createChild_(spec, args, disableWarning);

      this.add(c);

      if ( slot ) slot.set(c);
      return c;
    },

    function end() {
      /* Return this Element's parent. Used to terminate a start(). */
      return this.parentNode;
    },

    function translate(source, opt_default) {
      /* Translate text before add()-ing to the Element. Lets text be edited if XMSG is in URL. */
      var translationService = this.translationService;
      if ( translationService ) {
        /* Add the translation of the supplied source to the Element as a String */
        let xmsgObj, translation;
        if ( foam.lang.Slot.isInstance(source) ) {
          translation = source.map(v => this.translationService.getTranslation(foam.locale, v, opt_default ||v))
          xmsgObj = {source$: source, data$: translation };
        } else {
          translation = this.translationService.getTranslation(foam.locale, source, opt_default || source);
          xmsgObj = {source: source, data: translation };
        }
        if ( foam.xmsg ) {
          return this.tag({ ...xmsgObj, class: 'foam.i18n.InlineLocaleEditor', defaultText: opt_default});
        }
        return this.add(translation);
      }
//      console.warn('Missing Translation Service in ', this.cls_.name);
      if ( opt_default === undefined ) opt_default = source;
      return this.add(opt_default);
    },

    function add() {
      if ( this.content ) {
        this.content.add_(arguments, this);
        return this;
      }
      return this.add_(arguments, this);
    },

    function addChild_(c, parentNode) {
      if ( c === null || c === undefined ) return;

      if ( parentNode.isDetached() ) {
        console.warn('Attempt to add child to detached parent');
        if ( c.element_ ) {
          c.detach();
        }
        return;
      }

      if ( foam.Array.isInstance(c) ) {
        for ( var i = 0 ; i < c.length ; i++ )
          this.addChild_(c[i], parentNode);
        return;
      }
      if ( c.addToE ) {
        c.addToE(this);
        return;
      }
      if ( c.toE ) {
        c = c.toE(null, this.__subSubContext__);
      }
      if ( foam.lang.DynamicFunction.isInstance(c) ) {
        this.addChild_(foam.u2.FunctionNode.create({fn: c, parentNode: this}, this), this);
        return;
      }
      if ( foam.Function.isInstance(c) ) {
        this.addChild_((this.__subContext__.data || this).dynamic(c), parentNode);
        return;
      }
      if ( foam.lang.Slot.isInstance(c) ) {
        c = foam.u2.SlotNode.create({slot_: c}, this);
      }
        /*
        var v = this.slotE_(c);
        if ( Array.isArray(v) ) {
          for ( var j = 0 ; j < v.length ; j++ ) {
            var u = v[j];
            es.push(u.toE ? u.toE(null, Y) : u);
          }
        } else {
          this.addChild_(v, parentNode);
        }
        */
      if ( this.isLiteral(c) ) {
        c = foam.u2.Text.create({text: c});
        this.childNodes.push(c);
        c.parentNode = parentNode;
        this.appendChild_(c.element_);
      } else if ( c.then ) {
        this.addChild_(this.PromiseSlot.create({ promise: c }), parentNode);
      } else if ( c.element_ ) {
        this.childNodes.push(c);
        c.parentNode = parentNode;
        this.appendChild_(c.element_);
        c.load && c.load();
      } else if ( foam.lang.FObject.isInstance(c) ) {
        this.addChild_(this);
        this.addChild_(foam.u2.DetailView.create({data: c}, this), this);
      }
    },

    function add_(cs, parentNode) {
      /* Add Children to this Element. */
//      var es = [];
//      var Y = this.__subSubContext__;

      for ( var i = 0 ; i < cs.length ; i++ ) {
        this.addChild_(cs[i], parentNode);
      }
        /*
        // Remove null values
        if ( c === undefined || c === null ) {
          // nop
        } else if ( c.toE ) {
          var e = c.toE(null, Y);
          if ( foam.lang.Slot.isInstance(e) ) {
            var v = this.slotE_(c);
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
        } else if ( typeof c === 'function' ) {
          throw new Error('Unsupported');
        } else {
          // String or Number
          es.push(c);
        }
      }
      */
/*
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

        // this.childNodes.push.apply(this.childNodes, es);
        // this.onAddChildren.apply(this, es);
      }
      */

      return this;
    },

    function setChildren(slot) {
      this.removeAllChildren();
      this.add(slot);
      /*.map(a => {
        this.add(a);
      });
      */
    },

    function removeAllChildren() {
      this.element_.innerHTML = '';
      for ( var i = 0 ; i < this.childNodes.length ; i++ ) {
        this.childNodes[i].detach();
      }
      this.childNodes = [];
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
    function select(dao, f) {
      this.add(foam.u2.DAOSelectNode.create({
        dao:  dao,
        code: f,
      }, this));
      return this;
    },

    function write() {
      this.document.body.appendChild(this.element_);
      this.load();
      return this;
    },

    function toString() {
      return this.cls_.id + '(id=' + this.id + ', nodeName=' + this.nodeName + ')';
    },

    function insertBefore(e, reference) {
      /* Add a single element before another reference element. */
      var i = this.childNodes.indexOf(reference);
      if ( i == -1 ) return this;
      e = e.toE ? e.toE(null, this.__subSubContext__) : e;
      e.parentNode = this;
      this.childNodes.splice(i, 0, e);
      this.element_.insertBefore(e.element_, reference.element_);
      e?.load();

      return this;
    },

    function addClass_(oldClass, newClass) {
      /* Replace oldClass with newClass. Called by cls(). */
      if ( oldClass === newClass ) return;
      if ( oldClass ) this.removeClass(oldClass);
      if ( newClass ) {
        if ( ! this.CSS_CLASSNAME_PATTERN.test(newClass) ) {
          console.log('Invalid CSS ClassName: ', newClass);
          throw "Invalid CSS classname";
        }
        this.classes[newClass] = true;
        // Could be a FunctionNode which only has a comment
        if ( this.element_ && this.element_.classList )
          this.element_.classList.add(newClass);
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
      this.element_.style[key] = value;
      return this;
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
      var ctx = X?.__context__ || this.__context__ || foam.__context__;
      // Create isolated memento so inline views don't participate in navigation chain
      var isolatedCtx = ctx.createSubContext({
        memento_: foam.u2.memento.Memento.create({obj: this}, ctx)
      });
      return foam.u2.ViewSpec.createView(
        { class: 'foam.u2.DetailView', showActions: true, data: this },
        args, this, isolatedCtx);
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
      // Makes it easier to add underlying Property View
      // Without wrapping in a PropertyBorder
      name: '__',
      transient: true,
      compare: function() { return 0; },
      getter: function() {
        return { __proto__: this, toE: this.toPropertyView };
      }
    },
    {
      class: 'Boolean',
      name: 'reserveLabelSpace',
      documentation: 'Property to indicate if PropertyBorders need to reserve label space when label is empty'
    }
  ],

  methods: [
    function toE(args, X) {
      var e = this.createElFromSpec_(this.view, args, X);

      // e could be a Slot, so check if addClass exists
      e.addClass && e.addClass('property-' + this.name);

      return e;
    },

    function toPropertyView(args, X) {
      return this.createElFromSpec_({ class: 'foam.u2.PropertyBorder', prop: this }, args, X);
    },

    function createElFromSpec_(spec, args, X) {
      let el = foam.u2.ViewSpec.createView(spec, args, this, X, true);

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
  name: 'PhoneNumberViewRefinement',
  refines: 'foam.lang.PhoneNumber',
  requires: [ 'foam.u2.view.StringView' ],
  properties: [
    {
      name: 'view',
      value: {
        class: 'foam.u2.view.StringView',
        writeView: { class: 'foam.u2.TextField', type: 'tel' }
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
    [ 'view', { class: 'foam.u2.view.CurrencyView', onKey: false } ]
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
          class: 'foam.u2.MultiView',
          views: [
            { class: 'foam.u2.TextField' },
            { class: 'foam.u2.view.ColorPicker', onKey: true },
            { class: 'foam.u2.view.ReadColorView' }
          ]
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
  name: 'CurrencyCodeViewRefinement',
  refines: 'foam.lang.CurrencyCode',

  properties: [
    {
      name: 'view',
      value: {
        class: 'foam.u2.view.ModeAltView',
        writeView: { class: 'foam.u2.view.StringView', onKey: false },
        readView:  { class: 'foam.u2.view.ReadReferenceView' }
      }
    }
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
      attribute: true,
      transient: true
    },
    // {
    //   class: 'String',
    //   name: 'error_'
    // },
    {
      class: 'Enum',
      of: 'foam.u2.DisplayMode',
      name: 'mode',
      hidden: true,
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
    function init() {
      if ( this.id )
        this.element_.u3 = this;
      this.SUPER();
    },
    function render() {
      this.SUPER();
      this.updateMode_(this.mode);
      this.enableClass('error', this.error_$);
      // this.setAttribute('title', this.error_$);
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

  exports: [ 'as data' ],

  properties: [
    {
      name: 'shown',
      hidden: true
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'Router',
  extends: 'foam.u2.Controller',
  mixins: [ 'foam.u2.memento.Memorable' ],

  exports: [ 'route' ],

  properties: [
    {
      name: 'route',
      memorable: true
    }
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
      label: 'CSS',
      view: { class: 'foam.u2.tag.TextArea', rows: 20, cols: 80 },
      postSet: function(_, code) {
        var css = foam.u2.CSS.create({code: code});
        css.name = css.name + '-' + this.id;
        this.axioms_.push(css);
      }
    },
    {
      class: 'Boolean',
      name: 'inheritCSS',
      hidden: true,
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
  name: 'HTMLView',
  extends: 'foam.u2.Element',

  documentation: 'View for safely displaying HTML content.',

  css: '^ { padding: 6px 0; }',

  properties: [
    {
      name: 'data',
      attribute: true
    }
  ],

  methods: [
    function remove() {
      // TODO: shouldn't be necessary but aren't being GC'ed properly, probably because of bug in
      // FunctionNode. Remove this when fixed.
      if ( this.element_ ) this.element_.innerHTML = '';
      this.SUPER();
    },

    function render() {
      this.addClass();
      this.update();
      this.onDetach(this.data$.framed().sub(this.update));
    }
  ],

  listeners: [
    {
      name: 'update',
      code: function() {
        // TODO: add validation
        this.element_.innerHTML = this.data || '';
      }
    }
  ]
});
