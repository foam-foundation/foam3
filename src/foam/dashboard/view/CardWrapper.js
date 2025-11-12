/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dashboard.view',
  name: 'CardWrapper',
  extends: 'foam.u2.Element',

  imports: [
    'dashboardController'
  ],

  requires: [
    'foam.dashboard.model.VisualizationSize',
    'foam.dashboard.view.Card',
    'foam.u2.borders.CardBorder'
  ],

  css: `
  ^ .foam-dashboard-view-Card {
    border-radius: 22px;
    overflow: hidden;
  }
  ^titled-container {
    display: grid;
    grid-template-rows: 2em 1fr;
  }
  `,

  properties: [
    {
      class: 'foam.u2.ViewSpec',
      name: 'border',
      hidden: true,
      factory: function () {
        return this.Card;
      }
    },
    'title',
    { name: 'currentView', hidden: true },
    { name: 'viewTitle', value: 'Dashboard', hidden: true },
    {
      class: 'Enum',
      of: 'foam.dashboard.model.VisualizationSize',
      name: 'size',
      expression: function(data$size) {
        return data$size || this.VisualizationSize.MEDIUM;
      }
    },
    { name: 'data', hidden: true },
    { name: 'obj',  hidden: true },
    { name: 'mode', hidden: true },
    ['aspectRatio', 'auto']
  ],

  methods: [
    function init() {
      let self = this;
      this.addClass(this.myClass())
        .enableClass(this.myClass('titled-container'), this.title$)
        .style({ 'aspect-ratio': this.aspectRatio$ })
        .start()
          .addClass(this.myClass('title'), 'h500')
          .show(this.title$)
          .add(this.title$)
        .end()
        .tag(this.border, {  data: this, size$: self.size$ }, this.content$);
        this.content.add(this.slot(function(currentView) {
          return foam.u2.ViewSpec.createView(currentView, {
            data$: self.data$}, this, this.__subSubContext__);
        }));
    }
  ],

  listeners: [
    {
      name: 'update',
      code: function() {
        // no-op
      }
    }
  ]
});
