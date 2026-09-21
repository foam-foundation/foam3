/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

 foam.CLASS({
  package: 'foam.u2.table',
  name: 'TableView',
  extends: 'foam.u2.table.UnstyledTableView',

  cssTokens: [
    {
      name: 'borderSize',
      value: '2px solid $borderDefault'
    }
  ],

  css: `
    ^ {
      border-spacing: 0px;
      overflow-x: unset;
      width: 100%;
    }

    ^tbody {
      display: flow-root;
    }

    ^full-height{
      height: 100%;
    }

    ^table-wrapper{
      /*Scroll*/
      flex: 1;
      max-height: 100%;
      position: relative;
      overflow: auto;
      overscroll-behavior-y: contain;
      scroll-behavior: smooth;
      scroll-padding-top: 48px;
    }
    
    ^table-wrapper .foam-u2-view-LazyScrollManager-table-page {
      contain-intrinsic-width: auto var(--table-width, 100%);
      min-width: var(--table-width, 100%);
    }

    @keyframes slide {
      from {
       top: 32px;
       opacity: 0;
      }
      80% {
        opacity: 0.3;
      }
      to {
        top: 0;
        opacity: 1;
      }
    }
    ^row {
      position: relative;
/*
      animation-duration: 0.3s;
      animation-timing-function: ease;
      animation-name: slide;
*/
    }
    ^tr {
      display: flex;
      height: 48px;
      justify-content: space-between;
    }

    ^tbody ^clickable^tr:hover {
      background: $backgroundTertiary;
      border-radius: 4px;
      cursor: pointer;
    }

    ^thead {
      background: $backgroundDefault;
      position: sticky;
      top: 0;
      z-index: 1;
    }

    ^thead > ^tr {
      border-bottom: $borderSize;
      box-sizing: border-box;
      border-radius: 4px 4px 0 0;
      width: 100%;
      position: relative;
    }

    ^td,
    ^th {
      align-self: center;
      box-sizing: border-box;
      color: $textDefault;
      display: block;
      line-height: 1.5;
      overflow: hidden;
      padding-left: 16px;
      text-align: left;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 40px; /* So when the table's width decreases, columns aren't hidden completely */
    }

    ^th:not(:last-child) > img {
      margin-left: 8px;
    }

    /* Anchor for the resize grip, which is taken out of flow below. The
       right padding is the grip's own width, kept clear so the strip never
       covers the tail of the label and steals its clicks. Scoped to
       ^resizableTh rather than ^th: the multi-select and edit-columns cells
       are ^th too, and reserving grip width in a cell that has no grip just
       narrows it - those two are sized in fixed px, so the 8px comes out of
       a 42px and a 60px box. */
    ^resizableTh {
      padding-right: 8px;
      position: relative;
    }

    /* Sort affordance. The sorted column keeps its arrow on screen; an
       unsorted column reveals the resting arrow on hover or keyboard focus.
       Opacity rather than display so the header never reflows, and the
       hiding is confined to hover-capable pointers - a touch device has no
       hover, so there the arrow stays visible. */
    ^sortable {
      cursor: pointer;
      border-radius: 4px;
      /* Padding keeps the focus ring off the glyphs. The negative side
         margin gives it back, so a sortable label starts at the same x as a
         non-sortable one instead of sitting 0.2em further into the column. */
      margin: 0 -0.2em;
      padding: 0.2em;
    }

    /* The header is focusable, so it needs a visible focus state. Inset the
       outline: ^th clips its overflow, so a ring drawn outside the box would
       be cut off. :focus-visible so a mouse click leaves no ring behind. */
    ^sortable:focus-visible {
      outline: 2px solid $borderBrand;
      outline-offset: -2px;
    }

    ^sortIcon {
      align-items: center;
      display: flex;
    }

    @media (hover: hover) and (pointer: fine) {
      ^sortIcon {
        opacity: 0;
        transition: opacity 0.1s ease;
      }

      ^sortable:hover ^sortIcon,
      ^sortable:focus-within ^sortIcon,
      ^sortIconActive {
        opacity: 1;
      }
    }

    /**
     * OTHER
     */
    ^selected {
      background: $backgroundBrandTertiary;
    }

    ^noselect {
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      -khtml-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
    }

    ^ .disabled {
      color: $grey400;
    }

    ^td .foam-u2-ActionView {
      padding: 4px 12px;
    }

    ^row-group{
      background: $backgroundSecondary;
    }

    ^group-content{
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 4px;
    }
    ^expand-icon.foam-u2-ActionView-expand {
      transition: 0.1s ease;
      transform: rotate(90deg);
      padding: 4px;
    }
    ^expand-icon.foam-u2-ActionView-small svg {
      width: 1.4rem;
      height: 1.4rem;
    }
    ^expand-icon^collapsed {
      transform: rotate(0deg);
    }

    /* An in-flow handle keeps its box even at opacity 0, so every column
       spent ~22px on a control that is invisible almost all of the time -
       and ^th clips with an ellipsis, so that width came straight out of
       the label. Absolute costs the column nothing and puts the grip on the
       boundary it actually drags, rather than sticking it to the right of
       the viewport. Qualified with ^resizableTh so it outranks Button's own
       ^iconOnly^small padding whichever stylesheet installs first. */
    ^resizableTh ^resizeButton.foam-u2-ActionView {
      border: none;
      bottom: 0;
      padding: 0;
      position: absolute;
      right: 0;
      top: 0;
      touch-action: none;
      width: 8px;
    }

    /* The strip is 8px wide because a 2px pointer target is not reliably
       hittable; the line drawn inside it is 2px so it reads as a column
       divider once revealed - it inherits the button's opacity, so like the
       rest of the grip it only shows on hover or keyboard focus. The
       col-resize cursor is the affordance, so no icon. */
    ^resizeButton.foam-u2-ActionView::after {
      background: $borderDefault;
      bottom: 25%;
      content: '';
      position: absolute;
      right: 3px;
      top: 25%;
      width: 2px;
    }

    ^resizeButton.foam-u2-ActionView:hover:not(:disabled), ^resizeCursor {
      cursor: col-resize;
    }

    /* Full-viewport overlay mounted on body for a drag's duration: it wins
       the cursor by hit-test (pointer capture still routes events to the
       handle), needs no per-rule specificity overrides, and covers areas
       outside the table that a captured drag can roam over. */
    ^drag-overlay {
      cursor: col-resize;
      inset: 0;
      position: fixed;
      z-index: 1000;
    }

    /* Hidden via opacity, not display, so the handle stays in the tab
       order and can be revealed by keyboard focus. */
    ^resizeHidden {
      opacity: 0;
    }

    /* PAGINATION */
    ^nav{
      align-items: center;
      border-radius: 0 0 4px 4px;
      border-top: 1px solid $borderDefault;
      box-sizing: border-box;
      gap: 8px;
      justify-content: flex-end;
      max-height: 56px;
      padding: 16px 24px;
      width: 100%;
    }
    ^buttons svg{
      width: 1em;
      height: 1em;
    }
    ^counters > *:focus {
      border: 0px;
      border-radius: 0px;
      padding: 0px;
      height: auto;
      border-bottom: 2px solid $borderBrand;
    }
  `,

  messages: [
    { name: 'MESSAGE_OF', message: 'of'}
  ]
});
