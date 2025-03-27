/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.place.google',
  name: 'AddressRefine',
  refines: 'foam.core.auth.Address',

  javaImports: [
    'java.util.HashMap',
    'java.util.Map',
    'foam.core.auth.Region',
    'foam.mlang.MLang',
    'foam.core.place.PlaceDetailAddressComponent',
    'foam.dao.DAO',
    'java.util.Set',
    'foam.util.Arrays',
    'java.lang.reflect.Array',
    'foam.core.logger.Loggers'
  ],

  methods: [
    {
      name: 'googleTypeMapping',
      type: 'Map',
      documentation: `
        Mapppings of FOAM address model properties to typeMap keys for north american addresses array is in order of precedence, i.e. if the first key returns a value other keys are ignored 
        specify keys  as ["keyName", true] to get the shortName of an address component. Region properties are calculated from the dao so they ignore the second argument
      `,
      javaCode: `
        return foam.util.Arrays.asMap(new Object[] {
          "suite", new Object[] {"subpremise","floor","premise"},
          "streetNumber", new Object[] {"street_number"},
          "streetName", new Object[] {"route"},
          "neighborhood", new Object[] {"neighborhood"},
          "sublocality_level_1", new Object[] {"sublocality_level_1"},
          "sublocality", new Object[] {"sublocality"},
          "city", new Object[] {"locality","sublocality","sublocality_level_1","neighborhood","administrative_area_level_3","administrative_area_level_2"},
          "regionId", new Object[] {"administrative_area_level_1"},
          "countryId", new Object[] {new Object[] {"country",true}},
          "postalCode", new Object[] {"postal_code"}
        });
      `
    },
    {
      name: 'findType',
      args: [
        { type: 'HashMap', name: 'typeMap' },
        { type: 'String', name: 'key' },
        { type: 'Boolean', name: 'isShort' }
      ],
      javaType: 'String',
      javaCode: `
        if ( ! typeMap.containsKey(key) ) return "";
        return isShort ? ((PlaceDetailAddressComponent) typeMap.get(key)).getShortName() : ((PlaceDetailAddressComponent)typeMap.get(key)).getLongName();
      `
    },
    {
      name: 'getAddressMap_',
      documentation: 'returns a map with populated address model fields when given a typeMap and a Mapping',
      args: [
        { type: 'HashMap', name: 'typeMap' },
        { type: 'Map', name: 'mapping' }
      ],
      type: 'Map',
      javaCode: `
        Map<String, Object> map = new HashMap<>();
        for (String key : ((Set<String>) mapping.keySet()).toArray(String[]::new)) {
          for(Object value : Arrays.toArray(mapping.get(key))) {
            if ( value.getClass().isArray() ) {
              map.put(key, findType(typeMap, (String) Array.get(value, 0), (Boolean) Array.get(value, 1)));
            } else {
              map.put(key, findType(typeMap, (String) value, false));
            }
            if ( ! foam.util.SafetyUtil.isEmpty((String) map.get(key)) ) 
              break;
          }
        }

        // Kinda jank but it works
        String[] comp = new String[]{"streetNumber", "streetName", "neighborhood", "sublocality_level_1", "sublocality"};
        String a1 = "";
        String lastAppend = "";
        for ( String a : comp ) {
          String value = (String) map.get(a);
          if ( value != "" ) {
            if ( value == map.get("city") || (lastAppend != "" && value.startsWith(lastAppend)) ) {
              break;
            }
            if ( a1 != "" && a != "streetNumber" ) {
              a1 += ", ";
            }
            a1 += value;
            lastAppend = value;
          }
        }
        map.put("address1", a1);

        return map;
      `
    },
    {
      name: 'fromTypeMap',
      documentation: `Returns an address object created from a google place detail typeMap, 
      This expects a typeMap structure that is a result of Canadian/US addresses, 
      it might work for other countries but other countries might need their own implementation,
      look at PlaceDetailResult for typeMap format`,
      type: 'foam.core.auth.Address',
      args: [
        { type: 'HashMap', name: 'typeMap' },
        { type: 'Context', name: 'x' }
      ],
      javaCode: `
        Map<String, Object> map = getAddressMap_(typeMap, googleTypeMapping());

        // Region is fetched from dao because Google doesn't provide ISO codes
        Object[] regionPropArray = (Object[]) googleTypeMapping().get("regionId");
        if ( regionPropArray != null ) {
          var regionProp = (String) Array.get(regionPropArray, 0);
          var regionShort = findType(typeMap, regionProp, true);
          var regionLong = findType(typeMap, regionProp, false);
          Region ourRegion = (Region) ((DAO) x.get("regionDAO")).find(map.get("countryId") + "-" + regionShort);
          // Try to find by name if id cant be used
          if ( ourRegion == null ) {
            ourRegion = (Region) ((DAO) x.get("regionDAO"))
              .where(MLang.EQ(Region.COUNTRY_ID, map.get("countryId")))
              .find(MLang.OR(MLang.EQ(Region.ISO_CODE, regionShort), MLang.EQ(Region.NAME, regionLong)));
          }
          if ( ourRegion != null ) {
            map.put("regionId", ourRegion.getId());
          }
        }

        return (Address) x.create(getOwnClassInfo().getObjClass(), (Map<String, Object>)map);
      `
    }
  ]
});

foam.CLASS({
  package: 'foam.core.place.google',
  name: 'GBAddressRefine',
  refines: 'foam.core.auth.GBAddress',

  methods: [
    {
      name: 'googleTypeMapping',
      javaCode: `
        return foam.util.Arrays.asMap(new Object[] {
          "suite", new Object[] {"subpremise","floor","premise"},
          "streetNumber", new Object[] {"street_number"},
          "streetName", new Object[] {"route"},
          "neighborhood", new Object[] {"neighborhood"},
          "sublocality_level_1", new Object[] {"sublocality_level_1"},
          "sublocality", new Object[] {"sublocality"},
          "city", new Object[] {"postal_town","locality","sublocality","sublocality_level_1","neighborhood","administrative_area_level_3"},
          "countryId", new Object[] {new Object[] {"country",true}},
          "postalCode", new Object[] {"postal_code"}
        });
      `
    }
  ]
});
