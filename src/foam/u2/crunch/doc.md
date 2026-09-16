<flow name="doc" category="DOC/DEV" spid="foam"/>
<title>CRUNCH UI</title>

<h1>CRUNCH Wizard</h1>

The CRUNCH wizard is invoked through CrunchController. There are two ways that
CrunchController might be invoked to display wizard:
<ul>
  <li>A capability is clicked in the Capability Store</li>
  <li>A capability intercept is returned by the server during a request</li>
</ul>

The Capability Store imports `crunchController` and calls it when a capability
is clicked. The store makes a call similar to the following:
<code>
this.crunchController.createWizardSequence(capability).execute()
</code>

More information on CrunchController and capability intercepts can be found in
the
<a href="#flowdoc/CrunchForDeveloper">
  CRUNCH Developer Documentation
</a>

<h2>Wizard Sequences</h2>

CrunchController methods for invoking the wizard return instances of Sequence.
A sequence contains a number of steps that can be reconfigured or removed before
executing the whole chain. More information about sequences can be found in the
documentation for
<a href="/#admin.flowdoc::foam-util-async-doc">foam.util.async</a>.
The following documentation is derived from the sequence, as sequences are
self-documenting.

<h3>Sequence from createWizardSequence</h3>
<foam class="foam.flow.widgets.SequenceSummary" of="foam.u2.crunch.CrunchController" method="createWizardSequence" />

<h3>Sequence from createCapableWizardSequence</h3>
<foam class="foam.flow.widgets.SequenceSummary" of="foam.u2.crunch.CrunchController" method="createCapableWizardSequence" />

<h2>UCJProperty</h2>

<p>
While a property of class `Reference` could be used to reference a
UCJ (UserCapabilityJunction), this requires knowing the value of the UCJ's `id`
property - however, UCJ's can be uniquely identified by their corresponding
capability ID and subject's user IDs. This is a little more complex than a
multipart ID however, as sometimes a UCJ has the subclass
AgentCapabilityJunction and the `effectiveUser` property needs to be specified.
</p>

<p>
The solution to the above problem is to use a Predicate property instead of a
Reference property. UCJProperty is a convenience property which extends
PredicateProperty. It adapts an object containing the keys `sourceId`,
`targetId`, and optionally `effectiveUser`; to a Predicate that finds the UCJ
based on these values.
</p>

<foam class="foam.flow.widgets.PropertyShortSummary" of="foam.core.crunch.UCJProperty" whitelist="['of', 'capability', 'view']" />
