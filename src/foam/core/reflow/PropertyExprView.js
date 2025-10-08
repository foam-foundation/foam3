/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PropertyExprView',
  extends: 'foam.u2.View',

  requires: [ 'foam.core.reflow.PropertyChoiceView' ],

  properties: [
    {
      class: 'Boolean',
      name: 'updatingData_',
      value: false,
      hidden: true,
      documentation: 'Internal flag to prevent infinite loops during data updates'
    },
    {
      name: 'data',
      documentation: 'The data to be transformed',
      preSet: function(oldValue, newValue) {
        // console.log('PropertyExprView data preSet:', oldValue, '->', newValue);
        if ( this.updatingData_ ) return newValue;
        
        this.updatingData_ = true;
        try {
          if ( ! newValue ) {
            // Clear selections when data is null/undefined
            this.selectedProperty = null;
            this.selectedTransformation = null;
            return newValue;
          }
        
          // Check if this is a transformation expression (has delegate)
          if ( newValue.delegate ) {
            // This is a transformation expression
            this.selectedTransformation = newValue.cls_;
            this.selectedProperty = newValue.delegate;
          } else {
            // This is just a plain property
            this.selectedProperty = newValue;
            this.selectedTransformation = null;
          }
          
          return newValue;
        } finally {
          this.updatingData_ = false;
        }
      }
    },
    {
      name: 'forCls',
      documentation: 'The class to get properties from'
    },
    {
      name: 'selectedProperty',
      documentation: 'The currently selected property',
      postSet: function() {
        if ( ! this.updatingData_ ) {
          this.updateData();
        }
      }
    },
    {
      name: 'selectedTransformation',
      documentation: 'The currently selected transformation function',
      postSet: function() {
        if ( ! this.updatingData_ ) {
          this.updateData();
        }
      }
    },
    {
      name: 'placeholder',
      value: 'Choose Property'
    },
    {
      name: 'predicate',
      class: 'foam.mlang.predicate.PredicateProperty',
      factory: function() {
        return foam.mlang.predicate.True.create();
      }
    },
    {
      name: 'transformationConfig',
      documentation: 'Configuration map of property class IDs to their available transformations',
      factory: function() {
        return [
          {
            classNames: ['foam.lang.DateTime', 'foam.lang.Date'],
            label: 'Date Format',
            choices: [
              [ null,                                  '--'           ],
              [ foam.mlang.expr.DateToHHExpr,          'HH'           ],
              [ foam.mlang.expr.DateToHHMMExpr,        'HH:MM'        ],
              [ foam.mlang.expr.DateToHHMMSSExpr,      'HH:MM:SS'     ],
              [ foam.mlang.expr.DateToYYYYMMDDExpr,    'YYYY/MM/DD'   ],
              [ foam.mlang.expr.DateToYYYYMMExpr,      'YYYY/MM'      ],
              [ foam.mlang.expr.DateToYYYYExpr,        'YYYY'         ],
              [ foam.mlang.expr.DateToWeekExpr,        'Week (YYYY-WWW)' ],
              [ foam.mlang.expr.DateToQuarterExpr,     'Quarter (YYYY-QQ)' ],
              [ foam.mlang.expr.DateToDayOfYearExpr,   'Day of Year (YYYY-DDD)' ]
            ]
          }
        ];
      }
    }
  ],

  methods: [
    function updateData() {
      this.updatingData_ = true;
      try {
        if ( ! this.selectedProperty ) {
          this.data = null;
        } else if ( this.selectedTransformation ) {
          // Create transformation expression
          this.data = this.selectedTransformation.create({ delegate: this.selectedProperty });
        } else {
          // Just use the property directly
          this.data = this.selectedProperty;
        }
      } finally {
        this.updatingData_ = false;
      }
    },

    function render() {
      this.SUPER();
      var self = this;

      this
        // Property selector
        .start(this.PropertyChoiceView, {
          forCls: this.forCls,
          data$: this.selectedProperty$,
          predicate: this.predicate,
          placeholder: this.placeholder
        })
        .end()

        // Transformation selector (dynamically shown based on property type and config)
        .add(this.dynamic(function(selectedProperty, transformationConfig) {
          if ( selectedProperty ) {
            var config = null;
            
            // Find config by checking instanceof against all config entries
            transformationConfig.forEach(function(configEntry) {
              configEntry.classNames.forEach(function(className) {
                var cls = foam.lookup(className);
                if ( cls && cls.isInstance(selectedProperty) ) {
                  config = configEntry;
                }
              });
            });
            
            if ( config && config.choices && config.choices.length > 1 ) {
              this
                .start('br').end()
                .start('label').add(config.label || 'Transformation:').end()
                .start(foam.u2.view.ChoiceView, {
                  data$: self.selectedTransformation$,
                  choices: config.choices
                });
            } else {
              // Clear transformation when property doesn't support transformations
              self.selectedTransformation = null;
            }
          } else {
            // Clear transformation when no property is selected
            self.selectedTransformation = null;
          }
        }));

    }
  ]
});