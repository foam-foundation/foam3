/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PropertyRefinement',
  refines: 'Property',

  properties: [
    {
      class: 'Boolean',
      name: 'showInPropertyChoice',
      factory: function() { return ! this.hidden && ! this.networkTransient; }
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PropertyCitationView',
  extends: 'foam.u2.CitationView',
  
  documentation: 'Citation view for properties showing label and name in a vertical stacked layout',
  
  css: `
    ^row {
      display: flex;
      overflow-x: hidden;
      width: 100%;
      flex-direction: column;
      gap: 2px;
      border-bottom: 1px solid $borderXLight;
    }
    
    ^row:last-child {
      border-bottom: none;
    }
    
    ^label {
      font-size: 14px;
      font-weight: 500;
      line-height: 1.2;
    }
    
    ^name {
      font-family: monospace;
      font-size: 12px;
      color: $textSecondary;
      line-height: 1.2;
    }
  `,
  
  methods: [
    function getSummary(data) {
      // Override to prevent default summary behavior
      return '';
    },
    function render() {
      this.SUPER();
      // Clear the default summary content and add our custom layout
      this
        .start('div')
          .addClass(this.myClass('label'))
          .add(this.data.label || this.data.name)
        .end()
        .start('div')
          .addClass(this.myClass('name'))
          .add(this.data.name)
        .end();
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PropertyChoiceMixin',
  
  documentation: `
    Mixin that extracts common property selection logic to eliminate duplication
    between PropertyChoiceView_ (standard dropdown) and PropertyChoiceIconView_ 
    (icon-based dropdown). This pattern allows both views to share the same
    property filtering and section building logic while maintaining different
    visual representations through their parent classes (RichChoiceView vs 
    RichChoiceIconView).
  `,

  properties: [
    {
      name: 'forCls',
      postSet: function(_, value) {
        this.rebuildSections();
      }
    },
    'predicate',
    {
      name: 'search',
      value: true
    },
    {
      name: 'idProperty',
      value: 'name'
    },
    {
      name: 'choosePlaceholder',
      value: 'Choose Property'
    },
    {
      name: 'rowView',
      factory: function() {
        return { class: 'foam.core.reflow.PropertyCitationView' };
      }
    },
    {
      name: 'sections',
      factory: function() {
        if ( ! this.forCls ) return [
          {
            heading: 'Properties',
            dao: foam.dao.ArrayDAO.create({ 
              of: foam.lang.Property, 
              array: [] 
            }),
            searchBy: [ foam.lang.Property.NAME ]
          }
        ];
        let arr = this.forCls.getAxiomsByClass(foam.lang.Property)
          .filter(p => p.showInPropertyChoice)
          .filter(p => ! this.predicate || this.predicate(p))
          .sort(foam.lang.Property.NAME.compare);

        return [
          {
            heading: 'Properties',
            dao: foam.dao.ArrayDAO.create({ 
              of: foam.lang.Property, 
              array: arr 
            }),
            searchBy: [ foam.lang.Property.NAME ]
          }
        ];
      }
    }
  ],

  methods: [
    function rebuildSections() {
      this.clearProperty('sections');
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PropertyChoiceView_',
  extends: 'foam.u2.view.RichChoiceView',
  mixins: ['foam.core.reflow.PropertyChoiceMixin']
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PropertyChoiceIconView_',
  extends: 'foam.u2.view.RichChoiceIconView',
  mixins: ['foam.core.reflow.PropertyChoiceMixin']
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PropertyChoiceView',
  extends: 'foam.u2.View',
  
  documentation: `
    Wrapper view that handles the data binding between a Property object and its
    string name representation. This is necessary because the underlying 
    RichChoiceView expects string IDs, but we want to work with Property objects.
    The relateTo() method creates a bidirectional binding that converts between
    Property objects and their names.
  `,

  requires: [ 'foam.core.reflow.PropertyChoiceView_' ],

  properties: [
    'forCls',
    'propName'
  ],

  methods: [
    function render() {
      this.SUPER();

      var self = this;

      this.data$.relateTo(
        this.propName$,
        function propToName(p) { return p ? p.name : ''; },
        function nameToProp(n) { 
          return n ? self.forCls.getAxiomByName(n) : ''; 
        }
      );

      this.start(this.PropertyChoiceView_, {
        forCls: this.forCls, 
        data$: this.propName$
      });
    }
  ]

});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PropertyChoiceIconView',
  extends: 'foam.u2.View',
  
  documentation: `
    Icon-based variant of PropertyChoiceView. Provides the same Property<->name
    binding functionality but renders as an icon button (typically a plus icon)
    instead of a traditional dropdown. Used in space-constrained UIs where a
    full dropdown would be too large.
  `,

  requires: [ 'foam.core.reflow.PropertyChoiceIconView_' ],

  properties: [
    'forCls',
    'propName'
  ],

  methods: [
    function render() {
      this.SUPER();

      var self = this;

      this.data$.relateTo(
        this.propName$,
        function propToName(p) { return p ? p.name : ''; },
        function nameToProp(n) { 
          return n ? self.forCls.getAxiomByName(n) : ''; 
        }
      );

      this.start(this.PropertyChoiceIconView_, {
        forCls: this.forCls, 
        data$: this.propName$
      });
    }
  ]

});
