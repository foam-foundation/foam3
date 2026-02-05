/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang',
  name: 'Currency',
  extends: 'foam.lang.Unit',

  documentation: 'The base model for storing, using and managing currency information.',

  javaImports: [
    'foam.lang.XLocator',
    'static foam.i18n.TranslationService.t',
    'foam.util.SafetyUtil'
  ],

  imports: [
    'translationService'
  ],

  tableColumns: [
    'name',
    'id',
    'symbol',
    'emoji'
  ],

  constants: {
    FORMATTER_CACHE: {}
  },

  axioms: [
    {
      buildJavaClass: function(cls) {
        cls.extras.push(`
          public String format(X x, long amount) {
            if ( ! foam.util.SafetyUtil.isEmpty(getSymbol()) ) {
              // Show only symbol 
              return format(x, amount, true, false);
            } else {
              // Show only ID
              return format(x, amount, false, true);
            }
          }
        `);
      }
    }
  ],

  properties: [
    [ 'precision', 2 ],
    {
      class: 'Long',
      name: 'numericCode',
      shortName: 'nc',
      documentation: 'The numeric code associated with a type of currency.',
      required: true
    },
    {
      class: 'String',
      name: 'delimiter',
      shortName: 'd',
      value: ',',
      documentation: 'The character used to delimit groups of 3 digits.',
      required: true
    },
    {
      class: 'String',
      name: 'decimalCharacter',
      shortName: 'dc',
      value: '.',
      documentation: 'The character used as a decimal.',
      required: true
    },
    {
      class: 'String',
      name: 'symbol',
      shortName: 's',
      documentation: 'The symbol used for the type of currency. Eg: $ for CAD.',
      required: true
    },
    {
      class: 'String',
      name: 'leftOrRight',
      shortName: 'lr',
      documentation: `The side of the digits that the symbol should be displayed on.`,
      required: true,
      value: 'left',
      validateObj: function(leftOrRight) {
        if ( leftOrRight !== 'left' && leftOrRight !== 'right' ) return `Property 'leftOrRight' must be set to either "left" or "right".`;
      }
    },
    {
      class: 'String',
      name: 'flagImage',
      documentation: `The flag image used in relation to currencies from countries currently
        supported by the platform.`,
    },
    {
      class: 'String',
      name: 'colour',
      shortName: 'c',
      value: '#406dea',
      documentation: `The colour that represents this currency`
    },
    {
      class: 'String',
      name: 'emoji',
      value: '💰'
    },
    {
      class: 'Boolean',
      name: 'showSpace',
      shortName: 'ss',
      documentation: `Determines whether there is a space between the symbol and
        the number when the currency is displayed.
      `,
      value: false,
      required: true
    },
    {
      class: 'Boolean',
      name: 'insertDelimiter',
      documentation: `Determines whether to insert the 'delimiter'
        between groups of three numerals`,
      value: true
    }
  ],

  methods: [
    {
      name: 'toSummary',
      type: 'String',
      documentation: `When using a reference to the currencyDAO, the labels associated
        to it will show a chosen property rather than the first alphabetical string
        property. In this case, we are using the id.
      `,
      code: function(x) {
        return this.id + " - " + this.translationService.getTranslation(foam.locale, `${this.id}.name`,this.name);
      },
      javaCode: `
        if ( foam.util.SafetyUtil.isEmpty(getId()) || foam.util.SafetyUtil.isEmpty(getName()) )
          return "";
        return getId() + " - " + getName();
      `
    },
    {
      name: 'format',
      code: function(amount, hideId, hideSymbol) {
        /**
         * Given a number, display it as a currency using the appropriate
         * precision, decimal character, delimiter, symbol, and placement
         * thereof.
         *
         * With the new home denomination feature, we will append (if left) or
         * prepend (if right) the alphabetic code if the currency's alphabetic code
         * is not equal to the homeDenomination
         *
         */
        // Not using foam locale as foam locale can be reset to a different value mid-session based on translation available
        // using browser default formatting when available 
        if ( navigator.language ) {
          amount = Number(amount);
          let opts = {
            minimumFractionDigits: this.precision,
            maximumFractionDigits: this.precision
          }
          if ( ! hideSymbol ) {
            opts.style = 'currency';
            opts.currency = this.id;
          }
          let formatterId = navigator.language + '-' + this.id;
          if ( this.FORMATTER_CACHE[formatterId] ) {
            return this.FORMATTER_CACHE[formatterId].format(amount);
          } else {
            let formatter = new Intl.NumberFormat(navigator.language, opts);
            this.FORMATTER_CACHE[formatterId] = formatter;
            return formatter.format(amount);
          }
        }
        // TODO: Maybe consider deleting the custom formatting logic below
        amount = Math.round(amount);
        var isNegative = amount < 0;
        amount = amount.toString();
        if ( isNegative ) amount = amount.substring(1);
        while ( amount.length < this.precision ) amount = '0' + amount;
        var beforeDecimal = amount.substring(0, amount.length - this.precision);
        var formatted = isNegative ? '-' : '';

        var internalHideId = hideId ?? this.symbol !== '' ? true : false;
        if ( ! internalHideId && this.leftOrRight === 'right' ) {
          formatted += this.id;
          formatted += ' ';
        }

        if ( ! hideSymbol && this.leftOrRight === 'left' ) {
          formatted += this.symbol;
          if ( this.showSpace ) formatted += ' ';
        }

        var delimiter = this.translationService.getTranslation(foam.locale, 'Currency.delimiter', this.delimiter);
        var decimal   = this.translationService.getTranslation(foam.locale, 'Currency.decimalCharacter', this.decimalCharacter)

        if ( this.insertDelimiter ) {
          formatted += beforeDecimal.replace(/\B(?=(\d{3})+(?!\d))/g, delimiter) || '0';
        } else {
          formatted += beforeDecimal || '0';
        }

        if ( this.precision > 0 ) {
          formatted += decimal;
          formatted += amount.substring(amount.length - this.precision);
        }

        if ( ! hideSymbol && this.leftOrRight === 'right' ) {
          if ( this.showSpace ) formatted += ' ';
          formatted += this.symbol;
        }
        if ( ! internalHideId && this.leftOrRight === 'left' ) {
          formatted += ' ';
          formatted += this.id;
        }

        return formatted;
      },
      args: [
        {
          name: 'x',
          type: 'Context'
        },
        {
          class: 'foam.lang.UnitValue',
          name: 'amount'
        },
        {
          class: 'Boolean',
          name: 'hideId',
          documentation: 'If true, will not add ID to formatted currency'
        },
        {
          class: 'Boolean',
          name: 'hideSymbol',
          documentation: 'If true, will not add symbol to formatted currency'
        }
      ],
      type: 'String',
      javaCode: `
        Boolean isNegative = amount < 0;
        String  amountStr  = Long.toString(amount);
        if ( isNegative ) amountStr = amountStr.substring(1);
        while ( amountStr.length() < this.getPrecision() ) {
          amountStr = "0" + amountStr;
        }
        String beforeDecimal = amountStr.substring(0, amountStr.length() - this.getPrecision());
        String formatted = isNegative ? "-" : "";

        if ( ! hideSymbol && SafetyUtil.equals(this.getLeftOrRight(), "left") ) {
          formatted += this.getSymbol();
          if ( this.getShowSpace() ) {
            formatted += " ";
          }
        }

        if ( ! hideId && SafetyUtil.equals(this.getLeftOrRight(), "right") ) {
          formatted = formatted + " " + this.getId();
        }

        String delimiter = getDelimiter();
        String decimalCharacter = getDecimalCharacter();
        try {
          delimiter = t(x, "Currency.delimiter", this.getDelimiter());
          decimalCharacter = t(x, "Currency.decimalCharacter", this.getDecimalCharacter());
        } catch (NullPointerException e) {
          foam.core.logger.Loggers.logger(x, this).debug(e);
        }

        if ( getInsertDelimiter() ) {
          formatted += beforeDecimal.length() > 0 ?
            beforeDecimal.replaceAll("\\\\B(?=(\\\\d{3})+(?!\\\\d))", delimiter) :
            "0";
        } else {
          formatted += beforeDecimal.length() > 0 ? beforeDecimal : "0";
        }

        if ( this.getPrecision() > 0 ) {
          formatted += decimalCharacter;
          formatted += amountStr.substring(amountStr.length() - getPrecision());
        }

        if ( ! hideId && SafetyUtil.equals(getLeftOrRight(), "left") ) {
          formatted += " " + getId();
        }
        if ( ! hideSymbol && SafetyUtil.equals(getLeftOrRight(), "right") ) {
          if ( getShowSpace() ) {
            formatted += " ";
          }
          formatted += getSymbol();
        }

        return formatted;
      `
    },
    {
      name: 'formatPrecision',
      args: 'Long amount',
      type: 'String',
      documentation: `
        Given a number, display it as a currency using the appropriate
        precision. Use a period '.' for the decimal place and do not
        include commas or currency symbols.
        Suitable for use when exporting to CSV.
      `,
      code: function(amount) {
        return this.floatAmount(amount).toFixed(this.precision);
      },
      javaCode: `
        return String.format("%." + getPrecision() + "f", floatAmount(amount));
      `
    },
    {
      name: 'floatAmount',
      args: 'Long amount',
      type: 'Double',
      documentation: `
        Convert from internal long format to that of the currency
      `,
      code: function(amount) {
        return amount / Math.pow(10, this.precision);
      },
      javaCode: `
        return Double.valueOf(amount) / (double) Math.pow(10, getPrecision());
      `
    }
  ]
});