/**
 * @license
 * Copyright 2016 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang',
  name: 'ValidationPredicate',

  properties: [
    {
      class: 'String',
      name: 'query'
    },
    {
      class: 'StringArray',
      name: 'args',
      factory: function() {
        // Determine args by parsing the query
        var argSet = {};
        var prop   = this.prop;
        var cls    = prop.sourceCls_ || foam.lookup(prop.forClass_);
        var parser = foam.parse.FScriptParser.create({of: cls, thisValue: prop});
        parser.argSet = argSet; // Can't do in constructor because FSP is a Multiton on thisValue
        parser.parseString(this.query);
        return Object.keys(argSet);
      }
    },
    {
      name: 'prop',
      documentation: 'Property which owns this ValidationPredicate. Either prop are args must be provided.'
    },
    {
      class: 'Function',
      // TODO: it isn't normal for JS functions to have a 'js' prefix
      // TODO: poor choice of name, should be something with 'assert'
      name: 'jsFunc',
      expression: function(query, jsErr) {
        var predicate;
        return function(obj) {
          if ( ! predicate ) {
            predicate = foam.mlang.predicate.FScript.create({query: query, prop: this});
          }

          if ( ! predicate.f(obj) ) {
            const prop = this.forClass_ + '.' + foam.String.constantize(this.name);
            console.debug(prop, 'validation failed:', query)
            return jsErr(obj);
          }
        };
      }
    },
    {
      class: 'String',
      name: 'errorMessage',
      documentation: `
        Provide feedback to the user via a Message.
        To use this, provide the name of the Message you wish to add.
        When both errorString and errorMessage are specified, the errorMessage will be used.
      `
    },
    {
      class: 'String',
      name: 'errorString',
      // TODO: make deprecated, makes i18n difficult
      documentation: `
        Provide feedback to the user via a String.
        When both errorString and errorMessage are specified, the errorMessage will be used.
      `
    },
    {
      class: 'Function',
      // TODO: it isn't normal for JS functions to have a 'js' prefix
      name: 'jsErr',
      expression: function(errorString, errorMessage) {
        return function(obj) {
          if ( errorMessage && obj ) {
            if ( obj[errorMessage] ) return obj[errorMessage];
            console.warn('Error finding message', errorMessage, '. No such message on object.', obj);
          }
          return errorString;
        }
      }
    }
  ],

  methods: [
    function createErrorSlotFor(data) {
      // ???: Is this ever used?
      debugger;

      return data.slot(this.jsFunc, this.args);
      /*
      return this.ExpressionSlot.create({
        args: this.args.map(a => data[a+'$' ]),
        code: this.jsFunc.bind(data)
      });
      */
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'ValidationPredicateArray',
  extends: 'foam.lang.FObjectArray',

  properties: [
    [ 'of', 'foam.lang.ValidationPredicate' ],
    [ 'postSet', function(o, n) { n && n.forEach(vp => vp.prop = this); } ],
    // We override 'compare' here because we need to avoid infinite recursion
    // that occurs when a validation predicate for a given property contains a
    // reference to the property itself.
    // This is an incorrect implementation of compare since it will always
    // return a match, even if the validation predicates are different. It
    // would be preferable to find a way to deal with circular references.
    [ 'compare', function() { return 0; } ]
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'PropertyValidationRefinement',
  refines: 'foam.lang.Property',

  messages: [
    { name: 'REQUIRED', message: 'Required' }
  ],

  axioms: [
    {
      name: 'invalidateInternalValidateObj',
      order: 1000,
      installInClass: function(cls) {
        let oldCode = cls.prototype.createChildProperty_;
        let newChildProptery_ = foam.lang.Method.create({
          name: 'createChildProperty_',
          code: function(child) {
            let ret = oldCode.call(this, child);
            ret.clearProperty('internalValidateObj');
            return ret;
          }
        }, this);
        cls.installAxiom(newChildProptery_);
      }
    }
  ],

  properties: [
    {
      class: 'ValidationPredicateArray',
      name: 'validationPredicates',
      documentation: 'Developer supplied validationPredicates.'
    },
    {
      class: 'ValidationPredicateArray',
      name: 'internalValidationPredicates',
      documentation: 'ValidationPredicates supplied by Property types for internal constrains like min/max.'
    },
    {
      name: 'validateObj'
    },
    {
      name: 'internalValidateObj',
      factory: function() {
        var name     = this.name;
        var label    = this.label;
        var required = this.required;
        var self     = this;
        var vps      = [ ...this.internalValidationPredicates, ...this.validationPredicates ];

        if ( vps.length ) {
          // args: property to ExpressionSlot, which is an array of slots
          var args = foam.Array.unique(vps.map(vp => vp.args).flat());

          return [args, function() {
            if ( required && self.isDefaultValue(this[name]) ) {
              return self.REQUIRED;
            }
            // let err = null;
            for ( var i = 0 ; i < vps.length ; i++ ) {
              var vp = vps[i];
              // if ( vp.jsFunc.call(self, this) ) err = (err ? err + ' ' : '') + vp.jsErr.call(this, this);
              if ( vp.jsFunc.call(self, this) ) return vp.jsErr.call(this, this);
            }
            // return err;
          }];
        }

        return ! required ? null : [[name],
          function() {
            const axiom = this.cls_.getAxiomByName(name);
            return axiom.isDefaultValue(this[name]) && self.REQUIRED;
            // TODO: normalise all reqired-esque predicates to use the same message, currently split between "<prop> required" and "Please enter <prop>"
          }];
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'StringPropertyValidationRefinement',
  refines: 'foam.lang.String',

  messages: [
    { name: 'REQUIRED',          message: 'Required' },
    { name: 'SHOULD_BE_LEAST',   message: 'should be at least' },
    { name: 'SHOULD_BE_MOST',    message: 'should be at most' },
    { name: 'SHOULD_BE_BETWEEN', message: 'should be between' },
    { name: 'AND',               message: 'and' },
    { name: 'CHARACTER',         message: 'character' },
    { name: 'CHARACTERS',        message: 'characters' },

    // To be populated by locale where required
    { name: 'LOCALE_VALIDATION_REGEX',          message: '' },
    { name: 'LOCALE_VALIDATION_ERROR_MESSAGE',  message: '' }
  ],

  properties: [
    'minLength',
    'maxLength',
    {
      name: 'internalValidationPredicates',
      factory: function() {
        var a = [];

        if ( this.localeValidationPredicate ) {
          a.push(this.localeValidationPredicate);
        }

        // TODO: internationalize error messages
        if ( foam.Number.isInstance(this.minLength) && foam.Number.isInstance(this.maxLength) ) {
          a.push({
            args: [ this.name ],
            query: 'thisValue.len>=' + this.minLength + '&&' + 'thisValue.len<=' + this.maxLength,
            errorString: `${this.label} ${foam.lang.String.SHOULD_BE_BETWEEN} ${this.minLength} ${foam.lang.String.AND} ${this.maxLength} ${this.maxLength > 1 ? foam.lang.String.CHARACTERS : foam.lang.String.CHARACTER}`
          });
        } else if ( foam.Number.isInstance(this.minLength) ) {
          a.push({
            args: [ this.name ],
            query: 'thisValue.len>=' + this.minLength,
            errorString: `${this.label} ${foam.lang.String.SHOULD_BE_LEAST} ${this.minLength} ${this.minLength > 1 ? foam.lang.String.CHARACTERS : foam.lang.String.CHARACTER}`
          });
        } else if ( foam.Number.isInstance(this.maxLength) ) {
          a.push({
            args: [ this.name ],
            query: 'thisValue.len<='+this.maxLength,
            errorString: `${this.label} ${foam.lang.String.SHOULD_BE_MOST} ${this.maxLength} ${this.maxLength > 1 ? foam.lang.String.CHARACTERS : foam.lang.String.CHARACTER}`
          });
        }

        return a;
      }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.lang.ValidationPredicate',
      name: 'localeValidationPredicate',
      factory: function() {
        if ( ! foam.lang.String.LOCALE_VALIDATION_REGEX ) return null;
        return {
          args: [ this.name ],
          query: 'thisValue !exists||thisValue~' + foam.lang.String.LOCALE_VALIDATION_REGEX,
          errorString: `${this.label} ${foam.lang.String.LOCALE_VALIDATION_ERROR_MESSAGE}`
        };
      }
    }
  ],

  methods: [
    function init() {
      // Needed for props that override the default validateObj
      // Clearing required to recheck predicate on property clone
      this.clearProperty('localeValidationPredicate')
      if ( this.hasOwnProperty('validateObj') && this.localeValidationPredicate ) {
        let currValidate = this.validateObj;
        let vp   = this.localeValidationPredicate;
        // Duplicates code from original ValidateObj
        let self = this;
        let args = [];
        let validateFn = currValidate;
        if ( typeof currValidate === 'function' ) {
          // Break apart old validate into args and code
          args = foam.Function.argNames(currValidate) || [];
        } else if ( Array.isArray(currValidate) ) {
          [ args, validateFn ] = currValidate;
        } else {
          args = [];
        }
        let allArgs = foam.Array.unique([...vp.args, ...args]);
        // set the hijacked validate
        this.validateObj = [allArgs, function() {
          if ( vp.jsFunc.call(self, this) ) return vp.jsErr.call(this, this);
          return validateFn?.apply(this, args.map(a => this[a]));
        }];
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'FObjectPropertyValidationRefinement',
  refines: 'foam.lang.FObjectProperty',

  messages: [
    { name: 'PLEASE_ENTER_VALID', message: 'Please enter valid' }
  ],

  properties: [
    {
      class: 'Boolean',
      name: 'autoValidate'
    },
    {
      name: 'internalValidateObj',
      expression: function(name, label, autoValidate) {
        if ( autoValidate ) {
          var self = this;
          return [
            [`${name}$errors_`],
            function(errs) {
              return errs ? `${self.PLEASE_ENTER_VALID} ${(label || name).toLowerCase()}` : null;
            }
          ];
        }
        return foam.lang.Property.INTERNAL_VALIDATE_OBJ.factory.apply(this, this.INTERNAL_VALIDATE_OBJ);
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'FObjectArrayValidationRefinement',
  refines: 'foam.lang.FObjectArray',

  messages: [
    { name: 'PLEASE_ENTER_VALID', message: 'Please enter valid' }
  ],

  properties: [
    {
      class: 'Boolean',
      name: 'autoValidate',
      documentation: `
        Enables default implementation for validateObj on this array property,
        which will invalidate the property when any FObject array element is
        invalid.
      `
    },
    {
      name: 'internalValidateObj',
      expression: function(name, label, autoValidate) {
        if ( autoValidate ) {
          var self = this;
          return [
            [`${name}$errors`],
            function(errs) {
              return errs ? `${self.PLEASE_ENTER_VALID} ${(label || name).toLowerCase()}` : null;
            }
          ];
        }
        return foam.lang.Property.INTERNAL_VALIDATE_OBJ.factory.apply(this, this.INTERNAL_VALIDATE_OBJ);
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'IntPropertyValidationRefinement',
  refines: 'foam.lang.Int',

  messages: [
    { name: 'AND',        message: 'and' },
    { name: 'SHOULD_BE',  message: 'should be' },
    { name: 'GTE',        message: 'greater than or equal to' },
    { name: 'LTE',        message: 'less than or equal to' }
  ],

  properties: [
    {
      name: 'internalValidationPredicates',
      factory: function() {
        if ( foam.Number.isInstance(this.min) && foam.Number.isInstance(this.max) )
          return [{
            args: [ this.name ],
            query: "thisValue>=" + this.min + "&&thisValue<=" + this.max,
            errorString: `${this.label} ${this.SHOULD_BE} ${this.GTE} ${this.min} ${this.AND} ${this.LTE} ${this.max}.`
          }];
        if ( foam.Number.isInstance(this.min) )
          return [{
            args: [ this.name ],
            query: "thisValue>=" + this.min,
            errorString: `${this.label} ${this.SHOULD_BE} ${this.GTE} ${this.min}.`
          }];
        if ( foam.Number.isInstance(this.max) )
          return [{
            args: [ this.name ],
            query: "thisValue<=" + this.max,
            errorString: `${this.label} ${this.SHOULD_BE} ${this.LTE} ${this.max}.`
          }];

        return [];
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.lang.internal',
  name: 'Errors',

  documentation: `
    A psedo-Property Axiom added to FObject which contains an object's validation errors.
    Adds the following attributes to an Object:
    <dl>
      <dt>errors_</dt><dd>list of current errors</dd>
      <dt>errors_$</dt><dd>Slot representation of errors_</dd>
      <dt>validateObject()</dt><dd>calls the validateObj() method of all property Axioms, allowing them to populate errors_</dd>
    </dl>
  `,

  properties: [
    [
      'name',
      'errors_'
    ]
  ],

  methods: [
    function installInProto(proto) {
      var self = this;
      Object.defineProperty(proto, 'errors_', {
        get: function() {
          return self.toSlot(this).get();
        },
        configurable: true,
        enumerable:   false
      });

      Object.defineProperty(proto, 'errors_$', {
        get: function() {
          return self.toSlot(this);
        },
        configurable: true,
        enumerable:   false
      });

      proto.describeErrors = function() {
        let a = (self.toSlot(this).get())?.map(a => {
          return { name: a[0].name, error: a[1], value: a[0].f(this) }
        }) ?? [];
        console.table(a);
      };
    },

    function toSlot(obj) {
      var slotName = this.slotName_ || ( this.slotName_ = this.name + '$' );
      var slot     = obj.getPrivate_(slotName);

      if ( ! slot ) {
        slot = this.createErrorSlot_(obj)
        obj.setPrivate_(slotName, slot);
      }

      return slot;
    },

     function createErrorSlot_(obj) {
      var validators, args = new Set();

      // Cache validators and args in the obj's cls_ because they can be reused for
      // all instances of the same class.
      if ( ! obj.cls_.private_.validators__ ) {
        validators = []; // [ property, errorSlot ] pairs
        args = new Set();

        obj.cls_.getAxiomsByClass(foam.lang.Property).forEach(p => {
          if ( p.validateObj         ) validators.push([p, p.validateObj]);
          if ( p.internalValidateObj ) validators.push([p, p.internalValidateObj]);
        });

        obj.cls_.private_.validators__    = validators;
      } else {
        validators = obj.cls_.private_.validators__;
      }

      // Upgrade validator functions to slots
      validators = validators.map(v => {
        let a = obj.slot(v[1]);
        args.add(a);
        return [v[0], a];
      });

      args = args.size ? [...args] : undefined;

      function validateObj() {
        var ret;

        validators.forEach(v => {
          var prop = v[0];
          var err  = v[1].get();
          if ( err ) (ret || (ret = [])).push([prop, err]);
        });

        return ret;
      }

      return foam.lang.ExpressionSlot.create({
        obj:  obj,
        code: validateObj,
        args: args
      });
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'ValidationFObjectRefinement',
  refines: 'foam.lang.FObject',

  axioms: [ foam.lang.internal.Errors.create() ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'EmailPropertyValidationRefinement',
  refines: 'foam.lang.EMail',

  messages: [
    { name: 'EMAIL_REQUIRED',       message: 'Email address required' },
    { name: 'VALID_EMAIL_REQUIRED', message: 'Valid email address required' }
  ],

  properties: [
    {
      class: 'ValidationPredicateArray',
      name: 'internalValidationPredicates',
      factory: function() {
        var a = [];
        a.push(
          {
            args: [ this.name ],
            query: 'thisValue==""||thisValue~/^\\S+@\\S+\\.\\S+$/',
            errorString: this.VALID_EMAIL_REQUIRED
          }
        );
        return a;
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'PhoneNumberRegexMixin',

  // Used in Both foam.lang.PhoneNumber and foam.core.auth.Phone
  constants: [
    {
      name: 'PHONE_NUMBER_REGEX',
      factory: () => /^(?:\+?)(999|998|997|996|995|994|993|992|991|990|979|978|977|976|975|974|973|972|971|970|969|968|967|966|965|964|963|962|961|960|899|898|897|896|895|894|893|892|891|890|889|888|887|886|885|884|883|882|881|880|879|878|877|876|875|874|873|872|871|870|859|858|857|856|855|854|853|852|851|850|839|838|837|836|835|834|833|832|831|830|809|808|807|806|805|804|803|802|801|800|699|698|697|696|695|694|693|692|691|690|689|688|687|686|685|684|683|682|681|680|679|678|677|676|675|674|673|672|671|670|599|598|597|596|595|594|593|592|591|590|509|508|507|506|505|504|503|502|501|500|429|428|427|426|425|424|423|422|421|420|389|388|387|386|385|384|383|382|381|380|379|378|377|376|375|374|373|372|371|370|359|358|357|356|355|354|353|352|351|350|299|298|297|296|295|294|293|292|291|290|289|288|287|286|285|284|283|282|281|280|269|268|267|266|265|264|263|262|261|260|259|258|257|256|255|254|253|252|251|250|249|248|247|246|245|244|243|242|241|240|239|238|237|236|235|234|233|232|231|230|229|228|227|226|225|224|223|222|221|220|219|218|217|216|215|214|213|212|211|210|98|95|94|93|92|91|90|86|84|82|81|66|65|64|63|62|61|60|58|57|56|55|54|53|52|51|49|48|47|46|45|44|43|41|40|39|36|34|33|32|31|30|27|20|7|1|0){1}(?:\-?)[0-9]{4,11}$/,
      javaFactory: `
        return "^(?:\\\\+?)(999|998|997|996|995|994|993|992|991|990|979|978|977|976|975|974|973|972|971|970|969|968|967|966|965|964|963|962|961|960|899|898|897|896|895|894|893|892|891|890|889|888|887|886|885|884|883|882|881|880|879|878|877|876|875|874|873|872|871|870|859|858|857|856|855|854|853|852|851|850|839|838|837|836|835|834|833|832|831|830|809|808|807|806|805|804|803|802|801|800|699|698|697|696|695|694|693|692|691|690|689|688|687|686|685|684|683|682|681|680|679|678|677|676|675|674|673|672|671|670|599|598|597|596|595|594|593|592|591|590|509|508|507|506|505|504|503|502|501|500|429|428|427|426|425|424|423|422|421|420|389|388|387|386|385|384|383|382|381|380|379|378|377|376|375|374|373|372|371|370|359|358|357|356|355|354|353|352|351|350|299|298|297|296|295|294|293|292|291|290|289|288|287|286|285|284|283|282|281|280|269|268|267|266|265|264|263|262|261|260|259|258|257|256|255|254|253|252|251|250|249|248|247|246|245|244|243|242|241|240|239|238|237|236|235|234|233|232|231|230|229|228|227|226|225|224|223|222|221|220|219|218|217|216|215|214|213|212|211|210|98|95|94|93|92|91|90|86|84|82|81|66|65|64|63|62|61|60|58|57|56|55|54|53|52|51|49|48|47|46|45|44|43|41|40|39|36|34|33|32|31|30|27|20|7|1|0){1}(?:\\\\-?)[0-9]{4,11}$";
      `
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'PhoneNumberPropertyValidationRefinement',
  refines: 'foam.lang.PhoneNumber',
  mixins: [ 'foam.lang.PhoneNumberRegexMixin' ],

  messages: [
    { name: 'PHONE_NUMBER_REQUIRED', message: 'Required' },
    { name: 'INVALID_PHONE_NUMBER',  message: 'Valid phone number required' },
    { name: 'INVALID_CHARACTER',     message: 'Phone Number can only contain numbers' }
  ],

  constants: [
    {
      name: 'ALPHA_CHAR_CHECK',
      factory: () => /^\+?\d+(?:-\d+)?$/,
      javaFactory: '  return "^\\+?\\d+(?:-\\d+)?$";'
    }
  ],

  properties: [
    {
      class: 'ValidationPredicateArray',
      name: 'internalValidationPredicates',
      factory: function() {
        return [
          {
            args: [ this.name ],
            query: 'thisValue !exists||thisValue ~' + this.ALPHA_CHAR_CHECK,
            errorString: this.INVALID_CHARACTER
          },
          {
            args: [ this.name ],
            query: 'thisValue !exists||thisValue ~' + this.PHONE_NUMBER_REGEX,
            errorString: this.INVALID_PHONE_NUMBER
          }
        ];
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'URLValidationRefinement',
  refines: 'foam.lang.URL',

  messages: [
    { name: 'INVALID_URL', message: 'Invalid URL' }
  ],

  properties: [
    {
      class: 'ValidationPredicateArray',
      name: 'internalValidationPredicates',
      factory: function() {
        var urlRegex = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/;
        return [
          {
            args: [ this.name ],
            query: 'thisValue==""||thisValue~' + urlRegex,
            errorString: this.INVALID_URL
          }
        ];
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'WebsiteValidationRefinement',
  refines: 'foam.lang.Website',

  messages: [
    { name: 'INVALID_Website', message: 'Invalid Website' }
  ],

  properties: [
    {
      class: 'ValidationPredicateArray',
      name: 'internalValidationPredicates',
      factory: function() {
        var websiteRegex = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9]\.[^\s]{2,})/;
        return [
          {
            args: [ this.name ],
            query: 'thisValue==""||thisValue~' + websiteRegex,
            errorString: this.INVALID_WEBSITE
          }
        ];
      }
    }
  ]
});
