<flow name="models" category="DOC/GUIDE" spid="foam" description="Reference for FOAM model types: foam.CLASS, foam.ENUM, foam.INTERFACE, foam.SCRIPT, foam.RELATIONSHIP, foam.LIB." keywords="class,enum,interface,relationship,models,knowledge"/>

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
Use for code that must run once while the model files load, such as registering or refining things at startup. `foam.SCRIPT` runs its `code` immediately (`src/foam.js:220-232`); it does not define a class or attach behaviour to a model.

### **`foam.RELATIONSHIP`**
Use for defining connections between models with support for different cardinalities (one-to-many, many-to-many). Essential for modeling real-world relationships like Customer-Orders or Products-Categories.

### **`foam.LIB`**
Use for extending existing namespaces with additional methods, constants, and utilities. Perfect for creating utility libraries, adding helper functions to existing types, or implementing platform-specific extensions.

## Choosing the Right Model Type

| When you need to... | Use this model type |
|---------------------|-------------------|
| Define a business entity with properties | `foam.CLASS` |
| Model a fixed set of options | `foam.ENUM` |
| Establish a contract for behavior | `foam.INTERFACE` |
| Connect two models together | `foam.RELATIONSHIP` |
| Extend namespaces with utilities | `foam.LIB` |
| Run code once at load time | `foam.SCRIPT` |

## Notes

All model types work together seamlessly - you can have enums as properties in classes, relationships between classes that implement interfaces, and LIBs that provide utilities across your entire application.
