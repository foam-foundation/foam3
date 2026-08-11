/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.test',
  name: 'FlowScriptShapeTest',
  extends: 'foam.core.test.Test',

  documentation: `
    Flow.script parses from all three of its serialized shapes — legacy
    escaped string, legacy triple-quoted string, and plain JSON structure —
    and the structure shape round-trips through the journal formatter.
  `,

  javaImports: [
    'foam.core.reflow.Flow',
    'foam.core.reflow.ScriptParser',
    'foam.lib.formatter.JSONFObjectFormatter',
    'foam.lib.json.JSONParser',
    'java.util.Map'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        JSONParser parser = (JSONParser) x.create(JSONParser.class);

        // The script text every shape should yield: one block whose code
        // holds quotes, a regex backslash and newlines.
        String code   = "var s = \\"x\\";\\nvar t = /\\\\d+/;";
        String script = "[{\\"flowName\\":\\"a\\",\\"cmd\\":\\"script\\",\\"value\\":{\\"class\\":\\"foam.core.reflow.Script\\",\\"code\\":\\"var s = \\\\\\"x\\\\\\";\\\\nvar t = /\\\\\\\\d+/;\\",\\"autoRun\\":true}}]";

        // Shape 1: legacy escaped single-line string.
        Flow f1 = (Flow) parser.parseString(
          "{\\"class\\":\\"foam.core.reflow.Flow\\",\\"name\\":\\"s1\\",\\"script\\":" + ScriptParser.stringify(script) + "}");
        test(f1 != null, "shape 1 (escaped string): Flow parses");
        test(f1 != null && script.equals(f1.getScript()), "shape 1: script text preserved");

        // Shape 2: legacy triple-quoted string (multiline journal form).
        // escapeMultiline doubles backslashes; the reader halves them.
        Flow f2 = (Flow) parser.parseString(
          "{\\"class\\":\\"foam.core.reflow.Flow\\",\\"name\\":\\"s2\\",\\"script\\":\\n\\"\\"\\"" + script.replace("\\\\", "\\\\\\\\") + "\\"\\"\\"}");
        test(f2 != null, "shape 2 (triple-quoted string): Flow parses");
        test(f2 != null && script.equals(f2.getScript()), "shape 2: script text preserved");

        // Shape 3: plain JSON structure with the code as a triple-quoted block.
        Flow f3 = (Flow) parser.parseString(
          "{\\"class\\":\\"foam.core.reflow.Flow\\",\\"name\\":\\"s3\\",\\"script\\":[{\\"flowName\\":\\"a\\",\\"cmd\\":\\"script\\",\\"value\\":{\\"class\\":\\"foam.core.reflow.Script\\",\\"code\\":\\n\\"\\"\\"" + code.replace("\\\\", "\\\\\\\\") + "\\"\\"\\",\\"autoRun\\":true}}]}");
        test(f3 != null, "shape 3 (JSON structure): Flow parses");

        // The structure shape re-stringifies to canonical text whose nested
        // code decodes to the same content as the string shapes.
        Object data = f3 == null ? null : ScriptParser.parseData(f3.getScript());
        test(data instanceof Object[], "shape 3: script text is a JSON array");
        if ( data instanceof Object[] ) {
          Map block = (Map) ((Object[]) data)[0];
          Map value = (Map) block.get("value");
          test(code.equals(value.get("code")), "shape 3: nested code content preserved");
        }

        // Formatter round-trip: output shape 1's Flow with multiLineOutput,
        // expect a structured script with a triple-quoted code block, and
        // re-parse it back to the same script text.
        JSONFObjectFormatter fmt = new JSONFObjectFormatter();
        fmt.setX(x);
        fmt.setMultiLine(true);
        fmt.output(f1, Flow.getOwnClassInfo());
        String out = fmt.builder().toString();
        test(out.contains("\\"\\"\\""), "formatter: multiline code emitted as a triple-quoted block");

        Flow f4 = (Flow) parser.parseString(out);
        test(f4 != null, "formatter output re-parses");
        test(f4 != null && script.equals(f4.getScript()), "formatter round-trip preserves script text");
      `
    }
  ]
});
