/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.detail',
  name: 'AbstractSectionedDetailView',
  extends: 'foam.u2.View',
  flags: ['web'],

  documentation: `
    The abstract for property-sheet style Views with sections for editing an FObject.
  `,

  exports: [ 'data as objData', 'hideActions' ],

  requires: [
    'foam.lang.Action',
    'foam.lang.Property',
    'foam.layout.Section',
    'foam.layout.SectionAxiom'
  ],

  properties: [
    {
      class: 'Array',
      name: 'useSections',
      documentation: `List of sections to be used in section detail view. Set if you would like to
        filter section list, alternative to default behaviour where all sections of class and parent classes are used.`
    },
    {
      class: 'FObjectProperty',
      name: 'data',
      factory: function() {
        return this.hasOwnProperty('of') ? this.of.create(null, this) : null;
      },
      postSet: function(oldValue, newValue) {
        if ( newValue?.cls_ == oldValue?.cls_ ) return;
        this.of = newValue?.cls_ || undefined;
      }
    },
    {
      class: 'Class',
      name: 'of'
    },
    {
      class: 'Boolean',
      name: 'hideActions'
    },
    {
      class: 'FObjectArray',
      of: 'foam.lang.Property',
      name: 'propertyWhitelist',
      documentation: `
        If this array is not empty, only the properties listed in it will be
        included in the detail view.

        NOTE: Setting propertyWhitelist is almost like creating a transient section, thus the order property for all
        properties in this list is overriden to be in the order they appear in the array/object.
        If the order needs to be changed it can be overriden like any other property property but it would be in reference to
        this new order added to this whitelist.
      `,
      factory: null,
      adapt: function(o, newValue, p) {
        if ( Array.isArray(newValue) ) {
          let arr = foam.lang.FObjectArray.ADAPT.value.call(this, o, newValue, p);
          return arr.map((a, idx) => {
            return a.clone().copyFrom({ order: idx });
          });
        }
        if ( typeof newValue !== 'object' ) throw new Error('You must set propertyWhitelist to an array of properties or a map from names to overrides encoded as an object.');
        return Object.entries(newValue).reduce((acc, [propertyName, overrides], idx) => {
          var axiom = this.of.getAxiomByName(propertyName);
          if ( axiom ) acc.push(axiom.clone().copyFrom({ order: idx }).copyFrom(overrides));
          return acc;
        }, []);
      },
      preSet: function(_, ps) {
        foam.assert(ps, 'Properties required.');
        for ( var i = 0; i < ps.length; i++ ) {
          foam.assert(
            foam.lang.Property.isInstance(ps[i]),
            `Non-Property in 'properties' list:`,
            ps);
        }
        return ps;
      }
    },
    {
      class: 'FObjectArray',
      of: 'foam.layout.Section',
      name: 'sections',
      factory: null,
      adaptArrayElement: function(o, obj) {
        if ( ! obj.Section.isInstance(o) && o ) {
          foam.assert(obj.of, `${obj.cls_.name} needs of in order to create transient sections`);
          let axiom = obj.SectionAxiom.create(o);
          // temporarily install the section on this class so things like translations work
          obj.of.installAxiom(axiom);
          return obj.Section.create().fromSectionAxiom(axiom, obj.of);
        }
        return o;
      },
      expression: function(of, useSections, propertyWhitelist) {
        if ( ! of ) return [];

        sections = of.getAxiomsByClass(this.SectionAxiom)
        // Why not Section.AXIOM.ORDER on next line?
        .sort((a, b) => a.order - b.order)
        .reduce((map, a) => {
          if ( useSections.length ) {
            if ( useSections.includes(a.name) ) {
              map.push(this.Section.create().fromSectionAxiom(a, of));
            }
          } else {
            map.push(this.Section.create().fromSectionAxiom(a, of));
          }
          return map;
        }, []);

        var usedAxioms = sections
          .map((s) => s.properties.concat(s.actions))
          .flat()
          .reduce((map, a) => {
            map[a.name] = true;
            return map;
          }, {});

        if ( ! useSections.length ) {
          var unusedProperties = of.getAxiomsByClass(this.Property)
              .filter((p) => ! usedAxioms[p.name])
              .filter((p) => ! p.hidden)
              .sort((a, b) => a.order - b.order);
          var unusedActions = of.getAxiomsByClass(this.Action)
              .filter((a) => ! usedAxioms[a.name]);

          if ( unusedProperties.length || unusedActions.length ) {
            sections.push(this.Section.create({
              properties: unusedProperties,
              actions: unusedActions
            }));
          }
        }

        if ( propertyWhitelist ) {
          sections = sections
            .map(s => {
              s.properties = s.properties.reduce((acc, sectionProp) => {
                var prop = propertyWhitelist.find(whitelistProp => whitelistProp.name === sectionProp.name);
                if ( prop ) acc.push(prop);
                return acc;
              }, []).sort((a, b) => a.order - b.order);
              return s;
            })
            .filter(s => {
              return s.properties.length > 0 || ( ! this.hideActions && s.actions.length > 0 );
            });
        }

        // Filter out any sections where we know that there are no actions and
        // no visible properties. Note that this isn't a comprehensive check.
        // For example, the visibility value could be a function, which means
        // it could be hidden under certain conditions and visible otherwise.
        sections = sections.filter(s => {
          return ( ! this.hideActions && s.actions.length > 0 ) ||
            s.properties.some(p => {
              var visVal = this.controllerMode.getVisibilityValue(p);
              return visVal !== foam.u2.DisplayMode.HIDDEN && visVal !== 'HIDDEN';
            });
        });

        return sections;
      }
    }
  ],

  methods: [
    function fromProperty(p) {
      this.SUPER(p);

      if ( ! this.of && p.of ) this.of = p.of;
    }
  ]
});
