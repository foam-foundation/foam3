/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


foam.CLASS({
  package: 'foam.core.crunch.document',
  name: 'Document',

  documentation: 'document upload capability',

  imports: [
    'translationService'
  ],

  implements: [
    'foam.lang.Validatable',
    'foam.core.crunch.Renewable'
  ],

  javaImports: [
    'foam.util.DateService'
  ],

  requires: ['foam.core.crunch.Capability'],
  messages: [
    { name: 'UPLOAD_REQUEST_MSG', message: 'Provide' },
    { name: 'IMAGE_REQUIRED', message: 'Document(s) required' },
    { name: 'SECTION_HELP_MSG', message: 'Require a document for' },
    { name: 'DOC_UPLOAD_SECTION', message: '${UPLOAD_REQUEST_MSG} ${capability.name}' }
  ],

  sections: [
    {
      name: 'documentUploadSection',
      title: ''
    }
  ],

  properties: [
    {
      class: 'foam.core.fs.FileArray',
      name: 'documents',
      label: '',
      section: 'documentUploadSection',
      gridColumns: 6,
      view: function(args, X) {
        return {
          class: 'foam.core.fs.fileDropZone.FileDropZone',
          files$: X.data.documents$
        };
      },
      required: true
    },
    {
      class: 'FObjectProperty',
      of: 'foam.core.crunch.Capability',
      name: 'capability',
      hidden: true,
      documentation: 'Used by section subTitle and help',
      factory: function() {
        return this.Capability.create();
      },
      javaCompare: 'return 0;'
    },
    {
      class: 'Boolean',
      name: 'isRequired',
      documentation: 'Whether the file is required or not.',
      value: true,
      hidden: true
    },
    // hide renewable properties
    {
      name: 'timeZone',
      hidden: true
    },
    {
      name: 'expiryPeriod',
      hidden: true
    },
    {
      name: 'expiryPeriodTimeUnit',
      hidden: true
    },
    {
      name: 'isRenewable',
      hidden: true
    },
    {
      name: 'renewalPeriod',
      hidden: true
    },
    {
      name: 'renewalPeriodTimeUnit',
      hidden: true
    },
    {
      name: 'gracePeriod',
      hidden: true
    },
    {
      name: 'gracePeriodTimeUnit',
      hidden: true
    },
    {
      name: 'lastNotification',
      hidden: true
    }
  ],
  methods: [
    {
      name: 'validate',
      javaCode: `
      if ( getIsRequired() && getDocuments().length == 0 ) {
        throw new foam.lang.ValidationException(IMAGE_REQUIRED);
      }
      `
    }
  ]
});
