/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Can be used in markdown: <foam class="foam.doc.DIGApiDoc" data="foam.core.auth.User"></foam>
// Use daoPrompt and Script agent to output all APIs: try {this.__context__.out.add(foam.doc.DIGApiDoc.create({data: o.id},this)); } catch(x){}

foam.CLASS({
  package: 'foam.doc',
  name: 'DIGApiDoc',
  extends: 'foam.u2.View',

  requires: [ 'foam.doc.ModelDiagramView' ],

  css: `
    ^ { font-family: system-ui, sans-serif; max-width: 900px; }
    ^section { margin: 24px 0; }
    ^endpoint { background: #f5f5f5; padding: 12px; border-radius: 4px; font-family: monospace; }
    ^example { background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 4px; overflow-x: auto; white-space: pre; font-family: monospace; font-size: 13px; }
    ^table { border-collapse: collapse; width: 100%; }
    ^table th, ^table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    ^table th { background: #f5f5f5; }
    ^method { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; margin-right: 8px; }
    ^put { background: #49cc90; color: white; }
    ^select { background: #61affe; color: white; }
    ^remove { background: #f93e3e; color: white; }
  `,

  properties: [
    {
      class: 'String',
      name: 'data',
      documentation: 'DAO key'
    },
    {
      name: 'of',
      hidden: true,
      expression: function (data) {
        return this.__context__[data].of;
      }
    },
    {
      class: 'String',
      name: 'baseUrl',
      value: '/service/dig'
    },
    {
      name: 'properties',
      hidden: true,
      expression: function(of) {
        if ( ! of ) return [];
        return of.getAxiomsByClass(foam.lang.Property)
          .filter(p => ! p.hidden && ! p.transient && ! p.networkTransient);
      }
    }
  ],

  methods: [
    function render() {
      var self = this;
      var cls  = this.of;
      if ( ! cls ) return;

      this.addClass(this.myClass())
        .start('h1').add(cls.name, ' API').end()
        .start('p').add(cls.model_.documentation || '').end()

        // Endpoints
        .start('div').addClass(this.myClass('section'))
          .start('h2').add('Endpoints').end()

          .start('div').style({'margin-bottom': '12px'})
            .start('span').addClass(this.myClass('method')).addClass(this.myClass('select')).add('SELECT').end()
            .start('code').add(this.baseUrl, '?dao=', this.data, '&format=JSON&cmd=select').end()
          .end()

          .start('div').style({'margin-bottom': '12px'})
            .start('span').addClass(this.myClass('method')).addClass(this.myClass('put')).add('PUT').end()
            .start('code').add(this.baseUrl, '?dao=', this.data, '&format=JSON&cmd=put').end()
          .end()

          .start('div').style({'margin-bottom': '12px'})
            .start('span').addClass(this.myClass('method')).addClass(this.myClass('remove')).add('REMOVE').end()
            .start('code').add(this.baseUrl, '?dao=', this.data, '&format=JSON&cmd=remove&id={id}').end()
          .end()
        .end()

        .start('h2').add('Model Diagram').end()
        .tag(this.ModelDiagramView, {data: cls, width: 1000, height: -1})

        // Properties Table
        .start('div').addClass(this.myClass('section'))
          .start('h2').add('Properties').end()
          .add(self.dynamic(function(properties) {
            if ( ! properties ) return;
            this
              .start('table').addClass(self.myClass('table'))
                .start('tr')
                  .start('th').add('Name').end()
                  .start('th').add('Type').end()
                  .start('th').add('Required').end()
                  .start('th').add('Description').end()
                .end()
                .forEach(properties, function(p) {
                  this.start('tr')
                    .start('td').start('code').add(p.name).end().end()
                    .start('td').add(self.getTypeName(p)).end()
                    .start('td').add(p.required ? 'Yes' : '-').end()
                    .start('td').add(p.documentation || '-').end()
                  .end();
                })
              .end();
          }))
        .end()

        // Query Language
        .start('div').addClass(this.myClass('section'))
          .start('h2').add('Filtering (SELECT)').end()
          .start('p')
            .add('Use the ')
            .start('code').add('q').end()
            .add(' parameter to filter results. See ')
            .start('a').attrs({href: 'manual:Query Syntax'}).add('AQL Query Language').end()
            .add(' for full syntax.')
          .end()
          .start('div').addClass(this.myClass('endpoint'))
            .add(this.baseUrl, '?dao=', this.data, '&format=JSON&cmd=select&q=propertyName:value')
          .end()
        .end()

        // JSON Example
        .start('div').addClass(this.myClass('section'))
          .start('h2').add('PUT Example').end()
          .start('div').addClass(this.myClass('example'))
            .add(self.dynamic(function(properties) {
              this.add(self.generateJsonExample(properties));
            }))
          .end()
        .end()

        // Authentication
        .start('div').addClass(this.myClass('section'))
          .start('h2').add('Authentication').end()
          .start('p')
          .add('All requests require authentication via HTTP Basic Auth or session cookie. See ')
          .start('a').attrs({href: 'manual:DIG'}).add('DIG documentation').end().add(' for details.')
        .end();
    },

    function getTypeName(prop) {
      if ( prop.cls_ ) {
        var name = prop.cls_.name;
        return name.endsWith('Property') ? name.slice(0, -8) : name;
      }
      return 'Object';
    },

    function generateJsonExample(properties) {
      var obj = {};
      properties.forEach(p => { obj[p.name] = this.getExampleValue(p); });
      return JSON.stringify(obj, null, 2);
    },

    function getExampleValue(prop) {
      var typeName = this.getTypeName(prop);
      switch ( typeName ) {
        case 'String':   return prop.name + '_value';
        case 'Int':
        case 'Long':     return 0;
        case 'Float':
        case 'Double':   return 0.0;
        case 'Boolean':  return false;
        case 'Date':     return '2025-01-01';
        case 'DateTime': return '2025-01-01T00:00:00Z';
        default:         return null;
      }
    }
  ]
});
