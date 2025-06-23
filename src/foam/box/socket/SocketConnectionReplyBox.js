/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.box.socket',
  name: 'SocketConnectionReplyBox',

  implements: [
    'foam.box.Box'
  ],

  javaImports: [
    'foam.lang.X',
    'foam.core.logger.PrefixLogger',
    'foam.core.logger.Logger',
    'java.io.BufferedOutputStream',
    'java.io.DataOutputStream',
    'java.io.IOException',
    'java.io.OutputStream',
    'java.net.Socket',
    'java.nio.ByteBuffer',
    'java.nio.charset.StandardCharsets',
    'java.util.concurrent.atomic.AtomicLong'
  ],

  properties: [
    {
      documentation: 'managed by SocketConnectionBoxManager',
      name: 'key',
      class: 'String',
      transient: true,
    },
    {
      name: 'logger',
      class: 'FObjectProperty',
      of: 'foam.core.logger.Logger',
      visibility: 'HIDDEN',
      transient: true,
      javaCloneProperty: '//noop',
      javaFactory: `
        return new PrefixLogger(new Object[] {
          this.getClass().getSimpleName(),
          getKey()
        }, (Logger) getX().get("logger"));
      `
    }
  ],

  javaCode: `
    public SocketConnectionReplyBox(X x, String key) {
      setX(x);
      setKey(key);
    }

    protected static final ThreadLocal<foam.lib.formatter.FObjectFormatter> formatter_ = new ThreadLocal<foam.lib.formatter.FObjectFormatter>() {
      @Override
      protected foam.lib.formatter.JSONFObjectFormatter initialValue() {
        foam.lib.formatter.JSONFObjectFormatter formatter = new foam.lib.formatter.JSONFObjectFormatter();
        formatter.setQuoteKeys(true);
        formatter.setPropertyPredicate(new foam.lib.ClusterPropertyPredicate());
        return formatter;
      }

      @Override
      public foam.lib.formatter.FObjectFormatter get() {
        foam.lib.formatter.FObjectFormatter formatter = super.get();
        formatter.reset();
        return formatter;
      }
    };
  `,

  methods: [
    {
      documentation: `Send format:
length: 1 byte, // message byte length
message
NOTE: duplicated in SocketConnectionBox
`,
      name: 'send',
      javaCode: `
      X x = foam.lang.XLocator.get();
      DataOutputStream out = (DataOutputStream) x.get("socketOutputStream");

      try {
        foam.lib.formatter.FObjectFormatter formatter = formatter_.get();
        formatter.setX(x);
        formatter.output(envelope);
        String message = formatter.builder().toString();
        byte[] messageBytes = message.getBytes(StandardCharsets.UTF_8);
        synchronized( out ) {
          out.writeInt(messageBytes.length);
          out.write(messageBytes);
          out.flush();
        }
      } catch (Throwable t) {
        getLogger().error(t);
        throw new RuntimeException(t);
      } finally {
        ((SocketConnectionBoxManager) x.get("socketConnectionBoxManager")).removeReplyBox(this);
      }
      `
    }
  ]
});
