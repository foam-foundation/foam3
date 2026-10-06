/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.history.view',
  name: 'HistoryRecordCitationView',
  extends: 'foam.u2.View',

  css: `
    <<row {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'propertyName'
    }
  ],

  methods: [
    function render() {
      this.SUPER();

      const propertyUpdate = this.getPropertyUpdate(this.propertyName);

      this
        .addClass('p-legal-light', this.myClass('row'))
        .start()
          .add(this.data.timestamp)
        .end()
        .start()
          .add(propertyUpdate?.toSummary())
        .end()
    },

    function getPropertyUpdate() {
      return this.data.updates.find(update => update.name === this.propertyName);
    }
  ]
});
