/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.cron.ui',
  name: 'SchedulableSuccessWizardletView',
  extends: 'foam.u2.wizard.wizardlet.SuccessWizardletView',

  css: `
    <<reference-message-container {
      display: flex;
      justify-content: center;
    }
    <<reference-message {
      white-space: nowrap;
      margin-right: 0.3rem;
    }
  `,

  messages: [
    { name: 'TITLE', message: 'Your schedule has been set' },
    { name: 'START_DATE', message: 'First Scheduled Date: '}
  ],

  properties: [
    {
      class: 'String',
      name: 'message',
      factory: function() {
        return this.TITLE;
      }
    },
    {
      class: 'String',
      name: 'startDateLabel',
      factory: function() {
        return this.START_DATE;
      }
    }
  ],

  methods: [
    async function render() {
      this.SUPER();

      this.addClass('p')
      .start()
        .addClass(this.myClass('reference-message-container'), this.myClass('centered'))
        .start()
          .addClass(this.myClass('reference-message'))
          .add(this.startDateLabel)
        .end()
        .start()
          .addClass('bolder', this.myClass('reference-number'))
          .add(this.data.startDate.toLocaleDateString(
            foam.locale,
            {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }
          ))
        .end()
      .end();
    }
  ]
});
