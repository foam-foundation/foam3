/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.core.crunch.lite',
  name: 'Capable',
  documentation: `
    Capable is an interface for binding capability payloads to an object rather
    than associating them with a user.
  `,

  requires: [
    'foam.core.crunch.lite.CapableAdapterDAO'
  ],

  javaImports: [
    'foam.lang.Validator',
    'foam.lang.X',
    'foam.dao.DAO',
    'foam.dao.EasyDAO',
    'foam.dao.ProxyDAO',
    'foam.core.crunch.Capability',
    'foam.core.crunch.CapabilityJunctionPayload',
    'foam.core.crunch.CapabilityJunctionStatus',
    'foam.core.crunch.CrunchService',
    'foam.core.ruler.RulerDAO',
    'java.util.stream.Collectors',

    'java.util.ArrayList',
    'java.util.Arrays',
    'java.util.HashMap',
    'java.util.HashSet',
    'java.util.List',
    'java.util.Map',
    'java.util.Set',

    'org.apache.commons.lang.ArrayUtils',

    'static foam.core.crunch.CapabilityJunctionStatus.*'
  ],

  axioms: [
    {
      name: 'javaExtras',
      buildJavaClass: function(cls) {
        cls.methods.push(foam.java.Method.create({
          name: 'setRequirements',
          type: 'void',
          visibility: 'default',
          args: [
            { name: 'x', type: 'X' },
            { name: 'capabilityIds', type: 'String[]' }
          ],
          body: `
            CrunchService crunchService = (CrunchService) x.get("crunchService");

            setCapabilityIds(
              capabilityIds
            );
          `
        }));
        cls.methods.push(foam.java.Method.create({
          name: 'addRequirement',
          type: 'void',
          visibility: 'default',
          args: [
            { name: 'x', type: 'X' },
            { name: 'capabilityId', type: 'String' }
          ],
          body: `
          if ( ! hasRequirement(x, capabilityId) ) {
            var size = getCapabilityIds().length;
            var capabilityIds = new String[size + 1];
            System.arraycopy(getCapabilityIds(), 0, capabilityIds, 0, size);
            capabilityIds[size] = capabilityId;

            setCapabilityIds(capabilityIds);
          }
          `
        }));
        cls.methods.push(foam.java.Method.create({
          name: 'hasRequirement',
          documentation: 'Checks if the capble object has a capability, does not verify it',
          type: 'Boolean',
          visibility: 'default',
          args: [
            { name: 'x', type: 'X' },
            { name: 'capabilityId', type: 'String' }
          ],
          body: `
          return Arrays.stream(getCapabilityIds())
            .anyMatch(capabilityId::equals);
          `
        }));
        cls.methods.push(foam.java.Method.create({
          name: 'verifyRequirements',
          visibility: 'default',
          type: 'void',
          javaThrows: [ 'IllegalStateException' ],
          args: [
            { name: 'x', type: 'X' },
            { name: 'capabilityIds', type: 'String[]' }
          ],
          body: `
            checkRequirementsStatus(x, capabilityIds, GRANTED);
          `
        }));
        cls.methods.push(foam.java.Method.create({
          name: 'checkRequirementsStatus',
          visibility: 'default',
          type: 'void',
          javaThrows: [ 'IllegalStateException' ],
          args: [
            { name: 'x', type: 'X' },
            { name: 'capabilityIds', type: 'String[]' },
            { name: 'status', type: 'CapabilityJunctionStatus' },
          ],
          body: `
            // Marshal payloads into a hashmap
            Map<String, CapabilityJunctionPayload> payloads =
              new HashMap<String, CapabilityJunctionPayload>();
            for ( CapabilityJunctionPayload payload : getCapablePayloads() ) {
              payloads.put(payload.getCapability(), payload);
            }

            for ( String capId : capabilityIds ) {
              if ( ! payloads.containsKey(capId) ) {
                throw new IllegalStateException(String.format(
                  "Missing payload object for capability '%s'",
                  capId
                ));
              }

              CapabilityJunctionPayload payload = payloads.get(capId);
              if ( payload.getStatus() != status ) {
                throw new IllegalStateException(String.format(
                  "Object does not have %s status for capability '%s'",
                  status,
                  capId
                ));
              }
            }
          `
        }));
        cls.methods.push(foam.java.Method.create({
          name: 'checkRequirementsStatusNoThrow',
          visibility: 'default',
          type: 'boolean',
          args: [
            { name: 'x', type: 'X' },
            { name: 'capabilityIds', type: 'String[]' },
            { name: 'status', type: 'CapabilityJunctionStatus' },
          ],
          body: `
            try {
              checkRequirementsStatus(x, capabilityIds, status);
              return true;
            } catch(IllegalStateException e) {
              return false;
            }
          `
        }));
        cls.methods.push(foam.java.Method.create({
          name: 'getCapablePayloadDAO',
          type: 'foam.dao.DAO',
          visibility: 'default',
          args: [
            { name: 'x', type: 'X' },
          ],
          body: `
            var capablePayloadDAO = new ProxyDAO(x);
            x = x.put("capablePayloadDAO", capablePayloadDAO);

            capablePayloadDAO.setDelegate(new foam.core.ruler.RulerDAO(x, new CapableAdapterDAO(x, this), "capablePayloadDAO"));
            return capablePayloadDAO;
          `
        }));
      }
    },
  ],

  properties: [
    {
      name: 'capablePayloads',
      class: 'FObjectArray',
      of: 'CapabilityJunctionPayload',
      autoValidate: true,
      externalTransient: true,
      createVisibility: 'HIDDEN',
      readVisibility: 'RO',
      updateVisibility: 'RO',
      flags: ['java']
    },
    {
      name: 'capabilityIds',
      class: 'StringArray',
      externalTransient: true,
      createVisibility: 'HIDDEN',
      readVisibility: 'RO',
      updateVisibility: 'RO',
      flags: ['java']
    },
    {
      name: 'userCapabilityRequirements',
      class: 'StringArray',
      externalTransient: true,
      createVisibility: 'HIDDEN',
      readVisibility: 'RO',
      updateVisibility: 'RO',
      flags: ['java']
    },
    {
      name: 'DAOKey',
      class: 'String',
      externalTransient: true,
      visibility: 'HIDDEN',
      flags: ['java']
    }
  ]
});
