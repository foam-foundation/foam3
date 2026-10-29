/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth',
  name: 'BadLoginAccountLockoutAuthService',
  extends: 'foam.core.auth.ProxyAuthService',

  documentation: `
    Locks a User out of login for lockoutDuration after maxAttempts consecutive
    wrong passwords, as PCI DSS 8.3.4 requires (at most 10 attempts, locked for
    at least 30 minutes). While locked, even the correct password is refused.
    State is kept in memory only, so restarting the server clears every lock.
    A successful login clears the User's count.
  `,

  implements: [
    'foam.core.auth.EnabledAware'
  ],

  imports: [
    'UniqueUserService uniqueUserService'
  ],

  javaImports: [
    'foam.core.logger.Loggers',
    'java.util.Map',
    'java.util.concurrent.ConcurrentHashMap'
  ],

  properties: [
    {
      name: 'enabled',
      class: 'Boolean',
      value: true
    },
    {
      name: 'maxAttempts',
      class: 'Int',
      value: 10
    },
    {
      name: 'lockoutDuration',
      class: 'Duration',
      value: 1800000 // 30 minutes
    }
  ],

  javaCode: `
    // A User's failure count, and the time their lock ends (0 when not locked).
    protected static class Attempts {
      final int  count;
      final long lockedUntil;

      Attempts(int count, long lockedUntil) {
        this.count       = count;
        this.lockedUntil = lockedUntil;
      }
    }

    // Keyed by User id rather than the login identifier, so that failures by
    // email and by username both count against the same account.
    protected Map<Long, Attempts> attempts_ = new ConcurrentHashMap<>();
  `,

  methods: [
    {
      name: 'login',
      javaCode: `
      if ( ! getEnabled() ) return super.login(x, identifier, password);

      // An unknown identifier has no account to lock, and is left to the
      // delegate to reject; skipping it also keeps the map bounded by real users.
      User user = getUniqueUserService().getUser(x, identifier);
      if ( user == null ) return super.login(x, identifier, password);

      long     id  = user.getId();
      Attempts old = attempts_.get(id);
      if ( old != null && old.lockedUntil > System.currentTimeMillis() ) {
        throw new AccountLockedException();
      }

      try {
        User ret = super.login(x, identifier, password);
        attempts_.remove(id);
        return ret;
      } catch (InvalidPasswordException e) {
        // A failure after an expired lock starts a fresh count at 1.
        Attempts a = attempts_.compute(id, (k, v) -> {
          int count = v == null || v.lockedUntil != 0 ? 1 : v.count + 1;
          return new Attempts(count, count >= getMaxAttempts() ? System.currentTimeMillis() + getLockoutDuration() : 0);
        });
        if ( a.lockedUntil == 0 ) throw e;

        Loggers.logger(getX(), this).warning("Login locked after failed attempts", id, a.count);
        throw new AccountLockedException(e);
      }
      `
    }
  ]
});
