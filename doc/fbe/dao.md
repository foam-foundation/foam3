<flow name="be:dao" category="DOC/EXAMPLES" spid="foam" description="Live examples of the DAO interface: CRUD operations, querying, sinks and swapping storage backends behind one API." keywords="dao,crud,query,sink,storage,fbe,example,knowledge"/>

<tocconfig index></tocconfig>

# FOAM DAO By Example

<term term="DAO"></term> (Data Access Object) is FOAM's unified interface for data storage and retrieval. DAOs abstract away the underlying storage mechanism, allowing the same code to work with in-memory storage, local databases, REST APIs, or distributed systems.

<toc></toc>

## Overview

DAOs provide a consistent API for CRUD operations and querying:

| Method | Description |
|--------|-------------|
| `put(obj)` | Create or update an object |
| `find(id)` | Retrieve an object by ID |
| `remove(obj)` | Delete an object |
| `select(sink)` | Query objects into a sink |
| `where(predicate)` | Filter by condition |
| `orderBy(comparator)` | Sort results |
| `skip(n)` | Skip first n results |
| `limit(n)` | Limit to n results |

### DAO Types

| Type | Description | Use Case |
|------|-------------|----------|
| MDAO | In-memory DAO with indexing | Testing, caching |
| JDAO | Journaled DAO (persisted) | Production data |
| EasyDAO | Configurable DAO with decorators | Most applications |
| ProxyDAO | Wraps another DAO | Dynamic switching |
| ArrayDAO | Simple array-backed DAO | Small datasets |

---

## Setup: MLang Query Language

<term term="MLang"></term> is FOAM's query language for building predicates and expressions. We create a singleton for convenient access.

<example id="load-mlangs">
var M = foam.mlang.ExpressionsSingleton.create();
</example>

### Common MLang Expressions

| Expression | Description | Example |
|------------|-------------|---------|
| `EQ(prop, value)` | Equals | `M.EQ(Customer.ID, 5)` |
| `NEQ(prop, value)` | Not equals | `M.NEQ(Account.TYPE, 'closed')` |
| `GT/GTE/LT/LTE` | Comparisons | `M.GT(Transaction.AMOUNT, 100)` |
| `AND/OR` | Logical operators | `M.AND(p1, p2)` |
| `IN(prop, array)` | Value in array | `M.IN(Account.ID, [1,2,3])` |
| `CONTAINS(prop, str)` | String contains | `M.CONTAINS(Customer.NAME, 'Smith')` |
| `DESC(prop)` | Descending order | `M.DESC(Transaction.DATE)` |
| `MAP(prop, sink)` | Extract property values | `M.MAP(Customer.ID, sink)` |

---

## Data Models

This example uses a banking domain with <term term="Relationships"></term> between models. Relationships automatically add foreign key properties and navigation methods.

<example id="bank-classes">
foam.CLASS({
  package: 'example',
  name: 'Bank',
  properties: ['id', 'name']
});

foam.CLASS({
  package: 'example',
  name: 'Customer',
  properties: ['id', 'firstName', 'lastName']
});

foam.CLASS({
  package: 'example',
  name: 'Account',
  properties: ['id', 'type']
});

foam.CLASS({
  package: 'example',
  name: 'Transaction',
  properties: [
    'id',
    'label',
    'amount',
    { class: 'Date', name: 'date' }
  ]
});

// Define foreign key relationships
foam.RELATIONSHIP({
  sourceModel: 'example.Bank',
  forwardName: 'customers',  // adds 'customers' property to Bank
  targetModel: 'example.Customer',
  inverseName: 'bank'        // adds 'bank' property to Customer
});

foam.RELATIONSHIP({
  sourceModel: 'example.Customer',
  forwardName: 'accounts',
  targetModel: 'example.Account',
  inverseName: 'owner'
});

foam.RELATIONSHIP({
  sourceModel: 'example.Account',
  forwardName: 'transactions',
  targetModel: 'example.Transaction',
  inverseName: 'account'
});

