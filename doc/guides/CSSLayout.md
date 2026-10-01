<flow name="CSSLayout" category="DOC/GUIDE" spid="foam" description="What happens to a css: block on its way to the page (install on first create, the <<, ^ and $token text rewrites), which box scrolls and why, pinned headers, hiding, and how popups, modals and z-index layers stack." keywords="css,layout,scroll,overflow,min-height,flex,z-index,stacking,popup,modal,confirmationView,hidden,knowledge"/>

# CSS in FOAM: install, rewrite, scroll, stack

This guide covers what a `css:` block goes through before the browser sees it, and three layout questions that cost time in FOAM views: which box scrolls, how to keep a header pinned, and which overlay paints on top. The list of tokens lives in `src/foam/u2/CSSTokens.js`.

---

## 1. When a `css:` block reaches the page

A class's `css:` axiom is not installed when the class is defined. It wraps the class's `create()`, and the first `create()` in a given document writes one `<style>` element for that class (`src/foam/u2/CSS.js:87-106`, `maybeInstallInDocument` at `:66-85`). A refinement's `css:` block takes the same path, so it appears the first time the refined class is created after the refinement loads.

**Consequence.** A style you expect to see on a page where the class was never instantiated is simply absent. Debug with "was an instance created in this document?", not "is the file loaded?".

## 2. The text rewrite: `<<`, `^` and `$token`

There is no CSS parser in this path. Two regular-expression replacements run over the raw text:

1. **`<<` becomes the class selector** (`CSS.js:115-125`). `<<` followed by a name character becomes `.<css-class>-<rest>`; any other `<<` becomes `.<css-class>`. So for `foam.u2.demo.Card`, `<<title` is `.foam-u2-demo-Card-title`. `^` is the older spelling of the same shorthand and is still replaced the same way; it is deprecated, and FOAM stops replacing it on 2027-06-30 (the LSP marks each one with a hint).
2. **`$name` becomes the token value**, with the original name kept in a comment: `color: $textDefault` becomes `color: /*$textDefault*/ <value>` (`src/foam/lang/stdlib.js:1374-1383`). A token that resolves nowhere becomes `/* failed token replacement <name>, <class>*/` (`stdlib.js:1323`), which leaves the declaration with no value, so the browser drops it and nothing is logged. `CSSAuditTest` reports these as unknown tokens, with a did-you-mean (`src/foam/core/theme/test/CSSAuditTest.js:1218`).

**The `^` rewrite does not know about attribute selectors.** `[class^="btn"]` ("class starts with btn") becomes `[class.foam-u2-demo-Card="btn"]`, which is not a valid selector. The browser drops a rule whose selector list holds one invalid selector, so every other selector in that rule loses its styles too, not only the attribute one. FOAM's own CSS grammar test records the rewrite: `[class^=z]: the ^ of ^= is a caret with inAttr (FOAM still rewrites it)` (`src/foam/u2/parse/test/CSSParserTest.js:326`). Writing `<<` for the class does not help yet: the same replacement still rewrites every `^`, so until `^` stops being replaced, put a class on the elements you want and select that class instead. After that date, `<<` for the class plus a plain `[class^="btn"]` works.

## 3. Which box scrolls

A box scrolls only when its content is taller than **its own** height limit. A box with no limit grows to fit its content and never scrolls, so the nearest ancestor that does have a limit becomes the scroll box. Moving a `max-height` from an inner box to an outer one therefore moves the scrollbar too, and the outer box's content includes whatever the inner box had pinned above its list.

**Pinned header, scrolling list.** Three things together, none of which is `position: sticky`:

1. The card has a definite height limit and `display: flex; flex-direction: column`.
2. The header is an ordinary flex child.
3. The list has `min-height: 0` and `overflow-y: auto`. A flex child's default `min-height: auto` refuses to shrink below its content, so without `min-height: 0` the list pushes the card taller instead of scrolling. `flex: 1` is optional: it makes a short list fill the card, but the scrolling comes from `min-height: 0` (`src/foam/u2/view/EditColumnsView.js:57-60` scrolls without it).

Break any one and the card grows until a capped ancestor scrolls everything, header included.

**When the limit must live on an outer wrapper.** `foam.u2.md.OverlayDropdown` sets `max-height` and `overflow-y: auto` on its own element (`src/foam/u2/md/OverlayDropdown.js:187-188`), so whatever you put inside it scrolls as one piece. The column picker keeps its search box pinned by making the dropdown a flex column and giving its own container and list `min-height: 0` (`src/foam/u2/view/EditColumnsView.js:44-59`):

```css
^overlay .foam-u2-md-OverlayDropdown { display: flex; flex-direction: column; }
^container { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
^container .foam-u2-view-ColumnConfigPropView-colContainer { min-height: 0; overflow-y: auto; }
```

**Why sticky is not the fix.** `position: sticky` sticks relative to the nearest ancestor that scrolls. Inside a box that grew to fit its content, nothing scrolls at that level, so the header has nothing to stick to.

**A detail page that should fill the screen** is wrapped in the controller config's `viewBorder`, a plain div with no height by default. Use `foam.u2.borders.FillBorder`; its documentation explains the height chain (`src/foam/u2/borders/FillBorder.js:12-22`).

## 4. Hiding an element

`shown: false` adds the class `foam-u2-Element-hidden` (`src/foam/u2/Element2.js:605-615`), which is `display: none !important` (`src/foam/lang/Window.js:154-158`). A `display:` rule in your own `css:` cannot bring a hidden element back; set `shown` instead.

## 5. What paints on top

Floating elements use the page layer tokens: `$z-nav` 100, `$z-popup` 200, `$z-modal` 300, `$z-tooltip` 400, `$z-toast` 500. The comment above them explains the order (`src/foam/u2/CSSTokens.js:386-406`). For stacking inside one view, use `$z-0` to `$z-50`.

`foam.u2.dialog.Popup` is `position: fixed` with `z-index: $z-modal` (`src/foam/u2/dialog/Popup.js:44-53`), so it starts its own stacking context. A dropdown opened inside a modal competes only with the modal's other children and does not need a higher layer.

**An action's confirmation modal can open behind a popup.** When an action has a `confirmationView`, `ActionView` adds the modal as a child of `ctrl`, the application's root element (`src/foam/u2/ActionView.js:189-203`). `Popup.open()` instead appends the popup to the end of `document.body` (`Popup.js:159-163`, `Element2.js:1509-1513`). Both sit on `$z-modal`, so the one later in the document wins, and that is the popup. An action inside a popup dialog therefore shows its confirmation underneath the dialog.

Fix: from inside a popup, build the modal yourself and open it on `body`:

```javascript
// requires: [ 'foam.u2.dialog.ConfirmationModal' ]
code: function(X) {
  this.ConfirmationModal.create({
    primaryAction: this.DELETE_SELECTED,  // an action that does the work
    data: this,
    title: this.CONFIRM_TITLE
  }, X).add(this.CONFIRM_BODY).open();
}
```

Two related facts: `ActionView` only shows a `confirmationView` when `ctrl` is in the context (`ActionView.js:189`); without it the action runs with no confirmation. Returning a falsy value from `confirmationView` runs the action directly, which suits a "nothing selected" case.
