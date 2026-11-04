/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Input',
  extends: 'foam.core.reflow.cmd.Command',

  requires: [ 'foam.core.reflow.Prompt' ],

  documentation: `
    Ask the user for a value. The second argument can be:
      a type name:      input('Age?', 'Long')
      a list of options: input('Are you sure?', [ 'Yes', 'No' ])
      a Prompt config:   input('Colour?', { options: [ 'Red', 'Blue' ], defaultValue: 'Red' })
                         input('Due?', { view: { class: 'foam.u2.DateView' } })
    Options can be plain values or [ value, label ] pairs, as in ChoiceView.
    When a saved flow loads, it waits for each input to be answered before
    running the blocks after it. Add blocking: false to let it carry on:
                         input('Note?', { blocking: false })
  `,

  methods: [
    function execute(prompt, config) {
      if ( typeof config === 'string' ) config = { type: config };
      else if ( Array.isArray(config) ) config = { options: config };

      var { options, ...props } = config || {};

      // A list of options is shorthand for a ChoiceView. The placeholder stops
      // ChoiceView from preselecting the first option, so a confirmation like
      // [ 'Yes', 'No' ] starts unanswered instead of already saying 'Yes'.
      if ( options ) {
        props.view = { class: 'foam.u2.view.ChoiceView', choices: options, placeholder: '--' };
      }

      var p = this.Prompt.create(props);

      if ( prompt ) p.label = prompt;

      this.currentBlock.value = p;
      this.out.add(p);
    }
  ]
});
