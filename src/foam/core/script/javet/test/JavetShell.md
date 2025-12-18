#JavetShell

The Javet system allows the server to run FOAM client code in a Node.js process.

**NOTE**: first build will require --cleanAll,all as this PR pulls in new Java libraries.

### Outstanding

- After script execution the executor waits until timeout - approximately 10 seconds. See `DEVELOPER NOTE`s in `JavetShell.js` and `JavetShellFactory.js`. 

## Use

### Test Case

`./build.sh client-test:JavetShellConcurrentTest`

### Manual Testing

`./build.sh` -a -Jdemo

then execute:

- run `tools/exampleBinNode.js` from the file system.  _(you'll most likely need to set the Session ID in the script)_
- run script `NodeShellTest` _(presently takes about 12s to 'complete' - script will be in 'running' state until complete)_

### The Build
The Build now uses JavetShell for client test cases rather than a browser.

`./build.sh client-tests`

**NOTE**: failure results differ in two Date test cases.

To continue using a browser for testing build with `test-headed` option.

`./build.sh client-tests test-headed

### Script 
See example script `NodeShellTest`

Create a script with language `NODESHELL` with FOAM javascript:

**NOTE**: `NODESHELL` scripts use a threadpool to manage concurrent shells, so if you have a number of concurrent `NODESHELL` scripts, they will be queued based on threadpool `javetThreadPool` thread count.

```
// ScriptParameters access
console.info('ps.getParameter(a)', ps.getParameter('a'));
console.info('ps.get(a)', ps.get('a')); // short form of getParameter
console.info('ps.getDate()', ps.getDate());

// MLang
let c = (await x.countryDAO.select(MLang.COUNT())).value;
console.info('Country count', c);

// DAO
x.countryDAO.select(function(c) {
    console.info('Country', c.toSummary());
});
```

### Direct JavaShell use

**NOTE**: Use caution with direct JavetShell use. Recommend to use the `javetThreadPool` and Agency, as each thread will load a copy of foam-bin. 

```
    JavetShell shell = (JavetShell) x.get("javetShell");
    shell.setCode(...);
    shell.execute(x);

    JavetShell.create(x, "...code...").execute(x);
```

See `foam/core/test/TestRunnerScript.js` (line 463) for example.

## Other / Features
JavetShell provides for specifying:

* the user whose session will be used to initialize the ClientBuilder.  Defaults to 'admin'.
* the printstream which captures `console` output.  **NOTE** Only `console.info` is captured by the printstream. All `condole` output is capture by the Logger.
* if `eval` is enabled. Defautls to false, Enabled for NDOESHELL scripts.

## Considerations / Concerns
When designing a use, be aware that each thread that uses a JavetShell will load foam-bin into a ThreadLocal.

To control memory use the `javetThreadPool` Agency and call the JavetShellFactory with the Agency's context.

```
    Agency agency = (Agency) x.get("javetThreadPool");
    Future future = agency.submit(x, new ContextAgent() {
      public void execute(X x) {
        JavetShell shell = (JavetShell) x.get("javetShell");
        shell.setCode(...);
        shell.execute(x);
      }
   }, "identifier");
```

See `foam/core/script/javet/test/JavetShellConcurrentTest.js` for example. 

## Documentation
* https://docs.google.com/presentation/d/1lQ8xIHuywuE0ydqm2w6xq8OeQZO_WeTLYXW9bNflQb8/edit?pli=1&slide=id.p#slide=id.p
* https://github.com/caoccao/Javet
* https://www.caoccao.com/Javet/index.html
* https://www.caoccao.com/Javet/reference/javadoc/allclasses-frame.html
