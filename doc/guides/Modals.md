## Modal Component Hierarchy

The FOAM3 framework has a clear hierarchy of modal components, with `Popup` serving as the base class for all modal dialogs [1](#0-0) .

### Base Component: Popup

`Popup` is the foundational modal component that provides core modal functionality [2](#0-1) :

- Full-screen transparent overlay with centered content
- Background click to close functionality
- Close button with keyboard shortcut support (Escape key) [3](#0-2)
- Basic styling with shadow and border radius [4](#0-3)

### StyledModal: Standardized Modal Design

`StyledModal` extends `Popup` to provide a consistent, styled modal interface [5](#0-4) :

**Key Features:**
- **Title support**: Built-in title header with consistent styling [6](#0-5)
- **Description section**: Optional description text below the title [7](#0-6)
- **Action bar**: Standardized button placement at the bottom [8](#0-7)
- **Modal styles**: Support for different visual styles (DEFAULT, DESTRUCTIVE, WARN) with colored top bars [9](#0-8)
- **Responsive sizing**: Configurable `maxHeight` and `maxWidth` properties [10](#0-9)

### ConfirmationModal: Action-Oriented Dialogs

`ConfirmationModal` extends `StyledModal` for yes/no confirmation scenarios [11](#0-10) :

**Specialized Features:**
- **Primary/Secondary actions**: Built-in support for confirm/cancel button patterns [12](#0-11)
- **Action execution**: Automatically calls the provided action and closes the dialog [13](#0-12)

### ApplicationPopup: Wizard and Flow Context

`ApplicationPopup` extends `Popup` for complex application flows like wizards [14](#0-13) :

**Advanced Features:**
- **Application branding**: Integrated logo and header styling [15](#0-14)
- **Progress tracking**: Built-in progress bar support [16](#0-15)
- **Action management**: Support for leading actions (back buttons) and primary actions [17](#0-16)
- **Responsive design**: Automatic fullscreen mode on mobile devices [18](#0-17)
- **Dynamic content**: Support for dynamic headers and footers [19](#0-18)

## Usage Patterns

The framework registers these components in the build system [20](#0-19) , making them available throughout the application.

**When to use each:**
- **Popup**: For custom modals requiring full control over styling and behavior
- **StyledModal**: For standard application modals with consistent branding
- **ConfirmationModal**: For simple confirmation dialogs with primary/secondary actions
- **ApplicationPopup**: For complex workflows, wizards, and multi-step processes

## Notes

There's also a legacy `PopupView` component [21](#0-20)  that appears to be an older implementation with different positioning logic, but the dialog system primarily uses the `Popup` hierarchy described above. The framework also includes specialized modals like `PropertyModal` [22](#0-21)  for property editing scenarios.

Wiki pages you might want to explore:
- [Framework Initialization and Boot System (kgrgreer/foam3)](/wiki/kgrgreer/foam3#2.1)
- [User Interface Framework (kgrgreer/foam3)](/wiki/kgrgreer/foam3#4)

### Citations

**File:** src/foam/u2/dialog/Popup.js (L18-21)
```javascript
foam.CLASS({
  package: 'foam.u2.dialog',
  name: 'Popup',
  extends: 'foam.u2.borders.ControlBorder',
```

**File:** src/foam/u2/dialog/Popup.js (L23-26)
```javascript
  documentation: `This is a container for a whole-screen, modal overlay. It
    fills the viewport with a transparent grey background, and then
    centers the "content" element. Clicking the background closes the
    dialog. Exports itself as "overlay", for use by OK and CANCEL buttons.`,
```

**File:** src/foam/u2/dialog/Popup.js (L40-96)
```javascript
  css: `
    ^ {
      display: flex;
      flex-direction: column;
      align-items: center;
      bottom: 0;
      height: 100%;
      justify-content: space-around;
      left: 0;
      position: fixed;
      right: 0;
      top: 0;
      width: 100%;
      z-index: 1000;
    }
    ^X {
      position: absolute;
      top: min(10%, 16px);
      right: min(10%, 16px);
      z-index: 1000;
      cursor: pointer;
      transition: all ease-in 0.1s;
      padding: 0;
    }
    ^X:hover{
      transform: scale(1.1)
    }
    ^background {
      background-color: #000;
      bottom: 0;
      left: 0;
      opacity: 0.4;
      position: absolute;
      right: 0;
      top: 0;
    }
    ^inner {
      height: auto;
      width: auto;
      display: flex;
      justify-content: center;
      z-index: 3;
      position: relative;
      border-radius: 3px;
      box-shadow: 0 24px 24px 0 rgba(0, 0, 0, 0.12), 0 0 24px 0 rgba(0, 0, 0, 0.15);
      overflow: auto;
      background: $backgroundDefault;
      /* The following line fixes a stacking problem in certain browsers. */
      will-change: opacity;
    }

    ^fullscreen ^inner {
      height: 100%;
      width: 100%;
      border-radius: 0;
    }
 `,
```

**File:** src/foam/u2/dialog/Popup.js (L170-183)
```javascript
    {
      name: 'closeModal',
      icon: 'images/ic-cancelblack.svg',
      label: '',
      keyboardShortcuts: [ 27 /* Escape */ ],
      code: function() {
        if ( this.onClose ) this.onClose();
        this.closedLatch?.resolve();
        // Delay removal by 32ms (two animation frames) so the action.closeModal
        // topic has a chance to be published
        this.hide();
        this.setTimeout(() => {this.remove()}, 32);
      }
    }
```

**File:** src/foam/u2/dialog/StyledModal.js (L7-25)
```javascript
foam.ENUM({
  package: 'foam.u2.dialog',
  name: 'ModalStyles',

  values: [
    {
      name: 'DEFAULT',
      color: '$backgroundDefault'
    },
    {
      name: 'DESTRUCTIVE',
      color: '$destructive400'
    },
    {
      name: 'WARN',
      color: '$warn400'
    }
  ]
});
```

**File:** src/foam/u2/dialog/StyledModal.js (L27-33)
```javascript
foam.CLASS({
  package: 'foam.u2.dialog',
  name: 'StyledModal',
  extends: 'foam.u2.dialog.Popup',
  documentation: `
    This view is a simple styled modal with a title and ability to add content/strings and actions
  `,
```

**File:** src/foam/u2/dialog/StyledModal.js (L70-75)
```javascript
    ^actionBar {
      display: flex;
      justify-content: flex-end;
      padding: 16px 0px;
      gap: 8px;
    }
```

**File:** src/foam/u2/dialog/StyledModal.js (L104-113)
```javascript
    {
      class: 'String',
      name: 'maxHeight',
      value: '65vh'
    },
    {
      class: 'String',
      name: 'maxWidth',
      value: 'min(90vw, 400px)'
    },
```

**File:** src/foam/u2/dialog/StyledModal.js (L122-124)
```javascript
      name: 'title',
      class: 'String'
    },
```

**File:** src/foam/u2/dialog/StyledModal.js (L137-140)
```javascript
    {
      class: 'String',
      name: 'description'
    }
```

**File:** src/foam/u2/dialog/ConfirmationModal.js (L7-14)
```javascript
foam.CLASS({
  package: 'foam.u2.dialog',
  name: 'ConfirmationModal',
  extends: 'foam.u2.dialog.StyledModal',
  documentation: `
    Extension of styled modal with a primary and secondary action, mainly to be used for conifrmations and yes/no modals.
    Clicking on any action closes performs the action and closes the dialog
  `,
```

**File:** src/foam/u2/dialog/ConfirmationModal.js (L20-35)
```javascript
  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.lang.Action',
      name: 'primaryAction',
      documentation: 'The primary action for this modal dialog (Save/Submit/Continue)',
    },
    {
      class: 'FObjectProperty',
      of: 'foam.lang.Action',
      name: 'secondaryAction',
      documentation: `The secondary action for this modal dialog (Close/Cancel)
      can be turned off using the 'showCancel' property`,
    },
    ['showCancel', true],
    'data'
```

**File:** src/foam/u2/dialog/ConfirmationModal.js (L49-66)
```javascript
  actions: [
    {
      name: 'confirm',
      buttonStyle: 'PRIMARY',
      code: async function(X) {
        await this.primaryAction && this.primaryAction.maybeCall(X, this.data);
        X.closeDialog();
      }
    },
    {
      name: 'cancel',
      buttonStyle: 'TERTIARY',
      code: function(X) {
        this.secondaryAction && this.secondaryAction.maybeCall(X, this.data);
        X.closeDialog();
      }
    }
  ]
```

**File:** src/foam/u2/dialog/ApplicationPopup.js (L7-13)
```javascript
foam.CLASS({
  package: 'foam.u2.dialog',
  name: 'ApplicationPopup',
  extends: 'foam.u2.dialog.Popup',
  documentation: `
    A full-featured popup with the application's branding on it.
  `,
```

**File:** src/foam/u2/dialog/ApplicationPopup.js (L250-257)
```javascript
    {
      class: 'Array',
      name: 'leadingActions'
    },
    {
      class: 'Array',
      name: 'primaryActions'
    },
```

**File:** src/foam/u2/dialog/ApplicationPopup.js (L259-262)
```javascript
      class: 'foam.u2.ViewSpec',
      name: 'progressView',
      value: { class: 'foam.u2.ProgressView' }
    },
```

**File:** src/foam/u2/dialog/ApplicationPopup.js (L264-272)
```javascript
      class: 'foam.u2.ViewSpec',
      name: 'dynamicFooter',
      documentation: 'Content rendered below the body content. Still a part of the body and can change based on the content of the body'
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'dynamicHeader',
      documentation: 'Content rendered above the body content. Still a part of the body and can change based on the content of the body'
    },
```

**File:** src/foam/u2/dialog/ApplicationPopup.js (L286-294)
```javascript
      const updateWidth = () => {
        if ( this.displayWidth?.ordinal <= foam.u2.layout.DisplayWidth.MD.ordinal ) {
          this.forceFullscreen = true;
        } else {
          this.forceFullscreen = false;
        }
      }
      updateWidth();
      this.onDetach(this.displayWidth$.sub(updateWidth))
```

**File:** src/foam/u2/dialog/ApplicationPopup.js (L342-347)
```javascript
            .start()
              .addClass(this.myClass('header-center'))
              .start({ class: 'foam.core.u2.navigation.ApplicationLogoView' })
                .addClass(this.myClass('logo'))
              .end()
            .end()
```

**File:** src/pom.js (L684-689)
```javascript
    { name: "foam/u2/dialog/Popup",                                   flags: "web" },
    { name: "foam/u2/dialog/ApplicationPopup",                        flags: "web" },
    { name: "foam/u2/dialog/DialogActionsView",                       flags: "web" },
    { name: "foam/u2/dialog/StyledModal",                             flags: "web" },
    { name: "foam/u2/dialog/ConfirmationModal",                       flags: "web" },
    { name: "foam/u2/Dialog",                                         flags: "web" },
```

**File:** src/foam/u2/PopupView.js (L18-21)
```javascript
foam.CLASS({
  package: 'foam.u2',
  name: 'PopupView',
  extends: 'foam.u2.Element',
```

**File:** src/foam/u2/PropertyModal.js (L7-10)
```javascript
foam.CLASS({
  package: 'foam.u2',
  name: 'PropertyModal',
  extends: 'foam.u2.dialog.StyledModal',
```
