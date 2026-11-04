/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'LabeledDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  requires: [ 'foam.mlang.sink.LabeledSink' ],

  properties: [
    {
      class: 'String',
      name: 'label',
      documentation: 'Label to identify this sink result for retrieval in genModel',
      validateObj: function(label) {
        // has to be valid JavaScript variable name
        // start with letter, underscore, or dollar sign
        if ( ! label.match(/^[a-zA-Z_$]/) ) return 'Label must start with a letter, underscore';
        // then only letters, numbers, underscores, or dollar signs (no dashes)
        if ( ! label.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/) ) return 'Label can only contain letters, numbers, underscores';

        // check for JavaScript reserved words
        var reservedWords = ['break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new', 'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'let', 'static', 'enum', 'implements', 'package', 'protected', 'interface', 'private', 'public'];
        if ( reservedWords.indexOf(label.toLowerCase()) !== -1 ) return 'Label cannot be a JavaScript reserved word';
      }
    },
    {
      name: 'sink',
      view: 'foam.core.reflow.SinkView',
      choice: 'foam.core.reflow.CountDAOAgent',
      documentation: 'The sink to delegate to'
    }
  ],

  methods: [
    function value(s) {
      return s;
    },
    function createSink() {
      return this.LabeledSink.create({
        label: this.label,
        delegate: this.sink ? this.sink.createSink() : null
      });
    },
    function addToE(e) {
      var self = this;
      // TODO: figure out why BROWSE doesn't work after reloading
      e.startContext({data: this}).
        start().
        add(this.LABEL.__)
          .add(this.SINK).
          end();
    }
  ]
});
