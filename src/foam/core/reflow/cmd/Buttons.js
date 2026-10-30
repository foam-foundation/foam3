/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Buttons',
  extends: 'foam.core.reflow.cmd.Command',

    classes: [
    {
      name: 'FlowActionArrayHolder',
      properties: [
        {
          class: 'FObjectArray',
          of: 'foam.core.reflow.cmd.Button.FlowAction',
          name: 'actions',
          factory: function() {
            return [{class: 'foam.core.reflow.cmd.Button.FlowAction'}]
          },
          view: {
            class: 'foam.u2.view.TitledArrayView',
            valueView: {
              class: 'foam.u2.detail.VerticalDetailView',
              useSections: ['config']
            }
          }
        }
      ]
    }
  ],

  properties: [
    [ 'description', 'Buttons group with custom logic' ],
    'holder_'
  ],

  methods: [
    function execute() {
      this.holder_ = this.FlowActionArrayHolder.create();
      this.currentBlock.value = this.holder_;
      // This is not the most efficient way to do this, if this is slow or causing too many refreshes, this should be adjusted to
      // do a diff and only add new actions and remove old ones rather than re-rendering the group every time
      this.out.add(this.dynamic(function(holder_$actions) {
        this.start(foam.u2.ButtonGroup)
          .forEach(holder_$actions, function(v) {
            this.tag(v)
          })
        .end();
      }))
    }
  ]
});
