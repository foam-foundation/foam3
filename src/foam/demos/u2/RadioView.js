/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  name: 'RadioView',
  extends: 'foam.u2.View',

  documentation: 'Example of creating a simple Choice/Radio View.',

  exports: [ 'data as selected' ],

  css: '<< { height: 30px; }',

  properties: [
    'choices',
    {
      name: 'selected',
      factory: function() { return this.choices[0]; }
    }
  ],

  classes: [
    {
      name: 'Choice',
      extends: 'foam.u2.View',
      imports: [ 'selected' ],
      css: `
        <<selected {
          background: $backgroundBrandTertiary !important;
        }
        << {
          background: #ccc;
          border-radius: 10px;
          border: 1px solid #bbb;
          float: right;
          margin: 2px;
          padding: 2px;
          text-align: center;
          width: 70px;
        }
      `,
      methods: [
        function render() {
          this.SUPER();
          this
            .addClass(this.myClass())
            .addClass(this.selected$.map(s => s == this.data[0] ? this.myClass('selected') : ''))
            .add(this.data[1])
            .on('click', this.onSelect);
        }
      ],
      listeners: [
        function onSelect() {
          this.selected = this.data[0];
        }
      ]
    }
  ],

  methods: [
    function render() {
      var self = this;
      this.SUPER();
      this.start()
        .addClass(this.myClass())
        .forEach(this.choices, function(c) {
          this.add(self.Choice.create({data: c}));
        })
      .end();
    }
  ]
});
