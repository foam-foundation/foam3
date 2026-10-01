foam.INTERFACE({
  package: 'foam.core.grant',
  name: 'GrantI',

  methods: [
    {
      name: 'getPermissions',
      type: 'foam.core.grant.PermissionSet',
      documentation: 'Returns the complete set of permissions this grant provides'
    }
  ]
});


foam.CLASS({
  package: 'foam.core.grant',
  name: 'Grant',
  implements: [ 'foam.core.grant.GrantI' ],

  documentation: 'Base class for all Grant implementations. Returns empty PermissionSet by default.',

  constants: [
    {
      name: 'GLOBAL_USER_ID',
      type: 'Long',
      value: 0,
      javaValue: '0L',
      documentation: 'Special user id representing global grants'
    },
    {
      name: 'SHAREABLE_USER_ID',
      type: 'Long',
      value: -1,
      javaValue: '-1L',
      documentation: 'Special user id for shareable grant templates'
    }
  ],

  methods: [
    {
      name: 'getPermissions',
      type: 'foam.core.grant.PermissionSet',
      code: function() { return foam.core.grant.TriePermissionSet.EMPTY; },
      javaCode: 'return foam.core.grant.TriePermissionSet.EMPTY;'
    }
  ]
});


foam.INTERFACE({
  package: 'foam.core.grant',
  name: 'PermissionSet',

  documentation: `
    Interface for permission sets.

    Implementations include TriePermissionSet, CompoundPermissionSet,
    PermissionedPermissionSet, GlobalPermissionSet, and RecordingPermissionSet.

    The snapshot() method evaluates conditions and flattens the tree where possible.
    Static PermissionSets (like TriePermissionSet) return themselves or a flattened Trie.
    Dynamic PermissionSets (like RecordingPermissionSet) return themselves since they
    cannot be meaningfully flattened.
  `,

  methods: [
    {
      name: 'check',
      type: 'Boolean',
      args: 'String permission',
      documentation: 'Check if permission is granted.'
    },
    {
      name: 'snapshot',
      type: 'foam.core.grant.PermissionSet',
      args: 'Context x',
      documentation: `
        Evaluate conditions and flatten where possible.
        Returns TriePermissionSet for static sets, or self for dynamic sets.
      `
    }
  ]
});


