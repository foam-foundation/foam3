/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.predicate',
  name: 'RegExp',
  extends: 'foam.mlang.predicate.Unary',
  implements: [ 'foam.lang.Serializable' ],
  properties: [
    {
      name: 'arg1',
      gridColumns: 6
    },
    {
      type: 'Regex',
      javaInfoType: 'foam.lang.AbstractObjectPropertyInfo',
      name: 'regExp',
      javaJSONParser: 'foam.lib.json.RegexParser.instance()',
      gridColumns: 6
    }
  ],
  methods: [
    {
      name: 'f',
      code: function(o) {
        var v1 = this.arg1.f(o);
        return v1.toString().match(this.regExp) !== null;
      },
      javaCode: `
        return getRegExp().matcher(getArg1().f(obj).toString()).matches();
      `
    }
  ]
});
