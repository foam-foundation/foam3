/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.test',
  name: 'LLMStreamTest',
  extends: 'foam.core.test.Test',

  documentation: 'Streaming without a network: a canned Messages API event stream through ClaudeLLMService.readStream and LLMStreamWriter.',

  javaImports: [
    'foam.core.ai.ClaudeLLMService',
    'foam.core.ai.CompletionResponse',
    'foam.core.ai.LLMOptions',
    'foam.core.ai.LLMStream',
    'foam.core.ai.LLMStreamWriter',
    'foam.core.auth.AuthorizationException',
    'foam.core.auth.Subject',
    'foam.core.auth.User',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.lang.X',
    'java.io.BufferedReader',
    'java.io.StringReader'
  ],

  methods: [
    {
      name: 'as',
      args: 'long userId',
      type: 'foam.lang.X',
      javaCode: `
        User user = new User.Builder(getX()).setId(userId).build();
        return getX().put("subject", new Subject.Builder(getX()).setUser(user).build());
      `
    },
    {
      name: 'readable',
      args: [ { name: 'stream', javaType: 'LLMStream' }, { name: 'x', javaType: 'foam.lang.X' } ],
      type: 'Boolean',
      javaCode: `
        try {
          stream.authorizeOnRead(x);
          return true;
        } catch ( AuthorizationException e ) {
          return false;
        }
      `
    },
    {
      name: 'runTest',
      javaCode: `
        DAO streams = new MDAO(LLMStream.getOwnClassInfo());
        X   caller  = as(77).put("llmStreamDAO", streams);

        LLMOptions plain = new LLMOptions();
        test(LLMStreamWriter.forOptions(caller, plain) == null, "no streamId, no writer");

        LLMOptions options = new LLMOptions();
        options.setStreamId("s-1");
        LLMStreamWriter writer = LLMStreamWriter.forOptions(caller, options);
        LLMStream row = (LLMStream) streams.find("s-1");
        test(row != null && "thinking".equals(row.getPhase()), "the row exists as thinking before any text");
        test(row.getOwner() == 77, "the owner is the caller");

        String sse =
          "event: message_start\\n" +
          "data: {\\"type\\":\\"message_start\\",\\"message\\":{\\"model\\":\\"claude-test\\",\\"usage\\":{\\"input_tokens\\":42}}}\\n\\n" +
          "event: content_block_delta\\n" +
          "data: {\\"type\\":\\"content_block_delta\\",\\"index\\":0,\\"delta\\":{\\"type\\":\\"thinking_delta\\",\\"thinking\\":\\"\\"}}\\n\\n" +
          "event: content_block_delta\\n" +
          "data: {\\"type\\":\\"content_block_delta\\",\\"index\\":1,\\"delta\\":{\\"type\\":\\"text_delta\\",\\"text\\":\\"Hello\\"}}\\n\\n" +
          "event: content_block_delta\\n" +
          "data: {\\"type\\":\\"content_block_delta\\",\\"index\\":1,\\"delta\\":{\\"type\\":\\"text_delta\\",\\"text\\":\\", world\\"}}\\n\\n" +
          "event: message_delta\\n" +
          "data: {\\"type\\":\\"message_delta\\",\\"delta\\":{\\"stop_reason\\":\\"end_turn\\"},\\"usage\\":{\\"output_tokens\\":7}}\\n\\n" +
          "event: message_stop\\n" +
          "data: {\\"type\\":\\"message_stop\\"}\\n";

        CompletionResponse response;
        try {
          response = new ClaudeLLMService().readStream(new BufferedReader(new StringReader(sse)), writer, "claude-default");
        } catch ( java.io.IOException e ) {
          throw new RuntimeException(e);
        }
        expect(response.getContent(), "Hello, world", "text deltas make the reply; thinking deltas are skipped");
        expect(response.getModel(), "claude-test", "the model comes from message_start");
        expect(response.getInputTokens(), 42, "input tokens from message_start");
        expect(response.getOutputTokens(), 7, "output tokens from message_delta");
        expect(response.getStopReason(), "end_turn", "stop reason from message_delta");

        writer.finish(null);
        row = (LLMStream) streams.find("s-1");
        test("done".equals(row.getPhase()) && "Hello, world".equals(row.getText()), "finish writes the whole reply as done");

        boolean threw = false;
        try {
          new ClaudeLLMService().readStream(new BufferedReader(new StringReader(
            "data: {\\"type\\":\\"error\\",\\"error\\":{\\"type\\":\\"overloaded_error\\"}}\\n")), writer, "m");
        } catch ( RuntimeException e ) {
          threw = e.getMessage().contains("overloaded_error");
        } catch ( java.io.IOException e ) {
          threw = false;
        }
        test(threw, "an error event fails the call");

        test(readable(row, as(77)), "the owner reads the stream");
        test(! readable(row, as(78)), "another user does not");
      `
    }
  ]
});