// Create the example app with exported DAOs
foam.CLASS({
  package: 'example',
  name: 'BankApp',
  requires: [
    'example.Bank',
    'example.Customer',
    'example.Account',
    'example.Transaction',
    'foam.dao.EasyDAO'
  ],
  exports: [
    'bankDAO',
    'customerDAO',
    'accountDAO',
    'transactionDAO'
  ],
  properties: [
    {
      name: 'bankDAO',
      factory: function() {
        return this.EasyDAO.create({
          name: 'banks',
          of: this.Bank,
          daoType: 'MDAO'
        });
      }
    },
    {
      name: 'customerDAO',
      factory: function() {
        return this.EasyDAO.create({
          name: 'customers',
          seqNo: true,  // Auto-generate IDs
          of: this.Customer,
          daoType: 'MDAO'
        });
      }
    },
    {
      name: 'accountDAO',
      factory: function() {
        return this.EasyDAO.create({
          name: 'accounts',
          seqNo: true,
          of: this.Account,
          daoType: 'MDAO'
        });
      }
    },
    {
      name: 'transactionDAO',
      factory: function() {
        return this.EasyDAO.create({
          name: 'transactions',
          seqNo: true,
          of: this.Transaction,
          daoType: 'MDAO'
        });
      }
    }
  ]
});

var app = example.BankApp.create();
</example>

---

## Loading Data

### Creating Banks

Use `put()` to create or update objects. It returns a Promise that resolves with the saved object.

<example id="load-banks">
return Promise.all([
  app.bankDAO.put(app.Bank.create({ id: 'fn', name: 'First National' })),
  app.bankDAO.put(app.Bank.create({ id: 'tt', name: 'Tortuga Credit Union' }))
]);
</example>

### Creating Customers

The `bank` property is the foreign key added by the Relationship.

<example id="load-customers">
return Promise.all([
  app.customerDAO.put(app.Customer.create({ firstName: 'Sarah',   lastName: 'Smith',     bank: 'fn' })),
  app.customerDAO.put(app.Customer.create({ firstName: 'Harry',   lastName: 'Sullivan',  bank: 'fn' })),
  app.customerDAO.put(app.Customer.create({ firstName: 'Jamie',   lastName: 'MacKenzie', bank: 'fn' })),

  app.customerDAO.put(app.Customer.create({ firstName: 'Herman',  lastName: 'Blackbeard', bank: 'tt' })),
  app.customerDAO.put(app.Customer.create({ firstName: 'Hector',  lastName: 'Barbossa',   bank: 'tt' })),
  app.customerDAO.put(app.Customer.create({ firstName: 'William', lastName: 'Roberts',    bank: 'tt' }))
]);
</example>

---

## Selecting with Sinks

A <term term="Sink"></term> processes objects from a `select()` operation. FOAM provides several built-in sinks and you can create custom ones.

### Built-in Sinks

| Sink | Description |
|------|-------------|
| ArraySink | Collects results into an array (default) |
| DAOSink | Puts results into another DAO |
| ProxySink | Wraps another sink, allowing interception |
| CountSink | Counts results |
| GroupBySink | Groups results by a property |

### Creating Accounts via Select

This example uses <term term="ProxySink"></term> to process each customer and create accounts.

<example id="create-accounts">
// Save promises to wait for all puts to complete
accountPuts = [];

// Select customers and process each one
return app.customerDAO.select(foam.dao.ProxySink.create({
  delegate: {
    put: function(customer) {
      // Use the relationship's DAO to create accounts
      accountPuts.push(customer.accounts.put(app.Account.create({ type: 'chq' })));
      accountPuts.push(customer.accounts.put(app.Account.create({ type: 'sav' })));
    }
  }
})).then(function() {
  return Promise.all(accountPuts);
});
</example>

### Creating Transactions

Using <term term="ArraySink"></term> (the default sink) to collect results into an array for processing.

<example id="create-transactions">
transactionPuts = [];

var amount = 0;
var date = new Date(0);

// Generate checking account transactions
function generateAccountChq(account) {
  for (var j = 0; j < 10; j++) {
    date.setDate(date.getDate() + 1);
    transactionPuts.push(account.transactions.put(app.Transaction.create({
      date: new Date(date),
      label: 'x' + amount + 'x',
      amount: ((amount += 0.25) % 20) - 5 + (amount % 2) * 5
    })));
  }
}

// Generate savings account transactions
function generateAccountSav(account) {
  for (var j = 0; j < 5; j++) {
    date.setDate(date.getDate() + 2.5);
    transactionPuts.push(account.transactions.put(app.Transaction.create({
      date: new Date(date),
      label: 's' + amount + 's',
      amount: ((amount += 1.5) % 50) + (amount % 4) * 5
    })));
  }
}