foam.CLASS({
  package: 'foam.core.grant',
  name: 'TriePermissionSet',
  implements: [ 'foam.core.grant.PermissionSet' ],

  documentation: `
    Trie-based permission set split on dots.

    Stores boolean true at nodes for granted permissions.
    Supports structural sharing for memory efficiency.

    Thread-safety: Immutable operations (add, union)
    return new instances, enabling safe concurrent reads.
  `,

  javaImports: [
    'java.util.HashMap',
    'java.util.Map'
  ],

  constants: [
    {
      name: 'EMPTY',
      type: 'foam.core.grant.TriePermissionSet',
      factory: function() { return foam.core.grant.TriePermissionSet.create(); },
      javaValue: 'new foam.core.grant.TriePermissionSet()'
    }
  ],

  properties: [
    {
      class: 'Object',
      name: 'root',
      factory: function() { return {}; },
      javaFactory: 'return new HashMap<String, Object>();',
      documentation: 'Root node of the Trie. Each node is a Map<String, Object> where values are either true (Boolean) or another Map (child node).'
    }
  ],

  methods: [
    {
      name: 'check',
      type: 'Boolean',
      args: 'String permission',
      documentation: 'Check if permission is granted. Returns true if permission or a parent wildcard matches.',
      code: function(permission) {
        var parts = permission.split('.');
        var node = this.root;

        for ( var i = 0 ; i < parts.length ; i++ ) {
          if ( node['*'] === true ) return true;

          var part = parts[i];
          if ( ! node[part] ) return false;

          if ( node[part] === true ) {
            return i === parts.length - 1;
          }

          node = node[part];
        }

        return node[''] === true || node['*'] === true;
      },
      javaCode: `
        String[] parts = permission.split("\\\\.");
        Map<String, Object> node = (Map<String, Object>) getRoot();

        for ( int i = 0 ; i < parts.length ; i++ ) {
          Object wildcard = node.get("*");
          if ( wildcard == Boolean.TRUE ) return true;

          String part = parts[i];
          Object next = node.get(part);
          if ( next == null ) return false;

          if ( next == Boolean.TRUE ) {
            return i == parts.length - 1;
          }

          node = (Map<String, Object>) next;
        }

        return node.get("") == Boolean.TRUE || node.get("*") == Boolean.TRUE;
      `
    },
    {
      name: 'add',
      type: 'foam.core.grant.TriePermissionSet',
      args: 'String permission',
      documentation: 'Add a permission. Returns new TriePermissionSet (immutable).',
      code: function(permission) {
        var result = this.cls_.create();
        result.root = this.cloneNode_(this.root);

        var parts = permission.split('.');
        var node = result.root;

        for ( var i = 0 ; i < parts.length ; i++ ) {
          var part = parts[i];
          var isLast = i === parts.length - 1;

          if ( isLast ) {
            if ( node[part] && node[part] !== true ) {
              node[part] = this.cloneNode_(node[part]);
              node[part][''] = true;
            } else {
              node[part] = true;
            }
          } else {
            if ( ! node[part] || node[part] === true ) {
              var newNode = {};
              if ( node[part] === true ) newNode[''] = true;
              node[part] = newNode;
            } else {
              node[part] = this.cloneNode_(node[part]);
            }
            node = node[part];
          }
        }

        return result;
      },
      javaCode: `
        TriePermissionSet result = new TriePermissionSet();
        result.setRoot(cloneNode_((Map<String, Object>) getRoot()));

        String[] parts = permission.split("\\\\.");
        Map<String, Object> node = (Map<String, Object>) result.getRoot();

        for ( int i = 0 ; i < parts.length ; i++ ) {
          String part = parts[i];
          boolean isLast = i == parts.length - 1;

          if ( isLast ) {
            Object existing = node.get(part);
            if ( existing != null && existing != Boolean.TRUE ) {
              Map<String, Object> cloned = (Map<String, Object>) cloneNode_((Map<String, Object>) existing);
              cloned.put("", Boolean.TRUE);
              node.put(part, cloned);
            } else {
              node.put(part, Boolean.TRUE);
            }
          } else {
            Object existing = node.get(part);
            if ( existing == null || existing == Boolean.TRUE ) {
              Map<String, Object> newNode = new HashMap<>();
              if ( existing == Boolean.TRUE ) newNode.put("", Boolean.TRUE);
              node.put(part, newNode);
              node = newNode;
            } else {
              Map<String, Object> cloned = (Map<String, Object>) cloneNode_((Map<String, Object>) existing);
              node.put(part, cloned);
              node = cloned;
            }
          }
        }

        return result;
      `
    },
    {
      name: 'union',
      type: 'foam.core.grant.TriePermissionSet',
      args: 'foam.core.grant.TriePermissionSet other',
      documentation: 'Merge two TriePermissionSets.',
      code: function(other) {
        var result = this.cls_.create();
        result.root = this.unionNodes_(this.root, other.root);
        return result;
      },
      javaCode: `
        TriePermissionSet result = new TriePermissionSet();
        result.setRoot(unionNodes_(
          (Map<String, Object>) getRoot(),
          (Map<String, Object>) other.getRoot()
        ));
        return result;
      `
    },
    {
      name: 'snapshot',
      type: 'foam.core.grant.PermissionSet',
      args: 'Context x',
      documentation: 'TriePermissionSet is already flat, returns itself.',
      code: function(x) {
        return this;
      },
      javaCode: 'return this;'
    },
    {
      name: 'cloneNode_',
      type: 'Map',
      args: 'Map node',
      documentation: 'Deep clone a Trie node',
      code: function(node) {
        if ( node === true ) return true;
        var result = {};
        for ( var key in node ) {
          result[key] = this.cloneNode_(node[key]);
        }
        return result;
      },
      javaCode: `
        if ( node == null ) return new HashMap<String, Object>();
        Map<String, Object> result = new HashMap<>();
        Map<String, Object> nodeMap = (Map<String, Object>) node;
        for ( Map.Entry<String, Object> entry : nodeMap.entrySet() ) {
          Object value = entry.getValue();
          if ( value == Boolean.TRUE ) {
            result.put(entry.getKey(), Boolean.TRUE);
          } else {
            result.put(entry.getKey(), cloneNode_((Map<String, Object>) value));
          }
        }
        return result;
      `
    },
    {
      name: 'unionNodes_',
      type: 'Object',
      args: 'Object a, Object b',
      documentation: 'Recursively merge two Trie nodes',
      code: function(a, b) {
        // Canonical forms: leaves are `true`; nodes with children are Maps;
        // nodes that are both leaf AND have children are `{'':true, ...children}`.
        // A Map containing only `{'':true}` must collapse back to `true` so that
        // a later union with a child path doesn't recurse into the '' key and
        // create a nested `{'':{'':true}}` (which check() can't traverse).
        if ( a === true && b === true ) return true;
        if ( a === true ) {
          var fromB = this.cloneNode_(b);
          fromB[''] = true;
          if ( Object.keys(fromB).length === 1 ) return true;
          return fromB;
        }
        if ( b === true ) {
          var fromA = this.cloneNode_(a);
          fromA[''] = true;
          if ( Object.keys(fromA).length === 1 ) return true;
          return fromA;
        }

        var result = {};
        var keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);

        for ( var key of keys ) {
          var aVal = a ? a[key] : undefined;
          var bVal = b ? b[key] : undefined;

          if ( aVal === undefined ) {
            result[key] = bVal === true ? true : this.cloneNode_(bVal);
          } else if ( bVal === undefined ) {
            result[key] = aVal === true ? true : this.cloneNode_(aVal);
          } else {
            result[key] = this.unionNodes_(aVal, bVal);
          }
        }

        var rkeys = Object.keys(result);
        if ( rkeys.length === 1 && rkeys[0] === '' && result[''] === true ) {
          return true;
        }

        return result;
      },
      javaCode: `
        // Canonical forms: leaves are Boolean.TRUE; nodes with children are Maps;
        // nodes that are both leaf AND have children are {"":TRUE, ...children}.
        // A Map containing only {"":TRUE} must collapse back to TRUE so that
        // a later union with a child path doesn't recurse into the "" key and
        // create a nested {"":{"":TRUE}} (which check() can't traverse).
        if ( a == Boolean.TRUE && b == Boolean.TRUE ) return Boolean.TRUE;
        if ( a == Boolean.TRUE ) {
          Map<String, Object> result = cloneNode_((Map<String, Object>) b);
          result.put("", Boolean.TRUE);
          if ( result.size() == 1 ) return Boolean.TRUE;
          return result;
        }
        if ( b == Boolean.TRUE ) {
          Map<String, Object> result = cloneNode_((Map<String, Object>) a);
          result.put("", Boolean.TRUE);
          if ( result.size() == 1 ) return Boolean.TRUE;
          return result;
        }

        Map<String, Object> aMap = (Map<String, Object>) a;
        Map<String, Object> bMap = (Map<String, Object>) b;

        if ( aMap == null && bMap == null ) return new HashMap<String, Object>();
        if ( aMap == null ) return cloneNode_(bMap);
        if ( bMap == null ) return cloneNode_(aMap);

        Map<String, Object> result = new HashMap<>();

        java.util.Set<String> keys = new java.util.HashSet<>();
        keys.addAll(aMap.keySet());
        keys.addAll(bMap.keySet());

        for ( String key : keys ) {
          Object aVal = aMap.get(key);
          Object bVal = bMap.get(key);

          if ( aVal == null ) {
            result.put(key, bVal == Boolean.TRUE ? Boolean.TRUE : cloneNode_((Map<String, Object>) bVal));
          } else if ( bVal == null ) {
            result.put(key, aVal == Boolean.TRUE ? Boolean.TRUE : cloneNode_((Map<String, Object>) aVal));
          } else {
            result.put(key, unionNodes_(aVal, bVal));
          }
        }

        if ( result.size() == 1 && result.get("") == Boolean.TRUE ) {
          return Boolean.TRUE;
        }

        return result;
      `
    },
    {
      name: 'toStringPermissions',
      type: 'String[]',
      documentation: 'Return all permissions as an array of strings (for debugging/auditing)',
      code: function() {
        var results = [];
        this.collectPermissions_(this.root, '', results);
        return results;
      },
      javaCode: `
        java.util.List<String> results = new java.util.ArrayList<>();
        collectPermissions_((Map<String, Object>) getRoot(), "", results);
        return results.toArray(new String[0]);
      `
    },
    {
      name: 'collectPermissions_',
      args: 'Map node, String prefix, java.util.List results',
      documentation: 'Recursively collect all permissions into results array',
      code: function(node, prefix, results) {
        for ( var key in node ) {
          var val = node[key];
          var path = prefix ? prefix + '.' + key : key;

          if ( key === '' ) {
            results.push(prefix);
          } else if ( val === true ) {
            results.push(path);
          } else {
            this.collectPermissions_(val, path, results);
          }
        }
      },
      javaCode: `
        Map<String, Object> nodeMap = (Map<String, Object>) node;
        for ( Map.Entry<String, Object> entry : nodeMap.entrySet() ) {
          String key = entry.getKey();
          Object val = entry.getValue();
          String path = prefix.isEmpty() ? key : prefix + "." + key;

          if ( key.isEmpty() ) {
            results.add(prefix);
          } else if ( val == Boolean.TRUE ) {
            results.add(path);
          } else {
            collectPermissions_((Map<String, Object>) val, path, results);
          }
        }
      `
    }
  ]
});


