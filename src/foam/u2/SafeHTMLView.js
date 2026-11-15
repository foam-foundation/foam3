/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2',
  name: 'SafeHTMLView',
  extends: 'foam.u2.HTMLView',

  documentation: `Shows HTML that a user typed, such as a note or a comment.
    HTMLView writes its data into the page as raw HTML, so a value like
    <img src=x onerror=alert(1)> reaches the page with its handler; only the
    Content-Security-Policy stops it from running. SafeHTMLView passes the data
    through RichTextValidator.sanitizeText first. It keeps simple formatting
    (B, STRONG, I, EM, U, P, BR, lists, and links to an http, https or mailto
    address), and turns any other element into a plain DIV with no
    attributes, so its text still shows. It also drops every style attribute.`,

  requires: [ 'foam.u2.view.RichTextValidator' ],

  listeners: [
    {
      name: 'update',
      code: function() {
        var content = this.RichTextValidator.create().sanitizeText(this.data || '');
        // RichTextView keeps style on P, DIV and SPAN for its own editor. Text
        // from another user must not style itself:
        // <div style="position:fixed;inset:0">Session expired, sign in</div>
        // would cover the page with a fake sign-in.
        content.querySelectorAll('[style]').forEach(e => e.removeAttribute('style'));
        this.element_.replaceChildren(content);
      }
    }
  ]
});
