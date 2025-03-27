/**
* @license
* Copyright 2024 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.core.place',
  name: 'PlaceDetailResult',

  javaImports: [
    'java.util.HashMap',
    'java.util.Map',
    'foam.core.auth.Address',
    'foam.core.auth.Region',
    'foam.mlang.MLang',
    'foam.dao.DAO',
    'foam.core.place.PlaceDetailAddressComponent',
    'foam.core.logger.Loggers',
    'foam.lang.X'
  ],
  
  implements: ['foam.mlang.Expressions'],
  properties: [
    {
      name: 'formattedAddress',
      shortName: 'formatted_address',
      class: 'String'
    },
    {
      name: 'addressComponents',
      shortName: 'address_components',
      class: 'FObjectArray',
      of: 'foam.core.place.PlaceDetailAddressComponent',
    },
    {
      name: 'address',
      shortName: 'addr',
      class: 'FObjectProperty',
      of: 'foam.core.auth.Address',
      factory: function() {
        this.populateAddress();
      } 
    },
    {
      class: 'Map',
      javaType: 'HashMap',
      name: 'typeMap',
      transient: true
    }
  ],
  methods: [
    {
      name: 'init_',
      javaCode: `populateAddress();`
    },
    {
      name: 'populateAddress',
      javaCode: `
        if ( getTypeMap().isEmpty() ) {
          HashMap<String, PlaceDetailAddressComponent> typeMap = new HashMap<>();
          for (PlaceDetailAddressComponent component : getAddressComponents()) {
              for (String type : component.getTypes()) {
                  typeMap.put(type, component);
              }
          }
          setTypeMap(typeMap);
          typeMap.forEach((key, value) -> System.out.println(key + ":" + value));
        }

        Class t = Address.class;
        try {
          t = Class.forName("foam.core.auth." + (String) ((PlaceDetailAddressComponent) getTypeMap().get("country")).getShortName() + "Address");
        } catch (ClassNotFoundException e) {
          // no-op
        } catch (Exception e) {
          Loggers.logger(getX(), this).error("placeDetailResult", e);
        }
        try {
          Address a = (Address) getX().create(t);
          setAddress((Address) a.fromTypeMap(getTypeMap(), getX()));
        } catch (Exception e) {
          Loggers.logger(getX(), this).error("placeDetailResult", e);
        }
      `
    }
  ]
});
