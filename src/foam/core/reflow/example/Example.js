/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.example',
  name: 'Example',
  extends: 'foam.u2.Controller',

  imports: [ 'scope as globalScope' ],

  css: `
    ^ {
      margin-bottom: 36px;
      background: 'pink';
      width: 100%;
      xxxborder: 2px solid black;
      xxxborder-radius': 3px;
      padding-bottom': 24px;
    }
    ^ .property-text { border: none; padding: 10 0; }
    ^ .property-code { margin-bottom: 12px; }
    ^ .property-title { float: left; }
    ^ .property-id { float: left; margin-right: 12px; }
  `,

  properties: [
    {
      name: 'innerText',
      setter: function(o, n) { this.code = n; }
    },
    {
      class: 'String',
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
    'dom'
  ],

  methods: [
    function render() {
      this.SUPER();

      var self = this;

      this.
        addClass(this.myClass()).
        add(this.CODE).
        start().
          br().
          start('span').style({'font-weight': 500}).add('Output:').end().
            start().
              style({border: '1px solid black', padding: '8px'}).
              tag('div', {}, this.dom$).
            end().
          end();

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
            return self.dom.start.apply(self.dom, arguments);
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
