<flow name="be:validation" category="DOC/EXAMPLES" spid="foam" description="Live examples of FOAM validation at the property, cross-property and whole-object level." keywords="validation,validateobj,validationpredicates,errors,fbe,example,knowledge"/>

<tocconfig index></tocconfig>

# FOAM Validation By Example

FOAM provides a comprehensive validation system for ensuring data integrity. Validation can be applied at the property level, across multiple properties, or on entire objects.

<toc></toc>

## Overview

FOAM validation works through several mechanisms:

| Mechanism | Level | Description |
|-----------|-------|-------------|
| `required` | Property | Field must have a value |
| `autoValidate` | Property | Built-in type validation |
| `validateObj` | Property | Custom validation function |
| `validationPredicates` | Property | Reusable validation predicates |
| Cross-property | Object | Validation depending on multiple properties |

### Validation Lifecycle

1. User enters data
2. Property setters apply type coercion
3. Validators run on property change
4. Error messages display in views
5. Object-level validation runs on save

---

## Setup: Test Harness

First, let's create a helper to display validation results interactively.

<example id="validation-harness">
foam.CLASS({
  name: 'ValidationDemo',
  extends: 'foam.u2.Controller',

  css: `
    ^ { padding: 16px; }
    ^section {
      margin: 20px 0;
      padding: 16px;
      border: 1px solid #ddd;
      border-radius: 8px;
    }
    ^title {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 12px;
      color: #333;
    }
    ^error {
      color: #d32f2f;
      font-size: 14px;
      margin-top: 8px;
      padding: 8px;
      background: #ffebee;
      border-radius: 4px;
    }
    ^valid {
      color: #388e3c;
      font-size: 14px;
      margin-top: 8px;
      padding: 8px;
      background: #e8f5e9;
      border-radius: 4px;
    }
  `,

  properties: [
    {
      name: 'testObject',
      documentation: 'The object being validated'
    }
  ],

  methods: [
    function render() {
      this.addClass();

      if (!this.testObject) return;

      this
        .start().addClass(this.myClass('section'))
          .start().addClass(this.myClass('title'))
            .add(this.testObject.cls_.name)
          .end()
          .tag(foam.u2.detail.SectionedDetailView, { data: this.testObject })
          .start()
            .addClass(this.testObject.errors_$.map(e =>
              this.myClass(e ? 'error' : 'valid')
            ))
            .add(this.testObject.errors_$.map(e =>
              e ? 'Errors: ' + e.map(err => err[1]).join(', ') : '✓ Valid'
            ))
          .end()
        .end();
    }
  ]
});

log('Validation harness ready');
</example>

---

## Required Validation

The simplest validation — mark a property as <term term="required"></term> and it must have a value.

<example id="required">
foam.CLASS({
  name: 'RequiredExample',
  properties: [
    {
      class: 'String',
      name: 'name',
      required: true
    },
    {
      class: 'String',
      name: 'nickname'  // Optional
    },
    {
      class: 'EMail',
      name: 'email',
      required: true
    }
  ]
});

var obj = RequiredExample.create();
add(ValidationDemo.create({ testObject: obj }));
</example>

---

## Auto Validation

<term term="autoValidate"></term> enables built-in validation for property types. Many property classes have default validators that check format, range, or type.

### Built-in Auto Validators

| Type | Validation |
|------|------------|
| EMail | Valid email format |
| PhoneNumber | Valid phone format |
| URL | Valid URL format |
| Int | Integer value, min/max |
| Float | Numeric value, min/max |
| Date | Valid date |
| String | minLength, maxLength |

