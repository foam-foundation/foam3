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
  
  implements: [ 'foam.mlang.Expressions' ],

  requires: [
    'foam.core.job.Job',
    'foam.core.job.JobStatus',
    'foam.core.reflow.UploadAgent'
  ],

  constants: [
    {
      name: 'BATCH_SIZE',
      value: 2000,
      documentation: 'Rows in one batch job.'
    },
    {
      name: 'MAX_PENDING',
      value: 20,
      documentation: `Most batch jobs of a run that may be put and not yet COMPLETED. At the limit the
        sink waits for the server, so a slow server never holds more than 20 batches (40,000 rows) of this run.`
    }
  ],
  
  imports: [
    'jobDAO?',
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
      class: 'String',
      name: 'daoKey',
      documentation: `Name of the served DAO that dao stands for. A bulk batch runs on the server, which finds
        the DAO by this name; the dao property only serves single puts and the reset command.`
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
      value: function(processing, progress, sent, processed) { }
    },
    {
      class: 'Int',
      name: 'sent',
      documentation: 'Percent of the batches put to the server.'
    },
    {
      class: 'Int',
      name: 'processed',
      documentation: 'Percent of the batches the server has finished.'
    },
    {
      name: 'finishJob',
      documentation: `Optional function that returns a Job. When the last batch is put, the sink calls it and puts
        the Job in the same group, so the server runs it after every batch has ended, even when one failed
        or this client is gone by then. It sets runAfterFailure itself when it must run after a failure.
        The sink sets its id and group.`
    },
    {
      class: 'Boolean',
      name: 'finishJobCompleted',
      documentation: `True when the finish job ran to COMPLETED: the server then owns the outcome of
        the run. A finish job that failed, or was never put, leaves the outcome to the caller.`
    },
    {
      name: 'agent_',
      hidden: true,
      documentation: 'Current UploadAgent for batching'
    },
    {
      name: 'runKey_',
      hidden: true,
      factory: function() { return foam.uuid.randomGUID(); },
      documentation: `Tells this run's batch jobs apart from every other run's. A batch job's id is runKey_:n,
        so a resent submit of batch n lands on the job that already exists instead of making a second.
        A caller can set it to start with its own record's id, such as "12:" plus a fresh uuid, so the
        server can tell whose record a group of jobs belongs to when this client is gone. Each run needs
        a new value: a failed group is refused further jobs for good.`
    },
    {
      class: 'Int',
      name: 'batches_',
      hidden: true,
      documentation: 'Number of batches put so far, which is also the number of the next one.'
    },
    {
      class: 'Int',
      name: 'completed_',
      hidden: true,
      documentation: 'Jobs of this run the server has COMPLETED, as of the last count.'
    },
    {
      class: 'Int',
      name: 'failed_',
      hidden: true,
      documentation: 'Jobs of this run that are FAILED, as of the last count. Includes jobs that never ran.'
    },
    {
      class: 'Int',
      name: 'pollMs_',
      value: 1000,
      hidden: true,
      documentation: `Wait before the next count of the group's jobs. A 2,000-row batch on a slow table can
        take over a minute, so the wait doubles up to 5 s while no job ends, and drops back to 1 s when one does.`
    },
    {
      class: 'Boolean',
      name: 'finishing_',
      hidden: true,
      documentation: 'True once no more batches will be put, so the batch total is known.'
    },
    {
      name: 'error_',
      hidden: true,
      documentation: 'First failure of a batch job. Once set, put() and eof() throw it.'
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
      // The batch total is a guess until the last batch is put: totalRows / BATCH_SIZE
      // (a filter can make it smaller).
      var total = this.finishing_ ? this.batches_ :
        Math.max(this.batches_, Math.ceil(this.totalRows / this.BATCH_SIZE));
      this.sent      = total ? Math.min(100, Math.floor(100 * this.batches_ / total)) : 0;
      this.processed = total ? Math.min(100, Math.floor(100 * Math.min(this.completed_, this.batches_) / total)) : 0;
      if ( this.progressCallback ) {
        this.progressCallback(this.processing, this.progress, this.sent, this.processed);
      }
    },

    async function countGroup_() {
      // One request per count: how many jobs ended. The FAILED count is asked only when that
      // number moved, which is once per batch, not on every poll.
      var group = this.jobDAO.where(this.EQ(this.Job.GROUP, this.runKey_));
      var ended = (await group
        .where(this.IN(this.Job.STATUS, [ this.JobStatus.COMPLETED, this.JobStatus.FAILED ]))
        .select(this.COUNT())).value;
      var changed = ended !== this.completed_ + this.failed_;
      if ( changed ) {
        this.failed_    = (await group.where(this.EQ(this.Job.STATUS, this.JobStatus.FAILED)).select(this.COUNT())).value;
        this.completed_ = ended - this.failed_;
        this.updateStatus();
      }
      this.pollMs_ = changed ? 1000 : Math.min(5000, this.pollMs_ * 2);
    },

    function pause_() {
      return new Promise(r => this.setTimeout(r, this.pollMs_));
    },

    async function firstError_() {
      // The group runs in put order, so the failed job with the lowest number is the one that
      // failed for real; the jobs behind it only say they were not run.
      var failed = (await this.jobDAO
        .where(this.AND(
          this.EQ(this.Job.GROUP, this.runKey_),
          this.EQ(this.Job.STATUS, this.JobStatus.FAILED)))
        .select()).array;
      var seq = j => Number(j.id.substring(j.id.lastIndexOf(':') + 1));
      var job = failed.sort((a, b) => seq(a) - seq(b))[0];
      return new Error(job ? job.exception.split('\n')[0] : 'An upload batch failed.');
    },

    async function putJob_(job) {
      if ( ! this.jobDAO ) throw new Error('Cannot upload: the server job service is not available.');
      job.id    = this.runKey_ + ':' + this.batches_;
      job.group = this.runKey_;
      // The put answers when the job is queued, not when it has run, so a slow server
      // cannot hold it past the box timeout; a resent put lands on the same id.
      await this.jobDAO.put(job);
    },

    async function putBatch_(agent) {
      // Hold at the limit, and stop at the first failure: later batches would only be skipped.
      while ( true ) {
        await this.countGroup_();
        if ( this.failed_ > 0 ) {
          await this.finish_(true);
          throw this.error_;
        }
        if ( this.batches_ - this.completed_ < this.MAX_PENDING ) break;
        await this.pause_();
      }
      agent.daoKey = this.daoKey;
      await this.putJob_(agent);
      this.batches_++;
      this.updateStatus();
    },

    async function finish_(withFinishJob) {
      if ( this.finishing_ ) return;
      this.finishing_ = true;

      var jobs = this.batches_;
      var job  = withFinishJob && this.finishJob && this.finishJob(this);

      // A preview sends nothing: with no batch and no finish job there is nothing to wait for
      // or clean up, and no jobDAO is needed.
      if ( ! jobs && ! job ) return;
      if ( job ) {
        await this.putJob_(job);
        jobs++;
      }

      // Every job of the group ends: a failed job makes the ones behind it end FAILED too.
      while ( true ) {
        await this.countGroup_();
        if ( this.completed_ + this.failed_ >= jobs ) break;
        await this.pause_();
      }
      if ( this.failed_ > 0 ) this.error_ = this.error_ || await this.firstError_();
      if ( job ) {
        var ended = await this.jobDAO.find(job.id);
        this.finishJobCompleted = !! ended && ended.status === this.JobStatus.COMPLETED;
      }
      try {
        await this.jobDAO.where(this.EQ(this.Job.GROUP, this.runKey_)).removeAll();
      } catch (e) {
        console.warn('Could not remove upload jobs', e);
      }
    },

    function settle() {
      // For a run that stops without eof (a parse error): wait for the batches already put to
      // end, so that nothing lands after the caller removes what was stored.
      return this.batches_ ? this.finish_(false) : Promise.resolve();
    },

    async function put(o) {
      var self = this;

      if ( this.error_ ) throw this.error_;

      // Apply object adaptation callback
      try {
        this.adaptObject(o);
      } catch (e) {
        console.warn('Object adaptation callback failed:', e);
      }

      // Increment processing counter (totalRows should be set by parser upfront)
      this.processing++;
      // Throttle progress updates: writing processing/progress fires reactive slots
      // that the upload UI subscribes to. Firing per-row (millions of times) dominates
      // bulk-upload cost; updating on the batch boundary keeps the bar responsive.
      if ( this.processing % 2000 === 0 ) this.updateStatus();
      
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

      // Include non-required validation errors from FOAM (like format errors).
      // getErrors() is the slotless equivalent of o.errors_: the errors_ getter builds
      // a per-object ExpressionSlot with arg-slot subscriptions, wasted reactive
      // machinery in a one-shot bulk upload. getErrors() runs the same property
      // validators synchronously with no slot allocation.
      var errors = o.getErrors();
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

            if ( this.matchedRows && this.matchedRows % this.BATCH_SIZE === 0 ) {
              var oldAgent = this.agent_;
              this.agent_ = undefined;
              await this.putBatch_(oldAgent);
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

      // Only send the last batch, and the finish job, if there are no validation errors
      var valid = Object.keys(this.validationErrorMap).length === 0;
      if ( this.agent_ && valid ) await this.putBatch_(this.agent_);

      // Wait for every job of the run to end
      await this.finish_(valid);
      this.dao?.cmd(foam.dao.DAO.RESET_CMD);
      if ( this.error_ ) throw this.error_;

      this.updateStatus();
      this.progress = 100;
      
      // Generate validation error summary if there were any errors
      if ( Object.keys(this.validationErrorMap).length > 0 ) {
        var warn = foam.CSS.returnTokenValue('$warn500', this.cls_, this.__subContext__);
        var warnBackground = foam.CSS.returnTokenValue('$warn50', this.cls_, this.__subContext__);
        var warnText = foam.CSS.returnTokenValue('$warn700', this.cls_, this.__subContext__);
        var text = foam.CSS.returnTokenValue('$textDefault', this.cls_, this.__subContext__);
        this.output += '<br><div style="border: 1px solid ' + warn + '; padding: 10px; background: ' + warnBackground + '; border-radius: 4px;">';
        this.output += '<h3 style="color: ' + warnText + '; margin-top: 0;">Validation Error Summary</h3>';
        this.output += '<p style="color: ' + text + ';">Total rows processed: ' + this.processing + '</p>';
        this.output += '<p style="color: ' + text + ';">Rows with errors: ' + (this.processing - this.matchedRows) + '</p>';
        
        // Group and display errors
        this.output += '<h4 style="color: ' + warnText + ';">Error Details:</h4>';
        this.output += '<ul style="color: ' + text + ';">';
        
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
