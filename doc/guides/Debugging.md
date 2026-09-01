<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [Debugging Guide](#debugging-guide)
  - [JavaScript Debugging](#javascript-debugging)
    - [Chrome DevTools](#chrome-devtools)
      - [Opening DevTools](#opening-devtools)
      - [Quick File Navigation](#quick-file-navigation)
      - [Setting Breakpoints](#setting-breakpoints)
      - [Console Commands](#console-commands)
      - [Network Debugging](#network-debugging)
  - [Java Debugging](#java-debugging)
    - [Starting the Server in Debug Mode](#starting-the-server-in-debug-mode)
    - [Understanding Source File Locations](#understanding-source-file-locations)
    - [VS Code Remote Debugging](#vs-code-remote-debugging)
      - [Inspecting Variables](#inspecting-variables)
    - [IntelliJ IDEA Remote Debugging](#intellij-idea-remote-debugging)
    - [Setting Breakpoints](#setting-breakpoints-1)
    - [Debug Window Features](#debug-window-features)
  - [Common Debugging Tips](#common-debugging-tips)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# Debugging Guide

This guide covers debugging techniques for both JavaScript and Java code in the FOAM3 project.

## JavaScript Debugging

### Chrome DevTools

The primary tool for debugging JavaScript code is Chrome DevTools. Here are the key features:

#### Opening DevTools
- Windows/Linux: `Ctrl + Shift + I` or `F12`
- Mac: `Cmd + Option + I`

#### Quick File Navigation
- Use `Cmd + P` (Mac) or `Ctrl + P` (Windows/Linux) to quickly search and open files in the Sources panel
- This is especially useful when working with large codebases

#### Setting Breakpoints
1. Open DevTools and navigate to the Sources tab
2. Find your JavaScript file in the file tree
3. Click on the line number where you want to set a breakpoint
4. Alternatively, add `debugger;` statement in your code
5. If you want to know when an FObject property is being updated, you can add a debugger
statement in a postSet. Ex. { name: 'field', postSet: function(o, n) { debugger; } }
and the debugger will trip when the value is updated. You can also include an 'if' statement
to only trip when certain values or value transitions occur. The variable 'o' contains
the old value of the property and 'n' contains the new value.

#### Console Commands
```javascript
// Debugging async code with breakpoints
// Example with custom async function
someAsyncFunction()
  .then(result => {
    debugger;  // Breakpoint will work here
    return processResult(result);
  })
  .catch(error => {
    debugger;  // Can debug errors
    console.error(error);
  });
```

#### Network Debugging
- Use the Network tab to monitor HTTP requests
- Filter requests by type (XHR, JS, CSS, etc.)
- Inspect request/response headers and bodies
- Analyze timing and performance
- Enable "Disable cache" checkbox in the Network tab to prevent browser from caching JavaScript files
  - This ensures you always get the latest version of your files during development
  - Particularly useful when making changes to JavaScript code

## Java Debugging

### Starting the Server in Debug Mode

Start the application with debug mode enabled:
```bash
./build.sh -d
```

The `-d` flag launches the JVM with the JDWP debug agent listening on port 8000. It also passes `-g` to `javac`, which includes full debug symbols (source file names, line numbers, and local variable names) in the compiled classes. Without `-g`, the debugger cannot display local variable values.

To use a different port:
```bash
./build.sh -D9005
```

### Understanding Source File Locations

FOAM3 has two kinds of Java source files:

1. **Hand-written Java files** — located under `src/` (e.g., `src/foam/crypto/hash/Hashable.java`). These are regular `.java` files written by developers.

2. **Generated Java files** — located under `build/src/java/` (e.g., `build/src/java/foam/core/demo/DemoObject.java`, generated from `src/foam/core/demo/DemoObject.js`). These are generated from FOAM `.js` model definitions during the build. They are recreated on every build and should never be edited directly.

When configuring a debugger, **both source directories must be listed** so the debugger can resolve breakpoints in both hand-written and generated code. The order matters: `src/` should come first so that hand-written files take priority when the same class name exists in both locations.

### VS Code Remote Debugging

1. Install the **Extension Pack for Java** (includes Debugger for Java)

2. Create or update `.vscode/launch.json`:
```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "java",
            "name": "FOAM3 Remote Debug",
            "request": "attach",
            "hostName": "localhost",
            "port": 8000,
            "projectName": "myproject",
            "sourcePaths": [
                "${workspaceFolder}/src",
                "${workspaceFolder}/build/src/java",
                "${workspaceFolder}/foam3/src"
            ]
        }
    ]
}
```

Configuration notes:
- **`sourcePaths`** — Lists directories where the debugger looks for source files. Order matters:
  - `src/` — hand-written Java files (checked first, e.g., `src/foam/crypto/hash/Hashable.java`)
  - `build/src/java/` — FOAM-generated Java files (e.g., `build/src/java/foam/core/demo/DemoObject.java`)
  - `foam3/src/` — FOAM3 framework source (for stepping into framework code)
- **`projectName`** — Must match the project name shown in VS Code's Java Projects panel (typically the workspace folder name). Replace `myproject` with your actual project name.
- **`port`** — Must match the debug port used in `./build.sh -d` (default 8000)

3. Start the server with `./build.sh -d`, then press `F5` in VS Code or select **Run → Start Debugging**

#### Inspecting Variables

When the debugger hits a breakpoint:
- **Variables panel** (left sidebar) — shows local variables and method parameters. Expand objects to drill into their fields.
- **Watch panel** — add expressions to monitor (e.g., `myObj.getId()`)
- **Debug Console** — evaluate expressions on the fly (e.g., `myObj.toString()`)
- **Hover** — hover over a variable in the editor to see its value inline

If the Variables panel is empty at a breakpoint, the code was likely compiled without `-g`. Rebuild with `./build.sh -d` to include debug symbols.

### IntelliJ IDEA Remote Debugging

1. Start the application with `./build.sh -d`

2. Configure Remote Debugging in IntelliJ:
   - Go to Run → Edit Configurations
   - Click '+' and select 'Remote JVM Debug'
   - Set the following configuration:
     - Name: `FOAM3 Remote Debug`
     - Host: `localhost`
     - Port: `8000`
     - Use module classpath: Select your main module

3. Start the debugger:
   - Click the debug icon or press `Shift + F9`
   - The debugger will connect to your running application

### Setting Breakpoints
1. Click in the gutter (left margin) next to the line number
2. Breakpoint types:
   - Line breakpoint: Regular breakpoint
   - Method breakpoint: Break when method is entered
   - Field breakpoint: Break when field is accessed/modified
   - Exception breakpoint: Break when exception is thrown

### Debug Window Features
- Variables: Inspect current variable values
- Watches: Monitor specific expressions
- Call Stack: View the execution stack
- Breakpoints: Manage all breakpoints
- Console: View application output

## Common Debugging Tips

1. Use conditional breakpoints when you need to break only under specific conditions
2. Utilize the "Evaluate Expression" feature to test code snippets during debugging
3. Use logging strategically to track program flow
4. Remember to remove or disable debug statements before committing code