<example id="auto-validate">
foam.CLASS({
  name: 'AutoValidateExample',
  properties: [
    {
      class: 'EMail',
      name: 'email',
      autoValidate: true  // Validates email format
    },
    {
      class: 'PhoneNumber',
      name: 'phone',
      autoValidate: true
    },
    {
      class: 'URL',
      name: 'website',
      autoValidate: true
    },
    {
      class: 'Int',
      name: 'age',
      autoValidate: true,
      min: 0,
      max: 150
    },
    {
      class: 'String',
      name: 'username',
      autoValidate: true,
      minLength: 3,
      maxLength: 20
    }
  ]
});

var obj = AutoValidateExample.create({
  email: 'invalid-email',
  phone: '123',
  website: 'not-a-url',
  age: 200,
  username: 'ab'
});

add(ValidationDemo.create({ testObject: obj }));
</example>

---

## Custom Validation with validateObj

<term term="validateObj"></term> provides custom validation logic. It's a function that returns an error message string if invalid, or nothing if valid.

### validateObj Signature

```javascript
validateObj: function(propertyValue) {
  if (/* invalid condition */) {
    return 'Error message to display';
  }
  // Return nothing (undefined) if valid
}
```

<example id="validate-obj">
foam.CLASS({
  name: 'ValidateObjExample',
  properties: [
    {
      class: 'String',
      name: 'password',
      validateObj: function(password) {
        if (!password) return 'Password is required';
        if (password.length < 8) return 'Password must be at least 8 characters';
        if (!/[A-Z]/.test(password)) return 'Password must contain uppercase letter';
        if (!/[a-z]/.test(password)) return 'Password must contain lowercase letter';
        if (!/[0-9]/.test(password)) return 'Password must contain a number';
      }
    },
    {
      class: 'String',
      name: 'confirmPassword',
      validateObj: function(confirmPassword) {
        if (confirmPassword !== this.password) {
          return 'Passwords do not match';
        }
      }
    },
    {
      class: 'Int',
      name: 'quantity',
      validateObj: function(quantity) {
        if (quantity <= 0) return 'Quantity must be positive';
        if (quantity > 100) return 'Maximum quantity is 100';
        if (quantity % 1 !== 0) return 'Quantity must be a whole number';
      }
    }
  ]
});

var obj = ValidateObjExample.create({
  password: 'weak',
  confirmPassword: 'different',
  quantity: -5
});

add(ValidationDemo.create({ testObject: obj }));
</example>

---

## Validation Predicates

<term term="validationPredicates"></term> allow reusable validation rules using MLang predicates. Each predicate includes an error message displayed when validation fails.

### Predicate Structure

```javascript
validationPredicates: [
  {
    args: ['propertyName'],
    query: 'propertyName > 0',  // Or MLang expression
    errorMessage: 'Value must be positive'
  }
]
```

<example id="validation-predicates">
foam.CLASS({
  name: 'PredicateExample',
  properties: [
    {
      class: 'Int',
      name: 'startValue',
      validationPredicates: [
        {
          args: ['startValue'],
          query: 'startValue >= 0',
          errorMessage: 'Start value must be non-negative'
        }
      ]
    },
    {
      class: 'Int',
      name: 'endValue',
      validationPredicates: [
        {
          args: ['endValue'],
          query: 'endValue >= 0',
          errorMessage: 'End value must be non-negative'
        },
        {
          args: ['startValue', 'endValue'],
          query: 'endValue > startValue',
          errorMessage: 'End value must be greater than start value'
        }
      ]
    },
    {
      class: 'String',
      name: 'code',
      validationPredicates: [
        {
          args: ['code'],
          query: 'code.length >= 3',
          errorMessage: 'Code must be at least 3 characters'
        },
        {
          args: ['code'],
          query: 'code.length <= 10',
          errorMessage: 'Code must be at most 10 characters'
        },
        {
          args: ['code'],
          query: '/^[A-Z0-9]+$/.test(code)',
          errorMessage: 'Code must contain only uppercase letters and numbers'
        }
      ]
    }
  ]
});

var obj = PredicateExample.create({
  startValue: 10,
  endValue: 5,
  code: 'abc!'
});

