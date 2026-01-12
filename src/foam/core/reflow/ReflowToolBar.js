/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ReflowToolBar',
  extends: 'foam.u2.View',

  requires: [
    'foam.core.reflow.ToolbarControl',
    'foam.mlang.sink.Count'
  ],

  imports: ['showPrompts','toolbarControlDAO', 'data as importedData'],

  css: `
    ^ {
      position: relative;
      margin-block-end: 0;
      display: inline-flex;
      width: 100%;
      align-items: center;
      position: sticky;
      justify-content: space-between;
      bottom: 0;
      padding: 10px 16px;
      border-top: 1px solid $borderLight;
    }
    ^ > :lastChild {
      flex-shrink: 0;
    }
    ^input-field-container {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
    }

  `,

  properties: [
    {
      name: 'data',
      factory: function() {
        return this.importedData;
      }
    },
    {
      class: 'StringArray',
      name: 'promptModes',
      value: []
    },
    {
      class: 'String',
      name: 'promptMode',
      value: 'Standard',
      view: function(_, X) {
        return {
          class: 'foam.u2.view.ChoiceView',
          choices$: X.data.promptModes$.map(modes =>
            (modes || []).map(m => [m, foam.String.labelize(m)])
          )
        };
      }
    },
    {
      class: 'Boolean',
      name: 'hasControls'
    }
  ],

  methods: [
    function render() {
      let self = this;
      this.updatePromptModes();
      this.updateHasControls();
      this.onDetach(this.showPrompts$.sub(this.updateHasControls));
      this.
        addClass().
        show(this.hasControls$).
        start().
        addClass(this.myClass('input-field-container')).
        add(this.dynamic(function(promptMode) {
          self.toolbarControlDAO
            .where(self.EQ(self.ToolbarControl.TOOLBAR, self.promptMode))
            .select().then(result => {
              result.array
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .forEach(c => {
                  this.tag({class: c.view, data: self.data});
                });
            });
        })).
        end().
        startContext({ data: this }).
        start().
          show(this.promptModes$.map(modes => modes && modes.length > 1)).
          add(this.PROMPT_MODE).
        end().
        endContext();
    }
  ],

  listeners: [
    {
      name: 'updateHasControls',
      isMerged: true,
      code: function() {
        if ( ! this.showPrompts ) {
          this.hasControls = false;
          return;
        }
        this.toolbarControlDAO
          .where(this.EQ(this.ToolbarControl.TOOLBAR, this.promptMode))
          .select(this.Count.create())
          .then(count => { this.hasControls = count.value > 0; });
      }
    },
    {
      name: 'updatePromptModes',
      isMerged: true,
      code: function() {
        this.toolbarControlDAO.select().then(result => {
          const modes = Array.from(
            new Set(
              result.array
                .map(c => c.toolbar || 'Standard')
                .filter(Boolean)
            )
          ).sort();

          this.promptModes = modes;
        });
      }
    }
  ]
});
