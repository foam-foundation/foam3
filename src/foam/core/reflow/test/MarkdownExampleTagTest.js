/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.test',
  name: 'MarkdownExampleTagTest',
  extends: 'foam.core.test.JSTest',

  documentation: `
    An <example> in markdown hands its source to the Example as one string,
    whether it spans one line or many, while other tags still parse multi-line
    content as markdown.
  `,

  requires: [
    'foam.core.reflow.example.Example',
    'foam.u2.view.MarkdownView'
  ],

  methods: [
    async function runTest(x) {
      // Example evals its code under the imported 'scope'.
      x = x.createSubContext({ scope: {} });

      var self = this;
      // The view renders through a dynamic(), so its children land a tick later.
      var render = async md => {
        var v = self.MarkdownView.create({ data: md }, x);
        v.write(x.document.body);
        await new Promise(r => setTimeout(r, 50));
        return v;
      };
      var find = (e, test) => {
        if ( test(e) ) return e;
        for ( var c of e.childNodes || [] ) {
          var r = find(c, test);
          if ( r ) return r;
        }
      };
      var example = v => find(v, e => self.Example.isInstance(e));

      var v   = await render("<example>log('one');</example>");
      var ex  = example(v);
      x.test(ex && ex.code === "log('one');", 'single-line example captures its code, got ' + ( ex && ex.code ));
      v.remove();

      v  = await render("<example>\nlog('one');\n\nthis.start().add('two').end();\n</example>");
      ex = example(v);
      x.test(ex && ex.code === "log('one');\n\nthis.start().add('two').end();", 'multi-line example captures its code, got ' + ( ex && ex.code ));
      // The code runs on the next animation frame.
      await new Promise(r => setTimeout(r, 100));
      var out = ex && ex.dom.el_().textContent;
      x.test(out === 'onetwo', 'log() and this.start() both write into the output, got ' + out);
      v.remove();

      v = await render('<details>\n**bold**\n</details>');
      x.test(!! v.el_().querySelector('details strong'), 'multi-line markdown inside a details still parses');
      v.remove();
    }
  ]
});
