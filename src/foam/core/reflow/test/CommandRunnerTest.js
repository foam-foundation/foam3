/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.test',
  name: 'CommandRunnerTest',
  extends: 'foam.core.test.JSTest',

  documentation: `
    An agent runs the commands it writes in its reply: only the commands its
    predicate matches are listed and runnable, a command gets the params the
    model wrote and the agent's context, an asked command's result goes back,
    a reply with no command is the answer, and a command marked confirm runs
    only when the user agrees. The reply is read, never evaluated.
  `,

  requires: [
    'foam.core.reflow.ai.CommandRunner',
    'foam.core.reflow.ai.ReplyParser',
    'foam.core.reflow.cmd.Command',
    'foam.dao.MDAO'
  ],

  methods: [
    {
      name: 'runTest',
      code: async function(x) {
        this.testParser(x);
        await this.testRunner(x);
      }
    },

    function testParser(x) {
      var parse = s => this.ReplyParser.create().parseString(s);

      var parts = parse('Reading the head first.\nask doc.readLines({doc: \'file\', from: 1, count: 20})');
      x.test(parts.length === 2 && parts[0].text === 'Reading the head first.', 'text before a command is kept as text');
      x.test(parts[1].ask && parts[1].command === 'doc.readLines' && JSON.stringify(parts[1].params) === '{"doc":"file","from":1,"count":20}',
        'an ask line gives its command and params: ' + JSON.stringify(parts[1]));

      // A parser's code passed as written, over several lines, in a backtick string
      parts = parse('ask code.check({\n  code: `foam.CLASS({\n  name: "P",\n  s: \'a\\nb\', r: /\\d+/, q: \'\\`\'\n})`\n})');
      x.test(parts.length === 1 && parts[0].params.code === 'foam.CLASS({\n  name: "P",\n  s: \'a\\nb\', r: /\\d+/, q: \'`\'\n})',
        'a command continues over lines until its brackets close, and its backtick string is kept as written: ' + JSON.stringify(parts));

      parts = parse('Checking.\nask doc.readLines({doc: "file", from: 1');
      x.test(parts.length === 2 && parts[1].ask && parts[1].error && parts[1].source === 'ask doc.readLines({doc: "file", from: 1',
        'an ask whose call does not parse is an error, not text: ' + JSON.stringify(parts));

      parts = parse('<function_calls>\n<invoke name="code.check">\n<parameter name="code">foam.CLASS({ name: "P" })</parameter>\n<parameter name="from">20</parameter>\n</invoke>\n</function_calls>');
      x.test(parts.length === 1 && parts[0].ask && parts[0].command === 'code.check'
        && parts[0].params.code === 'foam.CLASS({ name: "P" })' && parts[0].params.from === 20,
        'Claude\'s tool-call format is read as ask, code as written, a number as a number: ' + JSON.stringify(parts));

      parts = parse('It\'s a fixed-width file.\nask doc.readLines({doc: "file"})');
      x.test(parts.length === 2 && parts[1].command === 'doc.readLines', 'an apostrophe in text does not swallow the lines after it');

      parts = parse('ask doc.findLines({doc: "file", text: "D"}) // the detail records\ndemo.save()');
      x.test(parts.length === 2 && parts[0].ask && ! parts[1].ask && JSON.stringify(parts[1].params) === '{}',
        'a trailing comment is allowed, and a command without ask or params is read');
    },

    async function testRunner(x) {
      var dao = this.MDAO.create({ of: this.Command });
      await dao.put(this.Command.create({ id: 'demo.greet', description: 'Greet someone',
        inputSchema: '{"type":"object","properties":{"name":{"type":"string"}}}',
        script: 'return this.__context__.greeting + ", " + args[0].name;' }));
      await dao.put(this.Command.create({ id: 'demo.save', description: 'Save the data', confirm: true,
        script: 'this.__context__.saved.push(1); return "Saved.";' }));
      await dao.put(this.Command.create({ id: 'demo.silent', description: 'Return nothing', script: 'var a = 1;' }));
      await dao.put(this.Command.create({ id: 'other.drop', description: 'Drop everything', script: 'this.__context__.dropped.push(1); return "dropped";' }));

      var saved = [], dropped = [], asked = [];
      var agentX = x.createSubContext({ commandDAO: dao, greeting: 'Hello', saved: saved, dropped: dropped });
      var runner = this.CommandRunner.create({
        predicate: foam.mlang.Expressions.create().STARTS_WITH(this.Command.ID, 'demo.'),
        commandX: agentX,
        askConfirm: async function(c) { asked.push(c.id); return asked.length > 1; }
      }, agentX);

      var protocol = await runner.protocol();
      x.test(protocol.indexOf('- demo.greet: Greet someone Params: {"type"') >= 0, 'each command is listed with its params');
      x.test(protocol.indexOf('- demo.save: Save the data No params. The user confirms before it runs.') >= 0, 'a confirm command says so');
      x.test(protocol.indexOf('other.drop') < 0, 'a command outside the agent\'s set is not listed');

      var turn = await runner.runReply('Greeting first.\nask demo.greet({name: "Ada"})\ndemo.silent()');
      x.test(turn.results === 'agent(' + JSON.stringify({ asked: 'ask demo.greet({"name":"Ada"})', response: 'Hello, Ada' }) + ')',
        'an asked command gets the params and the agent\'s context, and its result goes back: ' + turn.results);
      x.test(turn.said === 'Greeting first.', 'the text beside the commands is what the model said');

      var answer = 'It is a fixed-width file.\n```javascript\nfoam.CLASS({ name: "P" })\n```';
      turn = await runner.runReply(answer);
      x.test(turn.said === answer && turn.results === '', 'a reply with no command is the answer, whole');

      turn = await runner.runReply('ask other.drop({})');
      x.test(turn.results.indexOf('There is no command named other.drop here.') > 0 && dropped.length === 0, 'a command outside the agent\'s set is refused');

      turn = await runner.runReply('ask demo.greet({name: window.secret()})');
      x.test(turn.results.indexOf('This did not run') > 0 && turn.results.indexOf('Hello') < 0,
        'params that are not a literal are never evaluated, and the model hears the call did not run: ' + turn.results);

      x.test(( await runner.run('demo.save') ).indexOf('did not confirm') >= 0 && saved.length === 0, 'a confirm command does not run when the user says no');
      x.test(await runner.run('demo.save') === 'Saved.' && saved.length === 1, 'it runs once the user agrees');
      x.test(await runner.run('demo.silent') === 'Done.', 'a command that returns nothing reads as Done.');
    }
  ]
});