foam.CLASS({
  package: 'foam.core.grant',
  name: 'CompoundPermissionSet',
  implements: [ 'foam.core.grant.PermissionSet' ],

  documentation: `
    Combines multiple PermissionSets. check() returns true if any delegate grants the permission.

    snapshot() unions all TriePermissionSet delegates into one, and keeps non-Trie delegates
    (like RecordingPermissionSet) separate. If all delegates are Tries, returns a single
    TriePermissionSet. Otherwise returns a CompoundPermissionSet with the unioned Trie
    plus any dynamic delegates.
  `,

  properties: [
    {
      class: 'FObjectArray',
      of: 'foam.core.grant.PermissionSet',
      name: 'delegates'
    }
  ],

  methods: [
    {
      name: 'check',
      type: 'Boolean',
      args: 'String permission',
      code: function(permission) {
        for ( var i = 0 ; i < this.delegates.length ; i++ ) {
          if ( this.delegates[i].check(permission) ) return true;
        }
        return false;
      },
      javaCode: `
        for ( foam.core.grant.PermissionSet delegate : getDelegates() ) {
          if ( delegate.check(permission) ) return true;
        }
        return false;
      `
    },
    {
      name: 'snapshot',
      type: 'foam.core.grant.PermissionSet',
      args: 'Context x',
      documentation: `
        Flatten all delegates. Union all TriePermissionSets together.
        Keep non-Trie delegates (dynamic PermissionSets) separate.
        If result is all Tries, return single TriePermissionSet.
        Otherwise return CompoundPermissionSet with unioned Trie + dynamic delegates.
      `,
      code: function(x) {
        var unioned = foam.core.grant.TriePermissionSet.EMPTY;
        var dynamic = [];

        for ( var i = 0 ; i < this.delegates.length ; i++ ) {
          var snapped = this.delegates[i].snapshot(x);

          if ( foam.core.grant.TriePermissionSet.isInstance(snapped) ) {
            unioned = unioned.union(snapped);
          } else {
            // Non-Trie result (dynamic PermissionSet like RecordingPermissionSet)
            dynamic.push(snapped);
          }
        }

        // If no dynamic delegates, return the unioned Trie
        if ( dynamic.length === 0 ) {
          return unioned;
        }

        // Otherwise return CompoundPermissionSet with unioned Trie + dynamic delegates
        var newDelegates = [ unioned ].concat(dynamic);
        return foam.core.grant.CompoundPermissionSet.create({ delegates: newDelegates });
      },
      javaCode: `
        TriePermissionSet unioned = TriePermissionSet.EMPTY;
        java.util.List<PermissionSet> dynamic = new java.util.ArrayList<>();

        for ( PermissionSet delegate : getDelegates() ) {
          PermissionSet snapped = delegate.snapshot(x);

          if ( snapped instanceof TriePermissionSet ) {
            unioned = unioned.union((TriePermissionSet) snapped);
          } else {
            // Non-Trie result (dynamic PermissionSet like RecordingPermissionSet)
            dynamic.add(snapped);
          }
        }

        // If no dynamic delegates, return the unioned Trie
        if ( dynamic.isEmpty() ) {
          return unioned;
        }

        // Otherwise return CompoundPermissionSet with unioned Trie + dynamic delegates
        PermissionSet[] newDelegates = new PermissionSet[dynamic.size() + 1];
        newDelegates[0] = unioned;
        for ( int i = 0 ; i < dynamic.size() ; i++ ) {
          newDelegates[i + 1] = dynamic.get(i);
        }
        return new CompoundPermissionSet.Builder(x).setDelegates(newDelegates).build();
      `
    }
  ]
});


