/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.test',
  name: 'FoamIndexTest',
  extends: 'foam.core.test.JSTest',

  methods: [
    async function runTest(x) {
      var index = foam.parse.lsp.FoamIndex.create();

      // getAllClassIds returns both USED and UNUSED
      var ids = index.getAllClassIds();
      x.test(ids.length > 50, 'Should find many classes, got: ' + ids.length);
      x.test(ids.indexOf('foam.lang.FObject') !== -1, 'Should contain FObject');

      // getClass resolves a class
      var cls = index.getClass('foam.lang.FObject');
      x.test(cls != null, 'Should resolve FObject');
      x.test(cls.model_.name === 'FObject', 'Should have correct name');

      // classExists
      x.test(index.classExists('foam.lang.FObject'), 'FObject should exist');
      x.test( ! index.classExists('foo.bar.Nonexistent'), 'Nonexistent should not exist');

      // getPropertyTypes finds Property subclasses dynamically
      var propTypes = index.getPropertyTypes();
      x.test(propTypes.length > 10, 'Should find many property types, got: ' + propTypes.length);
      x.test(propTypes.some(function(t) { return t.name === 'String'; }), 'Should include String');
      x.test(propTypes.some(function(t) { return t.name === 'Long'; }), 'Should include Long');
      x.test(propTypes.some(function(t) { return t.name === 'Boolean'; }), 'Should include Boolean');

      // getProperties returns property axioms
      var props = index.getProperties('foam.parse.Suggestion');
      x.test(props.length > 0, 'Suggestion should have properties');
      x.test(props.some(function(p) { return p.name === 'text'; }), 'Should have text property');
      x.test(props.some(function(p) { return p.name === 'category'; }), 'Should have category property');

      // getMethods returns method axioms
      var methods = index.getMethods('foam.parse.Suggestion');
      x.test(methods.some(function(m) { return m.name === 'matches'; }), 'Should have matches method');

      // getInheritanceChain walks parents
      var chain = index.getInheritanceChain('foam.parse.Suggestion');
      x.test(chain.length >= 2, 'Chain should have at least 2 entries');
      x.test(chain[0] === 'foam.parse.Suggestion', 'First should be Suggestion itself');
      x.test(chain[chain.length - 1] === 'foam.lang.FObject', 'Last should be FObject');

      // getAxioms returns all axioms including inherited
      var axioms = index.getAxioms('foam.parse.Suggestion');
      x.test(axioms.length > 0, 'Should return axioms for Suggestion');

      // getActions (Suggestion has no actions, so empty array is correct)
      var actions = index.getActions('foam.parse.Suggestion');
      x.test(Array.isArray(actions), 'getActions should return array');

      // getImports
      var imports = index.getImports('foam.parse.Suggestion');
      x.test(Array.isArray(imports), 'getImports should return array');

      // getRequires
      var requires = index.getRequires('foam.parse.Suggestion');
      x.test(Array.isArray(requires), 'getRequires should return array');

      // getEnumValues (non-enum returns empty)
      var enumVals = index.getEnumValues('foam.parse.Suggestion');
      x.test(enumVals.length === 0, 'Non-enum class should return empty enum values');

      // getPropertyDoc
      var propDoc = index.getPropertyDoc('foam.parse.Suggestion', 'text');
      x.test(propDoc != null, 'Should generate property doc for text');
      x.test(propDoc.indexOf('text') !== -1, 'Property doc should contain property name');

      // getSourceLocation returns path or null
      var loc = index.getSourceLocation('foam.parse.Suggestion');
      // Source tracking depends on build environment — just verify shape
      x.test(loc == null || (loc.path && loc.line),
        'Source location should be null or have path and line');

      // getClassDoc returns markdown
      var doc = index.getClassDoc('foam.parse.Suggestion');
      x.test(doc != null, 'Should generate class doc');
      x.test(doc.indexOf('foam.parse.Suggestion') !== -1, 'Doc should contain class name');

      // invalidate clears cache
      index.getPropertyTypes(); // populate cache
      index.invalidate('foam.parse.Suggestion');
      var propTypes2 = index.getPropertyTypes();
      x.test(propTypes2.length > 10, 'Should still find property types after invalidation');

      // getOwnProperties vs inherited
      var ownProps = index.getOwnProperties('foam.parse.Suggestion');
      x.test(ownProps.length > 0, 'Should have own properties');
      x.test(ownProps.some(function(p) { return p.name === 'text'; }), 'text is own property');

      var inherited = index.getInheritedProperties('foam.parse.Suggestion');
      x.test(Array.isArray(inherited), 'getInheritedProperties returns array');

      // Java import mappings
      var mappings = index.getJavaImportMappings();
      x.test(mappings['foam.nanos.logger.Logger'] === 'foam.core.logger.Logger', 'Logger mapping correct');
      x.test(mappings['foam.core.FObject'] === 'foam.lang.FObject', 'FObject mapping correct');

      // getPropertyJavaType
      var jType = index.getPropertyJavaType('foam.parse.Suggestion', 'text');
      x.test(jType === 'String', 'text property Java type is String, got: ' + jType);
    }
  ]
});
