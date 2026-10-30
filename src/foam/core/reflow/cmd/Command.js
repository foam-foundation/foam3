/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Command',

  implements: [ 'foam.core.auth.Authorizable' ],

  requires: [ 'foam.u2.Link' ],

  javaImports: [
    'foam.core.auth.AuthService',
    'foam.core.auth.AuthorizationException'
  ],

  // TODO: I think currentBlock is no longer needed. Test and remove if it isn't.
  imports: [ 'addValue?', 'block?', 'currentBlock?', 'log?', 'out?', 'eval_?' ],

  tableColumns: [ 'id', 'description' /*, 'execute_' */ ],

  properties: [
    { class: 'String',  name: 'id' },
    { class: 'String',  name: 'description' },
    { class: 'String',  name: 'icon', value: 'rectangle' },
    { class: 'Code',    name: 'script' },
    { class: 'Boolean', name: 'linkable', value: true },
    { class: 'Boolean', name: 'permissionRequired' },
    { class: 'Boolean', name: 'hidden', value: false },
    {
      class: 'String',
      name: 'parserClass',
      documentation: 'Optional Grammar class id used to autocomplete this command\'s argument (e.g. DAOTargetParser for a DAO name).'
    },
    {
      name: 'parser',
      transient: true,
      documentation: 'Argument parser for autocomplete. Subclasses may override with a factory; jrl commands set parserClass instead.',
      factory: function() {
        if ( ! this.parserClass ) return null;
        var cls = foam.maybeLookup(this.parserClass);
        return cls ? cls.create(null, this) : null;
      }
    }
  ],

  methods: [
    function onLoad() {
      return Promise.resolve();
    },

    async function execute(...args) {
      with ( this ) {
        with ( { args: args, addValue: this.addValue.bind(this) } ) {
          try {
            // Use arrow function to preserve this binding and with context
            var result = await eval('(async () => { ' + this.script + ' })()');
            return result;
          } catch (x) {
            console.log('Error:', x, 'in:', this.script);
            throw x; // Re-throw to propagate the error
          }
        }
      }
    },
    {
      name: 'authorizeOnCreate',
      args: 'Context x',
      javaThrows: ['AuthorizationException'],
      javaCode: `
        // nop - open to write
      `
    },
    {
      name: 'authorizeOnRead',
      args: 'Context x',
      javaThrows: ['AuthorizationException'],
      javaCode: `
        if ( getPermissionRequired() ) {
          AuthService auth = (AuthService) x.get("auth");
          if ( ! auth.check(x, "command.read." + getId()) ) {
            throw new AuthorizationException();
          }
        }
      `
    },
    {
      name: 'authorizeOnUpdate',
      args: 'Context x',
      javaThrows: ['AuthorizationException'],
      javaCode: `
        AuthService auth = (AuthService) x.get("auth");
        if ( ! auth.check(x, "command.update." + getId()) ) {
          throw new AuthorizationException();
        }
      `
    },
    {
      name: 'authorizeOnDelete',
      args: 'Context x',
      javaThrows: ['AuthorizationException'],
      javaCode: `
        AuthService auth = (AuthService) x.get("auth");
        if ( ! auth.check(x, "command.remove." + getId()) ) {
          throw new AuthorizationException();
        }
      `
    }
  ],

  actions: [
    {
      name: 'execute_',
      label: 'execute',
      isAvailable: function() { return this.linkable; },
      code: async function() { await this.execute(); }
    }
  ]
});