add(ValidationDemo.create({ testObject: obj }));
</example>

---

## Cross-Property Validation

Validation that depends on multiple properties. Use `validateObj` with property access via `this`, or `validationPredicates` with multiple `args`.

<example id="cross-property">
foam.CLASS({
  name: 'CrossPropertyExample',
  properties: [
    {
      class: 'Date',
      name: 'startDate',
      factory: function() { return new Date(); }
    },
    {
      class: 'Date',
      name: 'endDate',
      factory: function() { return new Date(); },
      validateObj: function(endDate) {
        if (this.startDate && endDate && endDate < this.startDate) {
          return 'End date must be after start date';
        }
      }
    },
    {
      class: 'Float',
      name: 'minPrice',
      value: 0
    },
    {
      class: 'Float',
      name: 'maxPrice',
      value: 100,
      validationPredicates: [
        {
          args: ['minPrice', 'maxPrice'],
          query: 'maxPrice >= minPrice',
          errorMessage: 'Maximum price must be >= minimum price'
        }
      ]
    },
    {
      class: 'String',
      name: 'country'
    },
    {
      class: 'String',
      name: 'postalCode',
      validateObj: function(postalCode) {
        if (!postalCode) return;

        if (this.country === 'US') {
          if (!/^\d{5}(-\d{4})?$/.test(postalCode)) {
            return 'Invalid US ZIP code format';
          }
        } else if (this.country === 'Canada') {
          if (!/^[A-Z]\d[A-Z] \d[A-Z]\d$/i.test(postalCode)) {
            return 'Invalid Canadian postal code format';
          }
        }
      }
    }
  ]
});

var obj = CrossPropertyExample.create({
  startDate: new Date('2024-12-01'),
  endDate: new Date('2024-01-01'),
  minPrice: 100,
  maxPrice: 50,
  country: 'US',
  postalCode: 'ABC'
});

add(ValidationDemo.create({ testObject: obj }));
</example>

---

## Async Validation

For validation requiring server calls or async operations, use async `validateObj` functions.

<example id="async-validation">
foam.CLASS({
  name: 'AsyncValidationExample',
  properties: [
    {
      class: 'String',
      name: 'username',
      validateObj: async function(username) {
        if (!username) return 'Username is required';
        if (username.length < 3) return 'Username too short';

        // Simulate async server check
        await new Promise(resolve => setTimeout(resolve, 500));

        // Simulate some usernames being taken
        const taken = ['admin', 'root', 'user', 'test'];
        if (taken.includes(username.toLowerCase())) {
          return 'Username is already taken';
        }
      }
    }
  ]
});

var obj = AsyncValidationExample.create({ username: 'admin' });
add(ValidationDemo.create({ testObject: obj }));
</example>

---

## Validation Errors Access

Access validation errors programmatically via the `errors_` property.

<example id="errors-access">
foam.CLASS({
  name: 'ErrorsAccessExample',
  properties: [
    {
      class: 'String',
      name: 'field1',
      required: true
    },
    {
      class: 'Int',
      name: 'field2',
      min: 0,
      autoValidate: true
    }
  ]
});

var obj = ErrorsAccessExample.create({ field1: '', field2: -5 });

// errors_ is a slot containing an array of [propertyName, errorMessage] pairs
obj.errors_$.sub(function() {
  var errors = obj.errors_;
  if (errors) {
    log('Validation errors:');
    errors.forEach(function(err) {
      log('  - ' + err[0] + ': ' + err[1]);
    });
  } else {
    log('No validation errors');
  }
});

// Trigger initial validation check
log('Initial state:');
log('errors_:', obj.errors_);

// Fix errors
setTimeout(function() {
  log('\nFixing errors...');
  obj.field1 = 'value';
  obj.field2 = 10;
  log('errors_:', obj.errors_);
}, 1000);
</example>

---

## Form-Level Validation

