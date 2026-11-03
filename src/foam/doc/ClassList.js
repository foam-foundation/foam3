/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.doc',
  name: 'ClassList',
  extends: 'foam.u2.View',

  requires: [
    'foam.doc.ClassLink',
    'foam.doc.DocBorder'
  ],

  css: `
    << a {
      display: inline-block;
      padding: 2px;
      width: 220px;
    }
    <<package {
      font-weight: $font-semi-bold;
    }
    <<indent {
      margin-left: 30px;
    }
  `,

  properties: [
    'title',
    {
      name: 'info',
      expression: function (data) {
        return data && data.length;
      }
    },
    {
      of: 'Boolean',
      name: 'showPackage',
      value: false
    },
    {
      of: 'Boolean',
      name: 'showSummary'
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      var self = this;
      var pkg  = '';

      this.
        addClass(this.myClass()).
        start(this.DocBorder, {title: this.title, info$: this.info$}).
          start('div').
            forEach(this.data$, function(d) {
              if ( ! self.showPackage ) {
                if ( d.package !== pkg ) {
                  pkg = d.package;
                  this.start('div').addClass(self.myClass('package')).add(pkg).end();
                }
              }

              this.start('div')
                .start(self.ClassLink, {data: d, showPackage: self.showPackage}).
                  addClass(self.showPackage ? undefined : self.myClass('indent')).
                end().
                call(function(f) {
                  if ( self.showSummary ) {
                    this.add(' ', self.summarize(d.documentation));
                  }
                }).
              end();
            }).
          end().
        end();
    },

    function summarize(txt) {
      if ( ! txt ) return null;
      var i = txt.indexOf('.');
      if ( i < 60 ) return txt.substring(0, i+1);
      return txt.substring(0, 60) + ' ...';
    }
  ]
});
