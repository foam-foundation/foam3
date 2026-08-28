/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'DependencyScanner',

  documentation: `Statically extracts flowName references between the blocks
    of a Reflow flow (a JSON array of plain block objects, as produced by
    JSON.parse — never live FOAM objects). Names resolve through one flat
    scope across nesting: a block named "name" is referenced as "name", as
    "name$block" (the block itself), and, when its name ends with "DAO", by
    its short form ("name" minus the "DAO" suffix) unless that short form is
    itself the exact name of another block.`,

  properties: [
    {
      class: 'StringArray',
      name: 'ignore',
      documentation: 'Identifiers that are never block references (command ids such as dao, transform).'
    }
  ],

  methods: [
    function names(blocks) {
      /** Every flowName across all nesting levels, in document order (parent before its children). */
      var result = [];
      function walk(list) {
        for ( var i = 0 ; i < list.length ; i++ ) {
          var b = list[i];
          result.push(b.flowName);
          if ( b.flowChildren && b.flowChildren.length ) walk(b.flowChildren);
        }
      }
      walk(blocks || []);
      return result;
    },

    function scan(blocks) {
      /**
       * Returns { nodes, edges } describing the flow's block graph.
       * node: { name, cmd, cls, parent, depth }
       * edge: { source, target, kind, field } where kind is 'data' | 'reaction' | 'script'
       *   and field is the JSON path (relative to the referring block) of the
       *   string that held the reference.
       */
      var self = this;
      var ignoreSet = {};
      this.ignore.forEach(function(i) { ignoreSet[i] = true; });

      var nodes       = [];
      var blockByName = {};

      function collect(list, parent, depth) {
        for ( var i = 0 ; i < list.length ; i++ ) {
          var b = list[i];
          nodes.push({
            name: b.flowName,
            cmd: b.cmd,
            cls: b.value && b.value.class,
            parent: parent,
            depth: depth
          });
          blockByName[b.flowName] = b;
          if ( b.flowChildren && b.flowChildren.length ) {
            collect(b.flowChildren, b.flowName, depth + 1);
          }
        }
      }
      collect(blocks || [], null, 0);

      var allNames = {};
      nodes.forEach(function(n) { allNames[n.name] = true; });

      // A block named "xDAO" is also addressable as "x", unless "x" is
      // itself the exact name of another block (exact name always wins).
      var daoShortAlias = {};
      nodes.forEach(function(n) {
        var name = n.name;
        if ( name.length > 3 && name.slice(-3) === 'DAO' ) {
          var short = name.slice(0, -3);
          if ( ! allNames[short] && ! (short in daoShortAlias) ) {
            daoShortAlias[short] = name;
          }
        }
      });

      function resolveToken(token) {
        if ( allNames[token] ) return token;
        if ( token.length > 6 && token.slice(-6) === '$block' ) {
          var base = token.slice(0, -6);
          if ( allNames[base] ) return base;
        }
        if ( daoShortAlias[token] ) return daoShortAlias[token];
        return null;
      }

      var edges    = [];
      var edgeKeys = {};

      function emitRef(referrerName, str, kind, field) {
        var re = /[A-Za-z_$][\w$]*/g;
        var m;
        while ( (m = re.exec(str)) !== null ) {
          var tok = m[0];
          if ( m.index > 0 && str.charAt(m.index - 1) === '.' ) continue;
          if ( ignoreSet[tok] ) continue;
          var resolved = resolveToken(tok);
          if ( ! resolved ) continue;
          if ( resolved === referrerName ) continue;
          var key = resolved + '|' + referrerName + '|' + kind + '|' + field;
          if ( edgeKeys[key] ) continue;
          edgeKeys[key] = true;
          edges.push({ source: resolved, target: referrerName, kind: kind, field: field });
        }
      }

      // Walks one block's own JSON structure (never into flowChildren —
      // those are separate nodes scanned on their own — and never the keys
      // flowName/class), classifying string leaves by the key that holds
      // them, or 'reaction' for anything nested under a 'reactions_' key.
      function walkFields(obj, path, referrerName, forcedKind) {
        if ( obj === null || obj === undefined ) return;
        if ( typeof obj === 'string' ) {
          if ( forcedKind ) emitRef(referrerName, obj, forcedKind, path);
          return;
        }
        if ( Array.isArray(obj) ) {
          for ( var i = 0 ; i < obj.length ; i++ ) {
            walkFields(obj[i], path + '[' + i + ']', referrerName, forcedKind);
          }
          return;
        }
        if ( typeof obj === 'object' ) {
          for ( var key in obj ) {
            if ( ! Object.prototype.hasOwnProperty.call(obj, key) ) continue;
            if ( key === 'flowChildren' || key === 'flowName' || key === 'class' ) continue;
            var childPath = path ? path + '.' + key : key;
            var val = obj[key];

            if ( key === 'reactions_' ) {
              walkFields(val, childPath, referrerName, 'reaction');
              continue;
            }
            if ( forcedKind ) {
              walkFields(val, childPath, referrerName, forcedKind);
              continue;
            }
            var kind = null;
            if ( key === 'cmd' || key === 'src' ) kind = 'data';
            else if ( key.indexOf('daoKey') === 0 ) kind = 'data';
            else if ( key === 'code' || key === 'script' || key === 'countOnClick' ) kind = 'script';

            if ( kind ) {
              walkFields(val, childPath, referrerName, kind);
            } else if ( typeof val === 'object' && val !== null ) {
              walkFields(val, childPath, referrerName, null);
            }
          }
        }
      }

      nodes.forEach(function(n) {
        walkFields(blockByName[n.name], '', n.name, null);
      });

      return { nodes: nodes, edges: edges };
    },

    function rewrite(blocks, renames) {
      /**
       * Mutates blocks in place: renames flowName at every nesting level and
       * rewrites references inside the same scanned string fields that scan()
       * reads, using the same token rules. renames = { oldName: newName }.
       */
      renames = renames || {};

      var aliasMap = {};
      for ( var oldName in renames ) {
        if ( ! Object.prototype.hasOwnProperty.call(renames, oldName) ) continue;
        var newName = renames[oldName];
        aliasMap[oldName] = newName;
        aliasMap[oldName + '$block'] = newName + '$block';
        if ( oldName.length > 3 && oldName.slice(-3) === 'DAO' &&
             newName.length > 3 && newName.slice(-3) === 'DAO' ) {
          aliasMap[oldName.slice(0, -3)] = newName.slice(0, -3);
        }
      }

      function renameFlowNames(list) {
        for ( var i = 0 ; i < list.length ; i++ ) {
          var b = list[i];
          if ( Object.prototype.hasOwnProperty.call(renames, b.flowName) ) {
            b.flowName = renames[b.flowName];
          }
          if ( b.flowChildren && b.flowChildren.length ) renameFlowNames(b.flowChildren);
        }
      }

      function rewriteString(str) {
        var re = /[A-Za-z_$][\w$]*/g;
        var result = '';
        var lastIndex = 0;
        var m;
        while ( (m = re.exec(str)) !== null ) {
          var tok = m[0];
          var precededByDot = m.index > 0 && str.charAt(m.index - 1) === '.';
          if ( ! precededByDot && Object.prototype.hasOwnProperty.call(aliasMap, tok) ) {
            result += str.slice(lastIndex, m.index) + aliasMap[tok];
            lastIndex = m.index + tok.length;
          }
        }
        result += str.slice(lastIndex);
        return result;
      }

      // Same field classification as scan()'s walkFields, but mutates
      // string leaves in place instead of collecting edges.
      function walkAndRewrite(obj, forcedKind) {
        if ( obj === null || typeof obj !== 'object' ) return;
        if ( Array.isArray(obj) ) {
          for ( var i = 0 ; i < obj.length ; i++ ) {
            if ( typeof obj[i] === 'string' ) {
              if ( forcedKind ) obj[i] = rewriteString(obj[i]);
            } else {
              walkAndRewrite(obj[i], forcedKind);
            }
          }
          return;
        }
        for ( var key in obj ) {
          if ( ! Object.prototype.hasOwnProperty.call(obj, key) ) continue;
          if ( key === 'flowChildren' || key === 'flowName' || key === 'class' ) continue;
          var val  = obj[key];
          var kind = forcedKind;
          if ( key === 'reactions_' ) {
            kind = 'reaction';
          } else if ( ! kind ) {
            if ( key === 'cmd' || key === 'src' ) kind = 'data';
            else if ( key.indexOf('daoKey') === 0 ) kind = 'data';
            else if ( key === 'code' || key === 'script' || key === 'countOnClick' ) kind = 'script';
          }
          if ( typeof val === 'string' ) {
            if ( kind ) obj[key] = rewriteString(val);
          } else {
            walkAndRewrite(val, kind);
          }
        }
      }

      renameFlowNames(blocks || []);

      function walkBlocksForRewrite(list) {
        for ( var i = 0 ; i < list.length ; i++ ) {
          var b = list[i];
          walkAndRewrite(b, null);
          if ( b.flowChildren && b.flowChildren.length ) walkBlocksForRewrite(b.flowChildren);
        }
      }
      walkBlocksForRewrite(blocks || []);
    },

    function freeName(name, isTaken) {
      /** First "base + i + suffix" (i = 1, 2, ...) for which isTaken is false. */
      var m      = /^(.*?)(\d*)(DAO)?$/.exec(name);
      var base   = m[1];
      var suffix = m[3] || '';
      for ( var i = 1 ;  ; i++ ) {
        var cand = base + i + suffix;
        if ( ! isTaken(cand) ) return cand;
      }
    }
  ]
});
