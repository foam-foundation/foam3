<flow name="Wizard" category="DOC/DEV" spid="foam" label="Modular Wizard Documentation"/>

# THIS DOCUMENTATION IS OUT OF DATE

I've decided to preserve this documentation because it provides potentially
useful context about how the wizard was develeoped.

When reading this documentation, be aware of the following:

- StepWizardController logic was moved to IncrementalWizardController
- all wizard controllers are meant to extend WizardController now
- ScrollingStepWizardView has not been tested any time recently so far as I'm aware
- IncrementalStepWizardView is sometimes called "the sidebar wizard" by other devs

# Wizardlet Models

## Wizardlet

A wizardlet is an independent portion of a wizard. It describes its data, views,
and how it's saved and loaded. Wizardlets can be visible, allowing a user to
fill in their data; or invisible, providing hidden functionality for saving or
acting on wizard events.

Every wizardlet has a property `of` which specifies a model containing data a
user needs to enter into the wizard (which will be instantiated as `data`).
The `of` property may also be null to indicate that this wizardlet doesn't have
any data to enter. (although, the wizardlet may still appear if the `sections`
property is overridden to display a custom view)

<foam class="foam.flow.widgets.TabbedModelDocumentation" defaultTab="methods" of="foam.u2.wizard.wizardlet.Wizardlet" />

## WizardletSection

Wizardlets are sectioned. By default, a wizardlet will contain WizardletSection
instances derived from 'of's section axioms. The abstraction of WizardletSection
allows adding custom views to a wizardlet independently from the data model.

The MinMaxCapabilityWizardlet is an example where a custom WizardletSection is
used to display a selection of choices.

<foam class="foam.flow.widgets.TabbedModelDocumentation" defaultTab="properties" of="foam.u2.wizard.wizardlet.WizardletSection" />

# Wizards

Wizards are created by combining StepWizardController with a compatible view.
An instance of StepWizardController should be the value of the view's data
property.

## StepWizardController

StepWizardController implements the behaviour for a wizard. It creates listeners
on all wizardlets to provide status properties like 'allValid' and
'visitedWizardlets'. It also contains logic for skippiing unavailable wizardlets
and moving the position backwards if a previous wizardlet becomes available.

The following properties are useful to initialize when creating the controller:
<foam class="foam.flow.widgets.PropertyShortSummary" of="foam.u2.wizard.StepWizardController" whitelist="['wizardlets', 'config', 'wizardPosition']" />

## IncrementalStepWizardView

This is a view for StepWizardController implementing a "page by page" approach
wizard navigation. Each section will be seen on a separate screen, and the user
must click "next" to reach the next screen. Requiring the user to click next
allows control over how they proceed, as they must provide valid data before
continuing.

## ScrollingStepWizardView

This is a view for StepWizardController implementing a single scrolling view
containing all sections. This allows a user to fill in sections in any order
they choose, making it ideal for cases where a user might not have all the
requirement information immediately.

## StepWizardConfig

This is the model used for the 'config' property of StepWizardController.
<foam class="foam.flow.widgets.PropertyShortSummary" of="foam.u2.wizard.StepWizardConfig" />

# Wizardlet Save Logic

## Overview

Possibly the most complex logic in the wizard is when and how wizardlets are
saved. The wizardlet interface defines a `save` method which wizardlet
subclasses are expected to implement, the most common case being
CapabilityWizardlet which saves the data using CrunchService.

## Auto-Save

Auto-save is currently the primary way wizardlets get saved in lieu of a close
  action. The feature consists of the following components:

  
- AutoSaveWizardletsAgent
- WizardletAutoSaveSlot
- FObjectRecursionSlot
- Any implementation of `getDataUpdateSub` on wizardlets

**AutoSaveWizardletsAgent** is a context agent that can be added to a wizard
  sequence, such as `createWizardSequence` defined in CrunchController. This
  context agent calls getDataUpdateSub on each wizardlet to get a slot, and
  attaches a listener to each slot that saves the corresponding wizardlet.

**FObjectRecursionSlot** makes it possible to listen for property changes
  on an FObject, as well as properties of any nested FObject recursively. This
  is used to detect changes in a wizardlet's `data` object so that a save can
  be invoked. While FObjectRecursionSlot's behaviour is simple, the code is
  complex because it must avoid circular references, and ignore certain types
  of properties such as DAOProperty which are not useful to detect user-caused
  changes.

**WizardletAutoSaveSlot** wraps FObjectRecursionSlot to prevent frequent
  saves. Unlike a merged listener, which may not save after the most recent
  change, a series of updates in quick succession will push the invocation of
  saving away until a specified delay has occurred since the last update.

The **getDataUpdateSub** on BaseWizardlet sets up the general case of a
  WizardletAutoSaveSlot wrapping an FObjectRecursionSlot. If the data model
  of a wizardlet implements WizardletAware and defines a method called
  customUpdateSlot, then that slot will be fed into WizardletAutoSaveSlot.
  This can be useful when it's known that only a single property will be
  updated by a user.

## Triggered Save

When a data model implements WizardletAware, it can implement a method called
  `installInWizardlet`. This method is called and passed the Wizardlet instance
  after the instance of the data model is set on the wizardlet's `data`
  property. At this point the data model has access to the wizardlet and can
  invoke the save method manually. When the wizardlet is saved this way, and no
  parameters are passed to `wizardlet.save`, this is called a triggered save.
  The most important difference between this and an auto save is that user input
  will be blocked until a response is received from the server. This gives the
  server an opportunity to update properties on the data model to provide
  important feedback to a user.

## Final Save

Final save is done by a context agent that appears in the wizard sequence
  after StepWizardAgent, called SaveAllAgent. This is typically surrounded
  by SpinnerAgent and DetachSpinnerAgent so that a fullscreen spinner can be
  displayed after the wizard is closed and until the final save is complete.
  The final save is not always necessary but works as a failsafe in case the
  user closes the wizard before an auto-save is completed, or if for any other
  reason (for example, due to an exception that was thrown) the auto-save
  functionality fails.

## Incremental Save

Incremental saving used to be supported, but is currently not available. When
  using IncrementalStepWizardView the next button would also trigger a save on
  the current wizardlet before moving to the next one. If this ever needs to be
  re-enabled it is possible to do by calling `saveProgress` on
  StepWizardController whenever the wizard position is about to change, but it
  should be verified that the `visitedWizardlets` property is still being updated
  accurately.
