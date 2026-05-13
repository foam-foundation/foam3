/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification.email',
  name: 'SMTPAgent',

  implements: [
    'foam.lang.ContextAgent',
    'foam.core.COREService'
  ],

  documentation: 'Implementation of Email Service using SMTP',

  javaImports: [
    'foam.blob.Blob',
    'foam.blob.BlobService',
    'foam.blob.FileBlob',
    'foam.blob.IdentifiedBlob',
    'foam.blob.InputStreamBlob',
    'foam.lang.ContextAgent',
    'foam.lang.ContextAgentTimerTask',
    'foam.lang.X',
    'foam.dao.DAO',
    'foam.dao.ArraySink',
    'foam.log.LogLevel',
    'foam.core.er.EventRecord',
    'foam.core.cron.Cron',
    'foam.core.fs.File',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.om.OMLogger',
    'static foam.mlang.MLang.EQ',
    'java.io.ByteArrayInputStream',
    'java.io.ByteArrayOutputStream',
    'java.io.InputStream',
    'java.util.Date',
    'java.util.List',
    'java.util.Map',
    'java.util.Properties',
    'java.util.Timer',
    'jakarta.activation.DataHandler',
    'jakarta.activation.DataSource',
    'jakarta.mail.*',
    'jakarta.mail.internet.*',
    'jakarta.mail.util.ByteArrayDataSource',
    'org.apache.commons.lang3.StringUtils',
  ],

  javaCode: `
    private class SMTPAuthenticator extends jakarta.mail.Authenticator {
      protected String username_;
      protected String password_;

      public SMTPAuthenticator(String username, String password) {
        this.username_ = username;
        this.password_ = password;
      }

      @Override
      protected PasswordAuthentication getPasswordAuthentication() {
        return new PasswordAuthentication(this.username_, this.password_);
      }
    }
  `,

  properties: [
    {
      name: 'id',
      class: 'Reference',
      of: 'foam.core.notification.email.EmailServiceConfig',
      targetDAOKey: 'emailServiceConfigDAO',
      value: 'smtp'
    },
    {
      documentation: 'Track WARN EventRecord so it can be cleared on a successful operation',
      name: 'er',
      class: 'FObjectProperty',
      of: 'foam.core.er.EventRecord'
    },
    {
      name: 'throttler',
      class: 'String',
      value: 'smtpAgentThrottle'
    },
    {
      name: 'lastConfig',
      class: 'FObjectProperty',
      of: 'foam.core.notification.email.EmailServiceConfig',
      visibility: 'HIDDEN',
      transient: true
    },
    {
      documentation: 'Store reference to timer so it can be cancelled, and agent restarted.',
      name: 'timer',
      class: 'Object',
      visibility: 'HIDDEN',
      transient: true
    },
    {
      name: 'session_',
      javaType: 'jakarta.mail.Session',
      class: 'Object',
      visibility: 'HIDDEN',
      transient: true,
      javaFactory: `
        Properties props = new Properties();
        EmailServiceConfig config = findId(getX());
        props.setProperty("mail.transport.protocol", "smtp");
        props.setProperty("mail.smtp.auth", config.getAuthenticate() ? "true" : "false");
        props.setProperty("mail.smtp.starttls.enable", config.getStarttls() ? "true" : "false");
        props.setProperty("mail.smtp.host", config.getHost());
        props.setProperty("mail.smtp.port", config.getPort());
        if ( config.getAuthenticate() ) {
          // props.setProperty("mail.smtp.ssl.trust", config.getHost());
          return Session.getInstance(props, new SMTPAuthenticator(config.getUsername(), config.getPassword()));
        }
        return Session.getInstance(props);
      `
    },
    {
      class: 'Object',
      javaType: 'jakarta.mail.Transport',
      name: 'transport_',
      visibility: 'HIDDEN',
      transient: true,
      javaFactory: `
        Logger logger = Loggers.logger(getX(), this);
        OMLogger omLogger = (OMLogger) getX().get("OMLogger");
        EmailServiceConfig config = findId(getX());
        jakarta.mail.Transport transport = null;
        try {
          omLogger.log(this.getClass().getSimpleName(), "transport", "connecting");
          transport = getSession_().getTransport("smtp");
          transport.connect(config.getUsername(), config.getPassword());
          logger.info("transport", "connected");
          omLogger.log(this.getClass().getSimpleName(), "transport", "connected");
          EventRecord er = getEr();
          if ( er != null ) {
            er = (EventRecord) er.fclone();
            er.setSeverity(LogLevel.INFO);
            clearEr();
            ((DAO) getX().get("eventRecordDAO")).put(er);
          }
        } catch ( Exception e ) {
          setEr((EventRecord)((DAO) getX().get("eventRecordDAO")).put(new EventRecord(getX(), this, "connect", getId(), null, e.getMessage(), LogLevel.ERROR, e)));
          clearSession_();
          disable();
          throw new foam.lang.FOAMException(e);
        }
        return transport;
      `
    },
  ],

  methods: [
    {
      name: 'start',
      javaCode: `
      Logger logger = Loggers.logger(getX(), this);
      EmailServiceConfig config = findId(getX());
      if ( config == null ) {
        logger.warning("start", "EmailServiceConfig not found for id", getId(), "Emails will NOT be sent");
        config = new EmailServiceConfig(); // use default timer values
      } else if ( ! config.getEnabled() ) {
        logger.warning("start", "EmailServiceConfig DISABLED for id", getId());
      }
      ((DAO) getX().get("eventRecordDAO")).put(new EventRecord(getX(), this, "start", getId(), null, null, LogLevel.INFO, null));
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
        timer.cancel();
        clearTimer();
        ((DAO) getX().get("eventRecordDAO")).put(new EventRecord(getX(), this, "stop", getId(), null, null, LogLevel.INFO, null));
      }
      `
    },
    {
      name: 'sleep',
      args: 'Long interval',
      javaCode: `
      EmailServiceConfig config = findId(getX());
      Timer timer = (Timer) getTimer();
      if ( timer != null ) {
        timer.cancel();
      }
      timer = new Timer(this.getClass().getSimpleName(), true);
      setTimer(timer);
      timer.schedule(new ContextAgentTimerTask(getX(), this),
        interval,
        config.getPollInterval()
      );
      `
    },
    {
      name: 'reload',
      javaCode: `
      EmailServiceConfig config = findId(getX());
      EmailServiceConfig lastConfig = getLastConfig();
      if ( lastConfig != null &&
           ((Map) config.diff(lastConfig)).size() > 0 ) {

        ((DAO) getX().get("eventRecordDAO")).put(new EventRecord(getX(), this, "reload", getId(), null, null, LogLevel.INFO, null));
        clearTransport_();
        clearSession_();
        setLastConfig(config);
      }
      `
    },
    {
      name: 'disable',
      javaCode: `
      EmailServiceConfig config = (EmailServiceConfig) findId(getX()).fclone();
      config.setEnabled(false);
      ((DAO) getX().get("emailServiceConfigDAO")).put(config);
      ((DAO) getX().get("eventRecordDAO")).put(new EventRecord(getX(), this, "connect", getId(), null, "disable on error", LogLevel.WARN, null));
      `
    },
    {
      name: 'maybeReload',
      type: 'Void',
      javaCode: `
      reload();
      `
    },
    {
      name: 'execute',
      javaCode: `
      try {
        while ( true ) {
          EmailServiceConfig config = findId(getX());
          if ( config == null || ! config.getEnabled() ) break;

          DAO emailMessageDAO = (DAO) x.get("emailMessageDAO");
          List<EmailMessage> emailMessages = (List) ((ArraySink)
            emailMessageDAO
              .where(config.getPredicate())
              .orderBy(foam.core.notification.email.EmailMessage.CREATED)
              .select(new ArraySink()))
              .getArray();

          if ( emailMessages.size() == 0 ) break;

          // Reload only if there are email messages to send.
          maybeReload();

          for ( EmailMessage emailMessage : emailMessages ) {
            throttle(x);
            emailMessageDAO.put(send(x, emailMessage));
            config = findId(getX());
            if ( ! config.getEnabled() ) break;
          }
        }
      } catch (Throwable t) {
        disable();
        ((DAO) getX().get("eventRecordDAO")).put(new EventRecord(getX(), this, "execute", getId(), null, "disable on error", LogLevel.ERROR, t));
      }
      `
    },
    {
      name: 'createMimeMessage',
      javaType: 'MimeMessage',
      documentation: `Create a MimeMessage from the passed EmailMessage`,
      args: [
        {
          name: 'emailMessage',
          type: 'foam.core.notification.email.EmailMessage'
        }
      ],
      javaCode: `
        Logger logger = Loggers.logger(getX(), this);
        try {
          MimeMessage message = new MimeMessage(getSession_());

          // the From Property is mainly to hide our smtp user credetials.
          if ( emailMessage.isPropertySet("from") ) {
            if ( emailMessage.isPropertySet("displayName") ) {
              message.setFrom( new InternetAddress(emailMessage.getFrom(), emailMessage.getDisplayName()) );
            } else {
              message.setFrom(new InternetAddress(emailMessage.getFrom()));
            }
          } else if ( emailMessage.isPropertySet("replyTo") ) {
              if ( emailMessage.isPropertySet("displayName") ) {
                message.setFrom( new InternetAddress(emailMessage.getReplyTo(), emailMessage.getDisplayName()) );
              } else {
                message.setFrom(new InternetAddress(emailMessage.getReplyTo()));
              }
          }

          if ( emailMessage.isPropertySet("replyTo") )
            message.setReplyTo(InternetAddress.parse(emailMessage.getReplyTo()));

          if ( emailMessage.isPropertySet("subject") )
            message.setSubject(emailMessage.getSubject());

          if ( emailMessage.isPropertySet("to") ) {
            if ( emailMessage.getTo().length == 1 ) {
              message.setRecipient(Message.RecipientType.TO, new InternetAddress((emailMessage.getTo())[0], false));
            } else {
              message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(StringUtils.join(emailMessage.getTo(), ",")));
            }
          }

          if ( emailMessage.isPropertySet("cc") ) {
            if ( emailMessage.getCc().length == 1 ) {
              message.setRecipient(Message.RecipientType.CC, new InternetAddress((emailMessage.getCc())[0], false));
            } else {
              message.setRecipients(Message.RecipientType.CC, InternetAddress.parse(StringUtils.join(emailMessage.getCc(), ",")));
            }
          }

          if ( emailMessage.isPropertySet("bcc") ) {
            if ( emailMessage.getBcc().length == 1 ) {
              message.setRecipient(Message.RecipientType.BCC, new InternetAddress((emailMessage.getBcc())[0], false));
            } else {
              message.setRecipients(Message.RecipientType.BCC, InternetAddress.parse(StringUtils.join(emailMessage.getBcc(), ",")));
            }
          }

          String[] attachments = emailMessage.getAttachments();
          if ( attachments != null &&
               attachments.length > 0 ) {
            Multipart multipart = new MimeMultipart();
            if ( emailMessage.isPropertySet("body") ) {
              MimeBodyPart part = new MimeBodyPart();
              part.setText(emailMessage.getBody(), "utf-8", "html");
              multipart.addBodyPart(part);
            }
            DAO fileDAO = ((DAO) getX().get("fileDAO"));
            for ( String fileId : attachments ) {
              File file = (File) fileDAO.find(fileId);
              if ( file != null ) {
                Blob blob = (Blob) file.getData();
                InputStream stream = null;
                if ( blob instanceof  IdentifiedBlob || blob == null ) {
                  String id = blob == null ? file.getId(): ((IdentifiedBlob) blob).getId();
                  BlobService blobStore = (BlobService) getX().get("blobStore");
                  FileBlob temp = (FileBlob) blobStore.find(id);
                  var os = new ByteArrayOutputStream();
                  temp.read(os, 0, temp.getSize());
                  var bytes = os.toByteArray();
                  stream = new ByteArrayInputStream(bytes);
                  os.close();
                } else {
                  stream = ((InputStreamBlob) blob).getInputStream();
                }
                try ( var in = stream; ) {
                  DataSource source = new ByteArrayDataSource(in, "application/octet-stream");
                  BodyPart part = new MimeBodyPart();
                  part.setDataHandler(new DataHandler(source));
                  part.setFileName(file.getFilename());
                  multipart.addBodyPart(part);
                }
              } else {
                logger.warning("File not found", fileId);
              }
            }
            message.setContent(multipart);
          } else {
            message.setContent(emailMessage.getBody(), "text/html");
          }

          message.setSentDate(new Date());
          logger.debug("MimeMessage created");
          return message;
        } catch (Throwable t) {
          logger.error("MimeMessage creation failed", "to", emailMessage.getTo()[0], "subject", emailMessage.getSubject(), t);
          return null;
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
          getTransport_().send(message);
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
        }
        return emailMessage;
      `
    },
    {
      name: 'throttle',
      args: 'X x',
      javaCode: `
        var t = (foam.core.pool.Throttle) x.get(getThrottler());
        if ( t != null ) t.throttle();
      `
    }
  ]
});
