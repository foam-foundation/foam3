/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.crunch.lite',
  name: 'CapableDAO',
  extends: 'foam.dao.ProxyDAO',

  javaImports: [
    'foam.core.crunch.Capability',
    'foam.core.crunch.CapabilityIntercept',
    'foam.core.crunch.CapabilityJunctionPayload',
    'foam.core.crunch.CapabilityJunctionStatus',
    'foam.core.crunch.lite.Capable',
    'foam.core.pm.PM',
    'foam.dao.AbstractSink',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.ProxySink',
    'foam.lang.FObject',
    'foam.mlang.sink.Count',
    'foam.util.SafetyUtil',
    'java.util.Arrays',
    'java.util.ArrayList',
    'java.util.List'
  ],

  properties: [
    {
      class: 'String',
      name: 'daoKey'
    },
    {
      class: 'Enum',
      name: 'defaultStatus',
      of: 'foam.core.crunch.CapabilityJunctionStatus',
      value: foam.core.crunch.CapabilityJunctionStatus.ACTION_REQUIRED
    },
    {
      class: 'Boolean',
      name: 'allowActionRequiredPuts'
    },
    {
      class: 'Long',
      name: 'maxLimit',
      value: 1000
    }
  ],

  methods: [
    {
      name: 'find_',
      javaCode: `
        Capable capable = (Capable) getDelegate().find_(x, id);
        if ( capable == null ) {
          return null;
        }

        capable = populatePayloads(x, capable);

        return (FObject) capable;
      `
    },
    {
      name: 'select_',
      javaCode: `
        if (sink != null &&
            ! ( sink instanceof Count ) ) {
          ProxySink refinedSink = new ProxySink(x, sink) {
            @Override
            public void put(Object obj, foam.lang.Detachable sub) {
              Capable capable = (Capable) obj;
              capable = populatePayloads(x, capable);

              super.put(capable, sub);
            }
          };
          if ( limit == foam.dao.AbstractDAO.MAX_SAFE_INTEGER ) {
            limit = getMaxLimit();
          }
          return ((ProxySink) super.select_(x, refinedSink, skip, limit, order, predicate)).getDelegate();
        }
        return super.select_(x, sink, skip, limit, order, predicate);
      `
    },
    {
      name: 'populatePayloads',
      args: [
        { name: 'x', javaType: 'foam.lang.X' },
        { name: 'capable', javaType: 'Capable' }
      ],
      type: 'Capable',
      javaCode:`
        if ( capable.getCapablePayloads() != null && capable.getCapablePayloads().length > 0 ) {
          PM pm = PM.create(x, "CapableDAO:populatePayloads");
          DAO capablePayloadDAO = capable.getCapablePayloadDAO(x);

          // capablePayloadDAO operates directly on capablePayloads array and populate all ReferencePayloadData.
          // No need to copy select output back to capable.capablePayloads.
          capablePayloadDAO.select(new AbstractSink());
          pm.log(x);
        }
        return capable;
      `
    },
    {
      name: 'put_',
      javaCode: `
        FObject currentObjectInDao = getDelegate().find_(x, obj);
        Capable toPutCapableObj =  (Capable) obj;
        DAO toUpdateCapablePayloadDAO;

        CapabilityJunctionPayload[] toPutCapablePayloadArray =
          (CapabilityJunctionPayload[]) toPutCapableObj.getCapablePayloads();

        // For both create and update,
        // we need to handle the cleaning of data if it is from the client
        // and we also need to populate the CapablePayload.daoKey and
        // CapablePayload.objId fields since they don't get filled out by client
        if ( currentObjectInDao == null ) {
          toUpdateCapablePayloadDAO = toPutCapableObj.getCapablePayloadDAO(getX());
          for (int i = 0; i < toPutCapablePayloadArray.length; i++){

            toPutCapableObj.setDAOKey(getDaoKey());

            CapabilityJunctionPayload currentCapablePayload = toPutCapablePayloadArray[i];

            if ( ! currentCapablePayload.getHasSafeStatus() ){
              currentCapablePayload.setStatus(getDefaultStatus());
            }
          }
        } else {
          Capable storedCapableObj = (Capable) currentObjectInDao.fclone();

          toPutCapableObj.setDAOKey(storedCapableObj.getDAOKey());

          // should always be sync'd with whatever is on the backend
          if (
            SafetyUtil.isEmpty(String.valueOf(storedCapableObj.getDAOKey()))
          ) {
            toPutCapableObj.setDAOKey(getDaoKey());
          }

          toUpdateCapablePayloadDAO = storedCapableObj.getCapablePayloadDAO(getX());

          for ( int i = 0; i < toPutCapablePayloadArray.length; i++ ){
            CapabilityJunctionPayload toPutCapablePayload =
              (CapabilityJunctionPayload) toPutCapablePayloadArray[i];

            if ( ! toPutCapablePayload.getHasSafeStatus() ){

              DAO capabilityDAO = (DAO) x.get("capabilityDAO");
              Capability capability = (Capability) capabilityDAO.find(toPutCapablePayload.getCapability());

              if ( capability == null ) {
                throw new RuntimeException("capability not found: " +
                  toPutCapablePayload.getCapability());
              }

              CapabilityJunctionPayload storedCapablePayload = (CapabilityJunctionPayload) toUpdateCapablePayloadDAO.find(capability.getId());

              if ( storedCapablePayload != null ){
                toPutCapablePayload.setStatus(storedCapablePayload.getStatus());
              }
            }
          }
        }

        List<CapabilityJunctionPayload> capablePayloads = new ArrayList<CapabilityJunctionPayload>(Arrays.asList(toPutCapablePayloadArray));

        for ( CapabilityJunctionPayload currentPayload : capablePayloads ){
          toUpdateCapablePayloadDAO.put(currentPayload);
        }

        // include old payloads when checking requirement status
        CapabilityJunctionPayload[] payloads = (CapabilityJunctionPayload[]) ((List) ((ArraySink) toUpdateCapablePayloadDAO.select(new ArraySink())).getArray()).toArray(new CapabilityJunctionPayload[0]);
        toPutCapableObj.setCapablePayloads(payloads);

        if (
          ! toPutCapableObj.checkRequirementsStatusNoThrow(x, toPutCapableObj.getCapabilityIds(), CapabilityJunctionStatus.GRANTED) &&
          ! toPutCapableObj.checkRequirementsStatusNoThrow(x, toPutCapableObj.getCapabilityIds(), CapabilityJunctionStatus.PENDING) &&
          ! toPutCapableObj.checkRequirementsStatusNoThrow(x, toPutCapableObj.getCapabilityIds(), CapabilityJunctionStatus.REJECTED) &&
          ! getAllowActionRequiredPuts()
        ) {
          CapabilityIntercept cre = new CapabilityIntercept();
          cre.setDaoKey(getDaoKey());
          cre.addCapable(toPutCapableObj);
          throw cre;
        }

        return super.put_(x, obj);
      `
    }
  ],
});