foam.CLASS({
  package: 'foam.core.grant',
  name: 'PermissionedPermissionSet',
  implements: [ 'foam.core.grant.PermissionSet' ],

  documentation: 'A PermissionSet that only grants permissions if a condition permission is met. Used by PermissionedGrant.',

  properties: [
    {
      class: 'String',
      name: 'condition',
      documentation: 'The permission that must be granted for this set to be active.'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.core.grant.PermissionSet',
      name: 'delegate',
      documentation: 'The permissions to grant if condition is met.'
    }
  ],

  methods: [
    {
      name: 'check',
      type: 'Boolean',
      args: 'String permission',
      documentation: 'Always returns false. Use snapshot() to evaluate conditions.',
      code: function(permission) {
        return false;
      },
      javaCode: 'return false;'
    },
    {
      name: 'snapshot',
      type: 'foam.core.grant.PermissionSet',
      args: 'Context x',
      documentation: 'Evaluate condition against context permissionSet and return delegate or empty.',
      code: function(x) {
        var permissionSet = x.permissionSet;
        if ( permissionSet && permissionSet.check(this.condition) ) {
          return this.delegate.snapshot(x);
        }
        return foam.core.grant.TriePermissionSet.EMPTY;
      },
      javaCode: `
        foam.core.grant.PermissionSet permissionSet = (foam.core.grant.PermissionSet) x.get("permissionSet");
        if ( permissionSet != null && permissionSet.check(getCondition()) ) {
          return getDelegate().snapshot(x);
        }
        return foam.core.grant.TriePermissionSet.EMPTY;
      `
    }
  ]
});


