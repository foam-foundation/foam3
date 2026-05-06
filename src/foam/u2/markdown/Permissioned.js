/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * Permissioned Content for FOAM Markdown Documents
 * =================================================
 *
 * Conditionally displays content based on the current user's permissions.
 * Enables single-source documentation that adapts to each user's access level.
 *
 * Registered HTML element:
 *   <permissioned> - Conditionally rendered content block
 *
 * Basic usage:
 *   <permissioned permission="menu.admin.addUsers">
 *     <h2>Adding Users</h2>
 *     <p>To add a new user, click the Add User button...</p>
 *   </permissioned>
 *
 * Multiple permissions (ANY - user needs at least one):
 *   <permissioned permission="admin.users, admin.roles">
 *     <p>User management options...</p>
 *   </permissioned>
 *
 * Multiple permissions (ALL - user needs all):
 *   <permissioned permission="admin.users, admin.roles" require="all">
 *     <p>Advanced user-role configuration...</p>
 *   </permissioned>
 *
 * Negated permissions (show if user does NOT have permission):
 *   <permissioned permission="premium.features" negate>
 *     <p>Upgrade to Premium to access this feature.</p>
 *   </permissioned>
 *
 * Composable (works with includes):
 *   <!-- admin-guide.md -->
 *   <permissioned permission="admin">
 *     <h1>Administrator Guide</h1>
 *     <include src="admin-users.md"></include>
 *     <include src="admin-settings.md"></include>
 *   </permissioned>
 *
 *   <!-- user-guide.md -->
 *   <include src="admin-guide.md"></include>  <!-- Only shows for admins -->
 */

foam.CLASS({
  package: 'foam.u2.markdown',
  name: 'Permissioned',
  extends: 'foam.u2.Element',

  documentation: `
    Conditionally displays content based on user permissions.

    Usage:
      <permissioned permission="menu.admin.addUsers">...</permissioned>
      <permissioned permission="admin.users, admin.roles">...</permissioned>
      <permissioned permission="admin.users, admin.roles" require="all">...</permissioned>
      <permissioned permission="premium" negate>...</permissioned>

    Attributes:
      permission - Required. Permission ID(s) to check. Comma-separated for multiple.
      require    - "any" (default) or "all". Whether user needs any or all permissions.
      negate     - If present, inverts the check (shows content if user LACKS permission).

    Content is completely omitted from the DOM if permission check fails,
    ensuring unauthorized users cannot inspect the page source to see hidden content.
  `,

  imports: [
    'auth?',
    'subject?'
  ],

  css: `
    ^ { display: contents; }
  `,

  properties: [
    {
      class: 'String',
      name: 'permission',
      attribute: true,
      documentation: 'Permission ID to check, or comma-separated list of permissions.',
      required: true
    },
    {
      class: 'String',
      name: 'require',
      attribute: true,
      documentation: '"any" (default) requires at least one permission. "all" requires all permissions.',
      value: 'any'
    },
    {
      class: 'Boolean',
      name: 'negate',
      attribute: true,
      documentation: 'If true, shows content when user does NOT have the permission(s).'
    },
    {
      class: 'Boolean',
      name: 'hasPermission_',
      documentation: 'Computed result of permission check.'
    },
    {
      class: 'Array',
      name: 'permissions_',
      documentation: 'Parsed array of permission IDs.',
      expression: function(permission) {
        if ( ! permission ) return [];
        return permission.split(',').map(p => p.trim()).filter(p => p);
      }
    }
  ],

  methods: [
    async function render() {
      this.SUPER();
      this.addClass();

      await this.checkPermissions();

      var show = this.negate ? ! this.hasPermission_ : this.hasPermission_;

      if ( show ) {
        // Render children normally
        this.add(this.childNodes);
      }
      // Otherwise render nothing - content is completely omitted
    },

    async function checkPermissions() {
      /**
       * Check if current user has required permission(s).
       * Uses auth service if available, otherwise defaults to showing content
       * (fail-open for development/preview scenarios).
       */
      var permissions = this.permissions_;

      if ( permissions.length === 0 ) {
        console.warn('Permissioned element missing permission attribute');
        this.hasPermission_ = true;
        return;
      }

      // If no auth service, default to showing content (development mode)
      if ( ! this.auth ) {
        console.warn('No auth service available, defaulting to show permissioned content');
        this.hasPermission_ = true;
        return;
      }

      try {
        if ( this.require === 'all' ) {
          // User must have ALL permissions
          this.hasPermission_ = await this.checkAll(permissions);
        } else {
          // User must have at least ONE permission (default)
          this.hasPermission_ = await this.checkAny(permissions);
        }
      } catch (e) {
        console.error('Permission check failed:', e);
        // Fail closed on error - don't show potentially sensitive content
        this.hasPermission_ = false;
      }
    },

    async function checkAny(permissions) {
      /** Returns true if user has at least one of the permissions. */
      for ( var perm of permissions ) {
        if ( await this.auth.check(null, perm) ) {
          return true;
        }
      }
      return false;
    },

    async function checkAll(permissions) {
      /** Returns true if user has all of the permissions. */
      for ( var perm of permissions ) {
        if ( ! await this.auth.check(null, perm) ) {
          return false;
        }
      }
      return true;
    }
  ]
});


foam.SCRIPT({
  package: 'foam.u2.markdown',
  name: 'PermissionedTagScript',

  documentation: 'Registers the permissioned element for use in markdown/HTML documents.',

  code: function() {
    foam.__context__.registerElement(foam.u2.markdown.Permissioned, 'permissioned');
  }
});
