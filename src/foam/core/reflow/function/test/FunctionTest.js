/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.function.test',
  name: 'FunctionTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.core.reflow.function.Function',
    'foam.core.reflow.Script'
  ],

  methods: [
    async function runTest(x) {
      var refreshed = 0;
      var ctx = x.createSubContext({
        scope: {},
        data: null,
        refreshFlowScope: function() { refreshed++; }
      });

      // The awaited return value becomes the Function's value, which is what
      // Console.refreshFlowScope() binds under the block's name.
      var fn = this.Function.create({
        code: 'var v = await Promise.resolve(7); return v * 6;',
        autoRun: true
      }, ctx);

      await fn.onLoad();

      x.test(fn.value === 42, 'awaited return value is kept as the value (got ' + fn.value + ')');
      x.test(foam.lang.Holder.isInstance(fn), 'Function is a Holder, so refreshFlowScope binds the value itself');
      x.test(refreshed === 1, 'the scope is refreshed once the value exists (refreshed ' + refreshed + ' times)');
      x.test(this.Function.VALUE.transient, 'value is transient, so a computed result is never written into the flow script');

      // Running again from the editor re-captures and re-binds.
      fn.code = 'return "second";';
      await fn.run_();

      x.test(fn.value === 'second', 're-running captures the new value (got ' + fn.value + ')');
      x.test(refreshed === 2, 're-running refreshes the scope again (refreshed ' + refreshed + ' times)');

      // A large return is summarised in the output rather than stringified whole.
      var arrayFn = this.Function.create({ code: 'return [1, 2, 3];', autoRun: true }, ctx);
      await arrayFn.onLoad();

      x.test(arrayFn.value.length === 3, 'the array itself is the value');
      x.test(arrayFn.output.indexOf('Array(3)') != -1, 'the output logs a summary, not the whole array (got "' + arrayFn.output.trim() + '")');

      // A new block starts from the template, which does not run on its own.
      var blank = this.Function.create({}, ctx);

      x.test(blank.code.indexOf('return null;') != -1, 'a new block is seeded with the template');
      x.test(blank.autoRun === false, 'the template does not auto-run');
      x.test(blank.errors_ == null, 'the template itself validates');

      // Code that returns nothing is a Function used as a Script.
      x.test(this.Function.create({ code: 'var x = 1;' }, ctx).errors_ != null, 'code with no return fails validation');
      x.test(this.Script.create({ code: 'var x = 1;' }, ctx).errors_ == null, 'a Script with no return is still fine');

      // Code that runs but returns nothing says so, since a reader of this
      // block would silently get undefined.
      var undef = this.Function.create({ code: 'var x = 1; return;', autoRun: true }, ctx);
      await undef.onLoad();

      x.test(undef.output.indexOf('Nothing was returned') != -1, 'returning nothing is called out (got "' + undef.output.trim() + '")');

      // Script is unchanged: it still runs and logs, and holds no value.
      var script = this.Script.create({ code: 'return 42;', autoRun: true }, ctx);
      await script.onLoad();

      x.test(script.output.indexOf('42') != -1, 'Script still logs its result (got "' + script.output.trim() + '")');
      x.test(script.value === undefined, 'Script gains no value, so existing script blocks bind as before');
    }
  ]
});