foam.CLASS({
  package: 'foam.core.grant',
  name: 'GlobalPermissionSet',
  implements: [ 'foam.core.grant.PermissionSet' ],

  documentation: 'A singleton PermissionSet that grants all permissions. More efficient than TriePermissionSet.EMPTY.add("*").',

  axioms: [ foam.pattern.Singleton.create() ],

  javaCode: `
    protected static final GlobalPermissionSet instance__ = new GlobalPermissionSet();
    public static GlobalPermissionSet instance() { return instance__; }
  `,

  methods: [
    {
      name: 'check',
      type: 'Boolean',
      args: 'String permission',
      code: function(permission) {
        return true;
      },
      javaCode: 'return true;'
    },
    {
      name: 'snapshot',
      type: 'foam.core.grant.PermissionSet',
      args: 'Context x',
      code: function(x) {
        return foam.core.grant.TriePermissionSet.EMPTY.add('*');
      },
      javaCode: 'return TriePermissionSet.EMPTY.add("*");'
    }
  ]
});


foam.CLASS({
  package: 'foam.core.grant',
  name: 'GrantAssignment',
  extends: 'foam.core.grant.Grant',

  implements: [
    'foam.core.auth.CreatedAware',
    'foam.core.auth.LastModifiedAware'
  ],
  documentation: 'A Grant assigned to a user, stored in the grantDAO. Wraps a delegate Grant with user assignment metadata.',

  tableColumns: [ 'id', 'name', 'user', 'spid' ],

  properties: [
    {
      class: 'String',
      name: 'id'
    },
    {
      class: 'String',
      name: 'name',
      documentation: 'Human-readable name (e.g., RoleAnalyst, FeatureExport)'
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.ServiceProvider',
      name: 'spid',
      documentation: 'Service Provider ID this grant is assigned to'
    },
    {
      class: 'Int',
      name: 'order',
      value: 100,
      documentation: 'Evaluation order. Lower values processed first.'
    },
    {
      class: 'FObjectProperty',
      name: 'grant',
      of: 'foam.core.grant.Grant'
    }
  ],

  methods: [
    {
      name: 'getPermissions',
      code: function() { return this.grant.getPermissions(); },
      javaCode: `
        getGrant().setX(getX());
        return getGrant().getPermissions();
      `
    }
  ]
});


foam.RELATIONSHIP({
  sourceModel: 'foam.core.auth.User',
  targetModel: 'foam.core.grant.GrantAssignment',
  forwardName: 'grants',
  inverseName: 'user',
  targetDAOKey: 'grantDAO',
  targetProperty: { value: -1 }
});


foam.CLASS({
  package: 'foam.core.grant',
  name: 'SuperUserGrant',
  extends: 'foam.core.grant.Grant',

  documentation: 'Grants all permissions. When disabled, only grants superuser.enable for re-enabling.',

  properties: [
    {
      class: 'Boolean',
      name: 'enabled',
      value: true
    }
  ],

  methods: [
    {
      name: 'getPermissions',
      code: function() {
        if ( ! this.enabled ) {
          return foam.core.grant.TriePermissionSet.EMPTY.add('superuser.enable');
        }
        return foam.core.grant.GlobalPermissionSet.create();
      },
      javaCode: `
        if ( ! getEnabled() ) {
          return foam.core.grant.TriePermissionSet.EMPTY.add("superuser.enable");
        }
        return foam.core.grant.GlobalPermissionSet.instance();
      `
    }
  ]
});


