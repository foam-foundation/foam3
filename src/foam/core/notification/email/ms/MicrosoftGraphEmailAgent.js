/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification.email.ms',
  name: 'MicrosoftGraphEmailAgent',

  extends: 'foam.core.notification.email.SMTPAgent',

  documentation: `Sends email through the Microsoft Graph sendMail API.
    The Azure app registration needs the Mail.Send application permission,
    granted by a tenant admin, to send as the configured username.`,

  javaImports: [
    'foam.core.er.EventRecord',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.notification.email.EmailMessage',
    'foam.core.notification.email.Status',
    'foam.core.notification.email.ms.EmailServiceConfig',
    'foam.core.om.OMLogger',
    'foam.dao.DAO',
    'foam.lang.X',
    'foam.log.LogLevel',
    'foam.util.SafetyUtil',

    'com.azure.core.credential.AccessToken',
    'com.azure.core.credential.TokenRequestContext',
    'com.azure.identity.ClientSecretCredential',
    'com.azure.identity.ClientSecretCredentialBuilder',

    'jakarta.mail.internet.MimeMessage',

    'java.io.ByteArrayOutputStream',
    'java.net.URI',
    'java.net.http.HttpClient',
    'java.net.http.HttpRequest',
    'java.net.http.HttpResponse',
    'java.time.Duration',
    'java.time.OffsetDateTime',
    'java.util.Base64',
    'java.util.Map'
  ],

  constants: [
    {
      name: 'SCOPE',
      type: 'String',
      value: 'https://graph.microsoft.com/.default'
    }
  ],

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
      name: 'graphUrl',
      class: 'String',
      documentation: 'Graph users endpoint; the sender address and /sendMail are appended to it.',
      value: 'https://graph.microsoft.com/v1.0/users/'
    },
    {
      name: 'credential',
      class: 'Object',
      javaType: 'com.azure.identity.ClientSecretCredential',
      visibility: 'HIDDEN',
      transient: true,
      javaFactory: `
        EmailServiceConfig config = findId(getX());
        if ( config == null ||
             SafetyUtil.isEmpty(config.getClientId()) ||
             SafetyUtil.isEmpty(config.getTenantId()) ||
             SafetyUtil.isEmpty(config.getPassword()) ||
             SafetyUtil.isEmpty(config.getUsername()) ) {
          throw new IllegalArgumentException("Missing required email service configuration.");
        }
        return new ClientSecretCredentialBuilder()
          .clientId(config.getClientId())
          .tenantId(config.getTenantId())
          .clientSecret(config.getPassword())
          .build();
      `
    },
    {
      name: 'accessToken',
      class: 'Object',
      javaType: 'com.azure.core.credential.AccessToken',
      visibility: 'HIDDEN',
      transient: true
    },
    {
      name: 'client',
      class: 'Object',
      javaType: 'java.net.http.HttpClient',
      visibility: 'HIDDEN',
      transient: true,
      javaFactory: `
        return HttpClient.newBuilder()
          .connectTimeout(Duration.ofSeconds(30))
          .build();
      `
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
      name: 'refreshTokenIfNeeded',
      type: 'Void',
      javaCode: `
        Logger logger = Loggers.logger(getX(), this);
        logger.debug("Checking if token needs to be refreshed");
        if (getAccessToken() == null || getAccessToken().getExpiresAt().isBefore(OffsetDateTime.now().plusMinutes(5))) {
          try {
            TokenRequestContext ctx = new TokenRequestContext();
            ctx.addScopes(SCOPE);
            AccessToken accessToken = getCredential().getTokenSync(ctx);
            setAccessToken(accessToken);
            logger.debug("Token refreshed successfully");
          } catch (Exception e) {
            logger.error("Failed to refresh Azure token. Check clientId, tenantId, and clientSecret.", e);
            throw new RuntimeException("Azure authentication failed: " + e.getMessage(), e);
          }
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
        clearCredential();
        clearAccessToken();
        setLastConfig(config);
        logger.info("Reloaded Microsoft Graph Email Agent successfully");
      }
      `
    },
    {
      name: 'stopOnError',
      args: 'String message, Throwable t',
      documentation: 'Record the error, drop the cached token and credential so the next start rebuilds them from config, and disable the agent.',
      javaCode: `
        EventRecord er = new EventRecord(getX(), this, "send", getId(), null, message, LogLevel.ERROR, t);
        ((DAO) getX().get("eventRecordDAO")).put(er);
        setEr(er);
        clearCredential();
        clearAccessToken();
        disable();
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
          refreshTokenIfNeeded();

          // Graph takes the raw RFC-822 message, base64 encoded, as a
          // text/plain body, so the MimeMessage goes out unchanged.
          ByteArrayOutputStream baos = new ByteArrayOutputStream();
          message.writeTo(baos);
          String from = findId(getX()).getUsername();
          HttpRequest request = HttpRequest.newBuilder(URI.create(getGraphUrl() + from + "/sendMail"))
            .timeout(Duration.ofSeconds(60))
            .header("Authorization", "Bearer " + getAccessToken().getToken())
            .header("Content-Type", "text/plain")
            .POST(HttpRequest.BodyPublishers.ofString(Base64.getEncoder().encodeToString(baos.toByteArray())))
            .build();
          HttpResponse<String> response = getClient().send(request, HttpResponse.BodyHandlers.ofString());
          int status = response.statusCode();

          // Graph answers 202 Accepted once the message is queued for delivery.
          if ( status == 202 ) {
            emailMessage.setStatus(Status.SENT);
            emailMessage.setSentDate(message.getSentDate());
            omLogger.log(this.getClass().getSimpleName(), "message", "sent");
            EventRecord er = getEr();
            if ( er != null ) {
              er = (EventRecord) er.fclone();
              er.setSeverity(LogLevel.INFO);
              clearEr();
              ((DAO) getX().get("eventRecordDAO")).put(er);
            }
          } else if ( status == 401 || status == 403 ) {
            // A rejected token or a missing Mail.Send grant fails every
            // message the same way, so stop the agent and leave this message
            // unsent; it goes out once an admin fixes the app and re-enables.
            stopOnError("HTTP " + status + " " + response.body(), null);
          } else {
            logger.error("Send failed", emailMessage.getId(), status, response.body());
            emailMessage.setStatus(Status.FAILED);
          }
        } catch ( InterruptedException e ) {
          Thread.currentThread().interrupt();
          logger.error("Send interrupted", emailMessage.getId(), e);
          emailMessage.setStatus(Status.FAILED);
        } catch ( RuntimeException e ) {
          // Missing config or a token Azure refuses: every message would fail
          // the same way, and execute() would re-select this unsent message
          // forever, so stop the agent until an admin fixes the config.
          stopOnError(e.getMessage(), e);
        } catch ( Exception e ) {
          logger.error("Send failed", emailMessage.getId(), e);
          emailMessage.setStatus(Status.FAILED);
        }
        return emailMessage;
      `
    }
  ]
});
