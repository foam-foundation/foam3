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
      a Prompt config:   input('Colour?', { blocking: true, options: [ 'Red', 'Blue' ], defaultValue: 'Red' })
                         input('Due?', { view: { class: 'foam.u2.DateView' } })
    Options can be plain values or [ value, label ] pairs, as in ChoiceView.
    When a saved flow loads, it waits for each input to be answered before
    running the blocks after it. Add blocking: false to let it carry on:
                         input('Note?', { blocking: false })
  `,

  methods: [
    function execute(prompt, config) {
      if ( typeof config === 'string' )
        config = { type: config };
      else if ( Array.isArray(config) )
        config = { options: config };

      var { options, ...props } = config || {};

      // A list of options is shown as one clickable pill per option, like
      // suggested replies in a chat. Nothing is preselected, so a confirmation
      // like [ 'Yes', 'No' ] starts unanswered. In read-only mode only the
      // picked pill is shown.
      if ( options ) {
        props.view = { class: 'foam.u2.view.PillChoiceView', choices: options };
      }

      var p = this.Prompt.create(props);

      if ( prompt ) p.label = prompt;

      this.currentBlock.value = p;
      this.out.add(p);
    }
  ]
});
