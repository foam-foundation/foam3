<flow name="UserLifecycleTicket" category="DOC/DEV" spid="foam" label="UserLifecycleTicket" description="UserLifecycleTicket manages user deletion: orphaned associations, self-deletion rules, and blocking reactivation." keywords="user lifecycle,ticket,deletion,ucj,knowledge"/>

# Incomplete

UserLifecycleTicket is a ticket which helps manage user deletion.
It is common to have relationships between a user and other application entities,
and when a user is deleted, many of the associates should be deleted as well.
An example is UCJs, which become orphaned when a user is deleted.

Users can delete themselves via menu ... which invokes rule foam-core-auth-UserLifecycleDeleteSelfRule and if gneerateTicket is true, will create a UserLifecycleTicket to manage the user's deletion.

On UserLifecyclTicket CLOSE the user and all the associations are deleted.  Should the user be in a state which cannot be deleted, then the user is disabled and sessions are deleted - so at least they cannot log in.

- foam.core.auth.UserLifecycleTicketRuleAction has foam associations
- application  UserLifecycleTicketRuleAction would have application associations.

extend foam UserLifecycleTicketRuleAction and implement
verifyReActivation
throw exception if reactivation of user should be blocked.

updateUserAssociations
if the user cannot be deleted, throw an IllegalStateException
