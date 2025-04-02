/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.layout',
  name: 'SectionAxiom',

  properties: [
    {
      class: 'String',
      name: 'name'
    },
    {
      name: 'title',
      expression: function(name) {
        if ( name === '_defaultSection' ) return '';
        return foam.String.labelize(name);
      }
    },
    {
      name: 'subTitle'
    },
    {
      name: 'navTitle'
    },
    {
      name: 'properties'
    },
    {
      name: 'actions'
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'view',
      value: { class: 'foam.u2.detail.SectionView' }
    },
    {
      name: 'help'
    },
    {
      class: 'Int',
      name: 'order',
      value: Number.MAX_SAFE_INTEGER
    },
    {
      class: 'Boolean',
      name: 'permissionRequired'
    },
    {
      name: 'gridColumns'
    },
    {
      class: 'Function',
      name: 'isAvailable',
      value: function() { return true; }
    },
    {
      class: 'String',
      name: 'section',
      getter: function() { return this.section_ ; },
      setter: function(m) { this.section_ = m; }
    },
    {
      class: 'Simple',
      name: 'section_'
    }
  ],

  methods: [
    function createIsAvailableFor(data$, controllerMode$) {
      var self = this;
      var slot = foam.lang.ProxyExpressionSlot.create({
        obj$: data$,
        code: this.isAvailable
      });
      var availabilitySlots = [slot];

      // Conditionally, add permission check, (permSlot)
      if ( this.permissionRequired ) {
        var permSlot = foam.lang.SimpleSlot.create({value: false}, this);
        var update = function() {
          var data = data$.get();
          if ( data && data.__subContext__.auth ) {
            data.__subContext__.auth.check(null,
              `${data.cls_.id.toLowerCase()}.section.${self.name}`).then((hasAuth) => {
                permSlot.set(hasAuth);
              });
          }
        };
        update();
        data$.sub(update);
        availabilitySlots.push(permSlot);
      }

      // Add check for at least one visible property (propVisSlot)
      let atLeastOnePropertyOrActionAvailableSlot = foam.lang.SimpleSlot.create({ value: false }, this);
      var updatePropAndActionSlot = function() {
        let data = data$.get();
        if ( ! data ) return;
        let props;
        if ( self.hasOwnProperty('properties') ) {
          props = self.properties.map(p => {
            if ( foam.String.isInstance(p) ) return data.cls_.getAxiomByName(p);
            // TODO: allow string only path props
            if ( p.name ) {
              if ( p.name.indexOf('.') != -1 ) {
                let p2 = Object.assign({}, p);
                delete p2.name;
                return foam.layout.PathPropertyHolder.create({ name: p.name.split('.').pop(), value: p.name, config: p2 });
              }
              return data.cls_.getAxiomByName(p.name).clone().copyFrom(p);
            }
          });
        } else {
          props = data.cls_.getAxiomsByClass(foam.lang.Property)
            .filter(p => p.section === self.name);
        }
        let propVisSlot = foam.lang.ArraySlot.create({
          slots: props.map(
            p => p.createVisibilityFor(data$,
              controllerMode$ ||
              data.__subContext__.controllerMode$ ||
              (data.__subContext__.ctrl && data.__subContext__.ctrl.controllerMode$) ||
              foam.lang.ConstantSlot.create({value: foam.u2.ControllerMode.CREATE})
            )
          )
        }).map(arr => arr.some(m => {
          return m != foam.u2.DisplayMode.HIDDEN;
        }));

        let actions;
        // add check for at least one available action as well (actionAvailSlot)
        if ( self.hasOwnProperty('actions') ) {
          actions = self.actions.map(a => {
            return data.cls_.getAxiomByName(a);
          });
        } else {
          actions = data.cls_.getAxiomsByClass(foam.lang.Action)
            .filter(a => a.section === self.name);
        }

        var actionAvailSlot = foam.lang.ArraySlot.create({
          slots: actions.map(
            a => a.createIsAvailable$(data.__subContext__, data)
          )
        }).map(arr => arr.some(isAvailable => {
          return isAvailable;
        }));

        atLeastOnePropertyOrActionAvailableSlot.follow(foam.lang.ArraySlot.create({
          slots: [
            propVisSlot,
            actionAvailSlot
          ]
        }).map(arr => arr.some(isVisibleOrAvailable => {
          return isVisibleOrAvailable;
        })));
      };
      updatePropAndActionSlot();
      data$.sub(updatePropAndActionSlot);
      availabilitySlots.push(atLeastOnePropertyOrActionAvailableSlot);

      var simpleSlot = foam.lang.SimpleSlot.create();
      var arrSlot = foam.lang.ArraySlot.create({slots: availabilitySlots}).map(arr => {
        var ret =  arr.every(b => b);
        if ( ret != simpleSlot.get() ) simpleSlot.set(ret); 
        return ret;
      });
      arrSlot.get();
      arrSlot.sub(function(){ arrSlot.get(); });
      return simpleSlot;
    },

    function installInClass(cls) {
      cls['SECTION_'+foam.String.constantize(this.name)] = this;
    }
  ]
});


foam.CLASS({
  package: 'foam.layout',
  name: 'PropertySectionRefine',
  refines: 'foam.lang.Property',

  properties: [
    {
      class: 'String',
      name: 'section',
      value: '_defaultSection'
    }
  ]
});


foam.CLASS({
  package: 'foam.layout',
  name: 'ActionSectionRefine',
  refines: 'foam.lang.Action',

  properties: [
    {
      class: 'String',
      name: 'section',
      value: '_defaultSection'
    }
  ]
});

foam.CLASS({
  package: 'foam.layout',
  name: 'ModelSectionRefine',
  refines: 'foam.lang.Model',

  properties: [
    {
      class: 'AxiomArray',
      of: 'foam.layout.SectionAxiom',
      name: 'sections'
    }
  ]
});
