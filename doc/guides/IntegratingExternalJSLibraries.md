# Integrating External JavaScript Libraries into FOAM3

This guide details the process of integrating third-party JavaScript libraries (e.g., Konva.js, Chart.js) into the FOAM3 framework.

## 1. Overview
The integration typically involves:
1.  Creating a dedicated package for the library (e.g., `src/org/mylib`).
2.  Defining a `Lib` model to load the external script (from CDN or local).
3.  Creating a Wrapper Component (`foam.u2.View`) to interface with the library.
4.  Registering the new package in the project's POM.

## 2. Directory Structure
Create a new directory in `src/` corresponding to your package structure.
Example: `src/org/konvajs/`

## 3. Implementation Steps

### Step 3.1: Create the POM file
Create a `pom.js` in your library directory to define the package.

**File:** `src/org/konvajs/pom.js`
```javascript
foam.POM({
  name: "konvajs",
  files: [
    { name: "Lib", flags: "web" },
    { name: "KonvaView", flags: "web" }
  ]
});
```

### Step 3.2: Create the Library Loader
Create a `Lib.js` file that defines a `foam.u2.JsLib` (or `org.chartjs.SequentialJsLib` for multiple dependent scripts). This ensures the library is injected into the document head when required.

**File:** `src/org/konvajs/Lib.js`
```javascript
foam.CLASS({
  package: 'org.konvajs',
  name: 'Lib',
  flags: [ 'web' ],
  axioms: [
    foam.u2.JsLib.create({
        src: 'https://unpkg.com/konva@9.3.3/konva.min.js' 
    })
  ]
});
```

### Step 3.3: Create the Wrapper Component
Create a view that `requires` your Lib and initializes the library once loaded.

**File:** `src/org/konvajs/KonvaView.js`
```javascript
foam.CLASS({
  package: 'org.konvajs',
  name: 'KonvaView',
  extends: 'foam.u2.View',
  mixins: [ 'org.konvajs.Lib' ],
  
  properties: [ 'container' ],

  methods: [
    function render() {
      this.SUPER();
      // Lib is loaded automatically by the mixin axiom
      
      var self = this;
      this.start('div', null, this.container$)
        .style({ width: '100%', height: '100%' })
      .end();

      this.container.el().then(function(el) {
         self.waitForLib(el);
      });
    },
    function waitForLib(el) {
       // Poll or use State to wait for global variable
       if ( window.Konva ) {
         this.init(el);
       } else {
         setTimeout(() => this.waitForLib(el), 100);
       }
    },
    function init(el) {
       // Initialize library here
    }
  ]
});
```

### Step 3.4: Register the Package
Add your new POM to the main `foam3/pom.js` (or `src/pom.js`) so the build system knows about it.

**File:** `foam3/pom.js`
```javascript
foam.POM({
  ...
  projects: [
    ...
    { name: 'src/org/konvajs/pom' },
    ...
  ]
});
```

## 4. Verification
Create a `Demo.js` component to test the integration and ensure it renders correctly within FOAM's component system.

## Non-view libraries (imperative loading)

The JsLib axiom only wraps `render()`/`paintSelf()`, so it does nothing for
classes that aren't views. For a library consumed by plain logic (e.g.
dagre in `org.konvajs.graph.DagreLayouter`), wrap the loader in a small
class and await it imperatively:

    // org.konvajs.graph.DagreLib
    function load() {
      return foam.u2.JsLib.create({ src: this.SRC }).installLib();
    }

    // caller
    await this.DagreLib.create().load();
    if ( ! globalThis.dagre ) { /* degrade gracefully */ }

JsLib resolves its promise even when the script fails to load, so the
caller must check for the global afterwards. As with any CDN script, the
URL and its sha256 hash must be added to `src/cspdirectives.jrl` under
`script-src`.
