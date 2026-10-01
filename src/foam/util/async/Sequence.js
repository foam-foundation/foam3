/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.util.async',
  name: 'Sequence',
  extends: 'foam.lang.Fluent',

  documentation: `
    Sequence creates and executes ContextAgents in the order specified, passing
    each ContextAgent's export context to the subsequent ContextAgent.
    If method execute() of the ContextAgent returns a context explicitly, then
    this will be used instead of the export context.
  `,

  implements: [
    'foam.lang.ContextAgent',
    'foam.mlang.Expressions'
  ],

  requires: [
    'foam.lang.ContextAgent',
    'foam.lang.NullAgent'
  ],

  exports: [
    'as sequence'
  ],

  properties: [
    {
      name: 'contextAgentSpecs',
      class: 'FObjectArray',
      of: 'FObject'
    },
    {
      class: 'FObjectProperty',
      name: 'errorAgent'
    },
    {
      name: 'halted_',
      class: 'Boolean'
    },
    {
      name: 'paused_',
      class: 'Boolean'
    },
    {
      class: 'Int',
      name: 'insertPosition_'
    },
    {
      class: 'Duration',
      name: 'timeout',
      documentation: `amount of time before a warning is displayed for an unresolved promise`,
      value: 1000
    }
  ],

  methods: [
    // Sequence DSL

    function tag(spec, args) {
      if ( ! spec ) {
        throw new Error(
          'Undefined argument in call to .tag: ' +
          foam.json.stringify({
            flow: this.cls_.name,
            after: this.contextAgentSpecs.length > 0
              ? this.contextAgentSpecs[this.contextAgentSpecs.length - 1]
              : null
          })
        );
      }
      const name = spec.getImpliedId?.(args) || foam.uuid.randomGUID();
      return this.addAs(name, spec, args);
    },

    function add(spec, args) {
      return this.addAs(spec.name, spec, args);
    },

    function start (spec, args) {
      const ins = spec.create(args, this.__subContext__);
      ins.parent = this;
      return ins;
    },

    function addAs(name, spec, args) {
      this.contextAgentSpecs$push(this.Step.create({
        name: name || spec.class?.split('.').slice(-1)[0],
        spec: spec,
        args: args
      }));
      return this;
    },
    function addBefore(name, spec, args) {
      for ( var i = 0; i < this.contextAgentSpecs.length; i++ ){
        let ca = this.contextAgentSpecs[i];
        if ( name == ca.name ) {
          break;
        }
      }

      var firstHalf = this.contextAgentSpecs.slice(0, i);
      var secondHalf = this.contextAgentSpecs.slice(i);

      this.contextAgentSpecs = [
        ...firstHalf,
        this.Step.create({
          name: spec.name || spec.class?.split('.').slice(-1)[0],
          spec: spec,
          args: args
        }),
        ...secondHalf
      ]

      return this;
    },

    function addAfter(name, spec, args) {
      for ( var i = 0; i < this.contextAgentSpecs.length; i++ ){
        let ca = this.contextAgentSpecs[i];
        if ( name == ca.name ) {
          break;
        }
      }

      var firstHalf = this.contextAgentSpecs.slice(0, i + 1);
      var secondHalf = this.contextAgentSpecs.slice(i + 1);

      this.contextAgentSpecs = [
        ...firstHalf,
        this.Step.create({
          name: spec.name,
          spec: spec,
          args: args
        }),
        ...secondHalf
      ]

      return this;
    },

    function reconfigure(name, args) {
      for ( let ca of this.contextAgentSpecs ) {
        if ( name == ca.name ) {
          ca.args = { ...ca.args, ...args };
          break;
        }
      }
      return this;
    },
    function contains(name) {
      for ( let ca of this.contextAgentSpecs ) {
        if ( name == ca.name && ca.spec !== this.NullAgent ) {
          return true;
        }
      }
      return false;
    },
    function get(name) {
      for ( let ca of this.contextAgentSpecs ) {
        if ( name == ca.name ) {
          return ca;
        }
      }
    },
    function remove(name) {
      this.contextAgentSpecs$replace(this.EQ(
        this.Step.NAME, name
      ), this.Step.create({
        name: name,
        spec: this.NullAgent
      }));
      return this;
    },

    // Launching a sequence

    async function execute() {
      let i = 0;
      let nextStep = async x => {
        if ( i >= this.contextAgentSpecs.length ) return x;
        await this.waitForUnpause();
        if ( this.halted_ ) return x;
        let seqspec = this.contextAgentSpecs[i++];
        let contextAgent;
        var spec = seqspec.spec;
        var args = seqspec.args;
        var argumentX = undefined;
        // Note: logic copied from ViewSpec; maybe this should be in stdlib
        if ( this.ContextAgent.isInstance(spec) ) {
          argumentX = x;
          contextAgent = spec.copyFrom(args);
        } else if ( spec.create ) {
          contextAgent = spec.create(args, x);
        } else {
          var cls = foam.lang.FObject.isSubClass(spec.class)
            ? spec.class : this.__subContext__.lookup(spec.class);
          if ( ! cls ) foam.assert(false,
            'Argument to Sequence.add specifies unknown class: ', spec.class);
          contextAgent = cls.create(spec, x).copyFrom(args || {});
        }

        // Setup a timeout to warn about unresolved promises
        const stepResolvedTimeout = setTimeout(() => {
          console.warn(
            `context agent still pending after ${this.timeout}ms; ` +
            `open the object for helpful details.`,
            seqspec
          );
        }, this.timeout)

        // Call the context agent and pass its exports to the next one
        let newX;
        try {
          this.insertPosition_ = i;
          newX = await contextAgent.execute(argumentX);
          if ( ! (newX || contextAgent.__subContext__).sequence ) {
            console.error('sequence is missing from export context', contextAgent)
          }
        } catch (e) {
          console.error(`sequence:`, seqspec, e);
          this.paused_ = true;
          if ( this.errorAgent ) {
            newX = await this.errorAgent.execute(x.createSubContext({
              exception: e
            }));
          }
        }
        if ( argumentX && ! newX ) {
          console.error(
            '%cA ContextAgent in a Sequence is misbehaving%c\n%s',
            'font-size:2rem', '',
            'A ContextAgent was already instantiated when passed to the sequence, so it was passed an explicit context. However, it did not return a context even though its export context is not valid for this scenario',
            contextAgent
          );
        }
        clearTimeout(stepResolvedTimeout);
        return await nextStep(newX || contextAgent.__subContext__);
      };
      return await nextStep(this.__subContext__)
    },

    // Sequence runtime commands

    function endSequence() {
      this.halted_ = true;
      this.paused_ = false;
    },

    function waitForUnpause() {
      if ( ! this.paused_ ) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const detachable = foam.lang.FObject.create();
        detachable.onDetach(this.paused_$.sub(() => {
          if ( ! this.paused_ ) {
            detachable.detach();
            resolve();
          }
        }));
      });
    },
    function describe() {
      let map = this.contextAgentSpecs.map(v => {
        let spec = v.spec;
        let args = v.args;
        if ( this.ContextAgent.isInstance(spec) ) {
          spec = spec.cls_.name;
        } else if ( spec.create ) {
          spec = spec.name;
        } else {
          var cls = foam.lang.FObject.isSubClass(spec.class)
            ? spec.class : this.__subContext__.lookup(spec.class);
          spec = cls.name;
        }
        return {name: v.name, class: spec, args: args};
      })
      console.table(map);
    }
  ],

  classes: [
    {
      name: 'Step',
      properties: [
        { name: 'name', class: 'String' },
        { name: 'spec', class: 'Class' },
        { name: 'args', class: 'Object' }
      ],
    }
  ]
});
