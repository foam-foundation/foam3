/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.function',
  name: 'Function',
  extends: 'foam.core.reflow.Script',

  implements: [ 'foam.lang.Holder' ],

  imports: [ 'refreshFlowScope?' ],

  documentation: `
    A Script whose return value becomes the value of its Block.

    Console.refreshFlowScope() unwraps a Holder, so a Function block named
    feeSummary binds the returned value itself as feeSummary: any other block's
    command, script or expression reads it the way it reads dao1.filteredDAO.
    That makes the hand-off a named reference, which Console.updateDependencies()
    and the loader can both see; a value passed through globalThis is invisible
    to either.
  `,

  constants: [
    {
      type: 'String',
      name: 'TEMPLATE',
      value: `// Runs when the flow loads.
// Whatever this returns is read by other blocks under this block's name,
// so name the block after the value rather than after the work.
return null;
`
    }
  ],

  properties: [
    {
      name: 'code',
      factory: function() { return this.TEMPLATE; },
      validateObj: function(code) {
        // Comments come out first, so the word return inside one doesn't count.
        var body = code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
        if ( ! /\breturn\b/.test(body) )
          return 'A function has to return something: the returned value is what other blocks read under this block\'s name. Use a script block for code that only has side effects.';
      }
    },
    {
      name: 'value',
      transient: true,
      hidden: true,
      documentation: 'The value returned by the last run of the code.'
    }
  ],

  methods: [
    async function run_() {
      // SUPER() must be called before the first await: the superWrapper
      // restores this.SUPER in a finally, which runs as soon as this
      // function suspends.
      var ret = this.SUPER();

      this.value = await ret;

      // The scope was bound when the Block was added, which happens before the
      // code runs, and only block.value is watched - nothing else would bind
      // the value the code just returned.
      this.refreshFlowScope && this.refreshFlowScope();

      return this.value;
    },

    function logResult(v) {
      // A Function usually returns a DAO or a large array, whose raw string
      // would sit in output for as long as the flow is loaded.
      this.log(this.describe_(v));

      if ( v === undefined )
        this.log('Nothing was returned, so other blocks reading this one read undefined.');
    },

    function describe_(v) {
      if ( Array.isArray(v) )                 return 'Array(' + v.length + ')';
      if ( foam.lang.FObject.isInstance(v) )  return v.cls_.id;
      return String(v);
    }
  ]
});
