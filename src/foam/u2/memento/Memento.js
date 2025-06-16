/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.memento',
  name: 'Memento',

  // TODO: support "sticky" localStorage/config properties

  documentation: `
    A hierarchical implementation of the Memento pattern.
    Used to encode UI states/routes in a string form that can be stored and later
    reverted to. Can be used to implement back/forth support or bookmarking.
    Can be two-way linked to the window location hash.

    Memento mapping is handled automatically by marking properties as memorable: true.
    Memorable properties are automatically encoded-into / extracted-from the string
    form of the memento and a sub-Memento, with the used bindings removed, is exported
    for children to consume.

    If a Property specifies a 'shortName', it will be used as the properties key
    instead of the properties 'name'.

    If a Property is named 'route', it will be encoded as part of the memento
    path, rather than as a keyed paramater.

    The format for memento strings is:
    #path1/path2/...pathn?key1=value1&key2=value2...&keyn=valuen

    Which is short form for:
    #route=path1&route=path2&route=path3&key1=value1&key2=value2...&keyn=valuen

    Notice that you can have more than one key=value pair for the same key.
    In the event of duplicates, bindings are assigned from top-down.

    To make a model memorable, just add:

    mixins: [
      'Memorable'
    ],

    And then add "memorable: true" to properties you wish to memorable.
  `,

  properties: [
    {
      class: 'Boolean',
      name: 'feedback_',
      documentation: 'Set to true when "str" is being set to prevent feedback.'
    },
    {
      name: 'parent',
      postSet: function(_, p) {
        p.tail   = this;
        // Should this be done? Maybe only for something like AltView, so it
        // should do it.
        // If the child is created after the parent (which is usual), then we
        // need to keep the tailStr around until then. But if something like
        // a menu is switched, don't want to keep orphaned bindings.
        this.str = p.tailStr;
      },
      documentation: 'The parent Memento for this Memento (parent.tail == this).'
    },
    {
      name: 'obj',
      documentation: 'Object to be made memorable. Can be null if this is the top-level memento.'
    },
    {
      name: 'props',
      documentation: 'The properties of "obj" that have the Property.memorable: true.',
      expression: function(obj) {
        return obj ?
          this.obj.cls_.getAxiomsByClass(foam.lang.Property).filter(p => p.memorable) :
          [] ;
      }
    },
    {
      class: 'String',
      name: 'str',
      documentation: 'String input memento. Used to set the memento from a String.',
      displayWidth: 100,
      postSet: function(_, s) {
        this.feedback_ = true;
        try {
          // parser & separated string of key=value bindings and store in bs
          var bs = [];

          s = this.addRouteKeys(s);

          if ( s ) {
            bs = this.createBindings(s);
          }

          function consumeBinding(k) {
            // find and remove a binding from bindings 'bs'
            for ( var i = 0 ; i < bs.length ; i++ ) {
              var kv = bs[i];
              if ( kv[0] == k ) {
                bs.splice(i,1);
                return kv[1];
              }
            }
          }

          // Remove bindings for 'obj' properties and set remaining bindings in 'tail'
          this.props.forEach(p => {
            var value = consumeBinding(p.shortName || p.name);
            // Remove the tail memento if the route changes to prevent retaining stale parameters.
            if ( ( p.name === 'route' || p.shortName === 'route' ) && this.obj[p.name] !== value && this.tail ) {
              // this.detachTail();
            }
            // Even if value doesn't exist, then still set, to revert to default value
            value = value && decodeURIComponent(value);
            this.obj[p.name] = this.obj.cls_.getAxiomByName(p.name)?.fromString(value) ?? value;
          });

          this.tailStr = this.encodeBindings(bs);
        } finally {
          this.feedback_ = false;
        }
      }
    },
    {
      name: 'tail',
      documentation: 'Currently active Sub-Memento, if it exists.'
    },
    {
      name: 'usedStr',
      documentation: 'Only the bindings from "str" that are used by this Memorable or sub-Mementos. Should be used when storing memento as a String.'
    },
    {
      name: 'tailStr',
      documentation: 'Bindings from "str" with used bindings removed. Becomes "str" of "tail".',
      postSet: function(_, s) {
        if ( this.tail ) this.tail.str = s;
      }
    }
  ],

  methods: [
    function init() {
      if ( ! this.obj ) return;

      // Listen for changes to any memorable Properties
      this.props.forEach(p => {
        this.obj.slot(p.name).sub(this.update);
      });
    },

    function detachTail() {
      // console.log('detaching tail', this.tailStr)
      this.tail?.detach();
      this.tail = null;
      this.tailStr = '';
    },

    function createBindings(s) {
      let arr = [];
      // Do not split inside '{}', can be used as an escape char
      // This only works for one level of nesting, can we use a foam parser?
      s.split(/&(?=[^\}]*(?:\{|$))/).forEach(p => {
        // Limit split to one in order to preserve nested mementos
        var [k,v] = p.split(/=(.*)/, 2)
        arr.push([k,v]);
      });
      return arr;
    },

    function addRouteKeys(s) {
      if ( s && s.indexOf('=') == -1 ) s += '?';
      var i = s.indexOf('?');
      if ( i != -1 ) {
        var route = s.substring(0, i).split('/');
        s = s.substring(i+1);
        s = route.map(p => 'route=' + p).join('&') + (s ? '&' + s : '');
      }
      return s
    },

    function encodeBindings(bs) {
      /** Encode an array of [key,value] bindings as a & deliminted key=value string. **/
      var s = '';
      bs.forEach(b => {
        if ( s ) s += '&';
        s += b[0] + '=' + b[1];
      });
      return s;
    },

    function toString(encoded) {
      /** Converts this Memento (and tail) to path?params encoded String. **/
      var e = encoded || this.encode();
      var s = e.route;
      if ( e.params ) {
        if ( s ) s += '?';
        s += e.params;
      }
      return s;
    },

    function encode(opt_untilObj) {
      /**
        Recursively encode memento as a map with the following structure:
        {route: "route1/route2/...", params: "key1=value1&key2=value2...", bound: { key1: true, key2: true, ... }}
        'bound' is used to specify all names bound in the encoding. This is used
        because if a name is bound in the tail, it needs to be added to params
        in the parent, even if it is the default value, otherwise it would
        cause ambiguity as to which level the binding applied.
      **/
      var ret = ( this.tail && opt_untilObj !== this.obj ) ? this.tail.encode() : { route: '', params: '', bound: {} };

      this.props.forEach(p => {
        var val = this.obj[p.name] === undefined ? '' : this.obj[p.name];
        if ( p.name === 'route' || p.shortName === 'route' ) {
          if ( ret.route ) ret.route = '/' + ret.route;
          ret.route = encodeURIComponent(val) + ret.route;
        } else {
          var name = p.shortName || p.name;

          // If the name is bound in the tail, then output to avoid ambiguity
          if ( ! this.obj.hasDefaultValue(p.name) || ret.bound[name] ) {
            if ( ret.params ) ret.params = '&' + ret.params;
            // ???: What is this used for?
            if ( val && this.cls_.isInstance(val) ) debugger;
            // if ( val && this.cls_.isInstance(val) ) val = `{${val.usedStr}}`;
            // if ( val === undefined ) val = '';
            ret.params = name + '=' + encodeURIComponent(val) + ret.params;
            // console.log('***', name, val);
            ret.bound[name] = true;
          }
        }
      });

      if ( ! opt_untilObj ) this.usedStr = this.toString(ret);

      return ret;
    }
  ],

  listeners: [
    function removeMementoTail() {
      // Logging to track memento issues
      // console.log('Detaching tail ', this.obj?.cls_.name, this.tailStr);
      this.tail = null;
      this.tailStr = undefined;
      this.update();
    },
    {
      name: 'update',
      documentation: `
        Called when a Memento Property is updated.
        Causes usedStr of this Memento and parents to be updated.
        Is merged to avoid multiple updates when multiple properties update at once.
      `,
      code: function(slot) {
        if ( this.feedback_ ) return;
        if ( this.parent && this.parent.tail !== this ) {
          // console.log('***************** update() of orphaned Memento');
          // Update received from a child
          if ( slot ) {
            slot.detach();
          } else {
            this.tail = null;
          }
          return;
        }
// console.log('*** update() objClass:', this.obj && this.obj.cls_.name, 'property:', arguments[2], 'value:', arguments[3]?.get());
        this.update_();
      }
    },
    {
      name: 'update_',
      isMerged: true,
      mergeDelay: 32,
      code: function() {
        // console.log('*** update_(): ', this.$UID, this.cls_.name, 'objClass:', this.obj.cls_.name, 'tail:', this.tail && (this.tail.$UID + ' ' + this.tail.usedStr), 'usedStr:', this.usedStr);
        if ( this.parent ) {
          this.parent.update();
        } else {
          this.encode(); // Will set usedStr
        }
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.memento',
  name: 'WindowHashMemento',
  extends: 'foam.u2.memento.Memento',

  documentation: `
    A Memento with support for binding to the windows location hash.
    The top-level Memento in the system should be a WindowHashMemento.
  `,

  imports: [ 'window', 'breadcrumbs?', 'document' ],

  properties: [
    {
      class: 'Boolean',
      name: 'hashFeedback_',
      hidden: true
    },
    'detacher_'
  ],

  methods: [
    function init() {
      this.SUPER();

      this.onHashChange();
      this.window.onpopstate = this.onHashChange;
      this.usedStr$.sub(this.onMementoChange);
      this.window.history.replaceState({},'',this.window.location.href)
    }
  ],

  listeners: [
    {
      name: 'onHashChange',
      // Not framed or merged so can detect hashFeedback_ properly
      documentation: 'Called when the window hash is updated, causes update to memento.',
      code: function() {
        // console.log('onHashChange', this.hashFeedback_, this.window.location.hash);
        if ( this.hashFeedback_ ) return;
        this.str = this.window.location.hash.substring(1);
      }
    },
    {
      name: 'onMementoChange',
      documentation: 'Called when the memento changes, causes update to hash.',
      code: function() {
        this.hashFeedback_ = true;
        let route    = this.usedStr.split('?')[0];
        let winRoute = this.window.location.hash.substring(1).split('?')[0];
        let self = this;
        if ( route == winRoute ) {
          this.window.history.replaceState(null,'','#' + this.usedStr)
        } else {
          this.window.history.pushState(null, '', '#' + this.usedStr)
        }
        // Title needs to be set here otherwise title changes before the memento does and we get incorrect document titles
        if ( this.breadcrumbs ) {
          if ( this.detacher_ ) this.detacher_.detach();
          this.detacher_ = this.breadcrumbs.current?.dynamic(function(title) {
            self.document.title = title;
          });
        }
        this.hashFeedback_ = false;
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.memento',
  name: 'MemorablePropertyRefinement',
  refines: 'foam.lang.Property',

  documentation: 'Add "memorable" Property to Property.',

  properties: [
    {
      class: 'Boolean',
      documentation: "If true, this Property will be included in Mementos and it's value will be copied from Mementos.",
      name: 'memorable'
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.memento',
  name: 'Memorable',

  requires: [
    'foam.u2.memento.Memento',
    'foam.u2.memento.WindowHashMemento'
  ],

  documentation: 'Mixin to make a model Memorable',

  imports: [ 'memento_? as parentMemento_' ],
  exports: [ 'memento_' ],

  properties: [
    {
      name: 'memento_',
      documentation: 'Memento bound to this object.',
      hidden: true,
      transient: true,
      factory: function() {
        // If no top-level Memento found, then create a WindowHashMemento to be
        // the top-level one.
        return this.parentMemento_ ?
          this.Memento.create({obj: this, parent: this.parentMemento_}, this) :
          this.WindowHashMemento.create({obj: this}, this);
      }
    }
  ],

  methods: [
    function initArgs(args, opt_parent) {
      this.SUPER(null, opt_parent);
      this.memento_;
      // Copy args again cause context was needed for mementos
      this.SUPER(args);
    }
  ]
});
