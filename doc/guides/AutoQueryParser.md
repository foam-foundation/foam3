<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [SimpleQueryParser Syntax Guide](#simplequeryparser-syntax-guide)
  - [Basic Syntax](#basic-syntax)
  - [Logical Operators](#logical-operators)
    - [AND](#and)
    - [NOT](#not)
    - [OR](#or)
    - [OR](#or-1)
  - [Grouping](#grouping)
  - [Property Values](#property-values)
  - [Expressions](#expressions)
    - [Strings](#strings)
      - [String Examples](#string-examples)
    - [Numbers](#numbers)
      - [Number Examples](#number-examples)
    - [Booleans](#booleans)
      - [Boolean Examples](#boolean-examples)
    - [Date and DateTime Expressions](#date-and-datetime-expressions)
      - [Date and DateTime Examples](#date-and-datetime-examples)
    - [Enum Expressions](#enum-expressions)
      - [Enum Examples](#enum-examples)
    - [StringArrays](#stringarrays)
      - [StringArray Examples](#stringarray-examples)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# SimpleQueryParser Syntax Guide

## Basic Syntax
SimpleQueryParser supports property-based queries with various operators and logical combinations. All queries are case-insensitive.

## Logical Operators

### AND
Combine expressions with spaces or explicit AND:
```
expression1 AND expression2
expression1 & expression2
```

### NOT
Negate expressions with NOT:
```
NOT expression
```

### OR
Combine expressions with OR or pipe:
```
expression1 OR expression2
expression1 | expression2
```

### OR
Combine expressions with OR or pipe:
```
expression1 OR expression2
expression1 | expression2
```

## Grouping
Use parentheses for complex expressions:
```
(field1 = "value1" OR field2 > 123) AND field3 IS NOT EMPTY
```

## Property Values

Supported property values are:

* String
    * simple_string_with_no_spaces
    * "quoted string with spaces"
* StringArray
    * [  value1, value2, ...    ]  
* Numbers in US notation
    * Int
    * Float
* Boolean
    * TRUE
    * FALSE
* Date and DateTime in ISO UTC
    * YYYY-MM-DDTHH:MM:SS.mmmZ (or YY)
    * YYYY-MM-DDTHH:MM:SS.mmm (or YY) 
    * YYYY-MM-DDTHH:MM:SS (or YY)
    * YYYY-MM-DDTHH:MM (or YY)
    * YYYY-MM-DDTHH (or YY)
    * YYYY-MM-DD (or YY)
    * YYYY-MM (or YY)
    * YYYY (or YY)
* Enum
    * defined enum values for the property

> [!IMPORTANT]
> Only properties marked as `searchable` in the model will be available for querying.

## Expressions

Supported expressions are property type dependant, not all operations pertain to all types. 

### Strings

The expressions that are supported for strings are:

| String Expression | Description |
|------------|-------------|
| _property_ CONTAINS _value_ | _property_ contains _value_ |
| _property_ : _value_ | _property_ contains _value_ |
| _property_ ~ _value_ | _property_ contains _value_ |
| _property_ = _value_ | _property_ exactly matches "_value_" |
| _property_ IN (_value1_,_value2_,...) | _property_ exactly matches any of the listed values |
| _property_ NOT IN (_value1_,_value2_,...) | _property_ does not exactly match any of the listed values |
| _property_ > _value_ | _property_ is greater than _value_ |
| _property_ < _value_ | _property_ is less than _value_ |
| _property_ >= _value_ | _property_ is greater than or equal to _value_ |
| _property_ <= _value_ | _property_ is less than or equal to _value_ |
| _property_ != _value_ | _property_ is not equal to _value_ |
| _property_ IS EMPTY | _property_ is is empty |
| _property_ IS NOT EMPTY | _property_ is not empty |


#### String Examples

```

stringField = email@somedomain.com
stringField = "Quoted String"            
stringField = "Quoted \\" String"          
stringField = "Quoted , String"           
stringField = SomeName
stringField != SomeName
stringField CONTAINS SomeName
stringField ~ SomeName
stringField IN (SomeName,AnotherName)
stringField IS EMPTY
```

### Numbers

The expressions that are supported for all numbers are:

| Number Expression | Description |
|------------|-------------|
| _property_ >= _value_ | _property_ is greater than or equal to _value_ |
| _property_ > _value_ | _property_ is greater than _value_ |
| _property_ <= _value_ | _property_ is less than or equal to _value_ |
| _property_ < _value_ | _property_ is less than _value_ |
| _property_ != _value_ | _property_ is not equal to _value_ |
| _property_ = _value_ | _property_ equals _value_ | 

Additional expressions that are supported for floating point numbers only:

| Float Expression | Description |
|------------|-------------|
| _property_ IN RANGE (_min_,_max_) | _property_ is within the range from _min_ to _max_ inclusive |
| _property_ NOT IN RANGE (_min_,_max_) | _property_ is outside the range from _min_ to _max_ |

Additional expressions that are supported for integers only:

  
| Integer Expression | Description |
|------------|-------------|
| _property_ IN (_value1_,_value2_,...) | _property_ equals any of the listed values |
| _property_ NOT IN (_value1_,_value2_,...) | _property_ does not equal any of the listed values |

#### Number Examples

```
intField = -6
intField != 6
intField IN (6,7,8)
floatField = 123.45
floatField IN RANGE (1.0,2.0)
floatField NOT IN RANGE (1.0,2.0)
```

### Booleans

The expressions that are supported for booleans are:

| Boolean Expression | Description |
|------------|-------------|
| _property_ IS TRUE | _property_ equals true |
| _property_ IS FALSE | _property_ equals false |

#### Boolean Examples

```
boolField IS TRUE
boolField IS FALSE
```

### Date and DateTime Expressions
The date values should always be in the ISO UTC format. The expressions that are supported for dates are:


| Date Expression | Description |
|------------|-------------|
| _property_ >= _date_ | _property_ is greater than or equal to _date_ |
| _property_ > _date_ | _property_ is greater than _date_ |
| _property_ <= _date_ | _property_ is less than or equal to _date_ |
| _property_ < _date_ | _property_ is less than _date_ |
| _property_ != _date_ | _property_ is not equal to _date_ |
| _property_ = _date_ | _property_ equals _date_ |
| _property_ IN RANGE (_start_,_end_) | _property_ is within the range from _start_ to _end_ inclusive |
| _property_ NOT IN RANGE (_start_,_end_) | _property_ is outside the range from _start_ to _end_ |
| _property_ IS EMPTY | _property_ is empty |
| _property_ IS NOT EMPTY | _property_ is not empty |

#### Date and DateTime Examples

```
dateField = 2025-10-21
dateField > 2025-10-21
dateField >= 2025-10-21
dateField < 2025-10-21
dateField <= 2025-10-21
dateField != 2025/10/21
dateField = 2025-10-21T14:30
dateField = TODAY
dateField = TODAY+7
dateField = TODAY-7
dateField IN RANGE (2025-10,2025-10)
dateField IN RANGE (2025,2025)
dateField IN RANGE (2025-10-21T14:30:45.123Z,2025-10-22T14:30:45.123Z)
dateField NOT IN RANGE (2025/10/21T14,2025/10/21T15)
dateField IS EMPTY
```

### Enum Expressions

The expressions that are supported for enums are:

| Enum Expression | Description |
|------------|-------------|
| _property_ = _EnumValue_ | _property_ equals the enum value |
| _property_ != _EnumValue_ | _property_ does not equal the enum value |
| _property_ IN (_EnumValue1_,_EnumValue2_,...) | _property_ equals any of the listed enum values |
| _property_ NOT IN (_EnumValue1_,_EnumValue2_,...) | _property_ does not equal any of the listed enum values |

#### Enum Examples

The expressions support enums and their values. For example, if a `lifecycleState` property is an enum with values like `ACTIVE` and `REJECTED`, you can query:

```
lifecycleState = ACTIVE
lifecycleState != ACTIVE
lifecycleState IN (ACTIVE, REJECTED)
lifecycleState NOT IN (ACTIVE, REJECTED)
```

### StringArrays  

Pending ...

#### StringArray Examples

Pending ...

