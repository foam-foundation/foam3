<flow name="doc" category="DOC/DEV" spid="foam" label="CRUNCH UI" description="The CRUNCH wizard: invocation via CrunchController, wizard sequences, and the UCJProperty predicate property." keywords="crunch,wizard,crunchcontroller,ucjproperty,knowledge"/>

# CRUNCH Wizard

The CRUNCH wizard is invoked through CrunchController. There are two ways that
CrunchController might be invoked to display wizard:

- A capability is clicked in the Capability Store
- A capability intercept is returned by the server during a request

The Capability Store imports `crunchController` and calls it when a capability
is clicked. The store makes a call similar to the following:
`this.crunchController.createWizardSequence(capability).execute()`

More information on CrunchController and capability intercepts can be found in
the
[CRUNCH Developer Documentation](#flowdoc/CrunchForDeveloper)

## Wizard Sequences

CrunchController methods for invoking the wizard return instances of Sequence.
A sequence contains a number of steps that can be reconfigured or removed before
executing the whole chain. More information about sequences can be found in the
documentation for
[foam.util.async](/#admin.flowdoc::foam-util-async-doc).
The following documentation is derived from the sequence, as sequences are
self-documenting.

### Sequence from createWizardSequence

<foam class="foam.flow.widgets.SequenceSummary" of="foam.u2.crunch.CrunchController" method="createWizardSequence"></foam>

### Sequence from createCapableWizardSequence

<foam class="foam.flow.widgets.SequenceSummary" of="foam.u2.crunch.CrunchController" method="createCapableWizardSequence"></foam>

## UCJProperty

While a property of class `Reference` could be used to reference a
UCJ (UserCapabilityJunction), this requires knowing the value of the UCJ's `id`
property - however, UCJ's can be uniquely identified by their corresponding
capability ID and subject's user IDs. This is a little more complex than a
multipart ID however, as sometimes a UCJ has the subclass
AgentCapabilityJunction and the `effectiveUser` property needs to be specified.

The solution to the above problem is to use a Predicate property instead of a
Reference property. UCJProperty is a convenience property which extends
PredicateProperty. It adapts an object containing the keys `sourceId`,
`targetId`, and optionally `effectiveUser`; to a Predicate that finds the UCJ
based on these values.

<foam class="foam.flow.widgets.PropertyShortSummary" of="foam.core.crunch.UCJProperty" whitelist="['of', 'capability', 'view']"></foam>
