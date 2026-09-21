# The Wizard

What's a wizard? Generally it's any UI which guides a user through a process;
in the case of CRUNCH and the `foam.u2.wizard` package it's specifically a
UI which guides the user through providing the minimum required information
in order to perform the action they attempted to take.

I urge the reader to let that sink in for a moment. That distinction of getting
the minimum required information for a desired action describes not only what
the wizard is doing, but also UX philosophy upon which all the original
intentions for the wizard are rooted.

The `foam.u2.wizard` wizard is the product of a long story; from its original
conception, to new ideas, to product requirements, and eventually to the
current state of affairs (in some ways good; in some ways not so good).

## CrunchController

### Wizard Sequences

#### The "initial state" of a wizard is not trivial

When you open a wizard, what do you see? Firstly, know the wizard is not
designed to show capabilities under the hierarchy that were already granted;
depending on how the user got those capabilities granted this might be
confusing. Instead, it's a wizard catered to the user's current situation
with respect to their own UCJs and the new requirements.

Simple, right? Now, imagine the user doesn't complete everything and opens
the wizard a subsequent time. In UX, consistency and familiarity are considered
important - the user should see all the capabilities they saw before, even if
some of them are now granted. Furthermore, we want the wizard to "start" ahead
of the screens that already filled out, so they should be partway through the
wizard just as they were when they last updated their information.

There are some other initial states where a wizard should not be presented.
If all the remaining capabilities are pending the user should receive a
message saying they need to wait for approval. If all the remaining capabilities
don't require any data then their status should be set to ACTION_REQUIRED and
then CRUNCH will decide if the user gets those capabilities granted or not.

