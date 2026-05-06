/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.doc',
  name: 'PropertyView',
  extends: 'foam.u2.View',

  documentation: 'Displays the properties of a class for non-developers: type, name, label, and description.',

  css: `
    ^ { font-family: $font1; }
    ^title { margin-bottom: 8px; }
    ^table { width: 100%; border-collapse: collapse; }
    ^table th { padding: 6px 16px 6px 0; text-align: left; font-weight: bold; color: $textSecondary; border-bottom: 2px solid $borderDefault; white-space: nowrap; }
    ^table td { padding: 8px 16px 8px 0; border-bottom: 1px solid $borderLight; vertical-align: top; }
    ^type { font-family: monospace; color: $primary400; white-space: nowrap; }
    ^type-detail { display: block; font-size: 0.85em; color: $textTertiary; font-family: monospace; cursor: default; }
    ^name { font-family: monospace; color: $textDefault; white-space: nowrap; }
    ^label { font-weight: bold; color: $textDefault; white-space: nowrap; }
    ^doc { color: $textTertiary; }
  `,

  properties: [
    {
      class: 'Class',
      name: 'data',
      adapt: function(o, n) {
        if ( foam.String.isInstance(n) ) n = foam.lookup(n);
        return n;
      }
    }
  ],

  methods: [
    function render() {
      var self = this;
      var cls  = this.data;
      if ( ! cls ) return;

      var props = cls.getAxiomsByClass(foam.lang.Property)
        .filter(p => ! p.hidden && ! p.model_.name.includes('Relationship'));

      this.addClass(this.myClass())
        .start('h3').addClass(this.myClass('title')).add(cls.model_.label || cls.model_.name, ' Properties').end()
        .start('table').addClass(this.myClass('table'))
          .start('thead')
            .start('tr')
              .start('th').add('Type').end()
              .start('th').add('Name').end()
              .start('th').add('Label').end()
              .start('th').add('Description').end()
            .end()
          .end()
          .start('tbody')
            .forEach(props, function(p) {
              var typeName = p.model_.name.replace(/Property$/, '');
              this.start('tr')
                .start('td').addClass(self.myClass('type'))
                  .add(typeName)
                  .callIf(typeName === 'Reference' && p.targetDAOKey, function() {
                    this.start('span').addClass(self.myClass('type-detail')).add(p.targetDAOKey).end();
                  })
                  .callIf((typeName === 'Enum' || typeName === 'FObject') && p.of && p.of.id, function() {
                    var shortName = p.of.id.split('.').pop();
                    this.start('span').addClass(self.myClass('type-detail')).attrs({ title: p.of.id }).add(shortName).end();
                  })
                .end()
                .start('td').addClass(self.myClass('name')).add(p.name).end()
                .start('td').addClass(self.myClass('label')).add(p.label).end()
                .start('td').addClass(self.myClass('doc')).add(p.documentation || '').end()
              .end();
            })
          .end()
        .end();
    }
  ]
});
