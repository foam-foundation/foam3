<flow name="crunch-doc" category="DOC/DEV" spid="foam"/>
<title>CRUNCH Documentation</title>

<h1>Continuous Reactive User Nano-Capability Hierarchy</h1>

<foam class="foam.flow.widgets.DocumentationIncomplete" status="wip" />

<p>
CRUNCH is a CORE subsystem that enables flexible definitions of incremental steps users can take to gain access to features of an application. A key principle of CRUNCH is the user will only enter new information at the time it's required to perform an action. (although it is possible to have users add information ahead of time also)
</p>

<h2>Purpose of this Document</h2>
This document aims to help a developer use CRUNCH within a larger application.
For documentation on CRUNCH internals, see `.flow` documents inside the
`foam.core.crunch` package itself.

<h2>CRUNCH Concepts</h2>

<h3>Capability</h3>

<p>
A `Capability` is an action that can be performed on the system. Most capabilities will simply be instances of `foam.core.crunch.Capability` in the journal, although subclasses of Capability can be used when special behaviours are desired.
</p>

<p>
Basic configuration of a capability includes specifying what permissions it grants, what information is required from the user, and and when the capability appears.
</p>

<p>
A capability may also depend on other capabilities by its `prerequisites` relationship. In this way, CRUNCH facilitates controlled and incremental aquisition of capabilities.
</p>

<h4>Specify Permissions</h4>
<p>
To specify permissions, use the following property.

<foam class="foam.flow.widgets.PropertyShortSummary" of="foam.core.crunch.Capability" whitelist="['permissionsGranted']" />
</p>

<p>
Specifying permissions is optional. A capability which grants no permissions can be useful for grouping other capabilities.
</p>

<h4>Specify Required Information</h4>
<p>
A capability may require some input from the user. For example, a capability allowing a user to create new content may require their acceptance of a privacy policy.
</p>

<p>
The following properties help to specify required information and how it will be processed:
<foam class="foam.flow.widgets.PropertyShortSummary" of="foam.core.crunch.Capability" whitelist="['of','daoKey','contextDAOFindKey']" />
</p>

<p>
The class specified by `of` will be displayed to the user before the capability is granted. An instance of this class will be stored in a junction between User and Capability. (the UserCapabilityJunction)
</p>

<p>
The `daoKey` property can be used to specify another DAO where the data will be stored. If this is specified, property names of the class specified by the Capability's `of` should match property names of the class specified by the DAO's of.
</p>

<p>
The `contextDAOFindKey` property allows an object in the context to be used as a starting point for the object that is stored in the DAO specified by `daoKey`. For example, a capability which sets a property of `User` can specify `subject.user` as the `contextDAOFindKey`.
</p>

<h4>Configure how capabilities appear in a wizard</h4>

<h3>Wizard configuration with root capability</h3>

<p>
Whenever a CRUNCH wizard is started, the root capability is able to configure
global behaviour of the wizard by providing its own EasyCrunchWizard object. It
is important to note that a capability will only configure the wizard if it is
the root capability - usually the most dependant capability in a tree invoked by
the intercept.
</p>

<foam class="foam.flow.widgets.PropertyShortSummary" of="foam.core.crunch.Capability" whitelist="['wizardConfig']" />

<p>
The options available for StepWizardConfig are in the scope of wizard documentation.
</p>

<p>
As an example, the following journal entry describes a capability that will
configure the wizard to disallow skipping sections.
</p>

<code>
p({
  "class": "foam.core.crunch.Capability",
  "id": "crunch.example",
  "name": "Example Capability",
  "of": "foam.core.crunch.example.ExampleData",
  "wizardConfig": {
    "class": "foam.u2.crunch.EasyCrunchWizard",
    "allowSkipping": false
  }
})
</code>

<h3>Wizardlet configuration for a specific capability</h3>

<h4>Specify When the Capability Appears</h4>

