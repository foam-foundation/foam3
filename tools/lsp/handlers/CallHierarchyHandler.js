/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'CallHierarchyHandler',

  documentation: 'Call hierarchy for FOAM methods — handles textDocument/prepareCallHierarchy + callHierarchy/{incomingCalls,outgoingCalls}. Built on FoamIndex.getMemberUsages plus subclass walking; no separate parse pass.',

  requires: [
    'foam.parse.lsp.CursorAnalyzer'
  ],

  constants: {
    SYMBOL_KIND_METHOD: 6
  },

  properties: [
    { name: 'index' },
    { name: 'cache' },
    {
      name: 'analyzer',
      factory: function() { return this.CursorAnalyzer.create(); }
    }
  ],

  methods: [
    function prepare(text, position, opt_uri) {
      var segment = this.analyzer.getSegmentAtPosition(text, position);
      if ( ! segment ) return null;

      var classId = this.cache.getClassIdAt(opt_uri || '', text, position.line);
      if ( ! classId ) return null;

      var cls = this.index.getClass(classId);
      if ( ! cls ) return null;

      // Confirm the cursor lands on one of the class's own methods.
      var methods = [];
      try { methods = cls.getOwnAxiomsByClass(foam.lang.Method); } catch (e) {}
      var hit = null;
      for ( var i = 0 ; i < methods.length ; i++ ) {
        if ( methods[i].name === segment ) { hit = methods[i]; break; }
      }
      if ( ! hit ) return null;

      return [ this.itemFor_(classId, segment) ];
    },

    function incomingCalls(item) {
      // Incoming = every class whose method body calls this.methodName, where
      // "this" is the class itself or a subclass (subclasses inherit the
      // method).
      if ( ! item || ! item.data ) return [];
      var targetClass  = item.data.classId;
      var targetMember = item.data.memberName;
      if ( ! targetClass || ! targetMember ) return [];

      // Candidate caller classes: the class itself + every subclass.
      var candidates = [ targetClass ];
      var subs = this.transitiveSubclasses_(targetClass);
      for ( var i = 0 ; i < subs.length ; i++ ) candidates.push(subs[i]);

      var out = [];
      var seen = {};
      for ( var i = 0 ; i < candidates.length ; i++ ) {
        var cid = candidates[i];
        var uses = this.index.getMemberUsages(cid, targetMember);
        for ( var j = 0 ; j < uses.length ; j++ ) {
          var key = cid + '|' + uses[j].axiomName;
          if ( seen[key] ) continue;
          seen[key] = true;
          out.push({
            from: this.itemFor_(cid, uses[j].axiomName.replace(/^methods\./, '')),
            fromRanges: []
          });
        }
      }
      return out;
    },

    function outgoingCalls(item) {
      // Outgoing = every other method on the same class invoked via
      // this.X(...) inside the source method's body. Reuses scanFunctions_
      // to walk just this method's source and resolves names against the
      // class's own + inherited methods.
      if ( ! item || ! item.data ) return [];
      var classId    = item.data.classId;
      var methodName = item.data.memberName;
      if ( ! classId || ! methodName ) return [];

      var cls = this.index.getClass(classId);
      if ( ! cls ) return [];

      var methodAxiom = null;
      try {
        var ms = cls.getOwnAxiomsByClass(foam.lang.Method);
        for ( var i = 0 ; i < ms.length ; i++ ) {
          if ( ms[i].name === methodName ) { methodAxiom = ms[i]; break; }
        }
      } catch (e) {}
      if ( ! methodAxiom || typeof methodAxiom.code !== 'function' ) return [];

      var methodNames = {};
      try {
        var allMethods = cls.getAxiomsByClass(foam.lang.Method);
        for ( var i = 0 ; i < allMethods.length ; i++ ) {
          if ( typeof allMethods[i].name === 'string' ) methodNames[allMethods[i].name] = true;
        }
      } catch (e) {}

      var src = methodAxiom.code.toString();
      var THIS_CALL = /\bthis\.(\w+)\s*\(/g;
      var seen = {};
      var out  = [];
      var m;
      while ( ( m = THIS_CALL.exec(src) ) !== null ) {
        var name = m[1];
        if ( name === methodName )    continue;  // skip self-recursion noise
        if ( ! methodNames[name] )    continue;
        if ( seen[name] )             continue;
        seen[name] = true;
        out.push({ to: this.itemFor_(classId, name), fromRanges: [] });
      }
      return out;
    },

    function transitiveSubclasses_(classId) {
      var out = [];
      var seen = {};
      var queue = [classId];
      while ( queue.length ) {
        var cur = queue.shift();
        var subs = this.index.getSubclasses(cur);
        for ( var i = 0 ; i < subs.length ; i++ ) {
          if ( seen[subs[i]] ) continue;
          seen[subs[i]] = true;
          out.push(subs[i]);
          queue.push(subs[i]);
        }
      }
      return out;
    },

    function itemFor_(classId, memberName) {
      // The position carries its own uri, and it is not always the class's
      // file — a method can live in a refinement or on the Java side. Pair the
      // line with the file it came from.
      var filePath = this.index.getFilePath(classId);
      var pos      = filePath ? this.index.getSymbolPosition(classId, memberName, this.SYMBOL_KIND_METHOD)
                              : { line: 0, character: 0 };
      var uri      = pos.uri || ( filePath ? 'file://' + filePath
                                           : 'file:///' + classId.replace(/\./g, '/') );
      var range    = { start: { line: pos.line, character: pos.character }, end: { line: pos.line, character: pos.character } };
      return {
        name:           memberName,
        kind:           this.SYMBOL_KIND_METHOD,
        uri:            uri,
        range:          range,
        selectionRange: range,
        detail:         classId,
        data:           { classId: classId, memberName: memberName }
      };
    }
  ]
});
