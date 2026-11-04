/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lib.json.test',
  name: 'JSONStringPropertyCastTest',
  extends: 'foam.core.test.Test',

  documentation: `
    A String property must accept an unquoted JSON boolean or number and keep it
    as text.
  `,

  javaImports: [
    'foam.core.test.Test',
    'foam.lib.json.JSONParser'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
      JSONParser parser = new JSONParser(x);

      // The key after the boolean must still be read, so a parse that skipped
      // or stopped at the boolean would leave id empty.
      Test t = (Test) parser.parseString("{\\"description\\":true,\\"id\\":\\"after\\"}", Test.class);
      test(t != null, "an object with a String property sent as true parses");
      if ( t != null ) {
        expect(t.getDescription(), "true", "true is stored as the text true");
        expect(t.getId(), "after", "the property after the boolean is still parsed");
      }

      t = (Test) parser.parseString("{\\"description\\":false}", Test.class);
      test(t != null && "false".equals(t.getDescription()), "false is stored as the text false");

      t = (Test) parser.parseString("{\\"description\\":12}", Test.class);
      test(t != null && "12".equals(t.getDescription()), "a number is still stored as its text");

      t = (Test) parser.parseString("{\\"description\\":\\"true\\"}", Test.class);
      test(t != null && "true".equals(t.getDescription()), "a quoted string is unchanged");
      `
    }
  ]
});