// Select 'chq' accounts - calling select() with no args returns ArraySink
return app.accountDAO.where(M.EQ(app.Account.TYPE, 'chq'))
  .select().then(function(defaultArraySink) {
    var accounts = defaultArraySink.array;
    for (var i = 0; i < accounts.length; i++) {
      generateAccountChq(accounts[i]);
    }
  }).then(function() {
    // Then select 'sav' accounts
    amount = 0;
    date = new Date(0);
    return app.accountDAO.where(M.EQ(app.Account.TYPE, 'sav'))
      .select().then(function(defaultArraySink) {
        var accounts = defaultArraySink.array;
        for (var i = 0; i < accounts.length; i++) {
          generateAccountSav(accounts[i]);
        }
      });
  }).then(function() {
    return Promise.all(transactionPuts);
  });
</example>

---

## Querying Data

### Using Relationships (Join)

Relationships provide navigation properties that return DAOs filtered to related objects.

<example id="join">
var tdao = foam.dao.ArrayDAO.create();
var tsink = foam.dao.DAOSink.create({ dao: tdao });
foam.u2.TableView.create({ of: app.Transaction, data: tdao }).write();

// Find customer, then navigate through relationships
return app.customerDAO.find(2)
  .then(function(customer) {
    var transactionSelectPromises = [];

    // customer.accounts is a DAO of this customer's accounts
    return customer.accounts.select(foam.dao.ProxySink.create({
      delegate: {
        put: function(account) {
          // account.transactions is a DAO of this account's transactions
          transactionSelectPromises.push(account.transactions.select(tsink));
        }
      }
    })).then(function() {
      return Promise.all(transactionSelectPromises);
    });
  });
</example>

### Manual Join (Without Relationships)

For cases where you need explicit control, use MLang to build joins manually.

<example id="manual-join">
var tdao = foam.dao.ArrayDAO.create();
var tsink = foam.dao.DAOSink.create({ dao: tdao });
foam.u2.TableView.create({ of: app.Transaction, data: tdao }).write();

// Intermediate storage for IDs
var customerIds = foam.dao.ArraySink.create();
var accountIds = foam.dao.ArraySink.create();

// Step 1: Get customer IDs
return app.customerDAO
  .where(M.EQ(app.Customer.ID, 2))
  .select(M.MAP(app.Customer.ID, customerIds))  // Extract just the IDs
  .then(function() {
    // Step 2: Get account IDs for those customers
    return app.accountDAO
      .where(M.IN(app.Account.OWNER, customerIds.array))
      .select(M.MAP(app.Account.ID, accountIds));
  })
  .then(function() {
    // Step 3: Get transactions for those accounts
    return app.transactionDAO
      .where(M.IN(app.Transaction.ACCOUNT, accountIds.array))
      .select(tsink);
  });
</example>

---

## Pagination with Skip and Limit

Use `skip()` and `limit()` for pagination. Combined with <term term="ProxyDAO"></term>, you can create dynamic views that update automatically.

<example id="skip-limit">
var proxyDAO = foam.dao.ProxyDAO.create({ delegate: app.customerDAO });
var skip = 0;
var limit = 3;

// Animate through pages by changing the proxy's delegate
setInterval(function() {
  skip = (skip + 1) % 4;
  proxyDAO.delegate = app.customerDAO.skip(skip).limit(limit);
}, 500);

foam.__context__.document.write("Customers with Skip and Limit");
foam.u2.TableView.create({ of: app.Customer, data: proxyDAO }).write();
</example>

---

## Ordering Results

Use `orderBy()` with property references or MLang expressions like `DESC()`.

<example id="ordering">
return app.accountDAO.find(3).then(function(account) {
  var transactionsDAO = account.transactions;

  foam.__context__.document.write("Sort by amount, descending");
  foam.u2.TableView.create({
    of: app.Transaction,
    data: transactionsDAO.orderBy(M.DESC(app.Transaction.AMOUNT))
  }).write();

  foam.__context__.document.write("Sort by date");
  foam.u2.TableView.create({
    of: app.Transaction,
    data: transactionsDAO.orderBy(app.Transaction.DATE)
  }).write();
});
</example>

---

## DAO Decorators