Disable form submission until all validation passes.

<example id="form-validation">
foam.CLASS({
  name: 'FormValidationExample',
  extends: 'foam.u2.Controller',

  css: `
    ^form { padding: 16px; border: 1px solid #ddd; border-radius: 8px; }
    ^submit { margin-top: 16px; }
    ^submit[disabled] { opacity: 0.5; }
  `,

  properties: [
    {
      class: 'String',
      name: 'name',
      required: true
    },
    {
      class: 'EMail',
      name: 'email',
      required: true,
      autoValidate: true
    },
    {
      class: 'Int',
      name: 'age',
      required: true,
      min: 18,
      max: 120,
      autoValidate: true
    }
  ],

  actions: [
    {
      name: 'submit',
      isEnabled: function(errors_) {
        return !errors_ || errors_.length === 0;
      },
      code: function() {
        console.log('Form submitted!', {
          name: this.name,
          email: this.email,
          age: this.age
        });
        alert('Form submitted successfully!');
      }
    }
  ],

  methods: [
    function render() {
      this.addClass()
        .start().addClass(this.myClass('form'))
          .tag(foam.u2.detail.SectionedDetailView, {
            data: this,
            showActions: false
          })
          .start()
            .addClass(this.myClass('submit'))
            .tag(this.SUBMIT)
          .end()
        .end();
    }
  ]
});

add(FormValidationExample.create());
</example>

---

## Validation with Sections

Organize validation across form sections using <term term="sections"></term>.

<example id="sectioned-validation">
foam.CLASS({
  name: 'SectionedValidationExample',

  sections: [
    {
      name: 'personal',
      title: 'Personal Information',
      properties: ['firstName', 'lastName', 'email']
    },
    {
      name: 'address',
      title: 'Address',
      properties: ['street', 'city', 'postalCode']
    }
  ],

  properties: [
    {
      class: 'String',
      name: 'firstName',
      required: true,
      section: 'personal'
    },
    {
      class: 'String',
      name: 'lastName',
      required: true,
      section: 'personal'
    },
    {
      class: 'EMail',
      name: 'email',
      required: true,
      autoValidate: true,
      section: 'personal'
    },
    {
      class: 'String',
      name: 'street',
      section: 'address'
    },
    {
      class: 'String',
      name: 'city',
      section: 'address'
    },
    {
      class: 'String',
      name: 'postalCode',
      section: 'address',
      validateObj: function(code) {
        if (code && !/^[A-Z0-9\s-]+$/i.test(code)) {
          return 'Invalid postal code format';
        }
      }
    }
  ]
});

var obj = SectionedValidationExample.create();
add(foam.u2.detail.SectionedDetailView.create({ data: obj }));
</example>

---

## Custom Validator Classes

Create reusable validator classes for complex validation logic.

<example id="custom-validator">
// Reusable validator for credit card numbers
foam.CLASS({
  name: 'CreditCardValidator',

  methods: [
    function validate(number) {
      if (!number) return 'Card number is required';

      // Remove spaces and dashes
      const cleaned = number.replace(/[\s-]/g, '');

      if (!/^\d+$/.test(cleaned)) {
        return 'Card number must contain only digits';
      }

      if (cleaned.length < 13 || cleaned.length > 19) {
        return 'Card number must be 13-19 digits';
      }

      // Luhn algorithm check
      if (!this.luhnCheck(cleaned)) {
        return 'Invalid card number';
      }
    },

    function luhnCheck(num) {
      let sum = 0;
      let isEven = false;

      for (let i = num.length - 1; i >= 0; i--) {
        let digit = parseInt(num[i], 10);

        if (isEven) {
          digit *= 2;
          if (digit > 9) digit -= 9;
        }

        sum += digit;
        isEven = !isEven;
      }

      return sum % 10 === 0;
    }
  ]
});

