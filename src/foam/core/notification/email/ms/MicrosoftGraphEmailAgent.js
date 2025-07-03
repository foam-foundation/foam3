/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification.email.ms',
  name: 'MicrosoftGraphEmailAgent',

  extends: 'foam.core.notification.email.SMTPAgent',

  documentation: 'Implementation of Email Service using Microsoft Graph API.',

  javaImports: [
    'foam.core.logger.Loggers',
    'foam.core.logger.Logger',
    'foam.log.LogLevel',
    'foam.core.om.OMLogger',
    'foam.lang.X',
    'foam.dao.DAO',
    'foam.core.er.EventRecord',

    'foam.core.notification.email.Status',
    'foam.core.notification.email.EmailMessage',
    'foam.core.notification.email.ms.EmailServiceConfig',

    'java.util.Collections',
    'foam.lang.ContextAgentTimerTask',
    'java.util.concurrent.CompletableFuture',
    'java.util.Map',
    'java.util.Properties',
    'java.util.Timer',
    'java.net.URISyntaxException',
    'java.net.URI',
    'java.io.ByteArrayOutputStream',
    'java.time.OffsetDateTime',

    'jakarta.mail.*',
    'jakarta.mail.internet.*',

    'com.azure.core.credential.AccessToken',
    'com.azure.core.credential.TokenRequestContext',
    'com.azure.identity.ClientSecretCredential',
    'com.azure.identity.ClientSecretCredentialBuilder',

    'microsoft.exchange.webservices.data.core.ExchangeService',
    'microsoft.exchange.webservices.data.property.complex.MimeContent',
    'microsoft.exchange.webservices.data.core.enumeration.misc.ExchangeVersion',
    'microsoft.exchange.webservices.data.core.request.HttpWebRequest',
    'microsoft.exchange.webservices.data.credential.ExchangeCredentials',
    'microsoft.exchange.webservices.data.property.complex.MessageBody',
    'microsoft.exchange.webservices.data.core.enumeration.misc.ConnectingIdType',
    'microsoft.exchange.webservices.data.misc.ImpersonatedUserId',
    'microsoft.exchange.webservices.data.core.enumeration.property.BodyType'
  ],

  constants: [
    {
      name: 'SCOPE',
      type: 'String',
      value: 'https://outlook.office365.com/.default'
    }
  ],

  javaCode: `
    private class OAuthAuthenticator extends ExchangeCredentials {

      private final String bearerToken;

      public OAuthAuthenticator(String accessToken) {
          this.bearerToken = accessToken;
      }

      @Override
      public void prepareWebRequest(HttpWebRequest request) throws URISyntaxException {
          super.prepareWebRequest(request);

          Map<String, String> headers = request.getHeaders();
          if (headers != null) {
              headers.put("Authorization", "Bearer " + bearerToken);
          }
      }
    }
  `,

  properties: [
    {
      name: 'id',
      class: 'Reference',
      of: 'foam.core.notification.email.ms.EmailServiceConfig',
      targetDAOKey: 'emailServiceConfigDAO',
      value: 'msGraph'
    },
    {
      name: 'throttler',
      class: 'String',
      value: 'microsoftGraphEmailAgentThrottle'
    },
    {
      name: 'credential',
      class: 'Object',
      javaType: 'com.azure.identity.ClientSecretCredential',
      visibility: 'HIDDEN',
      transient: true
    },
    {
      name: 'accessToken',
      class: 'Object',
      javaType: 'com.azure.core.credential.AccessToken',
      visibility: 'HIDDEN',
      transient: true
    },
    {
      name: 'service',
      class: 'Object',
      javaType: 'microsoft.exchange.webservices.data.core.ExchangeService',
      visibility: 'HIDDEN',
      transient: true
    },
    {
      name: 'lastConfig',
      class: 'FObjectProperty',
      of: 'foam.core.notification.email.ms.EmailServiceConfig',
      visibility: 'HIDDEN',
      transient: true
    }
  ],

  methods: [
    {
      name: 'buildExchangeService',
      type: 'microsoft.exchange.webservices.data.core.ExchangeService',
      javaCode: `
        Logger logger = Loggers.logger(getX(), this);
        logger.debug("Initializing Service");
        EmailServiceConfig config = findId(getX());
        final String clientId = config.getClientId();
        final String tenantId = config.getTenantId();
        final String clientSecret = config.getPassword();
        String emailFrom = config.getUsername();

        if (clientId == null || tenantId == null || clientSecret == null || emailFrom == null) {
          throw new IllegalArgumentException("Missing required email service configuration.");
        }

        ClientSecretCredential credential = new ClientSecretCredentialBuilder()
          .clientId(clientId)
          .tenantId(tenantId)
          .clientSecret(clientSecret)
          .build();

        setCredential(credential);

        // Acquire first access token
        refreshTokenIfNeeded();

        // Build ExchangeService instance
        ExchangeService service = new ExchangeService(ExchangeVersion.Exchange2010_SP2);
        service.setCredentials(new OAuthAuthenticator(getAccessToken().getToken()));
        try {
          service.setUrl(new URI("https://outlook.office365.com/EWS/Exchange.asmx"));
        }
        catch ( URISyntaxException e ) {
          logger.error("Error setting URL", e);
        }
        // App-only OAuth tokens require an ExchangeImpersonation SOAP header
        service.setImpersonatedUserId(new ImpersonatedUserId(ConnectingIdType.SmtpAddress, emailFrom));

        return service;
      `
    },
    {
      name: 'refreshTokenIfNeeded',
      type: 'Void',
      javaCode: `
        Logger logger = Loggers.logger(getX(), this);
        logger.debug("Checking if token needs to be refreshed");
        if (getAccessToken() == null || getAccessToken().getExpiresAt().isBefore(OffsetDateTime.now().plusMinutes(5))) {
          TokenRequestContext ctx = new TokenRequestContext();
          ctx.addScopes(SCOPE);
          AccessToken accessToken = getCredential().getTokenSync(ctx);
          setAccessToken(accessToken);
          logger.debug("Token refreshed successfully");
        }
      `
    },
    {
      name: 'ensureInitialized',
      type: 'Void',
      javaCode: `
        Logger logger = Loggers.logger(getX(), this);
        logger.debug("Ensuring service is initialized");
        if (getService() == null) {
          throw new IllegalStateException("Ews.initialize must be called first");
        }
      `
    },
    {
      name: 'start',
      javaCode: `
      EmailServiceConfig config = findId(getX());
      if ( config == null ) {
        config = new EmailServiceConfig(); // use default timer values
      }
      ((DAO) getX().get("eventRecordDAO")).put(
        new EventRecord(getX(), this, "start", getId(), null, null, LogLevel.INFO, null)
      );
      setService(buildExchangeService());
      Timer timer = new Timer(this.getClass().getSimpleName(), true);
      setTimer(timer);
      timer.schedule(new ContextAgentTimerTask(getX(), this),
        config.getInitialDelay(),
        config.getPollInterval()
      );
      `,
    },
    {
      name: 'stop',
      javaCode: `
      Timer timer = (Timer) getTimer();
      if ( timer != null ) {
        Loggers.logger(getX(), this).info("stop");
        if ( getService() != null ) {
          getService().close();
          setService(null);
        }
        timer.cancel();
        clearTimer();
        ((DAO) getX().get("eventRecordDAO")).put(new EventRecord(getX(), this, "stop", getId(), null, null, LogLevel.INFO, null));
      }
      `
    },
    {
      name: 'maybeReload',
      type: 'Void',
      javaCode: `
      // Do nothing
      `
    },
    {
      name: 'reload',
      javaCode: `
      Logger logger = Loggers.logger(getX(), this);
      EmailServiceConfig config = findId(getX());
      EmailServiceConfig lastConfig = getLastConfig();
      logger.info("Reloading Microsoft Graph Email Agent");
      if ( lastConfig != null &&
           ((Map) config.diff(lastConfig)).size() > 0 ) {

        ((DAO) getX().get("eventRecordDAO")).put(new EventRecord(getX(), this, "reload", getId(), null, null, LogLevel.INFO, null));
        if ( getService() != null ) {
          getService().close();
          setService(null);
        }
        setService(buildExchangeService());
        setLastConfig(config);
        logger.info("Reloaded Microsoft Graph Email Agent successfully");
      }
      `
    },
    {
      name: 'send',
      args: 'X x, foam.core.notification.email.EmailMessage emailMessage',
      type: 'foam.core.notification.email.EmailMessage',
      javaCode: `
        Logger logger = Loggers.logger(getX(), this);
        OMLogger omLogger = (OMLogger) getX().get("OMLogger");
        emailMessage = (EmailMessage) emailMessage.fclone();

        if ( emailMessage.getStatus() == Status.FAILED ) {
          // ignore
          logger.debug("Email not sent, already FAILED.", emailMessage.getId());
          return emailMessage;
        }

        MimeMessage message = createMimeMessage(emailMessage);
        if ( message == null ) {
          // issue already logged.
          emailMessage.setStatus(Status.FAILED);
          return emailMessage;
        }

        try {
          ensureInitialized();
          refreshTokenIfNeeded();
          getService().setCredentials(new OAuthAuthenticator(getAccessToken().getToken()));

          // Serialize MimeMessage to raw RFC-822 bytes
          ByteArrayOutputStream baos = new ByteArrayOutputStream();
          message.writeTo(baos);
          byte[] rawBytes = baos.toByteArray();

          // Wrap the byte array into EWS MimeContent
          MimeContent mimeContent = new MimeContent("UTF-8", rawBytes);

          microsoft.exchange.webservices.data.core.service.item.EmailMessage msg = new microsoft.exchange.webservices.data.core.service.item.EmailMessage(getService());
          msg.setMimeContent(mimeContent);
          msg.send();

          emailMessage.setStatus(Status.SENT);
          emailMessage.setSentDate(message.getSentDate());
          // logger.debug("sent");
          omLogger.log(this.getClass().getSimpleName(), "message", "sent");
          EventRecord er = getEr();
          if ( er != null ) {
            er = (EventRecord) er.fclone();
            er.setSeverity(LogLevel.INFO);
            clearEr();
            ((DAO) getX().get("eventRecordDAO")).put(er);
          }
        } catch ( SendFailedException | ParseException e ) {
          EmailServiceConfig config = getLastConfig();
          if ( e.getMessage().contains("Too many login attempts") ) {
             EventRecord er = new EventRecord(getX(), this, "send", getId(), null, e.getMessage(), LogLevel.ERROR, e);
            ((DAO) getX().get("eventRecordDAO")).put(er);
            setEr(er);
            clearSession_();
            disable();
          } else {
            logger.error("Send failed", emailMessage.getId(), e);
            emailMessage.setStatus(Status.FAILED);
          }
        } catch ( MessagingException e ) {
          try {
            getTransport_().close();
          } catch ( Exception e2 ) {
            logger.error("Transport close failed", e2);
          }
          clearTransport_();
          clearSession_();
          EmailServiceConfig config = getLastConfig();
          EventRecord er = new EventRecord(getX(), this, "send", getId(), null, e.getMessage(), LogLevel.WARN, null);
          ((DAO) getX().get("eventRecordDAO")).put(er);
          setEr(er);
        } catch ( RuntimeException e ) {
          // already reported.
          logger.error("send failed", e.getMessage());
        } catch ( Exception e ) {
          logger.error("Unexpected error", e);
          emailMessage.setStatus(Status.FAILED);
        }
        return emailMessage;
      `
    }
  ]
});
