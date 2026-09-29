/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.borders',
  name: 'FillBorder',
  extends: 'foam.u2.Element',

  documentation: `
    Gives the view inside it the full height of its container.

    A detail page (foam.comics.v3.DetailView) wraps its view in the
    DAOControllerConfig's viewBorder. The default, NullBorder, is a plain div
    with no height. A view that wants to fill the page and scroll its tables
    inside it (height: 100% or flex) then collapses to its content, and the
    whole page scrolls instead.

    Use it in the DAOControllerConfig, next to detailView:
      viewBorder: { class: 'foam.u2.borders.FillBorder' }
  `,

  css: `
    ^ {
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    ^ > * {
      flex: 1;
      min-height: 0;
    }
  `,

  methods: [
    function render() {
      this.addClass();
    }
  ]
});