// Use the validator
foam.CLASS({
  name: 'PaymentForm',
  requires: ['CreditCardValidator'],

  properties: [
    {
      class: 'String',
      name: 'cardNumber',
      view: { class: 'foam.u2.TextField', placeholder: '1234 5678 9012 3456' },
      validateObj: function(cardNumber) {
        return this.CreditCardValidator.create().validate(cardNumber);
      }
    },
    {
      class: 'String',
      name: 'expiryDate',
      view: { class: 'foam.u2.TextField', placeholder: 'MM/YY' },
      validateObj: function(expiry) {
        if (!expiry) return 'Expiry date is required';
        if (!/^\d{2}\/\d{2}$/.test(expiry)) return 'Use MM/YY format';

        const [month, year] = expiry.split('/').map(Number);
        if (month < 1 || month > 12) return 'Invalid month';

        const now = new Date();
        const expDate = new Date(2000 + year, month - 1);
        if (expDate < now) return 'Card has expired';
      }
    },
    {
      class: 'String',
      name: 'cvv',
      view: { class: 'foam.u2.TextField', placeholder: '123', type: 'password' },
      validateObj: function(cvv) {
        if (!cvv) return 'CVV is required';
        if (!/^\d{3,4}$/.test(cvv)) return 'CVV must be 3-4 digits';
      }
    }
  ]
});

var form = PaymentForm.create({
  cardNumber: '1234 5678 9012 3456',
  expiryDate: '01/20',
  cvv: '12'
});

add(ValidationDemo.create({ testObject: form }));
</example>

---

## Summary

### Validation Methods Comparison

| Method | Best For | Reusability |
|--------|----------|-------------|
| `required` | Simple presence check | N/A |
| `autoValidate` | Built-in type validation | Built-in |
| `validateObj` | Custom logic | Per-property |
| `validationPredicates` | Declarative rules | Reusable |
| Custom validator class | Complex validation | Highly reusable |

### Best Practices

1. **Use built-in types** — EMail, PhoneNumber, URL have auto validators
2. **Set min/max constraints** — For numeric types, use property constraints
3. **Combine methods** — Use `required` + `autoValidate` + `validateObj` together
4. **Keep validators pure** — Avoid side effects in validation functions
5. **Provide clear messages** — Error messages should guide the user to fix issues
6. **Validate early** — Use `onKey: true` for immediate feedback
7. **Disable submit** — Prevent form submission until validation passes

---

## See Also

- [FOAM Views By Example](be:views) — How validation errors display in views
- [FOAM AllViews Reference](be:AllViews) — Property types with built-in validation
- [FOAM MLang By Example](be:mlang) — Predicates for validationPredicates

<glossary>
  <def term="required" definition="Property option marking a field as mandatory. Empty values fail validation."></def>
  <def term="autoValidate" definition="Property option enabling built-in type-specific validation (email format, numeric range, etc.)."></def>
  <def term="validateObj" definition="Property option for custom validation functions. Returns error message string if invalid."></def>
  <def term="validationPredicates" definition="Property option for declarative validation rules using MLang predicates with error messages."></def>
  <def term="errors_" definition="Object slot containing array of [propertyName, errorMessage] pairs for all validation errors."></def>
  <def term="min" definition="Property option setting minimum value for numeric types."></def>
  <def term="max" definition="Property option setting maximum value for numeric types."></def>
  <def term="minLength" definition="Property option setting minimum string length."></def>
  <def term="maxLength" definition="Property option setting maximum string length."></def>
  <def term="sections" definition="Model feature for organizing properties into groups, each with its own title and validation state."></def>
  <def term="isEnabled" definition="Action property that can check errors_ to disable submission until valid."></def>
  <def term="EMail" definition="String property subtype with built-in email format validation."></def>
  <def term="PhoneNumber" definition="String property subtype with built-in phone number validation."></def>
  <def term="URL" definition="String property subtype with built-in URL format validation."></def>
</glossary>