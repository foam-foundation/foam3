/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.util',
  name: 'PhoneNumberUtil',

  documentation: 'Phone number formatting helper/support methods',

  static: [
    {
      name: 'internationalize',
      args: 'String phoneNumber',
      type: 'String',
      documentation: `Converts a phone number to international format.
      Removes the leading '0' after the country code if present.
      Example: +44-01234567890 -> +441234567890
      If the phone number doesnt contain a hyphen, returns the original number unchanged.`,
      code: function(phoneNumber) {
        var parts = phoneNumber.split('-');
        if (parts.length !== 2) return phoneNumber;
        
        if (parts[1].startsWith('0')) {
          parts[1] = parts[1].substring(1);
        }
        return parts[0] + parts[1];
      },
      javaCode: `
        String[] parts = phoneNumber.split("-");
        if ( parts.length != 2 ) return phoneNumber;
        
        if ( parts[1].startsWith("0") ) {
          parts[1] = parts[1].substring(1);
        }
        return parts[0] + parts[1];
      `
    },
    {
      name: 'localize',
      args: 'String phoneNumber',
      type: 'String',
      documentation: `Extracts the local part of a phone number, removing the country code.
      Example: +44-01234567890 -> 01234567890
      If the phone number doesnt contain a hyphen, returns the original number unchanged.`,
      code: function(phoneNumber) {
        var hyphenIndex = phoneNumber.indexOf("-");
        if (hyphenIndex === -1) {
          return phoneNumber;
        }
        
        return phoneNumber.substring(hyphenIndex + 1);
      },
      javaCode: `
        int hyphenIndex = phoneNumber.indexOf("-");
        if ( hyphenIndex == -1 ) {
          return phoneNumber;
        }

        return phoneNumber.substring(hyphenIndex + 1);
      `
    }
  ]
});