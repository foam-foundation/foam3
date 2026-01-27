/**
 * @license
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

foam.CLASS({
  package: 'foam.u2',
  name: 'FloatView',
  extends: 'foam.u2.TextField',
  mixins: ['foam.util.DeFeedback'],

  documentation: 'View for editing Float Properties.',

  requires: [
    'foam.parse.NumberParser'
  ],

  properties: [
    ['type', 'text'],
    { class: 'Float', name: 'data' },
    { class: 'Boolean', name: 'trimZeros', value: true },
    'precision',
    'min',
    'max',
    {
      class: 'Float',
      name: 'step',
      documentation: `The amount that the value should increment or decrement by
          when the arrow buttons in the input are clicked.`,
      value: 0.01
    },
    'preventFeedback',
    {
      class: 'String',
      name: 'numberFormat_',
      documentation: 'Internal: Parser format derived from foam.locale (undefined for standard, "european" for European)',
      hidden: true,
      getter: function() {
        // Use foam.locale to determine number format
        var locale = foam.locale || 'en-US';
        var lang = locale.split('-')[0].toLowerCase();
        // European format locales use comma as decimal separator
        var europeanLocales = ['de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'cs', 'sk', 'hu', 'ro', 'bg', 'el', 'ru', 'uk', 'tr', 'id', 'vi'];
        return europeanLocales.indexOf(lang) !== -1 ? 'european' : undefined;
      }
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.addClass();
      if ( ! foam.Undefined.isInstance(this.min)  ) this.setAttribute('min',  this.min);
      if ( ! foam.Undefined.isInstance(this.max)  ) this.setAttribute('max',  this.max);
      if ( ! foam.Undefined.isInstance(this.step) ) this.setAttribute('step', this.step);
    },

    function link() {
      if ( foam.Undefined.isInstance(this.precision) ) {
        this.attrSlot(null, this.onKey ? 'input' : null).relateFrom(
          this.data$,
          this.textToData.bind(this),
          this.dataToText.bind(this));
        return;
      }

      // limit to precision;
      var data = this.data$;
      var view = this.attrSlot(null, this.onKey ? 'input' : null);
      var self = this;

      if ( ! foam.Undefined.isInstance(this.data) ) view.set(this.dataToText(this.data));

      // When focus is lost on the view, force the view's value to equal the data
      // to ensure it's formatted properly.
      this.on('blur', function () {
        var value = self.dataToText(data.get());
        self.feedback_ = true;
        view.set('0');
        view.set(value);
        self.feedback_ = false;
      });

      view.sub(self.viewListener);

      data.sub(() => {
        this.deFeedback(() => { view.set(self.dataToText(data.get())); });
      });
    },

    function fromProperty(p) {
      this.SUPER(p);

      if ( ! foam.Undefined.isInstance(p.precision) ) this.precision = p.precision;
      if ( ! foam.Undefined.isInstance(p.min)       ) this.min       = p.min;
      if ( ! foam.Undefined.isInstance(p.max)       ) this.max       = p.max;
    },

    function formatNumber(val) {
      val = (val || 0).toFixed(this.precision);
      return this.trimZeros ? Number(val).toString() : val;
    },

    function dataToText(val) {
      // Use Intl.NumberFormat with foam.locale for formatting
      if ( typeof Intl !== 'undefined' ) {
        var locale = foam.locale || 'en-US';
        var options = {};
        if ( ! foam.Undefined.isInstance(this.precision) ) {
          options.minimumFractionDigits = this.trimZeros ? 0 : this.precision;
          options.maximumFractionDigits = this.precision;
        }
        return new Intl.NumberFormat(locale, options).format(val);
      }

      // Fallback to default formatting
      if ( foam.Undefined.isInstance(this.precision) ) {
        return '' + val;
      }
      return this.formatNumber(val);
    },

    function textToData(text) {
      // Use NumberParser with locale-derived format
      var parsed = this.NumberParser.create().parseString(text, this.numberFormat_);
      return isNaN(parsed) ? 0 : parsed;
    },

    function viewListenerFn() {
      var data = this.data$;
      var view = this.attrSlot(null, this.onKey ? 'input' : null);

      this.deFeedback(() => {
        const el = this.el_();

        let pos = el.selectionStart;
        // new text will be selected if it immediately follows the caret/selection
        let selectNewText = el.selectionEnd == el.value.length;

        // check bounds on data update and set to boundary values if out of bounds
        data.set(foam.Number.clamp(this.min, this.textToData(view.get()), this.max));

        // preserve caret location, maybe selecting new text
        el.selectionStart = Math.min(pos, el.value.length);
        if ( ! selectNewText ) el.selectionEnd = el.selectionStart;
      });
    }
  ],

  listeners: [
    {
      name: 'viewListener',
      code: function() { this.viewListenerFn(); }
    }
  ]
});
