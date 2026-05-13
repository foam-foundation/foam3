/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth',
  name: 'PermissionedPropertyDAO',
  extends: 'foam.dao.ProxyDAO',

  javaImports: [
    'foam.lang.FObject',
    'foam.lang.PropertyInfo',
    'foam.dao.ProxySink',
    'foam.mlang.sink.Count',
    'foam.mlang.sink.GroupBy',
    'java.util.Iterator',
    'java.util.HashMap',
    'java.util.ArrayList',
    'java.util.List',
    'java.util.Map'
  ],

  documentation: `A DAO decorator that prevents users from updating / reading
      properties for which they do not have the update / read permission.

      To require update / read permission on a property, set the
      readPermissionRequired or writePermissionRequired properties
      to be true, and add the corresponding permissions,
      i.e. model.ro.prop / model.rw.prop to  the groups who are granted permissions
      on the property.`,

  methods: [
    {
      name: 'put_',
      javaCode: `
  FObject oldObj = getDelegate().find(obj.getProperty("id"));
  return super.put_(x, maybeResetProperties(x, obj, oldObj));
      `,
    },

    {
      name: 'find_',
      javaCode: `
  FObject oldObj = getDelegate().find_(x, id);

  if ( oldObj != null ) {
    return maybeRemoveProperties(x, oldObj, new HashMap());
  }

  return null;
      `,
    },

    {
      name: 'select_',
      javaCode: `
      if ( x.get("auth") != null ) {
        if ( predicate != null ) predicate.authorize(x);

        // don't decorate the sink if it's a Count
        var innerSink = sink;
        while ( innerSink instanceof ProxySink ) {
          innerSink = ((ProxySink) innerSink).getDelegate();
        }
        if ( ! ( innerSink instanceof Count ) ) {
          foam.dao.Sink sink2 = ( sink != null ) ? new HidePropertiesSink(x, sink, this) : sink;
          super.select_(x, sink2, skip, limit, order, predicate);
        } else {
          super.select_(x, sink, skip, limit, order, predicate);
        }
        return sink;
      }
      return super.select_(x, sink, skip, limit, order, predicate);
      `,
    },

    {
      name: 'maybeResetProperties',
      type: 'foam.lang.FObject',
      args: [
        {
          name: 'x',
          type: 'Context'
        },
        {
          name: 'obj',
          type: 'foam.lang.FObject'
        },
        {
          name: 'oldObj',
          type: 'foam.lang.FObject'
        }
      ],
      javaCode: `
  String      of   = obj.getClass().getSimpleName().toLowerCase();
  AuthService auth = (AuthService) x.get("auth");

  if ( propertyMap_.containsKey(of) ) {
    List properties = propertyMap_.get(of);
    Iterator e = properties.iterator();

    while ( e.hasNext() ) {
      PropertyInfo axiom = (PropertyInfo) e.next();
      maybeReset(axiom, of, auth, x, obj, oldObj);
    }
  } else {
    List<PropertyInfo> properties = new ArrayList<>();
    List               list       = obj.getClassInfo().getAxiomsByClass(PropertyInfo.class);
    Iterator           e          = list.iterator();

    while ( e.hasNext() ) {
      PropertyInfo axiom = (PropertyInfo) e.next();

      // This method is only called on puts, so we only need to check for write
      // permission.
      if ( axiom.getWritePermissionRequired() || axiom.getUpdatePermissionRequired() ) { 
        properties.add(axiom);
        maybeReset(axiom, of, auth, x, obj, oldObj);
      }
    }

    propertyMap_.put(of, properties);
  }

  return obj;
      `,
    },

    {
      name: 'maybeRemoveProperties',
      type: 'foam.lang.FObject',
      args: [
        {
          name: 'x',
          type: 'Context'
        },
        {
          name: 'oldObj',
          type: 'foam.lang.FObject'
        },
        {
          name: 'propMap',
          type: 'Map'
        }
      ],
      javaCode: `
      String      of   = oldObj.getClass().getSimpleName().toLowerCase();
      AuthService auth = (AuthService) x.get("auth");

      if ( ! propMap.containsKey(of) ) {
        List<PropertyInfo> properties = new ArrayList<>();
        List list = oldObj.getClassInfo().getAxiomsByClass(PropertyInfo.class);
        Iterator e = list.iterator();

        while ( e.hasNext() ) {
          PropertyInfo axiom = (PropertyInfo) e.next();

          // Only called on finds and selects, so only need to check for read
          // permission.
          if (
            axiom.getReadPermissionRequired() &&
            ! (
              auth.check(x, of + ".rw." + axiom.getName().toLowerCase()) ||
              auth.check(x, of + ".ro." + axiom.getName().toLowerCase())
            )
          ) {
            properties.add(axiom);
          }
        }

        propMap.put(of, properties);
      }

      List properties = (List) propMap.get(of);
      if ( properties.isEmpty() ) return oldObj;

      Iterator e = properties.iterator();
      FObject obj = oldObj.fclone();

      while ( e.hasNext() ) {
        PropertyInfo axiom = (PropertyInfo) e.next();
        axiom.clear(obj);
      }

      return obj;
      `,
    },

    {
      name: 'maybeReset',
      args: [
        {
          name: 'axiom',
          javaType: 'PropertyInfo'
        },
        {
          name: 'of',
          type: 'String'
        },
        {
          name: 'auth',
          type: 'AuthService'
        },
        {
          name: 'x',
          type: 'Context'
        },
        {
          name: 'obj',
          type: 'foam.lang.FObject'
        },
        {
          name: 'oldObj',
          type: 'foam.lang.FObject'
        }
      ],
      javaCode: `
  String axiomName =  axiom.toString();
  axiomName = axiomName.substring(axiomName.lastIndexOf(".") + 1);
  var writePermissionRequired = (Boolean) axiom.getWritePermissionRequired();
  
  if ( ! auth.check(x, of + ".rw." + axiomName.toLowerCase()) ) {
    // If user does not have permission, block all updates if oldObj exists otherwise
    // only block creates if writePermissionRequired == true
    if ( oldObj != null ) {
      Object oldValue = oldObj.getProperty(axiomName);
      axiom.set(obj, oldValue);
    } else if ( writePermissionRequired ) {
      axiom.clear(obj);
    }
  }
      `,
    }
  ],

  axioms: [
    {
      buildJavaClass: function(cls) {
        cls.extras.push(`
  /** map of properties of a model that require model.permission.property for read / write operations **/
  protected Map<String, List<PropertyInfo>> propertyMap_ = new HashMap<>();

  public PermissionedPropertyDAO(foam.lang.X x, foam.dao.DAO delegate) {
    super(x, delegate);
  }
        `);
      },
    },
  ],
});


foam.CLASS({
  package: 'foam.core.auth',
  name: 'HidePropertiesSink',
  extends: 'foam.dao.ProxySink',

  javaImports: [
    'foam.lang.FObject',
    'foam.lang.PropertyInfo',
    'java.util.HashMap',
    'java.util.List',
    'java.util.Map'
  ],

  methods: [
    {
      name: 'put',
      javaCode: `
        FObject fo = ((FObject) obj).fclone();
        getDelegate().put(dao.maybeRemoveProperties(getX(), fo, propertyMap_), sub);
      `
    }
  ],

  axioms: [
    {
      buildJavaClass: function(cls) {
        cls.extras.push(`
  private PermissionedPropertyDAO dao;

  /** map of properties of a model that require model.permission.property for read / write operations **/
  protected Map<String, List<PropertyInfo>> propertyMap_ = new HashMap<>();
  public HidePropertiesSink(foam.lang.X x, foam.dao.Sink delegate, PermissionedPropertyDAO dao) {
    setX(x);
    setDelegate(delegate);
    this.dao = dao;
  }
        `);
      }
    }
  ]
});