foam.CLASS({
  package: 'foam.core.grant',
  name: 'PermissionGrant',
  extends: 'foam.core.grant.Grant',

  documentation: 'Grants a single permission (supports wildcards)',

  properties: [
    {
      class: 'String',
      name: 'permission'
    }
  ],

  methods: [
    {
      name: 'getPermissions',
      code: function() {
        return foam.core.grant.TriePermissionSet.EMPTY.add(this.permission);
      },
      javaCode: 'return foam.core.grant.TriePermissionSet.EMPTY.add(getPermission());'
    }
  ]
});


foam.CLASS({
  package: 'foam.core.grant',
  name: 'CompoundGrant',
  extends: 'foam.core.grant.Grant',

  documentation: 'Combines multiple grants into a CompoundPermissionSet',

  properties: [
    {
      class: 'FObjectArray',
      of: 'foam.core.grant.Grant',
      name: 'grants'
    }
  ],

  methods: [
    {
      name: 'getPermissions',
      code: function() {
        var delegates = [];
        for ( var i = 0 ; i < this.grants.length ; i++ ) {
          var ps = this.grants[i].getPermissions();
          if ( foam.core.grant.GlobalPermissionSet.isInstance(ps) ) return ps;
          delegates.push(ps);
        }
        return foam.core.grant.CompoundPermissionSet.create({ delegates: delegates });
      },
      javaCode: `
        foam.core.grant.Grant[] grants = getGrants();
        foam.core.grant.PermissionSet[] delegates = new foam.core.grant.PermissionSet[grants.length];
        for ( int i = 0 ; i < grants.length ; i++ ) {
          grants[i].setX(getX());
          delegates[i] = grants[i].getPermissions();
          if ( delegates[i] instanceof foam.core.grant.GlobalPermissionSet ) {
            return delegates[i];
          }
        }
        return new foam.core.grant.CompoundPermissionSet.Builder(getX())
          .setDelegates(delegates)
          .build();
      `
    }
  ]
});


foam.CLASS({
  package: 'foam.core.grant',
  name: 'SharedGrant',
  extends: 'foam.core.grant.Grant',

  documentation: 'References another Grant by ID for reuse',

  properties: [
    {
      class: 'Reference',
      of: 'foam.core.grant.GrantAssignment',
      name: 'grantId',
      targetDAOKey: 'grantDAO'
    }
  ],

  methods: [
    {
      name: 'getPermissions',
      code: async function() {
        var grant = await this.grantId$find();
        return grant ? grant.getPermissions() : foam.core.grant.TriePermissionSet.EMPTY;
      },
      javaCode: `
        foam.core.grant.Grant grant = findGrantId(getX());
        return grant != null ? grant.getPermissions() : foam.core.grant.TriePermissionSet.EMPTY;
      `
    }
  ]
});


foam.CLASS({
  package: 'foam.core.grant',
  name: 'UserGrant',
  extends: 'foam.core.grant.Grant',

  documentation: `
    Grants all permissions of a referenced user.
    Grants come from grantDAO which stores objects of type GrantAssignment.
    Includes:
      1. user = user's id and SPID == ""
      2. spid = user's spid
      3. name = 'group-' + user's groupId
      4. user = 0 and SPID == "", for Global Grants
  `,

  javaImports: [
    'static foam.mlang.MLang.*',
    'foam.dao.*',
    'foam.core.auth.User',
    'foam.mlang.predicate.Predicate'
  ],

  properties: [
    {
      class: 'Reference',
      of: 'foam.core.auth.User',
      name: 'userId'
    }
  ],

  methods: [
    {
      name: 'getPermissions',
      javaCode: 'return getPermissionsForUser(getX(), findUserId(getX()));'
    },
    {
      name: 'getPermissionsForUser',
      documentation: 'Load and combine all permissions for a user into a CompoundPermissionSet. Used by GrantAuthService.',
      args: 'Context x, User user',
      type: 'foam.core.grant.PermissionSet',
      javaCode: `
        DAO grantDAO = (foam.dao.DAO) x.get("grantDAO");
        if ( grantDAO == null ) return foam.core.grant.TriePermissionSet.EMPTY;

        foam.dao.ArraySink sink = (ArraySink) grantDAO
          .where(OR(new Predicate[] {
            AND(EQ(GrantAssignment.SPID, ""), IN(GrantAssignment.USER, new Object[] { user.getId(), 0L })),
            EQ(GrantAssignment.SPID, user.getSpid())
          }))
          .orderBy(GrantAssignment.ORDER)
          .select(new ArraySink());

        java.util.List list = sink.getArray();
        if ( list.isEmpty() ) return foam.core.grant.TriePermissionSet.EMPTY;

        foam.core.grant.PermissionSet[] delegates = new foam.core.grant.PermissionSet[list.size() + 1];
        for ( int i = 0 ; i < list.size() ; i++ ) {
          foam.core.grant.Grant grant = (foam.core.grant.Grant) list.get(i);
          grant.setX(getX());
          delegates[i] = grant.getPermissions();
        }

        delegates[list.size()] = new GroupGrant.Builder(x).setGroup(user.getGroup()).build().getPermissions();

        return new foam.core.grant.CompoundPermissionSet.Builder(x)
          .setDelegates(delegates)
          .build();
      `
    }
  ]
});


