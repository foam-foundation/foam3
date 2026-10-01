/**
 * RecordingPermissionSet
 *
 * A PermissionSet that grants all non-wildcard permissions and records
 * every permission that was checked. Used for discovering what permissions
 * an action or workflow requires.
 *
 * This is a dynamic PermissionSet - it cannot be meaningfully snapshotted
 * because it continues to grow as permissions are checked. snapshot()
 * returns itself rather than a TriePermissionSet.
 *
 * Pseudo-permission 'recording.grant.save' triggers save to grantDAO.
 */

foam.CLASS({
  package: 'foam.core.grant',
  name: 'RecordingPermissionSet',
  implements: [ 'foam.core.grant.PermissionSet' ],

  documentation: `
    A dynamic PermissionSet that grants all non-wildcard permissions
    while recording what was checked.

    Unlike static PermissionSets, this cannot be flattened to a Trie
    because it continues to grow. snapshot() returns itself.

    Intercepts pseudo-permission 'recording.grant.save' to trigger save.
  `,

  javaImports: [
    'java.util.ArrayList',
    'java.util.Collections',
    'java.util.List'
  ],

  properties: [
    {
      class: 'StringArray',
      name: 'permissions',
      documentation: 'Recorded permissions that were checked and granted.',
      javaFactory: 'return new String[0];'
    },
    {
      class: 'Object',
      name: 'permissionList_',
      documentation: 'Internal mutable list for recording (Java only).',
      transient: true,
      visibility: 'HIDDEN',
      javaFactory: 'return Collections.synchronizedList(new ArrayList<String>());'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.core.grant.RecordingGrant',
      name: 'recordingGrant',
      documentation: 'Reference back to RecordingGrant for save interception.'
    }
  ],

  methods: [
    {
      name: 'check',
      type: 'Boolean',
      args: 'String permission',
      documentation: `
        Intercepts 'recording.grant.save' pseudo-permission to trigger save.
        Returns true for any permission that doesn't contain a wildcard.
        Records the permission if granted.

        Note: 'recording.grant.save' interception only runs on the server.
      `,
      code: function(permission) {
        // Reject wildcard permissions - we only grant specific ones
        if ( permission.indexOf('*') !== -1 ) return false;

        // Record this permission if not already recorded
        if ( this.permissions.indexOf(permission) === -1 ) {
          this.permissions = this.permissions.concat(permission);
        }

        return true;
      },
      javaCode: `
        // Intercept pseudo-permission for saving
        if ( "recording.grant.save".equals(permission) ) {
          // foam.core.util.Log.info("Recording save triggered via permission check");
          if ( getRecordingGrant() != null ) {
            saveRecording(getX(), getRecordingGrant().getRecordingName());
          }
          return true;
        }

        // Reject wildcard permissions - we only grant specific ones
        if ( permission.contains("*") ) return false;

        // Record this permission if not already recorded
        List<String> list = (List<String>) getPermissionList_();
        synchronized ( list ) {
          if ( ! list.contains(permission) ) {
            list.add(permission);
            // Update the permissions array
            setPermissions(list.toArray(new String[0]));
          }
        }

        return true;
      `
    },

    {
      name: 'snapshot',
      type: 'foam.core.grant.PermissionSet',
      args: 'Context x',
      documentation: `
        Returns itself. RecordingPermissionSet is dynamic and cannot be
        meaningfully flattened to a TriePermissionSet because it continues
        to grow as permissions are checked.
      `,
      code: function(x) { return this; },
      javaCode: 'return this;'
    },

    {
      name: 'toTriePermissionSet',
      type: 'foam.core.grant.TriePermissionSet',
      documentation: `
        Creates a TriePermissionSet from the currently recorded permissions.
        This is a point-in-time snapshot, not a live view.
      `,
      code: function() {
        var trie = foam.core.grant.TriePermissionSet.EMPTY;
        for ( var i = 0 ; i < this.permissions.length ; i++ ) {
          trie = trie.add(this.permissions[i]);
        }
        return trie;
      },
      javaCode: `
        TriePermissionSet trie = TriePermissionSet.EMPTY;
        for ( String permission : getPermissions() ) {
          trie = trie.add(permission);
        }
        return trie;
      `
    },

    {
      name: 'toCompoundGrant',
      type: 'foam.core.grant.CompoundGrant',
      documentation: 'Creates a CompoundGrant from currently recorded permissions.',
      javaCode: `
        String[] permissions = getPermissions();
        foam.core.grant.Grant[] grants = new foam.core.grant.Grant[permissions.length];

        for ( int i = 0 ; i < permissions.length ; i++ ) {
          grants[i] = new foam.core.grant.PermissionGrant.Builder(getX())
            .setPermission(permissions[i])
            .build();
        }

        return new foam.core.grant.CompoundGrant.Builder(getX())
          .setGrants(grants)
          .build();
      `
    },

    {
      name: 'toPermissionArray',
      type: 'String[]',
      documentation: 'Returns recorded permissions as a string array.',
      javaCode: `
        String[] source = getPermissions();
        String[] result = new String[source.length];
        System.arraycopy(source, 0, result, 0, source.length);
        return result;
      `
    },

    {
      name: 'clear',
      documentation: 'Clears all recorded permissions.',
      code: function() {
        this.permissions = [];
      },
      javaCode: `
        List<String> list = (List<String>) getPermissionList_();
        synchronized ( list ) {
          list.clear();
          setPermissions(new String[0]);
        }
      `
    },

    {
      name: 'saveRecording',
      type: 'void',
      args: 'Context x, String recordingName',
      documentation: `
        Saves current recording as a CompoundGrant to grantDAO.
        Assigns ID "recording-<timestamp>-<random>" for uniqueness.
        Clears recording after save.

        Note: This only runs on the server.
      `,
      javaCode: `
        if ( getPermissions().length == 0 ) {
          // foam.core.util.Log.warning("No permissions recorded. Nothing to save.");
          return;
        }

        long timestamp = System.currentTimeMillis();
        int random = (int) (Math.random() * 1000000);
        String grantId = "recording-" + timestamp + "-" + random;

        try {
          // Create CompoundGrant from recordings
          foam.core.grant.CompoundGrant compoundGrant = toCompoundGrant();

          // Build grant name
          String grantName = recordingName;
          if ( grantName == null || grantName.isEmpty() ) {
            grantName = "Recorded Permissions (" + new java.util.Date(timestamp) + ")";
          }

          // Create GrantAssignment
          foam.core.grant.GrantAssignment grantAssignment =
            new foam.core.grant.GrantAssignment.Builder(x)
              .setId(grantId)
              .setName(grantName)
              .setUser(0)  // Global - shareable
              .setGrant(compoundGrant)
              .build();

          // Save to grantDAO
          foam.dao.DAO grantDAO = (foam.dao.DAO) x.get("grantDAO");
          if ( grantDAO == null ) {
            throw new RuntimeException("grantDAO not found in context");
          }

          grantDAO.put(grantAssignment);

/*
          foam.core.util.Log.info(
            "Saved " + getPermissions().length +
            " permissions to grant: " + grantId
          );
*/

          // Clear recording after successful save
          clear();

        } catch ( Exception err ) {
          // foam.core.util.Log.error("Failed to save recording", err);
          throw new RuntimeException(err);
        }
      `
    }
  ]
});


