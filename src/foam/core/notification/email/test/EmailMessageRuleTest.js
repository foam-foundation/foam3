/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification.email.test',
  name: 'EmailMessageRuleTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.lang.X',
    'foam.dao.DAO',
    'foam.core.auth.Address',
    'foam.core.auth.Group',
    'foam.core.auth.LifecycleState',
    'foam.core.auth.ServiceProvider',
    'foam.core.auth.User',
    'foam.core.notification.email.EmailMessage',
    'foam.core.notification.email.EmailConfig',
    'foam.core.notification.email.EmailTemplate',
    'foam.core.notification.email.Status',
    'java.util.HashMap',
    'java.util.Map'
  ],

  javaCode: `
  String spid_ = "email";
  User user_ = null;
  EmailTemplate template_ = null;
  String subject_ = "Test Email";
  String subjectTemplate_ = "Subject: {{subject}}";
  String subjectResolved_ = "Subject: "+subject_;
  `,

  methods: [
    {
      description: '',
      name: 'setup',
      args: 'X x',
      javaCode: `
    // Create spid, user, group, emailTemplate, emailConfig
    ServiceProvider sp = new ServiceProvider();
    sp.setId(spid_);
    sp.setDescription(spid_+" Spid");
    ((DAO) x.get("serviceProviderDAO")).put_(x, sp);

    Group group = new Group();
    group.setId(spid_+"-test");
    group = (Group) ((DAO) x.get("groupDAO")).put_(x, group);

    Address address = new Address(x);
    address.setCountryId("CA");
    address.setRegionId("CA-ON");
    address.setPostalCode("X1X 1X1");
    address.setCity("Bounce");
    address.setStreetNumber("1");
    address.setStreetName("Email");

    User user = new User(x);
    user.setFirstName("email");
    user.setLastName("test");
    user.setUserName(user.getFirstName()+user.getLastName());
    user.setEmail(user.getUserName()+"@example.com");
    user.setEmailVerified(true);
    user.setSpid(spid_);
    user.setGroup(group.getId());
    user.setAddress(address);
    user.setLifecycleState(LifecycleState.ACTIVE);
    user_ = (User) ((DAO) x.get("userDAO")).put_(x, user);

    EmailConfig config = new EmailConfig();
    config.setSpid(spid_);
    config.setFrom("noreply@example.com");
    config.setDisplayName("Example");
    config.setReplyTo("noreply@example.com");
    ((DAO) x.get("emailConfigDAO")).put(config);
      `
    },
    {
      description: '',
      name: 'runTest',
      javaCode: `
    setup(x);
    DAO dao = (DAO) x.get("emailMessageDAO");
    HashMap args = new HashMap();


    EmailTemplate template = new EmailTemplate();
    template.setId(spid_);
    template.setName(spid_);
    template.setSpid(spid_);
    // template.setGroup(spid_);
    template.setSubject(subjectTemplate_);
    template.setBody("Body: {{arg1}}");
    template = (EmailTemplate) ((DAO) x.get("emailTemplateDAO")).put(template).fclone();
    args.put("template", template.getId());
    args.put("subject", subject_);
    EmailMessage msg = new EmailMessage(x, user_.getId(), args);
    msg.setTo(new String[] { "another@example.com" });
    msg = (EmailMessage) dao.put(msg);
    test(msg!=null, "EmailMessage created: "+msg.getId());
    msg = (EmailMessage) dao.find(msg.getId());
    test(msg!=null, "EmailMessage found: "+msg.getId());
    test(msg.getStatus() == Status.UNSENT, "EmailMessage status==UNSENT: "+msg.getStatus());
    test(subjectResolved_.equals(msg.getSubject()), "EmailMessage subject=="+subjectResolved_+": "+msg.getSubject());

    // CSS
    msg = new EmailMessage();
    msg.setUser(user_.getId());
    msg.setTo(new String[] { "another@example.com" });
    template.setBody("CSS: {$ font-semi-bold $}");
    template = (EmailTemplate) ((DAO) x.get("emailTemplateDAO")).put(template).fclone();
    args = new HashMap();
    args.put("template", template.getId());
    args.put("subject", subject_);
    msg.setTemplateArguments(args);
    msg = (EmailMessage) ((DAO) x.get("emailMessageDAO")).put(msg);
    test(msg!=null, "MailMessage (CSS) found: "+msg.getId());
    test("CSS: 700".equals(msg.getBody()), "EmailMessage (CSS) body: "+msg.getBody());

    // No-args
    msg = new EmailMessage();
    msg.setUser(user_.getId());
    msg.setTo(new String[] { "another@example.com" });
    template.setBody("Body: args1_not_replaced");
    template = (EmailTemplate) ((DAO) x.get("emailTemplateDAO")).put(template).fclone();
    args = new HashMap();
    args.put("template", template.getId());
    args.put("subject", subject_);
    msg.setTemplateArguments(args);
    msg = (EmailMessage) ((DAO) x.get("emailMessageDAO")).put(msg);
    test(msg!=null, "EmailMessage (No Args) found: "+msg.getId());
    test(msg.getStatus() == Status.UNSENT, "EmailMessage (No Args) status==UNSENT: "+msg.getStatus());
    test(subjectResolved_.equals(msg.getSubject()), "EmailMessage (No Args) subject=="+subjectResolved_+": "+msg.getSubject());
    test("Body: args1_not_replaced".equals(msg.getBody()), "EmailMessage (No Args) Body: args1_not_replaced: "+msg.getBody());

    // Args
    template.setBody("Body: {{args1}}");
    template = (EmailTemplate) ((DAO) x.get("emailTemplateDAO")).put(template).fclone();
    args = new HashMap();
    args.put("subject", subject_);
    args.put("args1", "args1_resolved");
    args.put("template", template.getId());
    msg = new EmailMessage();
    msg.setTo(new String[] { "another@example.com" });
    msg.setUser(user_.getId());
    msg.setTemplateArguments(args);
    msg = (EmailMessage) ((DAO) x.get("emailMessageDAO")).put(msg);
    test(msg != null, "EmailMessage (Args) found: "+msg.getId());
    test(msg.getStatus() == Status.UNSENT, "EmailMessage (Args) status==UNSENT: "+msg.getStatus());
    test(subjectResolved_.equals(msg.getSubject()), "EmailMessage (Args) subject=="+subjectResolved_+": "+msg.getSubject());
    String[] to = msg.getTo();
    test(to != null && to[0].equals("another@example.com"), "EmailMessage (Args) to[0]==another@example.com");
    test("Body: args1_resolved".equals(msg.getBody()), "EmailMessage (Args) Body: args1_resolved: "+msg.getBody());
       `
    // },
    // {
    //   description: '',
    //   name: 'teardown',
    //   args: 'X x',
    //   javaCode: `
    //   `
    }
  ]
});
