# Testing

FOAM provides a testing harness for implementing Unit Test Cases, and in conjunction with the Build, provides for test case execution and reporting.

Test cases can be modeled FOAM classes, or _scripts_.

Both _modeled_ and _script_ tests can target Java and Javascript.

Java tests are executed server side in the JVM, while Javascript, 'client',  tests are executed from a browser (headless).

Java _script_ tests can run in Beanshell or JShell.

## Running Test Cases from the Build
 
1. `./build.sh run-tests`: Execute all client and server tests cases
1. `./build.sh server-tests`: Execute all server test cases
1. `./build.sh client-tests`: Execute all client test cases (by default this is via a headless browser)
1. `./build.sh client-tests --test-headed`: Execute all client tests via headed browser - the application and browser is left running so you can inspect the results.

### Running Specific Tests 

Execute specific test cases by listing their `id`s as an argument to the `run-tests` tasks.  `run-tests, client-tests, server-tests` all accept a comma delimited list of test case `id`s. 

- `./build.sh run-tests:SecurityAuditTest,CSSAuditTest`: Run only the listed test cases. The list can contain a mix of client and server tests.  If only running server tests, using `server-tests` rather than `run-tests` will save a small amount of time.

#### Specific Tests Not Found
`id`s listed but not found are reported as such:

`./build.sh server-test:UnknownTest`
...
`WARNING :: Test not run: UnknownTest. Mode: server. Possible client/server/suite mismatch or typo.`

### Excluding Specific Tests

Exclude tests cases by prefixing their `id` with a `-` (dash). 
- `./build.sh run-tests:-SecurityAuditTest,-CSSAuditTest`: Run all but the listed test cases.

### Test Suite
Tests can be grouped with the `testSuite` property.  The `TestRunnerScript`, which is responsible for invoking the tests, will filter by `testSuite` identifiers. 
- `./build.sh run-tests test-suite:Authentication,Security`: run all tests where `testSuite` matches the listed identifiers.

### Test Output

#### Per Test Output
Each Test of a Test Case generates a `SUCCESS` or `FAILURE` message.

```
passwordTest
	 ✓ SUCCESS: Password hashing with null throws an IllegalArgumentException
	 ✓ SUCCESS: Password hashing with empty string input throws an IllegalArgumentException
	 ✓ SUCCESS: Password hashing with non empty string produces output
	 ✓ SUCCESS: Password verification returns false with password and hash both null

FooBarServiceTest
	 ✘ FAILURE: Expecting xyz
```

Per test output is limited by a buffer. If a Test Case has a large number of tests, the `FAILURE`s may not be output as they are reported last.  In this scenario, set property `onlyReportFailed` to `true` in the Test Case as follows to use the buffer for failure messages.
```
  properties: [
    {
      name: 'onlyReportFailed',
      value: true
    }
  ],
```

#### Summary Output
A summary follows reporting total Test and Test Cases executed. 

When both Server and Client tests are run, Server results are listed first.
Failures are listed again at the end of the summary. 
```
TEST REPORT SERVER - TEST CASES: 182, TESTS: 4826 (PT2M54.48S)
 PASSED: 4817
 FAILED: 9
FooBarServiceTest
	 ✘ FAILURE: Expecting xyz
DIGFooBarRequestTest
	 ✘ FAILURE:
	 ✘ FAILURE: DIG (put) request CANCELLED RECEIVED

...

TEST REPORT CLIENT - TEST CASES: 12, TESTS: 1374 (PT1M6.038S)
 PASSED: 1373
 FAILED: 1
```

## Running Client Test Cases from a FOAM Application

Build with option `--flags:test` and `-Jdemo` (if no other login users will be available).
Once the application is running, login, and navigate to menu:
- `#admin-tests`

Test cases with `Language` of `Javascript` can be run individually or buttons at the top right support running all `client` tests.
- `Run Client`: Run all `Javascript` test cases.
- `Run Failed Client`: Run all `Javascript` tests cases that previously failed. 

It is **not** recommended to run all server tests from the UI as the UI may become unresponsive.  Run individual server tests which you are familiar with. 

## Creating Test Cases (incomplete)
Test cases are either **Scripts** or Modeled FOAM classes.
Both modeled and script tests can target Java and Javascript.

### Modeled Test Case
Steps for adding a modeled test case:
1. Create a FOAM model in a `test` directory in the same package as model you testing
1. The model will extend:
	- foam.core.test.Test  - for a Java, server side, test case.
	- foam.core.test.JSTest - for a Javascript, client side, test case.
1. Implement `runTest(x)`
	- Java
	   ```
	   methods: [
	    {
	      name: 'runTest',
	      javaCode: `
		```
	- Javascript
		```
		methods: [
		  function runTest(x) {
		```
1. Create tests: `test(boolean, message)`
	- Java
		```
		test ( foobar.getStatus().equals("CLOSED"), "FooBar closed");
		```
	- Javascript
		```
		x.test(month == 2, 'Month is March');
		```
1. Add model to pom. 
   - If there is a pom in the `test` directory, use flags `js|java`. 
   - If the tests are managed from a parent pom then use flags `js&test|java&test`.  
   - If setting up a new `test` directory, create a pom in the `test` directory and add it the parent pom as follows: 
		```
		projects: [
			{ name: 'test/pom', flags: 'test' }
		```
1. Add the new model to `test/tests.jrl`
	```
	p({
	  class:"foam.core.foobar.test.FooBarTest",
	  id:"FooBarTest",
	  enabled: true
	})
	```

### Script Test Case
Steps for adding a Script Test Case
1. Launch your FOAM application with build option: `--flags:test`.
1. Navigate to menu #admin.tests
1. Create a New Test
	* Id - Unique human readable test name.  A general rule of thumb is use the name of the model or feature being tested with suffix 'Test'.  Also, it is recommended to not use spaces in the Id to make it easier to select individual test cases from the Build. 
	* Language - one of
		* Beanshell (default) - for a Java, server side, test case
		* JShell - for a Java, server side, test case
		* Javascript - for a Javascript, client side test case
	* Code
		```
		test(Password.verify(FIRST_PASSWORD, result.getPassword()), "Password returned from put should be hash of original password.")
		```
1.  Save
1.  To persist the Test, copy the most recent  `p({})`  block from the  `journals/tests`  to  `tests/tests.jrl`

# Automation
The FOAM repository runs all Java/Server tests on each PR update.  Equivalent to:
`./build.sh server-tests`

# Headless Browser Configuration
Presently only the Chrome Browser is supported. 
See 
- `src/foam/core/browser/BrowserConfig.js` 
- `src/foam/core/browser/browserconfig.jrl`

The `BrowserAgent` has property `type` for specifying the `BrowserConfig`, but `TestRunnerScript` and the `Build` do not provide for setting it (_future work_).

# TODO
- Flow Tests


