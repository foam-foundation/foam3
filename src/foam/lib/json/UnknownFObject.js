/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lib.json',
  name: 'UnknownFObject',

  implements: [ 'foam.lib.json.OutputJSON' ],

  documentation: 'A FObject for unknown model',

  javaImports: [
    'foam.core.FObject',
    'foam.lib.formatter.FObjectFormatter',
    'foam.lib.formatter.JSONFObjectFormatter'
  ],

  properties: [
    {
      class: 'String',
      name: 'json'
    }
  ],

  javaCode: `
    protected static final ThreadLocal<FObjectFormatter> formatter_ = new ThreadLocal<>() {
      @Override
      protected JSONFObjectFormatter initialValue() {
        return new JSONFObjectFormatter()
          .setOutputDefaultValues(false)
          .setOutputReadableDates(false)
          .setQuoteKeys(true)
          .setOutputShortNames(true);
      }

      @Override
      public FObjectFormatter get() {
        FObjectFormatter formatter = super.get();
        formatter.reset();
        return formatter;
      }
    };

    public static UnknownFObject cast(FObject obj) {
      if ( obj == null ) return null;

      FObjectFormatter formatter = formatter_.get();
      String json = formatter.stringify(obj);
      return new UnknownFObject(obj.getX(), json);
    }
  `,

  methods: [
    {
      name: 'outputJSON',
      args: [
        {
          name: 'outputter',
          javaType: 'foam.lib.json.Outputter'
        }
      ],
      javaCode: 'outputter.outputRawString(getJson());'
    },
    {
      name: 'formatJSON',
      args: [
        {
          name: 'formatter',
          javaType: 'foam.lib.formatter.JSONFObjectFormatter'
        }
      ],
      javaCode: 'formatter.outputJson(getJson());'
    }
  ]
});
