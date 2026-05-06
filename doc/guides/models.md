# FOAM Model Types for Modellers

FOAM provides several model types that serve different purposes in designing your application. Each type is optimized for specific modeling needs.

## Core Model Types

### **`foam.CLASS`**
Use for defining data models with properties, methods, and behaviors. This is the fundamental building block for most application models like User, Product, or Order.

### **`foam.ENUM`**
Use for defining a fixed set of named values. Perfect for status fields, categories, or any property that can only take specific predefined values like OrderStatus (PENDING, SHIPPED, DELIVERED).

### **`foam.INTERFACE`**
Use for defining contracts that other models must implement. Ideal for establishing common behavior patterns across different models, like Searchable or Exportable interfaces.

### **`foam.SCRIPT`**
Use for encapsulating executable code and business logic. Helpful for defining reusable scripts, calculations, or custom behaviors that can be attached to models.

### **`foam.RELATIONSHIP`**
Use for defining connections between models with support for different cardinalities (one-to-many, many-to-many). Essential for modeling real-world relationships like Customer-Orders or Products-Categories.

### **`foam.LIB`**
Use for extending existing namespaces with additional methods, constants, and utilities. Perfect for creating utility libraries, adding helper functions to existing types, or implementing platform-specific extensions [1](#2-0) [2](#2-1) .

## Schema Integration Types

### **XSD Complex Types**
Generated from XML Schema definitions when you need to integrate with external systems that use XSDs. These become regular CLASS models with additional metadata.

### **XSD Simple Types**
Generated from XSD simple type definitions, typically for basic data types with constraints.

### **XSD Group Types**
Generated from XSD group definitions for reusable field collections.

## Choosing the Right Model Type

| When you need to... | Use this model type |
|---------------------|-------------------|
| Define a business entity with properties | `foam.CLASS` |
| Model a fixed set of options | `foam.ENUM` |
| Establish a contract for behavior | `foam.INTERFACE` |
| Connect two models together | `foam.RELATIONSHIP` |
| Extend namespaces with utilities | `foam.LIB` |
| Integrate with XML schemas | XSD-generated types |
| Encapsulate business logic | `foam.SCRIPT` |

## Notes

All model types work together seamlessly - you can have enums as properties in classes, relationships between classes that implement interfaces, scripts that operate on any model type, and LIBs that provide utilities across your entire application. The XSD types are specialized CLASS models created automatically from XML Schema definitions, primarily used for system integration scenarios.
