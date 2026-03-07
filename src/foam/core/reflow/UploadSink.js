/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'UploadSink',
  // extends: 'foam.dao.Sink',
  
  documentation: `
    Sophisticated upload sink with validation, batching, and progress tracking.
    Extracted from Upload.js to be used by parsers and other upload components.
    
    Features:
    - Mapping processing with validation
    - Error tracking and reporting
    - Bulk upload with batching
    - Filter support
    - Progress tracking
  `,
  
  requires: [
    'foam.core.reflow.UploadAgent',
    'foam.lang.CountingSemaphore'
  ],
  
  imports: [
    'setTimeout'
  ],
  
  properties: [
    {
      class: 'Map',
      name: 'validationErrorMap',
      factory: function() { return {}; }
    },
    {
      class: 'Map',
      name: 'requiredPropsCache_',
      hidden: true,
      factory: function() { return {}; },
      documentation: 'Cache of required properties by class id'
    },
    {
      class: 'Int',
      name: 'totalRows',
      value: 0
    },
    {
      class: 'Int', 
      name: 'matchedRows',
      value: 0
    },
    {
      class: 'Int',
      name: 'processing',
      value: 0
    },
    {
      class: 'Int',
      name: 'progress',
      value: 0
    },
    {
      name: 'dao',
      documentation: 'Target DAO for upload'
    },
    {
      name: 'previewDAO',
      documentation: 'DAO for preview mode storage'
    },
    {
      class: 'Boolean',
      name: 'isRealUpload',
      value: false,
      documentation: 'True for actual upload, false for preview'
    },
    {
      class: 'Boolean',
      name: 'bulkUpload',
      value: true,
      documentation: 'Use bulk upload with UploadAgent'
    },
    {
      name: 'filter',
      documentation: 'Optional filter predicate'
    },
    {
      name: 'mappings',
      documentation: 'Array of Mapping objects for field transformations'
    },
    {
      class: 'Function',
      name: 'adaptObject',
      documentation: 'Callback function to adapt objects before uploading',
      value: function(o) { }
    },
    {
      class: 'Function',
      name: 'progressCallback',
      documentation: 'Callback for progress updates',
      value: function(processing, progress) { }
    },
    {
      name: 'agent_',
      hidden: true,
      documentation: 'Current UploadAgent for batching'
    },
    {
      name: 'semaphore_',
      hidden: true,
      factory: function() {
        return this.CountingSemaphore.create({limit: 4});
      }
    },
    {
      class: 'String',
      name: 'output',
      value: '',
      documentation: 'HTML output for errors and status'
    }
  ],
  
  methods: [
    function isLongId(o) {
      // Check if ID property is Long type and no id alias exists, or
      // check the target property for custom id aliases (ids: ['differentName']) that are Long type
      return foam.lang.Long && foam.lang.Long.isInstance(o.ID) && ! o.id || ( ! o.id && foam.lang.Long.isInstance(o.ID.targetProperty));
    },

    function updateStatus() {
      // processing is incremented in put() method
      // progress should be calculated based on processing vs totalRows
      if ( this.totalRows > 0 ) {
        this.progress = Math.min(100, Math.floor(100 * this.processing / this.totalRows));
      } else {
        // If totalRows not set, estimate based on processing count
        this.progress = Math.min(99, Math.floor(this.processing / 100)); // Cap at 99% until eof
      }
      if ( this.progressCallback ) {
        this.progressCallback(this.processing, this.progress);
      }
    },
    
    async function put(o) {
      var self = this;

      // Apply object adaptation callback
      try {
        this.adaptObject(o);
      } catch (e) {
        console.warn('Object adaptation callback failed:', e);
      }

      // Increment processing counter (totalRows should be set by parser upfront)
      this.processing++;
      this.updateStatus();
      
      // Custom validation for required fields based on actual source data
      // We use __emptySourceFields__ instead of FOAM's built-in validation because
      // FOAM's validation flags falsy values like "0" as missing
      var emptySourceFields = o.__emptySourceFields__ || [];

      // Build our own validation errors for required fields
      var customErrors = [];
      var cls = o.cls_;
      if ( cls ) {
        // Cache required properties per class to avoid repeated getAxiomsByClass calls
        var clsId = cls.id;
        var requiredProps = this.requiredPropsCache_[clsId];
        if ( ! requiredProps ) {
          requiredProps = cls.getAxiomsByClass(foam.lang.Property).filter(p => p.required);
          this.requiredPropsCache_[clsId] = requiredProps;
        }

        for ( var i = 0; i < requiredProps.length; i++ ) {
          var prop = requiredProps[i];
          if ( emptySourceFields.indexOf(prop.name) !== -1 ) {
            customErrors.push([prop, 'value is empty (required field)']);
          }
        }
      }

      // Include non-required validation errors from FOAM (like format errors)
      var errors = o.errors_;
      if ( errors ) {
        var nonRequiredErrors = errors.filter(function(e) {
          // Skip FOAM's "Required" errors - we handle those with __emptySourceFields__
          return e[1] !== 'Required';
        });
        customErrors = customErrors.concat(nonRequiredErrors);
      }

      if ( customErrors.length > 0 ) {
        this.trackValidationError(customErrors, { row: this.processing });
      }
      
      // Apply filter for both preview and real uploads
      if ( this.filter ) {
        try {
          var matches = await this.filter.f(o);
          if ( ! matches ) {
            return; // Skip this object
          }
        } catch (e) {
          console.warn('Filter error:', e);
          // If filter fails, include the object
        }
      }
      
      // Object passed filter or no filter exists
      this.matchedRows++;
      
      // Note: Mapping processing is now handled by the format processors (CSV, XML, DAO)
      // before calling put(), so no need to extract properties here
      
      if ( ! this.isRealUpload ) {
        // Preview mode: just store in preview DAO
        if ( this.isLongId(o) ) {
          o.id = this.matchedRows;
        }
        if ( this.previewDAO ) {
          await this.previewDAO.put(o);
        }
      } else {
        // Real upload mode
        if ( Object.keys(this.validationErrorMap).length > 0 ) {
          // Validation errors exist - store in preview for review, don't upload
          if ( this.isLongId(o) ) {
            o.id = this.matchedRows;
          }
          if ( this.previewDAO ) {
            await this.previewDAO.put(o);
          }
        } else {
          // No validation errors - proceed with actual upload
          if ( this.bulkUpload ) {
            if ( ! this.agent_ ) this.agent_ = this.UploadAgent.create();
            this.agent_.data.push(o);

            if ( this.matchedRows && this.matchedRows % 2000 === 0 ) {
              var oldAgent = this.agent_;
              this.agent_ = undefined;
              await new Promise(r => self.setTimeout(r, 0));
              // Limit concurrent batch uploads using semaphore
              this.semaphore_.then(async () => {
                await this.dao.cmd(oldAgent);
              });
            }
          } else {
            await this.dao.put(o);
          }
        }
      }
      
      // Pause periodically to avoid blocking the UI
      if ( this.processing % 2000 === 0 ) {
        await new Promise(r => self.setTimeout(r, 0));
      }
    },
    
    async function eof() {
      var self = this;

      // Only send agent command if no validation errors
      if ( this.agent_ && Object.keys(this.validationErrorMap).length === 0 ) {
        await this.dao.cmd(this.agent_);
      }

      // Wait for all pending batch operations to complete
      await this.semaphore_.drain();
      this.dao?.cmd(foam.dao.DAO.RESET_CMD);

      this.updateStatus();
      this.progress = 100;
      
      // Generate validation error summary if there were any errors
      if ( Object.keys(this.validationErrorMap).length > 0 ) {
        this.output += '<br><div style="border: 1px solid #ff9800; padding: 10px; background: #fff3e0; border-radius: 4px;">';
        this.output += '<h3 style="color: #e65100; margin-top: 0;">Validation Error Summary</h3>';
        this.output += '<p style="color: #333;">Total rows processed: ' + this.processing + '</p>';
        this.output += '<p style="color: #333;">Rows with errors: ' + (this.processing - this.matchedRows) + '</p>';
        
        // Group and display errors
        this.output += '<h4 style="color: #e65100;">Error Details:</h4>';
        this.output += '<ul style="color: #333;">';
        
        var sortedErrors = Object.values(this.validationErrorMap).sort((a, b) => b.count - a.count);
        for ( var i = 0; i < sortedErrors.length; i++ ) {
          var errorInfo = sortedErrors[i];
          this.output += '<li><strong>' + errorInfo.field + '</strong>: ' + errorInfo.error + ' (' + errorInfo.count + ' occurrences)</li>';
        }
        
        this.output += '</ul>';
        this.output += '</div><br>';
      }
      
      return this;
    },
    
    function trackValidationError(errorSource, contextInfo) {
      var errorMsg = '';
      var errorKey = '';
      var field = '';
      var errorText = '';
      
      // Handle different error types
      if ( Array.isArray(errorSource) ) {
        // Handle o.errors_ array format: [fieldAxiom, errorMessage]
        errorMsg = errorSource.map(e => {
          var propName = e[0].label || e[0].name;
          return propName + ': ' + e[1];
        }).join(', ');
        errorKey = `multiple:${errorMsg.substring(0, 80)}`;
        field = 'multiple';
        errorText = errorMsg;
        
        console.error('Validation errors:', {
          errors: errorSource,
          context: contextInfo
        });
      } else if ( errorSource && errorSource.message ) {
        // Handle mapping validation errors
        var mapping = contextInfo.mapping || {};
        field = mapping.property || contextInfo.field || 'unknown';
        errorText = errorSource.message.substring(0, 80);
        errorMsg = `error: ${field}: ${errorSource.message}`;
        errorKey = `${field}:${errorText}`;
        
        console.error(errorMsg, {
          mapping: mapping,
          error: errorSource,
          context: contextInfo
        });
      } else {
        // Handle generic error format
        field = contextInfo.field || 'unknown';
        errorText = String(errorSource).substring(0, 80);
        errorMsg = `error: ${field}: ${errorText}`;
        errorKey = `${field}:${errorText}`;
        
        console.error(errorMsg, {
          error: errorSource,
          context: contextInfo
        });
      }
      
      // Track validation error in map for efficient counting
      if ( ! this.validationErrorMap[errorKey] ) {
        this.validationErrorMap[errorKey] = {
          field: field,
          error: errorText,
          count: 0
        };
      }
      this.validationErrorMap[errorKey].count++;
      
      // Add error to output for user visibility
      this.output += `<span style="color:red">${errorMsg}</span><br>`;
    },
    
    function processAllMappings(obj, rowData) {
      /**
       * Process all mappings and apply values to the target object.
       *
       * Tracks which fields had empty source values for required field validation.
       * This allows distinguishing between:
       * - Empty source (user provided no data) → fail required validation
       * - Source with "0" or other falsy value → pass validation (user provided data)
       */
      if ( ! this.mappings || this.mappings.length === 0 ) return;

      var hasValidationErrors = false;
      var emptySourceFields = [];

      for ( var i = 0; i < this.mappings.length; i++ ) {
        var mapping = this.mappings[i];
        try {
          var result = mapping.process(obj, undefined, rowData);

          // Track fields that had empty source values
          if ( result && result.sourceWasEmpty && result.property ) {
            emptySourceFields.push(result.property);
          }

          // Check for NaN/invalid values after processing
          this.validateProcessedValue(obj, mapping.property);
        } catch (x) {
          hasValidationErrors = true;
          this.trackValidationError(x, { mapping: mapping, rowData: rowData });
        }
      }

      // Store empty source fields on object for put() to filter false positives
      // This allows put() to distinguish between:
      // - Empty source (no user data) → required validation error is legitimate
      // - Source with "0" (user provided data) → required validation error is false positive
      if ( emptySourceFields.length > 0 ) {
        obj.__emptySourceFields__ = emptySourceFields;
      }

      return hasValidationErrors;
    },

    function validateProcessedValue(obj, propertyName) {
      var value = obj[propertyName];
      
      // Check for NaN in numeric fields
      if ( typeof value === 'number' && (isNaN(value) || !isFinite(value)) ) {
        throw new Error(`Invalid number (NaN/Infinity) in field '${propertyName}'`);
      }
      
      // Check for invalid dates
      if ( value instanceof Date && isNaN(value.getTime()) ) {
        throw new Error(`Invalid date in field '${propertyName}'`);
      }
    }
  ]
});