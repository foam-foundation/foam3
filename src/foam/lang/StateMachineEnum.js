/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang',
  name: 'StateMachineEnum',
  extends: 'foam.lang.AbstractEnum',

  properties: [
    {
      class: 'StringArray',
      name: 'transitions',
      documentation: 'Names of enum values this state can transition to.'
    },
    {
      class: 'Boolean',
      name: 'isTerminal',
      documentation: 'True if this is an end state with no valid transitions.',
      expression: function(transitions) {
        return transitions.length === 0;
      }
    },
    {
      class: 'Boolean',
      name: 'isInitial',
      value: false,
      documentation: 'True if this state can be used as an initial state.'
    },
    {
      name: 'guards',
      documentation: `
        Map of target state name -> guard function(x, obj).
        Guard returns 'reason' (or Promise<reason>) that is blocking a transition.
        If no guard defined for a transition, it's always allowed.
      `,
      factory: function() { return {}; }
    },
    {
      class: 'Map',
      name: 'permissions',
      documentation: `
        Map of target state name -> permission string (or array of strings).
        User must have the permission to execute the transition.
        If no permission defined for a transition, no permission check is performed.
      `,
      factory: function() { return {}; }
    },
    /*
    {
      name: 'onEnter',
      documentation: 'Action called when entering this state: function(x, obj, fromState). May be async.',
      value: null
    },
    {
      name: 'onExit',
      documentation: 'Action called when exiting this state: function(x, obj, toState). May be async.',
      value: null
    },
    {
      name: 'onTransition',
      documentation: `
        Map of target state name -> action function(x, obj, targetState).
        Called after exit but before enter when transitioning to specific state.
        May be async.
      `,
      factory: function() { return {}; }
    },
      */
    {
      class: 'Long',
      name: 'scheduledTime',
      documentation: `
        Duration in milliseconds until the scheduled activity runs.
        When elapsed, scheduledActivity(x, obj) is called.
        Common uses: polling external services, sending reminders,
        checking deadlines, updating derived data.
        A value of 0 (default) means no scheduled activity.
      `,
      value: 0
    },
    {
      class: 'String',
      name: 'payloadModel',
      transient: true,
      asJavaValue: function() { return '/*foo*/'; },
      adapt: function(o, n) {
        if ( ! foam.String.isInstance(n) ) {
          foam.CLASS({
            package: this.model_.package,
            name: this.model_.name + '$' + this.name,
            flags: ['java' /* otherwise will default to 'js' and won't be compiled to java */ ],
            ...n
          });
          n = this.cls_.id + '$' + this.name;
        }
        return n;
      }
    },
    {
      class: 'Boolean',
      name: 'isWizardStep',
      transient: true,
      value: true,
      documentation: 'Whether this state should appear as a wizard step'
    }
    /*
    {
      name: 'scheduledActivity',
      documentation: `
        Called when scheduledTime elapses: function(x, obj).
        May be async. Can perform any action: poll services, send notifications,
        check conditions, update data, or transition to a new state.
        After completion, the activity is rescheduled automatically
        (unless a state transition occurred).
      `,
      value: null
      }
      */
  ],

  methods: [
    /*
      javaCode: `
      public void checkGuard(X x, FObject obj, StateMachineEnum n)
        throws foam.lang.ValidationException
      {

      }

      public void onEnter(X x, FObject obj, StateMachineEnum o) {

      }

      public void onTransition(X x, FObject obj, StateMachineEnum n) {

      }

      public void onExit(X x, FObject obj, StateMachineEnum n) {

      }

      public void scheduledActivity(X x, FObject obj) {

      }

      `
    */
    { type: 'void',    args: 'Context x, FObject obj, StateMachineEnum n', name: 'checkGuard',        javaCode: '/* NOP */' },
    { type: 'Void',    args: 'Context x, FObject obj, StateMachineEnum o', name: 'onEnter',           javaCode: '/* NOP */' },
    { type: 'Void',    args: 'Context x, FObject obj, StateMachineEnum n', name: 'onTransition',      javaCode: '/* NOP */' },
    { type: 'Void',    args: 'Context x, FObject obj, StateMachineEnum n', name: 'onExit',            javaCode: '/* NOP */' },
    { type: 'Void',    args: 'Context x, FObject obj',                     name: 'scheduledActivity', javaCode: '/* NOP */' },
    { 
      type: 'foam.lang.StateMachineEnum',
      args: 'Context x, FObject obj, FObject payload',
      name: 'onUpdate',
      javaCode: 'return this;' 
    },

    function createPayload() {
      if ( ! this.payloadModel ) return null;
      let cls = this.__context__.maybeLookup(this.payloadModel);
      if ( ! cls ) return null;
      return cls.create({}, this.__context__);
    },

    async function checkPermission_(x, obj, targetName) {
      var perm = this.permissions[targetName];
      if ( ! perm ) return true;

      var auth = x.auth;
      if ( ! auth ) {
        console.warn('No auth service in context, skipping permission check');
        return true;
      }

      var perms = Array.isArray(perm) ? perm : [perm];

      for ( var p of perms ) {
        if ( await auth.check(x, p) ) return true;
      }

      return false;
    },

    async function canTransitionTo(target, obj) {
      var targetName = this.getTargetName_(target);
      var x = obj ? obj.__subContext__ : foam.__context__;

      if ( ! this.transitions.includes(targetName) ) return false;

      if ( ! await this.checkPermission_(x, obj, targetName) ) return false;

      var guard = this.guards[targetName];
      if ( guard ) {
        var reason = guard.call(this, x, obj);
        if ( reason instanceof Promise ) reason = await reason;
        if ( reason ) return false;
      }

      return true;
    },

    async function getAvailableTransitions(obj) {
      var available = [];

      for ( var name of this.transitions ) {
        if ( await this.canTransitionTo(name, obj) ) {
          var state = this.cls_[name];
          if ( state ) available.push(state);
        }
      }

      return available;
    },

    async function assertCanTransitionTo(target, obj) {
      var targetName = this.getTargetName_(target);
      var x = obj ? obj.__subContext__ : foam.__context__;

      if ( ! this.transitions.includes(targetName) ) {
        throw new Error(
          `Invalid state transition: ${this.name} -> ${targetName}. ` +
          `Allowed transitions: [${this.transitions.join(', ')}]`
        );
      }

      if ( ! await this.checkPermission_(x, obj, targetName) ) {
        var perm = this.permissions[targetName];
        throw new Error(
          `Permission denied for transition: ${this.name} -> ${targetName}. ` +
          `Required permission: ${Array.isArray(perm) ? perm.join(' or ') : perm}`
        );
      }

      var guard = this.guards[targetName];
      if ( guard ) {
        var reason = guard.call(this, x, obj);
        if ( reason instanceof Promise ) reason = await reason;
        if ( reason ) {
          console.warn(
            `Transition guard failed: ${this.name} -> ${targetName}. ` +
            `Object does not satisfy guard conditions.`
          );
          throw new Error(reason);
        }
      }

      return true;
    },

    async function executeTransitionTo(target, obj, opt_note) {
      var targetName = this.getTargetName_(target);
      var targetState = this.cls_[targetName];
      var x = obj ? obj.__subContext__ : foam.__context__;

      await this.assertCanTransitionTo(target, obj);

      if ( this.onExit ) {
        var result = this.onExit.call(this, x, obj, targetState);
        if ( result instanceof Promise ) await result;
      }

      var transitionAction = this.onTransition?.[targetName];
      if ( transitionAction ) {
        var result = transitionAction.call(this, x, obj, targetState);
        if ( result instanceof Promise ) await result;
      }

      this.recordTransition_(x, obj, targetState, opt_note);

      if ( targetState.onEnter ) {
        var result = targetState.onEnter.call(targetState, x, obj, this);
        if ( result instanceof Promise ) await result;
      }

      targetState.updateNextActivity_(obj);

      return targetState;
    },

    function updateNextActivity_(obj) {
      var nextActivityProp = this.findNextActivityProp_(obj);
      if ( ! nextActivityProp ) return;

      if ( this.scheduledTime && this.scheduledTime > 0 && this.scheduledActivity ) {
        obj[nextActivityProp] = new Date(Date.now() + this.scheduledTime);
      } else {
        obj[nextActivityProp] = null;
      }
    },

    function findNextActivityProp_(obj) {
      var cls = obj.cls_;
      if ( ! cls ) return null;

      var props = cls.getAxiomsByClass(foam.lang.StateMachine);
      for ( var prop of props ) {
        var value = obj[prop.name];
        if ( value && value.cls_ === this.cls_ ) {
          return prop.name + 'NextActivity';
        }
      }
      return null;
    },

    async function runScheduledActivity(obj) {
      if ( ! this.scheduledActivity ) return;

      var x = obj.__subContext__ || foam.__context__;

      try {
        var result = this.scheduledActivity.call(this, x, obj);
        if ( result instanceof Promise ) await result;

        var currentState = this.getCurrentState_(obj);
        if ( currentState === this ) {
          this.updateNextActivity_(obj);
        }
      } catch (err) {
        console.error('State machine scheduled activity error:', err);
        this.updateNextActivity_(obj);
        throw err;
      }
    },

    function getCurrentState_(obj) {
      var cls = obj.cls_;
      if ( ! cls ) return null;

      var props = cls.getAxiomsByClass(foam.lang.StateMachine);
      for ( var prop of props ) {
        var value = obj[prop.name];
        if ( value && value.cls_ === this.cls_ ) {
          return value;
        }
      }
      return null;
    },

    function recordTransition_(x, obj, targetState, opt_note) {
      var historyPropName = null;
      var cls = obj.cls_;

      if ( cls ) {
        var props = cls.getAxiomsByClass(foam.lang.StateMachine);
        for ( var prop of props ) {
          if ( obj[prop.name] === this ) {
            historyPropName = prop.name + 'History';
            break;
          }
        }
      }

      if ( ! historyPropName || ! obj.hasOwnProperty(historyPropName) && ! cls?.getAxiomByName(historyPropName) ) {
        return;
      }

      var user = x.subject?.user;
      var transition = foam.lang.StateTransition.create({
        from: this.name,
        to: targetState.name,
        timestamp: new Date(),
        userId: user?.id || '',
        userName: user?.toSummary?.() || user?.label || '',
        note: opt_note || ''
      });

      var history = obj[historyPropName];
      if ( Array.isArray(history) ) {
        obj[historyPropName] = history.concat(transition);
      } else {
        obj[historyPropName] = [transition];
      }
    },

    function getTargetName_(target) {
      return foam.lang.StateMachineEnum.isInstance(target) ? target.name : target;
    }
  ],

  static: [
    function getInitialStates() {
      return this.VALUES.filter(v => v.isInitial);
    },

    function getTerminalStates() {
      return this.VALUES.filter(v => v.isTerminal);
    },

    function validateMachine() {
      var errors = [];
      var stateNames = this.VALUES.map(v => v.name);

      if ( this.getInitialStates().length === 0 ) {
        errors.push('No initial state defined. Mark at least one state with isInitial: true');
      }

      this.VALUES.forEach(state => {
        state.transitions.forEach(targetName => {
          if ( ! stateNames.includes(targetName) ) {
            errors.push(`State "${state.name}" references unknown transition target: "${targetName}"`);
          }
        });

        Object.keys(state.guards).forEach(guardTarget => {
          if ( ! state.transitions.includes(guardTarget) ) {
            errors.push(`State "${state.name}" has guard for "${guardTarget}" which is not in transitions`);
          }
        });

        Object.keys(state.permissions).forEach(permTarget => {
          if ( ! state.transitions.includes(permTarget) ) {
            errors.push(`State "${state.name}" has permission for "${permTarget}" which is not in transitions`);
          }
        });
      });

      if ( errors.length > 0 ) {
        throw new Error('State machine validation failed:\n  ' + errors.join('\n  '));
      }

      return true;
    }
  ]
});
