# MultiPart Keys (Composite Primary Keys)

FOAM supports composite primary keys through the `ids` property. When a model needs a unique identifier composed of multiple fields, you define an `ids` array listing the property names that form the composite key.

FOAM automatically generates an ID class for models with multipart keys. This generated class includes methods for creating, parsing, and comparing composite IDs.

## Example Usage:

Define a model with a composite key:

```javascript
foam.CLASS({
  package: 'com.example',
  name: 'OrderItem',

  // Composite primary key: orderId + productId
  ids: ['orderId', 'productId'],

  properties: [
    {
      class: 'Long',
      name: 'orderId'
    },
    {
      class: 'Long',
      name: 'productId'
    },
    {
      class: 'Int',
      name: 'quantity'
    },
    {
      class: 'Double',
      name: 'price'
    }
  ]
});
```

Creating and working with multipart key objects:

```javascript
var item = com.example.OrderItem.create({
  orderId: 1001,
  productId: 5,
  quantity: 3,
  price: 29.99
});

// Access the composite ID
console.log(item.id);
// Output: com.example.OrderItemId { orderId: 1001, productId: 5 }

// String representation of the ID
console.log(item.id.toString());
// Output: {"orderId"=1001,"productId"=5}
```

## Generated ID Class

FOAM generates an ID class named `<ModelName>Id` with the following features:

```javascript
// The generated ID class can be used directly
var id = com.example.OrderItemId.create({
  orderId: 1001,
  productId: 5
});

// Convert string back to ID object using FROM_STRING
var idFromString = com.example.OrderItemId.FROM_STRING('{"orderId"=1001,"productId"=5}');

console.log(id.equals(idFromString));
// Output: true
```

Note: The string format uses `=` instead of `:` (e.g., `{"field"=value}` not `{"field":value}`).

## Checking for MultiPart Keys

To check if a model uses multipart keys:

```javascript
var of = com.example.OrderItem;

// Check if the model's ID axiom is a MultiPartID
if ( foam.lang.MultiPartID.isInstance(of.ID) ) {
  console.log('Model uses multipart keys');
  console.log('Key fields:', of.ID.propNames);
  // Output: Key fields: ['orderId', 'productId']
}
```

## DAO Operations with MultiPart Keys

When using DAOs with multipart key models:

```javascript
// Put works normally - FOAM handles the composite key
await orderItemDAO.put(item);

// Find requires the composite ID object (not a simple value)
var id = com.example.OrderItemId.create({
  orderId: 1001,
  productId: 5
});
var found = await orderItemDAO.find(id);

// Or create an object with the key fields and use its id
var lookup = com.example.OrderItem.create({
  orderId: 1001,
  productId: 5
});
var found = await orderItemDAO.find(lookup.id);
```

## Converting String IDs

When you have a string representation of a multipart ID (common when passing IDs through URLs or table views):

```javascript
var idString = '{"orderId"=1001,"productId"=5}';

// Use the generated ID class's FROM_STRING method
var of = com.example.OrderItem;
var id = of.ID.of.FROM_STRING(idString);

// Now you can use it with DAO.find()
var item = await orderItemDAO.find(id);
```

## Use Cases

Multipart keys are useful when:

1. **Natural composite uniqueness**: The combination of fields naturally identifies a record
   - Order + Product in line items
   - User + Permission in access control
   - Date + Account in daily summaries

2. **Cross-system uniqueness**: When a single field isn't unique across contexts
   - TenantId + RecordId for multi-tenant systems
   - FileId + Version for versioned documents

3. **Upsert operations**: Composite keys enable natural upserts
   - Re-running a process updates existing records rather than creating duplicates
   - The key combination determines "same record" semantics

## Best Practices

1. **Choose stable fields**: Key fields should not change after creation
2. **Keep keys small**: Use 2-3 fields maximum for performance
3. **Document the key**: Add `documentation` to explain why these fields form the key
4. **Consider queries**: Ensure you can efficiently query by key field subsets

```javascript
foam.CLASS({
  package: 'com.example',
  name: 'UserPermission',

  documentation: `
    User permission assignments with composite key.
    userId + permissionId ensures uniqueness per user
    and enables upserts when syncing permissions.
  `,

  ids: ['userId', 'permissionId'],

  properties: [
    {
      class: 'Long',
      name: 'userId',
      documentation: 'Reference to the user'
    },
    {
      class: 'String',
      name: 'permissionId',
      documentation: 'Permission identifier'
    }
    // ... other properties like grantedAt, expiresAt
  ]
});
```
