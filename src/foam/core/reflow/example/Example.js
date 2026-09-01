/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.example',
  name: 'Example',
  extends: 'foam.u2.Controller',

  requires: [
    'foam.core.u2.navigation.Stack',
    'foam.u2.stack.BreadcrumbManager'
  ],

  imports: [ 'scope as globalScope' ],

  exports: ['stack_ as stack', 'breadcrumbs_ as breadcrumbs'],

  css: `
    ^ {
      width: 100%;
    }
    ^ .property-text { border: none; padding: 10 0; }
    ^ .property-code { margin-bottom: 12px; }
    ^ .property-title { float: left; }
    ^ .property-id { float: left; margin-right: 12px; }
    ^output {
      border: 2px solid $borderDefault;
      padding: 1rem;
      margin: 0;
      border-radius: 4px;
    }
  `,

  properties: [
    {
      name: 'innerText',
      setter: function(n) { this.code = n; },
      getter: function() { return this.code; },
      onKey: false,
      view: {class: 'foam.u2.view.CodeView', config: { width: '100%', mode: 'JAVASCRIPT', showGutter: false }}
    },
    {
      class: 'String',
      // ONLY HIDE IN DETAIL VIEW
      visibility: 'HIDDEN',
//      class: 'Code',
      name: 'code',
      adapt: function(_, s) {
        if ( foam.String.isInstance(s) ) return s.trim();
        s         = s.toString();
        var start = s.indexOf('{');
        var end   = s.lastIndexOf('}');
        return ( start >= 0 && end >= 0 ) ? s.substring(start + 2, end) : '';
      },
      view: 'foam.core.reflow.example.CodeView'
    },
    {
      name: 'dom',
      hidden: true,
      // visibility: 'HIDDEN',
      transient: true
    },
    {
      name: 'stack_',
      factory: function() {
        return this.Stack.create();
      }
    },
    {
      name: 'breadcrumbs_',
      factory: function() {
        return this.BreadcrumbManager.create();
      }
    }
  ],

  methods: [
    function render() {
      this.SUPER();

      var self = this;

      this.
        addClass(this.myClass()).
        add(this.CODE).
        start('span').addClass('h500').add('Output:').end().
        add(this.stack_).
        end();
      this.stack_.addClass(this.myClass('output'));
      // Set the parentMemento_ instead of setting memento_ to null so that it doesn't install a new WindowMemento() and break navigation.
      this.stack_.push(this.E().startContext({ stack: this.stack_, breadcrumbs: this.breadcrumbs_, parentMemento_: foam.u2.memento.Memento.create() }).
        tag('div', {}, this.dom$)).endContext();
      this.runListener();
      this.onDetach(this.code$.sub(this.runListener));
    },

    function add() {
      // Hackish method of encoding code in innerText, TODO: something better
      if ( arguments.length == 1 && foam.String.isInstance(arguments[0]) ) {
        this.code = arguments[0];
        return this;
      }

      return this.SUPER.apply(this, arguments);
    }
  ],

  actions: [
    function run() { this.runListener(); }
  ],

  listeners: [
    {
      name: 'runListener',
      isFramed: true,
      code: function() {
        var self = this;
        this.dom.removeAllChildren();
        var scope = {
          E: function(opt_nodeName) {
            return self.Element.create({nodeName: opt_nodeName});
          },
          log: function() {
            var args = [];
            for ( var i = 0 ; i < arguments.length ; i++ ) {
              if ( i ) args.push(' ');
              if ( arguments[i] === false )
                args.push('false');
              else
                args.push(arguments[i]);
            }

            self.dom.add(args);
            self.dom.br();
          },
          print: function() {
            console.log('deprecated use of print(). Use log() instead.');
            self.dom.add.apply(self.dom, arguments);
            self.dom.br();
          },
          add: function() {
            return self.dom.add.apply(self.dom, arguments);
          },
          br: function() {
            return self.dom.br();
          },
          start: function() {
            return self.dom.start.apply(self.dom, arguments);
          },
          tag: function() {
            return self.dom.tag.apply(self.dom, arguments);
          }
        };

        globalThis.scope = scope;

        with ( this.globalScope ) {
          with ( scope ) {
            try {
              eval(self.code);
              // if ( self.dom.children.length ) self.showOutput = true;
            } catch (x) {
              scope.log(x.toString?.() ?? x);
            }
          }
        }
      }
    }
  ]
});


foam.SCRIPT({
  package: 'foam.core.reflow.example',
  name: 'ExampleTagScript',
  requires: [ 'foam.core.reflow.example.Example' ],
  code: function() {
    foam.__context__.registerElement(foam.core.reflow.example.Example);
  }
});
