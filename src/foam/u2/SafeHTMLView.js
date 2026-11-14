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
    <img src=x onerror=alert(1)> would run its script for whoever views it.
    SafeHTMLView passes the data through RichTextValidator.sanitizeText first.
    It keeps simple formatting (B, STRONG, I, EM, U, P, BR, lists, and links
    to an http, https or mailto address), and turns any other element into a
    plain DIV with no attributes, so its text still shows.`,

  requires: [ 'foam.u2.view.RichTextValidator' ],

  listeners: [
    {
      name: 'update',
      code: function() {
        this.element_.replaceChildren(
          this.RichTextValidator.create().sanitizeText(this.data || ''));
      }
    }
  ]
});
