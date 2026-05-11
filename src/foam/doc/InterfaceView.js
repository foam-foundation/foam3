/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.doc',
  name: 'InterfaceView',
  extends: 'foam.u2.View',

  requires: [
    'foam.doc.ClassLink'
  ],

  css: `
    ^ { font-family: $font1; }
    ^method { margin: 16px 0; }
    ^signature { background: $backgroundSecondary; padding: 8px 12px; border-radius: 4px; font-family: monospace; }
    ^type { color: $primary400; }
    ^name { color: $purple400; font-weight: bold; }
    ^args { color: $textDefault; }
    ^doc { margin: 8px 0 0 12px; color: $textTertiary; }
    ^params { margin: 8px 0 0 12px; }
    ^param { margin: 4px 0; font-size: 14px; }
    ^paramName { font-family: monospace; font-weight: bold; }
    ^paramType { font-family: monospace; color: $primary400; }
    ^paramDoc { color: $textTertiary; }
  `,

  properties: [
    {
      class: 'Class',
      name: 'data',
      attribute: true,
      adapt: function(o, n) {
        if ( foam.String.isInstance(n) ) n = foam.lookup(n);
        return n;
      }
    },
    {
      name: 'methods',
      expression: function(data) {
        if ( ! data ) return [];
        return data.getAxiomsByClass(foam.lang.internal.InterfaceMethod);
      }
    }
  ],

  methods: [
    function render() {
      var self = this;
      var cls  = this.data;
      if ( ! cls ) return;

      var model    = cls.model_;
      var extends_ = model.extends ? foam.maybeLookup(model.extends) : null;

      this.addClass(this.myClass())
        .start('div').add(model.package).end()
        .start('h3').add('Interface ', model.name).end()

        .callIf(model.documentation, function() {
          this.start('p').add(model.documentation).end();
        })

        .callIf(extends_, function() {
          this.start('div')
            .add('extends ')
            .tag(self.ClassLink, { data: extends_, showPackage: true })
          .end();
        })

        .start('hr').end()

        .start('h4').add('Method Summary').end()

        .add(self.dynamic(function(methods) {
          this.forEach(methods, function(m) {
            this.start('div').addClass(self.myClass('method'))
              .start('div').addClass(self.myClass('signature'))
                .start('span').addClass(self.myClass('type')).add(m.type || 'void').end()
                .add(' ')
                .start('span').addClass(self.myClass('name')).add(m.name).end()
                .start('span').addClass(self.myClass('args'))
                  .add('(')
                  .add(self.formatSignatureArgs(m.args))
                  .add(')')
                .end()
              .end()
              .callIf(m.documentation, function() {
                this.start('div').addClass(self.myClass('doc')).add(m.documentation).end();
              })
              .callIf(m.args && m.args.length, function() {
                this.start('div').addClass(self.myClass('params'))
                  .start('b').add('Parameters:').end()
                  .forEach(m.args, function(arg) {
                    this.start('div').addClass(self.myClass('param'))
                      .start('span').addClass(self.myClass('paramName')).add(arg.name).end()
                      .add(' ')
                      .start('span').addClass(self.myClass('paramType')).add('(', arg.type || 'Object', ')').end()
                      .callIf(arg.documentation, function() {
                        this.add(' — ')
                          .start('span').addClass(self.myClass('paramDoc')).add(arg.documentation).end();
                      })
                    .end();
                  })
                .end();
              })
            .end();
          });
        }));
    },

    function formatSignatureArgs(args) {
      if ( ! args || ! args.length ) return '';
      return args.map(a => (a.type || 'Object') + ' ' + a.name).join(', ');
    }
  ]
});
