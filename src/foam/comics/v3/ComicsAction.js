/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.comics.v3',
  name: 'ComicsAction',
  extends: 'foam.lang.Action',
  documentation: `
    Creates a distinction for actions that are used by comics. Can be used to override default
    CRUD behaviour.

    ComicsAction adds internalIsEnabled and internalIsAvailable — the comics controller's own
    enable/available checks (mode + permission gating), evaluated alongside a model's
    isEnabled/isAvailable. Both default to false (fail closed): a ComicsAction is
    hidden/disabled unless it opts in with its own check.

    Any action property not overridden explicitly will be copied over from the default implementation.

    All action override functions are run in the context of the data obj so they can also be used outside comics if needed.

    A model overrides a comics action by declaring a ComicsAction with the same name. Which
    names are overridable, and their defaults, are defined by the consuming controllers
    (DAOView, DetailView, CreateView).

    -- How to configure actions --
    The following code changes the isEnabled and code from the default implementation for an imaginary model named 'Flight'.
    The action will now also check for a 'isCompleted' property before enabling edit
    and the edit action will instead launch a menu called editFlightInfo.
    {
      name: 'Flight',
      ....
      actions: [
        ...
        {
          class: 'foam.comics.v3.ComicsAction',
          name: 'edit',
          isEnabled: function(isCompleted) {
            return ! isCompleted;
          },
          code: function(X) {
            X.routeTo('editFlightInfo');
          }
        }
        ...
      ]
    }

    If you do not override the 'code' property then the original Comics action's logic
    will be called as normal. This just gives you a chance to override meta-data on
    the action like isEnabled, isAvailable, the label, etc. without chaning the underlying
    COMICS behaviour.

    However, if you do override the 'code' property, then your custom logic will be called
    instead and 'this' is your code will be the instance of the class where the ComicsAction
    is defined. For example, the Flight instance in the above example. This is only the case
    for actions called in the DetailView, which is all of them, except for the 'create' action.
    It wouldn't make sense for the create actions 'this' to be changed, because the instance
    hasn't yet been created at the time of creation.
  `,
  properties: [
    {
      name: 'code',
      required: false
    },
    {
      class: 'FObjectProperty',
      name: 'overrideCodeData',
      documentation: 'When set, the data obj for action call will be set to this value, useful for setting the right data when Models override default code implementation for CRUD operations. This is for internal use only and will be set to true if this Action defines its own "code" and isn\'t a create action.'
    },
    {
      class: 'Function',
      generateJava: false,
      name: 'internalIsEnabled',
      // Fail closed: disabled unless an action opts in with its own check.
      value: function() { return false; }
    },
    {
      class: 'Function',
      generateJava: false,
      name: 'internalIsAvailable',
      // Fail closed: hidden unless an action opts in with its own check.
      value: function() { return false; }
    }
  ],
  methods: [
    // Concat both isEnabled and interalIsEnabled checks
    function createIsEnabled$(x, data) {
      var running      = this.getRunning$(data);
      var internalSlot = this.createSlotFor_(x, data, this.internalIsEnabled, 'enabled');
      var slot         = data.data ? this.createSlotFor_(x, data.data, this.isEnabled, 'enabled') :
                         foam.lang.ConstantSlot.create({ value: false });
      return running.not().and(internalSlot).and(slot);
    },

    // Concat both isAvailable and interalIsAvailable checks
    function createIsAvailable$(x, data) {
      var internalSlot = this.createSlotFor_(x, data, this.internalIsAvailable, 'available');
      let slot         = data.data ? this.createSlotFor_(x, data.data, this.isAvailable, 'available') :
                         foam.lang.ConstantSlot.create({ value: false });
      return internalSlot.and(slot);
    },

    function checkIsEnabledIsAvailable(data) {
      if ( ( this.internalIsAvailable && ! foam.Function.withArgs(this.internalIsAvailable, data) ) ||
           ( this.isAvailable   && ! foam.Function.withArgs(this.isAvailable, data.data) ) ||
           ( this.internalIsEnabled   && ! foam.Function.withArgs(this.internalIsEnabled, data) ) ||
           ( this.isEnabled   && ! foam.Function.withArgs(this.isEnabled, data.data) ) )
      return true;
    },

    function call(x, data) {
      if ( this.overrideCodeData ) {
        data = this.overrideCodeData;
      }
      return this.SUPER(x, data);
    },

    function toE(args, X) {
      var view = foam.u2.ViewSpec.createView(this.view, {
        ...(args || {}),
        action: this
      }, this, X);

      if ( X.data$ && ! ( args && ( args.data || args.data$ ) ) ) {
        view.data$ = X.data$;
      }

      return view;
    }
  ]
});