DAOs can be decorated to add functionality. <term term="EasyDAO"></term> simplifies this with configuration options.

### EasyDAO Options

| Option | Description |
|--------|-------------|
| `of` | The model class this DAO stores |
| `daoType` | Underlying storage ('MDAO', 'JDAO', etc.) |
| `seqNo` | Auto-generate sequential IDs |
| `guid` | Auto-generate GUIDs |
| `cache` | Add caching layer |
| `logging` | Log DAO operations |
| `timing` | Track operation timing |
| `contextualize` | Add context to objects |
| `dedup` | Deduplicate objects |
| `journaled` | Enable journaling |

### Common DAO Patterns

```javascript
// Cached DAO with journaling
var dao = foam.dao.EasyDAO.create({
  of: MyModel,
  daoType: 'MDAO',
  cache: true,
  journaled: true,
  journalName: 'mymodel'
});

// Client-server DAO
var dao = foam.dao.EasyDAO.create({
  of: MyModel,
  daoType: 'CLIENT',
  serverBox: myServerBox
});
```

---

## Reactive Updates

DAOs emit events when data changes. Subscribe with `on` to receive updates.

```javascript
// Listen for all changes
dao.on.put.sub(function(sub, on, put, obj) {
  console.log('Object added/updated:', obj.id);
});

dao.on.remove.sub(function(sub, on, remove, obj) {
  console.log('Object removed:', obj.id);
});

// Views automatically subscribe to their data DAO
// and refresh when data changes
```

---

## Summary

### DAO Method Chaining

DAO methods return new DAOs, enabling fluent chaining:

```javascript
dao
  .where(M.AND(
    M.EQ(Transaction.TYPE, 'debit'),
    M.GT(Transaction.AMOUNT, 100)
  ))
  .orderBy(M.DESC(Transaction.DATE))
  .skip(10)
  .limit(20)
  .select()
  .then(function(sink) {
    console.log('Results:', sink.array);
  });
```

### Best Practices

1. **Use Relationships** — Let FOAM manage foreign keys and navigation
2. **Choose the right Sink** — ArraySink for collecting, ProxySink for processing
3. **Leverage EasyDAO** — Configurable decorators for common patterns
4. **Use ProxyDAO** — For dynamic DAO switching in reactive UIs
5. **Index appropriately** — MDAO supports indexes for query performance

---

## See Also

- [FOAM MLang By Example](be:mlang) — Query language reference
- [FOAM Services By Example](be:services) — Client-server DAOs
- [FOAM FAQ](be:FAQ) — Local vs non-local DAOs explained

<glossary>
  <def term="DAO" definition="Data Access Object. FOAM's unified interface for data storage, retrieval, and querying across any backend."></def>
  <def term="MLang" definition="FOAM's query language for building predicates, expressions, and aggregations. Used with DAO where(), orderBy(), and select()."></def>
  <def term="Sink" definition="Interface for processing objects from a DAO select(). Receives put() calls for each result."></def>
  <def term="ArraySink" definition="Default sink that collects results into an array. Access via sink.array after select completes."></def>
  <def term="ProxySink" definition="Sink wrapper that delegates to another sink, allowing interception of put() calls."></def>
  <def term="DAOSink" definition="Sink that puts each result into another DAO. Useful for copying or transforming data."></def>
  <def term="ProxyDAO" definition="DAO wrapper that delegates to another DAO. Useful for dynamic switching or decoration."></def>
  <def term="EasyDAO" definition="Configurable DAO factory that combines common decorators (caching, journaling, sequencing) via simple options."></def>
  <def term="MDAO" definition="Memory DAO. Fast in-memory storage with optional indexing. Data is lost on restart."></def>
  <def term="JDAO" definition="Journaled DAO. Persists operations to a journal file for durability."></def>
  <def term="Relationships" definition="Declared associations between models that automatically add foreign key properties and navigation DAOs."></def>
  <def term="seqNo" definition="EasyDAO option that auto-generates sequential integer IDs for new objects."></def>
  <def term="where" definition="DAO method that returns a filtered DAO matching the given MLang predicate."></def>
  <def term="orderBy" definition="DAO method that returns a sorted DAO using the given comparator or property."></def>
  <def term="skip" definition="DAO method that skips the first n results. Used for pagination."></def>
  <def term="limit" definition="DAO method that limits results to n objects. Used for pagination."></def>
</glossary>