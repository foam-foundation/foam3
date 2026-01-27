/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'DAOResolverMixin',

  imports: [ 'scope' ],


  methods: [
    function resolveDAOFromKey(daoKey) {
      if ( ! daoKey ) return null;

      // Handle dotted keys by traversing down the scope hierarchy
      // e.g., "daoCommand.data1.dao" or "flow.subflow.property"
      if ( daoKey.includes('.') ) {
        // Split the key into parts at each dot
        var parts = daoKey.split('.');
        // Start at the root scope
        var current = this.scope;
        var i = 0;

        // Traverse down the object hierarchy following each part
        while ( i < parts.length && current ) {
          var part = parts[i];

          // Check if this part ends with '()' - it's a method call
          if ( part.endsWith('()') ) {
            // Remove the '()' to get the method name
            var methodName = part.substring(0, part.length - 2);
            // Get the method and call it with current as 'this'
            var method = current[methodName];
            if ( typeof method === 'function' ) {
              current = method.call(current);
              continue;
            }
            current = null;
          } else {
            current = current[part];
          }
          i++;
        }

        // If we successfully resolved the dotted path, use it
        if ( current ) return current;

        console.error('Could not resolve dotted DAO path:', daoKey);
        return null;
      }

      // Enhanced resolution logic from DAOPrompt
      if ( daoKey.endsWith('s') ) {
        // Try plural+DAO first (preserves exact name), then fallback to singular+DAO
        if ( this.scope && this.scope[daoKey + 'DAO'] ) {
          return this.scope[daoKey + 'DAO'];
        }
        if ( this.__context__[daoKey + 'DAO'] ) {
          // Return the string key for context resolution
          return daoKey + 'DAO';
        }
        // Try singular version
        var singular = daoKey.substring(0, daoKey.length-1) + 'DAO';
        if ( this.__context__[singular] ) {
          return singular;
        }
      }
      if ( this.__context__[daoKey + 'DAO'] ) return daoKey + 'DAO';
      if ( this.scope && this.scope[daoKey + 'DAO'] ) return this.scope[daoKey + 'DAO'];
      if ( this.scope && this.scope[daoKey] ) return this.scope[daoKey];

      // Try exact key first in scope
      if ( this.scope && this.scope[daoKey] ) return this.scope[daoKey];

      // Try exact key in context
      if ( this.__context__[daoKey] ) return this.__context__[daoKey];

      console.error('Missing DAO:', daoKey);
      return null;
    },

    function normalizeDaoKey(daoKey) {
      if ( ! daoKey ) return daoKey;

      // Return the key if it resolves directly
      if ( this.scope && this.scope[daoKey] ) return daoKey;
      if ( this.__context__[daoKey] ) return daoKey;

      // Handle plural ending with 's'
      if ( daoKey.endsWith('s') ) {
        // Try plural+DAO first
        if ( this.scope && this.scope[daoKey + 'DAO'] ) return daoKey + 'DAO';
        if ( this.__context__[daoKey + 'DAO'] ) return daoKey + 'DAO';

        // Try singular version
        var singular = daoKey.substring(0, daoKey.length-1) + 'DAO';
        if ( this.__context__[singular] ) return singular;
      }

      // Try with DAO suffix
      if ( this.__context__[daoKey + 'DAO'] ) return daoKey + 'DAO';
      if ( this.scope && this.scope[daoKey + 'DAO'] ) return daoKey + 'DAO';

      return daoKey;
    },

    function adaptDAOProperty(oldValue, newValue, property) {
      let oldAdapt = foam.dao.DAOProperty.ADAPT;
      if ( foam.String.isInstance(newValue) ) {
        // Store the key and resolve using our mixin method
        this.daoKey = newValue;
        newValue = this.resolveDAOFromKey(newValue);
      }
      return oldAdapt.value.call(this, oldValue, newValue, property);
    }
  ]
});