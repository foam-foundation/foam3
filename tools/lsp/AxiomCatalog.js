/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp',
  name: 'AxiomCatalog',

  documentation: `
    Single source of truth for FOAM axiom metadata used by the LSP.

    Each entry describes one axiom slot — what it does, where it lives
    (top-level vs property vs POM), and whether its value is treated
    as a class id. Both FoamClassGrammar (for completion hints) and
    HoverHandler (for hover text) read from this catalog so the
    descriptions exist in exactly one place.

    Adding a new axiom slot requires touching only this file: the
    grammar's hint and the editor's hover both update automatically.
  `,

  constants: {
    // Top-level class-body axioms. Each entry: { name, scope, hint }.
    // scope is one of 'topKey' / 'propKey' / 'pomKey' so the grammar
    // can route via the correct suggestion factory.
    AXIOMS: [
      // === Top-level class-body slots ===
      { name: 'package',       scope: 'topKey', hint: 'Java/JS package id (e.g., foam.lang)' },
      { name: 'name',          scope: 'topKey', hint: 'Class name (CamelCase)' },
      { name: 'extends',       scope: 'topKey', hint: 'Parent class id' },
      { name: 'implements',    scope: 'topKey', hint: 'Interface ids implemented by this class' },
      { name: 'refines',       scope: 'topKey', hint: 'Target class id this refinement modifies' },
      { name: 'requires',      scope: 'topKey', hint: 'Class ids required by this class (for create())' },
      { name: 'imports',       scope: 'topKey', hint: 'Context names this class consumes' },
      { name: 'exports',       scope: 'topKey', hint: 'Context names this class exports' },
      { name: 'properties',    scope: 'topKey', hint: 'Property axioms (FObject fields)' },
      { name: 'methods',       scope: 'topKey', hint: 'Method axioms' },
      { name: 'actions',       scope: 'topKey', hint: 'Action axioms (UI buttons)' },
      { name: 'listeners',     scope: 'topKey', hint: 'Listener axioms' },
      { name: 'axioms',        scope: 'topKey', hint: 'Raw axiom objects' },
      { name: 'topics',        scope: 'topKey', hint: 'Topic axioms (pub/sub channels)' },
      { name: 'constants',     scope: 'topKey', hint: 'Constant axioms' },
      { name: 'messages',      scope: 'topKey', hint: 'Localizable message axioms' },
      { name: 'sections',      scope: 'topKey', hint: 'Section grouping for properties' },
      { name: 'values',        scope: 'topKey', hint: 'Enum value declarations (foam.ENUM)' },
      { name: 'documentation', scope: 'topKey', hint: 'Class-level documentation string' },
      { name: 'abstract',      scope: 'topKey', hint: 'Boolean — true if class is abstract' },
      { name: 'flags',         scope: 'topKey', hint: 'Build flags ("js", "java", "web", "test", ...)' },
      { name: 'javaImports',   scope: 'topKey', hint: 'Java import statements' },
      { name: 'javaCode',      scope: 'topKey', hint: 'Class-level Java code' },
      { name: 'css',           scope: 'topKey', hint: 'Class-scoped CSS' },
      { name: 'cssTokens',     scope: 'topKey', hint: 'CSS design-token declarations' },
      { name: 'mixins',        scope: 'topKey', hint: 'Mixin class ids' },
      { name: 'tableColumns',  scope: 'topKey', hint: 'Column property names for table views' },
      { name: 'searchColumns', scope: 'topKey', hint: 'Property names for filterable columns' },
      { name: 'sourceModel',   scope: 'topKey', hint: 'RELATIONSHIP — class id at the source side' },
      { name: 'targetModel',   scope: 'topKey', hint: 'RELATIONSHIP — class id at the target side' },
      { name: 'forwardName',   scope: 'topKey', hint: 'RELATIONSHIP — name of the forward navigation' },
      { name: 'inverseName',   scope: 'topKey', hint: 'RELATIONSHIP — name of the inverse navigation' },
      { name: 'cardinality',   scope: 'topKey', hint: 'RELATIONSHIP — "1:*" / "*:*" / "1:1"' },
      { name: 'sourceProperty',scope: 'topKey', hint: 'RELATIONSHIP — overrides for the source side' },
      { name: 'targetProperty',scope: 'topKey', hint: 'RELATIONSHIP — overrides for the target side' },
      { name: 'label',         scope: 'topKey', hint: 'Display label' },
      { name: 'plural',        scope: 'topKey', hint: 'Plural form for UI' },
      { name: 'order',         scope: 'topKey', hint: 'Sort order in containing list' },
      { name: 'ids',           scope: 'topKey', hint: 'Property names that form the primary key' },
      { name: 'static',        scope: 'topKey', hint: 'Static (LIB-style) members' },
      { name: 'of',            scope: 'topKey', hint: 'Class id of contained type' },

      // === Per-property axiom slots ===
      { name: 'class',          scope: 'propKey', hint: 'Property type — short name (String, Long, ...) or full class id' },
      { name: 'name',           scope: 'propKey', hint: 'Property name (camelCase)' },
      { name: 'of',             scope: 'propKey', hint: 'Class id of the contained type (FObjectProperty/Reference/FObjectArray)' },
      { name: 'documentation',  scope: 'propKey', hint: 'Property docstring' },
      { name: 'hidden',         scope: 'propKey', hint: 'Boolean — hide from auto-rendered views' },
      { name: 'transient',      scope: 'propKey', hint: 'Boolean — exclude from serialization' },
      { name: 'value',          scope: 'propKey', hint: 'Default value (literal)' },
      { name: 'factory',        scope: 'propKey', hint: 'function() — computed default' },
      { name: 'expression',     scope: 'propKey', hint: 'function(deps...) — reactive derived value' },
      { name: 'javaCode',       scope: 'propKey', hint: 'Java statement(s) for class-level body' },
      { name: 'javaGetter',     scope: 'propKey', hint: 'Java getter body' },
      { name: 'javaSetter',     scope: 'propKey', hint: 'Java setter body' },
      { name: 'javaFactory',    scope: 'propKey', hint: 'Java factory body' },
      { name: 'javaPreSet',     scope: 'propKey', hint: 'Java code run before set' },
      { name: 'javaPostSet',    scope: 'propKey', hint: 'Java code run after set' },
      { name: 'javaInfoType',   scope: 'propKey', hint: 'Java PropertyInfo class (rare)' },
      { name: 'aliases',        scope: 'propKey', hint: 'Alternate names for serialization' },
      { name: 'label',          scope: 'propKey', hint: 'Display label for UI' },
      { name: 'section',        scope: 'propKey', hint: 'Section name for grouped views' },
      { name: 'visibility',     scope: 'propKey', hint: 'Visibility enum (RW, RO, HIDDEN, ...)' },
      { name: 'view',           scope: 'propKey', hint: 'View class id or { class: "..." }' },
      { name: 'adapt',          scope: 'propKey', hint: 'function(old, nu, prop) — JS adapter' },
      { name: 'preSet',         scope: 'propKey', hint: 'function(old, nu) — JS pre-set hook' },
      { name: 'postSet',        scope: 'propKey', hint: 'function(old, nu) — JS post-set hook' },
      { name: 'required',       scope: 'propKey', hint: 'Boolean — fail validation if empty' },
      { name: 'width',          scope: 'propKey', hint: 'Display width for inputs' },
      { name: 'placeholder',    scope: 'propKey', hint: 'Input placeholder text' },
      { name: 'help',           scope: 'propKey', hint: 'Help text shown next to the input' },
      { name: 'gridColumns',    scope: 'propKey', hint: 'Grid columns occupied by this field' },
      { name: 'tableCellFormatter',     scope: 'propKey', hint: 'function(value, obj, prop) — table cell formatter' },
      { name: 'labelFormatter',         scope: 'propKey', hint: 'function(data, prop) — render-time label' },
      { name: 'shortName',              scope: 'propKey', hint: 'Short name used in CLI/JRL' },
      { name: 'readPermissionRequired', scope: 'propKey', hint: 'Boolean — gate reads on permission' },
      { name: 'writePermissionRequired',scope: 'propKey', hint: 'Boolean — gate writes on permission' },
      { name: 'permissionRequired',     scope: 'propKey', hint: 'Boolean — gate read AND write' },
      { name: 'validateObj',            scope: 'propKey', hint: 'function(...) — validation method' },
      { name: 'tableWidth',             scope: 'propKey', hint: 'Table column width' },
      { name: 'storageTransient',       scope: 'propKey', hint: 'Boolean — exclude from persistence' },
      { name: 'networkTransient',       scope: 'propKey', hint: 'Boolean — exclude from RPC' },
      { name: 'cloneProperty',          scope: 'propKey', hint: 'function(value) — clone hook' },
      { name: 'readOnly',               scope: 'propKey', hint: 'Boolean — disable editing in default view' },

      // === POM-body slots ===
      { name: 'name',             scope: 'pomKey', hint: 'POM project name' },
      { name: 'version',          scope: 'pomKey', hint: 'POM project version' },
      { name: 'journalFiles',     scope: 'pomKey', hint: 'Extra .jrl files to load (rare; usually auto-loaded from same dir)' },
      { name: 'files',            scope: 'pomKey', hint: 'FOAM .js model files in this project (flags decide js/java/test)' },
      { name: 'javaFiles',        scope: 'pomKey', hint: 'Hand-written .java files (no FOAM .js sibling)' },
      { name: 'projects',         scope: 'pomKey', hint: 'Sub-project pom.js paths to include' },
      { name: 'javaDependencies', scope: 'pomKey', hint: 'Maven coordinates ("group:artifact:version")' }
    ]
  },

  methods: [
    function getHint(scope, name) {
      /**
       * Look up an axiom's hint description by scope ('topKey', 'propKey',
       * 'pomKey') and slot name. Returns '' if no match.
       */
      var axioms = this.AXIOMS;
      for ( var i = 0 ; i < axioms.length ; i++ ) {
        if ( axioms[i].scope === scope && axioms[i].name === name ) {
          return axioms[i].hint;
        }
      }
      return '';
    },

    function findHint(name) {
      /**
       * Find the FIRST hint matching `name` regardless of scope. Used by
       * HoverHandler for cursor-on-axiom-key hover where the scope can be
       * inferred from context but a single description is fine. Top-level
       * scope is checked first because it's what users hit most often.
       */
      var order = [ 'topKey', 'propKey', 'pomKey' ];
      for ( var s = 0 ; s < order.length ; s++ ) {
        var hint = this.getHint(order[s], name);
        if ( hint ) return hint;
      }
      return '';
    },

    function byScope(scope) {
      /**
       * Return all axiom entries for a given scope, in declaration order.
       * Used by FoamClassGrammar to build the topLevelKey/propKey alts.
       */
      var axioms = this.AXIOMS;
      var out = [];
      for ( var i = 0 ; i < axioms.length ; i++ ) {
        if ( axioms[i].scope === scope ) out.push(axioms[i]);
      }
      return out;
    }
  ]
});
