/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth',
  name: 'PasswordPolicy',

  implements: [
    'foam.core.auth.EnabledAware'
  ],

  documentation: 'A Password Policy for a Group.',

  javaImports: [
    'foam.util.Password',
    'foam.util.SafetyUtil',
    'foam.dao.DAO',
    'java.util.List',
    'foam.dao.Sink',
    'foam.dao.ArraySink'
  ],

  constants: [
    {
      name: 'MIN_PASSWORD_LENGTH',
      type: 'Long',
      value: 12
    }
  ],

  properties: [
    {
      class: 'Boolean',
      name: 'enabled'
    },
    {
      class: 'Long',
      name: 'minLength',
      documentation: 'Minimum length of the password.',
      min: this.MIN_PASSWORD_LENGTH,
      factory: function() {
        return this.MIN_PASSWORD_LENGTH;
      },
      javaFactory: `
        return MIN_PASSWORD_LENGTH;
      `
    },
    {
      class: 'Long',
      name: 'minDigits',
      documentation: 'Minimum number of digits (0-9) the password must contain. PCI DSS 8.3.6 requires at least 1.',
      min: 0
    },
    {
      class: 'Long',
      name: 'minLetters',
      documentation: 'Minimum number of letters the password must contain. PCI DSS 8.3.6 requires at least 1.',
      min: 0
    },
    {
      class: 'Long',
      name: 'priorPasswordsToCheckCount',
      value: 4,
      min: 0,
      max: 10,
      documentation: `
        User passwords are hashed and the hash is kept for historical record up to a maximum of 10 previous entries per user.
        Setting priorPasswordsToCheckCount to a value greater than zero will enable a check on that many previous password entries
        when resetting the users passwords to prevent them from using the same password again.
        `
    },
    'blackList'
  ],

  methods: [
    {
      name: 'validate',
      args: [
        {
          name: 'x',
          type: 'Context'
        },
        {
          name: 'user',
          type: 'User'
        },
        {
          name: 'potentialPassword',
          javaType: 'String'
        }
      ],
      code: function(x, potentialPassword) {
        return x.commonPasswordDAO.find(potentialPassword.toLowerCase());
      },
      javaCode: `
        // check if this policy is enabled
        if ( ! this.getEnabled() ) {
          return; // password is valid by default
        }

        // check minimum length
        int minLength = (int) Math.max(this.getMinLength(), MIN_PASSWORD_LENGTH);
        String minLengthRegex = "^.{" + minLength + ",}$";
        if ( SafetyUtil.isEmpty(potentialPassword) || potentialPassword.length() < minLength ) {
          throw new RuntimeException("Password must be at least " + minLength + " characters long.");
        }

        // check minimum digits
        if ( potentialPassword.chars().filter(Character::isDigit).count() < this.getMinDigits() ) {
          throw new RuntimeException("Password must contain at least " + this.getMinDigits() + " digit(s).");
        }

        // check minimum letters
        if ( potentialPassword.chars().filter(Character::isLetter).count() < this.getMinLetters() ) {
          throw new RuntimeException("Password must contain at least " + this.getMinLetters() + " letter(s).");
        }

        // check weak password
        DAO commonPasswordDAO = (DAO) x.get("commonPasswordDAO");
        if ( commonPasswordDAO.find(potentialPassword.toLowerCase()) != null ) {
          throw new RuntimeException("Password is weak.");
        }

        // check password history
        if ( this.getPriorPasswordsToCheckCount() > 0 && user != null ) {
          PriorPassword[] priorPasswords = user.getPasswordHistory();
          int maxCount = Math.min((int) this.getPriorPasswordsToCheckCount(), priorPasswords.length);
          for ( int i = 0; i < maxCount; i++ ) {
            if ( Password.verify(potentialPassword, priorPasswords[priorPasswords.length - (1 + i) ].getPassword()) ) {
              throw new RuntimeException("Password must be different from previous " + this.getPriorPasswordsToCheckCount() + " passwords");
            }
          }
        }

        return;
      `
    }
  ]
});