foam.CLASS({
  package: 'foam.core.grant',
  name: 'GroupGrant',
  extends: 'foam.core.grant.Grant',

  documentation: 'Grants permissions based on user group membership. Reads user group from context, then delegates to a SharedGrant referencing the group permission definition.',

  properties: [
    {
      class: 'String',
      name: 'group'
    }
  ],

  methods: [
    {
      name: 'getPermissions',
      javaCode: `
        String group = getGroup();
        if ( foam.util.SafetyUtil.isEmpty(group) ) return foam.core.grant.TriePermissionSet.EMPTY;

        foam.dao.DAO grantDAO = (foam.dao.DAO) getX().get("grantDAO");
        if ( grantDAO == null ) return foam.core.grant.TriePermissionSet.EMPTY;

        foam.core.grant.Grant groupGrant = (foam.core.grant.Grant) grantDAO.find("group-" + group);
        return groupGrant != null ? groupGrant.getPermissions() : foam.core.grant.TriePermissionSet.EMPTY;
      `
    }
  ]
});


foam.CLASS({
  package: 'foam.core.grant',
  name: 'SPIDGrant',
  extends: 'foam.core.grant.Grant',

  documentation: 'Grants permissions based on user service provider ID. Reads user SPID from context, then delegates to a SharedGrant referencing the SPID permission definition.',

  methods: [
    {
      name: 'getPermissions',
      code: async function() {
        var user = this.__context__.subject?.user;
        if ( ! user || ! user.spid ) return foam.core.grant.TriePermissionSet.EMPTY;

        var spidGrant = await this.__context__.grantDAO.find('spid-' + user.spid);
        return spidGrant ? spidGrant.getPermissions() : foam.core.grant.TriePermissionSet.EMPTY;
      },
      javaCode: `
        foam.core.auth.Subject subject = (foam.core.auth.Subject) getX().get("subject");
        if ( subject == null || subject.getUser() == null ) return foam.core.grant.TriePermissionSet.EMPTY;

        foam.core.auth.User user = subject.getUser();
        String spid = user.getSpid();
        if ( foam.util.SafetyUtil.isEmpty(spid) ) return foam.core.grant.TriePermissionSet.EMPTY;

        foam.dao.DAO grantDAO = (foam.dao.DAO) getX().get("grantDAO");
        if ( grantDAO == null ) return foam.core.grant.TriePermissionSet.EMPTY;

        foam.core.grant.Grant spidGrant = (foam.core.grant.Grant) grantDAO.find("spid-" + spid);
        return spidGrant != null ? spidGrant.getPermissions() : foam.core.grant.TriePermissionSet.EMPTY;
      `
    }
  ]
});


foam.CLASS({
  package: 'foam.core.grant',
  name: 'PermissionedGrant',
  extends: 'foam.core.grant.Grant',

  documentation: 'A Grant that requires a permission to be present before granting its delegate permissions. Returns a PermissionedPermissionSet that is evaluated during snapshot().',

  properties: [
    {
      class: 'String',
      name: 'permission',
      documentation: 'The permission required to activate this grant.'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.core.grant.Grant',
      name: 'delegate',
      documentation: 'The grant to apply if permission is present.'
    }
  ],

  methods: [
    {
      name: 'getPermissions',
      code: function() {
        return foam.core.grant.PermissionedPermissionSet.create({
          condition: this.permission,
          delegate: this.delegate.getPermissions()
        });
      },
      javaCode: `
        getDelegate().setX(getX());
        return new foam.core.grant.PermissionedPermissionSet.Builder(getX())
          .setCondition(getPermission())
          .setDelegate(getDelegate().getPermissions())
          .build();
      `
    }
  ]
});


