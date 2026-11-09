/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'PillChoiceView',
  extends: 'foam.u2.View',

  documentation: `
    Lists each choice as a clickable pill, the way a chat assistant offers
    suggested replies. The pill matching data is highlighted. In read-only
    mode only the selected pill is shown, so a question that has been
    answered, like 'Delete order 1234?', keeps its answer on the page.

    Takes the same choices as ChoiceView (plain values, [ value, label ]
    pairs, or a map) and binds to data the same way, but has no DAO support.
  `,

  css: `
    ^ {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    ^pill {
      border: 1px solid $borderBrand;
      border-radius: 999px;
      color: $textBrand;
      background: $backgroundDefault;
      padding: 6px 16px;
      cursor: pointer;
      user-select: none;
    }

    ^pill:hover {
      background: $backgroundBrandTertiary;
    }

    ^selected, ^selected:hover {
      background: $backgroundBrand;
      color: $textOnBrand;
    }

    ^ro ^pill {
      cursor: default;
    }
  `,

  properties: [
    {
      name: 'choices',
      documentation: `Array of [value, label] choices. Plain values are
          expanded to [value, labelized value], and a map becomes [key, value]
          pairs, as in ChoiceView.`,
      factory: function() { return []; },
      adapt: function(_, nu) {
        if ( typeof nu === 'object' && ! Array.isArray(nu) ) {
          return Object.keys(nu).map(k => [ k, nu[k] ]);
        }
        return nu.map(c => Array.isArray(c) ? c : [ c, foam.String.labelize(c + '') ]);
      }
    }
  ],

  methods: [
    function render() {
      var self = this;
      var ro   = this.mode$.map(m => m === foam.u2.DisplayMode.RO);

      this.addClass().enableClass(this.myClass('ro'), ro);

      this.add(this.dynamic(function(choices) {
        choices.forEach(function(c) {
          var isData = self.data$.map(d => foam.util.equals(c[0], d));

          this.start()
            .addClass(self.myClass('pill'))
            .enableClass(self.myClass('selected'), isData)
            // Read-only mode keeps only the selected pill.
            .show(self.slot(function(mode, data) {
              return mode !== foam.u2.DisplayMode.RO || foam.util.equals(c[0], data);
            }))
            .on('click', function() {
              if ( self.mode === foam.u2.DisplayMode.RW ) self.data = c[0];
            })
            .add(c[1])
          .end();
        }, this);
      }));
    }
  ]
});
