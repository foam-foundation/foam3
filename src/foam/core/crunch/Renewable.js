/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.core.crunch',
  name: 'Renewable',
  abstract: true,
  extends: 'foam.lang.ContextAware',

  javaImports: [
    'foam.lang.ContextAware',
    'foam.lang.PropertyInfo',
    'foam.lang.X',
    'foam.lang.XLocator',
    'foam.dao.DAO',
    'static foam.mlang.MLang.EQ',
    'static foam.mlang.MLang.OR',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.time.TimeZone',
    'foam.util.SafetyUtil',
    'static foam.util.DateUtil.getTimeZoneId',
    'java.time.*',
    'java.time.temporal.*',
    'java.util.Date'
  ],

  sections: [
    { name: 'renewableSection' }
  ],

  properties: [
    {
      class: 'Reference',
      of: 'foam.time.TimeZone',
      name: 'timeZone',
      order: 0,
      value: 'GMT',
      section: 'renewableSection'
    },
    {
      name: 'expiry',
      class: 'DateTime',
      documentation: `Datetime of when capability is no longer valid. Explicitly set, or calculated from period and periodTimeUnit`,
      includeInDigest: true,
      section: 'renewableSection',
      javaPostSet: 'reset();'
    },
    {
      name: 'expiryPeriod',
      class: 'Int',
      documentation: `The number of TimeUnits to calculate expiry date.
      NOTE: existing logic - The UserCapabilityJunction object will have its expiry configured to a DateTime based on the lower value of the two, expiry and duration`,
      aliases: ['duration'],
      includeInDigest: true,
      section: 'renewableSection',
      javaPostSet: 'reset();'
    },
    {
      documentation: 'Unit of Duration',
      name: 'expiryPeriodTimeUnit',
      class: 'Enum',
      of: 'foam.time.TimeUnit',
      value: 'DAY',
      includeInDigest: true,
      section: 'renewableSection',
      javaPostSet: 'reset();'
    },
    {
      name: 'gracePeriod',
      class: 'Int',
      documentation: `Time capability can be renewed after capability expires.  User keeps permissions granted by the capability during the grace period, afterwhich the UCJ status will be EXPIRED.`,
      includeInDigest: true,
      section: 'renewableSection',
      javaPostSet: 'reset();'
    },
    {
      documentation: 'Unit of Grace Period',
      name: 'gracePeriodTimeUnit',
      class: 'Enum',
      of: 'foam.time.TimeUnit',
      value: 'DAY',
      includeInDigest: true,
      section: 'renewableSection',
      javaPostSet: 'reset();'
    },
    {
      documentation: 'Can this Capability be renewed at some time',
      name: 'isRenewable',
      class: 'Boolean',
      storageTransient: true,
      section: 'renewableSection',
      javaGetter: `
      if ( ! isRenewableIsSet_ ) {
        foam.lang.X x = foam.lang.XLocator.get();
        isRenewable_ = isNotYetInRenewalPeriod(x) ||
                         isInRenewalPeriod(x) ||
                         isInGracePeriod(x);
        isRenewableIsSet_ = true;
      }
      return isRenewable_;
      `
    },
    {
      documentation: 'Only true when currently in renewal or grace period',
      name: 'isInRenewable',
      class: 'Boolean',
      storageTransient: true,
      section: 'renewableSection',
      javaGetter: `
      if ( ! isInRenewableIsSet_ ) {
        foam.lang.X x = foam.lang.XLocator.get();
        isInRenewable_ = isInRenewalPeriod(x) ||
                           isInGracePeriod(x);
        isInRenewableIsSet_ = true;
      }
      return isInRenewable_;
      `
    },
    {
      name: 'renewalPeriod',
      class: 'Int',
      documentation: `Time capability can be renewed before capability expires. Also affects Renewal notification.`,
      value: 30,
      includeInDigest: true,
      section: 'renewableSection',
      javaPostSet: 'reset();'
    },
    {
      documentation: 'Unit of Grace Period',
      name: 'renewalPeriodTimeUnit',
      class: 'Enum',
      of: 'foam.time.TimeUnit',
      value: 'DAY',
      includeInDigest: true,
      section: 'renewableSection',
      javaPostSet: 'reset();'
    },
    {
      name:'lastNotification',
      class: 'DateTime',
      documentation: 'Time user was notified that this Renewable can be renewed.',
      section: 'renewableSection'
    }
  ],

  methods: [
    {
      documentation: `On change of expiry, renewal, grace properties reset isSet`,
      name: 'reset',
      javaCode: `
      clearIsRenewable();
      `
    },
    {
      name: 'calculateDate',
      args: 'X x, Date from, int increment, foam.time.TimeUnit timeUnit',
      type: 'Date',
      javaCode: `
      if ( increment == 0 ) {
        return from;
      }

      var zone = getTimeZoneId(x, getTimeZone());

      LocalDateTime last = null;
      if ( from == null ) {
        // REVIEW: consider setting to startOfDay for YEAR,MONTH,DAY units
        last = LocalDateTime.now(zone);
      } else {
        last = LocalDateTime.ofInstant(from.toInstant(), zone);
      }
      var time = last;

      switch (timeUnit) {
        case YEAR:
          time = time.plusYears(increment);
          break;
        case MONTH:
          time = time.plusMonths(increment);
          break;
        case HOUR:
          time = time.plusHours(increment);
          break;
        case MINUTE:
          time = time.plus(increment, ChronoUnit.MINUTES);
          break;
        case SECOND: // for testing
          time = time.plus(increment, ChronoUnit.SECONDS);
          break;
        default: // case DAY:
          time = time.plusDays(increment);
          break;
      }

      return Date.from(time.atZone(zone).toInstant());
      `
    },
    {
      documentation: 'Before expiry, after renewable',
      name: 'isInRenewalPeriod',
      args: 'X x',
      type: 'Boolean',
      javaCode: `
      if ( getExpiry() == null ) return false;
      if ( getRenewalPeriod() == 0 ) return false;
      if ( this instanceof UserCapabilityJunction &&
           ((UserCapabilityJunction) this).getStatus() != CapabilityJunctionStatus.GRANTED ) return false;

      var zone = getTimeZoneId(x, getTimeZone());
      Date now = Date.from(LocalDateTime.now(zone).atZone(zone).toInstant());
       Date renewable = calculateDate(x, getExpiry(), -1 * getRenewalPeriod(), getRenewalPeriodTimeUnit());
      // r <= n <= e
      return ! now.before(renewable) &&
             ! now.after(getExpiry());
      `
    },
    {
      documentation: 'Before expiry, before renewable',
      name: 'isNotYetInRenewalPeriod',
      args: 'X x',
      type: 'Boolean',
      javaCode: `
      if ( getExpiry() == null ) return false;
      if ( getRenewalPeriod() == 0 ) return false;
      if ( this instanceof UserCapabilityJunction &&
           ((UserCapabilityJunction) this).getStatus() != CapabilityJunctionStatus.GRANTED ) return false;

      var zone = getTimeZoneId(x, getTimeZone());
      Date now = Date.from(LocalDateTime.now(zone).atZone(zone).toInstant());
      if ( now.before(getExpiry())) {
        Date renewable = calculateDate(x, getExpiry(), -1 * getRenewalPeriod(), getRenewalPeriodTimeUnit());
        // n < r
        return now.before(renewable);
      }
      return false;
      `
    },
    {
      documentation: 'After expiry, before grace',
      name: 'isInGracePeriod',
      args: 'X x',
      type: 'Boolean',
      javaCode: `
      if ( getExpiry() == null ) return false;
      if ( getGracePeriod() == 0 ) return false;
      if ( this instanceof UserCapabilityJunction &&
           ((UserCapabilityJunction) this).getStatus() != CapabilityJunctionStatus.GRANTED ) return false;

      Date grace = calculateDate(x, getExpiry(), getGracePeriod(), getGracePeriodTimeUnit());
      var zone = getTimeZoneId(x, getTimeZone());
      Date now = Date.from(LocalDateTime.now(zone).atZone(zone).toInstant());
      // e <= n <= g
      return ! now.before(getExpiry()) &&
             ! now.after(grace);
      `
    },
    {
      documentation: 'Copy Renewable properties from another Renewable, if and only if this Renewable is not explicitly configured.',
      name: 'copyFromRenewable',
      args: 'X x, Renewable ren',
      type: 'foam.core.crunch.Renewable',
      javaCode: `
      // if ( ! EXPIRY.isDefaultValue(this) ) return this;
      // var props = getClassInfo().getAxiomsByClass(Renewable.class);
      // var i     = props.iterator();
      // while ( i.hasNext() ) {
      //   PropertyInfo prop = i.next();
      //   if ( ! prop.getStorageTransient() ) {
      //     prop.set(this, prop.get(ren));
      //   }
      // }

      if ( getExpiry() != null ) return this;
      if ( ! this.getTimeZone().equals("GMT") ) {
        this.setTimeZone(ren.getTimeZone());
      }
      this.setExpiry(ren.getExpiry());
      this.setExpiryPeriod(ren.getExpiryPeriod());
      this.setExpiryPeriodTimeUnit(ren.getExpiryPeriodTimeUnit());
      this.setRenewalPeriod(ren.getRenewalPeriod());
      this.setRenewalPeriodTimeUnit(ren.getRenewalPeriodTimeUnit());
      this.setGracePeriod(ren.getGracePeriod());
      this.setGracePeriodTimeUnit(ren.getGracePeriodTimeUnit());
      return (Renewable) this;
      `
    },
    {
      documentation: 'Time remaining in milliseconds. Either renewal - before expiry, or grace - after expiry',
      name: 'getRenewableRemaining',
      args: 'X x',
      type: 'Long',
      javaCode: `
      if ( ! getIsRenewable() ) return 0L;

      var zone = getTimeZoneId(x, getTimeZone());
      Date now = Date.from(LocalDateTime.now(zone).atZone(zone).toInstant());
      if ( ! now.after(getExpiry()) ) {
        return getExpiry().getTime() - now.getTime();
      }
      Date grace = calculateDate(x, getExpiry(), getGracePeriod(), getGracePeriodTimeUnit());
      if ( ! now.after(grace) ) {
        return grace.getTime() - now.getTime();
      }
      return 0L;
      `
    }
  ]
});