There is also the `grantMode` property of capabilities. This was needed for
things like background checks where the server will decide if a capability
is granted (and there's nothing the user can do about it) - in these situations
`grantMode` will be set to `MANUAL` and such capabilities should not be
displayed in a wizard.

Put all these together and you get a number of context agents that describe
part of the wizard initialization:
- CheckPendingAgent
- CheckNoDataAgent
- WizardStateAgent
- FilterGrantModeAgent
- SkipGrantedAgent


## Timeline of CRUNCH (with emphasis on the wizard)

### "CRUNCH WIP" PR

The CRUNCH wizard begins [with this PR](https://github.com/foam-framework/foam2/pull/3475).
This PR introduces both CRUNCH and the wizard - this was work primarily done by
Kristina, Anna, Ruby, and Eric. It's interesting to note that there was no CrunchService
at this point in time.

At the beginning the wizard was very simple. Its only purpose was to get the
[transient closure](#transient-closure) (`getTC()` method in CrunchController)
and then display the data for each capability in a scrolling wizard.

Wizardlets did not yet have a `load()` or `cancel()` method - just `save()`.

This PR was merged on June 2nd 2020.

### Step Wizard

Shortly thereafter, the [step-by-step wizard](https://github.com/foam-framework/foam2/pull/3544)
with a sidebar was introduced.

This is when the decision to save wizardlets after clicking "next" on each screen was
introduced.

This is also where filtering capabilities with no `of` property from the wizard
was introduced into CrunchController.

The StepWizardController maintained a list of sections generated from wizardlets
based on their `of` property. WizardletSection did not exist at this time.

#### Some PRs that followed...

- [validation added as a concern of wizardlets, + navigation logic in the step wizard](https://github.com/foam-framework/foam2/pull/3554)
- [wizard does put for of-less UCJs upon completion](https://github.com/foam-framework/foam2/pull/3559)
  - this implies that UCJs are not expected to become `GRANTED` unless they're at least
    in `ACTION_REQUIRED` state, even if all their requirements are otherwise met.
- [WizardPosition was added so the wizard has better control over navigation](https://github.com/foam-framework/foam2/pull/3717)
  - this followed a couple small navigation-related updates:
    - [Make empty sections unavailable](https://github.com/foam-framework/foam2/pull/3600)
    - [Update step wizard back button](https://github.com/foam-framework/foam2/pull/3618)
- [Crunch Lab was added](https://github.com/foam-framework/foam2/pull/3692)
- [CrunchService was added](https://github.com/foam-framework/foam2/pull/3753)
- [MinMaxCapability was introduced](https://github.com/foam-framework/foam2/pull/3806)
- [Capability wizardlet properties were added](https://github.com/foam-framework/foam2/pull/3802)
- [crunch.lite AKA Capable was introduced](https://github.com/foam-framework/foam2/pull/3828/files)

#### Trivial updates



### Wizard Sequence

The [wizard launch sequence](https://github.com/foam-framework/foam2/pull/3873)
was introduced to resolve an anti pattern in CrunchController; arguments were
being past down through various method calls between methods which didn't have
any concern for those arguments (i.e. method B gets data Y from method A because
it needs data Y to call method C, but method B's logic doesn't care about data Y).

This would eventually result in such features as:
- [top-level capability being able to configure the wizard](https://github.com/foam-framework/foam2/pull/3884)
- [a separate sequence for crunch.lite / Capable wizards](https://github.com/foam-framework/foam2/pull/3919)

#### Some PRs that followed...
- [WizardletSection was added](https://github.com/foam-framework/foam2/pull/4044)
- [want a nostalgia trip? check out this screenshot](https://github.com/foam-framework/foam2/pull/4140)
- [WAO was introduced](https://github.com/foam-framework/foam2/pull/4336) (that PR has a good diagram)
- [grantMode=MANUAL introduced](https://github.com/foam-framework/foam2/pull/4446)
  - for when a capability is intended to be granted by the system
- [sequence configuration facade added](https://github.com/foam-framework/foam2/pull/4454)
- [WizardState added](https://github.com/foam-framework/foam2/pull/4473)

### Scrollling Wizard

Eventually this [scrolling wizard](https://github.com/foam-framework/foam2/pull/4962)
was added.

This involved [some preperatory updates](https://github.com/foam-framework/foam2/pull/4594)
followed by many updates and bug fixes.

The scroll wizard would auto-save wizardlets as their data was changed and allow the user
to scroll through all the requirements as one contiguous block. This definitely introduced
[some complications](https://github.com/foam-framework/foam2/pull/5044/files)
and maybe [some other complications](https://github.com/foam-framework/foam2/pull/5081/files)
but eventually it worked really well,
except for those times that [it didn't](https://github.com/foam-framework/foam2/pull/5083/files) and we
[needed to make exceptions](https://github.com/foam-framework/foam2/pull/5086/files)
in [various ways](https://github.com/foam-foundation/foam3/pull/45/files).
I'm very glad we're not using this anymore.

We had a very complicated use-case once where the user would update a property and
the server might sanitize it in a way that alters the information as it was presented
by the user. It was important for the user to see the information in its new state,
and also for the user not to be able to continue updating the data once the request
was made (otherwise the update from the server would result in loss of data)

The solution for this was [Loading Border](https://github.com/foam-foundation/foam3/pull/97)
but there was much dispute about how it worked so it was
[updated](https://github.com/foam-foundation/foam3/pull/119).

#### Some PRs that followed...
- [the ability to search wizardlets](https://github.com/foam-foundation/foam3/pull/357)
  - was only ever used in scrolling wizards; may not work in other wizards
- [SequenceMenu and first efforts for non-CRUNCH wizards](https://github.com/foam-foundation/foam3/pull/1313) (first 2022 PR)
- [transient wizard sequences](https://github.com/foam-foundation/foam3/pull/1375)
- [building wizardlet graph on the client](https://github.com/foam-foundation/foam3/pull/1401)
- [wizard inspector added](https://github.com/foam-foundation/foam3/pull/1417)
- [first attempt to support "lifting"](https://github.com/foam-foundation/foam3/pull/1430)
  - this never worked as intended
  - here's a [further attempt](https://github.com/foam-foundation/foam3/pull/1479)
  - also tried to fix lifting [in this one](https://github.com/foam-foundation/foam3/pull/1498)
  - [this was definitely related](https://github.com/foam-foundation/foam3/pull/1503)
  - and [this one](https://github.com/foam-foundation/foam3/pull/1504)
  - and [this one](https://github.com/foam-foundation/foam3/pull/1510)
- all wizards [are in popups now](https://github.com/foam-foundation/foam3/pull/1531)
- this [network failure handling](https://github.com/foam-foundation/foam3/pull/200)
  - screenshot is an example of a capability where the response from the server
    updates the data that was entered, so it's possible that's why I was testing
    this screen the most frequently.

### Focus Wizard

The Focus Wizard started with
[WizardForm and FlexibleWizardFormView](https://github.com/foam-foundation/foam3/pull/1549)
(and [another related PR](https://github.com/foam-foundation/foam3/pull/1542/files)).
[These were later renamed](https://github.com/foam-foundation/foam3/pull/1580)
to **WizardController** and **FlexibleWizardContentsView**
(which maybe should have been named "FlexibleContentsWizardView",
because it's [*] a wizardview *(conceptually (i.e. no WizardView interface exists (because it's not needed))).

#### Some PRs that followed...

- [PathProperty was added](https://github.com/foam-foundation/foam3/pull/1572)
- [AlternateFlow + AlternateFlowAction were added](https://github.com/foam-foundation/foam3/pull/1604)
- [tests capability-defined wizards](https://github.com/foam-foundation/foam3/pull/1617)
- [foam.u2.wizard was organized into sub-packages](https://github.com/foam-foundation/foam3/pull/1630)
- [SplitWAO and foam.u2.wizard.data was introduced](https://github.com/foam-foundation/foam3/pull/1646)
