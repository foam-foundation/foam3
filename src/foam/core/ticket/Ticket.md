<flow name="Ticket" category="DOC/DEV" spid="foam" description="The Ticket system: a base model extended per use case, modelling a scenario as a sequence of steps and status rules." keywords="ticket,scenario,status,rules"/>

# Ticket

The Ticket system is designed with the following intent

- The Ticket base model is extended for each use.
- A Ticket handles a *scenario*, with a *scenario* being a sequence of steps that one must follow to handle or resolve an issue. The *scenario* is described and then modelled buy the ticket. A set of Ticket *statuses* and *rules* will guide the user through the resolution and act on other elements in the system.