<p>
In CRUNCH, visibility and availability are two separate concepts. Visibility
<u>with respect to capabilities</u><sup>1</sup> determines whether or not a
capability is dislpayed in the capability store, while availability determines
whether or not a capability is available by any means to the user, such as by
being a prerequisite of another capability. Additionally, whether or not a
capability is a prerequisite of another can be determined by using the
`predicate` property of CapabilityCapabilityJunction.
</p>

<p>
The <b>visibilityPredicate</b> property of Capability can specify under what
conditions the capability is visible. This uses context predicates (predicates
which receive a context as their object to evaluate on), simlar to rule
predicates.
</p>

<p>
For example, if we wanted to display "Example Capability" only when another
capability, "crunch.example.prerequisite" is granted, we can use the following
configuration:

<code>
p({
  "class": "foam.core.crunch.Capability",
  "id": "crunch.example",
  "name": "Example Capability",

  ...

  "visibilityPredicate": {
    "class": "foam.core.crunch.predicate.CapabilityIsStatus",
    "capabilityId": "crunch.example",
    "subjectFromUCJ": false
  },
})
</code>
</p>

<p>
The <b>availabilityPredicate</b> property of Capability takes the same type of
predicate as does visibilityPredicate, but instead of controlling the
capability's visibility in the Capability Store in controls whether or not the
user can receive information that this capability exists, or perform actions
that assume it exists.
</p>

<p>
In CapabilityCapabilityJunction, the <b>predicate</b> property may be set to a
context predicate that determines when the prerequisite junction is active.
A common example of this is for conditional prerequisites added by a rule
action; this can be done by setting a predicate that evaluates to false until
a junction has not been manually set.
</p>

<p>
Another important factor in the visibility of capabilities is whether or not
there exists a Capability-CapabilityCategory junction. If a capability is not
in a category, it is possible it will not appear in the Capability Store. A
notable exception is if the capability's `keywords` property contains the
"featured" keyword. In this case, the capability will display as a large card
at the top of the Capability store.
</p>

<hr />
<pre>
[1] The CRUNCH wizard also distiguishes between visibility and availability, but in this case it is concerning wizardlets and is completely independant of Capability availability and visibility.
</pre>

<h3>Capability Prerequisites</h3>
<foam class="foam.flow.widgets.DocumentationIncomplete" status="todo" isSection="true" />

<h3>CRUNCH Intercepts</h3>
<foam class="foam.flow.widgets.DocumentationIncomplete" status="todo" isSection="true" />

<h3>Capability Categories</h3>
<foam class="foam.flow.widgets.DocumentationIncomplete" status="todo" isSection="true" />

<h3>Capability User Associations</h3>
<p>
Some applications may support an "acting as" behaviour for users; for example: a user may act on behalf of a company or organization, which is another type of user. When using CORE's application logic, the object `subject` in context has two properties to determine each user.

<foam class="foam.flow.widgets.PropertyShortSummary" of="foam.core.auth.Subject" whitelist="['realUser', 'user']" />
</p>

<p>
A capability can specify how the user is associated to the capability using the `associatedEntity` property.

<foam class="foam.flow.widgets.PropertyShortSummary" of="foam.core.crunch.Capability" whitelist="['associatedEntity']" />
</p>

<p>
Setting `associatedEntity` to one of these values will affect which user CRUNCH grants the capability to. The default value is USER, so capabilities will be granted to the effective user if this is not set.

<foam class="foam.flow.widgets.EnumSummary" of="foam.core.crunch.AssociatedEntity" />
</p>

<h2>Subclasses of Capability</h2>
<foam class="foam.flow.widgets.DocumentationIncomplete" status="todo" isSection="true" />

<h2>CRUNCH Rules</h2>
<foam class="foam.flow.widgets.DocumentationIncomplete" status="todo" isSection="true" />

notes: ValidateUCJDataOnPut sets of-less cap to PENDING, then
       SetUCJStatusOnPut will set it to GRANTED or keep it PENDING (or ??)
