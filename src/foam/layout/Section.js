/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.layout',
  name: 'Section',

  documentation: `
    Provides model data sectioned viewing when using section views.
    Used for sectioning/grouping model properties and actions.

    Section title and subtitle functions have a helper method (1st arg)
    to evaluate messages or values that are template literals.

    Template literal messages should be considered over constructing strings
    within these functions. Locale translation support will have an easier time
    understanding and applying the appropriate translations.

    These functions are also executed when model data changes,
    supporting dynamic section labeling and data awareness.

    Example:
    foam.CLASS({
      name: 'myModel',
      messages: [
        { name: 'myMessage', message: 'This message will evaluate a template literal \${myProp}' }
      ],
      sections: [
        {
          name: 'mainSection'
          title: function(evaluateMessage, data) {
            return data.myProp ? evaluateMessage(data.myMessage) : 'Set this title if myProp false';
          }
          isAvailable: function(myProp) {
            return ! myProp;
          }
        }
      ],
      properties: [
        {
          class: 'Boolean',
          name: 'myProp',
          section: 'mainSection'
        }
      ]
    });

    Displaying this model in foam.u2.detail.SectionView will section properties and display
    the sections title, subtitle, and help. Sections are capable of being available based on instance data
    and support dynamic titles and subtitles.
  `,

  requires: [
    'foam.lang.Action',
    'foam.lang.Property',
    'foam.layout.PathPropertyHolder',
    'foam.layout.SectionAxiom'
  ],

  properties: [
    {
      name: 'name'
    },
    {
      // Accepts function and string
      name: 'title'
    },
    {
      // Accepts function and string
      name: 'subTitle'
    },
    {
      name: 'navTitle',
      expression: function (title) {
        return title;
      }
    },
    {
      documentation: 'function and string',
      name: 'help'
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'view',
      value: { class: 'foam.u2.detail.SectionView' }
    },
    {
      class: 'FObjectArray',
      of: 'foam.lang.Property',
      name: 'properties'
    },
    {
      class: 'FObjectArray',
      of: 'foam.lang.Action',
      name: 'actions'
    },
    {
      name: 'gridColumns'
    },
    {
      class: 'Function',
      name: 'createIsAvailableFor',
      value: function(data$) {
        return foam.lang.ConstantSlot.create({value: true});
      }
    },
    {
      class: 'String',
      name: 'fromClass',
      documentation: 'The class name to which the section belongs to.'
    },
    {
      class: 'Boolean',
      name: 'collapsable'
    }
  ],

  methods: [
    function createErrorSlotFor(data$) {
      var errorSlots = data$.map(d => {
        return foam.lang.ArraySlot.create({
          slots: this.properties
            .filter(p => p.validateObj)
            .map(p => d.slot(p.validateObj))
        });
      });

      var retSlot = foam.lang.ProxySlot.create({ delegate: errorSlots.get() });
      this.onDetach(errorSlots.sub(slot => {
        retSlot.delegate = slot;
      }));

      return retSlot;
    },

    function fromSectionAxiom(a, cls) {
      // If a isnt already a section axiom, make it one
      if ( ! this.SectionAxiom.isInstance(a) ) {
        a = this.SectionAxiom.create(a);
        
      }
      this.copyFrom(a);
      this.copyFrom({
        createIsAvailableFor: a.createIsAvailableFor.bind(a),
        fromClass: a.sourceCls_?.name || cls.name,
        actions: cls.getAxiomsByClass(this.Action)
          .filter(action => action.section == a.name)
      });

      if ( a.hasOwnProperty('properties') ) {
        this.properties = a.properties.map(p => {
          if ( foam.String.isInstance(p) ) {
            if ( p.indexOf('.') == -1 )
              return cls.getAxiomByName(p);
            return this.PathPropertyHolder.create({ name: p.split('.').pop(), value: p });
          }
          if ( p.name?.indexOf('.') != -1 ) {
            let p2 = Object.assign({}, p);
            delete p2.name;
            return this.PathPropertyHolder.create({ name: p.name.split('.').pop(), value: p.name, config: p2 });
          }
          return cls.getAxiomByName(p.name).clone().copyFrom(p);
        }).sort(foam.lang.Property.ORDER.compare);
      } else {
        this.properties = cls.getAxiomsByClass(foam.lang.Property)
          .filter(p => p.section == a.name)
          .filter(p => ! p.hidden)
          .sort((p1, p2) => p1.order - p2.order);
      }

      return this;
    }
  ]
});