/**
 * RecordingGrant
 *
 * A development tool that records all permission checks and can save them
 * to grantDAO as a reusable CompoundGrant.
 *
 * Usage:
 *   1. Assign RecordingGrant to a test user
 *   2. Perform the workflow to record permissions
 *   3. Check 'recording.grant.save' pseudo-permission to trigger save
 *   4. System creates CompoundGrant and stores with ID recording-<timestamp>-<random>
 *   5. Cache auto-invalidates via grantDAO listener
 */
foam.CLASS({
  package: 'foam.core.grant',
  name: 'RecordingGrant',
  extends: 'foam.core.grant.Grant',

  documentation: `
    A development tool for discovering permission requirements.
    Grants all non-wildcard permissions while recording what was checked.
    Saves recorded permissions to grantDAO when pseudo-permission
    'recording.grant.save' is checked.
  `,

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.grant.RecordingPermissionSet',
      name: 'permissionSet',
      documentation: 'The RecordingPermissionSet that tracks checked permissions.',
      factory: function() {
        return foam.core.grant.RecordingPermissionSet.create();
      },
      javaFactory: 'return new foam.core.grant.RecordingPermissionSet();'
    },
    {
      class: 'Boolean',
      name: 'enabled',
      storageTransient: true,
      value: true,
      documentation: 'When false, recording continues but check() returns false.'
    },
    {
      class: 'String',
      name: 'recordingName',
      documentation: 'Optional recording name'
    }
  ]
});
