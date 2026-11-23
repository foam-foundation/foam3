/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.test',
  name: 'BlockCmdSaveTest',
  extends: 'foam.core.test.JSTest',

  documentation: `
    A block's command survives Save unchanged when it holds a backslash,
    such as the escaped quotes in markdown("a \\"b\\" c") or the \\d in a regex.
  `,

  methods: [
    {
      name: 'runTest',
      code: function(x) {
        var cmds = [
          'markdown("plain \\"quoted\\" text")',
          'var re = /\\d+/; re.test("12")',
          'markdown("line1\\nline2")',
          'h1 Hello'
        ];

        // The outputter settings Console.generateScriptString uses on Save.
        var save = foam.json.Outputter.create({
          pretty: true,
          strict: true,
          formatDatesAsNumbers: false,
          outputDefaultValues: false,
          useShortNames: false
        });
        var multiLine = foam.json.Outputter.create({ strict: true, multiLineOutput: true });

        cmds.forEach(cmd => {
          var block = foam.core.reflow.Block.create({ cmd: cmd }, x);

          var saved = JSON.parse(save.stringify(block)).cmd;
          x.test(saved === cmd, 'Save keeps the command as typed: ' + cmd + ' -> ' + saved);

          var savedMulti = JSON.parse(multiLine.stringify(block)).cmd;
          x.test(savedMulti === cmd, 'Multi-line output keeps the command as typed: ' + cmd + ' -> ' + savedMulti);
        });
      }
    }
  ]
});
