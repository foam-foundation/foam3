/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.er',
  name: 'EventRecordDAO',
  extends: 'foam.dao.ProxyDAO',

  javaImports: [
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.om.OMLogger'
  ],

  methods: [
    {
      name: 'put_',
      javaCode: `
        Logger      logger  = (Logger) x.get("logger");
        EventRecord er      = (EventRecord) getDelegate().put_(x, obj);
        var         summary = er.toLogSummary();

        try {
          er = (EventRecord) getDelegate().put_(x, obj);
        } catch (Throwable t) {
          Loggers.logger(x, this).error(t);
        }

        switch ( er.getSeverity().getOrdinal() ) {
          case 0:
            if ( er.getException() != null ) {
              logger.debug(summary, (Throwable) er.getException());
            } else {
              logger.debug(summary);
            }
          break;

          case 1:
            if ( er.getException() != null ) {
              logger.info(summary, (Throwable) er.getException());
            } else {
              logger.info(summary);
            }
          break;

          case 2:
            if ( er.getException() != null ) {
              logger.warning(summary, (Throwable) er.getException());
            } else {
              logger.warning(summary);
            }
          break;

          case 3:
            if ( er.getException() != null ) {
              logger.error(summary, (Throwable) er.getException());
            } else {
              logger.error(summary);
            }
          break;
        }

        ((OMLogger) x.get("OMLogger")).log(er.alarmSummary());

        return er;
      `
    }
  ]
});
