# Testing

FOAM provides a testing harness for implementing unit tests. Test cases can be either modeled FOAM classes or scripts, and can target both Java (server-side) and JavaScript (client-side).

## Running Tests

Tests are executed using build tasks:

```bash
# Run all server and client tests
./build.sh run-tests

# Run only server-side (Java) tests
./build.sh server-tests

# Run only client-side (JavaScript) tests
./build.sh client-tests

# Run specific test cases by id
./build.sh run-tests:RecipeTest,RecipeTestMethods

# Exclude specific tests (prefix with -)
./build.sh run-tests:-SlowTest,-IntegrationTest
```

Test output shows success or failure for each test:

```
RecipeTest
   ✓ SUCCESS: ID empty before create
   ✓ SUCCESS: ID set after create
```

## Creating Modeled Test Cases

Test cases are FOAM models that extend a test base class. Place tests in a `test` subdirectory within your package.

### Server-Side Tests (Java)

For Java tests, extend `foam.core.test.Test` and implement `runTest` with `javaCode`. Here's our example from <code>src/com/foamdev/cook/test/RecipeTest.js</code>:

```javascript
foam.CLASS({
  package: 'com.foamdev.cook.test',
  name: 'RecipeTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'com.foamdev.cook.*',
    'foam.dao.DAO'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        var recipe = new Recipe();
        test(recipe.getId() == 0l, "ID empty before create");

        recipe = (Recipe) ((DAO) x.get("recipeDAO")).put(recipe);
        test(recipe.getId() != 0l, "ID set after create");
      `
    }
  ]
});
```

### Client-Side Tests (JavaScript)

For JavaScript tests, extend `foam.core.test.JSTest` and implement `runTest` as a JavaScript function. Here's an example from <code>src/com/foamdev/cook/test/RecipeTestMethods.js</code>:

```javascript
foam.CLASS({
  package: 'com.foamdev.cook.test',
  name: 'RecipeTestMethods',
  extends: 'foam.core.test.JSTest',

  requires: [ 'com.foamdev.cook.Recipe' ],

  methods: [
    {
      name: 'runTest',
      args: ['Context x'],
      code: function runTest(x) {
        // debugger;
        let recipe = this.Recipe.create();
        x.test(recipe.toSummary() == "", 'Recipe toSummary is initially empty');

        recipe.name = 'Fried chicken';
        x.test(recipe.toSummary() == "Fried chicken", 'Recipe toSummary is equal to name');
      }
    }
  ]
});
```

Note: In Java tests, call `test(condition, message)` directly. In JavaScript tests, call `x.test(condition, message)` using the context parameter.

## Test Organization

### Directory Structure

Tests live in a `test` subdirectory within your package:

```
src/com/foamdev/cook/
├── Recipe.js
├── RecipeCategory.js
├── pom.js
└── test/
    ├── RecipeTest.js        (Java server test)
    ├── RecipeTestMethods.js (JavaScript client test)
    ├── tests.jrl            (test registration)
    └── pom.js               (test pom)
```

### Registering Tests

Tests must be registered in a `tests.jrl` journal file. Each test case needs an entry:

```javascript
p({
  "class": "com.foamdev.cook.test.RecipeTest",
  "id": "RecipeTest",
  "description": "Recipe Id tests"
})

p({
  "class": "com.foamdev.cook.test.RecipeTestMethods",
  "id": "RecipeTestMethods",
  "description": "Test Recipe methods in JavaScript",
  "language": 0
})
```

### Adding Tests to the POM

Create a `pom.js` in your test directory and reference it from the parent pom with the `test` flag:

**test/pom.js:**
```javascript
foam.POM({
  name: 'test',
  files: [
    { name: 'RecipeTest',        flags: 'js|java' },
    { name: 'RecipeTestMethods', flags: 'js|java' }
  ]
});
```

### Understanding POM Flags

The `flags` property in POM file entries controls which build tasks include the file for processing:

- **`js`** - Include in JavaScript build tasks (bundling for client-side)
- **`java`** - Include in Java build tasks (compilation for server-side)
- **`js|java`** - Include in both JavaScript and Java builds (the `|` means OR)
- **`test`** - Only include when running test tasks
- **`js&test`** - Include in JavaScript builds only when testing (the `&` means AND)

The flags determine *when* a file is processed, not *what* is generated from it. A FOAM model with `flags: 'js|java'` will be included in both build pipelines—FOAM then determines what to generate based on the model's content (e.g., `javaCode` blocks generate Java, JavaScript functions remain JavaScript).

For test files, use `js|java` so the model is available to both build pipelines. The base class determines the test type: `foam.core.test.Test` creates server-side Java tests, while `foam.core.test.JSTest` creates client-side JavaScript tests.

When referencing a test directory from a parent POM, use `flags: 'test'` so test code is only included during test runs, not in production builds.

## Running Tests from the Application UI

For test-driven development, you can include test infrastructure in a running application by adding `--flags:test` to your build command:

```bash
./build.sh -Jdemo --flags:test
```

Once the application is running, log in and navigate to the test menu at `#admin-tests`. From this interface you can:

- Browse all registered test cases
- Run individual JavaScript (client-side) tests interactively
- View test results immediately
- Use "Run Client" to execute all JavaScript tests
- Use "Run Failed Client" to re-run only previously failed tests

This workflow is particularly powerful for debugging because you can set breakpoints in your browser's developer tools and step through the code as tests execute. When a test fails, you can:

1. Open the browser's developer tools (F12)
2. Set breakpoints in your test code or the code being tested
3. Run the failing test from the UI
4. Step through the execution to understand why it fails
5. Fix the issue and re-run until the test passes

This tight feedback loop—running tests with full debugger support—makes test-driven development practical and efficient. You can even include `debugger;` statements in your test code (as shown in the RecipeTestMethods example) to automatically pause execution at specific points.

Note: Running server-side tests from the UI is not recommended as it may cause the UI to become unresponsive. For server tests, use the command-line `server-tests` task instead.

**Parent pom.js (src/com/foamdev/cook/pom.js):**
```javascript
foam.POM({
  name: 'recipe',
  projects: [
    { name: 'test/pom', flags: 'test' }
  ],
  files: [
    { name: 'Recipe',         flags: 'js|java' }
  ]
});
```

The `flags: 'test'` ensures the test directory is only included when running tests.

## Test Configuration

If tests require additional configuration (test data, mock services, etc.), place those journals in `deployment/test/`. The build automatically includes this deployment directory when running tests.

For more details, see the [FOAM Testing Guide][foam-testing-guide]. When things go wrong, the [Debugging Guide][foam-debugging] is a good companion.
