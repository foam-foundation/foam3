/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Button',
  extends: 'foam.core.reflow.cmd.Command',

  classes: [
    {
      name: 'FlowAction',
      extends: 'foam.lang.Action',
      documentation: 'Small inner class to set up some basic view and configuration settings to make actions easier to use in console, might want to move this out if we ever want to use them outside these commands',
      // the import has to be defined here, since we call the code in the action ?
      imports: [ 'scope?' ],

      sections: [
        {
          name: 'config',
          title: '',
          properties: [
            { name: 'label', onKey: true },
            { name: 'script', reactive: false  },
            { name: 'buttonStyle' },
            { name: 'size' },
            { name: 'icon' },
            { name: 'themeIcon' },
            { name: 'toolTip' },
            // These need more work to be integrated here, they need proper data setting, we would probably want to switch to ActionReferences for this
            // { name: 'isEnabled' },
            // { name: 'isAvailable' }
          ]
        }
      ],
      properties: [
        {
          class: 'String',
          name: 'script',
          supportingLabel: 'By default this button will insert the text "Hello World" as the next command when clicked. Change this script to modify this behaviour',
          value: `'Hello World'`,
          view: {
            class: 'foam.u2.tag.TextArea',
            rows: 5
          }
        },
        {
          name: 'code',
          expression: function(script) {
            var self = this;
            if ( ! script ) return () => {};
            return function() {
              with ( self.scope ) {
                var result = eval('(async function() { ' + self.script + ' })').call(self);
                return result;
              }
            }
          }
        },
        {
          name: 'name',
          factory: function() { return 'flowButton_' + foam.next$UID(); }
        },
        ['label', 'Button'],
      ],
      methods: [
        function toE(args, X) {
          var view = foam.u2.ViewSpec.createView(this.view, {
            ...(args || {}),
            action: this,
            label$: this.label$,
            buttonStyle$: this.buttonStyle$,
            size$: this.size$,
            icon$: this.icon$,
            themeIcon$: this.themeIcon$,
            toolTip$: this.toolTip$
          }, this, X);

          if ( X.data$ && ! ( args && ( args.data || args.data$ ) ) ) {
            view.data$ = X.data$;
          }
          return view;
        }
      ]
    }
  ],

  properties: [
    [ 'description', 'Button with custom logic' ]
  ],

  methods: [
    function execute(label, script) {
      var action = this.FlowAction.create({
        label: label,
        script: script
      });
      this.currentBlock.value = action;
      this.currentBlock.configViewSpec = {
        useSections: ['config', 'general', 'borderSettings']
      }
      this.out.tag(action);
    }
  ]
});
