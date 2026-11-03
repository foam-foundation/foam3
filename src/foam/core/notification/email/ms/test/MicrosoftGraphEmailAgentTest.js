/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification.email.ms.test',
  name: 'MicrosoftGraphEmailAgentTest',
  extends: 'foam.core.test.Test',

  documentation: `Sends through MicrosoftGraphEmailAgent to a local HTTP server
    standing in for Graph, and checks the request it makes and what each
    response does to the message and the agent.`,

  javaImports: [
    'com.azure.core.credential.AccessToken',
    'com.sun.net.httpserver.HttpServer',
    'foam.core.notification.email.EmailMessage',
    'foam.core.notification.email.Status',
    'foam.core.notification.email.ms.EmailServiceConfig',
    'foam.core.notification.email.ms.MicrosoftGraphEmailAgent',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.lang.X',
    'jakarta.mail.Message',
    'jakarta.mail.Session',
    'jakarta.mail.internet.InternetAddress',
    'jakarta.mail.internet.MimeMessage',
    'java.io.ByteArrayInputStream',
    'java.io.ByteArrayOutputStream',
    'java.net.InetSocketAddress',
    'java.nio.charset.StandardCharsets',
    'java.time.OffsetDateTime',
    'java.util.ArrayList',
    'java.util.Base64',
    'java.util.List',
    'java.util.Properties',
    'java.util.concurrent.atomic.AtomicInteger'
  ],

  constants: [
    {
      name: 'SENDER',
      type: 'String',
      value: 'sender@example.com'
    }
  ],

  javaCode: `
    // One request as the stub server saw it.
    static class Captured {
      String method;
      String path;
      String authorization;
      String contentType;
      byte[] body;
    }
  `,

  methods: [
    {
      name: 'runTest',
      javaCode: `
        List<Captured> requests = new ArrayList<>();
        AtomicInteger reply = new AtomicInteger(202);

        HttpServer server = null;
        try {
          server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
          server.createContext("/", exchange -> {
            Captured c = new Captured();
            c.method        = exchange.getRequestMethod();
            c.path          = exchange.getRequestURI().getRawPath();
            c.authorization = exchange.getRequestHeaders().getFirst("Authorization");
            c.contentType   = exchange.getRequestHeaders().getFirst("Content-Type");
            c.body          = exchange.getRequestBody().readAllBytes();
            synchronized ( requests ) { requests.add(c); }
            byte[] out = reply.get() == 202 ? new byte[0] : "{\\"error\\":{\\"code\\":\\"stub\\"}}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(reply.get(), out.length == 0 ? -1 : out.length);
            if ( out.length > 0 ) exchange.getResponseBody().write(out);
            exchange.close();
          });
          server.start();
        } catch ( Exception e ) {
          test(false, "stub server failed to start: " + e.getMessage());
          return;
        }
        String graphUrl = "http://127.0.0.1:" + server.getAddress().getPort() + "/v1.0/users/";

        try {
          // 202: message SENT, request shaped the way Graph documents it
          X y = context(x, true);
          MicrosoftGraphEmailAgent agent = agent(y, graphUrl, true);
          EmailMessage msg = message("Monthly report", "<p>Hello</p>", new String[] { "to@example.com" }, null);
          EmailMessage result = agent.send(y, msg);
          expect(result.getStatus(), Status.SENT, "202 marks the message SENT");
          test(result.getSentDate() != null, "202 sets the sent date");
          expect(requests.size(), 1, "202 case made one request");
          Captured c = requests.get(0);
          expect(c.method, "POST", "request method is POST");
          expect(c.path, "/v1.0/users/" + SENDER + "/sendMail", "request path is users/{sender}/sendMail");
          expect(c.authorization, "Bearer test-token", "request carries the bearer token");
          expect(c.contentType, "text/plain", "MIME body is sent as text/plain");

          byte[] mime = Base64.getDecoder().decode(new String(c.body, StandardCharsets.US_ASCII));
          MimeMessage sent = new MimeMessage(Session.getInstance(new Properties()), new ByteArrayInputStream(mime));
          expect(sent.getSubject(), "Monthly report", "decoded MIME keeps the subject");
          expect(((InternetAddress) sent.getFrom()[0]).getAddress(), "noreply@example.com", "decoded MIME keeps From");
          expect(sent.getRecipients(Message.RecipientType.TO)[0].toString(), "to@example.com", "decoded MIME keeps To");
          expect(sent.getContent().toString(), "<p>Hello</p>", "decoded MIME keeps the body");

          // The body Graph receives is the same MIME the agent builds, the
          // same bytes EWS used to carry, apart from Date and Message-ID.
          ByteArrayOutputStream local = new ByteArrayOutputStream();
          agent.createMimeMessage(msg).writeTo(local);
          expect(normalize(mime), normalize(local.toByteArray()), "Graph body equals the MimeMessage the agent builds");

          // Non-ASCII text, several To addresses, Cc and Bcc survive the trip
          requests.clear();
          msg = message("Relevé de compte — été", "<p>Montant : 1 200,00 €</p>",
            new String[] { "a@example.com", "b@example.com" }, "cc@example.com");
          msg.setBcc(new String[] { "bcc@example.com" });
          result = agent.send(y, msg);
          expect(result.getStatus(), Status.SENT, "non-ASCII message is SENT");
          mime = Base64.getDecoder().decode(new String(requests.get(0).body, StandardCharsets.US_ASCII));
          sent = new MimeMessage(Session.getInstance(new Properties()), new ByteArrayInputStream(mime));
          expect(sent.getSubject(), "Relevé de compte — été", "non-ASCII subject decodes unchanged");
          expect(sent.getContent().toString(), "<p>Montant : 1 200,00 €</p>", "non-ASCII body decodes unchanged");
          local = new ByteArrayOutputStream();
          agent.createMimeMessage(msg).writeTo(local);
          expect(normalize(mime), normalize(local.toByteArray()), "non-ASCII Graph body equals the MimeMessage the agent builds");
          expect(sent.getRecipients(Message.RecipientType.TO).length, 2, "both To addresses kept");
          expect(sent.getRecipients(Message.RecipientType.CC)[0].toString(), "cc@example.com", "Cc kept");
          expect(sent.getRecipients(Message.RecipientType.BCC)[0].toString(), "bcc@example.com", "Bcc kept");

          // 500: this message FAILED, agent stays enabled for the next one
          requests.clear();
          reply.set(500);
          result = agent.send(y, message("s", "b", new String[] { "to@example.com" }, null));
          expect(result.getStatus(), Status.FAILED, "500 marks the message FAILED");
          test(agent.findId(y).getEnabled(), "500 leaves the agent enabled");

          // 403: missing Mail.Send grant, message stays UNSENT, agent disabled
          requests.clear();
          reply.set(403);
          result = agent.send(y, message("s", "b", new String[] { "to@example.com" }, null));
          expect(result.getStatus(), Status.UNSENT, "403 leaves the message UNSENT");
          test(! agent.findId(y).getEnabled(), "403 disables the agent");
          test(agent.getEr() != null && agent.getEr().getMessage().startsWith("HTTP 403"), "403 records an event naming the status");

          // No token and no client id: nothing is sent, agent disabled
          requests.clear();
          reply.set(202);
          y = context(x, false);
          agent = agent(y, graphUrl, false);
          result = agent.send(y, message("s", "b", new String[] { "to@example.com" }, null));
          expect(result.getStatus(), Status.UNSENT, "missing config leaves the message UNSENT");
          test(! agent.findId(y).getEnabled(), "missing config disables the agent");
          expect(requests.size(), 0, "missing config makes no request");

          // A message already FAILED is not sent again
          y = context(x, true);
          agent = agent(y, graphUrl, true);
          msg = message("s", "b", new String[] { "to@example.com" }, null);
          msg.setStatus(Status.FAILED);
          result = agent.send(y, msg);
          expect(result.getStatus(), Status.FAILED, "FAILED message stays FAILED");
          expect(requests.size(), 0, "FAILED message makes no request");
        } catch ( Exception e ) {
          test(false, "unexpected exception: " + e);
        } finally {
          server.stop(0);
        }
      `
    },
    {
      name: 'context',
      args: 'X x, boolean complete',
      type: 'X',
      javaCode: `
        EmailServiceConfig config = new EmailServiceConfig();
        config.setId("msGraph");
        config.setEnabled(true);
        config.setUsername(SENDER);
        config.setTenantId("tenant");
        config.setPassword("secret");
        if ( complete ) config.setClientId("client");
        DAO dao = new MDAO(EmailServiceConfig.getOwnClassInfo());
        dao.put(config);
        return x.put("emailServiceConfigDAO", dao);
      `
    },
    {
      name: 'agent',
      args: 'X x, String graphUrl, boolean withToken',
      type: 'MicrosoftGraphEmailAgent',
      javaCode: `
        MicrosoftGraphEmailAgent agent = new MicrosoftGraphEmailAgent(x);
        agent.setGraphUrl(graphUrl);
        if ( withToken ) agent.setAccessToken(new AccessToken("test-token", OffsetDateTime.now().plusHours(1)));
        return agent;
      `
    },
    {
      name: 'message',
      args: 'String subject, String body, String[] to, String cc',
      type: 'EmailMessage',
      javaCode: `
        EmailMessage msg = new EmailMessage();
        msg.setFrom("noreply@example.com");
        msg.setTo(to);
        if ( cc != null ) msg.setCc(new String[] { cc });
        msg.setSubject(subject);
        msg.setBody(body);
        msg.setStatus(Status.UNSENT);
        return msg;
      `
    },
    {
      name: 'normalize',
      documentation: 'The MIME text without the Date and Message-ID headers, which change on every build of the message.',
      args: 'byte[] mime',
      type: 'String',
      javaCode: `
        StringBuilder sb = new StringBuilder();
        for ( String line : new String(mime, StandardCharsets.UTF_8).split("\\r\\n") ) {
          if ( line.startsWith("Date: ") || line.startsWith("Message-ID: ") ) continue;
          sb.append(line).append('\\n');
        }
        return sb.toString();
      `
    }
  ]
});