foam.CLASS({
  package: 'foam.core.grant',
  name: 'GrantAuthService',
  extends: 'foam.core.auth.ProxyAuthService',
  implements: [ 'foam.core.COREService' ],

  documentation: `
    AuthService using GRANT framework.
    Caches PermissionSet per user for efficient lookups.

    Flow:
    1. Load all grants for user via UserGrant.getPermissionsForUser()
    2. This returns a PermissionSet (may contain CompoundPermissionSet, PermissionedPermissionSet)
    3. Put the raw PermissionSet in context ??? Needed?
    4. Call snapshot(x) to evaluate conditions and flatten where possible
    5. Cache the resulting PermissionSet (may be TriePermissionSet or CompoundPermissionSet with dynamic delegates)

    Cache Invalidation: All caches are purged when any DAO from DAOS_TO_LISTEN_TO or extraDAOsToListenTo changes.
  `,

  javaImports: [
    'foam.core.grant.UserGrant',
    'foam.dao.*',
    'foam.lang.Detachable',
    'static foam.mlang.MLang.TRUE'
  ],

  constants: [
    {
      name: 'DAOS_TO_LISTEN_TO',
      javaType: 'String[]',
      javaValue: 'new String[] { "grantDAO", "localUserDAO" }'
    }
  ],

  properties: [
    {
      class: 'Boolean',
      name: 'passthrough',
      documentation: 'If enabled, it also checks delegate on failed grant permission checks, allowing failover to legacy auth.',
      value: true
    },
    {
      class: 'Map',
      name: 'cache',
      documentation: 'Cache of PermissionSet per user ID',
      synchronized: true,
      javaFactory: 'return new java.util.concurrent.ConcurrentHashMap();'
    },
    {
      class: 'StringArray',
      name: 'extraDAOsToListenTo'
    }
  ],

  methods: [
    {
      name: 'start',
      javaCode: `
        Sink purgeSink = new Sink() {
          public void put(Object obj, Detachable sub) {
            purgeCache(null);
          }

          public void remove(Object obj, Detachable sub) {
            purgeCache(null);
          }

          public void eof() {}

          public void reset(Detachable sub) {
            purgeCache(null);
          }
        };

        for ( String daoName : DAOS_TO_LISTEN_TO ) {
          DAO dao = (DAO) getX().get(daoName);
          if ( dao != null ) dao.listen(purgeSink, TRUE);
        }
        // Configure listeners for additional permission DAOs
        if ( getExtraDAOsToListenTo() != null ) {
          for ( String daoName : getExtraDAOsToListenTo() ) {
            DAO dao = (DAO) getX().get(daoName);
            if ( dao != null ) dao.listen(purgeSink, TRUE);
          }
        }
      `
    },
    {
      name: 'check',
      type: 'Boolean',
      args: 'Context x, String permission',
      code: function(x, permission) {
        var subject = x.subject;
        if ( ! subject ) return false;
        return this.passthrough && this.checkUser(x, subject.user, permission);
      },
      javaCode: `
        foam.core.auth.Subject subject = (foam.core.auth.Subject) x.get("subject");

        PermissionSet permissions = getUserPermissions(x, subject.getUser());

        if ( permissions.check(permission) ) return true;

        return getPassthrough() && getDelegate().check(x, permission);
      `
    },
    {
      name: 'checkUser',
      type: 'Boolean',
      args: 'Context x, foam.core.auth.User user, String permission',
      code: function(x, user, permission) {
        if ( user ) {
          var permissions = this.getUserPermissions(x, user);

          if ( permissions.check(permission) ) return true;
        }

        return this.passthrough && this.delegate.checkUser(x, user, permission);
      },
      javaCode: `
        if ( user != null ) {
          PermissionSet permissions = getUserPermissions(x, user);

          if ( permissions.check(permission) ) return true;
        }

        return getPassthrough() && getDelegate().checkUser(x, user, permission);
      `
    },
    {
      name: 'getUserPermissions',
      type: 'foam.core.grant.PermissionSet',
      args: 'Context x, foam.core.auth.User user',
      javaCode: `
        Long userId = user.getId();

        PermissionSet cached = (PermissionSet) getCache().get(userId);
        if ( cached != null ) return cached;

        PermissionSet rawPermissions  = new UserGrant(getX()).getPermissionsForUser(x, user);
        foam.lang.X   snapshotContext = x.put("permissionSet", rawPermissions);
        PermissionSet permissions     = rawPermissions.snapshot(snapshotContext);

        getCache().put(userId, permissions);
        return permissions;
      `
    },
    {
      name: 'purgeCache',
      args: 'Object userId',
      javaCode: `
        if ( userId == null ) {
          getCache().clear();
        } else {
          getCache().remove(userId);
        }
      `
    }
  ]
});
