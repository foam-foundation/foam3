/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * FOAM State Machine (FSM) Implementation
 *
 * Extends FOAM Enums to provide state machines with:
 * - Defined transitions between states
 * - Guards (predicates) for conditional transitions
 * - Permission checks for authorization
 * - Lifecycle callbacks (onEnter, onExit, onTransition)
 * - Scheduled activities for polling/deadlines
 * - Automatic history tracking
 */


// =============================================================================
// StateTransition - Record of a state transition for history tracking
// =============================================================================

// =============================================================================
// StateMachineModel - Model for defining state machines via foam.FSM()
// =============================================================================

foam.CLASS({
  package: 'foam.lang',
  name: 'StateMachineModel',
  extends: 'foam.lang.EnumModel',

  documentation: 'Model for defining state machines. Use foam.FSM() or foam.StateMachine().',

  properties: [
    [ 'extends', 'foam.lang.StateMachineEnum' ]
  ]
});


// =============================================================================
// foam.FSM() and foam.StateMachine() shortcuts
// =============================================================================

foam.LIB({
  name: 'foam',

  methods: [
    function FSM(m) {
      m.class = m.class || 'foam.lang.StateMachineModel';
      return foam.CLASS(m);
    },

    function StateMachine(m) {
      return foam.FSM(m);
    }
  ]
});


// =============================================================================
// StateMachine Property - Adds convenience methods to the model
// =============================================================================

foam.CLASS({
  package: 'foam.lang',
  name: 'StateMachine',
  extends: 'foam.lang.Enum',

  documentation: `
    A property type for state machine enums.
    Automatically generates convenience methods on the model:
    - transition{Name}To(target, opt_note) - execute transition (async)
    - canTransition{Name}To(target) - check if transition allowed (async)
    - getAvailable{Name}Transitions() - get available transitions (async)

    Also generates:
    - {name}History property (FObjectArray of StateTransition)
    - {name}NextActivity property (DateTime for CRON scheduling)
  `,

  properties: [
    {
      name: 'of',
      required: true
    },
    {
      class: 'Boolean',
      name: 'enablePayload',
      value: true,
      documentation: 'If true, auto-generates a {name}Payload property.'
    },
    {
      class: 'Boolean',
      name: 'enableHistory',
      value: true,
      documentation: 'If true, auto-generates a {name}History property.'
    }
  ],

  methods: [
    function installInClass(cls) {
      this.SUPER(cls);

      var name = this.name;
      var Name = foam.String.capitalize(name);

      let copyFromOverride = (prop) => {
        let override = cls.model_.properties.filter(v => v.name == prop.name)?.[0]
        if ( override ) {
          override = override.instance_;
          delete override['source'];
          prop.copyFrom(override);
        }
        return prop
      }

      if ( this.enableHistory ) {
        var historyProp = foam.lang.FObjectArray.create({
          name: name + 'History',
          of: 'foam.lang.StateTransition',
          hidden: true,
          documentation: `Transition history for ${name} state machine.`
        });
        historyProp = copyFromOverride(historyProp);
        cls.installAxiom(historyProp);
      }

      if ( this.enablePayload ) {
        var payloadProp = foam.lang.FObjectProperty.create({
          name: name + 'Payload',
          hidden: true,
          documentation: `Payload for ${name} state machine.`,
          factory: function() {
            return this[name].createPayload();
          },
          javaFactory: `
            ${this.of.id} value = (${this.of.id}) this.getProperty("${name}");
            if ( value != null ) {
              foam.lang.X x = foam.lang.XLocator.get();
              return value.createPayload(x); 
            }
            return null;
          `
        });
        payloadProp = copyFromOverride(payloadProp);
        cls.installAxiom(payloadProp);
      }

      var nextActivityProp = foam.lang.DateTime.create({
        name: name + 'NextActivity',
        hidden: true,
        documentation: `Next scheduled activity time for ${name} state machine. Used by CRON job.`
      });
      nextActivityProp = copyFromOverride(nextActivityProp);
      cls.installAxiom(nextActivityProp);
    },

    function installInProto(proto) {
      this.SUPER(proto);

      var prop = this;
      var name = this.name;
      var Name = foam.String.capitalize(name);

      Object.defineProperty(proto, 'transition' + Name + 'To', {
        value: async function(target, opt_note) {
          var currentState = this[name];
          this[name] = await currentState.executeTransitionTo(target, this, opt_note);
          return this;
        },
        configurable: true,
        writable: true
      });

      Object.defineProperty(proto, 'canTransition' + Name + 'To', {
        value: async function(target) {
          return this[name].canTransitionTo(target, this);
        },
        configurable: true,
        writable: true
      });

      Object.defineProperty(proto, 'getAvailable' + Name + 'Transitions', {
        value: async function() {
          return this[name].getAvailableTransitions(this);
        },
        configurable: true,
        writable: true
      });

      Object.defineProperty(proto, 'assert' + Name + 'CanTransitionTo', {
        value: async function(target) {
          return this[name].assertCanTransitionTo(target, this);
        },
        configurable: true,
        writable: true
      });
    }
  ]
});
